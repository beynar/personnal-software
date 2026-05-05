import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import { Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { api } from "../../convex/_generated/api";
import {
	MOLTENI_CATEGORIES,
	ZONES,
	formatEuro,
	getProductTypeLabel,
} from "../../shared/ecomaison/taxonomy";

type ProductRow = {
	_id: string;
	name: string;
	molteniCategory: string;
	zone: string | null;
	type: string;
	isComposition: boolean;
	parentId: string | null;
	parentName?: string | null;
	variantCount: number;
	weightKg: number | null;
	priceHt: number | null;
	tvaRate: number;
	ecoParticipationHt: number | null;
	ecoParticipationTtc: number | null;
	status: string;
	missingFields: string[];
	reference: string | null;
};

type ProductTypeFilter = "all" | "standalone" | "composition" | "module";
type ProductStatusFilter = "all" | "calculated" | "incomplete" | "sold";
type ZoneFilter = "all" | (typeof ZONES)[number];
type CategoryFilter = "all" | (typeof MOLTENI_CATEGORIES)[number];

export const Route = createFileRoute("/dashboard/products/")({
	staticData: {
		dashboardHeader: {
			description: "Rechercher, filtrer et ouvrir les produits du showroom",
			title: "Produits",
		},
	},
	pendingComponent: ProductsSkeleton,
	component: ProductsPage,
});

function ProductsPage() {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [zone, setZone] = useState<ZoneFilter>("all");
	const [category, setCategory] = useState<CategoryFilter>("all");
	const [type, setType] = useState<ProductTypeFilter>("all");
	const [status, setStatus] = useState<ProductStatusFilter>("all");
	const products = usePaginatedQuery(
		api.products.listProductsPaginated,
		{
			category,
			search: search.trim() || undefined,
			status,
			type,
			zone,
		},
		{ initialNumItems: 12 },
	);
	const rows = products.results as ProductRow[];
	const isInitialLoading = products.status === "LoadingFirstPage";

	return (
		<div className="space-y-4">
			<div className="space-y-3">
				<div className="relative">
					<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
					<Input
						aria-label="Rechercher des produits"
						className="pl-9"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Rechercher un nom ou une référence"
						value={search}
					/>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<FilterSelect
						label="Zone"
						options={zoneFilterOptions}
						value={zone}
						onChange={(value) => setZone(value as ZoneFilter)}
					/>
					<FilterSelect
						label="Type"
						options={typeFilterOptions}
						value={type}
						onChange={(value) => setType(value as ProductTypeFilter)}
					/>
					<FilterSelect
						label="État"
						options={statusFilterOptions}
						value={status}
						onChange={(value) => setStatus(value as ProductStatusFilter)}
					/>
					<FilterSelect
						label="Catégorie"
						options={categoryFilterOptions}
						value={category}
						onChange={(value) => setCategory(value as CategoryFilter)}
					/>
				</div>
			</div>

			<Card className="border-border/70">
				<CardContent className="p-0">
					{isInitialLoading ? (
						<ProductsSkeleton />
					) : (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>État</TableHead>
										<TableHead>Produit</TableHead>
										<TableHead>Zone</TableHead>
										<TableHead>Catégorie</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Poids</TableHead>
										<TableHead>Prix TTC / HT</TableHead>
										<TableHead>Éco TTC / HT</TableHead>
										<TableHead>Données</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.map((product) => (
										<TableRow
											className="cursor-pointer"
											key={product._id}
											onClick={() =>
												void navigate({
													params: { productId: product._id },
													to: "/dashboard/products/$productId",
													viewTransition: true,
												})
											}
											onKeyDown={(event) => {
												if (event.key !== "Enter" && event.key !== " ") return;
												event.preventDefault();
												void navigate({
													params: { productId: product._id },
													to: "/dashboard/products/$productId",
													viewTransition: true,
												});
											}}
											tabIndex={0}
										>
											<TableCell className="align-middle">
												<span
													className={`mx-auto block size-2.5 rounded-full ${dotClass(product.status)}`}
												/>
											</TableCell>
											<TableCell>
												<Link
													className="font-medium hover:underline"
													params={{ productId: product._id }}
													to="/dashboard/products/$productId"
													viewTransition
												>
													{product.name}
												</Link>
												<p className="text-sm text-muted-foreground">
													{product.variantCount} variante
													{product.variantCount > 1 ? "s" : ""}
												</p>
											</TableCell>
											<TableCell>{product.zone ?? "-"}</TableCell>
											<TableCell>{product.molteniCategory}</TableCell>
											<TableCell>
												{getProductTypeLabel({
													isComposition: product.isComposition,
													parentId: product.parentId,
												})}
												{product.parentName ? (
													<p className="text-xs text-muted-foreground">
														{product.parentName}
													</p>
												) : null}
											</TableCell>
											<TableCell>
												{product.weightKg === null
													? "-"
													: `${product.weightKg} kg`}
											</TableCell>
											<TableCell>
												<MoneyPair
													ht={product.priceHt}
													ttc={calculateTtc(product.priceHt, product.tvaRate)}
												/>
											</TableCell>
											<TableCell>
												<MoneyPair
													ht={product.ecoParticipationHt}
													ttc={product.ecoParticipationTtc}
												/>
											</TableCell>
											<TableCell>
												<StatusBadge product={product} />
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
							{rows.length === 0 ? (
								<p className="px-4 py-8 text-center text-muted-foreground">
									Aucun produit ne correspond aux filtres.
								</p>
							) : null}
							<PaginationFooter products={products} rowCount={rows.length} />
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function MoneyPair({
	ht,
	ttc,
}: {
	ht: number | null;
	ttc: number | null;
}) {
	return (
		<div className="space-y-0.5 whitespace-nowrap">
			<p>{formatEuro(ttc)} TTC</p>
			<p className="text-muted-foreground text-xs">{formatEuro(ht)} HT</p>
		</div>
	);
}

function calculateTtc(valueHt: number | null, tvaRate: number) {
	if (valueHt === null) return null;
	return valueHt * (1 + tvaRate);
}

function PaginationFooter({
	products,
	rowCount,
}: {
	products: ReturnType<typeof usePaginatedQuery>;
	rowCount: number;
}) {
	return (
		<div className="flex items-center justify-between border-t px-4 py-3 text-sm">
			<p className="text-muted-foreground">
				{rowCount} produit{rowCount > 1 ? "s" : ""} chargé
				{rowCount > 1 ? "s" : ""}
			</p>
			{products.status === "CanLoadMore" ? (
				<Button
					onClick={() => products.loadMore(12)}
					type="button"
					variant="outline"
				>
					Charger plus
				</Button>
			) : null}
			{products.status === "LoadingMore" ? (
				<Button disabled type="button" variant="outline">
					Chargement...
				</Button>
			) : null}
		</div>
	);
}

function FilterSelect({
	label,
	onChange,
	options,
	value,
}: {
	label: string;
	onChange: (value: string) => void;
	options: FilterOption[];
	value: string;
}) {
	return (
		<div className="space-y-2">
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</p>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function StatusBadge({ product }: { product: ProductRow }) {
	if (product.status === "sold") return <Badge variant="outline">Vendu</Badge>;
	if (product.status === "calculated") return <Badge>Calculé</Badge>;
	if (product.missingFields.includes("weight")) {
		return <Badge variant="secondary">Poids manquant</Badge>;
	}
	if (product.missingFields.includes("material")) {
		return <Badge variant="secondary">Matière manquante</Badge>;
	}
	return <Badge variant="secondary">Incomplet</Badge>;
}

function dotClass(status: string) {
	if (status === "calculated") return "bg-emerald-500";
	if (status === "sold") return "bg-muted-foreground";
	return "bg-amber-500";
}

function ProductsSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-96 w-full" />
		</div>
	);
}

type FilterOption = {
	value: string;
	label: string;
};

const zoneFilterOptions: FilterOption[] = [
	{ value: "all", label: "Toutes les zones" },
	...ZONES.map((zone) => ({
		value: zone,
		label: `Zone ${zone}`,
	})),
];

const typeFilterOptions: FilterOption[] = [
	{ value: "all", label: "Tous les types" },
	{ value: "standalone", label: "Produit simple" },
	{ value: "composition", label: "Composition" },
	{ value: "module", label: "Module" },
];

const statusFilterOptions: FilterOption[] = [
	{ value: "all", label: "Tous les états" },
	{ value: "calculated", label: "Calculé" },
	{ value: "incomplete", label: "Incomplet" },
	{ value: "sold", label: "Vendu" },
];

const categoryFilterOptions: FilterOption[] = [
	{ value: "all", label: "Toutes les catégories" },
	...MOLTENI_CATEGORIES.map((category) => ({
		value: category,
		label: category,
	})),
];
