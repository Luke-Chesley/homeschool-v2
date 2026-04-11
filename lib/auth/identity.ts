import "@/lib/server-only";

import type { User } from "@supabase/supabase-js";

import { createRepositories } from "@/lib/db";
import { ensureDatabaseReady, getDb } from "@/lib/db/server";
import { ensureOrganizationPlatformSettings } from "@/lib/platform/settings";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "homeschool";
}

function getDisplayName(user: User) {
  const metadata = user.user_metadata;
  if (metadata && typeof metadata.full_name === "string" && metadata.full_name.trim()) {
    return metadata.full_name.trim();
  }
  if (metadata && typeof metadata.name === "string" && metadata.name.trim()) {
    return metadata.name.trim();
  }
  if (typeof user.email === "string" && user.email.trim()) {
    return user.email.trim();
  }
  return "Household owner";
}

export async function getAdultUserForAuthUser(authUserId: string) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  return repos.organizations.findAdultUserByAuthUserId(authUserId);
}

export async function resolveAuthorizedOrganizations(authUserId: string) {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const adultUser = await repos.organizations.findAdultUserByAuthUserId(authUserId);

  if (!adultUser) {
    return {
      adultUser: null,
      memberships: [],
    };
  }

  const memberships = await repos.organizations.listMembershipsForAdultUser(adultUser.id);
  return {
    adultUser,
    memberships,
  };
}

export async function bootstrapWorkspaceForAuthUser(params: {
  user: User;
  organizationName: string;
}) {
  await ensureDatabaseReady();
  const db = getDb();
  const repos = createRepositories(db);

  const email = params.user.email?.trim();
  if (!email) {
    throw new Error("Authenticated user is missing an email address.");
  }

  const organizationName = params.organizationName.trim();
  if (!organizationName) {
    throw new Error("Organization name is required.");
  }

  const adultUser = await repos.organizations.upsertAdultUserByAuthUserId({
    authUserId: params.user.id,
    email,
    fullName: getDisplayName(params.user),
    avatarUrl:
      typeof params.user.user_metadata?.avatar_url === "string"
        ? params.user.user_metadata.avatar_url
        : null,
    metadata: {
      source: "phase2-auth-setup",
    },
  });

  const existingMemberships = await repos.organizations.listMembershipsForAdultUser(adultUser.id);
  if (existingMemberships.length > 0) {
    return {
      adultUser,
      organization: existingMemberships[0]!.organization,
      membership: existingMemberships[0]!.membership,
    };
  }

  const timestamp = Date.now();
  const organization = await repos.organizations.createOrganization({
    name: organizationName,
    slug: `${slugify(organizationName)}-${timestamp}`,
    type: "household",
    timezone: "America/Los_Angeles",
    metadata: {
      source: "phase2-auth-setup",
      ownerAdultUserId: adultUser.id,
    },
  });

  await ensureOrganizationPlatformSettings({
    id: organization.id,
    type: organization.type,
  });

  const membership = await repos.organizations.addMembership({
    organizationId: organization.id,
    adultUserId: adultUser.id,
    role: "owner",
    isDefault: true,
    metadata: {
      source: "phase2-auth-setup",
    },
  });

  return {
    adultUser,
    organization,
    membership,
  };
}
