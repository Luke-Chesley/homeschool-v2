import "@/lib/server-only";

import { z } from "zod";

import type { AppAuthState, AuthenticatedAppSession } from "@/lib/app-session/server";
import { buildPathWithNext } from "@/lib/auth/next";
import { getSession } from "@/lib/activities/session-service";
import { getHomeschoolOnboardingStatus } from "@/lib/homeschool/onboarding/service";
import { getLearnerById } from "@/lib/users/service";

const INTERNAL_BASE = "https://homeschool-v2.local";

export const MOBILE_SHELL_TARGETS = [
  "today",
  "learner",
  "users",
  "account",
  "onboarding",
  "activity",
] as const;

export type MobileShellTarget = (typeof MOBILE_SHELL_TARGETS)[number];

export type MobileShellIntent = {
  target: MobileShellTarget | null;
  learnerId: string | null;
  sessionId: string | null;
};

export type MobileShellResolution = {
  authStatus: AppAuthState["status"];
  requestedTarget: MobileShellTarget | null;
  resolvedTarget: MobileShellTarget | "login" | "setup";
  redirectPath: string;
  organizationId: string | null;
  learnerId: string | null;
  onboardingComplete: boolean | null;
};

const MobileShellIntentSchema = z.object({
  target: z.enum(MOBILE_SHELL_TARGETS).optional(),
  learnerId: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1).optional(),
});

function buildShellPath(intent: MobileShellIntent) {
  const url = new URL("/open", INTERNAL_BASE);

  if (intent.target) {
    url.searchParams.set("target", intent.target);
  }

  if (intent.learnerId) {
    url.searchParams.set("learnerId", intent.learnerId);
  }

  if (intent.sessionId) {
    url.searchParams.set("sessionId", intent.sessionId);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

async function resolveSelectableLearner(
  session: AuthenticatedAppSession,
  learnerId: string | null,
) {
  if (!learnerId) {
    return session.activeLearner;
  }

  const learner = await getLearnerById(learnerId, {
    organizationId: session.organization.id,
  });

  if (!learner || learner.status === "archived") {
    return session.activeLearner;
  }

  return learner;
}

async function resolveActivityLaunch(session: AuthenticatedAppSession, intent: MobileShellIntent) {
  if (!intent.sessionId) {
    const activeLearner = await resolveSelectableLearner(session, intent.learnerId);
    return {
      target: (activeLearner ? "learner" : "users") as MobileShellTarget,
      path: activeLearner ? "/learner" : "/users",
      learnerId: activeLearner?.id ?? null,
    };
  }

  const activitySession = await getSession(intent.sessionId);

  if (!activitySession) {
    const activeLearner = await resolveSelectableLearner(session, intent.learnerId);
    return {
      target: (activeLearner ? "learner" : "users") as MobileShellTarget,
      path: activeLearner ? "/learner" : "/users",
      learnerId: activeLearner?.id ?? null,
    };
  }

  const learner = await getLearnerById(activitySession.learnerId, {
    organizationId: session.organization.id,
  });

  if (!learner || learner.status === "archived") {
    const activeLearner = await resolveSelectableLearner(session, intent.learnerId);
    return {
      target: (activeLearner ? "learner" : "users") as MobileShellTarget,
      path: activeLearner ? "/learner" : "/users",
      learnerId: activeLearner?.id ?? null,
    };
  }

  return {
    target: "activity" as const,
    path: `/activity/${encodeURIComponent(intent.sessionId)}`,
    learnerId: learner.id,
  };
}

function defaultReadyPath(session: AuthenticatedAppSession, onboardingComplete: boolean) {
  if (!onboardingComplete) {
    return {
      target: "onboarding" as const,
      path: "/onboarding",
      learnerId: session.activeLearner?.id ?? null,
    };
  }

  if (!session.activeLearner) {
    return {
      target: "users" as const,
      path: "/users",
      learnerId: null,
    };
  }

  return {
    target: "today" as const,
    path: "/today",
    learnerId: session.activeLearner.id,
  };
}

async function resolveReadyLaunch(session: AuthenticatedAppSession, intent: MobileShellIntent) {
  const onboarding = await getHomeschoolOnboardingStatus(session.organization.id);
  const onboardingComplete = onboarding.isComplete;

  if (intent.target === "onboarding") {
    return {
      target: "onboarding" as const,
      path: "/onboarding",
      learnerId: session.activeLearner?.id ?? null,
      onboardingComplete,
    };
  }

  if (!onboardingComplete) {
    return {
      target: "onboarding" as const,
      path: "/onboarding",
      learnerId: session.activeLearner?.id ?? null,
      onboardingComplete,
    };
  }

  if (intent.target === "activity") {
    const launch = await resolveActivityLaunch(session, intent);
    return {
      ...launch,
      onboardingComplete,
    };
  }

  const effectiveLearner = await resolveSelectableLearner(session, intent.learnerId);

  switch (intent.target) {
    case "users":
      return {
        target: "users" as const,
        path: "/users",
        learnerId: effectiveLearner?.id ?? null,
        onboardingComplete,
      };
    case "account":
      return {
        target: "account" as const,
        path: "/account",
        learnerId: effectiveLearner?.id ?? null,
        onboardingComplete,
      };
    case "learner":
      return {
        target: (effectiveLearner ? "learner" : "users") as MobileShellTarget,
        path: effectiveLearner ? "/learner" : "/users",
        learnerId: effectiveLearner?.id ?? null,
        onboardingComplete,
      };
    case "today":
    case null:
    default:
      return {
        target: (effectiveLearner ? "today" : "users") as MobileShellTarget,
        path: effectiveLearner ? "/today" : "/users",
        learnerId: effectiveLearner?.id ?? null,
        onboardingComplete,
      };
  }
}

export function parseMobileShellIntent(searchParams: URLSearchParams): MobileShellIntent {
  const parsed = MobileShellIntentSchema.safeParse({
    target: searchParams.get("target") ?? undefined,
    learnerId: searchParams.get("learnerId") ?? undefined,
    sessionId: searchParams.get("sessionId") ?? undefined,
  });

  if (!parsed.success) {
    return {
      target: null,
      learnerId: null,
      sessionId: null,
    };
  }

  return {
    target: parsed.data.target ?? null,
    learnerId: parsed.data.learnerId ?? null,
    sessionId: parsed.data.sessionId ?? null,
  };
}

export function buildMobileShellOpenPath(intent: MobileShellIntent) {
  return buildShellPath(intent);
}

export async function resolveMobileShellRedirect(
  state: AppAuthState,
  intent: MobileShellIntent,
): Promise<MobileShellResolution> {
  const shellPath = buildShellPath(intent);

  if (state.status === "signed_out") {
    return {
      authStatus: "signed_out",
      requestedTarget: intent.target,
      resolvedTarget: "login",
      redirectPath: buildPathWithNext("/auth/login", shellPath),
      organizationId: null,
      learnerId: null,
      onboardingComplete: null,
    };
  }

  if (state.status === "needs_setup") {
    return {
      authStatus: "needs_setup",
      requestedTarget: intent.target,
      resolvedTarget: "setup",
      redirectPath: buildPathWithNext("/auth/setup", shellPath),
      organizationId: null,
      learnerId: null,
      onboardingComplete: null,
    };
  }

  const launch =
    intent.target || intent.learnerId || intent.sessionId
      ? await resolveReadyLaunch(state.session, intent)
      : defaultReadyPath(
          state.session,
          (await getHomeschoolOnboardingStatus(state.session.organization.id)).isComplete,
        );

  return {
    authStatus: "ready",
    requestedTarget: intent.target,
    resolvedTarget: launch.target,
    redirectPath: launch.path,
    organizationId: state.session.organization.id,
    learnerId: launch.learnerId,
    onboardingComplete:
      "onboardingComplete" in launch
        ? launch.onboardingComplete
        : launch.target !== "onboarding",
  };
}
