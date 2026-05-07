import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { PaginationControls } from "~/components/ui/pagination";
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
import { cn } from "~/lib/utils";
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
type ProductPage = {
	rows: ProductRow[];
	page: number;
	pageSize: number;
	totalCount: number;
	totalPages: number;
	startIndex: number;
	endIndex: number;
	hasPreviousPage: boolean;
	hasNextPage: boolean;
};
type CachedProductPage = {
	filterKey: string;
	page: ProductPage;
};
type ProductFilterKeyInput = {
	category: CategoryFilter;
	search: string | undefined;
	status: ProductStatusFilter;
	type: ProductTypeFilter;
	zone: ZoneFilter;
};

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

function getProductFilterKey({
	category,
	search,
	status,
	type,
	zone,
}: ProductFilterKeyInput) {
	return [search ?? "", zone, category, type, status].join("\u0000");
}

function getOptimisticProductPage(
	page: ProductPage,
	targetPage: number,
	targetPageSize: number,
): ProductPage {
	const totalPages = Math.max(1, Math.ceil(page.totalCount / targetPageSize));
	const boundedPage = Math.min(Math.max(0, targetPage), totalPages - 1);
	const startOffset = boundedPage * targetPageSize;
	const rowsOnPage = Math.min(
		targetPageSize,
		Math.max(0, page.totalCount - startOffset),
	);
	const startIndex = page.totalCount === 0 ? 0 : startOffset + 1;
	const endIndex = startOffset + rowsOnPage;

	return {
		...page,
		endIndex,
		hasNextPage: endIndex < page.totalCount,
		hasPreviousPage: boundedPage > 0,
		page: boundedPage,
		pageSize: targetPageSize,
		startIndex,
		totalPages,
	};
}

function ProductsPage() {
	const navigate = useNavigate();
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const [search, setSearch] = useState("");
	const [zone, setZone] = useState<ZoneFilter>("all");
	const [category, setCategory] = useState<CategoryFilter>("all");
	const [type, setType] = useState<ProductTypeFilter>("all");
	const [status, setStatus] = useState<ProductStatusFilter>("all");
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(50);
	const searchQuery = search.trim() || undefined;
	const filterKey = getProductFilterKey({
		category,
		search: searchQuery,
		status,
		type,
		zone,
	});
	const productsPage = useQuery(
		api.products.listProductsPage,
		isAuthenticated
			? {
					category,
					page,
					pageSize,
					search: searchQuery,
					status,
					type,
					zone,
				}
			: "skip",
	) as ProductPage | undefined;
	const [lastResolvedPage, setLastResolvedPage] =
		useState<CachedProductPage | null>(null);
	useEffect(() => {
		if (productsPage === undefined) return;
		setLastResolvedPage({ filterKey, page: productsPage });
	}, [filterKey, productsPage]);
	const cachedPage =
		isAuthenticated && lastResolvedPage?.filterKey === filterKey
			? lastResolvedPage.page
			: undefined;
	const displayedPage = productsPage ?? cachedPage;
	const footerPage =
		productsPage ??
		(cachedPage
			? getOptimisticProductPage(cachedPage, page, pageSize)
			: undefined);
	const rows = displayedPage?.rows ?? [];
	const isInitialLoading = isAuthLoading || displayedPage === undefined;

	function resetPage() {
		setPage(0);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
			<div className="shrink-0 space-y-3">
				<div className="relative">
					<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
					<Input
						aria-label="Rechercher des produits"
						className="pl-9"
						onChange={(event) => {
							setSearch(event.target.value);
							resetPage();
						}}
						placeholder="Rechercher un nom ou une référence"
						value={search}
					/>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<FilterSelect
						label="Zone"
						options={zoneFilterOptions}
						value={zone}
						onChange={(value) => {
							setZone(value as ZoneFilter);
							resetPage();
						}}
					/>
					<FilterSelect
						label="Type"
						options={typeFilterOptions}
						value={type}
						onChange={(value) => {
							setType(value as ProductTypeFilter);
							resetPage();
						}}
					/>
					<FilterSelect
						label="État"
						options={statusFilterOptions}
						value={status}
						onChange={(value) => {
							setStatus(value as ProductStatusFilter);
							resetPage();
						}}
					/>
					<FilterSelect
						label="Catégorie"
						options={categoryFilterOptions}
						value={category}
						onChange={(value) => {
							setCategory(value as CategoryFilter);
							resetPage();
						}}
					/>
				</div>
			</div>

			<div className="relative min-h-0 flex-1 overflow-hidden pb-28 md:pb-16">
				<Card className="max-h-full overflow-auto overscroll-contain border-border/70">
					<CardContent className="p-0">
						{isInitialLoading ? (
							<ProductsTableSkeleton />
						) : (
							<>
								<Table containerClassName="contents">
									<ProductTableHeader />
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
													if (event.key !== "Enter" && event.key !== " ")
														return;
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
							</>
						)}
					</CardContent>
				</Card>
				<div className="absolute inset-x-0 bottom-0">
					{isInitialLoading ? (
						<PaginationFooterSkeleton />
					) : (
						<PaginationFooter
							onPageChange={setPage}
							onNext={() => setPage((currentPage) => currentPage + 1)}
							onPageSizeChange={(nextPageSize) => {
								setPageSize(nextPageSize);
								resetPage();
							}}
							onPrevious={() =>
								setPage((currentPage) => Math.max(0, currentPage - 1))
							}
							page={footerPage}
						/>
					)}
				</div>
			</div>
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

function ProductTableHeader() {
	return (
		<TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
			<TableRow>
				<TableHead className="w-12">
					<span className="sr-only">État</span>
				</TableHead>
				<TableHead className="bg-card">Produit</TableHead>
				<TableHead className="bg-card">Zone</TableHead>
				<TableHead className="bg-card">Catégorie</TableHead>
				<TableHead className="bg-card">Type</TableHead>
				<TableHead className="bg-card">Poids</TableHead>
				<TableHead className="bg-card">Prix TTC / HT</TableHead>
				<TableHead className="bg-card">Éco TTC / HT</TableHead>
				<TableHead className="bg-card">Données</TableHead>
			</TableRow>
		</TableHeader>
	);
}

function ProductRangeText({ page }: { page: ProductPage | undefined }) {
	const visibleRange =
		page && page.totalCount > 0
			? `${page.startIndex}-${page.endIndex} sur ${page.totalCount}`
			: "0";
	return (
		<p className="text-muted-foreground">
			<span className="font-medium text-foreground">{visibleRange}</span>{" "}
			produit
			{page?.totalCount === 1 ? "" : "s"} affiché
			{page?.totalCount === 1 ? "" : "s"}
		</p>
	);
}

function PageSizeSelect({
	onPageSizeChange,
	pageSize,
}: {
	onPageSizeChange: (pageSize: number) => void;
	pageSize: number;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-muted-foreground">Produits par page</span>
			<Select
				onValueChange={(value) => onPageSizeChange(Number(value))}
				value={String(pageSize)}
			>
				<SelectTrigger className="h-8 w-20">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{pageSizeOptions.map((option) => (
						<SelectItem key={option} value={String(option)}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function PaginationFooter({
	className,
	onPageChange,
	onNext,
	onPageSizeChange,
	onPrevious,
	page,
}: {
	className?: string;
	onPageChange: (page: number) => void;
	onNext: () => void;
	onPageSizeChange: (pageSize: number) => void;
	onPrevious: () => void;
	page: ProductPage | undefined;
}) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm",
				className,
			)}
		>
			<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
				<ProductRangeText page={page} />
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<PageSizeSelect
					onPageSizeChange={onPageSizeChange}
					pageSize={page?.pageSize ?? 50}
				/>
				<PaginationControls
					hasNextPage={page?.hasNextPage}
					hasPreviousPage={page?.hasPreviousPage}
					onNext={onNext}
					onPageChange={onPageChange}
					onPrevious={onPrevious}
					page={page?.page ?? 0}
					totalPages={page?.totalPages ?? 1}
				/>
			</div>
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
		<div className="relative h-full min-h-0 overflow-hidden pb-28 md:pb-16">
			<Card className="max-h-full overflow-hidden border-border/70">
				<CardContent className="max-h-full p-0">
					<ProductsTableSkeleton />
				</CardContent>
			</Card>
			<div className="absolute inset-x-0 bottom-0">
				<PaginationFooterSkeleton />
			</div>
		</div>
	);
}

function ProductsTableSkeleton() {
	return (
		<div className="max-h-full overflow-hidden" aria-hidden>
			<Table containerClassName="contents">
				<ProductTableHeader />
				<TableBody>
					{skeletonRows.map((row) => (
						<TableRow key={row}>
							<TableCell className="align-middle">
								<Skeleton className="mx-auto size-2.5 rounded-full" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-32" />
								<Skeleton className="mt-1.5 h-3 w-16" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-8" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-24" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-28" />
								<Skeleton className="mt-1.5 h-3 w-20" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-14" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-24" />
								<Skeleton className="mt-1.5 h-3 w-20" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-20" />
								<Skeleton className="mt-1.5 h-3 w-16" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-5 w-16 rounded-full" />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function PaginationFooterSkeleton() {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<Skeleton className="h-4 w-36" />
			<div className="flex items-center gap-3">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-8 w-40" />
			</div>
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

const pageSizeOptions = [10, 25, 50, 100];

const skeletonRows = Array.from({ length: 10 }, (_, index) => index);
