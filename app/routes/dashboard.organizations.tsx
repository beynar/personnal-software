import { createFileRoute } from "@tanstack/react-router";
import { Building2, Loader2, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/dashboard/organizations")({
	component: OrganizationsPage,
});

function OrganizationsPage() {
	const { data: orgs, isPending: loadingOrgs } =
		authClient.useListOrganizations();

	return (
		<div className="space-y-6">
			<Card className="overflow-hidden border-border/70">
				<CardHeader className="gap-3 border-b border-border/70 bg-card/70">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<Building2 className="size-4" />
						Organizations
					</div>
					<CardTitle className="text-3xl">Organizations</CardTitle>
					<CardDescription className="max-w-2xl text-sm leading-6">
						Create and manage organizations. Each organization can have members
						with different roles (owner, admin, member).
					</CardDescription>
				</CardHeader>
				<CardContent className="p-4 space-y-6">
					<CreateOrganizationForm />
					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Your memberships
						</h3>
						{loadingOrgs ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="size-5 animate-spin text-muted-foreground" />
							</div>
						) : !orgs?.length ? (
							<div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-8 text-center">
								<Building2 className="mx-auto size-8 text-muted-foreground/60" />
								<p className="mt-3 text-sm text-muted-foreground">
									You are not a member of any organization yet. Create one above
									to get started.
								</p>
							</div>
						) : (
							<div className="grid gap-3 md:grid-cols-2">
								{orgs.map((org) => (
									<OrganizationCard key={org.id} org={org} />
								))}
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function CreateOrganizationForm() {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!name.trim()) return;

		const orgSlug = slug.trim() || toSlug(name);
		setCreating(true);
		const { error: createError } = await authClient.organization.create({
			name: name.trim(),
			slug: orgSlug,
		});
		setCreating(false);

		if (createError) {
			setError(createError.message ?? "Failed to create organization");
			return;
		}

		setName("");
		setSlug("");
	}

	return (
		<form className="space-y-4" onSubmit={handleCreate}>
			<h3 className="text-sm font-medium text-muted-foreground">
				Create a new organization
			</h3>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="org-name">Name</Label>
					<Input
						id="org-name"
						onChange={(e) => setName(e.target.value)}
						placeholder="My Team"
						value={name}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="org-slug">Slug (optional)</Label>
					<Input
						id="org-slug"
						onChange={(e) => setSlug(e.target.value)}
						placeholder={name ? toSlug(name) : "my-team"}
						value={slug}
					/>
				</div>
			</div>
			{error && <p className="text-sm text-destructive">{error}</p>}
			<Button disabled={creating || !name.trim()} type="submit">
				{creating ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Plus className="size-4" />
				)}
				{creating ? "Creating..." : "Create organization"}
			</Button>
		</form>
	);
}

function OrganizationCard({
	org,
}: {
	org: {
		id: string;
		name: string;
		slug: string;
		logo?: string | null;
		createdAt: Date;
		members?: { role: string }[];
	};
}) {
	const memberRole = org.members?.[0]?.role ?? "member";

	return (
		<div className="rounded-2xl border border-border/70 bg-background/70 p-4">
			<div className="flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
					{org.logo ? (
						<img
							alt={org.name}
							className="size-10 rounded-full object-cover"
							src={org.logo}
						/>
					) : (
						<Building2 className="size-4" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium">{org.name}</p>
					<p className="truncate text-xs text-muted-foreground">/{org.slug}</p>
				</div>
				<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">
					<Users className="size-3" />
					{memberRole}
				</span>
			</div>
		</div>
	);
}

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}
