"use client";

import { useMutation } from "convex/react";
import { Camera, Trash2 } from "lucide-react";
import {
	type ChangeEvent,
	type FormEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ProfileUser =
	| {
			bio?: string;
			email?: string;
			image?: string | null;
			name?: string;
			username?: string;
	  }
	| null
	| undefined;

type ProfileDraft = {
	bio: string;
	name: string;
	username: string;
};

/**
 * Renders a lightweight profile settings surface for the authenticated user.
 */
export function ProfileSettingsPage({ user }: { user: ProfileUser }) {
	const generateUploadUrl = useMutation(api.files.generateUploadUrl);
	const updateProfile = useMutation(api.users.updateProfile);
	const updateProfileImage = useMutation(api.users.updateProfileImage);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [draft, setDraft] = useState<ProfileDraft>(createProfileDraft(user));
	const [isSaving, setIsSaving] = useState(false);
	const [isUploadingImage, setIsUploadingImage] = useState(false);

	useEffect(() => {
		setDraft(createProfileDraft(user));
	}, [user]);

	const isLoading = user === undefined;
	const isDisabled = isLoading || !user || isSaving || isUploadingImage;
	const hasChanges = !!user && hasProfileChanges(draft, user);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!user) {
			return;
		}

		setIsSaving(true);

		try {
			await updateProfile(draft);
			toast.success("Profile updated");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update profile",
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		if (!file.type.startsWith("image/")) {
			toast.error("Choose an image file");
			event.target.value = "";
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			toast.error("Profile images must be 5 MB or smaller");
			event.target.value = "";
			return;
		}

		setIsUploadingImage(true);

		try {
			const uploadUrl = await generateUploadUrl();
			const response = await fetch(uploadUrl, {
				body: file,
				headers: file.type ? { "Content-Type": file.type } : undefined,
				method: "POST",
			});

			if (!response.ok) {
				throw new Error("Upload failed");
			}

			const { storageId } = (await response.json()) as {
				storageId?: Id<"_storage">;
			};
			if (!storageId) {
				throw new Error("Upload failed");
			}

			await updateProfileImage({ storageId });
			toast.success("Profile picture updated");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update profile picture",
			);
		} finally {
			setIsUploadingImage(false);
			event.target.value = "";
		}
	}

	async function handleRemoveImage() {
		setIsUploadingImage(true);

		try {
			await updateProfileImage({ storageId: null });
			toast.success("Profile picture removed");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove profile picture",
			);
		} finally {
			setIsUploadingImage(false);
		}
	}

	return (
		<div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
			<Card className="border-border/70">
				<CardHeader className="gap-3 border-b border-border/70 bg-card/70">
					<div>
						<p className="text-sm font-medium text-muted-foreground">Profile</p>
						<CardTitle className="mt-2 text-3xl">
							Public identity scaffold
						</CardTitle>
					</div>
					<CardDescription className="max-w-2xl text-sm leading-6">
						This starter page gives authenticated users a place to manage the
						basics that usually feed an avatar menu, author byline, or member
						directory.
					</CardDescription>
				</CardHeader>
				<CardContent className="p-6">
					<form className="space-y-6" onSubmit={handleSubmit}>
						<div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-center gap-4">
								<Avatar className="size-20 border border-border/70" size="lg">
									<AvatarImage
										alt={draft.name.trim() || user?.email || "Profile picture"}
										src={user?.image ?? undefined}
									/>
									<AvatarFallback>
										{getInitials(draft.name || user?.email)}
									</AvatarFallback>
								</Avatar>
								<div className="space-y-1">
									<p className="font-medium text-foreground">Profile picture</p>
									<p className="text-sm text-muted-foreground">
										Upload a square image for the cleanest result. PNG, JPG, or
										WebP up to 5 MB.
									</p>
								</div>
							</div>
							<div className="flex flex-wrap gap-3">
								<input
									accept="image/*"
									className="hidden"
									disabled={isDisabled}
									onChange={handleImageChange}
									ref={fileInputRef}
									type="file"
								/>
								<Button
									disabled={isDisabled}
									onClick={() => fileInputRef.current?.click()}
									type="button"
									variant="outline"
								>
									<Camera className="size-4" />
									<span>
										{isUploadingImage
											? "Uploading…"
											: user?.image
												? "Change photo"
												: "Upload photo"}
									</span>
								</Button>
								<Button
									disabled={isDisabled || !user?.image}
									onClick={handleRemoveImage}
									type="button"
									variant="ghost"
								>
									<Trash2 className="size-4" />
									<span>Remove</span>
								</Button>
							</div>
						</div>
						<FieldGroup>
							<Field>
								<FieldContent>
									<FieldLabel htmlFor="profile-name">Name</FieldLabel>
									<Input
										autoComplete="name"
										disabled={isDisabled}
										id="profile-name"
										maxLength={80}
										onChange={(event) =>
											setDraft((currentDraft) => ({
												...currentDraft,
												name: event.target.value,
											}))
										}
										placeholder="A readable display name"
										value={draft.name}
									/>
									<FieldDescription>
										Shown anywhere the app needs a human-readable name.
									</FieldDescription>
								</FieldContent>
							</Field>
							<Field>
								<FieldContent>
									<FieldLabel htmlFor="profile-username">Username</FieldLabel>
									<Input
										autoCapitalize="none"
										autoComplete="username"
										disabled={isDisabled}
										id="profile-username"
										maxLength={32}
										onChange={(event) =>
											setDraft((currentDraft) => ({
												...currentDraft,
												username: event.target.value,
											}))
										}
										placeholder="handle"
										value={draft.username}
									/>
									<FieldDescription>
										Lowercased on save. Use letters, numbers, hyphens, or
										underscores.
									</FieldDescription>
								</FieldContent>
							</Field>
							<Field>
								<FieldContent>
									<FieldLabel htmlFor="profile-bio">Bio</FieldLabel>
									<Textarea
										disabled={isDisabled}
										id="profile-bio"
										maxLength={280}
										onChange={(event) =>
											setDraft((currentDraft) => ({
												...currentDraft,
												bio: event.target.value,
											}))
										}
										placeholder="A short summary about the person behind this account."
										rows={5}
										value={draft.bio}
									/>
									<div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
										<FieldDescription>
											Keep it short. This is the copy most templates surface
											near an avatar or profile header.
										</FieldDescription>
										<span>{draft.bio.length}/280</span>
									</div>
								</FieldContent>
							</Field>
						</FieldGroup>
						<div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-sm text-muted-foreground">
								{user?.email ?? "Signed in account"}
							</p>
							<div className="flex gap-3">
								<Button
									disabled={isDisabled || !hasChanges}
									onClick={() => setDraft(createProfileDraft(user))}
									type="button"
									variant="outline"
								>
									Reset
								</Button>
								<Button disabled={isDisabled || !hasChanges} type="submit">
									{isSaving ? "Saving…" : "Save profile"}
								</Button>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>
			<div>
				<Card className="border-border/70">
					<CardHeader>
						<CardTitle>Preview</CardTitle>
						<CardDescription>
							A minimal snapshot of how this data reads in product UI.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Avatar className="size-16 border border-border/70" size="lg">
							<AvatarImage
								alt={draft.name.trim() || user?.email || "Profile picture"}
								src={user?.image ?? undefined}
							/>
							<AvatarFallback>
								{getInitials(draft.name || user?.email)}
							</AvatarFallback>
						</Avatar>
						<div className="space-y-1">
							<p className="text-lg font-semibold text-foreground">
								{draft.name.trim() || "Unnamed user"}
							</p>
							<p className="text-sm text-muted-foreground">
								{draft.username.trim()
									? `@${draft.username.trim().toLowerCase()}`
									: "@username"}
							</p>
						</div>
						<p className="text-sm leading-6 text-muted-foreground">
							{draft.bio.trim() ||
								"A short bio helps the rest of the template feel less anonymous."}
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function createProfileDraft(user: ProfileUser): ProfileDraft {
	return {
		bio: user?.bio ?? "",
		name: user?.name ?? "",
		username: user?.username ?? "",
	};
}

function hasProfileChanges(
	draft: ProfileDraft,
	user: Exclude<ProfileUser, undefined | null>,
) {
	return (
		draft.name.trim() !== (user.name ?? "") ||
		draft.username.trim() !== (user.username ?? "") ||
		draft.bio.trim() !== (user.bio ?? "")
	);
}

function getInitials(value: string | undefined) {
	if (!value) {
		return "U";
	}

	const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

	if (!parts.length) {
		return "U";
	}

	return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
