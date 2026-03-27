/**
 * Pilot proposal content — the case for a proof-of-concept launch.
 *
 * Companion to the full 50-station proposal. This document argues for
 * starting with 24 stations to generate real data, build public support,
 * and accelerate toward the larger network.
 *
 * Design: all-pedal fleet (no e-bikes), solar-only stations (no shore
 * power), maximising station density and network coverage for the budget.
 *
 * Research sources cited inline. All cost figures in 2025 CAD.
 */

import type { DocSection } from "../content";

const p = (text: string) => `<p>${text}</p>`;

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

const whySmaller: DocSection = {
  id: "pilot-why",
  title: "Why Start with a Focused Launch",
  shortTitle: "Why Start Focused",
  content: `
${p(`The <a href="/docs/proposal" class="text-blue-600 hover:underline">full proposal</a> makes the case for a 50-station, 500-bike system at roughly $4 million in capital. That remains the right target — a network large enough to reach critical mass and generate the ridership that makes bike-share self-reinforcing. A proof-of-concept pilot is a way to <strong>accelerate toward that goal</strong>, not a substitute for it.`)}
${p(`Twenty-four stations and roughly 240 pedal bikes, concentrated in one or two high-demand corridors, gets bikes on the street quickly and starts generating the data that makes every subsequent decision sharper: <em>Which stations are busiest? How do riders connect to transit? What does Edmonton's seasonal ridership curve actually look like?</em> That operational intelligence makes the full 50-station buildout stronger, faster, and more precisely targeted.`)}
${p(`Every large, successful bike-share system in North America grew from a smaller one. BIXI Montreal launched in 2009 with a focused downtown network and expanded to 865+ stations over 15 years. Bike Share Toronto started with 80 stations in 2011 and now operates 850+. Chattanooga launched with 30 stations in a 2.5 km² area. Hamilton's SoBi started with a Metrolinx grant and 110 lightweight hubs before growing to 150. The pattern is universal: <strong>prove demand in a concentrated area, then expand with confidence</strong>.`)}
${p(`Starting with a focused pilot is not a half-measure — it's the standard playbook, and it's how the most successful systems in North America got started. A concentrated first phase generates three assets that strengthen the full buildout:`)}
<div class="grid gap-3 my-4">
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5 font-bold text-blue-700">1</span>
    <div><strong>Ground-truth data.</strong> Real trip counts, origin–destination pairs, seasonal curves, and rebalancing patterns specific to Edmonton. One season of operational data lets you calibrate station placement and capacity models with observed behaviour rather than estimates.</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5 font-bold text-blue-700">2</span>
    <div><strong>Public constituency.</strong> Riders who depend on the system become advocates for expansion. Hamilton's SoBi saw 7,300 active users in Year One — 7,300 voters who would object to the system being removed. You cannot build that constituency with a feasibility study.</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5 font-bold text-blue-700">3</span>
    <div><strong>Institutional knowledge.</strong> Operating a bike-share system — rebalancing, maintenance, winter decisions, vandalism response — requires skills the city does not currently have. A focused pilot builds that capacity before scaling.</div>
  </div>
</div>
  `,
  children: [],
};

const lessons: DocSection = {
  id: "pilot-lessons",
  title: "Lessons from Early Launches",
  shortTitle: "Lessons",
  content: `
${p(`Several patterns emerge from the first seasons of small and mid-sized bike-share deployments across North America. These inform every parameter in this pilot design.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Density Beats Coverage</h4>
${p(`The single most consistent finding in bike-share research is that <strong>station density within the service area matters far more than geographic spread</strong>. NACTO's analysis of North American systems found that ridership per station increases significantly when there are more stations within a 15-minute ride — the "network effect." Riders need a station within 300 metres of both their origin and their destination to choose bike-share over walking or driving.`)}
${p(`ITDP recommends a minimum density of 10–16 stations per km² for a mature system. A 24-station pilot cannot hit that benchmark citywide, but it <em>can</em> achieve 8–10 stations per km² within a focused service area of ~3 km². This is the critical design constraint: <strong>a pilot that covers a tight area at adequate density will outperform a larger pilot that spreads stations too thin</strong>.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Cold Weather Is Not a Dealbreaker</h4>
${p(`Montreal — colder and snowier than Edmonton — runs BIXI year-round and logged nearly 12 million trips in 2023. Salt Lake City's GREENbike has operated through winter since 2013, with January ridership growing 35% year-over-year. Minneapolis's Lime bikeshare recorded 1.2–1.3 trips per vehicle daily through winter, exceeding the expected 0.5–0.75.`)}
${p(`Edmonton's cycling season (April–October, roughly 7 months) is sufficient for a first-year pilot. Whether to extend into winter is a data-informed decision, not a prerequisite. The pilot should collect weather-vs-ridership data from day one so the city has Edmonton-specific seasonal curves rather than borrowing from other cities.`)}

<h4 class="font-semibold text-base mt-6 mb-2">First-Year Ridership Benchmarks</h4>
${p(`Setting expectations correctly matters — both for operations and for the political narrative around success. Here is what comparable first-year systems achieved:`)}
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">City</th>
      <th class="text-right py-2 pr-4 font-semibold">Stations</th>
      <th class="text-right py-2 pr-4 font-semibold">Bikes</th>
      <th class="text-right py-2 pr-4 font-semibold">Year 1 Trips</th>
      <th class="text-right py-2 font-semibold">Trips/Bike/Day</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Hamilton (SoBi, 2015)</td><td class="text-right py-2 pr-4">110+</td><td class="text-right py-2 pr-4">750</td><td class="text-right py-2 pr-4">215,000</td><td class="text-right py-2">~1.1</td></tr>
    <tr><td class="py-2 pr-4">Chattanooga (2012)</td><td class="text-right py-2 pr-4">30</td><td class="text-right py-2 pr-4">300</td><td class="text-right py-2 pr-4">~25,000*</td><td class="text-right py-2">~0.5*</td></tr>
    <tr><td class="py-2 pr-4">Mountain View, CA (2019)</td><td class="text-right py-2 pr-4">~15</td><td class="text-right py-2 pr-4">~200</td><td class="text-right py-2 pr-4">33,500</td><td class="text-right py-2">~0.84</td></tr>
    <tr><td class="py-2 pr-4">Bellevue, WA (2022)</td><td class="text-right py-2 pr-4">~20</td><td class="text-right py-2 pr-4">~250</td><td class="text-right py-2 pr-4">45,000</td><td class="text-right py-2">~0.7</td></tr>
  </tbody>
</table>
</div>
<p class="text-xs text-gray-400 -mt-2 mb-4">* Chattanooga figure extrapolated from 12,600 rides in first 6 months.</p>
${p(`A reasonable first-season target for a 24-station, 240-bike Edmonton pilot operating April–October is <strong>30,000–50,000 trips</strong>, or roughly <strong>0.6–1.0 trips per bike per day</strong>. Anything above 1.0 in the first season is a strong signal. Below 0.5 warrants a hard look at station placement before expanding.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Rebalancing Is the Hidden Cost</h4>
${p(`Every pilot evaluation report identifies the same operational surprise: <strong>rebalancing — physically moving bikes from full stations to empty ones — is more expensive and operationally complex than expected</strong>. In commuter-oriented networks, bikes flow in one direction in the morning and the other in the evening.`)}
${p(`This has a direct design implication: a pilot network should include stations at <em>both ends</em> of major commute flows, and station sizing should account for directional imbalance. BikeShareYEG's suitability model can flag this during the design phase, but no model can eliminate rebalancing entirely. The operating budget must account for rebalancing vehicles and an operator from day one.`)}
  `,
  children: [],
};

const parameters: DocSection = {
  id: "pilot-parameters",
  title: "Recommended Pilot Parameters",
  shortTitle: "Parameters",
  content: `
<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
  <div class="text-center p-4 rounded-xl bg-blue-50 border border-blue-100">
    <div class="text-3xl font-bold text-blue-700">24</div>
    <div class="text-xs text-blue-600/80 mt-1">Dock Stations</div>
  </div>
  <div class="text-center p-4 rounded-xl bg-blue-50 border border-blue-100">
    <div class="text-3xl font-bold text-blue-700">~240</div>
    <div class="text-xs text-blue-600/80 mt-1">Pedal Bikes</div>
  </div>
  <div class="text-center p-4 rounded-xl bg-blue-50 border border-blue-100">
    <div class="text-3xl font-bold text-blue-700">~3</div>
    <div class="text-xs text-blue-600/80 mt-1">km² Service Area</div>
  </div>
  <div class="text-center p-4 rounded-xl bg-blue-50 border border-blue-100">
    <div class="text-3xl font-bold text-blue-700">7</div>
    <div class="text-xs text-blue-600/80 mt-1">Month Season</div>
  </div>
</div>

<h4 class="font-semibold text-base mt-6 mb-2">Why 24 Stations?</h4>
${p(`Station count is the single most important lever in a pilot design. With 24 stations there are 276 possible origin–destination pairs — over four times the 66 pairs a 12-station network offers. That's the difference between a system that occasionally matches someone's trip and one that routinely does.`)}
${p(`At 300–400m spacing — the range recommended by NACTO and ITDP — 24 stations cover a service area of roughly 3 km², achieving a density of ~8 stations per km². That approaches the ITDP minimum of 10 for a mature system and comfortably exceeds the threshold where the network effect starts driving ridership growth. It's enough to span two intersecting corridors (for example, a north–south route through a university district crossing an east–west route along a commercial high street to an LRT station).`)}

<h4 class="font-semibold text-base mt-6 mb-2">All-Pedal Fleet</h4>
${p(`The pilot fleet is <strong>100% pedal bikes</strong> — no e-bikes. This is a deliberate design choice with three advantages:`)}
<div class="grid gap-2 my-4">
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5 font-bold text-blue-700">1</span>
    <div><strong>Simpler stations.</strong> Without e-bike charging, stations run entirely on solar power — no grid connection, no electrical permitting, no trenching. This makes stations cheaper, faster to install, and trivially relocatable.</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5 font-bold text-blue-700">2</span>
    <div><strong>Lower capital risk.</strong> Pedal bikes cost ~$1,200 vs ~$3,000 for e-bikes. At 240 bikes, that's a difference of over $400,000 — money that buys 10 more stations instead. More stations means more coverage, more data, and a stronger proof of demand.</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5 font-bold text-blue-700">3</span>
    <div><strong>Simpler operations.</strong> No battery management, no charger maintenance, no mixed-fleet logistics. Every bike is interchangeable. This keeps the first-year operation lean and focused on the basics: rebalancing, dock maintenance, and rider experience.</div>
  </div>
</div>
${p(`Edmonton's pilot corridors are largely flat — the river valley is the main topographic challenge, and the suitability model's terrain factor steers station placement away from steep grades. E-bikes can be introduced in Phase 2 once the docking and operational infrastructure is proven, particularly if the system expands into hillier areas or if data shows trip distances that would benefit from pedal assist.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Fleet Sizing</h4>
${p(`Each station averages 10 docks, with high-traffic anchor stations scaled to 15 and quieter mid-network stations at 8. Total dock capacity of ~240 supports a fleet of roughly 215 bikes in service plus 25 spares for maintenance rotation.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Season and Duration</h4>
${p(`The pilot operates <strong>April through October</strong> (7 months) in its first year. This covers Edmonton's full cycling season and captures shoulder-season data (April and October ridership reveals how much demand exists outside peak summer). A minimum <strong>two-season commitment</strong> (two summers) is essential — one season is not enough data to make expansion decisions, and pulling the system after a single summer sends a signal that the city wasn't serious.`)}
${p(`Winter operation is out of scope for the proof-of-concept. If first-season data shows meaningful October ridership, a limited winter service (reduced fleet on cleared corridors) could be trialed in Year 2.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Operating Model</h4>
${p(`A 24-station system is best run through a <strong>city-managed service contract</strong> with a single operator responsible for rebalancing, maintenance, and customer service. The city provides contract oversight through one dedicated FTE (or half-time equivalent within an existing transportation planning role).`)}
${p(`Staffing: 3–4 operational FTEs (one mechanic, one to two rebalancing drivers, one part-time customer service/admin). One cargo van and one bike trailer for rebalancing. This is a focused operation — appropriate for a proof-of-concept, designed to scale into the full system.`)}
  `,
  children: [],
};

const designPrinciples: DocSection = {
  id: "pilot-design",
  title: "Network Design Principles",
  shortTitle: "Design Principles",
  content: `
${p(`This section defines what makes a good 24-station pilot network — not where the stations go (that's what BikeShareYEG is for), but the principles any proposed layout should satisfy. These apply regardless of which corridors are chosen.`)}

<h4 class="font-semibold text-base mt-6 mb-2">1. Contiguity Over Scattering</h4>
${p(`Every station must be reachable from every other station within a single comfortable ride (under 15 minutes / ~3 km). No orphan stations disconnected from the main network. This sounds obvious, but the political pressure to "give every neighbourhood a station" is the single biggest threat to a pilot's viability. A 24-station network that covers one or two corridors well is infinitely more useful than 24 stations scattered across the city.`)}

<h4 class="font-semibold text-base mt-6 mb-2">2. Anchor Both Ends</h4>
${p(`A linear network needs strong demand generators at both ends. If all the demand is at one end (e.g., a university campus) and the other end is low-traffic residential, bikes accumulate at the campus every morning and the system grinds to a halt. The corridor must connect two or more distinct activity centres — places where people both <em>arrive</em> and <em>depart</em> at different times of day.`)}

<h4 class="font-semibold text-base mt-6 mb-2">3. Transit Anchoring</h4>
${p(`At least four to five stations should be within a short walk (200m) of an LRT stop or major transit exchange. The strongest value proposition for urban bike-share is the last-mile transit connection. If the pilot can't demonstrate that link, it fails to make the case for the full system. BIXI Montreal reports over 40% of members use bike-share in combination with transit.`)}

<h4 class="font-semibold text-base mt-6 mb-2">4. Ride the Infrastructure</h4>
${p(`Edmonton has invested over $100 million in cycling infrastructure since 2022 — shared-use paths, protected lanes, neighbourhood bikeways. The pilot should leverage this investment, placing stations along or near protected routes. A station on a road with no cycling infrastructure forces riders onto hostile streets, which suppresses ridership and creates safety risk. The suitability model's "bike infrastructure proximity" factor captures this.`)}

<h4 class="font-semibold text-base mt-6 mb-2">5. Land Use Diversity</h4>
${p(`A healthy network serves different trip types: commuting (residential → commercial/institutional), errands (residential → retail), recreation (anywhere → river valley trail), and socializing (anywhere → dining/entertainment). The station mix should include residential origins, commercial destinations, and at least one recreational access point. Monoculture networks — all office buildings, or all residential — generate one-directional flow and high rebalancing costs.`)}

<h4 class="font-semibold text-base mt-6 mb-2">6. Design for Iteration</h4>
${p(`Solar-powered, bolt-down stations can be relocated at a fraction of the original installation cost. The pilot should assume that 3–5 stations will underperform and need to be moved after the first season. This is not failure — it's the plan. Station sites should be chosen with relocation in mind: accessible sidewalk or plaza locations, no permanent foundations, no utility conflicts. The operating contract should explicitly include a relocation budget for Year 2.`)}
  `,
  children: [],
};

const scorecard: DocSection = {
  id: "pilot-scorecard",
  title: "Network Quality Scorecard",
  shortTitle: "Quality Scorecard",
  content: `
${p(`Before a single station is installed, any proposed pilot layout should be evaluated against these quantitative criteria. BikeShareYEG can compute most of these automatically. The scorecard provides a common language for comparing alternative designs — whether generated by the optimization engine, drawn by hand, or proposed through public consultation.`)}

<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold w-[25%]">Metric</th>
      <th class="text-left py-2 pr-4 font-semibold w-[32%]">What It Measures</th>
      <th class="text-center py-2 pr-4 font-semibold w-[13%]">Target</th>
      <th class="text-left py-2 font-semibold">How to Compute</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Station density</td>
      <td class="py-2.5 pr-4">Stations per km² within the convex hull of the network</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">≥ 8</td>
      <td class="py-2.5">Count of stations ÷ convex hull area in km². Below 5 means critical gaps; 8+ approaches the threshold where network effects kick in.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Walk access coverage</td>
      <td class="py-2.5 pr-4">% of residents in the service area within 300m walking distance of a station</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">≥ 70%</td>
      <td class="py-2.5">Population in 300m isochrone around each station ÷ total population in service area. Below 70% means too many residents are outside comfortable walk range.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Average inter-station distance</td>
      <td class="py-2.5 pr-4">Mean distance between each station and its nearest neighbour</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">300–500m</td>
      <td class="py-2.5">Average of nearest-neighbour distances. Below 300m suggests redundancy; above 500m creates gaps that suppress ridership.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Maximum gap</td>
      <td class="py-2.5 pr-4">Longest stretch between any two adjacent stations along the network corridor</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">≤ 600m</td>
      <td class="py-2.5">Identify the largest nearest-neighbour distance. A single 800m+ gap can break the network's usability for riders in between.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Transit integration</td>
      <td class="py-2.5 pr-4">Number of stations within 200m of an LRT stop or major transit exchange</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">≥ 5</td>
      <td class="py-2.5">Count of stations where the nearest LRT/exchange is ≤ 200m. The last-mile value proposition requires real transit connections, not theoretical ones.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Bike infrastructure proximity</td>
      <td class="py-2.5 pr-4">% of stations within 100m of a protected bike lane, shared-use path, or neighbourhood bikeway</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">≥ 60%</td>
      <td class="py-2.5">Stations near safe cycling routes get higher ridership and fewer safety incidents. Stations on arterials with no bike infrastructure are a liability.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Demand coverage score</td>
      <td class="py-2.5 pr-4">Total weighted population within 400m of all stations, using the suitability model</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">maximize</td>
      <td class="py-2.5">Computed by BikeShareYEG's MCLP solver. This is the composite score: population × commercial × transit × bike infra × education × recreation factors.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Land use balance</td>
      <td class="py-2.5 pr-4">Ratio of stations anchored in residential vs. commercial/institutional areas</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">40–60%</td>
      <td class="py-2.5">Classify each station's surrounding 200m by dominant land use. A 90/10 split means one-directional commute flow and heavy rebalancing.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Anchor strength</td>
      <td class="py-2.5 pr-4">Suitability score of the two highest-scoring stations (the "anchors")</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">top 10%</td>
      <td class="py-2.5">The network's anchor stations should be in the top decile of suitability across the city. Weak anchors mean the pilot is not placed where demand is strongest.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-medium text-gray-700">Network contiguity</td>
      <td class="py-2.5 pr-4">Can all stations be reached from all others in ≤ 2 rides (≤ 6 km total)?</td>
      <td class="text-center py-2.5 pr-4 text-blue-700 font-semibold">yes</td>
      <td class="py-2.5">Every station pair must be bikeable through intermediate stations. If the network has a gap that forces riders onto a long, uncomfortable stretch, the two halves function as separate micro-networks.</td>
    </tr>
  </tbody>
</table>
</div>
${p(`A proposed layout does not need to ace every metric — tradeoffs are inevitable. But a layout that fails on more than two criteria should be redesigned. The scorecard's value is in making those tradeoffs explicit and comparable across alternative designs.`)}
  `,
  children: [],
};

const successMetrics: DocSection = {
  id: "pilot-success",
  title: "Season One Success Metrics",
  shortTitle: "Success Metrics",
  content: `
${p(`Pre-deployment evaluation (the scorecard above) tells us whether the network <em>design</em> is sound. Post-launch metrics tell us whether the system is <em>working</em>. The following KPIs should be tracked from day one and reported monthly, with a formal evaluation at season's end.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Primary KPIs</h4>
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Metric</th>
      <th class="text-center py-2 pr-4 font-semibold w-[80px]">Strong</th>
      <th class="text-center py-2 pr-4 font-semibold w-[80px]">Adequate</th>
      <th class="text-center py-2 pr-4 font-semibold w-[80px]">Concern</th>
      <th class="text-left py-2 font-semibold">Notes</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr>
      <td class="py-2 pr-4 font-medium text-gray-700">Trips per bike per day (peak month avg)</td>
      <td class="text-center py-2 pr-4 text-green-700 font-semibold">≥ 2.0</td>
      <td class="text-center py-2 pr-4 text-amber-600 font-semibold">1.0–2.0</td>
      <td class="text-center py-2 pr-4 text-red-600 font-semibold">< 1.0</td>
      <td class="py-2">The most important single number. Comparable small systems average 0.7–1.1 in their first year; above 2.0 signals strong demand.</td>
    </tr>
    <tr>
      <td class="py-2 pr-4 font-medium text-gray-700">Total season trips</td>
      <td class="text-center py-2 pr-4 text-green-700 font-semibold">≥ 50,000</td>
      <td class="text-center py-2 pr-4 text-amber-600 font-semibold">30,000–50,000</td>
      <td class="text-center py-2 pr-4 text-red-600 font-semibold">< 30,000</td>
      <td class="py-2">Over 7 months with 240 bikes. Scaling Hamilton's first-year performance (1.1 trips/bike/day) gives ~55,000. First-year systems typically underperform established ones, so 30,000+ is a solid start.</td>
    </tr>
    <tr>
      <td class="py-2 pr-4 font-medium text-gray-700">Unique registered users</td>
      <td class="text-center py-2 pr-4 text-green-700 font-semibold">≥ 3,500</td>
      <td class="text-center py-2 pr-4 text-amber-600 font-semibold">2,000–3,500</td>
      <td class="text-center py-2 pr-4 text-red-600 font-semibold">< 2,000</td>
      <td class="py-2">Breadth of adoption. Each unique user is a potential advocate for expansion.</td>
    </tr>
    <tr>
      <td class="py-2 pr-4 font-medium text-gray-700">Annual membership sign-ups</td>
      <td class="text-center py-2 pr-4 text-green-700 font-semibold">≥ 500</td>
      <td class="text-center py-2 pr-4 text-amber-600 font-semibold">250–500</td>
      <td class="text-center py-2 pr-4 text-red-600 font-semibold">< 250</td>
      <td class="py-2">Habitual use. Members ride 3–5x more than casual users and represent committed demand.</td>
    </tr>
    <tr>
      <td class="py-2 pr-4 font-medium text-gray-700">Station utilization spread</td>
      <td class="text-center py-2 pr-4 text-green-700 font-semibold">all ≥ 3%</td>
      <td class="text-center py-2 pr-4 text-amber-600 font-semibold">20 of 24 ≥ 3%</td>
      <td class="text-center py-2 pr-4 text-red-600 font-semibold">< 16 of 24</td>
      <td class="py-2">Each station's share of total trips. If 4 stations handle 80% of trips, the rest are misplaced.</td>
    </tr>
    <tr>
      <td class="py-2 pr-4 font-medium text-gray-700">Station uptime</td>
      <td class="text-center py-2 pr-4 text-green-700 font-semibold">≥ 98%</td>
      <td class="text-center py-2 pr-4 text-amber-600 font-semibold">95–98%</td>
      <td class="text-center py-2 pr-4 text-red-600 font-semibold">< 95%</td>
      <td class="py-2">Hours with at least one bike and one empty dock ÷ total operating hours. Reliability builds trust.</td>
    </tr>
  </tbody>
</table>
</div>

<h4 class="font-semibold text-base mt-6 mb-2">Secondary KPIs</h4>
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Metric</th>
      <th class="text-left py-2 pr-4 font-semibold">Target</th>
      <th class="text-left py-2 font-semibold">Why It Matters</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4 font-medium text-gray-700">Transit-connected trips</td><td class="py-2 pr-4">≥ 25% of trips start or end within 200m of LRT</td><td class="py-2">Validates the last-mile thesis. If transit-connected stations aren't generating trips, the integration story weakens.</td></tr>
    <tr><td class="py-2 pr-4 font-medium text-gray-700">Average trip duration</td><td class="py-2 pr-4">8–20 minutes</td><td class="py-2">Under 5 minutes suggests stations are too close (riders could walk). Over 25 minutes suggests stations are too far apart or users are joy-riding rather than commuting.</td></tr>
    <tr><td class="py-2 pr-4 font-medium text-gray-700">Weekday/weekend ratio</td><td class="py-2 pr-4">≥ 60% weekday</td><td class="py-2">A commuter-oriented pilot should see most trips on weekdays. If weekend trips dominate, the system is recreational, not transportation — still valuable, but a different funding argument.</td></tr>
    <tr><td class="py-2 pr-4 font-medium text-gray-700">Peak-hour concentration</td><td class="py-2 pr-4">≥ 30% in AM/PM peaks (7–9, 16–18)</td><td class="py-2">Commute peaks indicate the system is serving daily transportation needs.</td></tr>
    <tr><td class="py-2 pr-4 font-medium text-gray-700">Low-income pass enrollment</td><td class="py-2 pr-4">≥ 75 members</td><td class="py-2">Equity signal. The pilot must demonstrate that subsidized access is being used.</td></tr>
    <tr><td class="py-2 pr-4 font-medium text-gray-700">Empty/full station events per day</td><td class="py-2 pr-4">< 5% of station-hours</td><td class="py-2">A station with no bikes or no empty docks is a failed trip. Track how often this happens and at which stations.</td></tr>
    <tr><td class="py-2 pr-4 font-medium text-gray-700">Rebalancing trips per day</td><td class="py-2 pr-4">track (no fixed target)</td><td class="py-2">Operational cost driver. Feeds directly into scaling projections for the 50-station system.</td></tr>
    <tr><td class="py-2 pr-4 font-medium text-gray-700">User satisfaction (NPS)</td><td class="py-2 pr-4">≥ 30</td><td class="py-2">Net Promoter Score from mid-season survey. A score of 30+ is good for a new public service.</td></tr>
    <tr><td class="py-2 pr-4 font-medium text-gray-700">Safety incidents</td><td class="py-2 pr-4">< 1 per 10,000 trips</td><td class="py-2">Collisions, injuries, near-misses reported. Low incident rate is essential for political viability.</td></tr>
  </tbody>
</table>
</div>

<h4 class="font-semibold text-base mt-6 mb-2">The "Expand" Decision</h4>
${p(`At the end of Season One, the data should answer three questions:`)}
<div class="grid gap-2 my-4">
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-green-50/60 border border-green-100/80 text-sm">
    <span class="shrink-0 font-bold text-green-700 mt-0.5">Q1</span>
    <div><strong>Where is the demand?</strong> — Origin–destination data reveals which corridors and station clusters are generating the most trips, directly informing where to add the next 26 stations.</div>
  </div>
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-amber-50/60 border border-amber-100/80 text-sm">
    <span class="shrink-0 font-bold text-amber-700 mt-0.5">Q2</span>
    <div><strong>Which stations need to move?</strong> — If utilization is concentrated at a handful of stations, relocate the underperformers. Data from Season One tells you exactly where.</div>
  </div>
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/80 text-sm">
    <span class="shrink-0 font-bold text-blue-700 mt-0.5">Q3</span>
    <div><strong>Can operations scale?</strong> — Rebalancing frequency, maintenance costs, and customer service volume from 24 stations project directly to the per-station economics of 50. If per-station operating costs are significantly above $25,000/year, the operating model needs adjustment before scaling.</div>
  </div>
</div>
${p(`These questions frame the expansion conversation around <em>how</em> to grow, not <em>whether</em> to grow — which is where the pilot's momentum matters most.`)}
  `,
  children: [],
};

const pilotBudget: DocSection = {
  id: "pilot-budget",
  title: "Estimated Budget",
  shortTitle: "Budget",
  content: `
${p(`The all-pedal, solar-only design keeps station hardware simple and capital costs contained. Without e-bike charging infrastructure, stations need no grid connection — they're self-contained units that can be installed in days, not weeks.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Capital Costs</h4>
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Item</th>
      <th class="text-right py-2 pr-4 font-semibold">Unit Cost</th>
      <th class="text-right py-2 pr-4 font-semibold">Qty</th>
      <th class="text-right py-2 font-semibold">Total</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Dock stations (hardware, solar, kiosk, install — no charging)</td><td class="text-right py-2 pr-4">$42,000</td><td class="text-right py-2 pr-4">24</td><td class="text-right py-2">$1,008,000</td></tr>
    <tr><td class="py-2 pr-4">Pedal bikes</td><td class="text-right py-2 pr-4">$1,200</td><td class="text-right py-2 pr-4">215</td><td class="text-right py-2">$258,000</td></tr>
    <tr><td class="py-2 pr-4">Spare bikes (10% reserve)</td><td class="text-right py-2 pr-4">$1,200</td><td class="text-right py-2 pr-4">25</td><td class="text-right py-2">$30,000</td></tr>
    <tr><td class="py-2 pr-4">Software platform (licensing/setup)</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2">$130,000</td></tr>
    <tr><td class="py-2 pr-4">Cargo van + bike trailer (rebalancing)</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">1</td><td class="text-right py-2">$60,000</td></tr>
    <tr><td class="py-2 pr-4">Contingency (10%)</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2">$149,000</td></tr>
    <tr class="border-t-2 border-gray-300 font-semibold"><td class="py-2 pr-4">Estimated Total Capital</td><td class="text-right py-2 pr-4"></td><td class="text-right py-2 pr-4"></td><td class="text-right py-2">$1,635,000</td></tr>
  </tbody>
</table>
</div>
${p(`Per-station cost drops from the $55,000 mixed-fleet estimate to <strong>$42,000</strong> — eliminating the charging infrastructure and gaining better volume pricing at 24 units. The all-pedal fleet is roughly $400,000 cheaper than a mixed fleet at the same scale, and that saving buys the additional stations that double the network's coverage.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Annual Operating Costs</h4>
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Category</th>
      <th class="text-right py-2 font-semibold">Annual Est.</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Operations contract (3–4 FTEs: mechanic, rebalancing, admin)</td><td class="text-right py-2">$280,000</td></tr>
    <tr><td class="py-2 pr-4">City oversight (0.5–1 FTE, contract management + data)</td><td class="text-right py-2">$80,000</td></tr>
    <tr><td class="py-2 pr-4">Rebalancing & logistics</td><td class="text-right py-2">$55,000</td></tr>
    <tr><td class="py-2 pr-4">Parts, repairs, bike maintenance</td><td class="text-right py-2">$65,000</td></tr>
    <tr><td class="py-2 pr-4">Software licensing & payment processing</td><td class="text-right py-2">$70,000</td></tr>
    <tr><td class="py-2 pr-4">Insurance & liability</td><td class="text-right py-2">$45,000</td></tr>
    <tr><td class="py-2 pr-4">Marketing & launch campaign</td><td class="text-right py-2">$35,000</td></tr>
    <tr class="border-t-2 border-gray-300 font-semibold"><td class="py-2 pr-4">Estimated Annual Operating</td><td class="text-right py-2">$630,000</td></tr>
  </tbody>
</table>
</div>
${p(`Operating costs are modestly higher than a 12-station system (more stations to service, more bikes to maintain) but <strong>per-station operating cost is lower</strong> (~$26K vs ~$43K) because fixed costs like software, insurance, and oversight are spread across more stations. An all-pedal fleet also reduces per-bike maintenance — no battery swaps, no charger servicing, no mixed-fleet logistics.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Two-Year Total</h4>
<div class="grid grid-cols-3 gap-3 my-5">
  <div class="text-center p-4 rounded-xl bg-gray-50 border border-gray-200">
    <div class="text-2xl font-bold text-gray-800">$1.6M</div>
    <div class="text-xs text-gray-500 mt-1">Capital (Year 1)</div>
  </div>
  <div class="text-center p-4 rounded-xl bg-gray-50 border border-gray-200">
    <div class="text-2xl font-bold text-gray-800">$1.3M</div>
    <div class="text-xs text-gray-500 mt-1">Operations (2 yrs)</div>
  </div>
  <div class="text-center p-4 rounded-xl bg-blue-50 border border-blue-200">
    <div class="text-2xl font-bold text-blue-700">$2.9M</div>
    <div class="text-xs text-blue-600/80 mt-1">Total (2-year est.)</div>
  </div>
</div>
${p(`For context: a single intersection reconstruction in Edmonton typically runs $1–3 million. A single bus shelter with digital signage costs $50,000–$100,000. The proof-of-concept pilot — 24 stations, 240 bikes, a complete transportation service covering 3 km² — costs about the same as rebuilding one block of roadway.`)}
${p(`Conservative revenue estimate (annual memberships, day passes, casual rides) is $90,000–$150,000 per year — covering roughly 15–25% of operating costs. This is consistent with first-year systems of similar size. Revenue improves significantly at the 50-station scale, where network effects drive membership uptake.`)}
  `,
  children: [],
};

const pathToScale: DocSection = {
  id: "pilot-path",
  title: "From Proof-of-Concept to System",
  shortTitle: "Path to Scale",
  content: `
${p(`The proof-of-concept pilot is not an end in itself — it's the first phase of a system designed to grow:`)}

<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Phase</th>
      <th class="text-left py-2 pr-4 font-semibold">Scale</th>
      <th class="text-left py-2 pr-4 font-semibold">Timeline</th>
      <th class="text-left py-2 font-semibold">Purpose</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr class="bg-blue-50/40">
      <td class="py-2.5 pr-4 font-semibold text-blue-700">Proof of Concept</td>
      <td class="py-2.5 pr-4">24 stations · 240 bikes</td>
      <td class="py-2.5 pr-4">Seasons 1–2</td>
      <td class="py-2.5">Prove demand, collect trip data, build institutional knowledge and public support</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-semibold text-gray-700">Core Network</td>
      <td class="py-2.5 pr-4">50 stations · 500 bikes</td>
      <td class="py-2.5 pr-4">Seasons 3–4</td>
      <td class="py-2.5">Full network as described in the <a href="/docs/proposal#proposal-pilot" class="text-blue-600 hover:underline">main proposal</a> — connected citywide core, informed by 2 seasons of real data. E-bikes introduced at this stage.</td>
    </tr>
    <tr>
      <td class="py-2.5 pr-4 font-semibold text-gray-700">Expansion</td>
      <td class="py-2.5 pr-4">100–150 stations</td>
      <td class="py-2.5 pr-4">Seasons 5+</td>
      <td class="py-2.5">Full LRT corridor coverage, inner suburban equity stations, governance transition to arms-length corporation</td>
    </tr>
  </tbody>
</table>
</div>
${p(`The proof-of-concept equipment is not wasted — every station and bike purchased in Phase 1 carries directly into Phase 2. The 24 pilot stations become the first 24 of the 50-station core network (possibly relocated based on Season 1–2 data). Software licensing, operational relationships, and institutional knowledge all transfer. E-bikes and charging-capable stations are introduced in Phase 2, when the basic system is proven and operational patterns are understood.`)}

<h4 class="font-semibold text-base mt-6 mb-2">What the Pilot Unlocks</h4>
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Federal grant applications with data.</strong> An application to Infrastructure Canada's Active Transportation Fund backed by Edmonton-specific ridership data, origin–destination matrices, and demographic analysis is dramatically stronger than one backed by projections from other cities.</li>
  <li><strong>Corporate sponsorship with proof.</strong> Approaching a title sponsor (e.g., "ATB Bike Share Edmonton") with 40,000 trips and 3,000 users is a different conversation than approaching them with a feasibility study.</li>
  <li><strong>Calibrated optimization.</strong> BikeShareYEG's suitability model can be recalibrated with real trip data — replacing census-proxy weights with observed ridership correlations. The 50-station network designed after two seasons of data will be significantly better than one designed today.</li>
  <li><strong>Public mandate.</strong> When expansion comes before council, it's not "should we try bike-share?" — it's "our existing system is popular and the data shows exactly where new stations are needed." That is a fundamentally easier political conversation.</li>
</ul>

<h4 class="font-semibold text-base mt-6 mb-2">The Alternative</h4>
${p(`The alternative to phased rollout is what the <a href="/docs/proposal" class="text-blue-600 hover:underline">full proposal</a> describes: go directly to 50 stations. That approach is viable — it's how Montreal and Toronto launched. If the political and budgetary appetite exists, skip the proof-of-concept and proceed to the core network. If the goal is to build momentum and get bikes on the street as quickly as possible, the proof-of-concept is the fastest path.`)}
  `,
  children: [],
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const PILOT_SECTIONS: DocSection[] = [
  whySmaller,
  lessons,
  parameters,
  designPrinciples,
  scorecard,
  successMetrics,
  pilotBudget,
  pathToScale,
];
