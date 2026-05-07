export const SHOWROOM_KEY = "lyon";

export const ZONES = ["A", "B", "C", "D", "F", "G", "H", "Outdoor"] as const;

export const MOLTENI_CATEGORIES = [
	"Fauteuil",
	"Chaise",
	"Canapé",
	"Pouf",
	"Table",
	"Bureau",
	"Table basse",
	"Table lounge",
	"Meuble nuit",
	"Bibliothèque",
	"Banc",
	"Lit",
	"Matelas",
	"Plaid",
	"Tapis",
	"Coussin",
	"Cuisine",
	"Dressing",
] as const;

export const ECOMAISON_FAMILIES = [
	"Meuble",
	"Siège sans rembourrage",
	"Siège avec rembourrage",
	"Literie",
	"Décoration textile",
] as const;

export const PRODUCT_STATUSES = ["active", "deleted"] as const;

export const MATERIAL_TIERS = [
	{
		key: "bois_massif_95",
		label: "Bois massif > 95%",
		description: "Presque entièrement en bois massif.",
		example: "Table en noyer massif",
		requiresNoDisruptors: false,
	},
	{
		key: "bois_75",
		label: "Bois massif ou panneaux > 75%",
		description: "Majorité bois, panneaux inclus.",
		example: "Bibliothèque en panneaux bois",
		requiresNoDisruptors: true,
	},
	{
		key: "bois_50",
		label: "Tout type de bois et dérivés > 50%",
		description: "Bois majoritaire, MDF ou particules compris.",
		example: "Meuble nuit bois et métal",
		requiresNoDisruptors: false,
	},
	{
		key: "metal_95",
		label: "Métal > 95%",
		description: "Structure presque entièrement métallique.",
		example: "Chaise métal",
		requiresNoDisruptors: false,
	},
	{
		key: "metal_75",
		label: "Métal > 75%",
		description: "Métal très majoritaire, mais pas entièrement métallique.",
		example: "Table à structure métallique dominante",
		requiresNoDisruptors: false,
	},
	{
		key: "metal_50",
		label: "Métal > 50%",
		description: "Métal dominant dans la composition.",
		example: "Table basse structure métal",
		requiresNoDisruptors: true,
	},
	{
		key: "plastique_95",
		label: "Plastique monorésine > 95%",
		description: "Plastique d'une seule résine.",
		example: "Assise plastique monomatière",
		requiresNoDisruptors: false,
	},
	{
		key: "plastique",
		label: "Plastiques",
		description:
			"Plastique dominant, sans atteindre le seuil monorésine > 95%.",
		example: "Élément majoritairement plastique",
		requiresNoDisruptors: false,
	},
	{
		key: "synthetique_95",
		label: "Autre matériau synthétique recyclable > 95%",
		description:
			"Synthétique recyclable presque exclusif, hors plastique monorésine.",
		example: "Élément en fibre ou caoutchouc synthétique recyclable",
		requiresNoDisruptors: false,
	},
	{
		key: "synthetique_50",
		label: "Matériaux ou fibres synthétiques > 50%",
		description: "Synthétique majoritaire, mais inférieur au seuil > 95%.",
		example: "Composition majoritairement synthétique",
		requiresNoDisruptors: false,
	},
	{
		key: "ceramique",
		label: "Céramique / verre",
		description: "Marbre, pierre, verre ou matériaux inertes.",
		example: "Table basse marbre",
		requiresNoDisruptors: false,
	},
	{
		key: "biosource_50",
		label: "Matériaux biosourcés > 50%",
		description: "Matériaux biosourcés majoritaires.",
		example: "Accessoire textile biosourcé",
		requiresNoDisruptors: false,
	},
	{
		key: "tous_materiaux",
		label: "Assemblage de matériaux ou matériau avec perturbateur de recyclage",
		description:
			"Aucun matériau dominant éligible, matériau inconnu, ou produit avec perturbateur.",
		example: "Produit mixte sans dominante ou avec miroir/équipement gênant",
		requiresNoDisruptors: false,
	},
] as const;

export type MolteniCategory = (typeof MOLTENI_CATEGORIES)[number];
export type EcomaisonFamily = (typeof ECOMAISON_FAMILIES)[number];
export type MaterialTier = (typeof MATERIAL_TIERS)[number]["key"];
export type Zone = (typeof ZONES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CATEGORY_FAMILY_MAP: Record<MolteniCategory, EcomaisonFamily> = {
	Fauteuil: "Siège avec rembourrage",
	Chaise: "Siège sans rembourrage",
	Canapé: "Siège avec rembourrage",
	Pouf: "Siège avec rembourrage",
	Table: "Meuble",
	Bureau: "Meuble",
	"Table basse": "Meuble",
	"Table lounge": "Meuble",
	"Meuble nuit": "Meuble",
	Bibliothèque: "Meuble",
	Banc: "Siège sans rembourrage",
	Lit: "Meuble",
	Matelas: "Literie",
	Plaid: "Décoration textile",
	Tapis: "Décoration textile",
	Coussin: "Décoration textile",
	Cuisine: "Meuble",
	Dressing: "Meuble",
};

export const AMBIGUOUS_CATEGORIES = ["Chaise", "Banc", "Lit"] as const;

export function getDefaultFamily(category: MolteniCategory): EcomaisonFamily {
	return CATEGORY_FAMILY_MAP[category];
}

export function isMaterialRequired(family: EcomaisonFamily): boolean {
	return family === "Meuble" || family === "Siège sans rembourrage";
}

export function isMaterialAllowedWithDisruptors(
	materialTier: MaterialTier,
	hasRecyclingDisruptors: boolean,
): boolean {
	if (!hasRecyclingDisruptors) return true;
	const tier = MATERIAL_TIERS.find((material) => material.key === materialTier);
	return !tier?.requiresNoDisruptors;
}

export function getProductTypeLabel(product: {
	isComposition: boolean;
	parentId: string | null;
}): "Composition" | "Module" | "Produit simple" {
	if (product.parentId) return "Module";
	if (product.isComposition) return "Composition";
	return "Produit simple";
}

export function formatEuro(value: number | null | undefined): string {
	if (value === null || value === undefined) return "En attente";
	return new Intl.NumberFormat("fr-FR", {
		currency: "EUR",
		style: "currency",
	}).format(value);
}

export function roundMoney(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}
