import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

export const Route = createFileRoute("/dashboard/api-keys")({
	component: ApiKeysPage,
});

function ApiKeysPage() {
	const [keys, setKeys] = useState<
		Array<{
			id: string;
			name: string | null;
			start: string | null;
			enabled: boolean;
			createdAt: Date;
			expiresAt: Date | null;
		}>
	>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const loadKeys = useCallback(async () => {
		setLoading(true);
		const { data, error: listError } = await authClient.apiKey.list();
		setLoading(false);
		if (listError) {
			setError(listError.message ?? "Failed to load API keys");
			return;
		}
		setKeys(data?.apiKeys ?? []);
	}, []);

	useEffect(() => {
		loadKeys();
	}, [loadKeys]);

	return (
		<div className="space-y-6">
			<Card className="overflow-hidden border-border/70">
				<CardHeader className="gap-3 border-b border-border/70 bg-card/70">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<Key className="size-4" />
						API Keys
					</div>
					<CardTitle className="text-3xl">API Keys</CardTitle>
					<CardDescription className="max-w-2xl text-sm leading-6">
						Create and manage API keys for machine-to-machine authentication.
						Keys are shown only once at creation — store them securely.
					</CardDescription>
				</CardHeader>
				<CardContent className="p-4 space-y-6">
					<CreateApiKeyForm onCreated={loadKeys} />
					{error && <p className="text-sm text-destructive">{error}</p>}
					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Your keys
						</h3>
						{loading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="size-5 animate-spin text-muted-foreground" />
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
								{keys.map((k) => (
									<ApiKeyRow key={k.id} apiKey={k} onDeleted={loadKeys} />
								))}
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function CreateApiKeyForm({ onCreated }: { onCreated: () => void }) {
	const [name, setName] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");
	const [newKey, setNewKey] = useState("");

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setNewKey("");
		setCreating(true);

		const { data, error: createError } = await authClient.apiKey.create({
			name: name.trim() || undefined,
		});
		setCreating(false);

		if (createError) {
			setError(createError.message ?? "Failed to create API key");
			return;
		}

		if (data?.key) {
			setNewKey(data.key);
		}
		setName("");
		onCreated();
	}

	return (
		<div className="space-y-4">
			<h3 className="text-sm font-medium text-muted-foreground">
				Create a new API key
			</h3>
			<form className="flex items-end gap-3" onSubmit={handleCreate}>
				<div className="flex-1 space-y-2">
					<Label htmlFor="key-name">Name (optional)</Label>
					<Input
						id="key-name"
						onChange={(e) => setName(e.target.value)}
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
			{error && <p className="text-sm text-destructive">{error}</p>}
			{newKey && (
				<NewKeyBanner apiKey={newKey} onDismiss={() => setNewKey("")} />
			)}
		</div>
	);
}

function NewKeyBanner({
	apiKey,
	onDismiss,
}: { apiKey: string; onDismiss: () => void }) {
	const [copied, setCopied] = useState(false);

	async function copyToClipboard() {
		await navigator.clipboard.writeText(apiKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
			<p className="text-sm font-medium text-green-700 dark:text-green-400">
				API key created — copy it now. It won't be shown again.
			</p>
			<div className="flex items-center gap-2">
				<code className="flex-1 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm font-mono break-all select-all">
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
	apiKey: k,
	onDeleted,
}: {
	apiKey: {
		id: string;
		name: string | null;
		start: string | null;
		enabled: boolean;
		createdAt: Date;
		expiresAt: Date | null;
	};
	onDeleted: () => void;
}) {
	const [deleting, setDeleting] = useState(false);

	async function handleDelete() {
		setDeleting(true);
		await authClient.apiKey.delete({ keyId: k.id });
		setDeleting(false);
		onDeleted();
	}

	const label = k.name || k.start || "Unnamed key";
	const createdDate = new Date(k.createdAt).toLocaleDateString();

	return (
		<div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-4">
			<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
				<Key className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium">{label}</p>
				<p className="text-xs text-muted-foreground">
					{k.start && <span className="font-mono">{k.start}•••</span>}
					{k.start && " · "}
					Created {createdDate}
					{k.expiresAt &&
						` · Expires ${new Date(k.expiresAt).toLocaleDateString()}`}
				</p>
			</div>
			<span
				className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
					k.enabled
						? "bg-green-500/10 text-green-700 dark:text-green-400"
						: "bg-muted text-muted-foreground"
				}`}
			>
				{k.enabled ? "Active" : "Disabled"}
			</span>
			<Button
				disabled={deleting}
				onClick={handleDelete}
				size="icon"
				variant="ghost"
			>
				{deleting ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Trash2 className="size-4 text-muted-foreground" />
				)}
				<span className="sr-only">Delete</span>
			</Button>
		</div>
	);
}
