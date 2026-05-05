import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "~/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { ecomaison2026Bareme } from "../../shared/ecomaison/generated/bareme-2026";
import {
	CATEGORY_FAMILY_MAP,
	ECOMAISON_FAMILIES,
	MATERIAL_TIERS,
	MOLTENI_CATEGORIES,
} from "../../shared/ecomaison/taxonomy";

export const Route = createFileRoute("/dashboard/reference")({
	staticData: {
		dashboardHeader: {
			description: "Simple French guide for showroom staff",
			title: "Eco-tax reference",
		},
	},
	component: ReferencePage,
});

function ReferencePage() {
	return (
		<article className="mx-auto max-w-5xl space-y-6 print:max-w-none">
			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>1. Qu'est-ce que l'éco-participation ?</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 leading-7 text-muted-foreground">
					<p>
						L'éco-participation n'est pas une taxe. C'est une contribution
						obligatoire qui finance la collecte, le tri et le recyclage du
						mobilier.
					</p>
					<p>
						Elle doit être affichée séparément sur chaque étiquette de prix et
						sur chaque facture, en appliquant le même taux de TVA que l'article.
					</p>
					<p>
						Le montant vient d'un barème publié par Ecomaison. L'application
						utilise le générateur {ecomaison2026Bareme.year}, applicable depuis
						le {formatDate(ecomaison2026Bareme.effectiveFrom)}.
					</p>
				</CardContent>
			</Card>

			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>Source active</CardTitle>
					<CardDescription>
						Données utilisées par les calculs de l'application.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
					<ReferenceMetric
						label="Année"
						value={String(ecomaison2026Bareme.year)}
					/>
					<ReferenceMetric
						label="Applicable depuis"
						value={formatDate(ecomaison2026Bareme.effectiveFrom)}
					/>
					<ReferenceMetric
						label="Lignes importées"
						value={String(ecomaison2026Bareme.generatedEntries)}
					/>
					<ReferenceMetric
						label="Générateur"
						value={ecomaison2026Bareme.sourceName}
					/>
					<a
						className="text-muted-foreground underline underline-offset-4 sm:col-span-2 lg:col-span-4"
						href={ecomaison2026Bareme.sourceUrl}
						rel="noreferrer"
						target="_blank"
					>
						Fichier source Ecomaison
					</a>
				</CardContent>
			</Card>

			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>2. Le double classement</CardTitle>
					<CardDescription>
						On part du langage Molteni, puis on traduit en famille Ecomaison.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Catégorie Molteni</TableHead>
								<TableHead>Famille Ecomaison par défaut</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{MOLTENI_CATEGORIES.map((category) => (
								<TableRow key={category}>
									<TableCell>{category}</TableCell>
									<TableCell>{CATEGORY_FAMILY_MAP[category]}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					<div className="space-y-3">
						{familySummaries.map((summary) => (
							<div
								className="rounded-md border border-border p-3"
								key={summary.family}
							>
								<p className="font-medium">{summary.family}</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{summary.inputSummary}
								</p>
								<p className="mt-2 text-xs text-muted-foreground">
									{summary.entryCount} lignes de barème ·{" "}
									{summary.measurementSummary}
								</p>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>3. Matières dominantes</CardTitle>
					<CardDescription>
						Les matières sont requises pour Meuble et Siège sans rembourrage.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Palier</TableHead>
								<TableHead>Description</TableHead>
								<TableHead>Exemple</TableHead>
								<TableHead>Libellés officiels importés</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{MATERIAL_TIERS.map((tier) => (
								<TableRow key={tier.key}>
									<TableCell className="font-medium">
										{tier.label}
										{tier.key === "tous_materiaux" ? (
											<Badge className="ml-2" variant="destructive">
												palier de repli
											</Badge>
										) : null}
										{tier.requiresNoDisruptors ? (
											<Badge className="ml-2" variant="secondary">
												sans perturbateur
											</Badge>
										) : null}
									</TableCell>
									<TableCell>{tier.description}</TableCell>
									<TableCell>{tier.example}</TableCell>
									<TableCell className="max-w-sm text-sm text-muted-foreground">
										{officialMaterialLabelsByTier.get(tier.key)?.join(" · ") ??
											"Aucun libellé importé"}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					<p className="mt-4 text-sm text-muted-foreground">
						Si le produit a des perturbateurs de recyclage, les paliers Bois 75%
						et Métal 50% ne sont pas disponibles. Dans ce cas, utilisez le
						palier "Assemblage de matériaux ou matériau avec perturbateur de
						recyclage". Sans perturbateur, vérifiez toujours s'il existe une
						matière dominante à plus de 50% : le montant sera souvent plus bas.
					</p>
				</CardContent>
			</Card>

			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>4. Couverture du barème</CardTitle>
					<CardDescription>
						Toutes les lignes viennent du fichier Ecomaison importé, pas d'une
						copie manuelle.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Famille</TableHead>
								<TableHead>Mesures disponibles</TableHead>
								<TableHead>Paliers matière</TableHead>
								<TableHead>Lignes</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{familySummaries.map((summary) => (
								<TableRow key={summary.family}>
									<TableCell className="font-medium">
										{summary.family}
									</TableCell>
									<TableCell>{summary.measurementSummary}</TableCell>
									<TableCell>{summary.materialSummary}</TableCell>
									<TableCell>{summary.entryCount}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>5. Compositions</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 leading-7 text-muted-foreground">
					<p>
						Une composition est une somme de modules. Chaque module reçoit sa
						propre éco-participation, puis on additionne les montants.
					</p>
					<p className="rounded-md border border-border bg-muted/40 p-3 font-medium text-foreground">
						"la somme des éco-participations mobilier par élément."
					</p>
					<p>
						Il ne faut pas additionner les poids et faire une seule recherche :
						le barème n'est pas linéaire.
					</p>
				</CardContent>
			</Card>

			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>6. Eco-modulations</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 leading-7 text-muted-foreground">
					<p>
						La gestion durable utilise le tarif "gestion durable" du barème
						quand il existe. Elle concerne les ressources certifiées ou
						labellisées et reste conditionnée à l'absence de perturbateur de
						recyclage.
					</p>
					<p>
						La conception évolutive applique une réduction de 15% uniquement si
						le produit prévoit de multiples usages successifs dès la conception
						et ne comporte pas de perturbateur de recyclage. Par exemple, un
						montant de 10,00 € HT devient 8,50 € HT.
					</p>
				</CardContent>
			</Card>

			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>7. Code Ecomaison à 11 chiffres</CardTitle>
				</CardHeader>
				<CardContent className="leading-7 text-muted-foreground">
					<p>
						Ce code sert aux déclarations Ecomaison. Quand une ligne de barème
						correspond au produit, l'application reprend le code produit
						officiel importé depuis le générateur Ecomaison. Si aucune
						correspondance n'existe, le code peut être saisi manuellement, mais
						il doit contenir exactement 11 chiffres.
					</p>
				</CardContent>
			</Card>
		</article>
	);
}

type BaremeEntry = {
	family: string;
	materialTier?: string;
	measurementKind?: string;
	officialMaterial?: string;
};

const baremeEntries = ecomaison2026Bareme.entries as readonly BaremeEntry[];

const officialMaterialLabelsByTier = MATERIAL_TIERS.reduce(
	(labelsByTier, tier) => {
		const labels = uniqueSorted(
			baremeEntries
				.filter(
					(entry) => entry.materialTier === tier.key && entry.officialMaterial,
				)
				.map((entry) => entry.officialMaterial as string),
		);
		labelsByTier.set(tier.key, labels);
		return labelsByTier;
	},
	new Map<string, string[]>(),
);

const familySummaries = ECOMAISON_FAMILIES.map((family) => {
	const entries = baremeEntries.filter((entry) => entry.family === family);
	const measurements = uniqueSorted(
		entries.map((entry) => entry.measurementKind).filter(isString),
	);
	const materialTiers = uniqueSorted(
		entries.map((entry) => entry.materialTier).filter(isString),
	);

	return {
		family,
		entryCount: entries.length,
		inputSummary: inputsForFamily(family),
		materialSummary:
			materialTiers.length > 0
				? materialTiers.map(materialTierLabel).join(" · ")
				: "Non applicable",
		measurementSummary: measurements.map(measurementKindLabel).join(" · "),
	};
});

function ReferenceMetric({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-md border border-border p-3">
			<p className="text-muted-foreground">{label}</p>
			<p className="mt-1 font-medium">{value}</p>
		</div>
	);
}

function inputsForFamily(family: string) {
	if (family === "Meuble") return "Poids + matière dominante. Matière requise.";
	if (family === "Siège sans rembourrage")
		return "Poids + matière dominante. Matière requise.";
	if (family === "Siège avec rembourrage")
		return "Poids seulement. Une seule grille.";
	if (family === "Literie")
		return "Largeur, type de literie et statut perturbateur.";
	return "Poids ou m² selon la sous-catégorie textile.";
}

function measurementKindLabel(kind: string) {
	if (kind === "weight") return "poids";
	if (kind === "surface") return "surface";
	if (kind === "width") return "largeur";
	return kind;
}

function materialTierLabel(key: string) {
	return MATERIAL_TIERS.find((tier) => tier.key === key)?.label ?? key;
}

function uniqueSorted(values: string[]) {
	return Array.from(new Set(values)).sort((left, right) =>
		left.localeCompare(right, "fr"),
	);
}

function isString(value: string | undefined): value is string {
	return typeof value === "string";
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("fr-FR", {
		dateStyle: "long",
	}).format(new Date(`${value}T00:00:00`));
}
