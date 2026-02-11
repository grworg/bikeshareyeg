/**
 * Documentation content — structured data for all docs sections.
 *
 * Separating content from layout makes it easy to:
 *   - Rework the UI without touching prose
 *   - Migrate to MDX / CMS later
 *   - Reorder, nest, or filter sections
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocSection {
  id: string;
  title: string;
  /** Shown in sidebar. Shorter than title when needed. */
  shortTitle?: string;
  children?: DocSection[];
  /** HTML content rendered in the main area. */
  content: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap paragraphs in <p> for cleaner authoring below. */
const p = (text: string) => `<p>${text}</p>`;

/**
 * Generate an image tag with lazy loading.
 * - `eager` images (hero) load immediately; everything else uses `loading="lazy"`.
 * - `decoding="async"` prevents blocking the main thread.
 * - Wrapped in a figure with optional caption for consistent spacing.
 */
const img = (
  src: string,
  alt: string,
  opts: { width: number; height: number; caption?: string; eager?: boolean } = { width: 800, height: 400 },
) => {
  const loading = opts.eager ? "eager" : "lazy";
  const caption = opts.caption
    ? `<figcaption class="text-center text-xs text-gray-400 mt-2">${opts.caption}</figcaption>`
    : "";
  return `<figure class="my-6">
  <img
    src="${src}"
    alt="${alt}"
    width="${opts.width}"
    height="${opts.height}"
    loading="${loading}"
    decoding="async"
    class="w-full h-auto rounded-lg border border-gray-200"
  />${caption}
</figure>`;
};

// ---------------------------------------------------------------------------
// 1. Introduction
// ---------------------------------------------------------------------------

const introduction: DocSection = {
  id: "introduction",
  title: "Introduction",
  content: "",
  children: [
    {
      id: "what-is-bikeshareyeg",
      title: "What is BikeShareYEG?",
      content: `
${img("/docs/app-overview.png", "BikeShareYEG application overview — map with suitability overlay, stations, and sidebar controls", { width: 800, height: 450, caption: "The full BikeShareYEG interface: suitability heatmap, station network, and planner controls" })}
${p(`BikeShareYEG is an open, interactive tool that lets anyone — transit planners, city councillors, urban designers, or curious citizens — design, explore, and evaluate bike-share network configurations for Edmonton, Alberta.`)}
${p(`The tool combines a <strong>Google Maps-style route planner</strong> with a full <strong>network design studio</strong>. You can place docking stations on a map, tune optimization parameters, generate networks with real algorithms, and then <em>actually see what it would be like to live in that Edmonton</em> by routing trips through the network you just built.`)}
${p(`Think of it as a shared sandbox for imagining Edmonton's cycling future — grounded in real data, powered by real optimization, and designed for real conversations about public infrastructure.`)}
      `,
    },
    {
      id: "why-bike-share",
      title: "Why Bike Share for Edmonton?",
      content: `
${p(`Edmonton is a sprawling city, and many residents live tantalizingly close to transit — but not close enough. An 18-minute walk to the nearest LRT station is too far for most people to choose regularly, but a 5-minute bike ride changes the equation entirely.`)}
${p(`With Edmonton's ongoing <strong>LRT expansion projects</strong> (Valley Line, Capital Line extension), an increasing number of Edmontonians will live within cycling distance of a rapid transit station. Bike share bridges this "last mile" gap, transforming a mediocre transit connection into a genuinely competitive commute.`)}
${p(`Bike share also supports Edmonton's <strong>City Plan</strong> goals around mode shift, emissions reduction, and building 15-minute neighbourhoods. But designing a bike-share network involves real tradeoffs: Where do you put stations? How many bikes? How do you balance coverage vs. connectivity? These are the kinds of questions this tool helps you explore.`)}
      `,
    },
    {
      id: "vision",
      title: "The Vision: Civic Engagement Through Design",
      content: `
${p(`BikeShareYEG exists to increase <strong>civic engagement</strong> in public transportation infrastructure. Too often, infrastructure decisions happen behind closed doors with little public input beyond a comment form. This tool aims to change that.`)}
${p(`By giving citizens the same planning tools as professionals — suitability analysis, optimization algorithms, route simulation — we create a shared language for discussing tradeoffs. "I think we need more stations near Southgate" becomes a concrete, testable proposal that you can build, route through, and share.`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><strong>Design</strong> a network that reflects your values and priorities</li>
  <li><strong>Experience</strong> it through realistic multi-modal route planning</li>
  <li><strong>Share</strong> your design to spark discussion with neighbours, councillors, and planners</li>
  <li><strong>Compare</strong> different approaches to understand tradeoffs</li>
</ul>
${p(`The long-term vision includes trip simulation, real-time data feeds, and collaborative design sessions — but even today, BikeShareYEG is a powerful tool for imagining a better-connected Edmonton.`)}
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. Getting Started
// ---------------------------------------------------------------------------

const gettingStarted: DocSection = {
  id: "getting-started",
  title: "Getting Started",
  content: "",
  children: [
    {
      id: "quick-tour",
      title: "Quick Tour",
      content: `
${img("/docs/ui-modes.png", "Three application modes — Trip Planner, Network Designer, Saved Networks", { width: 800, height: 380, caption: "The three modes: Trip Planner, Network Designer, and Saved Networks" })}
${p(`BikeShareYEG has three main modes, accessible from the icon rail on the left side of the screen:`)}
<ol class="list-decimal pl-6 space-y-2 my-3">
  <li><strong>Trip Planner</strong> (pin icon) — Find multi-modal routes between any two points in Edmonton. Compare walk, bike, bike-share, transit, and combined modes.</li>
  <li><strong>Network Designer</strong> (layers icon) — Place, edit, and optimize bike-share docking stations. Tune the suitability surface, run optimization algorithms, and build your ideal network.</li>
  <li><strong>Saved Networks</strong> (floppy disk icon) — Browse, load, rename, or delete previously saved network drafts.</li>
</ol>
${p(`The map fills the rest of the screen. You can toggle data overlays (LRT lines, bike paths, bus routes, population density) using the layer controls in the bottom-right corner.`)}
      `,
    },
    {
      id: "finding-a-route",
      title: "Finding a Route",
      content: `
${img("/docs/route-results.png", "Multi-modal route results showing walk, bike, bike-share, and transit options", { width: 800, height: 500, caption: "Route results comparing travel modes — bike-share options are prioritized at the top" })}
${p(`Switch to <strong>Trip Planner</strong> mode. Enter an origin and destination using the search boxes — you can type addresses, landmarks, or neighbourhoods. The app will geocode your input and show matching places.`)}
${p(`Click <strong>Get Directions</strong> to compute routes. You'll see multiple options across different travel modes:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><strong>Walk</strong> — Pedestrian-only route</li>
  <li><strong>Bike</strong> — Cycling route (uses safety-optimized roads and paths)</li>
  <li><strong>Bike Share</strong> — Walk to nearest pickup station → bike → walk from drop-off station</li>
  <li><strong>Transit</strong> — Walk + bus/LRT using real Edmonton Transit schedules</li>
  <li><strong>Transit + Bike Share</strong> — Bike-share for first/last mile, transit in between</li>
</ul>
${p(`Each route shows total distance, duration, elevation profile, and a step-by-step leg breakdown. Bike-share routes are prioritized at the top since they're what the tool helps you design.`)}
${p(`You can set a <strong>departure time</strong> to get schedule-aware transit results, or leave it blank for "depart now".`)}
      `,
    },
    {
      id: "designing-your-first-network",
      title: "Designing Your First Network",
      content: `
${img("/docs/network-designer.png", "Network Designer with suitability heatmap and placed stations", { width: 800, height: 450, caption: "The Network Designer showing suitability heatmap and auto-placed stations" })}
${p(`Switch to <strong>Network Designer</strong> mode. You'll see the suitability heatmap overlay — a hex grid showing which areas of Edmonton are best suited for bike-share stations based on population density, LRT proximity, bike infrastructure, and transit access.`)}
${p(`To get started quickly:`)}
<ol class="list-decimal pl-6 space-y-2 my-3">
  <li><strong>Seed LRT stations</strong> — Click "Seed LRT Docks" to automatically place a station at every LRT stop. This gives you a baseline network.</li>
  <li><strong>Run the optimizer</strong> — Set your desired number of stations, adjust weights if you like, and click "Generate All" to let the algorithm place stations optimally.</li>
  <li><strong>Or step through it</strong> — Click the <strong>+1</strong> button to place one station at a time, watching the suitability surface respond after each placement.</li>
  <li><strong>Apply the results</strong> — Click "Add Stations to Network" to commit generated stations to your map.</li>
  <li><strong>Fine-tune</strong> — Click any station to edit its name, capacity, or position. Drag stations to reposition them. Right-click the map to add stations manually.</li>
</ol>
${p(`Switch back to Trip Planner any time to test routes through your network!`)}
      `,
    },
    {
      id: "saving-and-sharing",
      title: "Saving & Sharing Your Network",
      content: `
${img("/docs/saved-networks.png", "Saved Networks panel with draft list", { width: 600, height: 380, caption: "Browse, load, and manage saved network drafts" })}
${p(`Your network design is automatically preserved in your browser session. To explicitly save a snapshot:`)}
<ol class="list-decimal pl-6 space-y-2 my-3">
  <li>In Network Designer mode, click <strong>"Save Draft"</strong> in the sidebar header.</li>
  <li>Enter a name for your design (e.g., "LRT-focused, 40 stations").</li>
  <li>The draft is saved to your browser's localStorage along with all station positions, algorithm configuration, weights, and decay radii.</li>
</ol>
${p(`To reload a saved design, switch to the <strong>Saved Networks</strong> mode and click on any entry. You can also rename or delete saved drafts.`)}
${p(`Saved networks use a <strong>versioned JSON format</strong> (currently v1), designed for future compatibility — including potential sharing via URL or file export.`)}
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. Route Planner
// ---------------------------------------------------------------------------

const routePlanner: DocSection = {
  id: "route-planner",
  title: "Route Planner",
  content: "",
  children: [
    {
      id: "how-routing-works",
      title: "How Routing Works",
      content: `
${p(`The route planner computes real, geometry-accurate routes using a multi-engine approach:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Walking & Cycling</strong> — Powered by <a href="https://brouter.de" target="_blank" rel="noopener" class="text-blue-600 hover:underline">BRouter</a>, an open-source routing engine that uses OpenStreetMap data. Walking uses the "shortest" profile; cycling uses the "safety" profile that prefers bike-friendly roads. Falls back to <a href="https://project-osrm.org" target="_blank" rel="noopener" class="text-blue-600 hover:underline">OSRM</a> if BRouter is unavailable.</li>
  <li><strong>Transit</strong> — Powered by <a href="https://www.opentripplanner.org" target="_blank" rel="noopener" class="text-blue-600 hover:underline">OpenTripPlanner (OTP)</a>, which combines Edmonton Transit's GTFS schedule data with OSM street data for walk-to-transit routing. Supports bus and LRT with real departure times. Falls back to a built-in GTFS LRT-only router when OTP isn't available.</li>
  <li><strong>Elevation</strong> — Route elevation profiles are computed using the <a href="https://open-meteo.com" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Open-Meteo Elevation API</a>, sampled at 50-metre intervals along each route.</li>
</ul>
${p(`All route computations happen server-side. The frontend sends origin, destination, and requested modes; the backend computes all routes in parallel and returns structured results with full GeoJSON geometries.`)}
      `,
    },
    {
      id: "travel-modes",
      title: "Travel Modes",
      content: `
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Mode</th>
      <th class="text-left py-2 pr-4 font-semibold">Description</th>
      <th class="text-left py-2 font-semibold">Engine</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4 font-medium">Walk</td><td class="py-2 pr-4">Direct pedestrian route, A to B</td><td class="py-2">BRouter (shortest) / OSRM</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Bike</td><td class="py-2 pr-4">Direct cycling route on safe roads/paths</td><td class="py-2">BRouter (safety) / OSRM</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Bike Share</td><td class="py-2 pr-4">Walk → pickup dock → bike → drop-off dock → walk</td><td class="py-2">BRouter + station state</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Transit</td><td class="py-2 pr-4">Walk + bus/LRT with real ETS schedules</td><td class="py-2">OTP / GTFS fallback</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Transit + Bike</td><td class="py-2 pr-4">Bike share for first/last mile + transit</td><td class="py-2">OTP + BRouter + station state</td></tr>
  </tbody>
</table>
</div>
      `,
    },
    {
      id: "bikeshare-routing-logic",
      title: "Bike-Share Routing Logic",
      content: `
${img("/docs/bikeshare-routing.png", "Bike-share routing logic — walk to pickup, bike ride, walk from drop-off", { width: 800, height: 400, caption: "Bike-share route structure: walk → pickup dock → bike ride → drop-off dock → walk" })}
${p(`Bike-share routing is the most complex mode because it needs to find the best <em>pair</em> of stations (pickup and drop-off) that minimize total trip time:`)}
<ol class="list-decimal pl-6 space-y-2 my-3">
  <li><strong>Find candidate pickups</strong> — stations within 1,500m of the origin that have at least one bike available.</li>
  <li><strong>Find candidate drop-offs</strong> — stations within 1,500m of the destination that have at least one empty dock.</li>
  <li><strong>Evaluate combinations</strong> — for the top 2 pickups × top 2 drop-offs, compute the full three-leg route (walk → bike → walk) and pick the fastest.</li>
</ol>
${p(`For <strong>Transit + Bike Share</strong>, the system is even more sophisticated. It takes OTP's transit itineraries and tries to replace long walking legs with bike-share access/egress. It evaluates three strategies:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><strong>First mile</strong> — Bike share from origin to transit stop</li>
  <li><strong>Last mile</strong> — Bike share from transit stop to destination</li>
  <li><strong>Both ends</strong> — Bike share on both the first and last mile</li>
</ul>
${p(`This is why the network you design directly affects the routes you can take. Move a station closer to an LRT stop, and suddenly a whole neighbourhood gets faster commutes.`)}
      `,
    },
    {
      id: "reading-your-route",
      title: "Reading Your Route",
      content: `
${img("/docs/elevation-profile.png", "Route elevation profile chart", { width: 800, height: 280, caption: "Elevation profile showing terrain along a cycling route" })}
${p(`Each route result includes:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><strong>Summary</strong> — mode, total time, and key transit routes used</li>
  <li><strong>Leg breakdown</strong> — each segment (walk, bike, bus, LRT, wait) with distance, duration, and for transit legs: route name, boarding/alighting stops, and times</li>
  <li><strong>Elevation profile</strong> — a chart showing elevation gain/loss along the route</li>
  <li><strong>Map visualization</strong> — the full route rendered on the map with color-coded legs</li>
  <li><strong>Station references</strong> — for bike-share routes, the pickup and drop-off station names and metadata</li>
</ul>
${p(`Departure and arrival times are shown for transit routes. If you didn't specify a departure time, "now" is assumed.`)}
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. Network Designer
// ---------------------------------------------------------------------------

const networkDesigner: DocSection = {
  id: "network-designer",
  title: "Network Designer",
  content: "",
  children: [
    {
      id: "placing-and-editing",
      title: "Placing & Editing Stations",
      content: `
${p(`There are several ways to add stations to your network:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Right-click the map</strong> — opens a context menu with "Add Station Here". A new station appears with default capacity and a generated name.</li>
  <li><strong>Seed LRT stations</strong> — one-click to add a docking station at every LRT stop on the network.</li>
  <li><strong>Run the optimizer</strong> — generates stations algorithmically based on your configuration.</li>
  <li><strong>Step placement</strong> — use the +1 button to place one station at a time at the optimal location.</li>
</ul>
${img("/docs/station-popup.png", "Station click popup showing metadata and delete button", { width: 600, height: 340, caption: "Click a station to see its details and manage it" })}
${p(`Once placed, you can:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><strong>Drag</strong> a selected station to reposition it</li>
  <li><strong>Click</strong> any station dot to view its metadata (name, bikes, capacity, suitability score) and optionally delete it</li>
  <li><strong>Edit</strong> a station's name, capacity, and bike count via the sidebar editor</li>
</ul>
${p(`All edits support <strong>undo/redo</strong> (Ctrl+Z / Ctrl+Y).`)}
      `,
    },
    {
      id: "station-properties",
      title: "Station Properties",
      content: `
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Property</th>
      <th class="text-left py-2 pr-4 font-semibold">Description</th>
      <th class="text-left py-2 font-semibold">Typical Range</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4 font-medium">Name</td><td class="py-2 pr-4">Human-readable label (e.g., "Southgate LRT")</td><td class="py-2">Free text</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Capacity</td><td class="py-2 pr-4">Total number of docking points (empty + occupied)</td><td class="py-2">15–30 docks</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Bikes</td><td class="py-2 pr-4">Number of bikes currently docked (affects route availability)</td><td class="py-2">≤ capacity</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Suitability</td><td class="py-2 pr-4">Weighted score (0–1) of this location's suitability based on the configured factors</td><td class="py-2">0.0–1.0</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Position</td><td class="py-2 pr-4">Latitude and longitude on the map</td><td class="py-2">Draggable</td></tr>
  </tbody>
</table>
</div>
${p(`When the optimizer assigns stations, it also runs a <strong>fleet sizing</strong> heuristic. It distributes the total bike budget proportional to each station's suitability score, rounding to multiples of 5 docks, and sets the initial bike count based on the target fill percentage (default 50%).`)}
      `,
    },
    {
      id: "undo-redo-and-drafts",
      title: "Undo/Redo & Drafts",
      content: `
${p(`Every station change (add, move, edit, delete, generate) is tracked in an undo/redo stack. Use <strong>Ctrl+Z</strong> to undo and <strong>Ctrl+Y</strong> (or Ctrl+Shift+Z) to redo. The stack is preserved within your session.`)}
${p(`When you save a draft, the current station positions plus all planner configuration (algorithm, weights, decay radii, constraints) are serialized to a versioned JSON object and stored in your browser's <code>localStorage</code>. Drafts persist across sessions until you clear browser data.`)}
      `,
    },
    {
      id: "seeding-from-lrt",
      title: "Seeding from LRT Stops",
      content: `
${p(`The "Seed LRT Docks" button reads the LRT overlay data and places a station at every LRT stop that doesn't already have one nearby (within 200m). Each seeded station gets 25 docks and is named after the LRT stop.`)}
${p(`This is a great starting point because LRT stations are natural bike-share anchors — they're the high-demand connection points where cyclists transfer to rapid transit. From this baseline, you can run the optimizer to fill in the rest of the network.`)}
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. Optimization Engine
// ---------------------------------------------------------------------------

const optimizationEngine: DocSection = {
  id: "optimization-engine",
  title: "Optimization Engine",
  content: "",
  children: [
    {
      id: "suitability-surface",
      title: "The Suitability Surface",
      content: `
${img("/docs/suitability-hexgrid.png", "Suitability surface close-up showing hex grid with factor breakdown", { width: 800, height: 400, caption: "The suitability surface — click any hex to see its factor breakdown" })}
${p(`At the heart of the optimizer is a <strong>suitability surface</strong> — a map of Edmonton divided into hexagonal cells, each scored 0–1 based on how suitable it is for a bike-share station.`)}
${p(`The surface is computed by combining four factors, each weighted by your preferences:`)}
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Factor</th>
      <th class="text-left py-2 pr-4 font-semibold">Data Source</th>
      <th class="text-left py-2 font-semibold">Scoring Method</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4 font-medium">Population Density</td><td class="py-2 pr-4">2021 Census, Dissemination Areas</td><td class="py-2">Sigmoid normalization (5,000/km² ≈ 0.75)</td></tr>
    <tr><td class="py-2 pr-4 font-medium">LRT Proximity</td><td class="py-2 pr-4">OpenStreetMap via Overpass API</td><td class="py-2">Linear decay from nearest station (default 2,000m radius)</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Bike Infrastructure</td><td class="py-2 pr-4">OpenStreetMap via Overpass API</td><td class="py-2">Linear decay from nearest path/cycleway (default 1,000m radius)</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Transit Access</td><td class="py-2 pr-4">OpenStreetMap via Overpass API</td><td class="py-2">Linear decay from nearest bus stop or LRT station (default 800m radius)</td></tr>
  </tbody>
</table>
</div>
${p(`Each factor is scored 0–1 per hex cell, then combined as a weighted average using your configured weights. You can adjust both the <strong>weight</strong> (how much each factor matters) and the <strong>decay radius</strong> (how far each factor's influence extends) in real time. The suitability overlay on the map updates instantly.`)}
      `,
    },
    {
      id: "hexagons-h3",
      title: "How Hexagons Work (H3)",
      content: `
${p(`The suitability surface uses <a href="https://h3geo.org" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Uber's H3</a> hierarchical hexagonal indexing system at <strong>resolution 9</strong>. At this resolution, each hexagon covers approximately 0.105 km² (about 100m edge-to-edge).`)}
${p(`Why hexagons instead of a square grid?`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><strong>Uniform adjacency</strong> — every hex has exactly 6 neighbours at equal distance, unlike squares (where diagonal neighbours are √2× further)</li>
  <li><strong>Better circle approximation</strong> — hexagons more closely approximate circles, making distance-based scoring more natural</li>
  <li><strong>No orientation bias</strong> — square grids create artifacts along cardinal directions</li>
</ul>
${p(`The hex grid covers Edmonton's bounding box (roughly 53.35°N to 53.70°N, 113.75°W to 113.25°W) and contains several thousand cells. Factor scores and raw distances are pre-computed per hex on the backend, then sent to the frontend where real-time weight/radius adjustments happen client-side for instant feedback.`)}
      `,
    },
    {
      id: "algorithms",
      title: "Optimization Algorithms",
      content: `
${img("/docs/algorithm-comparison.png", "Greedy vs Iterative MCLP station placement comparison", { width: 800, height: 360, caption: "Same parameters, different algorithms — greedy (left) vs MCLP (right)" })}
${p(`BikeShareYEG offers two optimization algorithms, selectable from the Network Designer sidebar:`)}

<h4 class="font-semibold text-base mt-4 mb-2">Greedy Placement</h4>
${p(`A sequential, one-at-a-time approach. At each step:`)}
<ol class="list-decimal pl-6 space-y-1 my-3">
  <li>Recompute suitability with proximity/connectivity modifiers from <em>all</em> stations placed so far</li>
  <li>Mask out hexes within the minimum spacing distance</li>
  <li>Place a station at the hex with the highest score</li>
  <li>Repeat</li>
</ol>
${p(`<strong>Strengths:</strong> Fully dynamic — every placement decision accounts for all previous ones. The proximity discount and connectivity factor genuinely evolve. Fast to compute. Can be run step-by-step interactively.`)}
${p(`<strong>Weaknesses:</strong> Locally optimal but not globally — it can't "look ahead" to see if saving a good spot now enables a better arrangement later.`)}

<h4 class="font-semibold text-base mt-4 mb-2">Iterative MCLP</h4>
${p(`Uses Google's <a href="https://developers.google.com/optimization/cp/cp_solver" target="_blank" rel="noopener" class="text-blue-600 hover:underline">OR-Tools CP-SAT solver</a> to solve the <a href="https://en.wikipedia.org/wiki/Maximum_coverage_problem" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Maximum Covering Location Problem (MCLP)</a> in batches.`)}
${p(`In each batch, the solver places a fixed number of stations (the <strong>batch size</strong>) simultaneously by maximizing suitability-weighted demand coverage subject to constraints (minimum spacing, coverage radius). After each batch, the suitability surface is recomputed with the new stations, and the next batch is solved.`)}
${p(`<strong>Strengths:</strong> Within each batch, the solver considers all placements jointly, finding combinations that are collectively better than greedy would achieve. With small batches, it also gets dynamic suitability updates.`)}
${p(`<strong>Weaknesses:</strong> Slower (NP-hard optimization per batch). The batch boundary introduces a tradeoff — larger batches give better within-batch optimality but more static suitability; smaller batches are more dynamic but lose the joint optimization benefit.`)}

<h4 class="font-semibold text-base mt-4 mb-2">How to Choose</h4>
${p(`For most users, <strong>Greedy</strong> is the recommended starting point. It's fast, intuitive (especially in step mode), and produces good results. Use <strong>Iterative MCLP</strong> when you want to explore whether joint optimization yields noticeably different placements — try batch size 5–10 for a balance of speed and quality.`)}
${p(`Note: Iterative MCLP with batch size 1 is <em>not</em> mathematically equivalent to Greedy, because the MCLP solver uses a coverage radius constraint that the greedy approach doesn't.`)}
      `,
    },
    {
      id: "step-mode",
      title: "Step-by-Step Mode",
      content: `
${img("/docs/step-mode-sequence.png", "Step-by-step placement showing suitability evolving over 3 frames", { width: 800, height: 280, caption: "Stepping through placement — watch the suitability surface respond to each station" })}
${p(`The <strong>+1 button</strong> runs a single greedy step: it computes the full suitability surface (including proximity/connectivity from all existing stations), finds the best valid hex, and places one station there.`)}
${p(`Because the suitability overlay reacts to station placements in real time, you can watch the heatmap shift as each station is added — like scrubbing through the algorithm frame by frame. Areas near the new station dim (proximity discount), while isolated areas gain value (connectivity pull).`)}
${p(`This is the most intuitive way to understand how the optimization works and why stations end up where they do.`)}
      `,
    },
    {
      id: "constraints-and-modifiers",
      title: "Constraints & Modifiers",
      content: `
${img("/docs/constraints-diagram.png", "Constraints visualization — spacing, proximity discount, and connectivity zones", { width: 800, height: 400, caption: "How spacing, proximity discount, and connectivity constraints shape the network" })}
<h4 class="font-semibold text-base mt-4 mb-2">Minimum Spacing</h4>
${p(`A hard constraint: no two stations can be closer than this distance (default 800m). This prevents clustering and ensures each station serves a distinct catchment area.`)}

<h4 class="font-semibold text-base mt-4 mb-2">Station Proximity Discount</h4>
${p(`A soft modifier: hexes close to an existing station get their suitability score reduced. This discourages redundant coverage. Configured by two parameters:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><strong>Radius</strong> (default 500m) — how far the discount extends</li>
  <li><strong>Strength</strong> (default 70%) — maximum discount at distance 0. The discount fades linearly to zero at the radius.</li>
</ul>

<h4 class="font-semibold text-base mt-4 mb-2">Network Connectivity Factor</h4>
${p(`A soft modifier: hexes far from <em>any</em> existing station get a suitability penalty. This encourages building a connected network rather than isolated clusters. Configured by:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><strong>Radius</strong> (default 2,000m) — stations within this distance are "connected". Beyond it, the penalty grows.</li>
  <li><strong>Strength</strong> (default 60%) — maximum penalty for very isolated locations.</li>
</ul>

<h4 class="font-semibold text-base mt-4 mb-2">Coverage Radius</h4>
${p(`Used by the <strong>Iterative MCLP</strong> algorithm only. A demand hex is "covered" if a station is within this radius (default 1,000m). The solver maximizes the total suitability-weighted demand that's covered. Also used in post-optimization coverage statistics for both algorithms.`)}
      `,
    },
    {
      id: "fleet-sizing",
      title: "Fleet Sizing",
      content: `
${p(`After the optimizer places stations, a <strong>fleet sizing heuristic</strong> assigns dock counts and bikes:`)}
<ol class="list-decimal pl-6 space-y-2 my-3">
  <li><strong>Weight each station</strong> by its suitability score (higher-demand stations get more capacity)</li>
  <li><strong>Distribute the total bike budget</strong> proportionally, subject to min/max docks per station (default 15–30)</li>
  <li><strong>Round dock counts</strong> to the nearest 5 for practical sizing</li>
  <li><strong>Set initial bikes</strong> = capacity × target fill percentage (default 50%)</li>
</ol>
${p(`You can adjust the total bikes, min/max docks, and fill percentage before running the optimizer. After generation, individual station capacities can be fine-tuned manually.`)}
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. Data Sources
// ---------------------------------------------------------------------------

const dataSources: DocSection = {
  id: "data-sources",
  title: "Data Sources",
  content: "",
  children: [
    {
      id: "population-density",
      title: "Population Density",
      content: `
${img("/docs/data-sources-map.png", "Map with all data overlays enabled — LRT, bike paths, bus routes, population", { width: 800, height: 400, caption: "All data layers visible: LRT (blue), bike infrastructure (green), bus routes (orange), population (choropleth)" })}
${p(`Population data comes from the <strong>2021 Canadian Census</strong> at the <strong>Dissemination Area (DA)</strong> level — the finest geographic unit available from Statistics Canada. Each DA is a small area (typically 400–700 people) with its own population count and boundary polygon.`)}
${p(`The raw census data is processed by <code>scripts/process-census-data.py</code> into a GeoJSON file (<code>data/overlays/population_density.geojson</code>) containing DA polygons with computed density values (people per km²).`)}
${p(`For the suitability surface, density is normalized using a sigmoid-like curve: <code>score = 1 - 1 / (1 + density / 3000)</code>. This means 5,000 people/km² scores about 0.75, while very dense areas (10,000+/km²) approach 1.0.`)}
      `,
    },
    {
      id: "lrt-network",
      title: "LRT Network & Stations",
      content: `
${p(`LRT data is fetched from <strong>OpenStreetMap</strong> via the <a href="https://overpass-api.de" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Overpass API</a>. The query pulls:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li>Nodes tagged <code>railway=station</code> + <code>station=light_rail</code> (station points)</li>
  <li>Ways tagged <code>railway=light_rail</code> or <code>railway=subway</code> (line geometries)</li>
</ul>
${p(`This covers the Capital Line, Metro Line, and Valley Line as mapped by the OSM community. The data is cached permanently on disk after the first fetch, so subsequent loads are instant.`)}
${p(`For transit routing, Edmonton Transit's <strong>GTFS feed</strong> provides schedule data (stop times, trip patterns, service calendars) for LRT and bus routes. This is loaded from <code>data/gtfs/gtfs.zip</code>.`)}
      `,
    },
    {
      id: "bike-infrastructure",
      title: "Bike Infrastructure",
      content: `
${p(`Bike infrastructure data comes from <strong>OpenStreetMap</strong> via the Overpass API. The query captures dedicated cycling infrastructure:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><code>highway=cycleway</code> — dedicated cycle tracks</li>
  <li><code>highway=path, bicycle=designated</code> — shared-use paths designated for cycling</li>
  <li><code>cycleway=track</code> — protected bike lanes alongside roads</li>
  <li><code>cycleway=separate</code> — physically separated cycle infrastructure</li>
</ul>
${p(`Painted on-road bike lanes (e.g., sharrows) are <em>excluded</em> because they add minimal safety value and caused Overpass query timeouts due to matching thousands of road ways.`)}
${p(`For the suitability factor, line geometries are sampled at 100m intervals to create a dense point cloud, and each hex is scored by its distance to the nearest sample point with a configurable decay radius (default 1,000m).`)}
      `,
    },
    {
      id: "transit-stops",
      title: "Transit Routes & Stops",
      content: `
${p(`Transit stop data comes from OpenStreetMap via Overpass:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><code>highway=bus_stop</code> — bus stop markers</li>
  <li><code>public_transport=stop_position, bus=yes</code> — bus stop positions</li>
  <li>LRT stations (shared with the LRT factor)</li>
</ul>
${p(`Bus route line geometries are fetched separately for the overlay display. The transit suitability factor uses bus and LRT stop locations to score areas by transit accessibility (default 800m decay radius).`)}
${p(`For schedule-aware routing, <strong>OpenTripPlanner (OTP)</strong> ingests the Edmonton Transit GTFS feed plus OSM street data to provide real-time trip planning with accurate departure times, transfers, and walk segments.`)}
      `,
    },
    {
      id: "data-freshness",
      title: "Data Freshness & Limitations",
      content: `
${p(`Data freshness varies by source:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Population</strong> — 2021 Census. Will not reflect new developments or population shifts since then. A 5-year lag is inherent to Canadian Census cycles.</li>
  <li><strong>OSM infrastructure</strong> — As current as the OpenStreetMap community keeps it. Edmonton's OSM data is generally well-maintained but may lag recent construction. Overpass responses are cached on disk permanently; delete the cache files to force a refresh.</li>
  <li><strong>Transit schedules</strong> — Depends on the GTFS feed version in <code>data/gtfs/</code>. Should be updated periodically from Edmonton Transit's published feed.</li>
  <li><strong>Elevation</strong> — Open-Meteo's elevation data is derived from SRTM/Copernicus DEM, generally accurate to ±10m vertical.</li>
</ul>
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. Assumptions & Limitations
// ---------------------------------------------------------------------------

const assumptions: DocSection = {
  id: "assumptions",
  title: "Assumptions & Limitations",
  content: "",
  children: [
    {
      id: "modeling-assumptions",
      title: "Modeling Assumptions",
      content: `
${p(`Several simplifying assumptions underpin the current model:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Flat-earth distance</strong> — Inter-point distances are computed using Euclidean approximation with latitude/longitude-to-metres conversion at Edmonton's latitude (53.5°N). This is accurate to within ~0.3% for the distances involved and much faster than Haversine.</li>
  <li><strong>Demand proxy</strong> — The suitability surface is a <em>proxy</em> for demand, not a direct measurement. We assume that areas with more people, better transit, and more cycling infrastructure will generate more bike-share trips. Real demand data (e.g., from existing bike-share systems in comparable cities) would improve accuracy.</li>
  <li><strong>Static station state</strong> — The route planner uses the current station configuration as a snapshot. It doesn't model rebalancing (bikes being redistributed by trucks) or time-varying demand patterns.</li>
  <li><strong>Uniform cycling speed</strong> — Bike legs assume approximately 15–18 km/h, determined by BRouter's safety profile. Actual speeds vary with terrain, weather, and rider fitness.</li>
  <li><strong>Walking speed</strong> — Assumed ~5 km/h (1.4 m/s). Doesn't account for terrain, accessibility needs, or weather.</li>
  <li><strong>No seasonal modeling</strong> — Edmonton's winters significantly impact cycling viability. The current tool doesn't model seasonal demand variation.</li>
</ul>
      `,
    },
    {
      id: "what-this-is-not",
      title: "What This Tool Is Not",
      content: `
${p(`BikeShareYEG is a <strong>planning and imagination tool</strong>, not a production-grade transport model. Specifically:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Not a traffic simulation</strong> — It doesn't model individual trips, queueing, or station-level bike availability over time. (This is on the roadmap.)</li>
  <li><strong>Not an economic analysis</strong> — It doesn't estimate construction costs, operating costs, or revenue. Station placement is driven by suitability, not ROI.</li>
  <li><strong>Not an official city tool</strong> — This is an independent civic project. The City of Edmonton has its own planning processes and data.</li>
  <li><strong>Not real-time</strong> — Transit routing uses schedule data, not real-time bus/LRT positions. Station bike counts are set by the designer, not a live feed.</li>
</ul>
      `,
    },
    {
      id: "known-gaps",
      title: "Known Gaps & Future Work",
      content: `
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Additional suitability factors</strong> — employment density, points of interest (universities, hospitals, shopping centres), land use zoning, and topography (steep hills reduce cycling appeal).</li>
  <li><strong>Demand modeling</strong> — Trip generation/attraction models using origin-destination surveys or data from comparable cities (e.g., Toronto Bike Share, Mobi Vancouver).</li>
  <li><strong>Rebalancing simulation</strong> — Modeling how bikes flow through the network over a day and where rebalancing trucks need to go.</li>
  <li><strong>Cost estimation</strong> — Infrastructure cost per station, per dock, per bike, plus operating costs.</li>
  <li><strong>Equity analysis</strong> — Ensuring network coverage doesn't disproportionately favor affluent neighbourhoods.</li>
  <li><strong>Winter operations</strong> — Seasonal network adjustments, heated docks, or reduced winter fleet.</li>
</ul>
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// 8. Under the Hood
// ---------------------------------------------------------------------------

const underTheHood: DocSection = {
  id: "under-the-hood",
  title: "Under the Hood",
  content: "",
  children: [
    {
      id: "architecture-overview",
      title: "Architecture Overview",
      content: `
${img("/docs/architecture-diagram.png", "System architecture diagram", { width: 800, height: 380, caption: "BikeShareYEG system architecture — frontend, API, and backend services" })}
${p(`BikeShareYEG is a full-stack application with a clear separation between frontend and backend:`)}
<div class="my-4 p-4 bg-gray-50 rounded-lg font-mono text-sm leading-relaxed">
  <pre class="whitespace-pre-wrap">┌─────────────────────────────────┐
│         Next.js Frontend        │
│   React · Deck.gl · MapLibre   │
│    Tailwind CSS · TypeScript    │
├─────────────────────────────────┤
│           REST API              │
│     JSON over HTTP (fetch)      │
├─────────────────────────────────┤
│        FastAPI Backend          │
│  Python · NumPy · OR-Tools     │
│   Overpass · OTP · BRouter     │
└─────────────────────────────────┘</pre>
</div>
${p(`The frontend and backend communicate via JSON REST endpoints. The backend is stateful only for the hex grid cache (which is recomputed on startup) and station state (which the frontend syncs explicitly).`)}
      `,
    },
    {
      id: "frontend-tech",
      title: "Frontend",
      content: `
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong><a href="https://nextjs.org" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Next.js 15</a></strong> — React framework with file-based routing and server-side rendering capabilities.</li>
  <li><strong><a href="https://deck.gl" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Deck.gl 9</a></strong> — GPU-accelerated WebGL visualization layers. Used for the suitability hex grid (GeoJsonLayer), station dots (ScatterplotLayer), and route lines. Renders thousands of features at 60fps.</li>
  <li><strong><a href="https://maplibre.org" target="_blank" rel="noopener" class="text-blue-600 hover:underline">MapLibre GL JS</a></strong> — Open-source map renderer (via react-map-gl). Provides the base map tiles, zoom/pan controls, and projection.</li>
  <li><strong><a href="https://tailwindcss.com" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Tailwind CSS 4</a></strong> — Utility-first CSS framework for all UI styling.</li>
  <li><strong>TypeScript</strong> — Full type coverage across all components and API interfaces.</li>
</ul>
${p(`Key architectural decisions:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li>Stations are rendered as a single <strong>ScatterplotLayer</strong> (GPU) instead of individual DOM markers — critical for performance with 50+ stations.</li>
  <li>Suitability weights and decay radii are applied <strong>client-side</strong> — the backend sends raw factor scores and distances per hex, and the frontend recomputes weighted scores in a <code>useMemo</code> for instant slider feedback.</li>
  <li>The undo/redo stack uses an immutable snapshot approach with a custom <code>useUndoRedo</code> hook.</li>
</ul>
      `,
    },
    {
      id: "backend-tech",
      title: "Backend",
      content: `
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong><a href="https://fastapi.tiangolo.com" target="_blank" rel="noopener" class="text-blue-600 hover:underline">FastAPI</a></strong> — High-performance Python web framework with automatic OpenAPI documentation, async support, and Pydantic validation.</li>
  <li><strong><a href="https://numpy.org" target="_blank" rel="noopener" class="text-blue-600 hover:underline">NumPy</a></strong> — Vectorized computation for suitability scoring, distance matrices, and spatial operations. All hex-level operations use batched numpy for performance.</li>
  <li><strong><a href="https://developers.google.com/optimization" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Google OR-Tools</a></strong> — The CP-SAT constraint programming solver powers the MCLP optimization. It handles integer programming with complex constraints (spacing, coverage, budget) efficiently.</li>
  <li><strong><a href="https://h3geo.org" target="_blank" rel="noopener" class="text-blue-600 hover:underline">H3</a></strong> — Uber's hexagonal spatial indexing for the suitability grid.</li>
  <li><strong>Overpass API</strong> — OpenStreetMap query interface for LRT, bike, and transit infrastructure data.</li>
  <li><strong><a href="https://www.opentripplanner.org" target="_blank" rel="noopener" class="text-blue-600 hover:underline">OpenTripPlanner</a></strong> — Multi-modal transit routing engine (optional; falls back to built-in GTFS parser).</li>
  <li><strong><a href="https://brouter.de" target="_blank" rel="noopener" class="text-blue-600 hover:underline">BRouter</a></strong> — Cycling and walking route computation using OSM data.</li>
</ul>
      `,
    },
    {
      id: "api-reference",
      title: "API Reference",
      content: `
${p(`All endpoints live under <code>/api/</code>. The backend auto-generates OpenAPI docs at <code>/docs</code> when running in debug mode.`)}
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Endpoint</th>
      <th class="text-left py-2 pr-4 font-semibold">Method</th>
      <th class="text-left py-2 font-semibold">Description</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/routes</td><td class="py-2 pr-4">POST</td><td class="py-2">Multi-modal route computation</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/stations</td><td class="py-2 pr-4">GET</td><td class="py-2">List all current stations</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/stations</td><td class="py-2 pr-4">POST</td><td class="py-2">Save/update station list</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/stations/reset</td><td class="py-2 pr-4">POST</td><td class="py-2">Reset to default stations</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/geocode</td><td class="py-2 pr-4">GET</td><td class="py-2">Geocode a place name to coordinates</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/geocode/reverse</td><td class="py-2 pr-4">GET</td><td class="py-2">Reverse geocode coordinates to address</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/planner/hex-grid</td><td class="py-2 pr-4">GET</td><td class="py-2">Get suitability hex grid (GeoJSON)</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/planner/factors</td><td class="py-2 pr-4">GET</td><td class="py-2">List available suitability factors</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/planner/optimize</td><td class="py-2 pr-4">POST</td><td class="py-2">Run full network optimization</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/planner/step</td><td class="py-2 pr-4">POST</td><td class="py-2">Place a single optimal station (greedy step)</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/overlays/{layer}</td><td class="py-2 pr-4">GET</td><td class="py-2">GeoJSON overlay (lrt, bike, bus, population)</td></tr>
    <tr><td class="py-2 pr-4 font-mono text-xs">/api/elevation</td><td class="py-2 pr-4">POST</td><td class="py-2">Elevation profile for a polyline</td></tr>
  </tbody>
</table>
</div>
      `,
    },
    {
      id: "map-rendering",
      title: "Map Rendering & Performance",
      content: `
${img("/docs/layer-stack.png", "Map rendering layer stack diagram", { width: 800, height: 340, caption: "Rendering stack: base tiles → Deck.gl GPU layers → HTML overlays" })}
${p(`The map uses a layered rendering approach:`)}
<ol class="list-decimal pl-6 space-y-2 my-3">
  <li><strong>Base map</strong> — MapLibre GL renders vector tiles (OpenStreetMap Bright style) with standard zoom/pan/tilt controls.</li>
  <li><strong>Deck.gl overlay</strong> — GPU-rendered layers are composited on top:
    <ul class="list-disc pl-4 mt-1 space-y-1">
      <li><em>GeoJsonLayer</em> — suitability hexagons, overlay lines (LRT, bike paths, bus routes), population choropleth</li>
      <li><em>ScatterplotLayer</em> — all station dots (GPU-rendered, one draw call for hundreds of stations)</li>
      <li><em>PathLayer</em> — route polylines with per-leg coloring</li>
    </ul>
  </li>
  <li><strong>HTML overlay</strong> — the selected station marker (one DOM element for drag support), click-popups for hexes and stations</li>
</ol>
${p(`This architecture keeps the map at 60fps even with the full suitability grid visible and 50+ stations on screen. The key insight is that only one station (the selected one) ever needs to be a DOM element; everything else is GPU-rendered.`)}
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// 9. Future Roadmap
// ---------------------------------------------------------------------------

const roadmap: DocSection = {
  id: "roadmap",
  title: "Future Roadmap",
  content: `
${p(`BikeShareYEG is an evolving project. Here's where it's heading:`)}

<h4 class="font-semibold text-base mt-4 mb-2">Trip Simulation</h4>
${p(`The next major feature: simulate thousands of trips through your network over a day. Watch bikes flow between stations, see where shortages develop, identify rebalancing needs, and measure real-world performance metrics like average wait time and trip success rate.`)}

<h4 class="font-semibold text-base mt-4 mb-2">Real-Time Data Integration</h4>
${p(`Connect to live transit feeds (GTFS-RT) for real-time bus/LRT positions and arrival predictions. If Edmonton launches a bike-share system, integrate its live station availability data.`)}

<h4 class="font-semibold text-base mt-4 mb-2">Sharing & Collaboration</h4>
${p(`Export network designs as shareable URLs or files. Enable collaborative design sessions where multiple people can work on the same network. Publish designs to a public gallery for community voting and discussion.`)}

<h4 class="font-semibold text-base mt-4 mb-2">Additional Suitability Factors</h4>
${p(`Add employment density, points of interest, university/hospital locations, land use zoning, and topography as factors in the suitability surface.`)}

<h4 class="font-semibold text-base mt-4 mb-2">Equity Analysis</h4>
${p(`Overlay income, demographics, and access-to-services data to ensure network designs serve all Edmontonians equitably, not just high-density corridors.`)}

<h4 class="font-semibold text-base mt-4 mb-2">Cost Estimation</h4>
${p(`Estimate infrastructure and operating costs for a proposed network, so citizens can understand the full picture when advocating for bike share.`)}

<h4 class="font-semibold text-base mt-4 mb-2">Public Feedback Mechanisms</h4>
${p(`Enable citizens to annotate, comment on, and vote on proposed station locations — turning the tool into a genuine public engagement platform.`)}
  `,
  children: [],
};

// ---------------------------------------------------------------------------
// 10. About
// ---------------------------------------------------------------------------

const about: DocSection = {
  id: "about",
  title: "About",
  content: "",
  children: [
    {
      id: "the-story",
      title: "The Story Behind This Project",
      content: `
${p(`BikeShareYEG started with a simple frustration: living 18 minutes' walk from the Southgate LRT station — too far to choose walking regularly, but perfectly bikeable.`)}
${p(`That "last mile" gap is a universal problem in sprawling cities. Millions of potential transit trips don't happen because the walk to/from the station is just too far, too cold, or too slow. But bike share changes the math entirely. A 5-minute ride replaces an 18-minute walk, and suddenly LRT becomes a genuinely competitive way to get around.`)}
${p(`With Edmonton's LRT expansion projects connecting more neighbourhoods to rapid transit, the opportunity for bike share grows every year. This tool exists to help Edmontonians see that opportunity, play with it, and advocate for it with data-backed proposals.`)}
      `,
    },
    {
      id: "contributing",
      title: "Contributing",
      content: `
${p(`BikeShareYEG is an open project. If you're interested in contributing — whether it's code, data, design, or ideas — reach out! Areas where help is especially welcome:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li>Additional suitability factors and data sources</li>
  <li>Trip simulation engine</li>
  <li>UI/UX improvements and accessibility</li>
  <li>Testing with real Edmonton cycling data</li>
  <li>French language support</li>
  <li>Mobile-responsive design</li>
</ul>
      `,
    },
    {
      id: "acknowledgments",
      title: "Acknowledgments",
      content: `
${p(`This project is built on the shoulders of open data and open-source software:`)}
<ul class="list-disc pl-6 space-y-1 my-3">
  <li><strong>Statistics Canada</strong> — 2021 Census data</li>
  <li><strong>OpenStreetMap</strong> — Map data and infrastructure layers (contributed by the global OSM community)</li>
  <li><strong>Edmonton Transit Service</strong> — GTFS schedule data</li>
  <li><strong>City of Edmonton Open Data Portal</strong> — neighbourhood boundaries and infrastructure datasets</li>
  <li><strong>Uber H3</strong> — hexagonal spatial indexing</li>
  <li><strong>Google OR-Tools</strong> — constraint programming solver</li>
  <li><strong>OpenTripPlanner</strong> — multi-modal transit routing</li>
  <li><strong>BRouter</strong> — cycling and walking route computation</li>
  <li><strong>Open-Meteo</strong> — elevation data API</li>
  <li><strong>MapLibre</strong> — open-source map rendering</li>
  <li><strong>Deck.gl</strong> — GPU-accelerated geospatial visualization</li>
</ul>
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// Export all sections
// ---------------------------------------------------------------------------

export const DOC_SECTIONS: DocSection[] = [
  introduction,
  gettingStarted,
  routePlanner,
  networkDesigner,
  optimizationEngine,
  dataSources,
  assumptions,
  underTheHood,
  roadmap,
  about,
];
