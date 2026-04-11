"use client";

import { StudioJsonInspector } from "@/components/studio/StudioJsonInspector";
import { StudioSection } from "@/components/studio/StudioSection";
import { StudioTraceMeta } from "@/components/studio/StudioTraceMeta";

interface LearningCorePromptPreviewCardProps {
  preview: {
    operation_name: string;
    skill_name: string;
    skill_version: string;
    request_id: string;
    allowed_tools: string[];
    system_prompt: string;
    user_prompt: string;
    request_envelope: unknown;
  };
}

export function LearningCorePromptPreviewCard({ preview }: LearningCorePromptPreviewCardProps) {
  return (
    <div className="grid gap-5">
      <StudioTraceMeta
        items={[
          { label: "operation", value: preview.operation_name },
          { label: "skill", value: preview.skill_name },
          { label: "version", value: preview.skill_version },
          { label: "request", value: preview.request_id },
        ]}
      />

      <StudioJsonInspector title="Request envelope" value={preview.request_envelope} />

      <StudioSection title="System prompt">
        <pre className="max-h-[14rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
          {preview.system_prompt}
        </pre>
      </StudioSection>

      <StudioSection title="User prompt">
        <pre className="max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
          {preview.user_prompt}
        </pre>
      </StudioSection>

      <StudioSection title="Allowed tools">
        <div className="rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
          {preview.allowed_tools.length > 0 ? preview.allowed_tools.join(", ") : "None"}
        </div>
      </StudioSection>
    </div>
  );
}
