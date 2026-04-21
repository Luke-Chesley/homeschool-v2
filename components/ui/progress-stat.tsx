import { cn } from "@/lib/utils";

function clampProgress(progress: number) {
  return Math.max(0, Math.min(1, progress));
}

export function ProgressStat({
  label,
  value,
  caption,
  progress,
  className,
  tone = "primary",
}: {
  label: string;
  value: string;
  caption?: string;
  progress: number;
  className?: string;
  tone?: "primary" | "secondary" | "accent";
}) {
  const safeProgress = clampProgress(progress);
  const ringColor =
    tone === "secondary"
      ? "var(--secondary)"
      : tone === "accent"
        ? "var(--chart-3)"
        : "var(--primary)";

  return (
    <div
      className={cn(
        "grid gap-4 rounded-[calc(var(--radius)+0.2rem)] border border-border/70 bg-[var(--glass-panel)] p-4 shadow-[var(--shadow-soft)] sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="relative size-16 rounded-full"
        style={{
          background: `conic-gradient(${ringColor} ${safeProgress * 360}deg, color-mix(in srgb, var(--muted) 86%, transparent) 0deg)`,
        }}
      >
        <div className="absolute inset-[7px] rounded-full bg-background/92" />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
          {Math.round(safeProgress * 100)}%
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="font-serif text-[1.65rem] leading-none tracking-[-0.03em] text-foreground">
          {value}
        </p>
        {caption ? <p className="text-sm leading-6 text-muted-foreground">{caption}</p> : null}
      </div>
    </div>
  );
}
