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
    description: "Run the next lesson, adjust the queue, and keep the day teachable.",
    icon: House,
  },
  {
    label: "Planning",
    href: "/planning",
    matchPrefix: "/planning",
    description: "Shape the week, move overflow, and keep days realistic.",
    icon: CalendarDays,
  },
  {
    label: "Curriculum",
    href: "/curriculum",
    matchPrefix: "/curriculum",
    description: "Review the live source, structure, and refinement work.",
    icon: BookOpen,
  },
  {
    label: "Tracking",
    href: "/tracking",
    matchPrefix: "/tracking",
    description: "See progress, attendance, portfolio, and reporting status.",
    icon: ChartColumnIncreasing,
  },
  {
    label: "Assistant",
    href: "/assistant",
    matchPrefix: "/assistant",
    description: "Ask for the next move with current day and week context attached.",
    icon: Bot,
  },
];
