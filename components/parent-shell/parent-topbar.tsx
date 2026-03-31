"use client";

import { Menu, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parentPrimaryNav } from "@/components/navigation/parent-nav-config";

type ParentTopbarProps = {
  activeLearnerName: string;
  onOpenMenu: () => void;
};

export function ParentTopbar({ activeLearnerName, onOpenMenu }: ParentTopbarProps) {
  return (
    <Card className="border-border/70 bg-card/82 px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden rounded-full sm:inline-flex">
              Riverside homeschool
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {activeLearnerName}
            </Badge>
            <Badge className="rounded-full">Spring term</Badge>
          </div>
          <h1 className="mt-3 font-serif text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">
            Parent workspace shell with room for planning, execution, and AI assist.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Shared navigation now anchors the current parent routes and reserves stable slots for
            tracking and copilot when those screens land.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={onOpenMenu}
          >
            <Menu className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" className="hidden sm:inline-flex">
            <Sparkles className="size-4" />
            {parentPrimaryNav.length} workspace sections
          </Button>
        </div>
      </div>
    </Card>
  );
}
