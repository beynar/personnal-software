"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/lib/auth-client";

type CreateOrganizationDialogProps = {
	onCreated?: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

export function CreateOrganizationDialog({
	onCreated,
	onOpenChange,
	open,
}: CreateOrganizationDialogProps) {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");

	async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError("");
		if (!name.trim()) return;

		const organizationSlug = slug.trim() || toOrganizationSlug(name);
		setCreating(true);
		const { error: createError } = await authClient.organization.create({
			name: name.trim(),
			slug: organizationSlug,
		});
		setCreating(false);

		if (createError) {
			setError(createError.message ?? "Failed to create organization");
			return;
		}

		setName("");
		setSlug("");
		onOpenChange(false);
		onCreated?.();
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && !creating) {
			setError("");
		}
		onOpenChange(nextOpen);
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="max-w-xl rounded-3xl border-border/70 p-0 sm:max-w-xl">
				<form onSubmit={handleCreate}>
					<DialogHeader className="border-b border-border/70 px-6 py-6">
						<DialogTitle>Create organization</DialogTitle>
						<DialogDescription className="max-w-md text-sm leading-6">
							Create a workspace for a team, client, or business unit. The slug
							becomes the URL-friendly identifier.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-5 px-6 py-6">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="organization-name">Name</Label>
								<Input
									autoFocus
									id="organization-name"
									onChange={(event) => setName(event.target.value)}
									placeholder="Northwind Studio"
									value={name}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="organization-slug">Slug</Label>
								<Input
									id="organization-slug"
									onChange={(event) => setSlug(event.target.value)}
									placeholder={
										name ? toOrganizationSlug(name) : "northwind-studio"
									}
									value={slug}
								/>
							</div>
						</div>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
					</div>
					<DialogFooter className="border-t border-border/70 px-6 py-4">
						<Button
							disabled={creating || !name.trim()}
							type="submit"
							className="min-w-40"
						>
							{creating ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Plus className="size-4" />
							)}
							{creating ? "Creating..." : "Create organization"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function toOrganizationSlug(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}
