import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  FileText,
  Layers3,
  NotebookPen,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { cn } from "@/lib/utils";

import {
  DemoModal,
  FeatureTourTabs,
  type LandingFeature,
} from "./landing-interactive";

const whatItIsCards = [
  {
    title: "Today starts with the teachable queue",
    body: "Open the day around the lesson flow that matters now instead of a dashboard full of admin work.",
    icon: BookOpen,
  },
  {
    title: "Planning stays close enough to adjust",
    body: "Move work through the week when real life changes without losing the overall route or starting over.",
    icon: CalendarRange,
  },
  {
    title: "Curriculum becomes usable structure",
    body: "Turn source material into units, strands, skills, and teachable pieces that stay connected to the plan.",
    icon: Layers3,
  },
  {
    title: "Tracking follows the work that happened",
    body: "Keep notes, evidence, progress, and records tied to real lessons so recordkeeping does not become a second project.",
    icon: NotebookPen,
  },
  {
    title: "Assistant stays grounded in context",
    body: "Ask for the next move with the learner, the week, and the current work already nearby instead of starting from a blank chat.",
    icon: Bot,
  },
] as const;

const howItWorksSteps = [
  {
    step: "01",
    title: "Bring what you already have",
    body: "Start from a chapter, outline, weekly plan, photo, PDF, or topic. The goal is not to rebuild your homeschool from an empty database.",
    bullets: [
      "Use chapter text, copied outlines, weekly plans, photos of worksheets, PDFs, or a plain topic prompt.",
      "Turn existing source material into curriculum structure instead of retyping everything by hand.",
    ],
  },
  {
    step: "02",
    title: "Open a clear day",
    body: "Homeschool V2 turns that source material into today's queue, a readable lesson flow, and sessions that feel ready to teach.",
    bullets: [
      "See today's queue, the next lesson, and activity/session readiness in one calm surface.",
      "Keep the teaching sequence readable so you can move without tab-switching.",
    ],
  },
  {
    step: "03",
    title: "Keep the week and record nearby",
    body: "When the day shifts, adjust the week, capture what actually happened, and keep evidence, notes, and records attached to the work.",
    bullets: [
      "Make weekly adjustments without losing momentum or hiding the backlog.",
      "Capture notes, evidence, and records while the work is still close at hand.",
    ],
  },
] as const;

const featureTourItems: LandingFeature[] = [
  {
    id: "today",
    title: "Today",
    headline: "Start from the actual teaching day",
    description:
      "Today is the operational center of the product. It keeps the queue readable, the lesson flow close, and the next action obvious.",
    bullets: [
      "Start from the actual teaching day instead of a broad admin dashboard.",
      "Build a workable queue without bouncing between planning, curriculum, and records.",
      "Keep lesson flow readable for the adult who is about to teach.",
      "Reduce setup friction when the day is already in motion.",
    ],
    accent: "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_90%,white_10%)_0%,color-mix(in_srgb,var(--primary)_10%,var(--card)_90%)_100%)]",
    stats: ["Today's queue", "Lesson flow", "Ready sessions", "Next action"],
  },
  {
    id: "planning",
    title: "Planning",
    headline: "Shape the week without rebuilding it",
    description:
      "Planning keeps scheduled work, backlog, and changes visible so a rough day does not break the whole week.",
    bullets: [
      "Shift work when the day changes and keep the week coherent.",
      "See backlog and scheduled work in the same planning frame.",
      "Preserve momentum when life gets messy instead of starting over.",
      "Keep planning connected to what the family is actually teaching now.",
    ],
    accent: "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_86%,white_14%)_0%,color-mix(in_srgb,var(--secondary)_14%,var(--card)_86%)_100%)]",
    stats: ["This week", "Backlog in view", "Move without losing context", "Daily-first adjustments"],
  },
  {
    id: "curriculum",
    title: "Curriculum",
    headline: "Turn source material into teachable structure",
    description:
      "Curriculum keeps units, strands, skills, and progression connected to planning so structure remains usable instead of decorative.",
    bullets: [
      "Turn source material into teachable structure instead of an empty shell.",
      "See units, strands, skills, and progression in a form you can use.",
      "Keep curriculum connected to planning rather than isolated in a separate tool.",
      "Avoid rebuilding curriculum by hand just to begin the week.",
    ],
    accent: "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_88%,white_12%)_0%,color-mix(in_srgb,var(--accent)_16%,var(--card)_84%)_100%)]",
    stats: ["Units and strands", "Skills and progression", "Source-backed structure", "Connected to planning"],
  },
  {
    id: "tracking",
    title: "Tracking",
    headline: "Make records a byproduct of teaching",
    description:
      "Tracking keeps attendance, progress, portfolio evidence, and notes tied to the work that actually happened, not to an end-of-week reconstruction project.",
    bullets: [
      "Capture what actually happened while the day is still fresh.",
      "Keep attendance, progress, portfolio, and evidence attached to the work.",
      "Reduce duplicate entry between teaching and recordkeeping.",
      "Make reports feel grounded in the real week.",
    ],
    accent: "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_88%,white_12%)_0%,color-mix(in_srgb,var(--warning)_10%,var(--card)_90%)_100%)]",
    stats: ["Notes and evidence", "Progress nearby", "Record as you teach", "Less reconstruction later"],
  },
  {
    id: "assistant",
    title: "Assistant",
    headline: "Ask for the next move quietly",
    description:
      "Assistant is there for the next question, the next adjustment, or the next teaching move. It stays embedded in the workflow instead of turning the product into a noisy side tool.",
    bullets: [
      "Ask for the next move with learner and week context already attached.",
      "Generate guidance quietly inside the workflow instead of in a separate chat habit.",
      "Use it for clarity, adaptation, and next steps rather than generic output.",
      "Keep help grounded in the work already underway.",
    ],
    accent: "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_88%,white_12%)_0%,color-mix(in_srgb,var(--info)_10%,var(--card)_90%)_100%)]",
    stats: ["Next move guidance", "Learner-aware context", "Quiet help", "Attached to the week"],
  },
] as const;

const comparisonItems = [
  {
    title: "Most tools start with admin. This one starts with the day.",
    body: "The first question is not how to fill out a system. It is what you can teach next, with the materials you already have.",
  },
  {
    title: "Most planners separate curriculum, planning, and records. This keeps them close.",
    body: "The week, the underlying structure, and the record of what happened stay connected so you do not rebuild the same context three times.",
  },
  {
    title: "Most built-in help is loud and generic. This stays grounded in context.",
    body: "Guidance sits beside the learner, the week, and the current lesson instead of asking you to explain the whole situation every time.",
  },
  {
    title: "Most recordkeeping happens later. This captures it as the work happens.",
    body: "Notes, evidence, and progress stay attached to the real teaching flow so records come from the day itself.",
  },
] as const;

const intakeModes = [
  "Chapter",
  "PDF",
  "Photo",
  "Weekly plan",
  "Outline",
  "Topic",
] as const;

const credibilityItems = [
  "Built around the daily teaching workflow, not a generic planner shell.",
  "Keeps source intake, curriculum structure, Today, Planning, Tracking, and Assistant connected in one workspace.",
  "Designed so recordkeeping follows the work that actually happened.",
] as const;

const faqs = [
  {
    question: "What is Homeschool V2?",
    answer:
      "Homeschool V2 is a planning workspace that keeps today's queue, the week's adjustments, curriculum structure, tracking, and Assistant connected in one place.",
  },
  {
    question: "Who is it for?",
    answer:
      "It is built for homeschooling adults who need to turn real material into a teachable day without losing sight of the week or the record.",
  },
  {
    question: "Do I need to start from scratch?",
    answer:
      "No. The product is built to begin from material you already have rather than asking you to rebuild everything from an empty setup.",
  },
  {
    question: "Can I begin from a book, PDF, or photo?",
    answer:
      "Yes. The supported starting points on the homepage reflect the intended workflow: chapter text, PDFs, photos, outlines, weekly plans, and topic prompts.",
  },
  {
    question: "What does Assistant help with?",
    answer:
      "Assistant helps with the next move inside the workflow. It is meant to provide grounded guidance, not replace the rest of the product with a generic chat box.",
  },
  {
    question: "Does it replace my curriculum?",
    answer:
      "No. It helps turn the curriculum and source material you already use into workable structure, planning, and daily execution.",
  },
  {
    question: "How do planning and tracking connect?",
    answer:
      "Planning shapes what the week should look like. Tracking captures what actually happened, with notes and evidence tied back to the work.",
  },
  {
    question: "Is this for one learner or a whole household?",
    answer:
      "The workflow is designed to work from one learner upward. The page leads with one household and one learner because that is the simplest way to get started.",
  },
  {
    question: "What happens after I create an account?",
    answer:
      "The existing homepage redirect flow sends ready accounts to Today and accounts that still need setup into onboarding.",
  },
] as const;

const demoStoryboard = [
  "Start with source intake: paste a chapter, upload a PDF, or snap a photo.",
  "Turn that source into usable curriculum structure.",
  "Open Today as a clear teachable queue.",
  "Adjust the week in Planning when real life changes.",
  "Capture what happened in Tracking with notes and evidence.",
  "Use Assistant for the next move while the context is still attached.",
] as const;

export function LandingPage() {
  return (
    <div className="relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--secondary)_18%,transparent)_0,transparent_36%),radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--primary)_16%,transparent)_0,transparent_28%)]" />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-18 px-5 pb-16 pt-8 sm:px-6 lg:px-8 lg:gap-24 lg:pb-24 lg:pt-12">
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(23rem,0.98fr)] lg:items-center">
          <div className="space-y-7">
            <div className="space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Homeschool workspace
              </p>
              <h1 className="font-serif text-[clamp(3.1rem,6vw,6rem)] leading-[0.92] tracking-[-0.05em] text-foreground">
                Turn what you already have into a teachable homeschool day.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
                Start with a chapter, outline, photo, PDF, or topic. Build today first, keep the week flexible, and
                track what actually happened without rebuilding records later.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/auth/sign-up" className={buttonVariants({ size: "lg" })}>
                Create account
              </Link>
              <DemoModal
                title="From source material to the next teachable move"
                description="This walkthrough follows the actual product sequence from source intake to curriculum structure, Today, Planning, Tracking, and Assistant."
                bullets={[...demoStoryboard]}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard
                label="Start from what exists"
                value="6 ways in"
                hint="Begin from chapter, PDF, photo, weekly plan, outline, or topic."
              />
              <MetricCard
                label="Keep the week nearby"
                value="1 weekly view"
                hint="Shift the week without losing the next lesson or the backlog."
                tone="secondary"
              />
              <MetricCard
                label="Teach from Today"
                value="1 clear queue"
                hint="See the lesson flow and next action without tab-switching."
                tone="accent"
              />
              <MetricCard
                label="Record what happened"
                value="1 live record"
                hint="Keep notes, evidence, and progress tied to real work."
              />
            </div>
          </div>

          <HeroVisual />
        </section>

        <section id="demo" className="scroll-mt-28">
          <Card variant="glass" className="overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.82fr)]">
              <div className="border-b border-border/60 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-8">
                <Badge variant="secondary" className="w-fit">
                  Product walkthrough
                </Badge>
                <h2 className="mt-4 font-serif text-[clamp(2.2rem,4vw,3.6rem)] leading-[0.96] tracking-[-0.045em] text-foreground">
                  See the workflow before you sign in.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  The walkthrough is built around a real product narrative: source intake, curriculum structure, Today,
                  Planning, Tracking, and Assistant. It shows how the product moves from what you already have to what you can teach next.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <DemoModal
                    title="Homeschool V2 walkthrough"
                    description="Open the product story near the top of the page and see how the main surfaces fit together before creating an account."
                    bullets={[...demoStoryboard]}
                  />
                  <Link href="#how-it-works" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "gap-2")}>
                    See the steps
                    <ArrowRight className="size-4.5" />
                  </Link>
                </div>
              </div>

              <div className="bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_88%,white_12%)_0%,color-mix(in_srgb,var(--secondary)_10%,var(--card)_90%)_100%)] p-5 sm:p-6 lg:p-8">
                <div className="rounded-[1.8rem] border border-border/70 bg-background/72 p-4 shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        60-second demo
                      </p>
                      <p className="mt-1 text-sm text-foreground">Poster frame and click-to-open walkthrough</p>
                    </div>
                    <div className="rounded-full border border-border/70 bg-card/86 px-3 py-1 text-xs text-muted-foreground">
                      No autoplay
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {demoStoryboard.map((item, index) => (
                      <div key={item} className="flex items-start gap-3 rounded-[1.2rem] border border-border/70 bg-card/82 p-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/82 text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </div>
                        <p className="text-sm leading-6 text-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section id="product" className="scroll-mt-28 space-y-8">
          <div className="max-w-3xl space-y-4">
            <Badge variant="glass" className="w-fit">
              What the product is
            </Badge>
            <h2 className="font-serif text-[clamp(2.2rem,4vw,3.7rem)] leading-[0.97] tracking-[-0.045em] text-foreground">
              One workspace for the day, the week, the structure, and the record.
            </h2>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              Homeschool V2 is not a generic planner with a chat box attached. It is a daily-first homeschool workspace that
              keeps the actual teaching day, weekly adjustment, curriculum structure, tracking, and Assistant close enough to be useful together.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {whatItIsCards.map((card) => {
              const Icon = card.icon;

              return (
                <Card key={card.title} variant="default" className="h-full p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-2xl border border-border/70 bg-background/76 p-3 text-muted-foreground">
                      <Icon className="size-5" />
                    </div>
                    <CheckCircle2 className="size-4 text-secondary" />
                  </div>
                  <h3 className="mt-5 font-serif text-2xl tracking-[-0.03em] text-foreground">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.body}</p>
                </Card>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-28 space-y-8">
          <div className="max-w-3xl space-y-4">
            <Badge variant="glass" className="w-fit">
              How it works
            </Badge>
            <h2 className="font-serif text-[clamp(2.2rem,4vw,3.7rem)] leading-[0.97] tracking-[-0.045em] text-foreground">
              From what you already have to what you can teach next.
            </h2>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              The workflow starts with source material you already trust, opens a clearer day, and keeps adjustment and recordkeeping close enough to stay usable.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {howItWorksSteps.map((step, index) => (
              <Card key={step.title} variant="glass" className="overflow-hidden">
                <div className="border-b border-border/60 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className="bg-background/82">
                      Step {step.step}
                    </Badge>
                    <span className="text-sm text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 font-serif text-[2rem] leading-[0.98] tracking-[-0.04em] text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.body}</p>
                </div>
                <div className="space-y-3 p-5">
                  <StepVisual index={index} />
                  {step.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="rounded-[1.2rem] border border-border/70 bg-background/78 p-4 text-sm leading-6 text-foreground"
                    >
                      {bullet}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div className="max-w-3xl space-y-4">
            <Badge variant="glass" className="w-fit">
              Product surfaces
            </Badge>
            <h2 className="font-serif text-[clamp(2.2rem,4vw,3.7rem)] leading-[0.97] tracking-[-0.045em] text-foreground">
              See the main screens and why each one matters.
            </h2>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              The homepage should make the product concrete, so this section names the actual surfaces: Today, Planning, Curriculum, Tracking, and Assistant.
            </p>
          </div>

          <FeatureTourTabs features={featureTourItems} />
        </section>

        <section className="space-y-8">
          <div className="max-w-3xl space-y-4">
            <Badge variant="glass" className="w-fit">
              Why it is different
            </Badge>
            <h2 className="font-serif text-[clamp(2.2rem,4vw,3.7rem)] leading-[0.97] tracking-[-0.045em] text-foreground">
              A calmer product shape than normal homeschool tools.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {comparisonItems.map((item) => (
              <Card key={item.title} variant="default" className="h-full p-5">
                <p className="font-serif text-[1.7rem] leading-[1.02] tracking-[-0.03em] text-foreground">{item.title}</p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.84fr)] lg:items-start">
          <div className="space-y-4">
            <Badge variant="glass" className="w-fit">
              Supported starting points
            </Badge>
            <h2 className="font-serif text-[clamp(2.2rem,4vw,3.5rem)] leading-[0.97] tracking-[-0.045em] text-foreground">
              Start from what you already have.
            </h2>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              You do not need to rebuild everything from scratch. Homeschool V2 is designed to help families begin from existing material rather than from an empty database.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {intakeModes.map((mode) => (
                <div
                  key={mode}
                  className="rounded-full border border-border/70 bg-card/82 px-4 py-2 text-sm text-foreground shadow-[var(--shadow-soft)]"
                >
                  {mode}
                </div>
              ))}
            </div>
          </div>

          <Card variant="glass" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">What stays connected</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                <p className="text-sm font-medium text-foreground">Source intake to curriculum</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">A chapter or PDF is not dead input. It becomes usable structure.</p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                <p className="text-sm font-medium text-foreground">Curriculum to Today</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">The structure stays close enough to shape the teachable queue.</p>
              </div>
              <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                <p className="text-sm font-medium text-foreground">Today to Tracking</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">The record grows from the work that actually happened.</p>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.86fr)] lg:items-start">
          <div className="space-y-4">
            <Badge variant="glass" className="w-fit">
              Trust and credibility
            </Badge>
            <h2 className="font-serif text-[clamp(2.2rem,4vw,3.5rem)] leading-[0.97] tracking-[-0.045em] text-foreground">
              Honest proof, not made-up marketing stats.
            </h2>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              This homepage avoids fake logos, fake counts, and invented testimonials. The credibility comes from how the product is shaped and what it keeps connected.
            </p>
          </div>

          <div className="grid gap-3">
            {credibilityItems.map((item) => (
              <Card key={item} variant="default" className="p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-sm leading-7 text-foreground">{item}</p>
                </div>
              </Card>
            ))}
            <Card variant="glass" className="p-5">
              <p className="text-sm font-medium text-foreground">Structured to grow later</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                This section is ready to accept real testimonials, case studies, or design-partner proof later without changing the rest of the homepage architecture.
              </p>
            </Card>
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 space-y-8">
          <div className="max-w-3xl space-y-4">
            <Badge variant="glass" className="w-fit">
              FAQ
            </Badge>
            <h2 className="font-serif text-[clamp(2.2rem,4vw,3.7rem)] leading-[0.97] tracking-[-0.045em] text-foreground">
              Questions a careful visitor should be able to answer quickly.
            </h2>
          </div>

          <div className="grid gap-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-[1.5rem] border border-border/70 bg-card/82 px-5 py-4 shadow-[var(--shadow-soft)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
                  <span>{faq.question}</span>
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <Card variant="glass" className="overflow-hidden">
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-4">
                <Badge variant="secondary" className="w-fit">
                  Start with one household and one learner
                </Badge>
                <h2 className="font-serif text-[clamp(2.2rem,4vw,3.7rem)] leading-[0.96] tracking-[-0.045em] text-foreground">
                  See the day, the week, the curriculum, and the record in one calm workspace.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  The product is built to move from source material to a workable day without losing planning, structure, or records along the way.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/auth/sign-up" className={cn(buttonVariants({ size: "lg" }), "justify-center")}>
                  Create account
                </Link>
                <DemoModal
                  title="Walkthrough preview"
                  description="See the same connected product story again before you sign up: source material in, teachable day out, with the week and record still nearby."
                  bullets={[...demoStoryboard]}
                />
              </div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/60">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Homeschool V2</p>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              A calm workspace for turning source material into a teachable day, a flexible week, and a record that stays close to real work.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link href="#product" className="transition-colors hover:text-foreground">
              Product
            </Link>
            <Link href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </Link>
            <Link href="/auth/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="transition-colors hover:text-foreground">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroVisual() {
  return (
    <Card variant="glass" className="overflow-hidden">
      <div className="border-b border-border/60 bg-background/44 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Product view</p>
            <p className="mt-1 text-sm text-foreground">Today, Planning, Curriculum, Tracking, and Assistant</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(15rem,0.9fr)]">
          <div className="rounded-[1.8rem] border border-border/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_90%,white_10%)_0%,color-mix(in_srgb,var(--primary)_12%,var(--card)_88%)_100%)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Today</p>
                <p className="mt-1 text-sm text-foreground">Teach from a clear queue</p>
              </div>
              <BookOpen className="size-4.5 text-muted-foreground" />
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[1.2rem] border border-border/70 bg-background/82 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Morning reading</p>
                  <span className="rounded-full bg-secondary/16 px-2.5 py-1 text-[11px] text-secondary-foreground">Ready</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Chapter intake, discussion, narration, and next move.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-border/70 bg-background/82 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Planning</p>
                  <p className="mt-2 text-sm text-foreground">Shift Thursday science to Friday</p>
                </div>
                <div className="rounded-[1.2rem] border border-border/70 bg-background/82 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tracking</p>
                  <p className="mt-2 text-sm text-foreground">Attach notes and reading evidence</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <VisualMiniCard
              icon={Layers3}
              title="Curriculum"
              body="Units, strands, and skills stay connected to the plan."
            />
            <VisualMiniCard
              icon={Bot}
              title="Assistant"
              body="Ask for the next move without losing learner and week context."
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <VisualStrip icon={FileText} label="Source intake" value="Chapter, PDF, photo, outline, weekly plan, or topic" />
          <VisualStrip icon={ClipboardList} label="Teachable day" value="Queue, lesson flow, and activity readiness" />
          <VisualStrip icon={NotebookPen} label="Living record" value="Progress, evidence, notes, and what actually happened" />
        </div>
      </div>
    </Card>
  );
}

function StepVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {["Chapter", "Outline", "Weekly plan", "Photo", "PDF", "Topic"].map((item) => (
          <div
            key={item}
            className="rounded-[1.1rem] border border-border/70 bg-card/82 px-3 py-2.5 text-sm text-foreground"
          >
            {item}
          </div>
        ))}
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="space-y-3 rounded-[1.3rem] border border-border/70 bg-card/82 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Today's queue</p>
          <span className="rounded-full bg-secondary/16 px-2.5 py-1 text-[11px] text-secondary-foreground">Ready now</span>
        </div>
        <div className="rounded-[1rem] border border-border/70 bg-background/82 p-3 text-sm text-foreground">Opening reading</div>
        <div className="rounded-[1rem] border border-border/70 bg-background/82 p-3 text-sm text-foreground">Lesson flow with activity/session readiness</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-[1.2rem] border border-border/70 bg-card/82 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Weekly adjustment</p>
        <p className="mt-2 text-sm text-foreground">Move unfinished work without losing the rest of the week.</p>
      </div>
      <div className="rounded-[1.2rem] border border-border/70 bg-card/82 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tracking and evidence</p>
        <p className="mt-2 text-sm text-foreground">Keep notes, records, and evidence with the work itself.</p>
      </div>
    </div>
  );
}

function VisualMiniCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Layers3;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-card/82 p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-foreground">{title}</p>
        <Icon className="size-4.5 text-muted-foreground" />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function VisualStrip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-border/70 bg-card/82 p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <Icon className="size-4.5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}
