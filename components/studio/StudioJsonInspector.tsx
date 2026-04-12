import { StudioSection } from "@/components/studio/StudioSection";

export function StudioJsonInspector({
  title,
  value,
  defaultOpen = false,
}: {
  title: string;
  value: unknown;
  defaultOpen?: boolean;
}) {
  return (
    <StudioSection title={title}>
      <details className="rounded-lg border border-border/70 bg-muted/20" open={defaultOpen}>
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground">
          {defaultOpen ? "Hide payload" : "Show payload"}
        </summary>
        <pre className="max-h-[18rem] overflow-auto whitespace-pre-wrap border-t border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    </StudioSection>
  );
}
