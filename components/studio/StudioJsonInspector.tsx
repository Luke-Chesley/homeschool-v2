import { StudioSection } from "@/components/studio/StudioSection";

export function StudioJsonInspector({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <StudioSection title={title}>
      <pre className="max-h-[18rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </StudioSection>
  );
}
