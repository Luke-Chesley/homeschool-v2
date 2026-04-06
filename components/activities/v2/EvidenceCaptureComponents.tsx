"use client";

/**
 * Evidence capture components (offline support + teacher observation).
 * file_upload, image_capture, audio_capture, observation_record, teacher_checkoff,
 * label_map, hotspot_select
 */

import * as React from "react";
import { Upload, Camera, Mic, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentRendererProps } from "./types";
import type {
  FileUploadComponentSchema,
  ImageCaptureComponentSchema,
  AudioCaptureComponentSchema,
  ObservationRecordComponentSchema,
  TeacherCheckoffComponentSchema,
  LabelMapComponentSchema,
  HotspotSelectComponentSchema,
} from "@/lib/activities/components";
import type { z } from "zod";

type FileUploadSpec = z.infer<typeof FileUploadComponentSchema>;
type ImageCaptureSpec = z.infer<typeof ImageCaptureComponentSchema>;
type AudioCaptureSpec = z.infer<typeof AudioCaptureComponentSchema>;
type ObservationRecordSpec = z.infer<typeof ObservationRecordComponentSchema>;
type TeacherCheckoffSpec = z.infer<typeof TeacherCheckoffComponentSchema>;
type LabelMapSpec = z.infer<typeof LabelMapComponentSchema>;
type HotspotSelectSpec = z.infer<typeof HotspotSelectComponentSchema>;

// ---------------------------------------------------------------------------
// File upload (metadata capture — actual file upload is out of scope here)
// ---------------------------------------------------------------------------

export function FileUploadComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<FileUploadSpec>) {
  type FileValue = { fileNames: string[]; note: string };
  const current: FileValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as FileValue)
      : { fileNames: [], note: "" };

  function setNote(note: string) {
    onChange(spec.id, { ...current, note });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).map((f) => f.name);
    onChange(spec.id, { ...current, fileNames: [...current.fileNames, ...files] });
  }

  function removeFile(name: string) {
    onChange(spec.id, {
      ...current,
      fileNames: current.fileNames.filter((f) => f !== name),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>

      <label
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors",
          disabled
            ? "border-border/40 opacity-60"
            : "border-border hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        <Upload className="size-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {spec.accept ? `Accepted: ${spec.accept.join(", ")}` : "Click to attach files"}
        </span>
        <input
          type="file"
          multiple={(spec.maxFiles ?? 1) > 1}
          accept={spec.accept?.join(",")}
          disabled={disabled}
          className="sr-only"
          onChange={handleFileInput}
        />
      </label>

      {current.fileNames.length > 0 && (
        <div className="flex flex-col gap-1">
          {current.fileNames.map((name) => (
            <div
              key={name}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-sm"
            >
              <span className="flex-1 truncate">{name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeFile(name)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {spec.notePrompt && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">{spec.notePrompt}</label>
          <textarea
            value={current.note}
            onChange={(e) => setNote(e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder="Notes…"
            className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image capture
// ---------------------------------------------------------------------------

export function ImageCaptureComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<ImageCaptureSpec>) {
  type ImageValue = { fileNames: string[]; note?: string };
  const current: ImageValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as ImageValue)
      : { fileNames: [] };

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).map((f) => f.name);
    onChange(spec.id, { ...current, fileNames: [...current.fileNames, ...files] });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      {spec.instructions && (
        <p className="text-xs text-muted-foreground">{spec.instructions}</p>
      )}

      <label
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors",
          disabled
            ? "border-border/40 opacity-60"
            : "border-border hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        <Camera className="size-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Take or upload a photo</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple={(spec.maxImages ?? 1) > 1}
          disabled={disabled}
          className="sr-only"
          onChange={handleFile}
        />
      </label>

      {current.fileNames.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {current.fileNames.length} image(s) captured: {current.fileNames.join(", ")}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio capture (metadata only — UI prompt for recording)
// ---------------------------------------------------------------------------

export function AudioCaptureComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<AudioCaptureSpec>) {
  const [recording, setRecording] = React.useState(false);
  const captured = value === true || (typeof value === "object" && value !== null);

  function toggleRecording() {
    if (disabled) return;
    if (!recording) {
      setRecording(true);
    } else {
      setRecording(false);
      onChange(spec.id, { recorded: true, timestamp: new Date().toISOString() });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      {spec.maxDurationSeconds && (
        <p className="text-xs text-muted-foreground">
          Maximum recording length: {spec.maxDurationSeconds}s
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleRecording}
          disabled={disabled || captured}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
            recording
              ? "border-red-400 bg-red-50 text-red-700"
              : captured
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border bg-card/70 hover:bg-muted",
          )}
        >
          <Mic className="size-4" />
          {recording ? "Stop recording" : captured ? "Recorded" : "Start recording"}
        </button>
        {captured && !recording && (
          <button
            type="button"
            onClick={() => onChange(spec.id, null)}
            disabled={disabled}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Re-record
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Observation record (filled by teacher/parent)
// ---------------------------------------------------------------------------

export function ObservationRecordComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<ObservationRecordSpec>) {
  type ObsValue = Record<string, string | number | boolean>;
  const current: ObsValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as ObsValue)
      : {};

  function setField(fieldId: string, val: string | number | boolean) {
    onChange(spec.id, { ...current, [fieldId]: val });
  }

  const filledByLabel =
    spec.filledBy === "teacher" ? "Teacher" : spec.filledBy === "parent" ? "Parent" : "Learner";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{spec.prompt}</p>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          Filled by {filledByLabel}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {spec.fields.map((field) => (
          <div key={field.id} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{field.label}</label>
            {field.inputKind === "checkbox" ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setField(field.id, !current[field.id])}
                className={cn(
                  "flex items-center gap-2 w-fit rounded-lg border px-3 py-2 text-sm transition-colors",
                  current[field.id]
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border bg-card/70",
                )}
              >
                <CheckCircle2 className="size-4" />
                {current[field.id] ? "Yes" : "No"}
              </button>
            ) : field.inputKind === "rating" ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={disabled}
                    onClick={() => setField(field.id, n)}
                    className={cn(
                      "size-8 rounded-full border text-xs font-medium transition-colors",
                      current[field.id] === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card/70 hover:bg-muted",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={typeof current[field.id] === "string" ? (current[field.id] as string) : ""}
                onChange={(e) => setField(field.id, e.target.value)}
                disabled={disabled}
                rows={2}
                placeholder={`${field.label}…`}
                className="w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teacher checkoff
// ---------------------------------------------------------------------------

export function TeacherCheckoffComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<TeacherCheckoffSpec>) {
  type CheckoffValue = { checked: string[]; note: string; acknowledged: boolean };
  const current: CheckoffValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as CheckoffValue)
      : { checked: [], note: "", acknowledged: false };

  function toggle(id: string) {
    if (disabled) return;
    const next = current.checked.includes(id)
      ? current.checked.filter((c) => c !== id)
      : [...current.checked, id];
    onChange(spec.id, { ...current, checked: next });
  }

  function setNote(note: string) {
    onChange(spec.id, { ...current, note });
  }

  function setAcknowledged(acknowledged: boolean) {
    onChange(spec.id, { ...current, acknowledged });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <p className="text-sm font-semibold">{spec.prompt}</p>
      <div className="flex flex-col gap-2">
        {spec.items.map((item) => {
          const isChecked = current.checked.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(item.id)}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm bg-white transition-colors",
                isChecked ? "border-primary/40" : "border-border",
              )}
            >
              <CheckCircle2
                className={cn(
                  "size-4 mt-0.5 shrink-0",
                  isChecked ? "text-primary" : "text-border",
                )}
              />
              <span>
                <span className="font-medium">{item.label}</span>
                {item.description && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {spec.notePrompt && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">{spec.notePrompt}</label>
          <textarea
            value={current.note}
            onChange={(e) => setNote(e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder="Notes…"
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
      )}

      {spec.acknowledgmentLabel && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAcknowledged(!current.acknowledged)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            current.acknowledged
              ? "border-primary/40 bg-primary/5 text-primary"
              : "border-border bg-white hover:bg-muted/30",
          )}
        >
          <CheckCircle2 className="size-4" />
          {spec.acknowledgmentLabel}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Label map (click to reveal / label image hotspots)
// ---------------------------------------------------------------------------

export function LabelMapComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<LabelMapSpec>) {
  type LabelMapValue = Record<string, string>;
  const current: LabelMapValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as LabelMapValue)
      : {};

  function setLabelValue(labelId: string, text: string) {
    onChange(spec.id, { ...current, [labelId]: text });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      <div className="relative w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={spec.imageUrl}
          alt={spec.imageAlt}
          className="w-full rounded-lg border border-border"
        />
        {spec.labels.map((label) => (
          <div
            key={label.id}
            className="absolute"
            style={{ left: `${label.x}%`, top: `${label.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="size-3 rounded-full bg-primary border-2 border-white shadow" />
              <input
                type="text"
                value={current[label.id] ?? ""}
                onChange={(e) => setLabelValue(label.id, e.target.value)}
                disabled={disabled}
                placeholder="Label…"
                className="w-24 rounded border border-input bg-white/90 px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hotspot select
// ---------------------------------------------------------------------------

export function HotspotSelectComponent({
  spec,
  value,
  onChange,
  disabled,
}: ComponentRendererProps<HotspotSelectSpec>) {
  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];

  function toggle(id: string) {
    if (disabled) return;
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    onChange(spec.id, next);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-relaxed">{spec.prompt}</p>
      <div className="relative w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={spec.imageUrl}
          alt={spec.imageAlt}
          className="w-full rounded-lg border border-border"
        />
        {spec.hotspots.map((spot) => {
          const isSelected = selected.includes(spot.id);
          return (
            <button
              key={spot.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(spot.id)}
              title={spot.label}
              className={cn(
                "absolute rounded-full border-2 transition-colors",
                isSelected ? "bg-primary border-white" : "bg-white/70 border-primary hover:bg-primary/20",
              )}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                width: `${(spot.radius ?? 5) * 2}px`,
                height: `${(spot.radius ?? 5) * 2}px`,
                transform: "translate(-50%, -50%)",
              }}
              aria-label={spot.label}
            />
          );
        })}
      </div>
      {spec.hint && <p className="text-xs text-muted-foreground italic">{spec.hint}</p>}
    </div>
  );
}
