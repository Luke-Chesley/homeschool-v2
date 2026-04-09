"use client";

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
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span>operation: {preview.operation_name}</span>
        <span>skill: {preview.skill_name}</span>
        <span>version: {preview.skill_version}</span>
        <span>request: {preview.request_id}</span>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Request envelope</p>
        <pre className="mt-2 max-h-[14rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
          {JSON.stringify(preview.request_envelope, null, 2)}
        </pre>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">System</p>
        <pre className="mt-2 max-h-[12rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
          {preview.system_prompt}
        </pre>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">User</p>
        <pre className="mt-2 max-h-[20rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
          {preview.user_prompt}
        </pre>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Allowed tools</p>
        <pre className="mt-2 max-h-[8rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/35 p-3 text-xs leading-6 text-foreground">
          {preview.allowed_tools.length > 0 ? preview.allowed_tools.join(", ") : "None"}
        </pre>
      </div>
    </div>
  );
}
