"use client";

import type { authClient } from "~/lib/auth-client";

type AuthClient = typeof authClient;

type OrganizationSummary = {
	id: string;
	name: string;
};

type OrganizationCandidate = {
	name: string;
	slug: string;
};

type SessionUser = {
	email?: string | null;
	name?: string | null;
};

export async function ensureOrganizationForSession(
	client: AuthClient,
	user: SessionUser,
	options?: {
		activeOrganization?: { id: string } | null;
		organizations?: OrganizationSummary[] | null;
	},
) {
	const activeOrganization = options?.activeOrganization ?? null;
	if (activeOrganization?.id) {
		return activeOrganization.id;
	}

	let organizations = options?.organizations ?? null;

	// When called without pre-fetched org data (e.g. right after sign-in),
	// query the server so we don't blindly create a duplicate org.
	if (!organizations) {
		const listResult = await client.organization.list();
		const listError = readErrorMessage(listResult);
		if (listError) {
			throw new Error(listError);
		}

		organizations =
			(Array.isArray(listResult?.data) ? listResult.data : null) ??
			(Array.isArray(listResult) ? listResult : null);
	}

	if (organizations?.length) {
		const firstOrganizationId = organizations[0]?.id;
		if (!firstOrganizationId) {
			return null;
		}

		const { error } = await client.organization.setActive({
			organizationId: firstOrganizationId,
		});
		if (error) {
			throw new Error(error.message ?? "Failed to activate organization");
		}

		return firstOrganizationId;
	}

	return await createPersonalOrganization(client, user);
}

async function createPersonalOrganization(
	client: AuthClient,
	user: SessionUser,
) {
	const baseName = getPersonalOrganizationName(user);
	const baseSlug = getPersonalOrganizationSlugBase(user);

	for (let suffix = 0; suffix < 100; suffix += 1) {
		const candidate = getOrganizationCandidate(baseName, baseSlug, suffix);
		const isSlugAvailable = await checkOrganizationSlug(client, candidate.slug);
		if (!isSlugAvailable) {
			continue;
		}

		const organizationId = await tryCreateOrganization(client, candidate);
		if (organizationId) {
			return organizationId;
		}
	}

	throw new Error("Failed to create a personal organization");
}

async function checkOrganizationSlug(client: AuthClient, slug: string) {
	const { data, error } = await client.organization.checkSlug({ slug });

	if (error) {
		if (isOrganizationSlugConflict(error)) {
			return false;
		}

		throw new Error(
			error.message ?? "Failed to validate personal organization slug",
		);
	}

	const status = readBoolean(data, "status");
	return status === true;
}

async function tryCreateOrganization(
	client: AuthClient,
	candidate: OrganizationCandidate,
) {
	const { data, error } = await client.organization.create({
		keepCurrentActiveOrganization: false,
		name: candidate.name,
		slug: candidate.slug,
	});

	if (error) {
		if (isOrganizationSlugConflict(error)) {
			return null;
		}

		throw new Error(error.message ?? "Failed to create personal organization");
	}

	const createdOrganizationId =
		readString(data, "id") ??
		readString(data, "organizationId") ??
		readNestedString(data, "organization", "id");
	if (createdOrganizationId) {
		return createdOrganizationId;
	}

	const refreshedOrganizations = await client.organization.list();
	const refreshedListError = readErrorMessage(refreshedOrganizations);
	if (refreshedListError) {
		throw new Error(refreshedListError);
	}

	return (
		readFirstOrganizationId(refreshedOrganizations?.data) ??
		readFirstOrganizationId(refreshedOrganizations)
	);
}

function getOrganizationCandidate(
	baseName: string,
	baseSlug: string,
	suffix: number,
): OrganizationCandidate {
	const normalizedBaseSlug = baseSlug || "personal-organization";
	if (suffix === 0) {
		return {
			name: baseName,
			slug: normalizedBaseSlug,
		};
	}

	const number = suffix + 1;
	return {
		name: `${baseName} ${number}`,
		slug: `${normalizedBaseSlug}-${number}`,
	};
}

function getPersonalOrganizationName(user: SessionUser) {
	const label = normalizeLabel(user.name) ?? emailLabel(user.email);
	return `${toPossessive(label)} Organization`;
}

function getPersonalOrganizationSlugBase(user: SessionUser) {
	const label = normalizeLabel(user.name) ?? emailLabel(user.email);
	return `${slugify(label)}-organization`;
}

function normalizeLabel(value: string | null | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function emailLabel(email: string | null | undefined) {
	const localPart = email?.split("@")[0] ?? "personal";
	const cleaned = localPart.replace(/[._-]+/g, " ").trim();
	return cleaned || "Personal";
}

function toPossessive(value: string) {
	return value.endsWith("s") ? `${value}'` : `${value}'s`;
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function readString(value: unknown, key: string) {
	if (!value || typeof value !== "object") {
		return null;
	}

	const record = value as Record<string, unknown>;
	const fieldValue = record[key];
	return typeof fieldValue === "string" ? fieldValue : null;
}

function readNestedString(value: unknown, objectKey: string, fieldKey: string) {
	if (!value || typeof value !== "object") {
		return null;
	}

	const record = value as Record<string, unknown>;
	return readString(record[objectKey], fieldKey);
}

function readBoolean(value: unknown, key: string) {
	if (!value || typeof value !== "object") {
		return null;
	}

	const record = value as Record<string, unknown>;
	const fieldValue = record[key];
	return typeof fieldValue === "boolean" ? fieldValue : null;
}

function readFirstOrganizationId(value: unknown) {
	if (!Array.isArray(value)) {
		return null;
	}

	for (const item of value) {
		const id = readString(item, "id");
		if (id) {
			return id;
		}
	}

	return null;
}

function readErrorMessage(value: unknown) {
	if (!value || typeof value !== "object") {
		return null;
	}

	const error = (value as { error?: unknown }).error;
	return readString(error, "message");
}

function isOrganizationSlugConflict(error: unknown) {
	const code = readString(error, "code");
	const message = readString(error, "message") ?? "";

	return (
		code === "ORGANIZATION_ALREADY_EXISTS" ||
		code === "ORGANIZATION_SLUG_ALREADY_TAKEN" ||
		/\borganization\b.*\b(already exists|slug already taken)\b/i.test(message)
	);
}
