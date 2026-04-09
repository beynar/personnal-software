"use client";

import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/utils";
import { CreateOrganizationDialog } from "./create-organization-dialog";

export function OrganizationSwitcher({
	isCollapsed = false,
}: {
	isCollapsed?: boolean;
}) {
	const { data: activeOrganization, isPending: loadingActiveOrganization } =
		authClient.useActiveOrganization();
	const { data: organizations, isPending: loadingOrganizations } =
		authClient.useListOrganizations();
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [error, setError] = useState("");
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [switchingOrganizationId, setSwitchingOrganizationId] = useState<
		string | null
	>(null);
	const currentOrganization = activeOrganization ?? null;
	const filteredOrganizations = useMemo(() => {
		if (!organizations?.length) {
			return [];
		}

		const query = search.trim().toLowerCase();
		if (!query) {
			return organizations;
		}

		return organizations.filter((organization) =>
			organization.name.toLowerCase().includes(query),
		);
	}, [organizations, search]);

	async function handleSwitchOrganization(organizationId: string) {
		if (organizationId === activeOrganization?.id) {
			setOpen(false);
			return;
		}

		setError("");
		setSwitchingOrganizationId(organizationId);
		const { error: setActiveError } = await authClient.organization.setActive({
			organizationId,
		});
		setSwitchingOrganizationId(null);

		if (setActiveError) {
			setError(setActiveError.message ?? "Failed to switch organization");
			return;
		}

		setOpen(false);
	}

	return (
		<>
			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger asChild className="p-1! flex justify-center gap-0!">
					{loadingActiveOrganization || loadingOrganizations ? (
						<OrganizationSwitcherSkeleton isCollapsed={isCollapsed} />
					) : (
						<Button
							className="h-11 w-full justify-between rounded-xl border border-border/60 bg-sidebar-accent/50 px-2 text-left text-sidebar-accent-foreground shadow-none hover:bg-sidebar-accent/70"
							variant="ghost"
						>
							<div
								className={`flex min-w-0 items-center ${isCollapsed ? "w-full justify-center gap-0" : "gap-3"}`}
							>
								<Avatar className="size-8 border border-sidebar-border/70 bg-sidebar-accent">
									<AvatarImage
										alt={currentOrganization?.name ?? "Organization"}
										src={currentOrganization?.logo ?? undefined}
									/>
									<AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
										{getInitials(currentOrganization?.name)}
									</AvatarFallback>
								</Avatar>
								{isCollapsed ? null : (
									<p className="truncate text-sm font-semibold tracking-tight">
										{currentOrganization?.name ?? "Choose workspace"}
									</p>
								)}
							</div>
							{isCollapsed ? null : (
								<ChevronDown className="size-4 shrink-0 text-sidebar-accent-foreground/70" />
							)}
						</Button>
					)}
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="w-[20rem] rounded-2xl border-border/60 p-0 shadow-2xl"
					side="right"
					sideOffset={12}
				>
					<div className="space-y-3 border-b border-border/60 p-3">
						<div className="relative">
							<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								className="h-9 border-0 bg-transparent px-3 pl-9 shadow-none focus-visible:border-0 focus-visible:ring-0"
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Search organizations"
								value={search}
							/>
						</div>
					</div>
					<div className="p-3 pt-2">
						{loadingOrganizations ? (
							<div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
								<Loader2 className="mr-2 size-4 animate-spin" />
								Loading organizations
							</div>
						) : filteredOrganizations.length ? (
							<ScrollArea className="max-h-72 pr-2">
								<div className="space-y-1.5">
									{filteredOrganizations.map((organization) => {
										const isActive = organization.id === activeOrganization?.id;
										const isSwitching =
											switchingOrganizationId === organization.id;

										return (
											<button
												className={cn(
													"flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
													isActive
														? "border-primary/25 bg-primary/5"
														: "border-border/60 bg-background hover:bg-accent/40",
												)}
												key={organization.id}
												onClick={() =>
													void handleSwitchOrganization(organization.id)
												}
												type="button"
											>
												<Avatar className="size-8 shrink-0 border border-border/70">
													<AvatarImage
														alt={organization.name}
														src={organization.logo ?? undefined}
													/>
													<AvatarFallback>
														{getInitials(organization.name)}
													</AvatarFallback>
												</Avatar>
												<div className="min-w-0 flex-1">
													<p className="truncate text-sm font-medium">
														{organization.name}
													</p>
												</div>
												<div className="flex size-4 shrink-0 items-center justify-center">
													{isSwitching ? (
														<Loader2 className="size-4 animate-spin text-muted-foreground" />
													) : isActive ? (
														<Check className="size-4 text-primary" />
													) : null}
												</div>
											</button>
										);
									})}
								</div>
							</ScrollArea>
						) : (
							<div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center">
								<p className="text-sm font-medium">
									{search.trim() ? "No organizations found" : "No organizations yet"}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{search.trim()
										? "Try a different name."
										: "Create your first organization to start collaborating."}
								</p>
							</div>
						)}
						{error ? (
							<p className="px-1 text-sm text-destructive">{error}</p>
						) : null}
					</div>
					<div className="border-t border-border/60 p-3">
						<Button
							className="w-full justify-center rounded-xl border-border/60"
							onClick={() => setCreateDialogOpen(true)}
							type="button"
							variant="outline"
						>
							<Plus className="size-4" />
							Create organization
						</Button>
					</div>
				</PopoverContent>
			</Popover>
			<CreateOrganizationDialog
				onCreated={() => {
					setCreateDialogOpen(false);
					setOpen(false);
				}}
				onOpenChange={setCreateDialogOpen}
				open={createDialogOpen}
			/>
		</>
	);
}

function getInitials(value: string | undefined) {
	if (!value) {
		return "O";
	}

	const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
	if (!parts.length) {
		return "O";
	}

	return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function OrganizationSwitcherSkeleton({
	isCollapsed,
}: {
	isCollapsed: boolean;
}) {
	return (
		<div className="h-11 w-full rounded-xl border border-border/60 bg-sidebar-accent/50 px-2">
			<div className="flex h-full items-center justify-between gap-3">
				<div
					className={cn(
						"flex min-w-0 items-center",
						isCollapsed ? "w-full justify-center gap-0" : "gap-3",
					)}
				>
					<Skeleton className="size-8 shrink-0 rounded-full" />
					{isCollapsed ? null : <Skeleton className="h-4 w-28 rounded-md" />}
				</div>
				{isCollapsed ? null : <Skeleton className="size-4 shrink-0 rounded-sm" />}
			</div>
		</div>
	);
}
