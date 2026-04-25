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
  icon: LucideIcon;
  disabled?: boolean;
};

export const parentPrimaryNav: ParentNavItem[] = [
  {
    label: "Today",
    href: "/today",
    matchPrefix: "/today",
    icon: House,
  },
  {
    label: "Planning",
    href: "/planning",
    matchPrefix: "/planning",
    icon: CalendarDays,
  },
  {
    label: "Curriculum",
    href: "/curriculum",
    matchPrefix: "/curriculum",
    icon: BookOpen,
  },
  {
    label: "Tracking",
    href: "/tracking",
    matchPrefix: "/tracking",
    icon: ChartColumnIncreasing,
  },
  {
    label: "Assistant",
    href: "/assistant",
    matchPrefix: "/assistant",
    icon: Bot,
  },
];
