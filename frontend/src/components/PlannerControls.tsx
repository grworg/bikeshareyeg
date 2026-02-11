"use client";

import { useCallback, useState } from "react";
import type { PlannerWeights, PlannerDecayRadii, PlannerConfig, PlannerCoverage, PlannerAlgorithm } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PlannerControlsProps {
  expanded: boolean;
  onToggleExpanded: () => void;
  weights: PlannerWeights;
  onUpdateWeights: (w: PlannerWeights) => void;
  decayRadii: PlannerDecayRadii;
  onUpdateDecayRadii: (r: PlannerDecayRadii) => void;
  config: PlannerConfig;
  onUpdateConfig: (c: PlannerConfig) => void;
  showSuitability: boolean;
  onToggleSuitability: () => void;
  isSuitabilityLoading: boolean;
  onRunOptimize: () => void;
  isOptimizing: boolean;
  optimizeError: string | null;
  coverage: PlannerCoverage | null;
  onApplyStations: () => void;
  hasGeneratedStations: boolean;
  onSeedLRT: () => void;
  stationCount: number;
  onStep: () => void;
  isStepping: boolean;
}

// ---------------------------------------------------------------------------
// Help content — keyed by an identifier
// ---------------------------------------------------------------------------

interface HelpEntry {
  title: string;
  intuitive: string;
  technical: string;
  links?: { label: string; url: string }[];
}

const HELP: Record<string, HelpEntry> = {
  // -- Goal weights --
  population: {
    title: "Population Density",
    intuitive:
      "Prioritises placing stations where more people live. Higher values push the network toward residential neighbourhoods with the most potential riders.",
    technical:
      "Uses 2021 Census data at the Dissemination Area level (the finest geographic unit available). Each area on the map is scored 0\u2013100% based on its population per km\u00B2 relative to the densest part of the city. This weight controls how much population matters in the overall suitability score.",
  },
  lrt: {
    title: "LRT Proximity",
    intuitive:
      "Favours locations near Light Rail Transit stations, encouraging multi-modal trips where riders bike to/from the train.",
    technical:
      "Each area is scored based on how close it is to the nearest LRT station. Score is 100% right at a station and drops linearly to 0% at the Reach distance. Adjust the Reach slider to control how far LRT influence extends.",
  },
  bike_infra: {
    title: "Bike Infrastructure",
    intuitive:
      "Steers stations toward areas with existing bike lanes, paths, and cycle tracks \u2014 places where cycling is already safe and convenient.",
    technical:
      "Each area is scored by distance to the nearest bike lane, cycle track, or shared-use path. Score is 100% right on a route and drops to 0% at the Reach distance. Adjust Reach to control how far bike infrastructure influence extends.",
  },
  transit: {
    title: "Transit Access",
    intuitive:
      "Values proximity to bus stops and other transit infrastructure, making bike-share a natural first/last-mile connector to the broader transit network.",
    technical:
      "Each area is scored by distance to the nearest bus stop or transit platform. Score is 100% at a stop and drops to 0% at the Reach distance. Adjust Reach to control how far transit influence extends.",
  },

  // -- Proximity discount --
  proximityRadius: {
    title: "Proximity Discount \u2014 Radius",
    intuitive:
      "Sets how far the \u201Cshadow\u201D of an existing station extends. Within this radius, suitability is reduced so the algorithm avoids clustering stations too close together.",
    technical:
      "Any area closer than this distance (in metres) to an existing station has its suitability score reduced. The discount is strongest right at the station and fades linearly to zero at the edge of the radius.",
  },
  proximityStrength: {
    title: "Proximity Discount \u2014 Strength",
    intuitive:
      "Controls how much suitability drops right next to an existing station. At 100% the area directly on top of a station becomes completely unsuitable; at 0% there is no discount at all.",
    technical:
      "At strength 70%, for example, suitability is reduced to 30% of its base value right at a station, and gradually returns to full suitability at the radius edge.",
  },

  // -- Network connectivity --
  connectivity: {
    title: "Network Connectivity",
    intuitive:
      "Penalises locations that are too far from any existing station, encouraging the algorithm to build a connected network rather than placing isolated stations in distant areas. Think of it as a \"gravitational pull\" toward the existing network.",
    technical:
      "Beyond the connectivity radius, suitability decreases linearly. At twice the radius, the full strength penalty applies. For example, with a 2000m radius and 60% strength: a hex 3000m from the nearest station has suitability reduced to 70%, and at 4000m+ it's reduced to 40% of its base value.",
  },

  // -- Algorithm --
  algorithm: {
    title: "Optimization Algorithm",
    intuitive:
      "Choose how the algorithm decides where to place stations.\n\nIterative MCLP solves small batches at a time \u2014 each batch is globally optimized for coverage, then the suitability landscape is recalculated before the next batch. It answers: \"which combination of locations covers the most demand?\"\n\nGreedy places one station at a time at the single best location, recalculating suitability after each placement. It answers: \"where is the most suitable spot right now?\" This naturally builds connected, well-spaced networks because each new station reshapes the landscape for the next.",
    technical:
      "Iterative MCLP splits the station budget into batches and runs a Maximum Covering Location Problem solver (OR-Tools CP-SAT) for each batch. Between batches, proximity discount and connectivity penalties are recomputed from all placed stations so the suitability surface evolves. Greedy performs N iterations, each time picking the single hex with the highest adjusted suitability score. The key difference: MCLP reasons about coverage radius (a station at a moderate hex can cover many high-demand hexes nearby), while Greedy only looks at per-hex scores.",
    links: [
      { label: "MCLP (Wikipedia)", url: "https://en.wikipedia.org/wiki/Maximum_coverage_problem" },
      { label: "OR-Tools CP-SAT", url: "https://developers.google.com/optimization/cp/cp_solver" },
      { label: "Greedy algorithms", url: "https://en.wikipedia.org/wiki/Greedy_algorithm" },
    ],
  },
  batchSize: {
    title: "Batch Size",
    intuitive:
      "How many stations to place in each round of optimization. Smaller batches mean suitability is recalculated more often, producing better-connected networks. Larger batches are faster and consider more stations simultaneously.\n\nA batch size of 1 is essentially \"coverage-aware greedy\" \u2014 each station is placed at the location that maximizes covered demand, then suitability is fully recalculated.",
    technical:
      "Only applies to Iterative MCLP. With batch size B and budget N, the solver runs ceil(N/B) times. Each solve is a full MCLP with B-station budget, hard spacing constraints, and coverage-weighted objective. Between solves, all previously placed stations are added to the existing-stations set, and proximity discount + connectivity penalty are recomputed. Trade-off: smaller B = more suitability recalculations (better connectivity) but more solver invocations. Larger B = better intra-batch optimality but static suitability within each batch.",
    links: [
      { label: "Facility location problem", url: "https://en.wikipedia.org/wiki/Facility_location_problem" },
    ],
  },

  // -- Network design --
  numStations: {
    title: "Number of Stations",
    intuitive:
      "The maximum number of new docking stations the algorithm will place. More stations means broader coverage but higher infrastructure cost.",
    technical:
      "This is the budget constraint for the optimiser. It will place up to this many stations, choosing the combination that covers the most demand given your other settings.",
  },
  totalBikes: {
    title: "Total Bikes",
    intuitive:
      "The total fleet size across the entire generated network. Bikes are distributed proportionally \u2014 higher-demand stations get more bikes.",
    technical:
      "Combined with Fill %, this determines the total number of docks needed (total bikes \u00F7 fill %). Docks are allocated to each station in proportion to its suitability score, then bikes are allocated based on each station\u2019s dock capacity.",
  },
  fillPct: {
    title: "Fill Percentage",
    intuitive:
      "What fraction of each station\u2019s docks should have a bike at the start. 50% is typical \u2014 enough bikes for departures and enough empty docks for arrivals.",
    technical:
      "Determines total docks needed: total bikes \u00F7 fill %. A 50% fill with 600 bikes means 1,200 total docks across the network. Each station then gets roughly capacity \u00D7 fill % bikes.",
  },
  minDocks: {
    title: "Minimum Docks per Station",
    intuitive:
      "The smallest station the algorithm will create. Even low-demand locations get at least this many docks to remain useful.",
    technical:
      "No station will have fewer than this many docks, regardless of its demand score. Stations are sized in multiples of 5 docks.",
  },
  maxDocks: {
    title: "Maximum Docks per Station",
    intuitive:
      "The largest station the algorithm will create. Prevents any single location from becoming disproportionately large.",
    technical:
      "No station will exceed this many docks, even at the highest-demand locations. Keeps physical footprint manageable.",
  },
  spacing: {
    title: "Minimum Spacing",
    intuitive:
      "The closest two stations can be to each other. Larger values spread the network out; smaller values allow denser clusters in high-demand areas.",
    technical:
      "Enforced as a hard rule: no two stations (including existing/seeded ones) can be closer than this distance. A typical urban bike-share spacing is 300\u2013500 m.",
  },
  coverageRadius: {
    title: "Coverage Radius",
    intuitive:
      "How far a station\u2019s benefit extends. An area is considered \u201Ccovered\u201D if it\u2019s within this distance of at least one station. Larger values mean each station serves a bigger area but riders walk further.",
    technical:
      "The algorithm tries to maximise the total population and demand within this radius of the placed stations. A typical walking tolerance to a bike-share dock is 300\u2013500 m.",
  },

  // -- Buttons / toggles --
  suitability: {
    title: "Suitability Overlay",
    intuitive:
      "Paints the map with a blue heat-map showing how suitable each location is for a bike-share dock, based on your current weight settings. Brighter blue = better location.",
    technical:
      "The city is divided into ~5,000 hexagonal cells (~175 m across). Each cell has pre-computed scores for population, LRT, bike infra, and transit. The colour reflects the weighted average of these scores, adjusted by the station proximity discount. Transparent means < 5% suitability; dark navy means > 85%.",
  },
  seedLRT: {
    title: "Seed LRT Stations",
    intuitive:
      "Instantly places a large 30-dock station at every LRT stop in the city. This gives the network a solid multi-modal backbone that the algorithm can then fill around.",
    technical:
      "Creates a 30-dock, 15-bike station at each LRT stop. Skips any stop that already has a dock within 200 m. These stations can be edited or deleted like any other.",
  },
  generate: {
    title: "Generate Bike Share Network",
    intuitive:
      "Runs the optimisation algorithm to place new stations in the best locations based on all your settings. Existing stations (e.g. seeded LRT docks) are kept \u2014 new ones are added around them.",
    technical:
      "Uses an optimisation algorithm (MCLP) that picks the station locations covering the most demand while respecting your budget, spacing, and proximity constraints. After choosing locations, it sizes each station and distributes bikes. Typical solve time is 2\u201310 seconds.",
  },
};

// ---------------------------------------------------------------------------
// Factor metadata
// ---------------------------------------------------------------------------

interface FactorMeta {
  key: keyof PlannerWeights;
  label: string;
  color: string;
  helpKey: string;
  icon: React.ReactNode;
}

const FACTORS: FactorMeta[] = [
  {
    key: "population",
    label: "Population Density",
    color: "#e53935",
    helpKey: "population",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    key: "lrt",
    label: "LRT Proximity",
    color: "#7b1fa2",
    helpKey: "lrt",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="13" rx="2" />
        <line x1="4" y1="11" x2="20" y2="11" />
        <path d="M9 16l-2 5M15 16l2 5" />
      </svg>
    ),
  },
  {
    key: "bike_infra",
    label: "Bike Infrastructure",
    color: "#2e7d32",
    helpKey: "bike_infra",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17" r="3.5" />
        <circle cx="18.5" cy="17" r="3.5" />
        <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
      </svg>
    ),
  },
  {
    key: "transit",
    label: "Transit Access",
    color: "#0277bd",
    helpKey: "transit",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <circle cx="7.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
        <path d="M7 17l-1.5 3M17 17l1.5 3" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlannerControls({
  expanded,
  onToggleExpanded,
  weights,
  onUpdateWeights,
  decayRadii,
  onUpdateDecayRadii,
  config,
  onUpdateConfig,
  showSuitability,
  onToggleSuitability,
  isSuitabilityLoading,
  onRunOptimize,
  isOptimizing,
  optimizeError,
  coverage,
  onApplyStations,
  hasGeneratedStations,
  onSeedLRT,
  stationCount,
  onStep,
  isStepping,
}: PlannerControlsProps) {
  const [openHelp, setOpenHelp] = useState<string | null>(null);

  const setWeight = useCallback(
    (key: keyof PlannerWeights, val: number) => {
      onUpdateWeights({ ...weights, [key]: val });
    },
    [weights, onUpdateWeights],
  );

  const cfg = <K extends keyof PlannerConfig>(key: K, val: PlannerConfig[K]) =>
    onUpdateConfig({ ...config, [key]: val });

  const toggleHelp = (key: string) =>
    setOpenHelp((prev) => (prev === key ? null : key));

  return (
    <div>
          {/* Suitability toggle + Seed LRT */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--color-border)] bg-[#f8f9fa]">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={showSuitability}
                onChange={onToggleSuitability}
                className="accent-[var(--color-blue)]"
              />
              <span className="text-[12px] text-[var(--color-fg)] font-medium">
                Show Suitability
              </span>
            </label>
            <InfoButton helpKey="suitability" openHelp={openHelp} onToggle={toggleHelp} />
            {isSuitabilityLoading && (
              <span className="text-[10px] text-[var(--color-secondary)] animate-pulse">
                Loading...
              </span>
            )}
            <button
              onClick={onSeedLRT}
              className="text-[11px] font-medium text-[#7b1fa2] bg-[#f3e5f5] px-2.5 py-1 rounded-full hover:bg-[#e1bee7] transition-colors whitespace-nowrap"
              title="Place a large station at every LRT stop"
            >
              Seed LRT
            </button>
            <InfoButton helpKey="seedLRT" openHelp={openHelp} onToggle={toggleHelp} />
          </div>
          <HelpPanel helpKey="suitability" openHelp={openHelp} />
          <HelpPanel helpKey="seedLRT" openHelp={openHelp} />

          {/* Factor weight sliders */}
          <div className="px-5 py-3 space-y-3">
            <p className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider">
              Goal Weights
            </p>
            {FACTORS.map((f) => {
              const hasReach = f.key !== "population";
              const reachKey = f.key as keyof PlannerDecayRadii;
              const reachVal = hasReach ? decayRadii[reachKey] : 0;
              const reachMax = f.key === "lrt" ? 5000 : f.key === "bike_infra" ? 3000 : 2000;
              return (
                <div key={f.key}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span style={{ color: f.color }}>{f.icon}</span>
                    <span className="text-[12px] text-[var(--color-secondary)] flex-1">
                      {f.label}
                    </span>
                    <InfoButton helpKey={f.helpKey} openHelp={openHelp} onToggle={toggleHelp} />
                    <span className="text-[12px] font-medium text-[var(--color-fg)] tabular-nums w-8 text-right">
                      {weights[f.key]}
                    </span>
                  </div>
                  <HelpPanel helpKey={f.helpKey} openHelp={openHelp} />
                  <input
                    type="range" min={0} max={100}
                    value={weights[f.key]}
                    onChange={(e) => setWeight(f.key, Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${f.color} ${weights[f.key]}%, #e0e0e0 ${weights[f.key]}%)`,
                      accentColor: f.color,
                    }}
                  />
                  {/* Reach sub-slider for proximity-based factors */}
                  {hasReach && weights[f.key] > 0 && (
                    <div className="flex items-center gap-2 mt-1.5 pl-5">
                      <span className="text-[10px] text-[var(--color-secondary)] whitespace-nowrap">Reach</span>
                      <input
                        type="range" min={200} max={reachMax} step={100}
                        value={reachVal}
                        onChange={(e) => onUpdateDecayRadii({ ...decayRadii, [reachKey]: Number(e.target.value) })}
                        className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${f.color}60 ${((reachVal - 200) / (reachMax - 200)) * 100}%, #e0e0e0 ${((reachVal - 200) / (reachMax - 200)) * 100}%)`,
                          accentColor: f.color,
                        }}
                      />
                      <span className="text-[10px] font-medium text-[var(--color-fg)] tabular-nums w-12 text-right">
                        {reachVal >= 1000 ? `${(reachVal / 1000).toFixed(1)}km` : `${reachVal}m`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Station proximity discount */}
          <div className="px-5 py-3 border-t border-[var(--color-border)] space-y-2.5">
            <p className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider">
              Station Proximity Discount
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--color-secondary)]">Radius</span>
                  <InfoButton helpKey="proximityRadius" openHelp={openHelp} onToggle={toggleHelp} size={11} />
                  <span className="text-[11px] font-medium text-[var(--color-fg)] tabular-nums">{config.proximityDiscountRadius}m</span>
                </div>
                <HelpPanel helpKey="proximityRadius" openHelp={openHelp} />
                <input
                  type="range" min={100} max={1500} step={50}
                  value={config.proximityDiscountRadius}
                  onChange={(e) => cfg("proximityDiscountRadius", Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #78909c ${(config.proximityDiscountRadius - 100) / 1400 * 100}%, #e0e0e0 ${(config.proximityDiscountRadius - 100) / 1400 * 100}%)`,
                    accentColor: "#78909c",
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--color-secondary)]">Strength</span>
                  <InfoButton helpKey="proximityStrength" openHelp={openHelp} onToggle={toggleHelp} size={11} />
                  <span className="text-[11px] font-medium text-[var(--color-fg)] tabular-nums">{config.proximityDiscountStrength}%</span>
                </div>
                <HelpPanel helpKey="proximityStrength" openHelp={openHelp} />
                <input
                  type="range" min={0} max={100} step={5}
                  value={config.proximityDiscountStrength}
                  onChange={(e) => cfg("proximityDiscountStrength", Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #78909c ${config.proximityDiscountStrength}%, #e0e0e0 ${config.proximityDiscountStrength}%)`,
                    accentColor: "#78909c",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Network Connectivity */}
          <div className="px-5 py-3 border-t border-[var(--color-border)] space-y-2.5">
            <div className="flex items-center">
              <p className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider flex-1">
                Network Connectivity
              </p>
              <InfoButton helpKey="connectivity" openHelp={openHelp} onToggle={toggleHelp} size={12} />
            </div>
            <HelpPanel helpKey="connectivity" openHelp={openHelp} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--color-secondary)]">Radius</span>
                  <span className="text-[11px] font-medium text-[var(--color-fg)] tabular-nums">{config.connectivityRadius}m</span>
                </div>
                <input
                  type="range" min={500} max={5000} step={100}
                  value={config.connectivityRadius}
                  onChange={(e) => cfg("connectivityRadius", Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #43a047 ${(config.connectivityRadius - 500) / 4500 * 100}%, #e0e0e0 ${(config.connectivityRadius - 500) / 4500 * 100}%)`,
                    accentColor: "#43a047",
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--color-secondary)]">Strength</span>
                  <span className="text-[11px] font-medium text-[var(--color-fg)] tabular-nums">{config.connectivityStrength}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={5}
                  value={config.connectivityStrength}
                  onChange={(e) => cfg("connectivityStrength", Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #43a047 ${config.connectivityStrength}%, #e0e0e0 ${config.connectivityStrength}%)`,
                    accentColor: "#43a047",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Algorithm selection */}
          <div className="px-5 py-3 border-t border-[var(--color-border)] space-y-2.5">
            <p className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider">
              Algorithm
            </p>
            <div className="flex items-center gap-2">
              <InfoButton helpKey="algorithm" openHelp={openHelp} onToggle={toggleHelp} />
              <select
                value={config.algorithm}
                onChange={(e) => cfg("algorithm", e.target.value as PlannerAlgorithm)}
                className="flex-1 h-8 rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[12px] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-blue)]"
              >
                <option value="iterative_mclp">Iterative MCLP</option>
                <option value="greedy">Greedy</option>
              </select>
            </div>
            <HelpPanel helpKey="algorithm" openHelp={openHelp} />
            {config.algorithm === "iterative_mclp" && (
              <>
                <div className="flex items-center gap-2">
                  <InfoButton helpKey="batchSize" openHelp={openHelp} onToggle={toggleHelp} />
                  <label className="text-[11px] text-[var(--color-secondary)] w-16">Batch Size</label>
                  <input
                    type="number"
                    value={config.batchSize}
                    min={1}
                    max={100}
                    step={1}
                    onChange={(e) => cfg("batchSize", Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 h-7 rounded-md border border-[var(--color-border)] bg-white px-2 text-[12px] text-[var(--color-fg)] text-center focus:outline-none focus:border-[var(--color-blue)] tabular-nums"
                  />
                </div>
                <HelpPanel helpKey="batchSize" openHelp={openHelp} />
              </>
            )}
          </div>

          {/* Fleet & optimizer config */}
          <div className="px-5 py-3 border-t border-[var(--color-border)] space-y-2.5">
            <p className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider">
              Network Design
            </p>
            <div className="grid grid-cols-3 gap-2">
              <NumberFieldWithHelp label="Stations" value={config.numStations} min={5} max={200} step={5}
                onChange={(v) => cfg("numStations", v)} helpKey="numStations" openHelp={openHelp} onToggleHelp={toggleHelp} />
              <NumberFieldWithHelp label="Total Bikes" value={config.totalBikes} min={50} max={5000} step={25}
                onChange={(v) => cfg("totalBikes", v)} helpKey="totalBikes" openHelp={openHelp} onToggleHelp={toggleHelp} />
              <NumberFieldWithHelp label="Fill %" value={Math.round(config.targetFillPct * 100)} min={20} max={80} step={5}
                onChange={(v) => cfg("targetFillPct", v / 100)} helpKey="fillPct" openHelp={openHelp} onToggleHelp={toggleHelp} />
            </div>
            <HelpPanel helpKey="numStations" openHelp={openHelp} />
            <HelpPanel helpKey="totalBikes" openHelp={openHelp} />
            <HelpPanel helpKey="fillPct" openHelp={openHelp} />
            <div className="grid grid-cols-3 gap-2">
              <NumberFieldWithHelp label="Min Docks" value={config.minDocksPerStation} min={5} max={40} step={5}
                onChange={(v) => cfg("minDocksPerStation", v)} helpKey="minDocks" openHelp={openHelp} onToggleHelp={toggleHelp} />
              <NumberFieldWithHelp label="Max Docks" value={config.maxDocksPerStation} min={10} max={60} step={5}
                onChange={(v) => cfg("maxDocksPerStation", v)} helpKey="maxDocks" openHelp={openHelp} onToggleHelp={toggleHelp} />
              <NumberFieldWithHelp label="Spacing (m)" value={config.minSpacingM} min={200} max={3000} step={100}
                onChange={(v) => cfg("minSpacingM", v)} helpKey="spacing" openHelp={openHelp} onToggleHelp={toggleHelp} />
            </div>
            <HelpPanel helpKey="minDocks" openHelp={openHelp} />
            <HelpPanel helpKey="maxDocks" openHelp={openHelp} />
            <HelpPanel helpKey="spacing" openHelp={openHelp} />
            <div className="grid grid-cols-1 gap-2">
              <NumberFieldWithHelp label="Coverage Radius (m)" value={config.coverageRadiusM} min={200} max={3000} step={100}
                onChange={(v) => cfg("coverageRadiusM", v)} helpKey="coverageRadius" openHelp={openHelp} onToggleHelp={toggleHelp} />
            </div>
            <HelpPanel helpKey="coverageRadius" openHelp={openHelp} />
          </div>

          {/* Generate & Step buttons */}
          <div className="px-5 py-3 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-1.5 mb-2">
              <InfoButton helpKey="generate" openHelp={openHelp} onToggle={toggleHelp} />
              <HelpPanel helpKey="generate" openHelp={openHelp} inline />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onRunOptimize}
                disabled={isOptimizing || isStepping}
                className="flex-1 h-10 rounded-full bg-[var(--color-blue)] text-white text-[13px] font-semibold hover:bg-[#1557b0] disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {isOptimizing ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Generate All
                  </>
                )}
              </button>
              <button
                onClick={onStep}
                disabled={isOptimizing || isStepping}
                title="Place the next optimal station (greedy step)"
                className="h-10 px-4 rounded-full border-2 border-[var(--color-blue)] text-[var(--color-blue)] text-[13px] font-semibold hover:bg-[#e8f0fe] disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isStepping ? (
                  <span className="inline-block w-4 h-4 border-2 border-[var(--color-blue)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
                    <line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                )}
                +1
              </button>
            </div>
            {stationCount > 0 && !isOptimizing && !isStepping && !optimizeError && (
              <p className="text-[10px] text-[var(--color-secondary)] text-center mt-1.5">
                Will add stations alongside {stationCount} existing
              </p>
            )}
            {optimizeError && (
              <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                <p className="text-[11px] font-medium text-red-700 leading-relaxed">
                  {optimizeError}
                </p>
              </div>
            )}
          </div>

          {/* Coverage scorecard */}
          {coverage && (
            <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[#f8f9fa]">
              <p className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider mb-2">
                Results
              </p>
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="New Stations" value={String(coverage.stations_placed)} />
                <StatCard label="Total Bikes" value={String(coverage.total_bikes)} />
                <StatCard label="Total Docks" value={String(coverage.total_docks)} />
                <StatCard
                  label="Demand Covered"
                  value={`${coverage.demand_covered_pct}%`}
                  color={coverage.demand_covered_pct > 70 ? "#34a853" : coverage.demand_covered_pct > 40 ? "#fbbc04" : "#ea4335"}
                />
                {coverage.population_covered_pct !== undefined && (
                  <StatCard
                    label="Pop. Covered"
                    value={`${coverage.population_covered_pct}%`}
                    color={coverage.population_covered_pct > 70 ? "#34a853" : "#fbbc04"}
                  />
                )}
                <StatCard label="Avg Docks" value={String(coverage.avg_docks_per_station)} />
              </div>
              {hasGeneratedStations && (
                <button
                  onClick={onApplyStations}
                  className="w-full mt-3 h-9 rounded-full border-2 border-[#34a853] text-[#34a853] text-[12px] font-semibold hover:bg-[#e8f5e9] transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Add {coverage.stations_placed} Stations to Network
                </button>
              )}
            </div>
          )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Small (i) icon button that opens / closes a help panel. */
function InfoButton({
  helpKey,
  openHelp,
  onToggle,
  size = 13,
}: {
  helpKey: string;
  openHelp: string | null;
  onToggle: (key: string) => void;
  size?: number;
}) {
  const isOpen = openHelp === helpKey;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(helpKey);
      }}
      className="shrink-0 rounded-full flex items-center justify-center transition-colors"
      style={{
        width: size + 4,
        height: size + 4,
        background: isOpen ? "#e8f0fe" : "transparent",
      }}
      title="More info"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={isOpen ? "#1a73e8" : "#9aa0a6"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </button>
  );
}

/** Expandable help panel that renders below the control when open. */
function HelpPanel({
  helpKey,
  openHelp,
  inline,
}: {
  helpKey: string;
  openHelp: string | null;
  inline?: boolean;
}) {
  if (openHelp !== helpKey) return null;
  const entry = HELP[helpKey];
  if (!entry) return null;

  return (
    <div
      className={`bg-[#e8f0fe] rounded-lg text-[11px] leading-relaxed text-[#202124] ${
        inline ? "px-3 py-2" : "mx-5 mb-2 px-3 py-2.5"
      }`}
      style={{ animation: "fadeIn 0.15s ease" }}
    >
      <p className="font-semibold text-[12px] text-[#1a73e8] mb-1">{entry.title}</p>
      <div className="mb-1.5 whitespace-pre-line">{entry.intuitive}</div>
      <details className="group">
        <summary className="cursor-pointer text-[10px] font-medium text-[#5f6368] hover:text-[#1a73e8] transition-colors select-none">
          How it works technically
        </summary>
        <p className="mt-1 text-[10px] text-[#5f6368] leading-relaxed">
          {entry.technical}
        </p>
      </details>
      {entry.links && entry.links.length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-[#c5d8f8] flex flex-wrap gap-x-3 gap-y-1">
          {entry.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-[#1a73e8] hover:underline"
            >
              {link.label} &rarr;
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function NumberFieldWithHelp({
  label, value, min, max, step, onChange, helpKey, openHelp, onToggleHelp,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
  helpKey: string; openHelp: string | null; onToggleHelp: (k: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-0.5 mb-0.5">
        <label className="text-[10px] text-[var(--color-secondary)] flex-1">{label}</label>
        <InfoButton helpKey={helpKey} openHelp={openHelp} onToggle={onToggleHelp} size={11} />
      </div>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-7 text-[12px] text-[var(--color-fg)] bg-white border border-[var(--color-border)] rounded px-2 focus:outline-none focus:border-[var(--color-blue)] transition-colors tabular-nums"
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-md px-2.5 py-1.5 border border-[var(--color-border)]">
      <p className="text-[10px] text-[var(--color-secondary)]">{label}</p>
      <p className="text-[14px] font-semibold tabular-nums" style={{ color: color || "var(--color-fg)" }}>
        {value}
      </p>
    </div>
  );
}
