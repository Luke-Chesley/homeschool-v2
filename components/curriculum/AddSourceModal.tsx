"use client";

import * as React from "react";
import { BookOpen, Upload, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AiDraftConversation } from "@/components/curriculum/AiDraftConversation";
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
    label: "Start from a topic",
    description: "Set up a simple source around the subjects and goals you want to cover.",
    Icon: BookOpen,
  },
  {
    kind: "upload",
    label: "Upload document",
    description: "Bring a PDF or document into the source-add flow.",
    Icon: Upload,
  },
  {
    kind: "ai_draft",
    label: "Build from source",
    description: "Talk through what you already have and turn it into a usable source.",
    Icon: Sparkles,
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
          Add source
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Upload form
// ---------------------------------------------------------------------------

function UploadForm({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <Upload className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Document upload is not available in this surface yet. Use the source form for text you can
        paste today.
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

function AiDraftForm({
  activeLearner,
  onCreatedSourceId,
  onCancel,
}: {
  activeLearner: {
    displayName: string;
    firstName: string;
  };
  onCreatedSourceId: (sourceId: string) => void;
  onCancel: () => void;
}) {
  return (
    <AiDraftConversation
      activeLearner={activeLearner}
      onCreatedSourceId={onCreatedSourceId}
      onCancel={onCancel}
    />
  );
}

// ---------------------------------------------------------------------------
// Main modal content
// ---------------------------------------------------------------------------

export interface AddSourceModalContentProps {
  householdId: string;
  activeLearner: {
    displayName: string;
    firstName: string;
  };
  onCreatedSourceId: (sourceId: string) => void;
  onCreated: (
    data: {
      title: string;
      description: string;
      kind: CurriculumSourceKind;
      subjects: string[];
      gradeLevels: string[];
      householdId: string;
      academicYear?: string;
    }
  ) => void;
  onClose: () => void;
}

export function AddSourceModalContent({
  householdId,
  activeLearner,
  onCreatedSourceId,
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
    return (
      <AiDraftForm
        activeLearner={activeLearner}
        onCreatedSourceId={onCreatedSourceId}
        onCancel={() => setSelectedKind(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Choose how you&apos;d like to add a source.
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
