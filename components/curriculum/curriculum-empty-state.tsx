import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CurriculumEmptyState() {
  return (
    <Card className="border-dashed border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-2xl">No curriculum source yet</CardTitle>
        <CardDescription>
          Start with anything you already have: a chapter, outline, weekly plan, photo, PDF, or
          topic.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/curriculum/new"
            className={cn(buttonVariants({ size: "sm" }), "gap-2")}
          >
            Add a source
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/curriculum/new?entry=conversation"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Start conversation
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Bring what you already have, then shape it into a clear day and a sane week.
        </p>
      </CardContent>
    </Card>
  );
}
