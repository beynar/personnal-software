import { Link, createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	Package,
	Scale,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";

type DashboardData = {
	stats: {
		totalProducts: number;
		calculated: number;
		calculatedPercent: number;
		missingWeight: number;
		missingMaterial: number;
	};
	byCategory: Array<{
		category: string;
		total: number;
		calculated: number;
		percent: number;
	}>;
	attention: Array<{
		_id: string;
		name: string;
		zone?: string | null;
		molteniCategory: string;
		missingFields: string[];
	}>;
};

export const Route = createFileRoute("/dashboard/")({
	staticData: {
		dashboardHeader: {
			description: "Complétude et calculs du showroom de Lyon",
			title: "Tableau de bord inventaire",
		},
	},
	loader: async ({ context }) => {
		const orpc = context.getOrpc();
		return await orpc.molteni.dashboard();
	},
	pendingComponent: DashboardSkeleton,
	component: DashboardOverviewPage,
});

function DashboardOverviewPage() {
	const data = Route.useLoaderData() as DashboardData;
	const stats = data.stats;
	const cards = [
		{
			label: "Produits",
			value: stats.totalProducts,
			progress: 100,
			icon: Package,
			help: "Fiches actives du showroom",
		},
		{
			label: "Calculés",
			value: `${stats.calculated} / ${stats.totalProducts}`,
			progress: stats.calculatedPercent,
			icon: CheckCircle2,
			help: `${stats.calculatedPercent}% prêts pour les étiquettes`,
		},
		{
			label: "Poids manquant",
			value: stats.missingWeight,
			progress: completion(stats.missingWeight, stats.totalProducts),
			icon: Scale,
			help: "Produits bloqués par un poids manquant",
		},
		{
			label: "Matière manquante",
			value: stats.missingMaterial,
			progress: completion(stats.missingMaterial, stats.totalProducts),
			icon: AlertTriangle,
			help: "Requise pour Meuble et siège sans rembourrage",
		},
	];

	return (
		<div className="space-y-6">
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{cards.map((card) => (
					<Card className="border-border/70" key={card.label}>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between gap-3">
								<CardDescription>{card.label}</CardDescription>
								<div className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
									<card.icon className="size-4" />
								</div>
							</div>
							<CardTitle className="text-3xl">{card.value}</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<Progress value={card.progress} />
							<p className="text-sm text-muted-foreground">{card.help}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<Card className="border-border/70">
					<CardHeader>
						<CardTitle>Complétude par catégorie</CardTitle>
						<CardDescription>
							La progression utilise les produits avec éco-participation
							calculée.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Catégorie</TableHead>
									<TableHead className="text-right">Prêts</TableHead>
									<TableHead className="w-[180px]">Progression</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.byCategory.map((row) => (
									<TableRow key={row.category}>
										<TableCell className="font-medium">
											{row.category}
										</TableCell>
										<TableCell className="text-right">
											{row.calculated} / {row.total}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-3">
												<Progress value={row.percent} />
												<span className="w-9 text-right text-sm text-muted-foreground">
													{row.percent}%
												</span>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card className="border-border/70">
					<CardHeader className="flex-row items-center justify-between gap-4">
						<div>
							<CardTitle>À compléter</CardTitle>
							<CardDescription>
								Produits incomplets triés par donnée bloquante.
							</CardDescription>
						</div>
						<Button asChild variant="outline">
							<Link to="/dashboard/products" viewTransition>
								Tout voir
								<ArrowRight className="size-4" />
							</Link>
						</Button>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Produit</TableHead>
									<TableHead>Zone</TableHead>
									<TableHead>Manquant</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.attention.map((row) => (
									<TableRow key={row._id}>
										<TableCell>
											<Link
												className="font-medium hover:underline"
												params={{ productId: row._id }}
												to="/dashboard/products/$productId"
												viewTransition
											>
												{row.name}
											</Link>
											<p className="text-sm text-muted-foreground">
												{row.molteniCategory}
											</p>
										</TableCell>
										<TableCell>{row.zone ?? "-"}</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-1.5">
												{row.missingFields.map((field) => (
													<Badge key={field} variant="secondary">
														{fieldLabel(field)}
													</Badge>
												))}
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function DashboardSkeleton() {
	const skeletonCards = ["total", "calculated", "weight", "material"];

	return (
		<div className="space-y-6">
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{skeletonCards.map((card) => (
					<Card className="border-border/70" key={card}>
						<CardHeader>
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-9 w-20" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-2 w-full" />
						</CardContent>
					</Card>
				))}
			</div>
			<Skeleton className="h-80 w-full" />
		</div>
	);
}

function completion(missing: number, total: number) {
	if (total === 0) return 0;
	return Math.round(((total - missing) / total) * 100);
}

function fieldLabel(field: string) {
	if (field === "weight") return "Poids";
	if (field === "material") return "Matériau";
	return "Barème";
}
