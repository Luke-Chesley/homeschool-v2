import { NextRequest, NextResponse } from "next/server";

import { getAppAuthState } from "@/lib/app-session/server";
import { getLearningCoreRuntimeStatus } from "@/lib/learning-core/status";
import {
  MOBILE_SHELL_TARGETS,
  buildMobileShellOpenPath,
  parseMobileShellIntent,
  resolveMobileShellRedirect,
} from "@/lib/mobile/shell";

export async function GET(request: NextRequest) {
  const intent = parseMobileShellIntent(request.nextUrl.searchParams);
  const [state, learningCore] = await Promise.all([
    getAppAuthState(),
    getLearningCoreRuntimeStatus(),
  ]);
  const resolution = await resolveMobileShellRedirect(state, intent);

  return NextResponse.json({
    shell: {
      entryPath: "/open",
      launchPath: buildMobileShellOpenPath(intent),
      supportedTargets: MOBILE_SHELL_TARGETS,
      standaloneReady: true,
    },
    auth: {
      status: state.status,
    },
    workspace:
      state.status === "ready"
        ? {
            organization: state.session.organization,
            activeLearner: state.session.activeLearner,
            learners: state.session.learners,
            memberships: state.session.memberships,
          }
        : null,
    launch: {
      requestedTarget: resolution.requestedTarget,
      resolvedTarget: resolution.resolvedTarget,
      redirectPath: resolution.redirectPath,
      learnerId: resolution.learnerId,
      onboardingComplete: resolution.onboardingComplete,
    },
    services: {
      learningCore,
    },
  });
}
