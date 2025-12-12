# Chief Minister's Office Dashboard (Demo)

A static, offline-ready prototype that demonstrates the full journey: **Home → Education → Indicator bucket → Dropout Rate (Girls) detail → District hotspots + narrative → What-if simulator → Recommended focus districts.** The app runs fully on the frontend with mock data so real UDISE+/NAS/PGI feeds can be plugged in later.

## Quick start
1. Clone this repo.
2. Serve the folder (needed for `fetch` of JSON):
   ```bash
   python3 -m http.server 8000
   ```
3. Open [http://localhost:8000](http://localhost:8000) and click through the Education flow (or jump directly to `#/sector/education/indicator/dropout_girls`).

No build step or backend is required.

## Short plan (files & navigation)
- `index.html` – single-page shell with hash-based routing.
- `style.css` – layout, heat-grid, table, and control styling.
- `script.js` – data loading, navigation, heat-grid quantiles, narrative engine, simulator, and table interactions.
- `data/` – mock datasets ready to swap with production connectors.
- `scripts/precompute_narratives.js` – optional dev-only helper to regenerate `data/precomputed_narratives.json` (not required to run the app).

Navigation path baked into the UI: **Home → Education sector card → Access & Participation bucket → Dropout Rate (Girls)**. On the indicator page you land on the latest quarter, worst districts pre-highlighted, with narrative toggle and what-if simulator visible without scrolling.

## Data editing
- **Districts:** `data/districts.json` (36 Maharashtra districts, short labels for the heat-grid).
- **Indicator catalog:** `data/indicator_catalog.json` (bucket, id, name, source, unit, directionality, dimensions).
- **Observations:** `data/observations.json` (state + district time series, 8 quarters). Replace with real UDISE+/NAS/PGI exports maintaining the same fields.
- **Model config:** `data/model_config.json` (coefficients, bounds, defaults for the simulator). Extend with more indicators as needed.
- **Precomputed narratives (optional):** `data/precomputed_narratives.json` (if absent, the app auto-falls back to template mode).

## Narrative logic
- **Template mode (default):** deterministic strings built from current value, delta vs two years, directionality, and best/worst districts. Fully offline and consistent.
- **Precomputed mode:** if `precomputed_narratives.json` exists and matches the indicator + period key (e.g., `2023-Q4_MH`), the prewritten narrative overrides the template for that path. A toggle in the UI switches modes.
- **Explain this drawer:** shows the numbers, district list, and the toy equation/coefficients used by the simulator for transparency.

## Heat-grid & comparisons
- 6×6 grid for 36 districts with keyboard focus and tooltips.
- Quantile banding (20/40/60/80) produces five legend bands with direction-aware colors.
- Hover tooltip: district, value + unit, band label, Δ vs 2 years.
- Click/keyboard toggles highlight and filters the ranking table; “Worst 5 / Best 5” chips snap to extremes and scroll the table.
- Map note reminds viewers the grid is a schematic proxy for geography.

## What-if simulator
A toy deterministic model reads `data/model_config.json` and lets you drag sliders for drivers (teacher vacancy, toilet gap, scholarship coverage). It recomputes predicted dropout instantly and shows the delta vs the current observed value.

## Optional: regenerate precomputed narratives
Run the helper (not needed for normal use):
```bash
node scripts/precompute_narratives.js
```
It writes `data/precomputed_narratives.json` with the same key format the UI expects.

## Next enhancements
1. Role-based access control and per-user audit log trail for every simulated scenario.
2. Connectors to fetch UDISE+/NAS/PGI data via scheduled pulls with schema validation.
3. District detail drill-down showing school-level segmentation and cohort traces.
4. Exportable PDF briefs with embedded heat-grid and narratives for cabinet notes.
5. Offline sync and delta-updates for field tablets with conflict resolution.
