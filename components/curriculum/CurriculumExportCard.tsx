"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CurriculumExportCardProps {
  title: string;
  text: string;
  className?: string;
}

export function CurriculumExportCard({ title, text, className }: CurriculumExportCardProps) {
  const textAreaId = React.useId();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const textArea = document.getElementById(textAreaId) as HTMLTextAreaElement | null;
      if (!textArea) {
        return;
      }

      textArea.focus();
      textArea.select();
    }
  }

  return (
    <Card className={cn("border-border/80", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>Copy the current curriculum data as JSON.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <label htmlFor={textAreaId} className="text-sm font-medium text-foreground">
          JSON
        </label>
        <textarea
          id={textAreaId}
          readOnly
          value={text}
          className="min-h-72 w-full resize-y rounded-md border border-border/80 bg-background px-3 py-3 font-mono text-xs leading-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        />
      </CardContent>
    </Card>
  );
}
