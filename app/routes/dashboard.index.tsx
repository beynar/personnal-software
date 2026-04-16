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
	staticData: {
		dashboardHeader: {
			description: "Starter workspace with a persistent shell and nested pages",
			title: "Overview",
		},
	},
	loader: async ({ context }) => {
		// Reference SSR path for new features:
		// route loader -> context.getOrpc() -> oRPC capability -> backend logic.
		// Do not self-fetch /api/v1/* from loaders when the request is already on
		// the server. Add client-side Convex hooks separately only if the page
		// needs live updates after first paint.
		const orpc = context.getOrpc();

		return orpc.examples.workflow({
			params: { exampleId: "starter" },
			query: {
				q: "dashboard",
				limit: 3,
				dryRun: true,
				channel: "email",
			},
			body: {
				message: "Dashboard shell boot preview",
				priority: "normal",
			},
		});
	},
	component: DashboardOverviewPage,
});

function DashboardOverviewPage() {
	const workflowPreview = Route.useLoaderData();

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
						<div className="rounded-xl bg-muted/60 p-4">
							<p className="font-medium">oRPC loader preview</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{workflowPreview.message}
							</p>
							<p className="mt-2 text-xs text-muted-foreground">
								{workflowPreview.preview.join(" • ")}
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
