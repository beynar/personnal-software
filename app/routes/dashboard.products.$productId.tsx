import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	Armchair,
	Bed,
	BookOpen,
	Boxes,
	Calculator,
	ChefHat,
	Circle,
	Copy,
	ExternalLink,
	Grid2X2,
	Minus,
	MoreHorizontal,
	Package,
	Pencil,
	Plus,
	Recycle,
	Ruler,
	Save,
	Shirt,
	Sofa,
	Table2,
	Trash2,
	Weight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import { Textarea } from "~/components/ui/textarea";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
	ECOMAISON_FAMILIES,
	type EcomaisonFamily,
	MATERIAL_TIERS,
	MOLTENI_CATEGORIES,
	type MaterialTier,
	type MolteniCategory,
	ZONES,
	formatEuro,
	getDefaultFamily,
	isMaterialRequired,
} from "../../shared/ecomaison/taxonomy";

type ProductDetail = {
	product: ProductRecord;
	parent?: ProductRecord | null;
	variants: ProductVariantRow[];
	baseModule?: ModuleRow | null;
	modules: ModuleRow[];
	totalEcoHt?: number | null;
	totalEcoTtc?: number | null;
};

type ProductRecord = {
	_id: string;
	name: string;
	molteniCategory: string;
	ecomaisonFamily: string;
	materialTier?: string | null;
	zone?: string | null;
	notes?: string | null;
	tvaRate: number;
	hasRecyclingDisruptors?: boolean | null;
	sustainableCertified?: boolean | null;
	evolutionaryDesign?: boolean | null;
	isComposition: boolean;
	moduleKind?: "base" | "component" | null;
	parentId?: string | null;
	soldDate?: string | null;
};

type ProductVariantRow = {
	_id: string;
	variantLabel: string;
	reference?: string | null;
	fabricReference?: string | null;
	priceHt?: number | null;
	weightKg?: number | null;
	widthCm?: number | null;
	textileMode?: string | null;
	ecoParticipationHt?: number | null;
	ecoParticipationTtc?: number | null;
	ecomaisonCode11?: string | null;
	manualEcomaisonCode11?: string | null;
};

type ModuleRow = {
	_id: string;
	name: string;
	molteniCategory: string;
	ecomaisonFamily: string;
	materialTier?: string | null;
	zone?: string | null;
	notes?: string | null;
	tvaRate: number;
	hasRecyclingDisruptors?: boolean | null;
	sustainableCertified?: boolean | null;
	evolutionaryDesign?: boolean | null;
	moduleKind?: "base" | "component" | null;
	type: string;
	reference?: string | null;
	fabricReference?: string | null;
	priceHt?: number | null;
	weightKg?: number | null;
	widthCm?: number | null;
	textileMode?: string | null;
	ecoParticipationHt?: number | null;
	ecoParticipationTtc?: number | null;
	ecomaisonCode11?: string | null;
	manualEcomaisonCode11?: string | null;
	variants?: ProductVariantRow[];
};

type VariantFormState = {
	id?: string;
	productId?: string;
	variantLabel: string;
	reference: string;
	fabricReference: string;
	priceHt: string;
	weightKg: string;
};

type ModuleFormState = {
	id?: string;
	name: string;
	reference: string;
	category: MolteniCategory;
	family: EcomaisonFamily;
	materialTier: MaterialTier;
	weightKg: string;
	priceHt: string;
	notes: string;
	fabricReference?: string;
	widthCm?: number | null;
	textileMode?: string | null;
};

type ProductEditFormState = {
	name: string;
	category: MolteniCategory;
	family: EcomaisonFamily;
	materialTier: MaterialTier;
	zone: "" | (typeof ZONES)[number];
	tvaRate: number;
	notes: string;
	hasRecyclingDisruptors: boolean;
	sustainableCertified: boolean;
	evolutionaryDesign: boolean;
};

type ModuleVariantSelection = Record<
	string,
	{
		quantity: number;
		variantId: string;
	}
>;

export const Route = createFileRoute("/dashboard/products/$productId")({
	loader: async ({ context, params }) => {
		const product = await context.getOrpc().molteni.product({
			params: { productId: params.productId },
		});
		return {
			dashboardHeader: {
				backHref: "/dashboard/products",
				description: product?.product?.molteniCategory ?? "Détail du produit",
				title: product?.product?.name ?? "Produit",
			},
			product,
		};
	},
	pendingComponent: () => <Skeleton className="h-96 w-full" />,
	component: ProductDetailPage,
});

function ProductDetailPage() {
	const data = Route.useLoaderData();
	const detail = data.product as ProductDetail | null;
	const navigate = useNavigate();
	const router = useRouter();
	const createProduct = useMutation(api.products.createProduct);
	const updateProduct = useMutation(api.products.updateProduct);
	const addVariant = useMutation(api.products.addVariant);
	const updateVariant = useMutation(api.products.updateVariant);
	const deleteVariant = useMutation(api.products.deleteVariant);
	const setManualCode = useMutation(api.products.setManualEcomaisonCode);
	const softDeleteProduct = useMutation(api.products.softDeleteProduct);
	const [productDialogOpen, setProductDialogOpen] = useState(false);
	const [productForm, setProductForm] = useState<ProductEditFormState>(() =>
		productEditForm(detail?.product),
	);
	const [variantDialogOpen, setVariantDialogOpen] = useState(false);
	const [variantForm, setVariantForm] = useState<VariantFormState>(
		emptyVariantForm(),
	);
	const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
	const [moduleForm, setModuleForm] = useState<ModuleFormState>(() =>
		emptyModuleForm(detail?.product),
	);
	const [composeDialogOpen, setComposeDialogOpen] = useState(false);
	const [selectedModuleVariants, setSelectedModuleVariants] =
		useState<ModuleVariantSelection>({});
	const [selectedBaseVariantId, setSelectedBaseVariantId] = useState<
		string | null
	>(null);
	const [manualCode, setManualCodeValue] = useState(
		primaryManualCode(detail?.variants[0]) ?? "",
	);

	if (!detail) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Produit introuvable</CardTitle>
				</CardHeader>
			</Card>
		);
	}

	const product = detail.product;
	const baseModule = detail.baseModule ?? null;
	const modules = detail.modules;
	const primaryVariant = detail.variants[0] ?? null;
	const currentCode =
		primaryVariant?.manualEcomaisonCode11 ??
		primaryVariant?.ecomaisonCode11 ??
		"";
	const hasManualCodeChanges =
		manualCode !== (primaryVariant?.manualEcomaisonCode11 ?? "");
	const totalHt = product.isComposition
		? detail.totalEcoHt
		: primaryVariant?.ecoParticipationHt;
	const totalTtc = product.isComposition
		? detail.totalEcoTtc
		: primaryVariant?.ecoParticipationTtc;

	function openNewVariantDialog() {
		setVariantForm(emptyVariantForm(product._id));
		setVariantDialogOpen(true);
	}

	function openNewBaseVariantDialog(module: ModuleRow) {
		setVariantForm(emptyVariantForm(module._id));
		setVariantDialogOpen(true);
	}

	function openProductDialog() {
		setProductForm(productEditForm(product));
		setProductDialogOpen(true);
	}

	async function handleProductSave() {
		if (!productForm.name.trim()) return;
		if (
			!product.isComposition &&
			productForm.hasRecyclingDisruptors &&
			(productForm.sustainableCertified || productForm.evolutionaryDesign)
		) {
			toast.error(
				"Les éco-modulations sont réservées aux produits sans perturbateur.",
			);
			return;
		}
		await updateProduct({
			productId: product._id as Id<"products">,
			name: productForm.name,
			reference: primaryVariant?.reference ?? undefined,
			zone: productForm.zone || undefined,
			molteniCategory: productForm.category,
			ecomaisonFamily: productForm.family,
			materialTier:
				!product.isComposition && isMaterialRequired(productForm.family)
					? productForm.materialTier
					: undefined,
			isComposition: product.isComposition,
			notes: productForm.notes || undefined,
			hasRecyclingDisruptors: product.isComposition
				? undefined
				: productForm.hasRecyclingDisruptors,
			sustainableCertified: product.isComposition
				? undefined
				: productForm.sustainableCertified,
			evolutionaryDesign: product.isComposition
				? undefined
				: productForm.evolutionaryDesign,
			weightKg: primaryVariant?.weightKg ?? undefined,
			widthCm: primaryVariant?.widthCm ?? undefined,
			textileMode: primaryVariant?.textileMode ?? undefined,
			priceHt: primaryVariant?.priceHt ?? undefined,
			fabricReference: primaryVariant?.fabricReference ?? undefined,
			tvaRate: productForm.tvaRate,
		});
		toast.success("Produit mis à jour");
		setProductDialogOpen(false);
		await router.invalidate();
	}

	function openEditVariantDialog(
		variant: ProductVariantRow,
		productId?: string,
	) {
		setVariantForm({
			id: variant._id,
			productId,
			variantLabel: variant.variantLabel,
			reference: variant.reference ?? "",
			fabricReference: variant.fabricReference ?? "",
			priceHt: formatEditableNumber(variant.priceHt),
			weightKg: formatEditableNumber(variant.weightKg),
		});
		setVariantDialogOpen(true);
	}

	async function handleVariantSave() {
		const variantProductId = variantForm.productId ?? product._id;
		if (product.isComposition && !variantForm.productId) return;
		const input = {
			variantLabel: variantForm.variantLabel || "Nouvelle variante",
			reference: variantForm.reference || undefined,
			fabricReference: variantForm.fabricReference || undefined,
			priceHt: parseNumber(variantForm.priceHt) ?? undefined,
			weightKg: parseNumber(variantForm.weightKg) ?? undefined,
		};
		if (variantForm.id) {
			await updateVariant({
				...input,
				variantId: variantForm.id as Id<"productVariants">,
			});
			toast.success("Variante mise à jour");
		} else {
			await addVariant({
				...input,
				productId: variantProductId as Id<"products">,
			});
			toast.success("Variante ajoutée");
		}
		setVariantDialogOpen(false);
		setVariantForm(emptyVariantForm());
		await router.invalidate();
	}

	async function handleVariantDelete(variant: ProductVariantRow) {
		const confirmed = window.confirm("Supprimer cette variante ?");
		if (!confirmed) return;
		await deleteVariant({ variantId: variant._id as Id<"productVariants"> });
		toast.success("Variante supprimée");
		await router.invalidate();
	}

	function openNewModuleDialog() {
		setModuleForm(emptyModuleForm(product));
		setModuleDialogOpen(true);
	}

	function openEditModuleDialog(module: ModuleRow) {
		setModuleForm(moduleEditForm(module));
		setModuleDialogOpen(true);
	}

	async function handleModuleSave() {
		if (!product.isComposition) return;
		const family = moduleForm.family;
		const input = {
			name: moduleForm.name,
			reference: moduleForm.reference || undefined,
			zone: product.zone as (typeof ZONES)[number] | undefined,
			molteniCategory: moduleForm.category,
			ecomaisonFamily: family,
			materialTier: isMaterialRequired(family)
				? moduleForm.materialTier
				: undefined,
			isComposition: false,
			notes: moduleForm.notes || undefined,
			hasRecyclingDisruptors: false,
			sustainableCertified: false,
			evolutionaryDesign: false,
			weightKg: parseNumber(moduleForm.weightKg) ?? undefined,
			priceHt: parseNumber(moduleForm.priceHt) ?? undefined,
			tvaRate: product.tvaRate,
		};
		if (moduleForm.id) {
			await updateProduct({
				...input,
				productId: moduleForm.id as Id<"products">,
				fabricReference: moduleForm.fabricReference || undefined,
				widthCm: moduleForm.widthCm ?? undefined,
				textileMode: moduleForm.textileMode ?? undefined,
			});
			toast.success("Module mis à jour");
		} else {
			await createProduct({
				...input,
				parentId: product._id as Id<"products">,
				moduleKind: "component",
			});
			toast.success("Module ajouté");
		}
		setModuleDialogOpen(false);
		setModuleForm(emptyModuleForm(product));
		await router.invalidate();
	}

	function openComposeDialog() {
		const baseVariant = baseModule ? getModuleVariants(baseModule)[0] : null;
		setSelectedBaseVariantId(baseVariant?._id ?? null);
		setSelectedModuleVariants(getDefaultModuleVariantSelection(modules));
		setComposeDialogOpen(true);
	}

	async function handleManualCodeSave() {
		if (!primaryVariant) return;
		await setManualCode({
			variantId: primaryVariant._id as Id<"productVariants">,
			code: manualCode || null,
		});
		toast.success("Code mis à jour");
		await router.invalidate();
	}

	async function handleDelete() {
		const confirmed = window.confirm(
			"Supprimer ce produit ? Il disparaîtra de l’inventaire actif.",
		);
		if (!confirmed) return;
		await softDeleteProduct({ productId: product._id as Id<"products"> });
		toast.success("Produit supprimé");
		await navigate({
			params: product.parentId ? { productId: product.parentId } : undefined,
			to: product.parentId
				? "/dashboard/products/$productId"
				: "/dashboard/products",
			viewTransition: true,
		});
	}

	async function handleModuleDelete(module: ModuleRow) {
		const confirmed = window.confirm("Supprimer ce module ?");
		if (!confirmed) return;
		await softDeleteProduct({ productId: module._id as Id<"products"> });
		toast.success("Module supprimé");
		await router.invalidate();
	}

	return (
		<div className="space-y-4">
			{detail.parent ? (
				<div className="border border-primary/60 bg-primary/10 p-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-start gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center bg-primary text-primary-foreground">
								<Boxes className="size-5" />
							</div>
							<div>
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
									Ce produit est un module
								</p>
								<p className="font-serif text-2xl leading-tight">
									Rattaché à {detail.parent.name}
								</p>
							</div>
						</div>
						<Button
							onClick={() =>
								navigate({
									params: { productId: detail.parent?._id ?? "" },
									to: "/dashboard/products/$productId",
									viewTransition: true,
								})
							}
							type="button"
							variant="outline"
						>
							Ouvrir la composition
							<ExternalLink className="size-4" />
						</Button>
					</div>
				</div>
			) : null}
			<Card className="border-border/70">
				<CardHeader className="gap-4">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<div className="flex flex-wrap items-center gap-2">
								<CardTitle>{product.name}</CardTitle>
								<Badge variant="secondary">{product.zone ?? "Sans zone"}</Badge>
								<Badge variant="outline">{product.ecomaisonFamily}</Badge>
								{product.isComposition ? (
									<Badge>Composition</Badge>
								) : product.parentId ? (
									<Badge>Module</Badge>
								) : (
									<Badge>Produit simple</Badge>
								)}
							</div>
							<CardDescription className="mt-2">
								{product.notes?.trim() ?? "Informations produit"}
							</CardDescription>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={openProductDialog}
								type="button"
								variant="outline"
							>
								<Pencil className="size-4" />
								Modifier
							</Button>
							<Button
								onClick={handleDelete}
								type="button"
								variant="destructive"
							>
								<Trash2 className="size-4" />
								Supprimer
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<ProductMeta
							icon={categoryIcon(product.molteniCategory)}
							label="Catégorie"
						>
							{product.molteniCategory}
						</ProductMeta>
						<ProductMeta icon={Recycle} label="Famille Ecomaison">
							{product.ecomaisonFamily}
						</ProductMeta>
						<ProductMeta icon={Package} label="Matière">
							{product.materialTier
								? materialTierLabel(product.materialTier)
								: product.isComposition
									? "Définie par module"
									: "Non demandée"}
						</ProductMeta>
						<ProductMeta icon={Circle} label="TVA">
							{Math.round(product.tvaRate * 100)} %
						</ProductMeta>
						<ProductMeta icon={Circle} label="Perturbateurs">
							{product.isComposition
								? "Par module"
								: product.hasRecyclingDisruptors
									? "Oui"
									: "Non"}
						</ProductMeta>
						<ProductMeta icon={Circle} label="FSC / PEFC">
							{product.isComposition
								? "Par module"
								: product.sustainableCertified
									? "Oui"
									: "Non"}
						</ProductMeta>
						<ProductMeta icon={Circle} label="Conception évolutive">
							{product.isComposition
								? "Par module"
								: product.evolutionaryDesign
									? "Oui"
									: "Non"}
						</ProductMeta>
						<ProductMeta icon={Recycle} label="Éco-participation">
							{formatEuro(totalHt)} HT / {formatEuro(totalTtc)} TTC
						</ProductMeta>
					</div>
				</CardContent>
			</Card>

			{product.isComposition ? (
				<div className="space-y-4">
					{baseModule ? (
						<BaseStructureSection
							baseModule={baseModule}
							onAddVariant={() => openNewBaseVariantDialog(baseModule)}
							onEdit={() => openEditModuleDialog(baseModule)}
							onEditVariant={(variant) =>
								openEditVariantDialog(variant, baseModule._id)
							}
							tvaRate={product.tvaRate}
						/>
					) : null}
					<ModulesSection
						modules={modules}
						onAdd={openNewModuleDialog}
						onDelete={handleModuleDelete}
						onEdit={openEditModuleDialog}
						onOpen={(module) =>
							navigate({
								params: { productId: module._id },
								to: "/dashboard/products/$productId",
								viewTransition: true,
							})
						}
						tvaRate={product.tvaRate}
					/>
				</div>
			) : (
				<VariantsSection
					onAdd={openNewVariantDialog}
					onDelete={handleVariantDelete}
					onEdit={openEditVariantDialog}
					tvaRate={product.tvaRate}
					variants={detail.variants}
				/>
			)}

			<div className="grid gap-4">
				{product.isComposition ? (
					<Card className="border-border/70">
						<CardHeader>
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div>
									<CardTitle>Calcul de composition</CardTitle>
									<CardDescription>
										Total calculé par somme des éco-participations des modules.
									</CardDescription>
								</div>
								<Button
									className="min-h-12 px-5 text-base"
									onClick={openComposeDialog}
									type="button"
								>
									<Calculator className="size-5" />
									Composer le produit
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<div className="rounded-md border border-primary/40 bg-primary/15 p-5">
								<div className="flex flex-wrap items-end justify-between gap-4">
									<div>
										<p className="text-muted-foreground text-sm">
											Total éco-participation HT
										</p>
										<p className="mt-2 font-serif text-4xl leading-none">
											{formatEuro(totalHt)}
										</p>
										<p className="mt-2 text-muted-foreground text-sm">
											TTC : {formatEuro(totalTtc)}
										</p>
									</div>
									<p className="max-w-md text-muted-foreground text-sm">
										Sélectionnez les modules et variantes qui composent la
										configuration exposée pour obtenir le total réel.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				) : (
					<Card className="border-border/70">
						<CardHeader>
							<CardTitle>Code à 11 chiffres</CardTitle>
							<CardDescription>
								Code officiel Ecomaison de la configuration exposée.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="mb-3 break-all font-medium text-sm">
								{currentCode || "Mapping manquant"}
							</p>
							<div className="relative mt-4">
								<Input
									className={hasManualCodeChanges ? "pr-20" : "pr-11"}
									inputMode="numeric"
									maxLength={11}
									onChange={(event) => setManualCodeValue(event.target.value)}
									placeholder="Code manuel à 11 chiffres"
									value={manualCode}
								/>
								<div className="absolute inset-y-0 right-1 flex items-center gap-1">
									<Button
										aria-label="Copier le code"
										disabled={!currentCode}
										onClick={() => copyCode(currentCode)}
										size="icon-sm"
										title="Copier le code"
										type="button"
										variant="ghost"
									>
										<Copy className="size-4" />
									</Button>
									{hasManualCodeChanges ? (
										<Button
											aria-label="Enregistrer le code manuel"
											disabled={!primaryVariant}
											onClick={handleManualCodeSave}
											size="icon-sm"
											title="Enregistrer le code manuel"
											type="button"
											variant="ghost"
										>
											<Save className="size-4" />
										</Button>
									) : null}
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			<ProductEditDialog
				form={productForm}
				isComposition={product.isComposition}
				onChange={setProductForm}
				onOpenChange={setProductDialogOpen}
				onSave={handleProductSave}
				open={productDialogOpen}
			/>
			<VariantDialog
				form={variantForm}
				onChange={setVariantForm}
				onOpenChange={setVariantDialogOpen}
				onSave={handleVariantSave}
				open={variantDialogOpen}
			/>
			<ModuleDialog
				form={moduleForm}
				onChange={setModuleForm}
				onOpenChange={setModuleDialogOpen}
				onSave={handleModuleSave}
				open={moduleDialogOpen}
			/>
			<ComposeProductDialog
				baseModule={baseModule}
				modules={modules}
				onBaseVariantChange={setSelectedBaseVariantId}
				onOpenChange={setComposeDialogOpen}
				onSelectionChange={setSelectedModuleVariants}
				open={composeDialogOpen}
				selectedBaseVariantId={selectedBaseVariantId}
				selectedModuleVariants={selectedModuleVariants}
			/>
		</div>
	);
}

function VariantsSection({
	onAdd,
	onDelete,
	onEdit,
	tvaRate,
	variants,
}: {
	onAdd: () => void;
	onDelete: (variant: ProductVariantRow) => void;
	onEdit: (variant: ProductVariantRow) => void;
	tvaRate: number;
	variants: ProductVariantRow[];
}) {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Variantes</CardTitle>
						<CardDescription>
							Chaque variante a son propre poids et sa propre éco-participation.
						</CardDescription>
					</div>
					<Button onClick={onAdd} type="button" variant="outline">
						<Plus className="size-4" />
						Ajouter une variante
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Variante</TableHead>
							<TableHead>Référence</TableHead>
							<TableHead>Tissu</TableHead>
							<TableHead>Prix TTC / HT</TableHead>
							<TableHead>Poids</TableHead>
							<TableHead>Éco TTC / HT</TableHead>
							<TableHead>Code</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{variants.map((variant) => (
							<TableRow key={variant._id}>
								<TableCell>{variant.variantLabel}</TableCell>
								<TableCell>{variant.reference ?? "-"}</TableCell>
								<TableCell>{variant.fabricReference ?? "-"}</TableCell>
								<TableCell>
									<MoneyPair
										ht={variant.priceHt ?? null}
										ttc={calculateTtc(variant.priceHt ?? null, tvaRate)}
									/>
								</TableCell>
								<TableCell>{formatVariantMeasure(variant)}</TableCell>
								<TableCell>
									<MoneyPair
										ht={variant.ecoParticipationHt ?? null}
										ttc={variant.ecoParticipationTtc ?? null}
									/>
								</TableCell>
								<TableCell>
									{variant.manualEcomaisonCode11 ??
										variant.ecomaisonCode11 ??
										"Mapping manquant"}
								</TableCell>
								<TableCell className="text-right">
									<RowMenu
										onDelete={() => onDelete(variant)}
										onEdit={() => onEdit(variant)}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

function ModulesSection({
	modules,
	onAdd,
	onDelete,
	onEdit,
	onOpen,
	tvaRate,
}: {
	modules: ModuleRow[];
	onAdd: () => void;
	onDelete: (module: ModuleRow) => void;
	onEdit: (module: ModuleRow) => void;
	onOpen: (module: ModuleRow) => void;
	tvaRate: number;
}) {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Modules</CardTitle>
						<CardDescription>
							Le total de la composition est la somme des éco-participations des
							modules.
						</CardDescription>
					</div>
					<Button onClick={onAdd} type="button" variant="outline">
						<Plus className="size-4" />
						Ajouter un module
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{modules.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Module</TableHead>
								<TableHead>Catégorie</TableHead>
								<TableHead>Prix TTC / HT</TableHead>
								<TableHead>Poids</TableHead>
								<TableHead>Éco TTC / HT</TableHead>
								<TableHead className="w-12" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{modules.map((module) => (
								<TableRow key={module._id}>
									<TableCell>
										<button
											className="text-left font-medium hover:underline"
											onClick={() => onOpen(module)}
											type="button"
										>
											{module.name}
										</button>
										<p className="text-muted-foreground text-sm">
											{module.reference ?? "Sans référence"}
										</p>
									</TableCell>
									<TableCell>{module.molteniCategory}</TableCell>
									<TableCell>
										<MoneyPair
											ht={module.priceHt ?? null}
											ttc={calculateTtc(module.priceHt ?? null, tvaRate)}
										/>
									</TableCell>
									<TableCell>
										{module.weightKg == null ? "-" : `${module.weightKg} kg`}
									</TableCell>
									<TableCell>
										<MoneyPair
											ht={module.ecoParticipationHt ?? null}
											ttc={module.ecoParticipationTtc ?? null}
										/>
									</TableCell>
									<TableCell className="text-right">
										<RowMenu
											onDelete={() => onDelete(module)}
											onEdit={() => onEdit(module)}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<p className="text-sm text-muted-foreground">
						Aucun module pour le moment. Ajoutez chaque élément séparément ; le
						total de la composition sera calculé à partir des éco-participations
						des modules.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function BaseStructureSection({
	baseModule,
	onAddVariant,
	onEdit,
	onEditVariant,
	tvaRate,
}: {
	baseModule: ModuleRow;
	onAddVariant: () => void;
	onEdit: () => void;
	onEditVariant: (variant: ProductVariantRow) => void;
	tvaRate: number;
}) {
	const variants = getModuleVariants(baseModule);
	const defaultVariant = variants[0] ?? null;
	const code =
		defaultVariant?.manualEcomaisonCode11 ??
		defaultVariant?.ecomaisonCode11 ??
		"Mapping manquant";

	return (
		<Card className="border-primary/50 bg-primary/5">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Base / Structure</CardTitle>
						<CardDescription>
							Élément obligatoire de la composition, masqué de la liste
							produits.
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button onClick={onEdit} type="button" variant="outline">
							<Pencil className="size-4" />
							Modifier
						</Button>
						<Button onClick={onAddVariant} type="button" variant="outline">
							<Plus className="size-4" />
							Ajouter une variante
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
					<ProductMeta icon={Package} label="Catégorie">
						{baseModule.molteniCategory}
					</ProductMeta>
					<ProductMeta icon={Recycle} label="Famille">
						{baseModule.ecomaisonFamily}
					</ProductMeta>
					<ProductMeta icon={Circle} label="Prix">
						<MoneyPair
							ht={baseModule.priceHt ?? null}
							ttc={calculateTtc(baseModule.priceHt ?? null, tvaRate)}
						/>
					</ProductMeta>
					<ProductMeta icon={Weight} label="Mesure">
						{defaultVariant ? formatVariantMeasure(defaultVariant) : "-"}
					</ProductMeta>
					<ProductMeta icon={Recycle} label="Éco">
						<MoneyPair
							ht={baseModule.ecoParticipationHt ?? null}
							ttc={baseModule.ecoParticipationTtc ?? null}
						/>
					</ProductMeta>
				</div>
				<div className="border border-border bg-background/50 p-3">
					<p className="text-muted-foreground text-xs uppercase tracking-normal">
						Code Ecomaison
					</p>
					<p className="mt-1 break-all font-medium text-sm">{code}</p>
				</div>
				{variants.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Variante</TableHead>
								<TableHead>Référence</TableHead>
								<TableHead>Prix TTC / HT</TableHead>
								<TableHead>Poids</TableHead>
								<TableHead>Éco TTC / HT</TableHead>
								<TableHead className="w-12" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{variants.map((variant) => (
								<TableRow key={variant._id}>
									<TableCell>{variant.variantLabel}</TableCell>
									<TableCell>{variant.reference ?? "-"}</TableCell>
									<TableCell>
										<MoneyPair
											ht={variant.priceHt ?? null}
											ttc={calculateTtc(variant.priceHt ?? null, tvaRate)}
										/>
									</TableCell>
									<TableCell>{formatVariantMeasure(variant)}</TableCell>
									<TableCell>
										<MoneyPair
											ht={variant.ecoParticipationHt ?? null}
											ttc={variant.ecoParticipationTtc ?? null}
										/>
									</TableCell>
									<TableCell className="text-right">
										<Button
											aria-label="Modifier la variante"
											onClick={() => onEditVariant(variant)}
											size="icon"
											type="button"
											variant="ghost"
										>
											<Pencil className="size-4" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : null}
			</CardContent>
		</Card>
	);
}

function RowMenu({
	onDelete,
	onEdit,
}: {
	onDelete: () => void;
	onEdit: () => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button aria-label="Actions" size="icon" type="button" variant="ghost">
					<MoreHorizontal className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={onEdit}>
					<Pencil className="size-4" />
					Modifier
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onDelete} variant="destructive">
					<Trash2 className="size-4" />
					Supprimer
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ProductEditDialog({
	form,
	isComposition,
	onChange,
	onOpenChange,
	onSave,
	open,
}: {
	form: ProductEditFormState;
	isComposition: boolean;
	onChange: (form: ProductEditFormState) => void;
	onOpenChange: (open: boolean) => void;
	onSave: () => void;
	open: boolean;
}) {
	function handleCategoryChange(category: MolteniCategory) {
		onChange({ ...form, category, family: getDefaultFamily(category) });
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Modifier le produit</DialogTitle>
					<DialogDescription>
						Ces informations décrivent la fiche produit. Les variantes gardent
						leurs propres poids, prix et codes.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field label="Nom">
						<Input
							onChange={(event) =>
								onChange({ ...form, name: event.target.value })
							}
							value={form.name}
						/>
					</Field>
					<Field label="Zone">
						<Select
							value={form.zone || "none"}
							onValueChange={(zone) =>
								onChange({
									...form,
									zone: zone === "none" ? "" : (zone as (typeof ZONES)[number]),
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Sans zone</SelectItem>
								{ZONES.map((zone) => (
									<SelectItem key={zone} value={zone}>
										Zone {zone}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field label="Catégorie Molteni">
						<Select value={form.category} onValueChange={handleCategoryChange}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MOLTENI_CATEGORIES.map((category) => (
									<SelectItem key={category} value={category}>
										{category}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field label="Famille Ecomaison">
						<Select
							value={form.family}
							onValueChange={(family) =>
								onChange({ ...form, family: family as EcomaisonFamily })
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ECOMAISON_FAMILIES.map((family) => (
									<SelectItem key={family} value={family}>
										{family}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					{!isComposition && isMaterialRequired(form.family) ? (
						<Field label="Matière dominante">
							<Select
								value={form.materialTier}
								onValueChange={(materialTier) =>
									onChange({
										...form,
										materialTier: materialTier as MaterialTier,
									})
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{MATERIAL_TIERS.map((tier) => (
										<SelectItem key={tier.key} value={tier.key}>
											{tier.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					) : null}
					<Field label="TVA">
						<Select
							value={String(form.tvaRate)}
							onValueChange={(tvaRate) =>
								onChange({ ...form, tvaRate: Number(tvaRate) })
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="0.2">20 %</SelectItem>
								<SelectItem value="0.1">10 %</SelectItem>
								<SelectItem value="0.055">5,5 %</SelectItem>
							</SelectContent>
						</Select>
					</Field>
					{isComposition ? null : (
						<div className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
							<BooleanField
								checked={form.hasRecyclingDisruptors}
								label="Perturbateurs"
								onChange={(hasRecyclingDisruptors) =>
									onChange({
										...form,
										evolutionaryDesign: hasRecyclingDisruptors
											? false
											: form.evolutionaryDesign,
										hasRecyclingDisruptors,
										sustainableCertified: hasRecyclingDisruptors
											? false
											: form.sustainableCertified,
									})
								}
							/>
							<BooleanField
								checked={form.sustainableCertified}
								label="Gestion durable"
								onChange={(sustainableCertified) =>
									onChange({ ...form, sustainableCertified })
								}
							/>
							<BooleanField
								checked={form.evolutionaryDesign}
								label="Conception évolutive"
								onChange={(evolutionaryDesign) =>
									onChange({ ...form, evolutionaryDesign })
								}
							/>
						</div>
					)}
					<div className="sm:col-span-2">
						<Field label="Notes">
							<Textarea
								onChange={(event) =>
									onChange({ ...form, notes: event.target.value })
								}
								value={form.notes}
							/>
						</Field>
					</div>
				</div>
				<DialogFooter>
					<Button disabled={!form.name.trim()} onClick={onSave} type="button">
						Enregistrer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ComposeProductDialog({
	baseModule,
	modules,
	onBaseVariantChange,
	onOpenChange,
	onSelectionChange,
	open,
	selectedBaseVariantId,
	selectedModuleVariants,
}: {
	baseModule?: ModuleRow | null;
	modules: ModuleRow[];
	onBaseVariantChange: (variantId: string | null) => void;
	onOpenChange: (open: boolean) => void;
	onSelectionChange: (selection: ModuleVariantSelection) => void;
	open: boolean;
	selectedBaseVariantId: string | null;
	selectedModuleVariants: ModuleVariantSelection;
}) {
	const baseVariants = baseModule ? getModuleVariants(baseModule) : [];
	const baseVariant = baseModule
		? (getSelectedModuleVariant(
				baseModule,
				selectedBaseVariantId ?? undefined,
			) ??
			baseVariants[0] ??
			null)
		: null;
	const selectedVariants = modules
		.map((module) => {
			const selection = selectedModuleVariants[module._id];
			const variant = getSelectedModuleVariant(module, selection?.variantId);
			return variant ? { quantity: selection.quantity, variant } : null;
		})
		.filter((selection) => selection !== null);
	const selectedBase = baseVariant
		? [{ quantity: 1, variant: baseVariant }]
		: [];
	const totalHt = sumSelectedVariants(
		[...selectedBase, ...selectedVariants],
		"ecoParticipationHt",
	);
	const totalTtc = sumSelectedVariants(
		[...selectedBase, ...selectedVariants],
		"ecoParticipationTtc",
	);

	function toggleModule(moduleId: string) {
		const nextSelection = { ...selectedModuleVariants };
		if (nextSelection[moduleId]) {
			delete nextSelection[moduleId];
		} else {
			const module = modules.find((candidate) => candidate._id === moduleId);
			const variant = module ? getModuleVariants(module)[0] : null;
			if (variant)
				nextSelection[moduleId] = { quantity: 1, variantId: variant._id };
		}
		onSelectionChange(nextSelection);
	}

	function selectVariant(moduleId: string, variantId: string) {
		const currentSelection = selectedModuleVariants[moduleId];
		onSelectionChange({
			...selectedModuleVariants,
			[moduleId]: {
				quantity: currentSelection?.quantity ?? 1,
				variantId,
			},
		});
	}

	function setQuantity(moduleId: string, quantity: number) {
		const currentSelection = selectedModuleVariants[moduleId];
		if (!currentSelection) return;
		onSelectionChange({
			...selectedModuleVariants,
			[moduleId]: {
				...currentSelection,
				quantity: Math.max(1, Math.floor(quantity) || 1),
			},
		});
	}

	function selectAll() {
		onSelectionChange(getDefaultModuleVariantSelection(modules));
	}

	function clearSelection() {
		onSelectionChange({});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Composer le produit</DialogTitle>
					<DialogDescription>
						Sélectionnez les modules de la configuration exposée. Le total est
						la somme des éco-participations des modules sélectionnés.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3 border border-border p-4">
						<div>
							<p className="text-muted-foreground text-sm">
								Base obligatoire + modules sélectionnés
							</p>
							<p className="font-serif text-4xl">{formatEuro(totalHt)}</p>
							<p className="text-muted-foreground text-sm">
								TTC : {formatEuro(totalTtc)}
							</p>
						</div>
						<div className="flex gap-2">
							<Button onClick={selectAll} type="button" variant="outline">
								Tout sélectionner
							</Button>
							<Button onClick={clearSelection} type="button" variant="outline">
								Vider
							</Button>
						</div>
					</div>
					<div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
						{baseModule ? (
							<div className="grid min-h-16 items-center gap-4 border border-primary/60 bg-primary/10 p-3 sm:grid-cols-[minmax(0,1fr)_220px_minmax(120px,auto)]">
								<div className="flex items-center gap-3">
									<input
										checked
										className="size-4 bg-input/40 accent-primary"
										disabled
										readOnly
										type="checkbox"
									/>
									<span>
										<span className="block font-medium">{baseModule.name}</span>
										<span className="mt-1 block text-muted-foreground text-sm">
											Base obligatoire · {baseModule.molteniCategory}
										</span>
									</span>
								</div>
								{baseVariants.length > 1 ? (
									<Select
										onValueChange={onBaseVariantChange}
										value={baseVariant?._id ?? baseVariants[0]._id}
									>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{baseVariants.map((variant) => (
												<SelectItem key={variant._id} value={variant._id}>
													{variant.variantLabel}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : (
									<span className="text-muted-foreground text-sm">
										{baseVariant?.variantLabel ?? "Base à compléter"}
									</span>
								)}
								<span className="shrink-0 self-center text-right leading-tight">
									<span className="block font-medium">
										{formatEuro(baseVariant?.ecoParticipationHt ?? null)}
									</span>
									<span className="block text-muted-foreground text-xs">
										{baseVariant ? formatVariantMeasure(baseVariant) : "-"} ·{" "}
										{formatEuro(baseVariant?.ecoParticipationTtc ?? null)} TTC
									</span>
								</span>
							</div>
						) : null}
						{modules.length > 0 ? (
							modules.map((module) => {
								const variants = getModuleVariants(module);
								const moduleSelection = selectedModuleVariants[module._id];
								const countedVariant = getSelectedModuleVariant(
									module,
									moduleSelection?.variantId,
								);
								const displayedVariant = countedVariant ?? variants[0] ?? null;
								const displayedHt =
									displayedVariant?.ecoParticipationHt != null
										? displayedVariant.ecoParticipationHt *
											(moduleSelection?.quantity ?? 1)
										: null;
								const displayedTtc =
									displayedVariant?.ecoParticipationTtc != null
										? displayedVariant.ecoParticipationTtc *
											(moduleSelection?.quantity ?? 1)
										: null;
								return (
									<div
										className="grid min-h-16 items-center gap-4 border border-border p-3 transition-colors hover:bg-accent/60 has-[:checked]:border-primary has-[:checked]:bg-primary/10 sm:grid-cols-[minmax(0,1fr)_220px_minmax(112px,auto)_minmax(120px,auto)]"
										key={module._id}
									>
										<label className="flex cursor-pointer items-center gap-3 self-center">
											<input
												checked={Boolean(moduleSelection)}
												className="size-4 bg-input/40 accent-primary"
												onChange={() => toggleModule(module._id)}
												type="checkbox"
											/>
											<span>
												<span className="block font-medium">{module.name}</span>
												<span className="mt-1 block text-muted-foreground text-sm">
													{module.reference ?? "Sans référence"} ·{" "}
													{module.molteniCategory}
												</span>
											</span>
										</label>
										{variants.length > 1 ? (
											<Select
												disabled={!moduleSelection}
												onValueChange={(variantId) =>
													selectVariant(module._id, variantId)
												}
												value={moduleSelection?.variantId ?? variants[0]._id}
											>
												<SelectTrigger className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{variants.map((variant) => (
														<SelectItem key={variant._id} value={variant._id}>
															{variant.variantLabel}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										) : (
											<span aria-hidden="true" />
										)}
										<div className="flex items-center justify-end gap-2 self-center text-muted-foreground text-sm">
											<span>Qté</span>
											<div className="flex h-8 items-center border border-input bg-input/40">
												<Button
													aria-label={`Retirer un ${module.name}`}
													className="h-7 w-8 rounded-none"
													disabled={!moduleSelection}
													onClick={() =>
														setQuantity(
															module._id,
															(moduleSelection?.quantity ?? 1) - 1,
														)
													}
													size="icon-xs"
													type="button"
													variant="ghost"
												>
													<Minus className="size-3.5" />
												</Button>
												<Input
													aria-label={`Quantité pour ${module.name}`}
													className="h-7 w-11 border-0 bg-transparent px-1 text-center shadow-none [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
													disabled={!moduleSelection}
													inputMode="numeric"
													min={1}
													onChange={(event) =>
														setQuantity(module._id, Number(event.target.value))
													}
													type="number"
													value={moduleSelection?.quantity ?? 1}
												/>
												<Button
													aria-label={`Ajouter un ${module.name}`}
													className="h-7 w-8 rounded-none"
													disabled={!moduleSelection}
													onClick={() =>
														setQuantity(
															module._id,
															(moduleSelection?.quantity ?? 1) + 1,
														)
													}
													size="icon-xs"
													type="button"
													variant="ghost"
												>
													<Plus className="size-3.5" />
												</Button>
											</div>
										</div>
										<span className="shrink-0 self-center text-right leading-tight">
											<span className="block font-medium">
												{formatEuro(displayedHt)}
											</span>
											<span className="block text-muted-foreground text-xs">
												{displayedVariant
													? formatVariantMeasure(displayedVariant)
													: "-"}{" "}
												· {formatEuro(displayedTtc)} TTC
											</span>
										</span>
									</div>
								);
							})
						) : (
							<p className="border border-border p-4 text-muted-foreground text-sm">
								Aucun module n’est encore rattaché à cette composition.
							</p>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} type="button">
						Fermer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function BooleanField({
	checked,
	label,
	onChange,
}: {
	checked: boolean;
	label: string;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="flex cursor-pointer items-center gap-2 border border-border p-3 text-sm">
			<input
				checked={checked}
				className="size-4 bg-input/40 accent-primary"
				onChange={(event) => onChange(event.target.checked)}
				type="checkbox"
			/>
			{label}
		</label>
	);
}

function VariantDialog({
	form,
	onChange,
	onOpenChange,
	onSave,
	open,
}: {
	form: VariantFormState;
	onChange: (form: VariantFormState) => void;
	onOpenChange: (open: boolean) => void;
	onSave: () => void;
	open: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{form.id ? "Modifier la variante" : "Ajouter une variante"}
					</DialogTitle>
					<DialogDescription>
						La variante reprend la classification du produit, mais possède son
						propre poids, prix et code.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field label="Libellé">
						<Input
							onChange={(event) =>
								onChange({ ...form, variantLabel: event.target.value })
							}
							value={form.variantLabel}
						/>
					</Field>
					<Field label="Référence">
						<Input
							onChange={(event) =>
								onChange({ ...form, reference: event.target.value })
							}
							value={form.reference}
						/>
					</Field>
					<Field label="Tissu / cuir">
						<Input
							onChange={(event) =>
								onChange({ ...form, fabricReference: event.target.value })
							}
							value={form.fabricReference}
						/>
					</Field>
					<Field label="Prix HT">
						<Input
							inputMode="decimal"
							onChange={(event) =>
								onChange({ ...form, priceHt: event.target.value })
							}
							value={form.priceHt}
						/>
					</Field>
					<Field label="Poids ou mesure">
						<Input
							inputMode="decimal"
							onChange={(event) =>
								onChange({ ...form, weightKg: event.target.value })
							}
							value={form.weightKg}
						/>
					</Field>
				</div>
				<DialogFooter>
					<Button onClick={onSave} type="button">
						Enregistrer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ModuleDialog({
	form,
	onChange,
	onOpenChange,
	onSave,
	open,
}: {
	form: ModuleFormState;
	onChange: (form: ModuleFormState) => void;
	onOpenChange: (open: boolean) => void;
	onSave: () => void;
	open: boolean;
}) {
	function handleCategoryChange(category: MolteniCategory) {
		onChange({ ...form, category, family: getDefaultFamily(category) });
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{form.id ? "Modifier le module" : "Ajouter un module"}
					</DialogTitle>
					<DialogDescription>
						Un module est un produit rattaché à la composition. Son poids et sa
						matière sont calculés séparément.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field label="Nom">
						<Input
							onChange={(event) =>
								onChange({ ...form, name: event.target.value })
							}
							value={form.name}
						/>
					</Field>
					<Field label="Référence">
						<Input
							onChange={(event) =>
								onChange({ ...form, reference: event.target.value })
							}
							value={form.reference}
						/>
					</Field>
					<Field label="Catégorie">
						<Select value={form.category} onValueChange={handleCategoryChange}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MOLTENI_CATEGORIES.map((category) => (
									<SelectItem key={category} value={category}>
										{category}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field label="Famille Ecomaison">
						<Select
							value={form.family}
							onValueChange={(family) =>
								onChange({ ...form, family: family as EcomaisonFamily })
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ECOMAISON_FAMILIES.map((family) => (
									<SelectItem key={family} value={family}>
										{family}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					{isMaterialRequired(form.family) ? (
						<Field label="Matière dominante">
							<Select
								value={form.materialTier}
								onValueChange={(materialTier) =>
									onChange({
										...form,
										materialTier: materialTier as MaterialTier,
									})
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{MATERIAL_TIERS.map((tier) => (
										<SelectItem key={tier.key} value={tier.key}>
											{tier.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					) : null}
					<Field label="Poids">
						<Input
							inputMode="decimal"
							onChange={(event) =>
								onChange({ ...form, weightKg: event.target.value })
							}
							value={form.weightKg}
						/>
					</Field>
					<Field label="Prix HT">
						<Input
							inputMode="decimal"
							onChange={(event) =>
								onChange({ ...form, priceHt: event.target.value })
							}
							value={form.priceHt}
						/>
					</Field>
					<Field label="Notes">
						<Textarea
							className="sm:col-span-2"
							onChange={(event) =>
								onChange({ ...form, notes: event.target.value })
							}
							value={form.notes}
						/>
					</Field>
				</div>
				<DialogFooter>
					<Button disabled={!form.name.trim()} onClick={onSave} type="button">
						{form.id ? "Enregistrer" : "Créer le module"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ProductMeta({
	children,
	icon: Icon,
	label,
}: {
	children: React.ReactNode;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
}) {
	return (
		<div className="flex gap-3 border border-border p-3">
			<span className="flex size-9 shrink-0 items-center justify-center text-primary">
				<Icon className="size-6" />
			</span>
			<span>
				<span className="block text-muted-foreground text-xs uppercase tracking-normal">
					{label}
				</span>
				<span className="mt-1 block font-medium text-sm">{children}</span>
			</span>
		</div>
	);
}

function Field({
	children,
	label,
}: {
	children: React.ReactNode;
	label: string;
}) {
	return (
		<div className="space-y-2">
			<span className="font-medium text-sm">{label}</span>
			{children}
		</div>
	);
}

async function copyCode(code: string | null | undefined) {
	if (!code) return;
	await navigator.clipboard.writeText(code);
	toast.success("Code copié");
}

function parseNumber(value: string) {
	const normalized = value.replace(",", ".").trim();
	if (!normalized) return null;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function formatEditableNumber(value: number | null | undefined) {
	return value === null || value === undefined ? "" : String(value);
}

function primaryManualCode(variant: ProductVariantRow | undefined) {
	return variant?.manualEcomaisonCode11 ?? variant?.ecomaisonCode11 ?? "";
}

function materialTierLabel(value: string) {
	return MATERIAL_TIERS.find((tier) => tier.key === value)?.label ?? value;
}

function formatVariantMeasure(variant: ProductVariantRow) {
	if (variant.textileMode === "surface") {
		return variant.weightKg == null ? "-" : `${variant.weightKg} m²`;
	}
	if (variant.widthCm != null) return `${variant.widthCm} cm`;
	return variant.weightKg == null ? "-" : `${variant.weightKg} kg`;
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

function emptyVariantForm(productId?: string): VariantFormState {
	return {
		productId,
		variantLabel: "",
		reference: "",
		fabricReference: "",
		priceHt: "",
		weightKg: "",
	};
}

function emptyModuleForm(product: ProductRecord | undefined): ModuleFormState {
	const category = (product?.molteniCategory ?? "Fauteuil") as MolteniCategory;
	const family = (product?.ecomaisonFamily ??
		getDefaultFamily(category)) as EcomaisonFamily;
	return {
		id: undefined,
		name: "",
		reference: "",
		category,
		family,
		materialTier: "tous_materiaux",
		weightKg: "",
		priceHt: "",
		notes: "",
		fabricReference: "",
		widthCm: undefined,
		textileMode: undefined,
	};
}

function moduleEditForm(module: ModuleRow): ModuleFormState {
	const category = module.molteniCategory as MolteniCategory;
	const family = module.ecomaisonFamily as EcomaisonFamily;
	return {
		id: module._id,
		name: module.name,
		reference: module.reference ?? "",
		category,
		family,
		materialTier: (module.materialTier ?? "tous_materiaux") as MaterialTier,
		weightKg: formatEditableNumber(module.weightKg),
		priceHt: formatEditableNumber(module.priceHt),
		notes: module.notes ?? "",
		fabricReference: module.fabricReference ?? "",
		widthCm: module.widthCm,
		textileMode: module.textileMode,
	};
}

function productEditForm(
	product: ProductRecord | undefined,
): ProductEditFormState {
	const category = (product?.molteniCategory ?? "Fauteuil") as MolteniCategory;
	const family = (product?.ecomaisonFamily ??
		getDefaultFamily(category)) as EcomaisonFamily;
	return {
		name: product?.name ?? "",
		category,
		family,
		materialTier: (product?.materialTier ?? "tous_materiaux") as MaterialTier,
		zone: (product?.zone ?? "") as ProductEditFormState["zone"],
		tvaRate: product?.tvaRate ?? 0.2,
		notes: product?.notes ?? "",
		hasRecyclingDisruptors: product?.hasRecyclingDisruptors ?? false,
		sustainableCertified: product?.sustainableCertified ?? false,
		evolutionaryDesign: product?.evolutionaryDesign ?? false,
	};
}

function sumEco(
	modules: ModuleRow[],
	key: "ecoParticipationHt" | "ecoParticipationTtc",
) {
	return modules.reduce((total, module) => total + (module[key] ?? 0), 0);
}

function sumVariants(
	variants: ProductVariantRow[],
	key: "ecoParticipationHt" | "ecoParticipationTtc",
) {
	return variants.reduce((total, variant) => total + (variant[key] ?? 0), 0);
}

function sumSelectedVariants(
	selections: { quantity: number; variant: ProductVariantRow }[],
	key: "ecoParticipationHt" | "ecoParticipationTtc",
) {
	return selections.reduce(
		(total, selection) =>
			total + (selection.variant[key] ?? 0) * selection.quantity,
		0,
	);
}

function getDefaultModuleVariantSelection(modules: ModuleRow[]) {
	return Object.fromEntries(
		modules
			.map((module) => {
				const variant = getModuleVariants(module)[0];
				return variant
					? ([module._id, { quantity: 1, variantId: variant._id }] as const)
					: null;
			})
			.filter((entry) => entry !== null),
	);
}

function getSelectedModuleVariant(
	module: ModuleRow,
	variantId: string | undefined,
) {
	if (!variantId) return null;
	const variants = getModuleVariants(module);
	return (
		variants.find((variant) => variant._id === variantId) ?? variants[0] ?? null
	);
}

function getModuleVariants(module: ModuleRow): ProductVariantRow[] {
	if (module.variants?.length) return module.variants;
	return [
		{
			_id: module._id,
			variantLabel: "Module",
			reference: module.reference,
			fabricReference: module.fabricReference,
			priceHt: module.priceHt,
			weightKg: module.weightKg,
			widthCm: module.widthCm,
			textileMode: module.textileMode,
			ecoParticipationHt: module.ecoParticipationHt,
			ecoParticipationTtc: module.ecoParticipationTtc,
			ecomaisonCode11: module.ecomaisonCode11,
			manualEcomaisonCode11: module.manualEcomaisonCode11,
		},
	];
}

function categoryIcon(category: string) {
	if (category === "Fauteuil") return Armchair;
	if (category === "Canapé") return Sofa;
	if (category === "Lit" || category === "Matelas") return Bed;
	if (category === "Plaid" || category === "Coussin") return Shirt;
	if (category === "Tapis") return Grid2X2;
	if (category === "Cuisine") return ChefHat;
	if (category === "Bibliothèque") return BookOpen;
	if (category === "Dressing") return Boxes;
	if (category.includes("Table")) return Table2;
	if (category === "Banc") return Ruler;
	return Weight;
}
