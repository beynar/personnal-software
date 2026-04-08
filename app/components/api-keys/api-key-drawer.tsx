"use client";

import { Check, Copy, Ellipsis, Key, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "~/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/lib/auth-client";

type ApiKeyRecord = {
	createdAt: Date;
	enabled: boolean;
	expiresAt: Date | null;
	id: string;
	name: string | null;
	start: string | null;
};

type LatestCreatedKey = {
	id: string;
	key: string;
} | null;

/**
 * Opens a sidebar drawer for listing, creating, and deleting API keys.
 */
export function ApiKeyDrawer({
	collapsed = false,
	onOpenChange,
	open: controlledOpen,
	showTrigger = true,
}: {
	collapsed?: boolean;
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	showTrigger?: boolean;
}) {
	const [error, setError] = useState("");
	const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
	const [latestCreatedKey, setLatestCreatedKey] =
		useState<LatestCreatedKey>(null);
	const [loading, setLoading] = useState(false);
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const open = controlledOpen ?? uncontrolledOpen;

	function handleOpenChange(nextOpen: boolean) {
		onOpenChange?.(nextOpen);
		if (controlledOpen === undefined) {
			setUncontrolledOpen(nextOpen);
		}
	}

	const loadKeys = useCallback(async () => {
		setLoading(true);
		setError("");
		const { data, error: listError } = await authClient.apiKey.list();
		setLoading(false);

		if (listError) {
			setError(listError.message ?? "Failed to load API keys");
			return;
		}

		setKeys(data?.apiKeys ?? []);
	}, []);

	useEffect(() => {
		if (!open) {
			return;
		}

		void loadKeys();
	}, [loadKeys, open]);

	return (
		<Drawer direction="right" onOpenChange={handleOpenChange} open={open}>
			{showTrigger ? (
				<DrawerTrigger asChild>
					<Button
						className={
							collapsed
								? "m-0 h-16 w-full rounded-none border-b border-border-70"
								: "justify-start border-border/70"
						}
						size={collapsed ? "icon" : "default"}
						variant={collapsed ? "ghost" : "outline"}
					>
						<Key className="size-4" />
						{collapsed ? (
							<span className="sr-only">API keys</span>
						) : (
							<span>API keys</span>
						)}
					</Button>
				</DrawerTrigger>
			) : null}
			<DrawerContent className="w-full border-border/70 sm:w-[40rem] sm:max-w-[40rem]">
				<DrawerHeader className="border-b border-border/70 px-6 py-5 text-left">
					<DrawerTitle className="text-lg">API keys</DrawerTitle>
					<DrawerDescription className="max-w-lg text-sm leading-6">
						Create and manage machine credentials from the sidebar. The latest
						raw key stays visible here until you dismiss it or reload.
					</DrawerDescription>
				</DrawerHeader>
				<div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
					<CreateApiKeyForm
						onCreated={(apiKey) => {
							setLatestCreatedKey(apiKey);
							void loadKeys();
						}}
					/>
					{latestCreatedKey ? (
						<NewKeyBanner
							apiKey={latestCreatedKey.key}
							onDismiss={() => setLatestCreatedKey(null)}
						/>
					) : null}
					<div className="space-y-3">
						<div>
							<h3 className="text-sm font-medium text-foreground">Your keys</h3>
							<p className="text-sm text-muted-foreground">
								Existing keys only expose their prefix for security.
							</p>
						</div>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
						{loading ? (
							<div className="flex items-center justify-center rounded-xl border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
								<Loader2 className="mr-2 size-4 animate-spin" />
								Loading API keys
							</div>
						) : !keys.length ? (
							<div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-8 text-center">
								<Key className="mx-auto size-8 text-muted-foreground/60" />
								<p className="mt-3 text-sm text-muted-foreground">
									No API keys yet. Create one above to get started.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{keys.map((apiKey) => (
									<ApiKeyRow
										apiKey={apiKey}
										key={apiKey.id}
										onDeleted={() => void loadKeys()}
										onUpdated={() => void loadKeys()}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

function CreateApiKeyForm({
	onCreated,
}: {
	onCreated: (apiKey: { id: string; key: string }) => void;
}) {
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");
	const [name, setName] = useState("");

	async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setCreating(true);
		setError("");

		const { data, error: createError } = await authClient.apiKey.create({
			name: name.trim() || undefined,
		});
		setCreating(false);

		if (createError) {
			setError(createError.message ?? "Failed to create API key");
			return;
		}

		if (data?.id && data.key) {
			onCreated({ id: data.id, key: data.key });
		}

		setName("");
	}

	return (
		<div className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4">
			<div className="space-y-1">
				<h3 className="text-sm font-medium text-foreground">
					Create a new API key
				</h3>
				<p className="text-sm text-muted-foreground">
					Name the key after its integration or workflow so it stays legible.
				</p>
			</div>
			<form
				className="flex flex-col gap-3 sm:flex-row sm:items-end"
				onSubmit={handleCreate}
			>
				<div className="flex-1 space-y-2">
					<Label htmlFor="key-name">Name</Label>
					<Input
						id="key-name"
						onChange={(event) => setName(event.target.value)}
						placeholder="my-integration"
						value={name}
					/>
				</div>
				<Button disabled={creating} type="submit">
					{creating ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Plus className="size-4" />
					)}
					{creating ? "Creating..." : "Create key"}
				</Button>
			</form>
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
		</div>
	);
}

function NewKeyBanner({
	apiKey,
	onDismiss,
}: {
	apiKey: string;
	onDismiss: () => void;
}) {
	const [copied, setCopied] = useState(false);

	async function copyToClipboard() {
		await navigator.clipboard.writeText(apiKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="space-y-3 rounded-2xl border border-green-500/30 bg-green-500/5 p-4">
			<p className="text-sm text-muted-foreground">
				This full value is only returned when the key is created, so keep it
				safe before dismissing it.
			</p>
			<div className="flex items-center gap-2">
				<code className="flex-1 break-all rounded-2xl border border-border/70 bg-accent px-3 py-2 font-mono text-sm select-all">
					{apiKey}
				</code>
				<Button onClick={copyToClipboard} size="icon" variant="outline">
					{copied ? (
						<Check className="size-4 text-green-600" />
					) : (
						<Copy className="size-4" />
					)}
					<span className="sr-only">Copy</span>
				</Button>
			</div>
			<Button onClick={onDismiss} size="sm" variant="ghost">
				Dismiss
			</Button>
		</div>
	);
}

function ApiKeyRow({
	apiKey,
	onDeleted,
	onUpdated,
}: {
	apiKey: ApiKeyRecord;
	onDeleted: () => void;
	onUpdated: () => void;
}) {
	const [deleting, setDeleting] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [updating, setUpdating] = useState(false);

	async function handleDelete() {
		setDeleting(true);
		try {
			await authClient.apiKey.delete({ keyId: apiKey.id });
			setDeleteDialogOpen(false);
			toast.success("API key deleted");
			onDeleted();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete API key",
			);
		} finally {
			setDeleting(false);
		}
	}

	async function handleToggleEnabled() {
		setUpdating(true);
		try {
			await updateApiKeyEnabled({
				enabled: !apiKey.enabled,
				keyId: apiKey.id,
			});
			toast.success(
				apiKey.enabled ? "API key deactivated" : "API key activated",
			);
			onUpdated();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update API key",
			);
		} finally {
			setUpdating(false);
		}
	}

	const label = apiKey.name || apiKey.start || "Unnamed key";
	const createdDate = new Date(apiKey.createdAt).toLocaleDateString();

	return (
		<div className="rounded-2xl border border-border/70 bg-accent px-5 py-5">
			<div className="flex items-start gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="truncate text-lg font-semibold text-foreground">
								{label}
							</p>
							<p className="mt-1 text-sm font-mono text-muted-foreground">
								{apiKey.start ? `${apiKey.start}••••` : "No prefix available"}
							</p>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button disabled={updating} size="icon" variant="ghost">
									{updating ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Ellipsis className="size-4 text-muted-foreground" />
									)}
									<span className="sr-only">API key actions</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => void handleToggleEnabled()}>
									{apiKey.enabled ? "Deactivate key" : "Activate key"}
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => setDeleteDialogOpen(true)}
									variant="destructive"
								>
									Delete key
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						<span>
							Created {createdDate}
							{apiKey.expiresAt
								? ` · Expires ${new Date(apiKey.expiresAt).toLocaleDateString()}`
								: ""}
						</span>
						<span
							className={
								apiKey.enabled
									? "inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
									: "inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"
							}
						>
							{apiKey.enabled ? "Active" : "Disabled"}
						</span>
					</div>
				</div>
			</div>
			<AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete API key?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes{" "}
							<span className="font-medium text-foreground">{label}</span>. Any
							integration still using it will stop working immediately.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={deleting}
							onClick={() => void handleDelete()}
							variant="destructive"
						>
							{deleting ? "Deleting..." : "Delete key"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

async function updateApiKeyEnabled({
	enabled,
	keyId,
}: {
	enabled: boolean;
	keyId: string;
}) {
	const response = await fetch("/api/auth/api-key/update", {
		body: JSON.stringify({ enabled, keyId }),
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		method: "POST",
	});

	const payload = (await response.json().catch(() => null)) as {
		error?: { message?: string };
		message?: string;
	} | null;

	if (!response.ok) {
		throw new Error(
			payload?.error?.message ?? payload?.message ?? "Failed to update API key",
		);
	}
}
