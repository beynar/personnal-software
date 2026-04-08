"use client";

import { Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/utils";
import { CreateOrganizationDialog } from "./create-organization-dialog";

export function OrganizationSwitcher() {
	const { data: activeOrganization, isPending: loadingActiveOrganization } =
		authClient.useActiveOrganization();
	const { data: organizations, isPending: loadingOrganizations } =
		authClient.useListOrganizations();
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [error, setError] = useState("");
	const [open, setOpen] = useState(false);
	const [switchingOrganizationId, setSwitchingOrganizationId] = useState<
		string | null
	>(null);
	const currentOrganization = activeOrganization ?? organizations?.[0] ?? null;

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
				<PopoverTrigger asChild>
					<Button
						className="h-11 w-full justify-between rounded-xl border border-border/60 bg-sidebar-accent/50 px-3 text-left text-sidebar-accent-foreground shadow-none hover:bg-sidebar-accent/70"
						variant="ghost"
					>
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold tracking-tight">
								{loadingActiveOrganization || loadingOrganizations
									? "Loading..."
									: (currentOrganization?.name ?? "Choose workspace")}
							</p>
						</div>
						<ChevronDown className="size-4 shrink-0 text-sidebar-accent-foreground/70" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="w-[21rem] rounded-2xl border-border/60 p-0 shadow-2xl"
					side="right"
					sideOffset={12}
				>
					<div className="space-y-2 p-3">
						{loadingOrganizations ? (
							<div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
								<Loader2 className="mr-2 size-4 animate-spin" />
								Loading organizations
							</div>
						) : organizations?.length ? (
							organizations.map((organization) => {
								const isActive = organization.id === activeOrganization?.id;
								const isSwitching = switchingOrganizationId === organization.id;

								return (
									<button
										className={cn(
											"flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
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
										<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold text-foreground">
											{organization.name.slice(0, 2).toUpperCase()}
										</div>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium">
												{organization.name}
											</p>
										</div>
										<div className="flex shrink-0 items-center justify-center">
											{isSwitching ? (
												<Loader2 className="size-4 animate-spin text-muted-foreground" />
											) : isActive ? (
												<Check className="size-4 text-primary" />
											) : null}
										</div>
									</button>
								);
							})
						) : (
							<div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center">
								<p className="text-sm font-medium">No organizations yet</p>
								<p className="mt-1 text-sm text-muted-foreground">
									Create your first organization to start collaborating.
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
