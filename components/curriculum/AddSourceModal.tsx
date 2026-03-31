"use client";

import * as React from "react";
import { BookOpen, FileJson2, Upload, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CurriculumSourceKind } from "@/lib/curriculum/types";

// ---------------------------------------------------------------------------
// Entry point selector
// ---------------------------------------------------------------------------

const entryPoints: {
  kind: CurriculumSourceKind;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    kind: "manual",
    label: "Manual entry",
    description: "Type in your curriculum structure by hand.",
    Icon: BookOpen,
  },
  {
    kind: "upload",
    label: "Upload document",
    description: "Import a PDF or document for AI-assisted parsing.",
    Icon: Upload,
  },
  {
    kind: "ai_draft",
    label: "AI draft",
    description: "Describe your course and let the AI generate a skeleton.",
    Icon: Sparkles,
  },
  {
    kind: "external",
    label: "Load curriculum.json",
    description: "Import the local curriculum.json file from the project root.",
    Icon: FileJson2,
  },
];

// ---------------------------------------------------------------------------
// Manual entry form
// ---------------------------------------------------------------------------

function ManualEntryForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: { title: string; description: string; subjects: string[]; gradeLevels: string[] }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [subjects, setSubjects] = React.useState("");
  const [gradeLevels, setGradeLevels] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      subjects: subjects
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      gradeLevels: gradeLevels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="source-title">
          Title <span className="text-destructive">*</span>
        </label>
        <input
          id="source-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Singapore Math 4A"
          required
          className="rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="source-description">
          Description
        </label>
        <textarea
          id="source-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Brief description of the curriculum…"
          className="rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="source-subjects">
            Subjects
          </label>
          <input
            id="source-subjects"
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
            placeholder="math, science"
            className="rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="source-grades">
            Grade levels
          </label>
          <input
            id="source-grades"
            value={gradeLevels}
            onChange={(e) => setGradeLevels(e.target.value)}
            placeholder="4, 5"
            className="rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!title.trim()}>
          Create curriculum
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Upload form (stub — integration point for storage and ingestion)
// ---------------------------------------------------------------------------

function UploadForm({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <Upload className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Document upload intake is connected to the storage and ingestion pipeline.
        <br />
        <span className="text-xs">
          Integration point: wire to Supabase Storage + Inngest ingestion job.
        </span>
      </p>
      <Button variant="outline" size="sm" onClick={onCancel}>
        Back
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI draft form (stub — integration point for plan 08)
// ---------------------------------------------------------------------------

function AiDraftForm({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <Sparkles className="size-10 text-primary/60" />
      <p className="text-sm text-muted-foreground">
        AI curriculum drafting connects to the AI task registry.
        <br />
        <span className="text-xs">
          Integration point: dispatch to plan 08 lesson-drafting task.
        </span>
      </p>
      <Button variant="outline" size="sm" onClick={onCancel}>
        Back
      </Button>
    </div>
  );
}

function LocalJsonImportForm({
  householdId,
  onSubmit,
  onCancel,
}: {
  householdId: string;
  onSubmit: (data: { householdId: string; importPreset: "local_curriculum_json" }) => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
        <p className="text-sm font-medium">Import local curriculum file</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This loads <code>curriculum.json</code> from the project root and creates a curriculum
          source from its contents.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            onSubmit({
              householdId,
              importPreset: "local_curriculum_json",
            })
          }
        >
          Load curriculum.json
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal content
// ---------------------------------------------------------------------------

export interface AddSourceModalContentProps {
  householdId: string;
  onCreated: (
    data:
      | {
          title: string;
          description: string;
          kind: CurriculumSourceKind;
          subjects: string[];
          gradeLevels: string[];
          householdId: string;
        }
      | {
          householdId: string;
          importPreset: "local_curriculum_json";
        }
  ) => void;
  onClose: () => void;
}

export function AddSourceModalContent({
  householdId,
  onCreated,
  onClose,
}: AddSourceModalContentProps) {
  const [selectedKind, setSelectedKind] = React.useState<CurriculumSourceKind | null>(null);

  if (selectedKind === "manual") {
    return (
      <ManualEntryForm
        onCancel={() => setSelectedKind(null)}
        onSubmit={(data) =>
          onCreated({ ...data, kind: "manual", householdId })
        }
      />
    );
  }

  if (selectedKind === "upload") {
    return <UploadForm onCancel={() => setSelectedKind(null)} />;
  }

  if (selectedKind === "ai_draft") {
    return <AiDraftForm onCancel={() => setSelectedKind(null)} />;
  }

  if (selectedKind === "external") {
    return (
      <LocalJsonImportForm
        householdId={householdId}
        onCancel={() => setSelectedKind(null)}
        onSubmit={onCreated}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Choose how you&apos;d like to add curriculum content.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {entryPoints.map(({ kind, label, description, Icon }) => (
          <Card
            key={kind}
            className={cn(
              "flex cursor-pointer flex-col gap-2 p-4 transition-shadow hover:shadow-md"
            )}
            onClick={() => setSelectedKind(kind)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setSelectedKind(kind);
            }}
          >
            <Icon className="size-6 text-primary/70" />
            <span className="font-medium text-sm">{label}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
