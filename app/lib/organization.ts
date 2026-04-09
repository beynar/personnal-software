"use client";

import type { authClient } from "~/lib/auth-client";

type AuthClient = typeof authClient;

type OrganizationSummary = {
	id: string;
	name: string;
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

	const organizations = options?.organizations ?? null;
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

	const personalName = getPersonalOrganizationName(user);
	const baseSlug = getPersonalOrganizationSlugBase(user);
	const slug = await reserveOrganizationSlug(client, baseSlug);
	const { data, error } = await client.organization.create({
		keepCurrentActiveOrganization: false,
		name: personalName,
		slug,
	});

	if (error) {
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
	const refreshedOrganizationId =
		readFirstOrganizationId(refreshedOrganizations?.data) ??
		readFirstOrganizationId(refreshedOrganizations);
	return refreshedOrganizationId ?? null;
}

async function reserveOrganizationSlug(client: AuthClient, baseSlug: string) {
	const normalizedBaseSlug = baseSlug || "personal-organization";

	for (let suffix = 0; suffix < 100; suffix += 1) {
		const candidate =
			suffix === 0 ? normalizedBaseSlug : `${normalizedBaseSlug}-${suffix + 1}`;
		const { data, error } = await client.organization.checkSlug({
			slug: candidate,
		});

		if (error) {
			throw new Error(error.message ?? "Failed to validate organization slug");
		}

		const status =
			readBoolean(data, "available") ??
			readBoolean(data, "isAvailable") ??
			readBoolean(data, "valid");
		if (status !== false) {
			return candidate;
		}
	}

	throw new Error("Failed to reserve a personal organization slug");
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
