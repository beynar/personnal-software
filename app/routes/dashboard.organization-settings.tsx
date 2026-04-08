import { Link, createFileRoute } from "@tanstack/react-router";
import { Building2, ChevronRight, Settings2 } from "lucide-react";
import { CreateOrganizationDialog } from "~/components/organizations/create-organization-dialog";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/dashboard/organization-settings")({
	component: OrganizationSettingsPage,
});

function OrganizationSettingsPage() {
	const { data: activeOrganization, isPending } =
		authClient.useActiveOrganization();

	if (isPending) {
		return (
			<Card className="border-border/70">
				<CardContent className="p-6">
					<p className="text-sm text-muted-foreground">
						Loading organization settings...
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!activeOrganization) {
		return (
			<div className="space-y-6">
				<Card className="overflow-hidden border-border/70">
					<CardHeader className="gap-3 border-b border-border/70 bg-card/70">
						<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
							<Settings2 className="size-4" />
							Organization settings
						</div>
						<div className="space-y-2">
							<CardTitle className="text-3xl">No active organization</CardTitle>
							<CardDescription className="max-w-2xl text-sm leading-6">
								Create or switch to an organization from the sidebar before
								managing organization settings.
							</CardDescription>
						</div>
					</CardHeader>
					<CardContent className="p-6">
						<div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
							<div className="space-y-1">
								<p className="text-sm font-medium">Need a workspace first?</p>
								<p className="text-sm text-muted-foreground">
									Create one from the organization switcher at the top of the
									sidebar.
								</p>
							</div>
							<Button asChild variant="outline">
								<Link to="/dashboard">
									Back to dashboard
									<ChevronRight className="size-4" />
								</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Card className="overflow-hidden border-border/70">
				<CardHeader className="gap-3 border-b border-border/70 bg-card/70">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<Settings2 className="size-4" />
						Organization settings
					</div>
					<div className="space-y-2">
						<CardTitle className="text-3xl">
							{activeOrganization.name}
						</CardTitle>
						<CardDescription className="max-w-2xl text-sm leading-6">
							This page reflects the organization currently active in the
							sidebar. Use the switcher above to change context or create a new
							organization.
						</CardDescription>
					</div>
				</CardHeader>
				<CardContent className="grid gap-4 p-4 md:grid-cols-2">
					<DetailCard
						label="Organization name"
						value={activeOrganization.name}
					/>
					<DetailCard
						label="Organization slug"
						value={activeOrganization.slug}
					/>
					<DetailCard
						label="Created"
						value={formatCreatedAt(activeOrganization.createdAt)}
					/>
				</CardContent>
			</Card>
			<Card className="border-border/70">
				<CardHeader className="gap-2 border-b border-border/70 bg-card/70">
					<CardTitle className="text-lg">Management</CardTitle>
					<CardDescription>
						Organization switching and creation live in the sidebar switcher so
						the shell stays the single source of truth.
					</CardDescription>
				</CardHeader>
				<CardContent className="p-4">
					<div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-4">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
							<Building2 className="size-4" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium">
								Switch or create organizations
							</p>
							<p className="text-sm text-muted-foreground">
								Open the switcher at the top of the sidebar to change your
								active organization or create another one.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function DetailCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-border/70 bg-background/70 p-4">
			<p className="text-sm font-medium text-muted-foreground">{label}</p>
			<p className="mt-2 text-base font-medium text-foreground">{value}</p>
		</div>
	);
}

function formatCreatedAt(createdAt: Date | string | number | null | undefined) {
	if (!createdAt) {
		return "Unknown";
	}

	return new Intl.DateTimeFormat("en", {
		dateStyle: "long",
	}).format(new Date(createdAt));
}
