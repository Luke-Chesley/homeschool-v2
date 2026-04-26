"use client";

import * as React from "react";
import { ArrowRight, ChevronDown, Lightbulb, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  curriculumConstraintOptions,
  curriculumDomainOptions,
  curriculumLearnerOptions,
  curriculumPacingOptions,
  curriculumShapeOptions,
  curriculumTimeHorizonOptions,
  type CurriculumIdeaOption,
} from "@/lib/curriculum/idea-builder-options";
import {
  getLocalTopicSuggestions,
  hasStrongLocalTopicSuggestions,
  normalizeTopicSuggestion,
} from "@/lib/curriculum/topic-suggestion-engine";
import { cn } from "@/lib/utils";

type BuilderField = "domain" | "learner" | "horizon" | "shape" | "pacing" | "constraint";

type BuilderState = Record<BuilderField, string> & {
  extraDetail: string;
};

type BuilderOptionPools = Record<BuilderField, CurriculumIdeaOption[]>;

type CurriculumIdeaBuilderProps = {
  className?: string;
  title?: string;
  description?: string;
  primaryActionLabel?: string;
  showConversationAction?: boolean;
  onUseIdea: (idea: string) => void;
  onStartConversation?: (idea: string) => void;
};

const initialState: BuilderState = {
  domain: "",
  learner: "",
  horizon: "",
  shape: "",
  pacing: "",
  constraint: "",
  extraDetail: "",
};

const baseOptionPools: BuilderOptionPools = {
  domain: curriculumDomainOptions,
  learner: curriculumLearnerOptions,
  horizon: curriculumTimeHorizonOptions,
  shape: curriculumShapeOptions,
  pacing: curriculumPacingOptions,
  constraint: curriculumConstraintOptions,
};

function shuffleOptions(options: CurriculumIdeaOption[]) {
  const nextOptions = [...options];

  for (let index = nextOptions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextOptions[index], nextOptions[swapIndex]] = [nextOptions[swapIndex], nextOptions[index]];
  }

  return nextOptions;
}

function shuffleOptionPools(): BuilderOptionPools {
  return {
    domain: shuffleOptions(curriculumDomainOptions),
    learner: shuffleOptions(curriculumLearnerOptions),
    horizon: shuffleOptions(curriculumTimeHorizonOptions),
    shape: shuffleOptions(curriculumShapeOptions),
    pacing: shuffleOptions(curriculumPacingOptions),
    constraint: shuffleOptions(curriculumConstraintOptions),
  };
}

function buildIdeaText(state: BuilderState) {
  const learnerPhrase = state.learner.trim().replace(/^for\s+/i, "");
  const topic = state.domain.trim();
  const horizon = state.horizon.trim();
  const shape = state.shape.trim();
  const pacing = state.pacing.trim().replace(/^with\s+/i, "");
  const requirement = state.constraint.trim();
  const extraDetail = state.extraDetail.trim().replace(/[.。]+$/u, "");

  if (!topic && !horizon && !shape && !pacing && !requirement && !extraDetail) {
    return "";
  }

  const openingParts = [
    "I want to teach",
    learnerPhrase || "my learner",
    topic || "a new topic",
    horizon,
  ].filter(Boolean);
  const clauses = [
    requirement
      ? requirement.startsWith("who ")
        ? `for a learner ${requirement}`
        : /^(a hard time|frustration|resistance|low prior)/i.test(requirement)
          ? `for a learner with ${requirement}`
        : `with ${requirement}`
      : "",
    pacing ? `using ${pacing}` : "",
    shape ? `as ${shape}` : "",
    extraDetail ? `including ${extraDetail}` : "",
  ].filter(Boolean);

  return `${openingParts.join(" ")}${clauses.length > 0 ? `, ${clauses.join(", ")}` : ""}.`;
}

function InlineBlank({
  label,
  value,
  placeholder,
  options,
  filterOptions = true,
  secondaryLabel,
  secondaryOptions = [],
  loadingSecondary = false,
  onChange,
  className,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: CurriculumIdeaOption[];
  filterOptions?: boolean;
  secondaryLabel?: string;
  secondaryOptions?: CurriculumIdeaOption[];
  loadingSecondary?: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const normalizedValue = value.trim().toLowerCase();
  const visibleOptions = (filterOptions
    ? options.filter((option) => {
      if (!normalizedValue) return true;
      return (
        option.label.toLowerCase().includes(normalizedValue) ||
        option.value.toLowerCase().includes(normalizedValue)
      );
    })
    : options
  ).slice(0, 16);
  const visibleSecondaryOptions = secondaryOptions.slice(0, 8);
  const allVisibleOptions = [...visibleSecondaryOptions, ...visibleOptions];
  const hasSuggestions = allVisibleOptions.length > 0;
  const canOpen = options.length > 0 || secondaryOptions.length > 0 || loadingSecondary;

  function chooseOption(option: CurriculumIdeaOption) {
    onChange(option.value);
    setOpen(false);
    setActiveIndex(-1);
  }

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    setActiveIndex(hasSuggestions ? 0 : -1);
  }, [hasSuggestions, value, visibleOptions.length, visibleSecondaryOptions.length]);

  React.useEffect(() => {
    if (canOpen && document.activeElement === inputRef.current) {
      setOpen(true);
    }
  }, [canOpen, loadingSecondary, secondaryOptions.length, visibleOptions.length]);

  return (
    <span ref={rootRef} className="relative inline-flex flex-col gap-1 align-middle">
      <span className="sr-only">{label}</span>
      <span
        className={cn(
          "group inline-flex h-11 min-w-0 items-center rounded-xl border border-border/75 bg-background/90 shadow-sm transition-[background-color,border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25",
          className,
        )}
      >
        <input
          ref={inputRef}
          aria-label={label}
          role={canOpen ? "combobox" : undefined}
          aria-expanded={canOpen ? open : undefined}
          value={value}
          onFocus={() => canOpen && setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            if (canOpen) {
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
              return;
            }
            if (event.key === "ArrowDown" && canOpen) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => {
                if (!hasSuggestions) return -1;
                return current < allVisibleOptions.length - 1 ? current + 1 : 0;
              });
              return;
            }
            if (event.key === "ArrowUp" && canOpen) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => {
                if (!hasSuggestions) return -1;
                return current > 0 ? current - 1 : allVisibleOptions.length - 1;
              });
              return;
            }
            if ((event.key === "Enter" || event.key === "Tab") && open && activeIndex >= 0) {
              const selected = allVisibleOptions[activeIndex];
              if (selected) {
                if (event.key === "Enter") {
                  event.preventDefault();
                }
                chooseOption(selected);
              }
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="h-full min-w-0 flex-1 rounded-xl bg-transparent px-3 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/38"
        />
        {canOpen ? (
          <button
            type="button"
            aria-label={`Show ${label} suggestions`}
            onClick={() => {
              setOpen((current) => !current);
              inputRef.current?.focus();
            }}
            className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ChevronDown
              className={cn("size-4 transition-transform", open && "rotate-180")}
            />
          </button>
        ) : null}
      </span>

      {open && canOpen ? (
        <span className="absolute left-0 top-full z-50 mt-2 grid max-h-80 min-w-full gap-1 overflow-y-auto rounded-2xl border border-border/80 bg-popover/95 p-1.5 text-sm shadow-[var(--shadow-active)] backdrop-blur">
          {hasSuggestions ? (
            <>
              {visibleSecondaryOptions.length > 0 ? (
                <span className="px-3 pt-2 text-[0.68rem] font-semibold uppercase tracking-wide text-primary/85 dark:text-primary/90">
                  {secondaryLabel ?? "More ideas"}
                </span>
              ) : null}
              {visibleSecondaryOptions.map((option, index) => {
                const absoluteIndex = index;
                return (
                  <button
                    key={`secondary-${option.value}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(absoluteIndex)}
                    onClick={() => chooseOption(option)}
                    className={cn(
                      "relative flex w-full items-center overflow-hidden rounded-xl border border-primary/35 bg-primary/12 px-3 py-2 text-left font-semibold leading-snug text-foreground shadow-sm transition-colors before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary/70 hover:border-primary/50 hover:bg-primary/18 focus-visible:border-primary/60 focus-visible:bg-primary/18 focus-visible:outline-none dark:border-primary/35 dark:bg-primary/18 dark:text-foreground dark:before:bg-primary/80 dark:hover:bg-primary/24 dark:focus-visible:bg-primary/24",
                      option.value === value && "border-primary/70 bg-primary/20 text-foreground dark:border-primary/65 dark:bg-primary/26",
                      activeIndex === absoluteIndex && "border-primary/70 bg-primary/20 dark:border-primary/65 dark:bg-primary/26",
                    )}
                  >
                    <span className="ml-1">{option.label}</span>
                  </button>
                );
              })}
              {visibleSecondaryOptions.length > 0 && visibleOptions.length > 0 ? (
                <span className="px-3 pt-2 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground/75">
                  Suggestions
                </span>
              ) : null}
              {visibleOptions.map((option, index) => (
                <button
                  key={`primary-${option.value}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(visibleSecondaryOptions.length + index)}
                  onClick={() => chooseOption(option)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left font-medium leading-snug text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    option.value === value && "bg-primary/10 text-primary",
                    activeIndex === visibleSecondaryOptions.length + index && "bg-muted",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </>
          ) : (
            <span className="px-3 py-2 text-muted-foreground">Type your own wording</span>
          )}
          {loadingSecondary ? (
            <span className="inline-flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Looking for more topic ideas
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

export function CurriculumIdeaBuilder({
  className,
  title = "Build from an idea",
  description = "Fill in the blanks by typing your own words or choosing a suggestion.",
  primaryActionLabel = "Use this idea",
  showConversationAction = false,
  onUseIdea,
  onStartConversation,
}: CurriculumIdeaBuilderProps) {
  const [state, setState] = React.useState<BuilderState>(initialState);
  const [optionPools, setOptionPools] = React.useState<BuilderOptionPools>(baseOptionPools);
  const [aiTopicOptions, setAiTopicOptions] = React.useState<CurriculumIdeaOption[]>([]);
  const [loadingAiTopics, setLoadingAiTopics] = React.useState(false);
  const aiTopicCacheRef = React.useRef<Map<string, CurriculumIdeaOption[]>>(new Map());

  React.useEffect(() => {
    setOptionPools(shuffleOptionPools());
  }, []);

  const generatedText = React.useMemo(() => buildIdeaText(state), [state]);
  const usableText = generatedText.trim();
  const localTopicSuggestions = React.useMemo(
    () => getLocalTopicSuggestions(state.domain, optionPools.domain, 14),
    [optionPools.domain, state.domain],
  );
  const topicOptions = React.useMemo(
    () => localTopicSuggestions.map(({ value, label }) => ({ value, label })),
    [localTopicSuggestions],
  );

  React.useEffect(() => {
    const query = normalizeTopicSuggestion(state.domain);
    if (query.length < 3 || hasStrongLocalTopicSuggestions(query, localTopicSuggestions)) {
      setAiTopicOptions([]);
      setLoadingAiTopics(false);
      return;
    }

    const cacheKey = [
      query.toLowerCase(),
      state.learner.trim().toLowerCase(),
      state.horizon.trim().toLowerCase(),
    ].join("|");
    const cached = aiTopicCacheRef.current.get(cacheKey);
    if (cached) {
      setAiTopicOptions(cached);
      setLoadingAiTopics(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoadingAiTopics(true);
      fetch("/api/curriculum/topic-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          learner: state.learner.trim() || null,
          timeframe: state.horizon.trim() || null,
          localSuggestions: localTopicSuggestions.slice(0, 8).map((suggestion) => suggestion.value),
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            return [];
          }
          const payload = (await response.json().catch(() => null)) as {
            suggestions?: unknown;
          } | null;
          if (!Array.isArray(payload?.suggestions)) {
            return [];
          }
          return payload.suggestions
            .map((suggestion) => normalizeTopicSuggestion(String(suggestion)))
            .filter(Boolean)
            .map((suggestion) => ({ value: suggestion, label: suggestion }));
        })
        .then((suggestions) => {
          aiTopicCacheRef.current.set(cacheKey, suggestions);
          setAiTopicOptions(suggestions);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setAiTopicOptions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoadingAiTopics(false);
          }
        });
    }, 2000);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
      setLoadingAiTopics(false);
    };
  }, [localTopicSuggestions, state.domain, state.horizon, state.learner]);

  function setField(field: BuilderField, value: string) {
    setState((current) => ({ ...current, [field]: value }));
  }

  function useSampleIdea() {
    setState({
      domain: "astronomy",
      learner: "a 6th grader",
      horizon: "this week",
      shape: "a project-based sequence",
      pacing: "short frequent sessions",
      constraint: "a hard time focusing",
      extraDetail: "moon observation, a small sky journal, and no long worksheets",
    });
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/78 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Idea builder
            </div>
            <div className="space-y-1">
              <h2 className="font-serif text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={useSampleIdea}>
            <Lightbulb className="size-4" />
            Try example
          </Button>
        </div>

        <div className="rounded-[1.35rem] border border-border/70 bg-muted/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-base leading-[3.25rem] text-foreground sm:text-lg">
            <span>I want to teach</span>
            <InlineBlank
              label="Learner"
              value={state.learner}
              placeholder="learner type"
              options={optionPools.learner}
              onChange={(value) => setField("learner", value)}
              className="w-44 sm:w-52"
            />
            <InlineBlank
              label="Topic"
              value={state.domain}
              placeholder="topic"
              options={topicOptions}
              filterOptions={false}
              secondaryLabel="More ideas"
              secondaryOptions={aiTopicOptions}
              loadingSecondary={loadingAiTopics}
              onChange={(value) => setField("domain", value)}
              className="w-44 sm:w-52"
            />
            <InlineBlank
              label="Timeframe"
              value={state.horizon}
              placeholder="timeframe"
              options={optionPools.horizon}
              onChange={(value) => setField("horizon", value)}
              className="w-40 sm:w-48"
            />
            <span>with</span>
            <InlineBlank
              label="Other requirements"
              value={state.constraint}
              placeholder="other requirements"
              options={optionPools.constraint}
              onChange={(value) => setField("constraint", value)}
              className="w-64 sm:w-72"
            />
            <span>using</span>
            <InlineBlank
              label="Pacing"
              value={state.pacing}
              placeholder="pacing"
              options={optionPools.pacing}
              onChange={(value) => setField("pacing", value)}
              className="w-56 sm:w-64"
            />
            <span>as</span>
            <InlineBlank
              label="Curriculum shape"
              value={state.shape}
              placeholder="curriculum shape"
              options={optionPools.shape}
              onChange={(value) => setField("shape", value)}
              className="w-56 sm:w-64"
            />
            <span>plus</span>
            <InlineBlank
              label="Extra detail"
              value={state.extraDetail}
              placeholder="anything else"
              options={[]}
              onChange={(value) =>
                setState((current) => ({ ...current, extraDetail: value }))
              }
              className="w-64 sm:w-80"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {showConversationAction ? (
            <Button
              type="button"
              variant="outline"
              disabled={!usableText}
              onClick={() => onStartConversation?.(generatedText)}
            >
              Start conversation with this
              <ArrowRight className="size-4" />
            </Button>
          ) : null}
          <Button type="button" disabled={!usableText} onClick={() => onUseIdea(generatedText)}>
            {primaryActionLabel}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
