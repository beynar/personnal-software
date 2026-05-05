import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Download, FileSpreadsheet, Package } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
import { Skeleton } from "~/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { formatEuro } from "../../shared/ecomaison/taxonomy";

type DeclarationRow = {
	_id: string;
	ecomaisonCode11: string | null;
	ecomaisonFamily: string;
	ecoParticipationHt: number | null;
	ecoParticipationTtc: number | null;
	name: string;
	soldDate: string | null;
	weightKg: number | null;
};

type DeclarationData = {
	byFamily: Array<{
		count: number;
		ecoHt: number;
		ecoTtc: number;
		family: string;
		weightKg: number;
	}>;
	rows: DeclarationRow[];
	stats: {
		count: number;
		ecoHt: number;
		ecoTtc: number;
		weightKg: number;
	};
};

export const Route = createFileRoute("/dashboard/declaration")({
	staticData: {
		dashboardHeader: {
			description: "Préparation de la déclaration trimestrielle Ecomaison",
			title: "Déclaration",
		},
	},
	loader: async ({ context }) => {
		return await context.getOrpc().molteni.declaration({
			query: { quarter: "T1", soldOnly: false, year: 2026 },
		});
	},
	pendingComponent: () => <Skeleton className="h-96 w-full" />,
	component: DeclarationPage,
});

function DeclarationPage() {
	const initialData = Route.useLoaderData() as DeclarationData;
	const [soldOnly, setSoldOnly] = useState(true);
	const [quarter, setQuarter] = useState<Quarter>("T1");
	const [headerActionTarget, setHeaderActionTarget] =
		useState<HTMLElement | null>(null);
	const data = useMemo(
		() => filterDeclaration(initialData, quarter, soldOnly),
		[initialData, quarter, soldOnly],
	);
	const csv = useMemo(() => buildCsv(data.rows), [data.rows]);

	useEffect(() => {
		setHeaderActionTarget(document.getElementById("dashboard-header-actions"));
	}, []);

	const exportCsvButton = (
		<Button asChild variant="outline">
			<a
				download={`molteni-ecomaison-${quarter}-2026.csv`}
				href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
			>
				<Download className="size-4" />
				Exporter CSV
			</a>
		</Button>
	);

	return (
		<>
			<div className="space-y-4">
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
					<ChoiceGrid
						className="grid-cols-2 sm:grid-cols-4"
						compact
						options={quarterOptions}
						value={quarter}
						onChange={setQuarter}
					/>
					<ChoiceGrid
						className="grid-cols-2"
						compact
						options={declarationScopeOptions}
						value={soldOnly ? "sold" : "all"}
						onChange={(value) => setSoldOnly(value === "sold")}
					/>
				</div>

				<div className="grid gap-4 md:grid-cols-4">
					<StatCard label="Produits vendus" value={data.stats.count} />
					<StatCard label="Poids total" value={`${data.stats.weightKg} kg`} />
					<StatCard label="Eco HT" value={formatEuro(data.stats.ecoHt)} />
					<StatCard label="Eco TTC" value={formatEuro(data.stats.ecoTtc)} />
				</div>

				<Card className="border-border/70">
					<CardHeader>
						<CardTitle>Synthèse par famille Ecomaison</CardTitle>
						<CardDescription>
							Les chiffres utilisent les dates de vente au niveau produit sur la
							période sélectionnée.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Famille</TableHead>
									<TableHead>Nombre</TableHead>
									<TableHead>Poids</TableHead>
									<TableHead>Eco HT</TableHead>
									<TableHead>Eco TTC</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.byFamily.map((row) => (
									<TableRow key={row.family}>
										<TableCell>{row.family}</TableCell>
										<TableCell>{row.count}</TableCell>
										<TableCell>{row.weightKg} kg</TableCell>
										<TableCell>{formatEuro(row.ecoHt)}</TableCell>
										<TableCell>{formatEuro(row.ecoTtc)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card className="border-border/70">
					<CardHeader>
						<CardTitle>Détail</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Produit</TableHead>
									<TableHead>Famille</TableHead>
									<TableHead>Poids</TableHead>
									<TableHead>Date de vente</TableHead>
									<TableHead>Eco HT</TableHead>
									<TableHead>Code</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.rows.map((row) => (
									<TableRow key={row._id}>
										<TableCell>{row.name}</TableCell>
										<TableCell>{row.ecomaisonFamily}</TableCell>
										<TableCell>{row.weightKg ?? "-"} kg</TableCell>
										<TableCell>{row.soldDate ?? "-"}</TableCell>
										<TableCell>{formatEuro(row.ecoParticipationHt)}</TableCell>
										<TableCell>
											{row.ecomaisonCode11 ?? "Mapping manquant"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>
			{headerActionTarget
				? createPortal(exportCsvButton, headerActionTarget)
				: null}
		</>
	);
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle>{value}</CardTitle>
			</CardHeader>
		</Card>
	);
}

function buildCsv(rows: DeclarationRow[]) {
	const headers: Array<keyof DeclarationRow> = [
		"name",
		"ecomaisonFamily",
		"weightKg",
		"soldDate",
		"ecoParticipationHt",
		"ecomaisonCode11",
	];
	return [
		headers.join(","),
		...rows.map((row) =>
			headers.map((header) => JSON.stringify(row[header] ?? "")).join(","),
		),
	].join("\n");
}

function filterDeclaration(
	data: DeclarationData,
	quarter: string,
	soldOnly: boolean,
) {
	const range = getQuarterRange(2026, quarter);
	const rows = data.rows.filter((row) => {
		if (!soldOnly) return true;
		return (
			row.soldDate && row.soldDate >= range.start && row.soldDate <= range.end
		);
	});
	const byFamily = new Map<
		string,
		{
			count: number;
			ecoHt: number;
			ecoTtc: number;
			family: string;
			weightKg: number;
		}
	>();
	for (const row of rows) {
		const current = byFamily.get(row.ecomaisonFamily) ?? {
			family: row.ecomaisonFamily,
			count: 0,
			weightKg: 0,
			ecoHt: 0,
			ecoTtc: 0,
		};
		current.count += 1;
		current.weightKg += row.weightKg ?? 0;
		current.ecoHt += row.ecoParticipationHt ?? 0;
		current.ecoTtc += row.ecoParticipationTtc ?? 0;
		byFamily.set(row.ecomaisonFamily, current);
	}
	return {
		rows,
		byFamily: Array.from(byFamily.values()),
		stats: {
			count: rows.length,
			weightKg: round(
				rows.reduce((total, row) => total + (row.weightKg ?? 0), 0),
			),
			ecoHt: round(
				rows.reduce((total, row) => total + (row.ecoParticipationHt ?? 0), 0),
			),
			ecoTtc: round(
				rows.reduce((total, row) => total + (row.ecoParticipationTtc ?? 0), 0),
			),
		},
	};
}

function getQuarterRange(year: number, quarter: string) {
	const ranges: Record<string, { start: string; end: string }> = {
		T1: { start: `${year}-01-01`, end: `${year}-03-31` },
		T2: { start: `${year}-04-01`, end: `${year}-06-30` },
		T3: { start: `${year}-07-01`, end: `${year}-09-30` },
		T4: { start: `${year}-10-01`, end: `${year}-12-31` },
	};
	return ranges[quarter] ?? ranges.T1;
}

type Quarter = "T1" | "T2" | "T3" | "T4";

const quarterOptions: ChoiceOption<Quarter>[] = [
	{ value: "T1", label: "T1 2026", icon: CalendarDays },
	{ value: "T2", label: "T2 2026", icon: CalendarDays },
	{ value: "T3", label: "T3 2026", icon: CalendarDays },
	{ value: "T4", label: "T4 2026", icon: CalendarDays },
];

const declarationScopeOptions: ChoiceOption<"sold" | "all">[] = [
	{
		value: "sold",
		label: "Vendus seulement",
		description: "Mode déclaration",
		icon: FileSpreadsheet,
	},
	{
		value: "all",
		label: "Tous les produits",
		description: "Vue inventaire",
		icon: Package,
	},
];

function round(value: number) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}
