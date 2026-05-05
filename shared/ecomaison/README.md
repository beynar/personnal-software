# Ecomaison regulatory source of truth

This folder centralizes the regulatory data used by the Molteni eco-participation
app.

- `taxonomy.ts` contains the hand-maintained app taxonomy: Molteni showroom
  categories, Ecomaison families, material tiers, labels, and disruptor rules.
- `generated/bareme-2026.ts` contains the generated official 2026 barème lookup
  data used by Convex calculations.

Do not edit generated files by hand. Regenerate them with:

```bash
python3 scripts/generate-ecomaison-2026.py
```

The importer downloads and parses the official Ecomaison XLSM generator defined
in `scripts/generate-ecomaison-2026.py`.
