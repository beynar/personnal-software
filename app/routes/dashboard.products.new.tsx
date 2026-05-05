import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	Armchair,
	BadgeEuro,
	Bed,
	Blocks,
	Box,
	Boxes,
	CheckCircle2,
	ChefHat,
	Circle,
	DoorOpen,
	Gem,
	Grid2X2,
	Hammer,
	LayoutGrid,
	Leaf,
	LibraryBig,
	MapPin,
	Package,
	Recycle,
	Rows3,
	Ruler,
	Shirt,
	Sofa,
	Table2,
	TreePine,
	Weight,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	ChoiceGrid,
	type ChoiceOption,
} from "~/components/molteni/choice-grid";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useSidebar } from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ecomaison2026Bareme } from "../../shared/ecomaison/generated/bareme-2026";
import {
	ECOMAISON_FAMILIES,
	type EcomaisonFamily,
	MATERIAL_TIERS,
	MOLTENI_CATEGORIES,
	type MaterialTier,
	type MolteniCategory,
	ZONES,
	getDefaultFamily,
	isMaterialAllowedWithDisruptors,
	isMaterialRequired,
} from "../../shared/ecomaison/taxonomy";

type ZoneValue = (typeof ZONES)[number];
type ProductKind = "standalone" | "composition" | "module";
type ProductWizardSearch = {
	editId?: string;
	parentId?: string;
};

type PendingModule = {
	id: string;
	name: string;
	category: MolteniCategory;
	family: EcomaisonFamily;
	materialTier: MaterialTier | "";
	priceHt: string;
	weightKg: string;
	widthCm: string;
	notes: string;
};

type ProductEditDetail = {
	product: {
		_id: string;
		name: string;
		molteniCategory: MolteniCategory;
		ecomaisonFamily: EcomaisonFamily;
		materialTier?: MaterialTier | null;
		zone?: ZoneValue | null;
		notes?: string | null;
		tvaRate: number;
		hasRecyclingDisruptors?: boolean | null;
		sustainableCertified?: boolean | null;
		evolutionaryDesign?: boolean | null;
		isComposition: boolean;
		parentId?: string | null;
	};
	variants: Array<{
		reference?: string | null;
		fabricReference?: string | null;
		priceHt?: number | null;
		weightKg?: number | null;
		widthCm?: number | null;
		textileMode?: string | null;
	}>;
};

const stepMotionVariants = {
	animate: { opacity: 1, x: 0 },
	exit: (direction: 1 | -1) => ({
		opacity: 0,
		x: direction > 0 ? -18 : 18,
	}),
	initial: (direction: 1 | -1) => ({
		opacity: 0,
		x: direction > 0 ? 18 : -18,
	}),
};

export const Route = createFileRoute("/dashboard/products/new")({
	validateSearch: (search: Record<string, unknown>): ProductWizardSearch => ({
		editId: typeof search.editId === "string" ? search.editId : undefined,
		parentId: typeof search.parentId === "string" ? search.parentId : undefined,
	}),
	staticData: {
		dashboardHeader: {
			backHref: "/dashboard/products",
			description: "Saisie guidée en quatre étapes avec calcul immédiat",
			title: "Nouveau produit",
		},
	},
	pendingComponent: () => <Skeleton className="h-96 w-full" />,
	component: ProductWizardPage,
});

function ProductWizardPage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { isCollapsed, isMobile } = useSidebar();
	const createProduct = useMutation(api.products.createProduct);
	const updateProduct = useMutation(api.products.updateProduct);
	const editDetail = useQuery(
		api.products.getProduct,
		search.editId ? { productId: search.editId as Id<"products"> } : "skip",
	) as ProductEditDetail | null | undefined;
	const [step, setStep] = useState(1);
	const [stepDirection, setStepDirection] = useState<1 | -1>(1);
	const [name, setName] = useState("");
	const [reference, setReference] = useState("");
	const [zone, setZone] = useState<ZoneValue>("A");
	const [category, setCategory] = useState<MolteniCategory>("Fauteuil");
	const [family, setFamily] = useState<EcomaisonFamily>(
		"Siège avec rembourrage",
	);
	const [materialTier, setMaterialTier] = useState<MaterialTier | "">("");
	const [productKind, setProductKind] = useState<ProductKind>(
		search.parentId ? "module" : "standalone",
	);
	const [hasRecyclingDisruptors, setHasRecyclingDisruptors] = useState(false);
	const [sustainableCertified, setSustainableCertified] = useState(false);
	const [evolutionaryDesign, setEvolutionaryDesign] = useState(false);
	const [weightKg, setWeightKg] = useState("");
	const [widthCm, setWidthCm] = useState("");
	const [priceHt, setPriceHt] = useState("");
	const [fabricReference, setFabricReference] = useState("");
	const [literieType, setLiterieType] = useState("matelas");
	const [textileMode, setTextileMode] = useState("weight");
	const [tvaRate, setTvaRate] = useState("0.2");
	const [notes, setNotes] = useState("");
	const [shouldCreateBaseModule, setShouldCreateBaseModule] = useState(true);
	const [pendingModules, setPendingModules] = useState<PendingModule[]>([]);
	const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
	const [pendingModuleForm, setPendingModuleForm] = useState<PendingModule>(
		emptyPendingModule("Fauteuil"),
	);
	const [prefilledEditId, setPrefilledEditId] = useState<string | null>(null);
	const isEditing = Boolean(search.editId);
	const isComposition = productKind === "composition";
	const isModule = productKind === "module";
	const shouldMeasureBase =
		isComposition && shouldCreateBaseModule && !isEditing;
	const materialRequired = isMaterialRequired(family);
	const materialWarning =
		!isComposition &&
		materialTier !== "" &&
		materialRequired &&
		!isMaterialAllowedWithDisruptors(materialTier, hasRecyclingDisruptors);
	const tousMateriaux = materialTier === "tous_materiaux";
	const weight = parseNumber(weightKg);
	const width = parseNumber(widthCm);
	const price = parseNumber(priceHt);
	const tva = parseNumber(tvaRate) ?? 0.2;
	const textileOptions = textileModeOptionsForCategory(category);
	const preview = useMemo(
		() =>
			previewEco(
				family,
				materialTier,
				family === "Décoration textile" && textileMode === "piece" ? 0 : weight,
				width,
				textileMode,
			),
		[family, materialTier, textileMode, weight, width],
	);

	useEffect(() => {
		if (!search.editId || !editDetail || prefilledEditId === search.editId) {
			return;
		}

		const product = editDetail.product;
		const defaultVariant = editDetail.variants[0];
		setName(product.name);
		setReference(defaultVariant?.reference ?? "");
		setZone(product.zone ?? "A");
		setCategory(product.molteniCategory);
		setFamily(product.ecomaisonFamily);
		setMaterialTier(product.materialTier ?? "");
		setProductKind(
			product.parentId
				? "module"
				: product.isComposition
					? "composition"
					: "standalone",
		);
		setHasRecyclingDisruptors(product.hasRecyclingDisruptors ?? false);
		setSustainableCertified(product.sustainableCertified ?? false);
		setEvolutionaryDesign(product.evolutionaryDesign ?? false);
		setWeightKg(formatEditableNumber(defaultVariant?.weightKg));
		setWidthCm(formatEditableNumber(defaultVariant?.widthCm));
		setTextileMode(
			product.ecomaisonFamily === "Décoration textile" &&
				product.molteniCategory === "Tapis"
				? (defaultVariant?.textileMode ?? "weight")
				: inferTextileMode(product.molteniCategory),
		);
		setPriceHt(formatEditableNumber(defaultVariant?.priceHt));
		setFabricReference(defaultVariant?.fabricReference ?? "");
		setTvaRate(String(product.tvaRate));
		setNotes(product.notes ?? "");
		setShouldCreateBaseModule(false);
		setPendingModules([]);
		setPrefilledEditId(search.editId);
	}, [editDetail, prefilledEditId, search.editId]);

	function handleCategoryChange(nextCategory: MolteniCategory) {
		setCategory(nextCategory);
		const nextFamily = getDefaultFamily(nextCategory);
		setFamily(nextFamily);
		setTextileMode(inferTextileMode(nextCategory));
	}

	function handleFamilyChange(nextFamily: EcomaisonFamily) {
		setFamily(nextFamily);
		if (nextFamily === "Décoration textile") {
			setTextileMode(inferTextileMode(category));
		}
	}

	function openPendingModuleDialog() {
		setPendingModuleForm(emptyPendingModule(category));
		setModuleDialogOpen(true);
	}

	function handlePendingModuleCategoryChange(nextCategory: MolteniCategory) {
		setPendingModuleForm({
			...pendingModuleForm,
			category: nextCategory,
			family: getDefaultFamily(nextCategory),
			materialTier: "",
			weightKg: "",
			widthCm: "",
		});
	}

	function savePendingModule() {
		const modulePrice = parseNumber(pendingModuleForm.priceHt);
		const moduleWeight = parseNumber(pendingModuleForm.weightKg);
		const moduleWidth = parseNumber(pendingModuleForm.widthCm);
		if (!pendingModuleForm.name.trim()) {
			toast.error("Le nom du module est obligatoire.");
			return;
		}
		if (modulePrice === null) {
			toast.error("Le prix HT du module est obligatoire.");
			return;
		}
		if (
			isMaterialRequired(pendingModuleForm.family) &&
			!pendingModuleForm.materialTier
		) {
			toast.error("La matière dominante du module est obligatoire.");
			return;
		}
		if (pendingModuleForm.family === "Literie" && moduleWidth === null) {
			toast.error("La largeur du module est obligatoire.");
			return;
		}
		if (pendingModuleForm.family !== "Literie" && moduleWeight === null) {
			toast.error("Le poids du module est obligatoire.");
			return;
		}
		setPendingModules([...pendingModules, pendingModuleForm]);
		setModuleDialogOpen(false);
	}

	function handleProductKindChange(nextKind: ProductKind) {
		const willMeasureBaseAfterChange = nextKind === "composition" && !isEditing;
		setProductKind(nextKind);
		if (nextKind === "composition" && !isEditing) {
			setShouldCreateBaseModule(true);
		}
		if (
			nextKind === "composition" &&
			step === 3 &&
			!willMeasureBaseAfterChange
		) {
			setStepDirection(1);
			setStep(4);
		}
	}

	function goToNextStep() {
		const error = getStepValidationError(step);
		if (error) {
			toast.error(error);
			return;
		}
		const nextStep =
			isComposition && step === 2 && !shouldMeasureBase
				? 4
				: Math.min(4, step + 1);
		if (nextStep !== step) {
			setStepDirection(1);
			setStep(nextStep);
			scrollToPageTop();
		}
	}

	function getStepValidationError(currentStep: number) {
		if (currentStep === 1) {
			if (!name.trim()) return "Le nom est obligatoire.";
			if (!category) return "La catégorie Molteni est obligatoire.";
			if (!zone) return "La zone est obligatoire.";
			if (!productKind) return "Le type de produit est obligatoire.";
			if (isModule && !search.parentId) {
				return "Un module doit être créé depuis une composition.";
			}
			if (!isComposition && price === null) {
				return "Le prix HT est obligatoire.";
			}
		}
		if (currentStep === 2) {
			if (!family) return "La famille Ecomaison est obligatoire.";
			if (!isComposition && materialRequired && !materialTier) {
				return "La matière dominante est obligatoire.";
			}
			if (materialWarning) {
				return "La matière choisie est réservée aux produits sans perturbateur.";
			}
			if (
				hasRecyclingDisruptors &&
				(sustainableCertified || evolutionaryDesign)
			) {
				return "Les éco-modulations sont réservées aux produits sans perturbateur.";
			}
			if (!tvaRate.trim() || parseNumber(tvaRate) === null) {
				return "Le taux de TVA est obligatoire.";
			}
		}
		if (currentStep === 3 && (!isComposition || shouldMeasureBase)) {
			if (shouldMeasureBase && price === null) {
				return "Le prix HT de la base / structure est obligatoire.";
			}
			if (family === "Literie" && width === null) {
				return shouldMeasureBase
					? "La largeur de la base / structure est obligatoire."
					: "La tranche de largeur est obligatoire.";
			}
			if (family === "Décoration textile" && textileMode === "surface") {
				if (weight === null || weight <= 0) {
					return shouldMeasureBase
						? "La surface de la base / structure est obligatoire."
						: "La surface du tapis est obligatoire.";
				}
				return null;
			}
			if (
				!(family === "Décoration textile" && textileMode === "piece") &&
				family !== "Literie" &&
				weight === null
			) {
				return shouldMeasureBase
					? "Le poids de la base / structure est obligatoire."
					: "La tranche de poids est obligatoire.";
			}
		}
		return null;
	}

	function goToPreviousStep() {
		const previousStep =
			isComposition && step === 4 && !shouldMeasureBase
				? 2
				: Math.max(1, step - 1);
		if (previousStep !== step) {
			setStepDirection(-1);
			setStep(previousStep);
		}
	}

	async function handleSave() {
		try {
			if (!name.trim()) {
				toast.error("Le nom du produit est obligatoire.");
				return;
			}
			if (isModule && !search.parentId) {
				toast.error(
					"Un module doit être créé depuis la fiche de sa composition.",
				);
				return;
			}
			if (materialWarning) {
				toast.error(
					"Cette matière n’est pas disponible avec des perturbateurs de recyclage.",
				);
				return;
			}
			if (
				hasRecyclingDisruptors &&
				(sustainableCertified || evolutionaryDesign)
			) {
				toast.error(
					"Les éco-modulations sont réservées aux produits sans perturbateur.",
				);
				return;
			}

			const shouldCreateComposition = isComposition && !isModule;
			const productInput = {
				name,
				reference: shouldCreateComposition ? undefined : reference || undefined,
				zone,
				molteniCategory: category,
				ecomaisonFamily: family,
				materialTier:
					!shouldCreateComposition && materialRequired && materialTier
						? materialTier
						: undefined,
				isComposition: shouldCreateComposition,
				notes: notes || undefined,
				hasRecyclingDisruptors: shouldCreateComposition
					? undefined
					: hasRecyclingDisruptors,
				sustainableCertified: shouldCreateComposition
					? undefined
					: sustainableCertified,
				evolutionaryDesign: shouldCreateComposition
					? undefined
					: evolutionaryDesign,
				weightKg:
					shouldCreateComposition && !shouldCreateBaseModule
						? undefined
						: family === "Décoration textile" && textileMode === "piece"
							? 0
							: family === "Literie"
								? undefined
								: (weight ?? undefined),
				widthCm:
					(!shouldCreateComposition || shouldCreateBaseModule) &&
					family === "Literie"
						? (width ?? undefined)
						: undefined,
				textileMode:
					(!shouldCreateComposition || shouldCreateBaseModule) &&
					family === "Décoration textile"
						? textileMode
						: undefined,
				priceHt:
					shouldCreateComposition && !shouldCreateBaseModule
						? undefined
						: (parseNumber(priceHt) ?? undefined),
				fabricReference: shouldCreateComposition
					? undefined
					: fabricReference || undefined,
				tvaRate: tva,
			};

			if (search.editId) {
				await updateProduct({
					...productInput,
					productId: search.editId as Id<"products">,
				});
				toast.success("Produit mis à jour");
				await navigate({
					params: { productId: search.editId },
					to: "/dashboard/products/$productId",
					viewTransition: true,
				});
				return;
			}

			const productId = await createProduct({
				...productInput,
				parentId:
					isModule && search.parentId
						? (search.parentId as Id<"products">)
						: undefined,
				moduleKind: isModule ? "component" : undefined,
				createBaseModule: shouldCreateComposition
					? shouldCreateBaseModule
					: undefined,
			});
			if (shouldCreateComposition) {
				for (const pendingModule of pendingModules) {
					const moduleFamily = pendingModule.family;
					await createProduct({
						name: pendingModule.name,
						zone,
						molteniCategory: pendingModule.category,
						ecomaisonFamily: moduleFamily,
						materialTier: isMaterialRequired(moduleFamily)
							? pendingModule.materialTier || undefined
							: undefined,
						isComposition: false,
						parentId: productId,
						moduleKind: "component",
						notes: pendingModule.notes || undefined,
						hasRecyclingDisruptors: false,
						sustainableCertified: false,
						evolutionaryDesign: false,
						weightKg:
							moduleFamily === "Literie"
								? undefined
								: (parseNumber(pendingModule.weightKg) ?? undefined),
						widthCm:
							moduleFamily === "Literie"
								? (parseNumber(pendingModule.widthCm) ?? undefined)
								: undefined,
						priceHt: parseNumber(pendingModule.priceHt) ?? undefined,
						tvaRate: tva,
					});
				}
			}
			toast.success(isModule ? "Module enregistré" : "Produit enregistré");
			await navigate({
				params: {
					productId: isModule && search.parentId ? search.parentId : productId,
				},
				to: "/dashboard/products/$productId",
				viewTransition: true,
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Enregistrement impossible",
			);
		}
	}

	const currentStepValidationError = getStepValidationError(step);
	const actionBarLeft = isMobile
		? "0px"
		: isCollapsed
			? "var(--sidebar-icon-width)"
			: "var(--sidebar-width)";

	return (
		<div className="mx-auto w-full max-w-6xl space-y-4 pb-32">
			<div className="grid gap-2 sm:grid-cols-4">
				{["Identité", "Classification", "Mesure", "Résultat"].map(
					(label, index) => {
						const targetStep = index + 1;
						const isSkipped =
							isComposition && targetStep === 3 && !shouldMeasureBase;
						const canNavigate = !isSkipped && targetStep <= step;
						return (
							<button
								aria-disabled={!canNavigate}
								className={`rounded-md border px-3 py-2 text-left text-sm transition-[border-color,box-shadow,color] ${step === targetStep ? "border-primary bg-background text-foreground ring-2 ring-primary ring-offset-0" : "border-border bg-card"} ${canNavigate ? "hover:border-primary/60" : "cursor-not-allowed opacity-50"}`}
								disabled={!canNavigate}
								key={label}
								onClick={() => {
									if (targetStep < step) {
										setStepDirection(-1);
										setStep(targetStep);
									}
								}}
								type="button"
							>
								<span className="block text-xs opacity-80">
									Étape {targetStep}
								</span>
								<span className="font-medium">
									{label}
									{isSkipped ? " ignorée" : ""}
								</span>
							</button>
						);
					},
				)}
			</div>

			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>{stepTitle(step, shouldMeasureBase)}</CardTitle>
					<CardDescription>
						{isEditing
							? "Modifiez les données du produit, puis enregistrez le résultat recalculé."
							: isModule
								? "Créez un module rattaché à la composition sélectionnée."
								: stepDescription(step, shouldMeasureBase)}
					</CardDescription>
				</CardHeader>
				<CardContent className="overflow-hidden">
					<AnimatePresence custom={stepDirection} initial={false} mode="wait">
						<motion.div
							animate="animate"
							className="space-y-5"
							custom={stepDirection}
							exit="exit"
							initial="initial"
							key={step}
							transition={{ duration: 0.22, ease: [0.19, 1, 0.22, 1] }}
							variants={stepMotionVariants}
						>
							{step === 1 ? (
								<div className="grid gap-5">
									<div className="grid gap-4 md:grid-cols-2">
										<Field label="Nom" required>
											<Input
												value={name}
												onChange={(event) => setName(event.target.value)}
											/>
										</Field>
										{isComposition ? null : (
											<Field label="Référence" optional>
												<Input
													value={reference}
													onChange={(event) => setReference(event.target.value)}
												/>
											</Field>
										)}
									</div>
									{isComposition ? null : (
										<div className="grid gap-4 md:grid-cols-2">
											<Field label="Prix HT" required>
												<Input
													inputMode="decimal"
													value={priceHt}
													onChange={(event) => setPriceHt(event.target.value)}
												/>
											</Field>
											<Field label="Référence tissu / cuir" optional>
												<Input
													value={fabricReference}
													onChange={(event) =>
														setFabricReference(event.target.value)
													}
												/>
											</Field>
										</div>
									)}
									<Field label="Zone" required>
										<ChoiceGrid
											className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
											compact
											options={zoneOptions}
											value={zone}
											onChange={setZone}
										/>
									</Field>
									<Field label="Catégorie Molteni" required>
										<ChoiceGrid
											className="sm:grid-cols-2 xl:grid-cols-4"
											options={categoryOptions}
											value={category}
											onChange={handleCategoryChange}
										/>
									</Field>
									{isModule ? (
										<div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
											{search.parentId
												? "Ce produit sera enregistré comme module de la composition en cours."
												: "Sélectionnez Module depuis la fiche d’une composition pour rattacher le module à son parent."}
										</div>
									) : null}
									<Field label="Type de produit" required>
										<ChoiceGrid
											className="sm:grid-cols-3"
											options={productTypeOptions}
											value={productKind}
											onChange={handleProductKindChange}
										/>
									</Field>
									<Field label="Notes" optional>
										<Textarea
											value={notes}
											onChange={(event) => setNotes(event.target.value)}
										/>
									</Field>
								</div>
							) : null}

							{step === 2 ? (
								<div className="grid gap-5">
									<Field label="Famille Ecomaison" required>
										<ChoiceGrid
											className="sm:grid-cols-2 xl:grid-cols-5"
											options={familyOptions}
											value={family}
											onChange={handleFamilyChange}
										/>
									</Field>
									{isComposition ? (
										<div className="space-y-3">
											<div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
												La composition garde seulement cette famille comme
												repère pour les futurs modules. Matière, poids et
												modulations se renseignent sur chaque module.
											</div>
											{isEditing ? null : (
												<ToggleLine
													checked={shouldCreateBaseModule}
													description="Ajoute un élément obligatoire, masqué de la liste produits et éditable depuis la fiche composition."
													id="create-base-module"
													label="Créer une base / structure"
													onChange={setShouldCreateBaseModule}
												/>
											)}
											<Field label="Taux de TVA" required>
												<ChoiceGrid
													className="sm:grid-cols-3"
													compact
													options={tvaOptions}
													value={tvaRate}
													onChange={setTvaRate}
												/>
											</Field>
										</div>
									) : materialRequired ? (
										<Field label="Matière dominante" required>
											<ChoiceGrid
												className="sm:grid-cols-2 xl:grid-cols-3"
												options={materialOptions(hasRecyclingDisruptors)}
												value={materialTier}
												onChange={setMaterialTier}
											/>
										</Field>
									) : (
										<div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
											Les sièges avec rembourrage utilisent une grille unique au
											poids. La matière n’est pas demandée.
										</div>
									)}
									{isComposition ? null : (
										<div className="space-y-2">
											<div>
												<p className="font-medium text-sm">Options Ecomaison</p>
												<p className="text-muted-foreground text-sm">
													Cochez uniquement les conditions vérifiées pour ce
													produit.
												</p>
											</div>
											<div className="grid gap-3 md:grid-cols-3">
												<ToggleLine
													checked={hasRecyclingDisruptors}
													description="Exemples : miroirs, éléments électriques ou assemblages qui gênent le recyclage."
													id="has-recycling-disruptors"
													label="Perturbateurs de recyclage"
													onChange={(checked) => {
														setHasRecyclingDisruptors(checked);
														if (checked) {
															setSustainableCertified(false);
															setEvolutionaryDesign(false);
														}
													}}
												/>
												<ToggleLine
													checked={sustainableCertified}
													description="FSC / PEFC ou équivalent, sans perturbateur. Utilise la colonne gestion durable quand elle existe."
													id="sustainable-certified"
													label="Gestion durable"
													onChange={setSustainableCertified}
												/>
												<ToggleLine
													checked={evolutionaryDesign}
													description="Multiples usages dès la conception, sans perturbateur. Applique la réduction de 15 %."
													id="evolutionary-design"
													label="Conception évolutive"
													onChange={setEvolutionaryDesign}
												/>
											</div>
										</div>
									)}
									{isComposition ? null : (
										<>
											{family === "Literie" ? (
												<Field label="Type de literie" required>
													<ChoiceGrid
														className="sm:grid-cols-3"
														compact
														options={literieTypeOptions}
														value={literieType}
														onChange={setLiterieType}
													/>
												</Field>
											) : null}
											{family === "Décoration textile" &&
											textileOptions.length > 1 ? (
												<Field label="Mode de calcul textile" required>
													<ChoiceGrid
														className="sm:grid-cols-2"
														compact
														options={textileOptions}
														value={textileMode}
														onChange={setTextileMode}
													/>
												</Field>
											) : null}
											<Field label="Taux de TVA" required>
												<ChoiceGrid
													className="sm:grid-cols-3"
													compact
													options={tvaOptions}
													value={tvaRate}
													onChange={setTvaRate}
												/>
											</Field>
										</>
									)}
									{materialWarning ? (
										<p className="text-sm text-destructive">
											Ce palier est réservé aux produits sans perturbateur.
											Choisissez une autre matière.
										</p>
									) : null}
									{!isComposition && tousMateriaux ? (
										<p className="text-sm text-amber-700 dark:text-amber-300">
											C’est le palier le plus élevé. Si la matière dominante est
											identifiable (&gt; 50 %), le montant sera généralement
											plus bas.
										</p>
									) : null}
								</div>
							) : null}

							{step === 3 ? (
								<div className="space-y-5">
									{shouldMeasureBase ? (
										<div className="rounded-md border border-primary/50 bg-primary/10 p-3 text-sm text-muted-foreground">
											Renseignez ici la base / structure créée avec la
											composition. Prix, mesure et calcul resteront éditables
											depuis la fiche composition.
										</div>
									) : null}
									{shouldMeasureBase ? (
										<Field label="Prix HT de la base" required>
											<Input
												inputMode="decimal"
												value={priceHt}
												onChange={(event) => setPriceHt(event.target.value)}
											/>
										</Field>
									) : null}
									<MeasurementFields
										family={family}
										preview={preview}
										setWeightKg={setWeightKg}
										setWidthCm={setWidthCm}
										textileMode={textileMode}
										weightKg={weightKg}
									/>
								</div>
							) : null}

							{step === 4 ? (
								isComposition ? (
									<div className="rounded-md border border-border bg-muted/40 p-5">
										<p className="text-lg font-semibold">
											Composition créée. Ajoutez des modules pour calculer
											l’éco-participation.
										</p>
										<p className="mt-2 text-muted-foreground text-sm">
											Chaque module aura sa propre matière, son propre poids et
											son propre calcul. Le total de la composition sera la
											somme des modules.
											{shouldCreateBaseModule
												? " La base / structure sera créée automatiquement et devra être complétée."
												: ""}
										</p>
										<Button
											className="mt-4"
											onClick={openPendingModuleDialog}
											type="button"
										>
											Ajouter un module
										</Button>
										{pendingModules.length > 0 ? (
											<div className="mt-5 space-y-2">
												<p className="font-medium text-sm">
													Modules à créer avec la composition
												</p>
												<div className="grid gap-2">
													{pendingModules.map((module) => (
														<div
															className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background/70 p-3 text-sm"
															key={module.id}
														>
															<div>
																<p className="font-medium">{module.name}</p>
																<p className="text-muted-foreground">
																	{module.category} ·{" "}
																	{moneyLabel(
																		Number(module.priceHt.replace(",", ".")),
																	)}{" "}
																	HT
																</p>
															</div>
															<Button
																onClick={() =>
																	setPendingModules(
																		pendingModules.filter(
																			(candidate) => candidate.id !== module.id,
																		),
																	)
																}
																type="button"
																variant="outline"
															>
																Retirer
															</Button>
														</div>
													))}
												</div>
											</div>
										) : null}
									</div>
								) : (
									<ResultSummary
										category={category}
										fabricReference={fabricReference}
										family={family}
										hasRecyclingDisruptors={hasRecyclingDisruptors}
										literieType={literieType}
										materialRequired={materialRequired}
										materialTier={materialTier}
										name={name}
										preview={preview}
										price={price}
										productKind={productKind}
										reference={reference}
										sustainableCertified={sustainableCertified}
										textileMode={textileMode}
										tva={tva}
										weightKg={weightKg}
										widthCm={widthCm}
										zone={zone}
										evolutionaryDesign={evolutionaryDesign}
									/>
								)
							) : null}
						</motion.div>
					</AnimatePresence>
				</CardContent>
			</Card>

			<PendingModuleDialog
				form={pendingModuleForm}
				onCategoryChange={handlePendingModuleCategoryChange}
				onChange={setPendingModuleForm}
				onOpenChange={setModuleDialogOpen}
				onSave={savePendingModule}
				open={moduleDialogOpen}
			/>

			<div
				className="fixed right-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6"
				style={{ left: actionBarLeft }}
			>
				<div className="mx-auto flex max-w-6xl justify-between gap-3">
					<Button
						disabled={step === 1}
						onClick={goToPreviousStep}
						type="button"
						variant="outline"
					>
						Retour
					</Button>
					{step < 4 ? (
						<Button
							disabled={Boolean(currentStepValidationError)}
							onClick={goToNextStep}
							title={currentStepValidationError ?? undefined}
							type="button"
						>
							Suivant
						</Button>
					) : (
						<Button onClick={() => void handleSave()} type="button">
							{isComposition
								? "Créer la composition"
								: "Enregistrer le produit"}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

function ResultSummary({
	category,
	evolutionaryDesign,
	fabricReference,
	family,
	hasRecyclingDisruptors,
	literieType,
	materialRequired,
	materialTier,
	name,
	preview,
	price,
	productKind,
	reference,
	sustainableCertified,
	textileMode,
	tva,
	weightKg,
	widthCm,
	zone,
}: {
	category: MolteniCategory;
	evolutionaryDesign: boolean;
	fabricReference: string;
	family: EcomaisonFamily;
	hasRecyclingDisruptors: boolean;
	literieType: string;
	materialRequired: boolean;
	materialTier: MaterialTier | "";
	name: string;
	preview: ReturnType<typeof previewEco>;
	price: number | null;
	productKind: ProductKind;
	reference: string;
	sustainableCertified: boolean;
	textileMode: string;
	tva: number;
	weightKg: string;
	widthCm: string;
	zone: ZoneValue;
}) {
	const ecoHt = preview.rate;
	const ecoTtc = preview.rate === null ? null : preview.rate * (1 + tva);
	const priceTtc = price === null ? null : price * (1 + tva);
	const calculationLabel = resultMeasurementLabel({
		activeLabel: preview.activeLabel,
		family,
		literieType,
		rate: preview.rate,
		textileMode,
		weightKg,
		widthCm,
	});
	const codeMessage = ecomaisonCodeMessage({
		code: preview.officialProductCode,
		family,
		textileMode,
		weightKg,
		widthCm,
	});
	const isCalculated = preview.rate !== null;

	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
			<div className="space-y-4">
				<div className="rounded-md border border-primary/50 bg-primary/15 p-5">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-muted-foreground text-sm">
								Éco-participation TTC
							</p>
							<p className="mt-2 font-serif text-5xl leading-none">
								{ecoTtc === null ? "En attente" : moneyLabel(ecoTtc)}
							</p>
						</div>
						<div className="flex size-12 items-center justify-center bg-primary text-primary-foreground">
							<BadgeEuro className="size-6" />
						</div>
					</div>
					<div className="mt-5 grid gap-2 sm:grid-cols-2">
						<SummaryMetric
							icon={BadgeEuro}
							label="HT"
							value={ecoHt === null ? "En attente" : moneyLabel(ecoHt)}
						/>
						<SummaryMetric
							icon={CheckCircle2}
							label="Statut"
							tone={isCalculated ? "success" : "warning"}
							value={isCalculated ? "Calculé" : "En attente"}
						/>
					</div>
				</div>
				<div className="rounded-md border border-border bg-muted/35 p-4">
					<div className="flex items-center gap-2 font-medium">
						<Package className="size-4 text-primary" />
						Produit saisi
					</div>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						<SummaryFact icon={Package} label="Nom" value={name || "-"} />
						<SummaryFact icon={MapPin} label="Zone" value={`Zone ${zone}`} />
						<SummaryFact icon={LayoutGrid} label="Catégorie" value={category} />
						<SummaryFact
							icon={Boxes}
							label="Type"
							value={productKindLabel(productKind)}
						/>
						<SummaryFact
							icon={Package}
							label="Référence"
							value={reference || "Non renseignée"}
						/>
						<SummaryFact
							icon={Shirt}
							label="Tissu / cuir"
							value={fabricReference || "Non renseigné"}
						/>
						<SummaryFact
							icon={BadgeEuro}
							label="Prix"
							value={
								priceTtc === null || price === null
									? "Non renseigné"
									: `${moneyLabel(priceTtc)} TTC / ${moneyLabel(price)} HT`
							}
						/>
						<SummaryFact
							icon={BadgeEuro}
							label="TVA"
							value={`${Math.round(tva * 1000) / 10} %`}
						/>
					</div>
				</div>
			</div>

			<div className="space-y-4">
				<div className="rounded-md border border-border p-4">
					<div className="flex items-center gap-2 font-medium">
						<CheckCircle2 className="size-4 text-primary" />
						Détail du calcul
					</div>
					<div className="mt-4 grid gap-3">
						<SummaryFact
							icon={Rows3}
							label="Famille Ecomaison"
							value={family}
						/>
						{materialRequired ? (
							<SummaryFact
								icon={materialTier ? materialIcon(materialTier) : Circle}
								label="Matière dominante"
								value={
									materialTier
										? materialTierLabel(materialTier)
										: "À renseigner"
								}
							/>
						) : null}
						<SummaryFact
							icon={measurementIcon(family, textileMode)}
							label={measurementSummaryLabel(family, textileMode)}
							value={calculationLabel}
						/>
						<SummaryFact
							icon={Recycle}
							label="Perturbateurs"
							value={hasRecyclingDisruptors ? "Oui" : "Non"}
						/>
						<SummaryFact
							icon={Leaf}
							label="Gestion durable"
							value={sustainableCertified ? "FSC / PEFC" : "Non"}
						/>
						<SummaryFact
							icon={Blocks}
							label="Conception évolutive"
							value={evolutionaryDesign ? "Réduction 15 %" : "Non"}
						/>
					</div>
				</div>
				<div
					className={`rounded-md border p-4 ${
						preview.officialProductCode
							? "border-emerald-500/30 bg-emerald-500/10"
							: "border-amber-500/40 bg-amber-500/10"
					}`}
				>
					<div className="flex items-start gap-3">
						<div
							className={`flex size-10 shrink-0 items-center justify-center ${
								preview.officialProductCode
									? "bg-emerald-600 text-white"
									: "bg-amber-500 text-black"
							}`}
						>
							{preview.officialProductCode ? (
								<CheckCircle2 className="size-5" />
							) : (
								<Recycle className="size-5" />
							)}
						</div>
						<div>
							<p className="font-medium">Code Ecomaison à 11 chiffres</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{codeMessage}
							</p>
							{preview.officialProductCode ? (
								<p className="mt-3 font-mono text-lg tracking-normal">
									{preview.officialProductCode}
								</p>
							) : null}
						</div>
					</div>
				</div>
				<p className="text-muted-foreground text-sm">
					L’éco-participation doit être affichée séparément du prix produit.
				</p>
			</div>
		</div>
	);
}

function PendingModuleDialog({
	form,
	onCategoryChange,
	onChange,
	onOpenChange,
	onSave,
	open,
}: {
	form: PendingModule;
	onCategoryChange: (category: MolteniCategory) => void;
	onChange: (form: PendingModule) => void;
	onOpenChange: (open: boolean) => void;
	onSave: () => void;
	open: boolean;
}) {
	const needsMaterial = isMaterialRequired(form.family);
	const needsWidth = form.family === "Literie";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Ajouter un module</DialogTitle>
					<DialogDescription>
						Le module sera créé en même temps que la composition.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<div className="grid gap-4 md:grid-cols-2">
						<Field label="Nom" required>
							<Input
								value={form.name}
								onChange={(event) =>
									onChange({ ...form, name: event.target.value })
								}
							/>
						</Field>
						<Field label="Prix HT" required>
							<Input
								inputMode="decimal"
								value={form.priceHt}
								onChange={(event) =>
									onChange({ ...form, priceHt: event.target.value })
								}
							/>
						</Field>
					</div>
					<Field label="Catégorie Molteni" required>
						<ChoiceGrid
							className="sm:grid-cols-2 xl:grid-cols-4"
							options={categoryOptions}
							value={form.category}
							onChange={onCategoryChange}
						/>
					</Field>
					<Field label="Famille Ecomaison" required>
						<ChoiceGrid
							className="sm:grid-cols-2 xl:grid-cols-5"
							options={familyOptions}
							value={form.family}
							onChange={(family) =>
								onChange({
									...form,
									family,
									materialTier: isMaterialRequired(family)
										? form.materialTier
										: "",
								})
							}
						/>
					</Field>
					{needsMaterial ? (
						<Field label="Matière dominante" required>
							<ChoiceGrid
								className="sm:grid-cols-2 xl:grid-cols-3"
								options={materialOptions(false)}
								value={form.materialTier}
								onChange={(materialTier) => onChange({ ...form, materialTier })}
							/>
						</Field>
					) : null}
					<Field label={needsWidth ? "Largeur" : "Poids"} required>
						<Input
							inputMode="decimal"
							value={needsWidth ? form.widthCm : form.weightKg}
							onChange={(event) =>
								onChange(
									needsWidth
										? { ...form, widthCm: event.target.value }
										: { ...form, weightKg: event.target.value },
								)
							}
						/>
					</Field>
					<Field label="Notes" optional>
						<Textarea
							value={form.notes}
							onChange={(event) =>
								onChange({ ...form, notes: event.target.value })
							}
						/>
					</Field>
				</div>
				<DialogFooter>
					<Button onClick={onSave} type="button">
						Ajouter
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function SummaryMetric({
	icon: Icon,
	label,
	tone,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	tone?: "success" | "warning";
	value: string;
}) {
	const toneClass =
		tone === "success"
			? "text-emerald-700 dark:text-emerald-300"
			: tone === "warning"
				? "text-amber-700 dark:text-amber-300"
				: "text-foreground";
	return (
		<div className="border border-border bg-background/60 p-3">
			<div className="flex items-center gap-2 text-muted-foreground text-xs">
				<Icon className="size-3.5" />
				{label}
			</div>
			<p className={`mt-1 font-medium ${toneClass}`}>{value}</p>
		</div>
	);
}

function SummaryFact({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-start gap-3">
			<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center bg-primary/15 text-primary">
				<Icon className="size-4" />
			</div>
			<div className="min-w-0">
				<p className="text-muted-foreground text-xs uppercase tracking-normal">
					{label}
				</p>
				<p className="break-words font-medium text-sm">{value}</p>
			</div>
		</div>
	);
}

function Field({
	children,
	label,
	optional,
	required,
}: {
	children: React.ReactNode;
	label: string;
	optional?: boolean;
	required?: boolean;
}) {
	return (
		<div className="space-y-2">
			<div className="flex min-h-5 items-baseline gap-1.5">
				<Label className="leading-5">{label}</Label>
				{required ? (
					<span
						aria-label="obligatoire"
						className="text-destructive text-sm leading-5"
					>
						*
					</span>
				) : null}
				{optional ? (
					<span className="text-muted-foreground text-xs leading-5">
						optionnel
					</span>
				) : null}
			</div>
			{children}
		</div>
	);
}

function ToggleLine({
	checked,
	description,
	id,
	label,
	onChange,
}: {
	checked: boolean;
	description: string;
	id: string;
	label: string;
	onChange: (checked: boolean) => void;
}) {
	return (
		<Label
			className="flex min-h-24 items-start gap-3 rounded-md border border-border p-3"
			htmlFor={id}
		>
			<Checkbox
				checked={checked}
				id={id}
				onCheckedChange={(value) => onChange(Boolean(value))}
			/>
			<span>
				<span className="block font-medium text-sm">{label}</span>
				<span className="mt-1 block text-muted-foreground text-xs leading-snug">
					{description}
				</span>
			</span>
		</Label>
	);
}

function MeasurementFields({
	family,
	preview,
	setWeightKg,
	setWidthCm,
	textileMode,
	weightKg,
}: {
	family: EcomaisonFamily;
	preview: ReturnType<typeof previewEco>;
	setWeightKg: (value: string) => void;
	setWidthCm: (value: string) => void;
	textileMode: string;
	weightKg: string;
}) {
	if (family === "Décoration textile" && textileMode === "piece") {
		return (
			<div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
				Le tarif textile à la pièce ne demande pas de poids à cette étape.
			</div>
		);
	}
	if (textileMode === "surface") {
		const surfaceRate = preview.unitRate;
		return (
			<div className="rounded-md border border-border p-4">
				<p className="font-medium">Renseigner la surface du tapis</p>
				<p className="mt-1 max-w-3xl text-muted-foreground text-sm">
					Utilisez la surface totale du tapis complet en m², calculée avec la
					longueur multipliée par la largeur. Il ne s’agit pas d’une tranche :
					le barème textile applique un montant par m².
				</p>
				<div className="mt-4 max-w-sm space-y-2">
					<Label htmlFor="surface-m2">Surface (m²)</Label>
					<Input
						id="surface-m2"
						inputMode="decimal"
						onChange={(event) => setWeightKg(event.target.value)}
						placeholder="Ex. 6,5"
						value={weightKg}
					/>
				</div>
				{surfaceRate === null ? null : (
					<p className="mt-3 text-muted-foreground text-sm">
						Tarif officiel : {surfaceRate.toFixed(2)} € HT par m².
					</p>
				)}
			</div>
		);
	}
	if (preview.brackets.length === 0) {
		return (
			<div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
				Cette famille utilise une règle spécifique que l’assistant de saisie ne
				peut pas encore prévisualiser.
			</div>
		);
	}

	const sliderValue =
		preview.activeIndex >= 0
			? preview.activeIndex
			: preview.brackets.length - 1;
	const selectedBracket = preview.brackets[sliderValue] ?? preview.brackets[0];
	const shouldUseRadioButtons = preview.brackets.length < 6;
	const selectBracket = (index: number) => {
		const bracket = preview.brackets[index];
		if (!bracket) return;
		if (bracket.isWidth) {
			setWidthCm(String(bracket.value));
			return;
		}
		setWeightKg(String(bracket.value));
	};

	return (
		<div className="rounded-md border border-border p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="font-medium">{measurementPickerTitle(family)}</p>
					<p className="mt-1 max-w-3xl text-muted-foreground text-sm">
						{measurementPickerHelp(family)}
					</p>
				</div>
				<div className="border border-border bg-muted/40 px-3 py-2 text-right">
					<p className="text-muted-foreground text-xs uppercase tracking-normal">
						Tranche sélectionnée
					</p>
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.p
							animate={{ opacity: 1, y: 0 }}
							className="font-medium text-lg"
							exit={{ opacity: 0, y: -6 }}
							initial={{ opacity: 0, y: 6 }}
							key={selectedBracket?.displayLabel ?? "empty"}
							transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }}
						>
							{selectedBracket?.displayLabel ?? "À sélectionner"}
						</motion.p>
					</AnimatePresence>
				</div>
			</div>
			{shouldUseRadioButtons ? (
				<div
					aria-label="Choisir la tranche officielle"
					className="mt-6 grid gap-2 sm:grid-cols-3"
					role="radiogroup"
				>
					{preview.brackets.map((bracket, index) => {
						const id = `measurement-bracket-${index}`;
						return (
							<Label
								className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-[background-color,border-color,box-shadow] ${index === sliderValue ? "border-primary bg-primary/15 ring-2 ring-primary ring-offset-0" : "border-border bg-input/40 hover:bg-input/60"}`}
								htmlFor={id}
								key={bracket.label}
							>
								<input
									checked={index === sliderValue}
									className="size-4 accent-primary"
									id={id}
									name="measurement-bracket"
									onChange={() => selectBracket(index)}
									type="radio"
								/>
								<span className="font-medium text-sm">
									{bracket.displayLabel}
								</span>
							</Label>
						);
					})}
				</div>
			) : (
				<>
					<input
						aria-label="Choisir la tranche officielle"
						className="mt-6 w-full accent-primary"
						max={preview.brackets.length - 1}
						min={0}
						onChange={(event) => selectBracket(Number(event.target.value))}
						step={1}
						type="range"
						value={sliderValue}
					/>
					<div className="mt-2 flex justify-between gap-3 text-muted-foreground text-xs">
						<span>{preview.brackets[0]?.displayLabel}</span>
						<span className="text-right">
							{preview.brackets[preview.brackets.length - 1]?.displayLabel}
						</span>
					</div>
				</>
			)}
			{preview.nearBoundary ? (
				<p className="mt-3 text-amber-700 text-sm dark:text-amber-300">
					Proche d’une limite de tranche : vérifiez la mesure.
				</p>
			) : null}
		</div>
	);
}

function stepTitle(step: number, shouldMeasureBase: boolean) {
	if (step === 3 && shouldMeasureBase) return "Base / Structure";
	return ["Identité", "Classification", "Mesure", "Résultat"][step - 1];
}

function stepDescription(step: number, shouldMeasureBase: boolean) {
	if (step === 3 && shouldMeasureBase) {
		return "Prix et mesure de la base obligatoire créée avec la composition.";
	}
	return [
		"Nom, catégorie, zone et type de produit.",
		"Famille réglementaire, matière, TVA et éco-modulations.",
		"Poids, largeur, prix et configuration exposée.",
		"Résultat calculé et statut du code officiel.",
	][step - 1];
}

function parseNumber(value: string) {
	const normalized = value.replace(",", ".").trim();
	if (!normalized) return null;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function scrollToPageTop() {
	window.requestAnimationFrame(() => {
		window.scrollTo({ behavior: "smooth", top: 0 });
	});
}

function formatEditableNumber(value: number | null | undefined) {
	return value === null || value === undefined ? "" : String(value);
}

function emptyPendingModule(category: MolteniCategory): PendingModule {
	const family = getDefaultFamily(category);
	return {
		id: crypto.randomUUID(),
		name: "",
		category,
		family,
		materialTier: "",
		priceHt: "",
		weightKg: "",
		widthCm: "",
		notes: "",
	};
}

function previewEco(
	family: EcomaisonFamily,
	materialTier: MaterialTier | "",
	weight: number | null,
	width: number | null,
	textileMode: string,
) {
	const brackets = ecomaison2026Bareme.entries
		.filter((entry) => {
			if (entry.family !== family) return false;
			if (family === "Meuble" || family === "Siège sans rembourrage") {
				return "materialTier" in entry && entry.materialTier === materialTier;
			}
			if (family === "Décoration textile") {
				const measurementKind =
					textileMode === "surface" ? "surface" : "weight";
				return (
					"measurementKind" in entry &&
					entry.measurementKind === measurementKind
				);
			}
			return family === "Siège avec rembourrage" || family === "Literie";
		})
		.map((entry) => {
			const normalized = entry as {
				weightMin?: number;
				weightMax?: number;
				widthMin?: number;
				widthMax?: number;
				measurementKind?: string;
				rateHt: number;
				label: string;
				officialProductCode: string;
			};
			return {
				min: normalized.widthMin ?? normalized.weightMin ?? 0,
				max: normalized.widthMax ?? normalized.weightMax,
				rate: normalized.rateHt,
				label: normalized.label,
				officialProductCode: normalized.officialProductCode,
				isWidth: normalized.widthMin !== undefined,
				isSurface: normalized.measurementKind === "surface",
			};
		})
		.sort((left, right) => left.min - right.min);
	const active = brackets.find((bracket) => {
		const measurement = bracket.isWidth ? width : weight;
		if (measurement === null) return false;
		if (bracket.isSurface) return measurement > 0;
		const max = bracket.max ?? Number.POSITIVE_INFINITY;
		return bracket.isWidth
			? measurement > bracket.min && measurement <= max
			: measurement >= bracket.min && measurement < max;
	});
	const activeIndex = active ? brackets.indexOf(active) : -1;
	const surfaceReference = textileMode === "surface" ? brackets[0] : undefined;
	const unitRate = active?.rate ?? surfaceReference?.rate ?? null;
	const rate =
		unitRate === null
			? null
			: textileMode === "surface"
				? weight === null || weight <= 0
					? null
					: roundPreviewMoney(unitRate * weight)
				: unitRate;
	return {
		brackets: brackets.map((bracket) => ({
			label: bracket.label,
			displayLabel: bracketDisplayLabel(bracket),
			active: bracket === active,
			isWidth: bracket.isWidth,
			value: bracketValue(bracket),
		})),
		activeLabel: active?.label ?? null,
		activeIndex,
		officialProductCode: active?.officialProductCode ?? null,
		rate,
		unitRate,
		nearBoundary: brackets.some((bracket) => {
			const measurement = bracket.isWidth ? width : weight;
			if (!bracket.isWidth) return false;
			if (measurement === null) return false;
			if (bracket.max === undefined) return false;
			return Math.abs(measurement - bracket.max) <= bracket.max * 0.05;
		}),
	};
}

function roundPreviewMoney(value: number) {
	return Math.round(value * 100) / 100;
}

function bracketValue(bracket: { min: number; max?: number }) {
	if (bracket.max === undefined) return bracket.min + 1;
	return (bracket.min + bracket.max) / 2;
}

function bracketDisplayLabel(bracket: {
	min: number;
	max?: number;
	isWidth: boolean;
}) {
	const unit = bracket.isWidth ? "cm" : "kg";
	if (bracket.min === 0 && bracket.max !== undefined) {
		return `< ${formatBracketNumber(bracket.max)} ${unit}`;
	}
	if (bracket.max === undefined) {
		return `> ${formatBracketNumber(bracket.min)} ${unit}`;
	}
	return `${formatBracketNumber(bracket.min)}-${formatBracketNumber(bracket.max)} ${unit}`;
}

function formatBracketNumber(value: number) {
	return new Intl.NumberFormat("fr-FR", {
		maximumFractionDigits: 1,
	}).format(value);
}

function measurementPickerTitle(family: EcomaisonFamily) {
	return family === "Literie"
		? "Choisir la tranche de largeur"
		: "Choisir la tranche de poids";
}

function measurementPickerHelp(family: EcomaisonFamily) {
	if (family === "Literie") {
		return "Utilisez la largeur du couchage complet concerné. Le barème fonctionne par tranches officielles, pas au centimètre près.";
	}
	return "Utilisez le poids du produit complet, ou du module complet si vous créez un module. Il ne s’agit pas du poids de la matière dominante seule : emballage exclu, produit fini complet.";
}

function materialOptions(
	hasRecyclingDisruptors: boolean,
): ChoiceOption<MaterialTier>[] {
	return MATERIAL_TIERS.map((tier) => ({
		description: `${tier.description} Ex: ${tier.example}${tier.requiresNoDisruptors ? " Sans perturbateur uniquement." : ""}`,
		disabled: !isMaterialAllowedWithDisruptors(
			tier.key,
			hasRecyclingDisruptors,
		),
		icon: materialIcon(tier.key),
		label: tier.label,
		value: tier.key,
	}));
}

function materialIcon(tier: MaterialTier) {
	if (tier.startsWith("bois")) return TreePine;
	if (tier.startsWith("metal")) return Hammer;
	if (tier === "plastique_95" || tier === "plastique") return Blocks;
	if (tier.startsWith("synthetique")) return Blocks;
	if (tier === "ceramique") return Gem;
	if (tier === "biosource_50") return Leaf;
	return Circle;
}

function textileModeLabel(value: string) {
	if (value === "surface") return "surface m²";
	if (value === "piece") return "prix à la pièce";
	return "poids";
}

function productKindLabel(value: ProductKind) {
	if (value === "composition") return "Composition";
	if (value === "module") return "Module";
	return "Produit simple";
}

function measurementIcon(family: EcomaisonFamily, textileMode: string) {
	if (family === "Literie") return Ruler;
	if (family === "Décoration textile" && textileMode === "surface") {
		return Grid2X2;
	}
	if (family === "Décoration textile" && textileMode === "piece") {
		return Shirt;
	}
	return Weight;
}

function measurementSummaryLabel(family: EcomaisonFamily, textileMode: string) {
	if (family === "Literie") return "Largeur";
	if (family === "Décoration textile" && textileMode === "surface") {
		return "Surface";
	}
	if (family === "Décoration textile" && textileMode === "piece") {
		return "Unité";
	}
	return "Tranche de poids";
}

function moneyLabel(value: number) {
	return new Intl.NumberFormat("fr-FR", {
		currency: "EUR",
		style: "currency",
	}).format(value);
}

function materialTierLabel(value: MaterialTier | "") {
	return MATERIAL_TIERS.find((tier) => tier.key === value)?.label ?? value;
}

function ecomaisonCodeMessage({
	code,
	family,
	textileMode,
	weightKg,
	widthCm,
}: {
	code: string | null;
	family: EcomaisonFamily;
	textileMode: string;
	weightKg: string;
	widthCm: string;
}) {
	if (code) return `Code Ecomaison à 11 chiffres : ${code}`;
	const needsWidth = family === "Literie";
	const needsWeight =
		family !== "Literie" &&
		!(family === "Décoration textile" && textileMode === "piece");
	if (needsWidth && !widthCm.trim()) {
		return "Code Ecomaison à 11 chiffres : renseignez la largeur pour identifier la tranche officielle.";
	}
	if (family === "Décoration textile" && textileMode === "surface") {
		if (!weightKg.trim()) {
			return "Code Ecomaison à 11 chiffres : renseignez la surface pour appliquer le tarif au m².";
		}
		return "Code Ecomaison à 11 chiffres : aucune correspondance officielle ne couvre cette surface.";
	}
	if (needsWeight && !weightKg.trim()) {
		return "Code Ecomaison à 11 chiffres : renseignez le poids pour identifier la tranche officielle.";
	}
	return "Code Ecomaison à 11 chiffres : aucune tranche officielle ne correspond à cette mesure.";
}

function resultMeasurementLabel({
	activeLabel,
	family,
	literieType,
	rate,
	textileMode,
	weightKg,
	widthCm,
}: {
	activeLabel: string | null;
	family: EcomaisonFamily;
	literieType: string;
	rate: number | null;
	textileMode: string;
	weightKg: string;
	widthCm: string;
}) {
	if (family === "Literie") {
		if (!widthCm.trim()) return `${literieType} x largeur à renseigner`;
		return `${literieType} x ${widthCm} cm`;
	}
	if (family === "Décoration textile") {
		if (textileMode === "surface") {
			if (!weightKg.trim()) return "surface du tapis à renseigner";
			return `tarif au m² x ${weightKg} m²`;
		}
		if (textileMode !== "piece" && !weightKg.trim()) {
			return `${textileModeLabel(textileMode)} x mesure à renseigner`;
		}
		return `${textileModeLabel(textileMode)} x ${activeLabel ?? "tranche non trouvée"}`;
	}
	if (!weightKg.trim()) return "poids à renseigner";
	return (
		activeLabel ??
		(rate === null ? "tranche non trouvée" : "tranche officielle")
	);
}

const zoneOptions: ChoiceOption<ZoneValue>[] = ZONES.map((zone) => ({
	description: "Showroom de Lyon",
	icon: MapPin,
	label: `Zone ${zone}`,
	value: zone,
}));

const categoryOptions: ChoiceOption<MolteniCategory>[] = [
	{
		value: "Fauteuil",
		label: "Fauteuil",
		description: "Siège rembourré par défaut. Matière non demandée.",
		icon: Armchair,
	},
	{
		value: "Chaise",
		label: "Chaise",
		description:
			"Non rembourrée par défaut. Passez en rembourré si l’assise est garnie.",
		icon: Armchair,
	},
	{
		value: "Canapé",
		label: "Canapé",
		description: "Siège rembourré. La matière n’entre pas dans le calcul.",
		icon: Sofa,
	},
	{
		value: "Pouf",
		label: "Pouf",
		description: "Toujours traité comme siège rembourré.",
		icon: Circle,
	},
	{
		value: "Table",
		label: "Table",
		description: "Famille Meuble. Poids et matière dominante nécessaires.",
		icon: Table2,
	},
	{
		value: "Table basse",
		label: "Table basse",
		description:
			"Vérifiez la matière dominante : bois, métal, pierre, verre ou mixte.",
		icon: Table2,
	},
	{
		value: "Table lounge",
		label: "Table lounge",
		description: "Famille Meuble. Même logique qu’une table basse.",
		icon: Table2,
	},
	{
		value: "Meuble nuit",
		label: "Meuble nuit",
		description: "Famille Meuble. Matière dominante à confirmer.",
		icon: Box,
	},
	{
		value: "Bibliothèque",
		label: "Bibliothèque",
		description: "Famille Meuble. Souvent bois ou mixte.",
		icon: LibraryBig,
	},
	{
		value: "Banc",
		label: "Banc",
		description:
			"Non rembourré par défaut. Passez en rembourré si l’assise est garnie.",
		icon: Rows3,
	},
	{
		value: "Lit",
		label: "Lit",
		description: "Cadre de lit = Meuble. Matelas ou sommier = Literie.",
		icon: Bed,
	},
	{
		value: "Matelas",
		label: "Matelas",
		description: "Famille Literie. Calcul par largeur.",
		icon: Bed,
	},
	{
		value: "Plaid",
		label: "Plaid",
		description: "Décoration textile. Tarif à la pièce.",
		icon: Shirt,
	},
	{
		value: "Tapis",
		label: "Tapis",
		description: "Décoration textile. Calcul au poids ou à la surface.",
		icon: Grid2X2,
	},
	{
		value: "Coussin",
		label: "Coussin",
		description: "Décoration textile. Tarif à la pièce.",
		icon: Shirt,
	},
	{
		value: "Cuisine",
		label: "Cuisine",
		description:
			"Souvent une composition. TVA réduite possible selon le chantier.",
		icon: ChefHat,
	},
	{
		value: "Dressing",
		label: "Dressing",
		description: "Souvent une composition de modules.",
		icon: DoorOpen,
	},
];

const familyOptions: ChoiceOption<EcomaisonFamily>[] = ECOMAISON_FAMILIES.map(
	(family) => ({
		description: familyDescription(family),
		icon: familyIcon(family),
		label: family,
		value: family,
	}),
);

const productTypeOptions: ChoiceOption<ProductKind>[] = [
	{
		value: "standalone",
		label: "Produit simple",
		description: "Produit exposé avec sa propre éco-participation.",
		icon: Package,
	},
	{
		value: "composition",
		label: "Composition",
		description: "Total calculé par somme des éco-participations des modules.",
		icon: Boxes,
	},
	{
		value: "module",
		label: "Module",
		description: "Élément rattaché à une composition, calculé séparément.",
		icon: Blocks,
	},
];

const literieTypeOptions: ChoiceOption<string>[] = [
	{ value: "matelas", label: "Matelas", icon: Bed },
	{ value: "sommier", label: "Sommier", icon: LayoutGrid },
	{ value: "tete_de_lit", label: "Tête de lit", icon: Ruler },
];

const textileModeOptions: ChoiceOption<string>[] = [
	{ value: "weight", label: "Poids", icon: Weight },
	{ value: "surface", label: "Surface m²", icon: Grid2X2 },
	{ value: "piece", label: "À la pièce", icon: BadgeEuro },
];

function textileModeOptionsForCategory(category: MolteniCategory) {
	if (category === "Tapis") {
		return textileModeOptions.filter((option) => option.value !== "piece");
	}
	if (category === "Plaid" || category === "Coussin") {
		return textileModeOptions.filter((option) => option.value === "piece");
	}
	return textileModeOptions.filter((option) => option.value === "weight");
}

function inferTextileMode(category: MolteniCategory) {
	if (category === "Plaid" || category === "Coussin") return "piece";
	return "weight";
}

const tvaOptions: ChoiceOption<string>[] = [
	{ value: "0.2", label: "20%", description: "Défaut", icon: BadgeEuro },
	{
		value: "0.1",
		label: "10%",
		description: "Cuisine en rénovation",
		icon: ChefHat,
	},
	{
		value: "0.055",
		label: "5,5%",
		description: "Cas réduit éligible",
		icon: Leaf,
	},
];

function familyIcon(family: EcomaisonFamily) {
	if (family === "Meuble") return Box;
	if (family === "Siège sans rembourrage") return Armchair;
	if (family === "Siège avec rembourrage") return Sofa;
	if (family === "Literie") return Bed;
	return Shirt;
}

function familyDescription(family: EcomaisonFamily) {
	if (family === "Meuble") return "Poids + matière dominante.";
	if (family === "Siège sans rembourrage") return "Poids + matière dominante.";
	if (family === "Siège avec rembourrage") return "Poids uniquement.";
	if (family === "Literie") return "Largeur, type et perturbateur.";
	return "Poids, surface ou tarif à la pièce selon le textile.";
}
