// File Upload Example — demonstrates Convex file storage with real-time updates.
// Copy this pattern for any project that needs file upload/download/delete.
//
// How it works:
// 1. generateUploadUrl → get a short-lived upload URL from Convex
// 2. fetch(uploadUrl, { method: "POST", body: file }) → upload directly to Convex storage
// 3. saveFile mutation → save metadata (name, size, type) linked to the storage blob
// 4. listFiles query → real-time subscription keeps the file list updated
// 5. deleteFile mutation → removes both the storage blob and metadata

import { useAuthActions } from "@convex-dev/auth/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Authenticated,
	Unauthenticated,
	useMutation,
	useQuery,
} from "convex/react";
import { type FunctionReference, anyApi } from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";

// --- Convex function references (avoids needing _generated API) ---
const generateUploadUrlMutation: FunctionReference<"mutation"> =
	anyApi.files.generateUploadUrl;
const saveFileMutation: FunctionReference<"mutation"> = anyApi.files.saveFile;
const deleteFileMutation: FunctionReference<"mutation"> =
	anyApi.files.deleteFile;
const listFilesQuery: FunctionReference<"query"> = anyApi.files.listFiles;

export const Route = createFileRoute("/examples/file-upload")({
	component: FileUploadPage,
});

function FileUploadPage() {
	return (
		<>
			<Authenticated>
				<FileUploadLayout />
			</Authenticated>
			<Unauthenticated>
				<RedirectToLogin />
			</Unauthenticated>
		</>
	);
}

function RedirectToLogin() {
	const navigate = useNavigate();
	useEffect(() => {
		navigate({ to: "/" });
	}, [navigate]);
	return null;
}

// --- Main layout ---
function FileUploadLayout() {
	const { signOut } = useAuthActions();
	const navigate = useNavigate();

	async function handleSignOut() {
		await signOut();
		navigate({ to: "/" });
	}

	return (
		<div className="min-h-screen">
			<header className="border-b">
				<div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
					<h1 className="text-lg font-semibold">File Upload Example</h1>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate({ to: "/dashboard" })}
						>
							Dashboard
						</Button>
						<Button variant="outline" size="sm" onClick={handleSignOut}>
							Sign Out
						</Button>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-8">
				<UploadForm />
				<FileList />
			</main>
		</div>
	);
}

// --- Upload form with progress ---
function UploadForm() {
	const generateUploadUrl = useMutation(generateUploadUrlMutation);
	const saveFile = useMutation(saveFileMutation);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const handleUpload = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			setUploading(true);
			setProgress(0);
			setError(null);

			try {
				// Step 1: Get a short-lived upload URL from Convex
				const uploadUrl = await generateUploadUrl();

				// Step 2: Upload the file directly to Convex storage
				// Use XMLHttpRequest for upload progress tracking
				const { storageId } = await new Promise<{ storageId: string }>(
					(resolve, reject) => {
						const xhr = new XMLHttpRequest();
						xhr.upload.addEventListener("progress", (event) => {
							if (event.lengthComputable) {
								setProgress(Math.round((event.loaded / event.total) * 100));
							}
						});
						xhr.addEventListener("load", () => {
							if (xhr.status >= 200 && xhr.status < 300) {
								resolve(JSON.parse(xhr.responseText));
							} else {
								reject(new Error(`Upload failed: ${xhr.statusText}`));
							}
						});
						xhr.addEventListener("error", () =>
							reject(new Error("Upload failed")),
						);
						xhr.open("POST", uploadUrl);
						xhr.setRequestHeader("Content-Type", file.type);
						xhr.send(file);
					},
				);

				// Step 3: Save file metadata to the files table
				await saveFile({
					storageId,
					name: file.name,
					size: file.size,
					type: file.type,
				});

				setProgress(100);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Upload failed");
			} finally {
				setUploading(false);
				// Reset file input so the same file can be re-uploaded
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			}
		},
		[generateUploadUrl, saveFile],
	);

	return (
		<div className="mb-8">
			<h2 className="mb-4 text-xl font-semibold">Upload a File</h2>
			<div className="rounded-lg border border-dashed p-6">
				<input
					ref={fileInputRef}
					type="file"
					onChange={handleUpload}
					disabled={uploading}
					className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
				/>

				{/* Progress bar */}
				{uploading && (
					<div className="mt-4">
						<div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
							<span>Uploading…</span>
							<span>{progress}%</span>
						</div>
						<div className="h-2 rounded-full bg-secondary">
							<div
								className="h-full rounded-full bg-primary transition-all duration-200"
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				)}

				{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
			</div>
		</div>
	);
}

// --- File list with real-time updates ---
function FileList() {
	const files = useQuery(listFilesQuery);
	const deleteFile = useMutation(deleteFileMutation);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	async function handleDelete(fileId: string) {
		setDeletingId(fileId);
		try {
			await deleteFile({ fileId });
		} finally {
			setDeletingId(null);
		}
	}

	if (files === undefined) {
		return <p className="text-sm text-muted-foreground">Loading files…</p>;
	}

	if (files.length === 0) {
		return (
			<div className="rounded-lg border p-8 text-center">
				<p className="text-muted-foreground">
					No files uploaded yet. Choose a file above to get started.
				</p>
			</div>
		);
	}

	return (
		<div>
			<h2 className="mb-4 text-xl font-semibold">
				Uploaded Files ({files.length})
			</h2>
			<div className="divide-y rounded-lg border">
				{files.map(
					(file: {
						_id: string;
						name: string;
						size: number;
						type: string;
						uploadedAt: number;
						url: string | null;
					}) => (
						<div
							key={file._id}
							className="flex items-center justify-between px-4 py-3"
						>
							<div className="min-w-0 flex-1">
								{/* File name — link to download if URL available */}
								{file.url ? (
									<a
										href={file.url}
										target="_blank"
										rel="noopener noreferrer"
										className="truncate font-medium text-primary hover:underline"
									>
										{file.name}
									</a>
								) : (
									<span className="truncate font-medium">{file.name}</span>
								)}
								<div className="mt-0.5 text-xs text-muted-foreground">
									{formatFileSize(file.size)} · {formatDate(file.uploadedAt)}
								</div>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleDelete(file._id)}
								disabled={deletingId === file._id}
								className="ml-4 text-destructive hover:text-destructive"
							>
								{deletingId === file._id ? "Deleting…" : "Delete"}
							</Button>
						</div>
					),
				)}
			</div>
		</div>
	);
}

// --- Helpers ---

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}
