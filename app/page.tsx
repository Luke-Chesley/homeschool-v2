import { ArrowRight, CalendarRange, CheckCircle2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { productPrinciples } from "@/lib/product-principles";

const highlights = [
  {
    title: "Keep",
    description:
      "Curriculum, schedules, daily planning, AI lesson drafts, worksheets, and progress tracking.",
    icon: CheckCircle2,
  },
  {
    title: "Drop",
    description:
      "Prototype auth shortcuts, checked-in DB state, split-app complexity, and blocking AI request flows.",
    icon: Sparkles,
  },
  {
    title: "Build Next",
    description:
      "Auth, learner profiles, curriculum import, schedule generation, and a single daily workspace.",
    icon: CalendarRange,
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-20 pt-8 sm:px-8 lg:px-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 px-6 py-12 shadow-[var(--shadow-hero)] backdrop-blur sm:px-10 lg:px-14 lg:py-16">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute right-0 top-0 size-56 translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 size-64 -translate-x-1/3 translate-y-1/3 rounded-full bg-secondary/18 blur-3xl" />

        <div className="relative grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-end">
          <div className="max-w-3xl">
            <Badge className="mb-5">Homeschool V2</Badge>
            <h1 className="max-w-4xl font-serif text-5xl leading-[0.92] tracking-[-0.04em] text-balance sm:text-6xl lg:text-8xl">
              Planning-first homeschool software with room to breathe.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              We&apos;re rebuilding the platform around calm daily workflows,
              coherent planning, and asynchronous AI help that supports parents
              without taking control away from them.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg">
                Start the daily workspace
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" size="lg">
                Review the product direction
              </Button>
            </div>
          </div>

          <Card className="relative border-primary/15 bg-background/88">
            <CardHeader>
              <CardDescription className="tracking-[0.16em] uppercase text-primary">
                Product posture
              </CardDescription>
              <CardTitle>Foundations before feature volume.</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm leading-7 text-muted-foreground">
                {productPrinciples.map((principle) => (
                  <li key={principle} className="flex gap-3">
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                    <span>{principle}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-3">
        {highlights.map(({ title, description, icon: Icon }) => (
          <Card key={title} className="h-full">
            <CardHeader>
              <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary/20 text-secondary-foreground">
                <Icon className="size-5" />
              </div>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-8 text-muted-foreground">
                {description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
