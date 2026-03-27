/**
 * Shared suitability scoring logic.
 *
 * This is the **single source of truth** for how hex-level suitability is
 * computed on the client.  Both the Deck.gl color renderer and the click-popup
 * call into the same functions so they can never drift apart.
 *
 * The backend's `_compute_base_suitability` in planner.py implements the same
 * algorithm — keep in sync when changing formulas.
 */

import type {
  PlannerWeights,
  PlannerDecayRadii,
  PlannerDensityScales,
} from "@/lib/types";
import { cityConfig } from "@/lib/cityConfig";

// ---------------------------------------------------------------------------
// Constants (also used by PlannerControls for labels / defaults)
// ---------------------------------------------------------------------------

export const FACTOR_LABELS: Record<string, string> = {
  population: cityConfig.factorLabels.population,
  hilliness: cityConfig.factorLabels.hilliness,
  commercial: cityConfig.factorLabels.commercial,
  education: cityConfig.factorLabels.education,
  recreation: cityConfig.factorLabels.recreation,
  lrt: cityConfig.factorLabels.lrt,
  bike_infra: cityConfig.factorLabels.bike_infra,
  transit: cityConfig.factorLabels.transit,
};

/**
 * Default reach / decay radius for proximity-scored factors (metres).
 *
 * Typed as both `PlannerDecayRadii` (for type-safe consumers) and
 * `Record<string, number>` (for dynamic indexing in the scorer).
 */
export const DEFAULT_DECAY_RADII: PlannerDecayRadii & Record<string, number> = {
  lrt: 2000,
  bike_infra: 200,
  transit: 800,
};

/**
 * Default saturation scale for density-scored (POI count) factors.
 *
 * Same dual-typing pattern as DEFAULT_DECAY_RADII.
 */
export const DEFAULT_DENSITY_SCALES: PlannerDensityScales & Record<string, number> = {
  commercial: 30,
  education: 5,
  recreation: 8,
};

/** All factor weights set to zero (initial / reset state). */
export const ZERO_WEIGHTS: PlannerWeights & Record<string, number> = {
  population: 0,
  hilliness: 0,
  lrt: 0,
  bike_infra: 0,
  transit: 0,
  commercial: 0,
  education: 0,
  recreation: 0,
};

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

export interface ScorerParams {
  /** Per-factor weight 0-100 from the UI sliders. */
  weights: Record<string, number>;
  /** Override reach radii for proximity factors (metres). */
  decayRadii?: Partial<Record<string, number>>;
  /** Override saturation scales for density factors. */
  densityScales?: Partial<Record<string, number>>;
  /** Per-hex proximity discount from nearby existing stations. */
  proximityFactors?: Record<string, number> | null;
}

export interface FactorResult {
  score: number;
  /** Human-readable extra info (e.g. "59 nearby", "1136m"). */
  extra?: string;
}

export interface HexScore {
  /** Final weighted+proximity-adjusted suitability, 0-1. */
  overall: number;
  /** Per-factor scores, 0-1. */
  factors: Record<string, FactorResult>;
}

/**
 * Score a single hex's suitability from its GeoJSON properties.
 *
 * Scoring modes:
 *  - **Density** (commercial, education, recreation):
 *    `min(1, log1p(count) / log1p(scale))`
 *  - **Proximity** (lrt, bike_infra, transit):
 *    `exp(-4.6 * dist / radius)`   (negative-exponential decay)
 *  - **Direct** (population):
 *    pre-computed 0-1 value used as-is.
 *
 * Prefers `{key}_network_dist` / `{key}_network_count` fields (road-network
 * distance from the precompute pipeline) and falls back to Euclidean
 * `{key}_dist` / `{key}_count` when network values are absent.
 */
export function scoreHex(
  props: Record<string, any>,
  params: ScorerParams,
): HexScore {
  const drMap = params.decayRadii ?? {};
  const dsMap = params.densityScales ?? {};

  let wTotal = 0;
  let rawScore = 0;
  const factors: Record<string, FactorResult> = {};

  for (const key of Object.keys(FACTOR_LABELS)) {
    const w = (params.weights[key] ?? 0) / 100;
    wTotal += w;

    const netCountKey = `${key}_network_count`;
    const countKey = `${key}_count`;
    const netDistKey = `${key}_network_dist`;
    const distKey = `${key}_dist`;

    let fs: number;
    let extra: string | undefined;

    // --- Density-scored factor ---
    if ((netCountKey in props || countKey in props) && key in DEFAULT_DENSITY_SCALES) {
      const count: number = props[netCountKey] ?? props[countKey] ?? 0;
      const scale = dsMap[key] ?? DEFAULT_DENSITY_SCALES[key];
      fs = scale > 0 ? Math.min(1, Math.log1p(count) / Math.log1p(scale)) : 0;
      extra = `${count} nearby`;

    // --- Proximity-scored factor ---
    } else if ((netDistKey in props || distKey in props) && key in DEFAULT_DECAY_RADII) {
      const dist: number | null = props[netDistKey] ?? props[distKey] ?? null;
      const radius = drMap[key] ?? DEFAULT_DECAY_RADII[key];
      if (radius > 0 && dist !== null && isFinite(dist)) {
        const beta = 4.6 / radius;
        fs = Math.exp(-beta * dist);
      } else {
        fs = 0;
      }
      const displayDist: number | null = props[netDistKey] ?? props[distKey] ?? null;
      extra = displayDist != null && isFinite(displayDist) ? `${Math.round(displayDist)}m` : "unreachable";

    // --- Direct factor (population, hilliness, etc.) ---
    } else {
      fs = props[key] ?? 0;
      if (key === "hilliness" && "slope_pct" in props) {
        extra = `${(props.slope_pct as number).toFixed(1)}% slope`;
      }
    }

    factors[key] = { score: fs, extra };
    rawScore += w * fs;
  }

  if (wTotal === 0) wTotal = 1;
  rawScore /= wTotal;

  // Apply per-hex proximity discount from nearby existing stations
  const proxFactor = params.proximityFactors?.[props.h3] ?? 1.0;
  const overall = rawScore * proxFactor;

  return { overall, factors };
}
