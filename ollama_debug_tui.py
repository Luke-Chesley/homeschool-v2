#!/usr/bin/env python3
# RUN WITH 
# OLLAMA_DEBUG=1 ollama serve 2>&1 | python3 /home/luke/Desktop/homeschool-v2/ollama_debug_tui.py --stdin

from __future__ import annotations

import argparse
import curses
import re
import statistics
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

TS_RE = re.compile(r'time=([0-9T:\.\-\+]+)')
# More tolerant than the original: allow any non-pipe blob in the client column
GIN_RE = re.compile(
    r'\[GIN\]\s+(\d{4}/\d{2}/\d{2}) - (\d{2}:\d{2}:\d{2}) \|\s+(\d+)\s+\|\s+([^\|]+?)\s+\|\s+([^\|]+?)\s+\|\s+(\w+)\s+"([^"]+)"'
)
SERVER_LISTEN_RE = re.compile(r'Listening on ([^ ]+) \(version ([^)]+)\)')
RUNNER_STARTED_RE = re.compile(r'llama runner started in ([0-9.]+) seconds')
FINISHED_SETUP_RE = re.compile(
    r'runner\.name=([^ ]+).*?runner\.size="([^"]+)".*?runner\.vram="([^"]+)".*?runner\.parallel=(\d+).*?runner\.pid=(\d+).*?runner\.num_ctx=(\d+)'
)
OFFLOADED_RE = re.compile(r'offloaded (\d+)/(\d+) layers to GPU')
DEVICE_SIZE_RE = re.compile(r'device=([A-Za-z0-9]+)\s+size="([^"]+)"')
GPU_COMPUTE_RE = re.compile(r'description="([^"]+)".*?total="([^"]+)".*?available="([^"]+)"')
LOAD_PROGRESS_RE = re.compile(r'model load progress ([0-9.]+)')
COMP_REQ_RE = re.compile(r'completion request.*?images=(\d+).*?prompt=([0-9]+).*?format="([^"]*)"')
CACHE_SLOT_RE = re.compile(r'loading cache slot.*?id=(\d+).*?cache=(\d+).*?prompt=(\d+).*?used=(\d+).*?remaining=(\d+)')
DECODED_RE = re.compile(r'decoded string=(.*) from=')
IDLE_TIMER_RE = re.compile(r'duration=([0-9a-zA-Z\.]+)')
VRAM_DEFAULT_CTX_RE = re.compile(r'default_num_ctx=(\d+)')
LOAD_REQUEST_RE = re.compile(r'load request="\{([^}]*)\}"')
KV_SIZE_RE = re.compile(r'KvSize:(\d+)')
GPU_LAYERS_RE = re.compile(r'GPULayers:(\d+)')
NUM_THREADS_RE = re.compile(r'NumThreads:(\d+)')
BATCH_SIZE_RE = re.compile(r'BatchSize:(\d+)')
PARALLEL_RE = re.compile(r'Parallel:(\d+)')
MODEL_LAYERS_RE = re.compile(r'"model layers"=(\d+)')
REFRESH_RE = 0.2


def parse_ts(line: str) -> Optional[float]:
    m = TS_RE.search(line)
    if not m:
        return None
    raw = m.group(1)
    try:
        return datetime.fromisoformat(raw).timestamp()
    except Exception:
        return None


def parse_duration_seconds(text: str) -> Optional[float]:
    text = text.strip()
    try:
        if text.endswith("ms"):
            return float(text[:-2]) / 1000.0
        if text.endswith("µs"):
            return float(text[:-2]) / 1_000_000.0
        if text.endswith("us"):
            return float(text[:-2]) / 1_000_000.0
        if text.endswith("ns"):
            return float(text[:-2]) / 1_000_000_000.0
        if text.endswith("s"):
            return float(text[:-1])
        return float(text)
    except Exception:
        return None


@dataclass
class RequestInfo:
    start_ts: float
    prompt_field: Optional[int] = None
    images: Optional[int] = None
    format_name: str = ""
    cache_prompt: Optional[int] = None
    cache_used: Optional[int] = None
    cache_remaining: Optional[int] = None
    decoded_pieces: int = 0
    parser_chunks: int = 0
    eos_count: int = 0
    status: Optional[int] = None
    duration_s: Optional[float] = None
    method: str = ""
    path: str = ""
    end_ts: Optional[float] = None
    client: str = ""

    @property
    def approx_tps(self) -> Optional[float]:
        if self.duration_s and self.duration_s > 0 and self.decoded_pieces > 0:
            return self.decoded_pieces / self.duration_s
        return None


@dataclass
class State:
    host: str = ""
    version: str = ""
    gpu_name: str = ""
    gpu_total: str = ""
    gpu_available: str = ""
    default_num_ctx: Optional[int] = None

    model_name: str = ""
    runner_size: str = ""
    runner_vram: str = ""
    runner_parallel: Optional[int] = None
    runner_pid: Optional[int] = None
    runner_num_ctx: Optional[int] = None
    runner_keepalive: str = ""

    total_memory: str = ""
    cpu_weights: str = ""
    gpu_weights: str = ""
    kv_cache: str = ""
    cpu_graph: str = ""
    gpu_graph: str = ""
    offloaded_layers: Optional[tuple[int, int]] = None
    model_layers: Optional[int] = None

    load_duration_s: Optional[float] = None
    load_progress: float = 0.0
    batch_size: Optional[int] = None
    kv_size: Optional[int] = None
    gpu_layers_requested: Optional[int] = None
    num_threads: Optional[int] = None
    parallel: Optional[int] = None

    current_request: Optional[RequestInfo] = None
    recent_requests: deque[RequestInfo] = field(default_factory=lambda: deque(maxlen=25))
    recent_events: deque[str] = field(default_factory=lambda: deque(maxlen=12))
    total_requests: int = 0

    def push_event(self, msg: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        self.recent_events.appendleft(f"[{stamp}] {msg}")

    @property
    def last_request(self) -> Optional[RequestInfo]:
        return self.recent_requests[-1] if self.recent_requests else None

    @property
    def avg_request_s(self) -> Optional[float]:
        vals = [r.duration_s for r in self.recent_requests if r.duration_s is not None]
        return statistics.mean(vals) if vals else None

    @property
    def avg_tps(self) -> Optional[float]:
        vals = [r.approx_tps for r in self.recent_requests if r.approx_tps is not None]
        vals = [v for v in vals if v is not None]
        return statistics.mean(vals) if vals else None


def fmt(x: Optional[float], suffix: str = "") -> str:
    if x is None:
        return "n/a"
    return f"{x:.2f}{suffix}"


def update_state(state: State, line: str) -> None:
    ts = parse_ts(line)

    m = SERVER_LISTEN_RE.search(line)
    if m:
        state.host, state.version = m.group(1), m.group(2)

    m = GPU_COMPUTE_RE.search(line)
    if m:
        state.gpu_name, state.gpu_total, state.gpu_available = m.group(1), m.group(2), m.group(3)

    m = VRAM_DEFAULT_CTX_RE.search(line)
    if m:
        state.default_num_ctx = int(m.group(1))

    m = MODEL_LAYERS_RE.search(line)
    if m:
        state.model_layers = int(m.group(1))

    m = RUNNER_STARTED_RE.search(line)
    if m:
        state.load_duration_s = float(m.group(1))
        state.load_progress = 1.0
        state.push_event(f"runner ready in {state.load_duration_s:.2f}s")

    m = LOAD_PROGRESS_RE.search(line)
    if m:
        state.load_progress = float(m.group(1))

    m = FINISHED_SETUP_RE.search(line)
    if m:
        state.model_name = m.group(1)
        state.runner_size = m.group(2)
        state.runner_vram = m.group(3)
        state.runner_parallel = int(m.group(4))
        state.runner_pid = int(m.group(5))
        state.runner_num_ctx = int(m.group(6))

    m = OFFLOADED_RE.search(line)
    if m:
        state.offloaded_layers = (int(m.group(1)), int(m.group(2)))

    if 'msg="model weights"' in line:
        m = DEVICE_SIZE_RE.search(line)
        if m:
            dev, size = m.group(1), m.group(2)
            if dev.upper().startswith("CPU"):
                state.cpu_weights = size
            else:
                state.gpu_weights = size

    if 'msg="kv cache"' in line:
        m = DEVICE_SIZE_RE.search(line)
        if m:
            state.kv_cache = m.group(2)

    if 'msg="compute graph"' in line:
        m = DEVICE_SIZE_RE.search(line)
        if m:
            dev, size = m.group(1), m.group(2)
            if dev.upper().startswith("CPU"):
                state.cpu_graph = size
            else:
                state.gpu_graph = size

    if 'msg="total memory"' in line:
        m = re.search(r'size="([^"]+)"', line)
        if m:
            state.total_memory = m.group(1)

    if 'msg=load request=' in line:
        body_m = LOAD_REQUEST_RE.search(line)
        if body_m:
            body = body_m.group(1)
            km = KV_SIZE_RE.search(body)
            gm = GPU_LAYERS_RE.search(body)
            nm = NUM_THREADS_RE.search(body)
            bm = BATCH_SIZE_RE.search(body)
            pm = PARALLEL_RE.search(body)
            if km:
                state.kv_size = int(km.group(1))
            if gm:
                state.gpu_layers_requested = int(gm.group(1))
            if nm:
                state.num_threads = int(nm.group(1))
            if bm:
                state.batch_size = int(bm.group(1))
            if pm:
                state.parallel = int(pm.group(1))

    if 'msg="completion request"' in line:
        m = COMP_REQ_RE.search(line)
        if ts is None:
            ts = time.time()
        req = RequestInfo(start_ts=ts)
        if m:
            req.images = int(m.group(1))
            req.prompt_field = int(m.group(2))
            req.format_name = m.group(3)
        state.current_request = req
        state.push_event(f"request started prompt={req.prompt_field or '?'}")

    if 'loading cache slot' in line and state.current_request:
        m = CACHE_SLOT_RE.search(line)
        if m:
            state.current_request.cache_prompt = int(m.group(3))
            state.current_request.cache_used = int(m.group(4))
            state.current_request.cache_remaining = int(m.group(5))

    if 'decoded string=' in line and state.current_request:
        state.current_request.decoded_pieces += 1

    if 'builtin parser output' in line and state.current_request:
        state.current_request.parser_chunks += 1

    if 'msg="computeBatch: EOS"' in line and state.current_request:
        state.current_request.eos_count += 1

    m = GIN_RE.search(line)
    if m:
        req = state.current_request or RequestInfo(start_ts=ts or time.time())
        req.status = int(m.group(3))
        req.duration_s = parse_duration_seconds(m.group(4))
        req.client = m.group(5).strip()
        req.method = m.group(6)
        req.path = m.group(7)
        req.end_ts = ts
        state.recent_requests.append(req)
        state.total_requests += 1
        state.current_request = None
        tps = req.approx_tps
        dur = fmt(req.duration_s, "s")
        if tps is not None:
            state.push_event(f"{req.method} {req.path} {dur} ~{tps:.1f} tok/s")
        else:
            state.push_event(f"{req.method} {req.path} {dur}")

    if 'adding timer' in line:
        m = IDLE_TIMER_RE.search(line)
        if m:
            state.runner_keepalive = m.group(1)


def reader_from_stdin(lines_deque: deque[str]) -> None:
    for raw in sys.stdin:
        lines_deque.append(raw.rstrip("\n"))


def reader_from_file(path: str, follow: bool, lines_deque: deque[str]) -> None:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        while True:
            line = f.readline()
            if line:
                lines_deque.append(line.rstrip("\n"))
            elif follow:
                time.sleep(0.1)
            else:
                break


def draw(stdscr, state: State) -> None:
    stdscr.erase()
    h, w = stdscr.getmaxyx()

    def add(y: int, x: int, text: str, attr=0):
        if 0 <= y < h and x < w:
            stdscr.addnstr(y, x, text, max(0, w - x - 1), attr)

    title = "Ollama Debug TUI  |  q quit"
    add(0, 0, title, curses.A_BOLD)

    add(2, 0, f"Server: {state.host or 'n/a'}   Version: {state.version or 'n/a'}")
    add(3, 0, f"GPU: {state.gpu_name or 'n/a'}   Total: {state.gpu_total or 'n/a'}   Avail@discover: {state.gpu_available or 'n/a'}")
    add(4, 0, f"Default ctx: {state.default_num_ctx or 'n/a'}   Active ctx: {state.runner_num_ctx or 'n/a'}   Keep-alive: {state.runner_keepalive or 'n/a'}")

    add(6, 0, f"Model: {state.model_name or 'n/a'}")
    add(7, 0, f"Runner pid: {state.runner_pid or 'n/a'}   runner size: {state.runner_size or 'n/a'}   runner vram: {state.runner_vram or 'n/a'}")
    off = f"{state.offloaded_layers[0]}/{state.offloaded_layers[1]}" if state.offloaded_layers else "n/a"
    add(8, 0, f"Offload layers: {off}   Requested GPU layers: {state.gpu_layers_requested or 'n/a'}   Model layers: {state.model_layers or 'n/a'}")
    add(9, 0, f"Weights GPU/CPU: {state.gpu_weights or 'n/a'} / {state.cpu_weights or 'n/a'}   KV: {state.kv_cache or 'n/a'}")
    add(10, 0, f"Graph GPU/CPU: {state.gpu_graph or 'n/a'} / {state.cpu_graph or 'n/a'}   Total mem: {state.total_memory or 'n/a'}")
    add(11, 0, f"Batch: {state.batch_size or 'n/a'}   Threads: {state.num_threads or 'n/a'}   Parallel: {state.parallel or state.runner_parallel or 'n/a'}")

    bar_w = max(10, min(40, w - 20))
    progress = max(0.0, min(1.0, state.load_progress))
    filled = int(progress * bar_w)
    bar = "[" + "#" * filled + "-" * (bar_w - filled) + "]"
    add(13, 0, f"Load progress: {bar} {progress*100:5.1f}%   Last load: {fmt(state.load_duration_s, 's')}")

    add(15, 0, f"Requests: {state.total_requests}   Avg req: {fmt(state.avg_request_s, 's')}   Avg approx tok/s: {fmt(state.avg_tps)}")

    req = state.current_request
    if req:
        add(16, 0, f"In-flight: prompt={req.prompt_field or 'n/a'} images={req.images or 0} decoded={req.decoded_pieces} parser_chunks={req.parser_chunks}")
    else:
        add(16, 0, "In-flight: none")

    last = state.last_request
    if last:
        add(17, 0, f"Last req: {last.method} {last.path} status={last.status} dur={fmt(last.duration_s, 's')} prompt={last.prompt_field or 'n/a'} cache_prompt={last.cache_prompt or 'n/a'}")
        add(18, 0, f"          decoded={last.decoded_pieces} parser_chunks={last.parser_chunks} eos={last.eos_count} approx tok/s={fmt(last.approx_tps)} client={last.client or 'n/a'}")
    else:
        add(17, 0, "Last req: none")

    add(20, 0, "Recent events:", curses.A_BOLD)
    for i, ev in enumerate(list(state.recent_events)[: max(0, h - 22)]):
        add(21 + i, 0, ev)

    stdscr.refresh()


def run_tui(stdscr, lines_deque: deque[str]) -> None:
    curses.curs_set(0)
    stdscr.nodelay(True)
    state = State()

    while True:
        while lines_deque:
            update_state(state, lines_deque.popleft())

        draw(stdscr, state)
        ch = stdscr.getch()
        if ch in (ord('q'), ord('Q')):
            break
        time.sleep(REFRESH_RE)


def main() -> int:
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--stdin", action="store_true", help="read log lines from stdin")
    src.add_argument("--file", type=str, help="read log lines from file")
    ap.add_argument("--follow", action="store_true", help="follow file for new lines")
    args = ap.parse_args()

    lines_deque: deque[str] = deque()

    import threading
    if args.stdin:
        t = threading.Thread(target=reader_from_stdin, args=(lines_deque,), daemon=True)
    else:
        t = threading.Thread(target=reader_from_file, args=(args.file, args.follow, lines_deque), daemon=True)
    t.start()

    curses.wrapper(run_tui, lines_deque)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())