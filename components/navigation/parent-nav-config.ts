import {
  BookOpen,
  Bot,
  CalendarDays,
  ChartColumnIncreasing,
  House,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ParentNavItem = {
  label: string;
  href: string;
  matchPrefix: string;
  description: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export const parentPrimaryNav: ParentNavItem[] = [
  {
    label: "Today",
    href: "/today",
    matchPrefix: "/today",
    description: "Run the day and keep lesson execution coherent.",
    icon: House,
  },
  {
    label: "Curriculum",
    href: "/curriculum",
    matchPrefix: "/curriculum",
    description: "Sources, units, standards, and curriculum structure.",
    icon: BookOpen,
  },
  {
    label: "Planning",
    href: "/planning",
    matchPrefix: "/planning",
    description: "Weekly pacing, carryover, and daily sequencing.",
    icon: CalendarDays,
  },
  {
    label: "Tracking",
    href: "/tracking",
    matchPrefix: "/tracking",
    description: "Progress, standards coverage, and reporting.",
    icon: ChartColumnIncreasing,
    disabled: true,
  },
  {
    label: "Copilot",
    href: "/copilot",
    matchPrefix: "/copilot",
    description: "Context-aware AI assistance across the workspace.",
    icon: Bot,
    disabled: true,
  },
];
