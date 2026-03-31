import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { BookOpen, Upload, Sparkles, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CurriculumSource, CurriculumSourceKind } from "@/lib/curriculum/types";

// ---------------------------------------------------------------------------
// Kind badge
// ---------------------------------------------------------------------------

const kindConfig: Record<
  CurriculumSourceKind,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  manual: { label: "Manual", Icon: BookOpen },
  upload: { label: "Upload", Icon: Upload },
  ai_draft: { label: "AI Draft", Icon: Sparkles },
  external: { label: "External", Icon: Globe },
};

function KindBadge({ kind }: { kind: CurriculumSourceKind }) {
  const { label, Icon } = kindConfig[kind];
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Indexing status badge
// ---------------------------------------------------------------------------

const indexingLabels: Record<CurriculumSource["indexingStatus"], string> = {
  pending: "Indexing…",
  indexed: "Indexed",
  failed: "Index failed",
  not_applicable: "",
};

const indexingColors: Record<CurriculumSource["indexingStatus"], string> = {
  pending: "text-amber-600",
  indexed: "text-emerald-600",
  failed: "text-destructive",
  not_applicable: "",
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

const cardVariants = cva("transition-shadow hover:shadow-md", {
  variants: {
    selected: {
      true: "ring-2 ring-primary",
      false: "",
    },
  },
  defaultVariants: { selected: false },
});

export interface CurriculumSourceCardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {
  source: CurriculumSource;
}

export function CurriculumSourceCard({
  source,
  selected,
  className,
  ...props
}: CurriculumSourceCardProps) {
  const indexingLabel = indexingLabels[source.indexingStatus];
  const indexingColor = indexingColors[source.indexingStatus];

  return (
    <Card
      className={cn(cardVariants({ selected }), className)}
      {...props}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-snug">{source.title}</CardTitle>
          <KindBadge kind={source.kind} />
        </div>
        {source.description && (
          <CardDescription>{source.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-0">
        <Badge variant="outline" className="text-xs capitalize">
          {source.status.replace("_", " ")}
        </Badge>
        <Badge variant="outline" className="text-xs">
          v{source.importVersion}
        </Badge>
        {source.academicYear && (
          <span className="text-xs text-muted-foreground">{source.academicYear}</span>
        )}
        {source.subjects.map((s) => (
          <Badge key={s} variant="outline" className="text-xs capitalize">
            {s}
          </Badge>
        ))}
        {source.gradeLevels.map((g) => (
          <Badge key={g} variant="outline" className="text-xs">
            Grade {g}
          </Badge>
        ))}
        {indexingLabel && (
          <span className={cn("ml-auto text-xs", indexingColor)}>{indexingLabel}</span>
        )}
      </CardContent>
    </Card>
  );
}
