"use client";

import * as React from "react";
import { Search, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Standard, StandardsFramework } from "@/lib/standards/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StandardsBrowserProps {
  /** Pre-selected standard IDs */
  selectedIds?: string[];
  onToggle?: (standard: Standard) => void;
  /** If provided, restrict to this framework */
  frameworkId?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Standard row
// ---------------------------------------------------------------------------

function StandardRow({
  standard,
  selected,
  onToggle,
  hasChildren,
  onDrill,
}: {
  standard: Standard;
  selected: boolean;
  onToggle: (s: Standard) => void;
  hasChildren: boolean;
  onDrill: (s: Standard) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 transition-colors",
        "hover:bg-muted/60"
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(standard)}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card/70"
        )}
        aria-label={selected ? `Deselect ${standard.code}` : `Select ${standard.code}`}
      >
        {selected && <Check className="size-3" />}
      </button>
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-xs font-mono text-muted-foreground">{standard.code}</span>
        <span className="text-sm leading-snug">{standard.title}</span>
      </div>
      {hasChildren && (
        <button
          type="button"
          onClick={() => onDrill(standard)}
          className="shrink-0 rounded p-1 hover:bg-muted"
          aria-label={`Expand ${standard.code}`}
        >
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main browser
// ---------------------------------------------------------------------------

export function StandardsBrowser({
  selectedIds = [],
  onToggle,
  frameworkId: initialFrameworkId,
  className,
}: StandardsBrowserProps) {
  const [frameworks, setFrameworks] = React.useState<StandardsFramework[]>([]);
  const [frameworkId, setFrameworkId] = React.useState(
    initialFrameworkId ?? ""
  );
  const [query, setQuery] = React.useState("");
  const [drillStack, setDrillStack] = React.useState<Standard[]>([]);
  const [standards, setStandards] = React.useState<Standard[]>([]);
  const [loading, setLoading] = React.useState(true);

  const currentParentId = drillStack.at(-1)?.id ?? null;

  React.useEffect(() => {
    let cancelled = false;

    async function loadFrameworks() {
      const response = await fetch("/api/standards/frameworks");
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as StandardsFramework[];
      if (cancelled) {
        return;
      }

      const nextFrameworks = data.filter((framework) => framework.kind !== "custom");
      setFrameworks(nextFrameworks);

      if (!frameworkId && nextFrameworks[0]?.id) {
        setFrameworkId(initialFrameworkId ?? nextFrameworks[0].id);
      }
    }

    void loadFrameworks();

    return () => {
      cancelled = true;
    };
  }, [frameworkId, initialFrameworkId]);

  React.useEffect(() => {
    if (!frameworkId) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function loadStandards() {
      const search = new URLSearchParams();
      search.set("frameworkId", frameworkId);

      if (query.trim()) {
        search.set("query", query.trim());
      } else {
        search.set("parentId", currentParentId ?? "root");
      }

      const response = await fetch(`/api/standards/nodes?${search.toString()}`);
      if (!response.ok) {
        if (!cancelled) {
          setStandards([]);
          setLoading(false);
        }
        return;
      }

      const data = (await response.json()) as Standard[];
      if (cancelled) {
        return;
      }

      setStandards(data);
      setLoading(false);
    }

    void loadStandards();

    return () => {
      cancelled = true;
    };
  }, [frameworkId, query, currentParentId]);

  const selectedSet = new Set(selectedIds);

  function handleToggle(standard: Standard) {
    onToggle?.(standard);
  }

  function handleDrill(standard: Standard) {
    setDrillStack((prev) => [...prev, standard]);
    setQuery("");
  }

  function handleBreadcrumb(index: number) {
    setDrillStack((prev) => prev.slice(0, index));
  }

  const hasChildrenCache = React.useMemo(() => {
    return new Map(
      standards.map((standard) => [standard.id, standard.hasChildren ?? false]),
    );
  }, [standards]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Framework selector */}
      {!initialFrameworkId && (
        <div className="flex flex-wrap gap-2">
          {frameworks.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFrameworkId(f.id);
                setDrillStack([]);
                setQuery("");
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                frameworkId === f.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-muted/60"
              )}
            >
              {f.abbreviation}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) setDrillStack([]);
          }}
          placeholder="Search standards…"
          className="w-full rounded-lg border border-input bg-card/70 pl-9 pr-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Breadcrumbs */}
      {drillStack.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => handleBreadcrumb(0)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Top
          </button>
          {drillStack.map((s, i) => (
            <React.Fragment key={s.id}>
              <ChevronRight className="size-3 text-muted-foreground" />
              <button
                type="button"
                onClick={() => handleBreadcrumb(i + 1)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {s.code}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Standards list */}
      <div className="flex flex-col gap-0.5 max-h-80 overflow-y-auto rounded-lg border border-border/70 bg-card/60 p-1">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading standards…</p>
        ) : null}
        {!loading && standards.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No standards found.
          </p>
        )}
        {!loading &&
          standards.map((s) => (
            <StandardRow
              key={s.id}
              standard={s}
              selected={selectedSet.has(s.id)}
              onToggle={handleToggle}
              hasChildren={hasChildrenCache.get(s.id) ?? false}
              onDrill={handleDrill}
            />
          ))}
      </div>

      {/* Selected count */}
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} standard{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
