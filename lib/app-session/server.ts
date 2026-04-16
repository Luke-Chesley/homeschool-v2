import "@/lib/server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { AUTH_NEXT_COOKIE, buildPathWithNext, sanitizeNextPath } from "@/lib/auth/next";
import { getRequestAuthSession } from "@/lib/auth/server";
import { resolveAuthorizedOrganizations } from "@/lib/auth/identity";
import type { AppLearner, AppWorkspace } from "@/lib/users/service";
import { getWorkspaceContextForOrganization } from "@/lib/users/service";

export const APP_ORGANIZATION_COOKIE = "hsv2_org_id";
export const APP_LEARNER_COOKIE = "hsv2_learner_id";

export type AuthenticatedAppSession = AppWorkspace & {
  authUser: {
    id: string;
    email: string | null;
  };
  adultUser: {
    id: string;
    email: string;
    fullName: string | null;
  };
  membership: {
    id: string;
    role: string;
    isDefault: boolean;
  };
  memberships: Array<{
    id: string;
    role: string;
    isDefault: boolean;
    organization: {
      id: string;
      name: string;
      slug: string;
      timezone: string;
    };
  }>;
};

export type AppAuthState =
  | { status: "signed_out" }
  | {
      status: "needs_setup";
      authUser: {
        id: string;
        email: string | null;
        fullName: string | null;
      };
    }
  | {
      status: "ready";
      session: AuthenticatedAppSession;
    };

export class AppApiSessionError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppApiSessionError";
    this.status = status;
    this.code = code;
  }
}

// Layouts and pages often resolve the same session in one render tree.
const getResolvedAuthorizedOrganizations = cache(async (authUserId: string) =>
  resolveAuthorizedOrganizations(authUserId),
);

const getResolvedWorkspaceContext = cache(async (organizationId: string, learnerId: string | null) =>
  getWorkspaceContextForOrganization({
    organizationId,
    learnerId,
  }),
);

export async function getAppAuthState(): Promise<AppAuthState> {
  const [{ user }, cookieStore] = await Promise.all([getRequestAuthSession(), cookies()]);

  if (!user) {
    return { status: "signed_out" };
  }

  const resolved = await getResolvedAuthorizedOrganizations(user.id);
  if (!resolved.adultUser || resolved.memberships.length === 0) {
    return {
      status: "needs_setup",
      authUser: {
        id: user.id,
        email: user.email ?? null,
        fullName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : null,
      },
    };
  }

  const organizationPreference = cookieStore.get(APP_ORGANIZATION_COOKIE)?.value ?? null;
  const learnerPreference = cookieStore.get(APP_LEARNER_COOKIE)?.value ?? null;

  const selectedMembership =
    resolved.memberships.find(({ organization }) => organization.id === organizationPreference) ??
    resolved.memberships.find(({ membership }) => membership.isDefault) ??
    resolved.memberships[0];

  const workspace = await getResolvedWorkspaceContext(
    selectedMembership.organization.id,
    learnerPreference,
  );

  return {
    status: "ready",
    session: {
      ...workspace,
      authUser: {
        id: user.id,
        email: user.email ?? null,
      },
      adultUser: {
        id: resolved.adultUser.id,
        email: resolved.adultUser.email,
        fullName: resolved.adultUser.fullName,
      },
      membership: {
        id: selectedMembership.membership.id,
        role: selectedMembership.membership.role,
        isDefault: selectedMembership.membership.isDefault,
      },
      memberships: resolved.memberships.map(({ membership, organization }) => ({
        id: membership.id,
        role: membership.role,
        isDefault: membership.isDefault,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          timezone: organization.timezone,
        },
      })),
    },
  };
}

function resolveResumePath(cookieStore: Awaited<ReturnType<typeof cookies>>, nextPath?: string | null) {
  const explicitNext = sanitizeNextPath(nextPath, "");
  if (explicitNext) {
    return explicitNext;
  }

  return sanitizeNextPath(cookieStore.get(AUTH_NEXT_COOKIE)?.value, "");
}

export async function getAppSession(options?: {
  nextPath?: string | null;
}): Promise<AuthenticatedAppSession> {
  const state = await getAppAuthState();
  const cookieStore = await cookies();
  const resumePath = resolveResumePath(cookieStore, options?.nextPath);

  if (state.status === "signed_out") {
    redirect(buildPathWithNext("/auth/login", resumePath));
  }

  if (state.status === "needs_setup") {
    redirect(buildPathWithNext("/auth/setup", resumePath));
  }

  return state.session;
}

export async function requireAppSession(options?: {
  nextPath?: string | null;
}): Promise<AuthenticatedAppSession & { activeLearner: AppLearner }> {
  const session = await getAppSession({ nextPath: options?.nextPath });
  const cookieStore = await cookies();
  const resumePath = resolveResumePath(cookieStore, options?.nextPath);

  if (!session.activeLearner) {
    redirect(buildPathWithNext("/users", resumePath));
  }

  return session as AuthenticatedAppSession & { activeLearner: AppLearner };
}

export async function requireAppApiSession(options?: { requireLearner?: boolean }) {
  const state = await getAppAuthState();

  if (state.status === "signed_out") {
    throw new AppApiSessionError(401, "unauthenticated", "Sign in is required.");
  }

  if (state.status === "needs_setup") {
    throw new AppApiSessionError(403, "setup_required", "Workspace setup is required.");
  }

  if ((options?.requireLearner ?? true) && !state.session.activeLearner) {
    throw new AppApiSessionError(409, "learner_required", "Select or create a learner first.");
  }

  return state.session as AuthenticatedAppSession & { activeLearner: AppLearner };
}

export function isAppApiSessionError(error: unknown): error is AppApiSessionError {
  return error instanceof AppApiSessionError;
}

export function setWorkspaceCookies(params: {
  response: import("next/server").NextResponse;
  organizationId: string;
  learnerId?: string | null;
}) {
  params.response.cookies.set(APP_ORGANIZATION_COOKIE, params.organizationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  if (params.learnerId) {
    params.response.cookies.set(APP_LEARNER_COOKIE, params.learnerId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    params.response.cookies.delete(AUTH_NEXT_COOKIE);
    return params.response;
  }

  params.response.cookies.delete(APP_LEARNER_COOKIE);
  params.response.cookies.delete(AUTH_NEXT_COOKIE);
  return params.response;
}

export function clearWorkspaceCookies(response: import("next/server").NextResponse) {
  response.cookies.delete(APP_ORGANIZATION_COOKIE);
  response.cookies.delete(APP_LEARNER_COOKIE);
  response.cookies.delete(AUTH_NEXT_COOKIE);
  return response;
}
