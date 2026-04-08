import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	ArrowRight,
	Cloud,
	Database,
	Layers3,
	UserRound,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";

const overviewCards = [
	{
		title: "Convex auth",
		description:
			"Authentication stays reactive at the layout boundary, so nested pages inherit the session.",
		icon: Activity,
	},
	{
		title: "Cloudflare deploy",
		description:
			"The worker deploy path remains isolated from what the end user sees in the dashboard.",
		icon: Cloud,
	},
	{
		title: "Design system",
		description:
			"Use the nested page to inspect the current UI primitives available in the template.",
		icon: Layers3,
	},
	{
		title: "Profile scaffold",
		description:
			"Authenticated users now get a starter settings page for name, username, and bio.",
		icon: UserRound,
	},
] as const;

export const Route = createFileRoute("/dashboard/")({
	component: DashboardOverviewPage,
});

function DashboardOverviewPage() {
	return (
		<div className="space-y-6">
			<Card className="overflow-hidden border-border/70">
				<CardHeader className="gap-3 border-b border-border/70 bg-card/70">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<Database className="size-4" />
						Overview
					</div>
					<CardTitle className="text-3xl">A nested dashboard shell</CardTitle>
					<CardDescription className="max-w-2xl text-sm leading-6">
						The sidebar now belongs to the dashboard layout itself. Moving
						between nested pages keeps the navigation in place and makes the app
						feel like one workspace instead of a set of unrelated screens.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
					{overviewCards.map((card) => (
						<div
							className="rounded-2xl border border-border/70 bg-background/70 p-4"
							key={card.title}
						>
							<div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
								<card.icon className="size-4" />
							</div>
							<p className="mt-4 font-medium">{card.title}</p>
							<p className="mt-1 text-sm leading-6 text-muted-foreground">
								{card.description}
							</p>
						</div>
					))}
				</CardContent>
			</Card>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
				<Card className="border-border/70">
					<CardHeader>
						<CardTitle>Navigation test</CardTitle>
						<CardDescription>
							Use the sidebar to move to the nested design system page and
							confirm that the shell stays mounted.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3 text-sm text-muted-foreground">
						<div className="rounded-xl border border-border/70 bg-background/70 p-4">
							<p className="font-medium text-foreground">1. Overview</p>
							<p className="mt-1">
								This page explains the shell and confirms the dashboard route is
								now a layout.
							</p>
						</div>
						<div className="rounded-xl border border-border/70 bg-background/70 p-4">
							<p className="font-medium text-foreground">2. Design System</p>
							<p className="mt-1">
								The nested showcase page renders the current UI primitives
								available in the template.
							</p>
						</div>
						<div className="rounded-xl border border-border/70 bg-background/70 p-4">
							<p className="font-medium text-foreground">3. Profile</p>
							<p className="mt-1">
								Use the profile page as a starter settings surface for
								user-owned account data.
							</p>
						</div>
					</CardContent>
				</Card>
				<Card className="border-border/70">
					<CardHeader>
						<CardTitle>What changed</CardTitle>
						<CardDescription>
							User-facing navigation is now separate from the code examples kept
							in the repository.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="rounded-xl bg-muted/60 p-4">
							<p className="font-medium">Sidebar cleanup</p>
							<p className="mt-1 text-sm text-muted-foreground">
								The footer stays readable when collapsed and no longer exposes
								LLM-only guidance in user land.
							</p>
						</div>
						<div className="rounded-xl bg-muted/60 p-4">
							<p className="font-medium">Nested structure</p>
							<p className="mt-1 text-sm text-muted-foreground">
								The dashboard now ships with overview, profile, and design
								system child pages under one persistent shell.
							</p>
						</div>
						<div className="flex items-center gap-2 text-sm font-medium text-foreground">
							<ArrowRight className="size-4" />
							Head to “Profile” or “Design System” in the sidebar.
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
