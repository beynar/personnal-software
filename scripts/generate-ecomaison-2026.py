#!/usr/bin/env python3
"""Generate compact app barème data from Ecomaison's official 2026 XLSM.

The source workbook is an Office Open XML archive. Reading the XML directly keeps
this script dependency-free and avoids baking hand-copied tariff values into the
app.
"""

from __future__ import annotations

import json
import re
import tempfile
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Iterable
from xml.etree.ElementTree import iterparse
from zipfile import ZipFile


SOURCE_URL = "https://ecomaison.com/wp-content/uploads/2025/10/Ameublement-Generateur-des-codes-produits-et-des-tarifs-2026-v12.6-1.xlsm"
OUTPUT_PATH = Path("shared/ecomaison/generated/bareme-2026.ts")
XML_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

MATERIAL_TO_TIER = {
	"Bois massif à plus de 95% en gestion non certifiée": "bois_massif_95",
	"Bois massif à plus de 95% en gestion durable certifiée": "bois_massif_95",
	"Bois massif à plus de 75% en gestion non certifiée": "bois_75",
	"Bois massif à plus de 75% en gestion durable certifiée ": "bois_75",
	"Panneaux de particules à plus de 75% en gestion non certifiée": "bois_75",
	"Panneaux de particules à plus de 75% en gestion durable certifiée": "bois_75",
	"Bois, panneaux et dérivés de bois à plus de 50% en gestion non certifiée": "bois_50",
	"Bois, panneaux et dérivés de bois à plus de 50% en gestion durable certifiée": "bois_50",
	"Métal à plus de  95%": "metal_95",
	"Métal à plus de 75%": "metal_75",
	"Métal à plus de 50%": "metal_50",
	"Plastiques (mono résine) à plus de 95%": "plastique_95",
	"PE ou PP ou mélange PP/PE à plus de 95%": "plastique_95",
	"Polyterephtalate\u00a0d'Ethylène (PET) à plus de 95%": "plastique_95",
	"ABS à plus de 95%": "plastique_95",
	"Polystyrène à plus de 95%": "plastique_95",
	"PVC à plus de 95%": "plastique_95",
	"Plastiques": "plastique",
	"Matériaux ou fibres synthétiques à plus de 95%": "synthetique_95",
	"Matériaux ou fibres synthétiques à plus de 50%": "synthetique_50",
	"Caoutchouc synthétique à plus de à plus de 95%": "synthetique_95",
	"Textile et rembourrage en polyester à plus de 95%": "synthetique_95",
	"Céramique": "ceramique",
	"Céramique à plus de 95%": "ceramique",
	"Verre à plus de 95%": "ceramique",
	"Miroir à plus de 95%": "ceramique",
	"Verre et miroir": "ceramique",
	"Pierre artificielle": "ceramique",
	"Pierre artificielle à plus de 95%": "ceramique",
	"Pierre calcaire à plus de 95%": "ceramique",
	"Ciment, béton": "ceramique",
	"Béton à plus de 95%": "ceramique",
	"Ardoise à plus de 95%": "ceramique",
	"Granit à plus de 95%": "ceramique",
	"Matériaux bio sourcés ou textiles non synthétiques à plus de 50% en gestion non certifiée": "biosource_50",
	"Matériaux bio sourcés ou textiles non synthétiques à plus de 50% en gestion durable certifiée": "biosource_50",
	"Autres ou présence de perturbateurs": "tous_materiaux",
	"Non connu": "tous_materiaux",
	"Assemblage de 3 matériaux ou plus sans un matériau à plus de 50%": "tous_materiaux",
}

DURABLE_MATERIAL_MARKERS = (
	"gestion durable certifiée",
	"certifié",
)


def download_source() -> Path:
	target = Path(tempfile.gettempdir()) / "ecomaison-ameublement-2026-v12.6.xlsm"
	request = urllib.request.Request(
		SOURCE_URL,
		headers={
			"User-Agent": "Mozilla/5.0 (compatible; MolteniEcoParticipationImporter/1.0)",
		},
	)
	with urllib.request.urlopen(request) as response:
		target.write_bytes(response.read())
	return target


def read_shared_strings(zip_file: ZipFile) -> list[str]:
	strings: list[str] = []
	for _, element in iterparse(zip_file.open("xl/sharedStrings.xml"), events=("end",)):
		if element.tag == f"{XML_NS}si":
			strings.append("".join(text.text or "" for text in element.iter(f"{XML_NS}t")))
			element.clear()
	return strings


def column_number(cell_ref: str) -> int:
	number = 0
	for char in "".join(char for char in cell_ref if char.isalpha()):
		number = number * 26 + ord(char) - 64
	return number


def cell_value(cell, shared_strings: list[str]) -> str:
	value = cell.find(f"{XML_NS}v")
	if value is None:
		return ""
	raw_value = value.text or ""
	if cell.attrib.get("t") == "s":
		return shared_strings[int(raw_value)]
	return raw_value


def iter_grille_rows(source_path: Path) -> Iterable[dict[int, str]]:
	with ZipFile(source_path) as zip_file:
		shared_strings = read_shared_strings(zip_file)
		for _, row in iterparse(
			zip_file.open("xl/worksheets/sheet9.xml"),
			events=("end",),
		):
			if row.tag != f"{XML_NS}row":
				continue
			if int(row.attrib.get("r", "0")) == 1:
				row.clear()
				continue
			values: dict[int, str] = {}
			for cell in row.findall(f"{XML_NS}c"):
				column = column_number(cell.attrib.get("r", ""))
				if column <= 17:
					values[column] = cell_value(cell, shared_strings)
			row.clear()
			if values.get(12) and not values.get(11):
				yield values


def parse_float(value: str) -> float:
	return round(float(value), 2)


def parse_weight_bracket(label: str) -> tuple[float, float | None] | None:
	normalized = label.replace(",", ".")
	lower = normalized.lower()
	if "Inférieur strictement à" in normalized or "Inférieur à" in normalized:
		match = re.search(r"([0-9.]+) kg", normalized)
		return (0, float(match.group(1))) if match else None
	if "inférieur strictement à" in lower or "inférieur à" in lower:
		match = re.search(r"([0-9.]+) kg", lower)
		return (0, float(match.group(1))) if match else None
	if "Supérieur à" in normalized:
		match = re.search(r"([0-9.]+) kg", normalized)
		return (float(match.group(1)), None) if match else None
	if "supérieur à" in lower:
		match = re.search(r"([0-9.]+) kg", lower)
		return (float(match.group(1)), None) if match else None
	match = re.search(r"entre ([0-9.]+) kg et ([0-9.]+) kg", normalized)
	if match:
		return float(match.group(1)), float(match.group(2))
	match = re.search(r"entre ([0-9.]+) et ([0-9.]+) kg", lower)
	if match:
		return float(match.group(1)), float(match.group(2))
	return None


def parse_width_bracket(label: str) -> tuple[float, float | None] | None:
	normalized = label.replace("≤", "<=").replace(">", ">")
	if "Largeur <= 120 cm" in normalized:
		return 0, 120
	if "Largeur > 120 cm et <= 140 cm" in normalized:
		return 120, 140
	if "de largeur > 140 cm et <= 160 cm" in normalized:
		return 140, 160
	if "de largeur > 160 cm et <= 180 cm" in normalized:
		return 160, 180
	if "de largeur > 180 cm" in normalized or "Largeur > 140 cm" in normalized:
		return 180 if "180" in normalized else 140, None
	return None


def family_for(category: str, product_type: str) -> str | None:
	if category == "Sieges" and product_type == "Siège avec rembourrage":
		return "Siège avec rembourrage"
	if category == "Sieges" and product_type == "Siège sans rembourrage":
		return "Siège sans rembourrage"
	if category.startswith("Literie_"):
		return "Literie"
	if category == "Articles_décoration_textile":
		return "Décoration textile"
	if category.startswith("Meubles_") or category == "Mobilier_technique":
		return "Meuble"
	return None


def material_tier_for(family: str, material: str) -> str | None:
	if family in {"Siège avec rembourrage", "Literie", "Décoration textile"}:
		return None
	return MATERIAL_TO_TIER.get(material)


def is_durable_material(material: str) -> bool:
	return any(marker in material for marker in DURABLE_MATERIAL_MARKERS)


def prefer_higher_rate(existing: dict | None, candidate: dict) -> dict:
	if existing is None:
		return candidate
	if candidate["rateHt"] > existing["rateHt"]:
		return candidate
	return existing


def add_entry(groups: dict, key: tuple, row: dict[int, str], rate_field: str) -> None:
	candidate = {
		"rateHt": parse_float(row[12]),
		"label": row[8],
		"officialProductCode": row[9],
		"officialEcoPartCode": row[13],
		"officialCategory": row[2],
		"officialProductType": row[4],
		"officialMaterial": row[6],
	}
	if rate_field == "rateHt":
		groups[key]["standard"] = prefer_higher_rate(groups[key].get("standard"), candidate)
	else:
		groups[key]["durable"] = prefer_higher_rate(groups[key].get("durable"), candidate)


def build_entries(source_path: Path) -> list[dict]:
	groups: dict[tuple, dict] = defaultdict(dict)
	for row in iter_grille_rows(source_path):
		family = family_for(row.get(2, ""), row.get(4, ""))
		if family is None:
			continue
		material_tier = material_tier_for(family, row.get(6, ""))
		if (
			family
			not in {"Siège avec rembourrage", "Literie", "Décoration textile"}
			and material_tier is None
		):
			continue
		if family == "Literie":
			bracket = parse_width_bracket(row.get(8, ""))
			if bracket is None:
				continue
			key = (family, material_tier, None, None, bracket[0], bracket[1], "width")
		elif family == "Décoration textile" and row.get(8, "") == "m²":
			key = (family, material_tier, 0, None, None, None, "surface")
		else:
			bracket = parse_weight_bracket(row.get(8, ""))
			if bracket is None:
				continue
			key = (
				family,
				material_tier,
				bracket[0],
				bracket[1],
				None,
				None,
				"weight",
			)
		add_entry(
			groups,
			key,
			row,
			"rateHtDurable" if is_durable_material(row.get(6, "")) else "rateHt",
		)

	entries: list[dict] = []
	for key, rates in sorted(groups.items(), key=lambda item: str(item[0])):
		standard = rates.get("standard") or rates.get("durable")
		if standard is None:
			continue
		durable = rates.get("durable")
		family, material_tier, weight_min, weight_max, width_min, width_max, measurement_kind = key
		entry = {
			"family": family,
			"materialTier": material_tier,
			"measurementKind": measurement_kind,
			"weightMin": weight_min,
			"weightMax": weight_max,
			"widthMin": width_min,
			"widthMax": width_max,
			"rateHt": standard["rateHt"],
			"rateHtDurable": durable["rateHt"] if durable else None,
			"label": standard["label"],
			"officialProductCode": standard["officialProductCode"],
			"officialEcoPartCode": standard["officialEcoPartCode"],
			"officialCategory": standard["officialCategory"],
			"officialProductType": standard["officialProductType"],
			"officialMaterial": standard["officialMaterial"],
		}
		entries.append({key: value for key, value in entry.items() if value is not None})
	return entries


def write_output(entries: list[dict]) -> None:
	OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
	payload = {
		"sourceUrl": SOURCE_URL,
		"sourceName": "Ecomaison Ameublement - Générateur de codes produits et des tarifs 2026 v12.6",
		"year": 2026,
		"effectiveFrom": "2026-01-01",
		"generatedEntries": len(entries),
		"entries": entries,
	}
	OUTPUT_PATH.write_text(
		"/* Auto-generated by scripts/generate-ecomaison-2026.py. Do not edit manually. */\n"
		"export const ecomaison2026Bareme = "
		+ json.dumps(payload, ensure_ascii=False, indent="\t")
		+ " as const;\n",
		encoding="utf-8",
	)


def main() -> None:
	source_path = download_source()
	entries = build_entries(source_path)
	write_output(entries)
	print(f"Wrote {len(entries)} entries to {OUTPUT_PATH}")


if __name__ == "__main__":
	main()
