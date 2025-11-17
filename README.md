# Water Rate Simulator

A Next.js + React application for modeling how water rate design (tiers, base fees, elasticity) impacts utility revenue and customer usage. The simulator lets analysts capture baselines, tweak pricing, and compare scenarios visually with snapshot charts and Monte Carlo–driven customer analytics.

## Key Features

- **Tiered Pricing Builder** – Define any number of contiguous tiers with editable bounds and volumetric rates, plus a base monthly fee and elasticity slider.
- **Baseline Anchoring** – Capture a realistic baseline (`q₀`, perceived price) so future scenarios measure against today’s behavior.
- **Monte Carlo Demand Model** – Thousands of synthetic households (heterogeneous usage and elasticity draws) respond to rate edits, feeding system MG and revenue outputs.
- **Snapshot Compare** – Capture up to 20 scenarios, visualize MG/$ trends, and undo/clear runs while tracking percentage deltas.
- **Customer Analytics Suite**
  - Usage histogram with tier break reference lines.
  - Tier occupancy (baseline vs proposal) stacked bars.
  - ΔMG waterfall by baseline usage decile.
  - Elasticity (ε) beeswarm profile aligned with the active slider setting.

## Getting Started

### Prerequisites

- Node.js 18+ (ships with `corepack` for pnpm/yarn if you prefer).

### Install Dependencies

```bash
npm install
```

*(The repo contains both `package-lock.json` and `pnpm-lock.yaml`; stick with one lockfile/package manager to silence Turbopack warnings.)*

### Run the Dev Server

```bash
npm run dev
```

Open <http://localhost:3000> to view the simulator. Hot reload updates the UI as you edit components or math modules.

### Build for Production

```bash
npm run build
npm start
```

The build uses Next.js’ Turbopack pipeline. If you see warnings about multiple lockfiles, remove the unused lock or configure `turbopack.root` in `next.config.mjs`.

## Project Structure

```
app/
  page.tsx                # Mounts the WaterRateSimulator component
components/
  water-rate-simulator.tsx
  snapshot-compare.tsx
  analytics/
    UsageHistogram.tsx
    TierOccupancyBars.tsx
    DecileWaterfall.tsx
    ElasticityBeeswarm.tsx
lib/
  demand.ts               # Tier validation + elasticity model
  montecarlo.ts           # Monte Carlo sampling & aggregation
  analytics.ts            # Helper transforms for analytics charts
```

## Usage Notes

1. Adjust consumer settings (connections, elasticity), pricing tiers, base fee, and customer variety sliders.
2. Click **Set Baseline** once to freeze the current typical use (`q₀`), perceived price, and Monte Carlo draws. Customer analytics unlock after this step.
3. Edit tiers or parameters; observe MG, revenue, and computation trace updates. Use **Capture** (SnapshotCompare) to log scenarios and compare bars with percentage deltas.
4. The “Customer Analytics” card shows how different customer groups respond—histogram, tier occupancy, decile waterfall, and ε profile—using the same frozen draws for apples-to-apples comparisons.

## Contributing

1. Fork or create a branch.
2. Keep UI styling consistent (Tailwind + existing Card/Button components).
3. Run `npm run build` (or `npm run lint`) before opening a PR to ensure math/analytics changes compile.

Feel free to extend the model (seasonality, affordability factors, optimizers) in future phases; the current code isolates the core demand + analytics helpers to simplify iteration.
