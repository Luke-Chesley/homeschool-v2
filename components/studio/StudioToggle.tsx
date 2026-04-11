"use client";

import { Aperture } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStudio } from "@/components/studio/studio-provider";

export function StudioToggle() {
  const { isAvailable, isEnabled, toggleEnabled } = useStudio();

  if (!isAvailable) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isEnabled ? "secondary" : "ghost"}
      size="sm"
      onClick={toggleEnabled}
      aria-pressed={isEnabled}
      className="text-xs"
    >
      <Aperture className="size-3.5" />
      Studio
    </Button>
  );
}
