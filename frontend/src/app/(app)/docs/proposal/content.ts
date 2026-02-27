/**
 * Proposal content — structured data for the bike-share proposal.
 *
 * This is a standalone document aimed at city councillors and decision-makers,
 * separate from the BikeShareYEG technical documentation.
 *
 * Third draft — proven vendor hardware, real budget benchmarks, honest risk.
 */

import type { DocSection } from "../content";

const p = (text: string) => `<p>${text}</p>`;

// ---------------------------------------------------------------------------
// Proposal sections
// ---------------------------------------------------------------------------

const intro: DocSection = {
  id: "proposal-intro",
  title: "Overview",
  shortTitle: "Overview",
  content: `
${p(`Edmonton is spending billions on LRT expansion. A single Valley Line station costs $50–80 million. But ridership depends on what happens at both ends of the trip — if a rider can't get from the station to their actual destination quickly and cheaply, they drive instead, and the train runs under capacity. This is the <strong>last-mile problem</strong>, and it is the single biggest barrier to transit ROI in sprawling cities.`)}
${p(`For less than the cost of one LRT station, a city can deploy a 50-station bike-share network that feeds riders into the <em>entire</em> rail system. Edmonton has also invested over $100 million in protected bike lanes and shared-use paths since 2022 — but lanes without vehicles are underused infrastructure. A public bike-share system connects the pieces: last-mile LRT trips, short rides that replace downtown car traffic, and affordable transportation for residents who can't or don't want to drive.`)}
${p(`This proposal outlines what that system would look like: governance, hardware, station placement, digital platform, costs, and a phased plan for growth. Three principles guide every decision:`)}
<div class="grid gap-3 my-4">
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5">🎯</span>
    <div><strong>Cost-effective mobility.</strong> Get Edmontonians where they need to go, affordably and reliably. Every design choice — station count, bike type, software platform — is evaluated against that goal. Features that do not directly improve the rider experience or reduce operating costs are out of scope.</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5">🏛️</span>
    <div><strong>Public ownership, full data access.</strong> The City of Edmonton owns every station, every bike, and every byte of data the system generates. Trip records, station telemetry, GPS traces, maintenance logs — all of it belongs to the city, published as open data, and available for planning, research, and optimization. Vendors supply equipment and services; the city owns the system.</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5">🔧</span>
    <div><strong>Operated locally.</strong> Maintenance, rebalancing, customer service, and system management are local jobs staffed in Edmonton. Capital equipment may come from a national or international supplier, but the ongoing work of running the system stays in the city.</div>
  </div>
</div>
  `,
  children: [],
};

const theCase: DocSection = {
  id: "proposal-case",
  title: "The Case for Bike-Share in Edmonton",
  shortTitle: "The Case",
  content: `
${p(`Bike-share programs in comparable cities have demonstrated consistent, measurable benefits. Here's why they matter specifically for Edmonton:`)}
<div class="grid gap-2.5 my-4">
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">🚇</span><div><strong>Transit connectivity.</strong> Edmonton's LRT network is growing, but station catchment areas remain small — most riders won't walk more than 800m to reach a platform. BIXI Montreal reports over 40% of members use bike-share in combination with public transit. Bike-share extends the effective reach of every LRT station from a 10-minute walk to a 10-minute ride, covering roughly 4x the area.</div></div>
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">🚗</span><div><strong>Reduced car trips.</strong> Edmonton's downtown, Whyte Avenue, and university corridors see thousands of short car trips daily — trips under 5 km that could move by bike in the same time once parking is factored in. Bike Share Toronto's data shows a significant share of bike-share trips replace exactly these kinds of short drives.</div></div>
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">🏪</span><div><strong>Economic activity.</strong> Studies consistently show that cycling infrastructure and bike-share stations increase foot traffic and spending at local businesses. A station on Whyte Avenue or 124 Street isn't a loss of parking — it's a stream of customers arriving ready to walk and shop.</div></div>
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">⚖️</span><div><strong>Equity.</strong> A well-designed bike-share system with low-income pricing (as BIXI and Bike Share Toronto offer) provides affordable, reliable mobility to residents who can't afford a car or don't live on a frequent transit route. This matters most in Edmonton's transit-underserved inner suburbs.</div></div>
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">❤️</span><div><strong>Public health.</strong> Active transportation reduces cardiovascular disease, diabetes, and obesity. Even moderate cycling — a few short bike-share trips per week — produces measurable health outcomes at the population level.</div></div>
</div>
${p(`Edmonton already has the foundational ingredients: 226 km of cycling paths, a growing LRT network, a downtown core undergoing densification, and a population of over one million. What's missing is the shared vehicle layer that turns infrastructure into a mobility service.`)}
  `,
  children: [],
};

const existingMicromobility: DocSection = {
  id: "proposal-micromobility",
  title: "Existing Micromobility in Edmonton",
  shortTitle: "Existing Micromobility",
  content: `
${p(`Edmonton already has private micromobility — Lime has operated e-scooters in the city since 2019, logging nearly 400,000 trips in 2022 alone. The obvious question is: <strong>why build a public bike-share system if scooters are already here?</strong>`)}
${p(`The short answer is that they solve different problems. Lime is a convenience service for spontaneous short trips. Bike-share is transportation infrastructure for daily commuting, transit connections, and equitable mobility. The comparison below explains why one does not replace the other.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Side-by-Side Comparison</h4>
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold w-[30%]"></th>
      <th class="text-left py-2 pr-4 font-semibold">Lime E-Scooters (Edmonton)</th>
      <th class="text-left py-2 font-semibold">Public Dock-Based Bike-Share</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Reliability</td><td class="py-2.5 pr-4 bg-red-50/60">Dockless — vehicles are wherever the last rider left them. No guarantee of availability at any location.</td><td class="py-2.5 bg-green-50/60">Fixed stations at known locations. A commuter can count on a bike at their LRT station at 8am.</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Transit integration</td><td class="py-2.5 pr-4 bg-red-50/60">None. Separate app, separate payment, no fare integration with ETS.</td><td class="py-2.5 bg-green-50/60">Can be bundled with ETS fare products (e.g., transit pass includes bike-share). Stations sited at LRT stops by design.</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Coverage</td><td class="py-2.5 pr-4 bg-red-50/60">Deployed where profitable — entertainment areas, weekend corridors. No obligation to serve low-demand areas.</td><td class="py-2.5 bg-green-50/60">Placed where needed — LRT connections, equity neighbourhoods, commuter routes. Coverage follows public mandate.</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Data ownership</td><td class="py-2.5 pr-4 bg-red-50/60">Lime owns all trip data. City receives summary reports at Lime's discretion.</td><td class="py-2.5 bg-green-50/60">City owns every trip record. Open data published for civic analysis and research.</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Permanence</td><td class="py-2.5 pr-4 bg-red-50/60">Lime can exit Edmonton at any time. They have withdrawn from dozens of cities globally.</td><td class="py-2.5 bg-green-50/60">Publicly owned infrastructure. The city controls whether the system operates, expands, or contracts.</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Accessibility</td><td class="py-2.5 pr-4 bg-red-50/60">Dockless scooters frequently block sidewalks — hazards for wheelchair users and the visually impaired.</td><td class="py-2.5 bg-green-50/60">Designated, accessible docking stations. No sidewalk obstruction.</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Cargo</td><td class="py-2.5 pr-4 bg-red-50/60">No storage. Riders carry belongings in one hand or a backpack.</td><td class="py-2.5 bg-green-50/60">Front basket standard on fleet bikes. Practical for groceries, laptop bags, daily errands.</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Season</td><td class="py-2.5 pr-4 bg-amber-50/60">Mid-May to late October (~5 months). Removed for winter.</td><td class="py-2.5 bg-green-50/60">April–October minimum. Year-round with a reduced fleet is possible, as BIXI and Bike Share Toronto have demonstrated.</td></tr>
  </tbody>
</table>
</div>

<h4 class="font-semibold text-base mt-6 mb-2">Cost to the Rider</h4>
${p(`The fare difference is significant, especially for regular users. Lime does offer a LimePrime subscription (~$6/month for $2.85 flat-rate rides up to 20 minutes) — but even with that, a daily commuter pays substantially more than a bike-share member:`)}
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Scenario</th>
      <th class="text-right py-2 pr-4 font-semibold">Lime E-Scooter</th>
      <th class="text-right py-2 pr-4 font-semibold">Lime w/ LimePrime</th>
      <th class="text-right py-2 font-semibold">Dock-Based Bike-Share</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Casual 15-min ride</td><td class="text-right py-2 pr-4">$4.75–$5.50</td><td class="text-right py-2 pr-4">$2.85</td><td class="text-right py-2 text-green-700 font-medium">$2.80</td></tr>
    <tr><td class="py-2 pr-4">Daily commute (2 × 15-min rides)</td><td class="text-right py-2 pr-4">$9.50–$11.00</td><td class="text-right py-2 pr-4">$5.70</td><td class="text-right py-2 text-green-700 font-medium">$0 with annual pass</td></tr>
    <tr class="bg-amber-50/60"><td class="py-2 pr-4 font-medium">Monthly cost (weekday commuter)</td><td class="text-right py-2 pr-4 font-semibold">$190–$220</td><td class="text-right py-2 pr-4 font-semibold">$120+</td><td class="text-right py-2 text-green-700 font-semibold">~$10 (annual pass)</td></tr>
    <tr><td class="py-2 pr-4">Annual membership</td><td class="text-right py-2 pr-4 text-gray-400">Not available</td><td class="text-right py-2 pr-4 text-gray-400">$72/yr (rides extra)</td><td class="text-right py-2 text-green-700 font-medium">$105–$120</td></tr>
    <tr><td class="py-2 pr-4">Low-income option</td><td class="text-right py-2 pr-4 text-gray-400">None</td><td class="text-right py-2 pr-4 text-gray-400">None</td><td class="text-right py-2 text-green-700 font-medium">$5/year</td></tr>
  </tbody>
</table>
</div>
${p(`Even on LimePrime, a weekday commuter spends over <strong>$120/month</strong> versus <strong>~$10/month</strong> on a bike-share annual pass. For lower-income Edmontonians, Lime offers no discounted access at all.`)}

<h4 class="font-semibold text-base mt-6 mb-2">They Coexist</h4>
${p(`This is not an argument against Lime or private micromobility. Scooters serve a real purpose — spontaneous short trips, recreation, tourism. But they are not a substitute for a reliable, publicly-accountable transit service with fixed stations at LRT stops and commuter corridors. Edmonton doesn't cancel bus routes because Uber exists. The same logic applies here.`)}
  `,
  children: [],
};

const governance: DocSection = {
  id: "proposal-governance",
  title: "Governance",
  shortTitle: "Governance",
  content: `
${p(`How a bike-share system is governed determines how fast it can adapt, who is accountable, and — critically — who owns the data.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Recommended: Phased Governance</h4>
${p(`Standing up a full arms-length corporation before a single bike is on the street is significant overhead for a system that hasn't yet proven demand. We recommend a <strong>phased approach</strong>:`)}

<div class="grid gap-3 my-4">
  <div class="flex gap-3 items-start p-3 rounded-lg bg-blue-50/60 border border-blue-100">
    <span class="text-lg leading-none mt-0.5 font-bold text-blue-700">1</span>
    <div><strong>Pilot phase (Year 1–2): City-managed operating contract.</strong> The City of Edmonton issues a competitive RFP, selects an equipment supplier and operating partner, and manages the contract directly with a small internal team (2–3 FTEs). The city purchases and owns all physical assets outright. The contract includes ironclad data ownership clauses (see below).</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-blue-50/60 border border-blue-100">
    <span class="text-lg leading-none mt-0.5 font-bold text-blue-700">2</span>
    <div><strong>Expansion phase (Year 3+): Arms-length public non-profit.</strong> Once the pilot proves demand, the city stands up a dedicated corporation — modelled on post-2014 BIXI Montreal — to operate the expanded system. By this point the city has two years of operational data, an experienced internal team, and the leverage to negotiate from strength. The corporation inherits the assets, the data, and the staff.</div>
  </div>
</div>

<h4 class="font-semibold text-base mt-6 mb-2">Data Ownership: The Non-Negotiable</h4>
${p(`The single most important clause in any equipment or operating contract is <strong>full, unconditional data access</strong>. This means:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>All trip data</strong> — origin, destination, timestamps, route GPS traces, membership type — belongs to the city, not the vendor.</li>
  <li><strong>All operational telemetry</strong> — station diagnostics, dock lock events, battery health, sensor data, rebalancing logs — belongs to the city.</li>
  <li><strong>Real-time API access</strong> — not monthly summary reports at the vendor's discretion, but live programmatic access to the full dataset.</li>
  <li><strong>GBFS compliance</strong> — the system must publish a General Bikeshare Feed Specification feed so Google Maps, Transit App, and any third-party tool can show real-time station availability.</li>
  <li><strong>Open data publication</strong> — anonymized, aggregated trip data published publicly for civic analysis and academic research, following BIXI Montreal's example.</li>
  <li><strong>Full data export and portability</strong> — at contract termination, every byte of data is returned to the city in standard, documented formats. No proprietary data hostage situations.</li>
</ul>
${p(`This is how the city retains the ability to optimize station placement, plan expansion, and evaluate system performance — regardless of who supplies the hardware or operates the fleet. Tools like BikeShareYEG can ingest this data to recommend station moves and capacity changes based on observed behaviour rather than modelled proxies.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Why Not ETS?</h4>
${p(`Edmonton Transit Service is a branch of the City — not an independent entity. Every station move, pricing change, and fleet decision would go through the same bureaucratic process as a bus route change. Bike-share in its first year needs to iterate weekly. That pace is incompatible with a city department's approval chain. ETS should be a <strong>partner</strong> (integrated fare products, shared data, coordinated station siting) — but not the operator.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Edmonton Has Done This Before</h4>
${p(`EPCOR — the city-owned utility corporation — demonstrates that Edmonton can stand up an independent, publicly-owned entity that operates competently at scale. EPCOR's model (city-owned, operationally independent, own board and staff) is the right template for the expansion phase.`)}
  `,
  children: [],
};

const pilot: DocSection = {
  id: "proposal-pilot",
  title: "Pilot Scope: 50 Stations, 500 Bikes",
  shortTitle: "Pilot Scope",
  content: `
<div class="grid grid-cols-3 gap-4 my-6">
  <div class="text-center p-5 rounded-xl bg-blue-50 border border-blue-100">
    <div class="text-3xl font-bold text-blue-700">50</div>
    <div class="text-sm text-blue-600/80 mt-1">Dock Stations</div>
  </div>
  <div class="text-center p-5 rounded-xl bg-blue-50 border border-blue-100">
    <div class="text-3xl font-bold text-blue-700">500</div>
    <div class="text-sm text-blue-600/80 mt-1">Bikes</div>
  </div>
  <div class="text-center p-5 rounded-xl bg-blue-50 border border-blue-100">
    <div class="text-3xl font-bold text-blue-700">~15</div>
    <div class="text-sm text-blue-600/80 mt-1">Docks / Station (avg)</div>
  </div>
</div>
${p(`We recommend launching with a focused pilot covering Edmonton's highest-demand corridors. Fifty stations and 500 bikes is large enough to form a usable, connected network — not just scattered stations — but small enough to be fiscally responsible as a first investment.`)}
${p(`Stations would average 15 docks each, with high-traffic locations (LRT hubs, university) sized up to 20–25 and quieter residential stations scaled down to 10–12. Dock count per station affects rebalancing costs and user experience — BikeShareYEG's optimization engine can model the tradeoffs.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Coverage Area</h4>
${p(`The pilot network should concentrate on the core where demand is most certain:`)}
<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 my-4">
  <div class="flex gap-2.5 items-start p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-sm">
    <span class="text-base leading-none mt-0.5">🏙️</span>
    <div><strong>Downtown / ICE District</strong><br/><span class="text-gray-500">Office workers, event-goers, hotel guests</span></div>
  </div>
  <div class="flex gap-2.5 items-start p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-sm">
    <span class="text-base leading-none mt-0.5">🎓</span>
    <div><strong>U of A / Garneau</strong><br/><span class="text-gray-500">Students, staff, campus visitors</span></div>
  </div>
  <div class="flex gap-2.5 items-start p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-sm">
    <span class="text-base leading-none mt-0.5">🛍️</span>
    <div><strong>Whyte Ave / Old Strathcona</strong><br/><span class="text-gray-500">Retail, dining, entertainment</span></div>
  </div>
  <div class="flex gap-2.5 items-start p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-sm">
    <span class="text-base leading-none mt-0.5">🚇</span>
    <div><strong>LRT Stations</strong><br/><span class="text-gray-500">Capital Line + Valley Line last-mile</span></div>
  </div>
  <div class="flex gap-2.5 items-start p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-sm">
    <span class="text-base leading-none mt-0.5">🌿</span>
    <div><strong>River Valley</strong><br/><span class="text-gray-500">Recreational trail access points</span></div>
  </div>
  <div class="flex gap-2.5 items-start p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-sm">
    <span class="text-base leading-none mt-0.5">🏘️</span>
    <div><strong>124 Street / Oliver</strong><br/><span class="text-gray-500">Dense residential + commercial corridor</span></div>
  </div>
</div>
${p(`This coverage area is roughly 15 km² — comparable to BIXI Montreal's original 2009 launch footprint and Bike Share Toronto's initial 2011 deployment.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Why 50 Stations?</h4>
${p(`Network density matters more than network size. Research on bike-share systems consistently finds that <strong>riders need a station within 300–500 metres of both their origin and destination</strong> to choose bike-share over alternatives. Fifty stations, concentrated in a contiguous area, can achieve that density. Twenty stations scattered across the whole city cannot.`)}
  `,
  children: [],
};

const placement: DocSection = {
  id: "proposal-placement",
  title: "Station Placement Strategy",
  shortTitle: "Station Placement",
  content: `
${p(`BikeShareYEG provides the analytical foundation for station placement. The approach combines a suitability model (where <em>should</em> stations go, based on demand factors?) with a network optimizer (which specific locations maximize coverage within a budget?).`)}

<h4 class="font-semibold text-base mt-6 mb-2">The Suitability Model</h4>
${p(`Every 174-metre hex cell in Edmonton is scored on seven factors derived from open data: population density (Census), commercial activity (OSM), educational institutions, recreation facilities, LRT proximity, cycling infrastructure, and transit access (GTFS). The weighted composite score produces a demand heatmap — a data-informed picture of where ridership is most likely.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Optimization</h4>
${p(`The Maximal Covering Location Problem (MCLP) solver selects station locations that maximize total weighted population coverage, subject to a station count budget and minimum spacing constraints. This is the same class of algorithm used by transit agencies to plan bus stop locations and by health systems to site clinics.`)}

<h4 class="font-semibold text-base mt-6 mb-2">What the Model Can't Do</h4>
${p(`No model can perfectly predict how people will use a system that doesn't exist yet. Edmonton has no historical bike-share data. Factors like street safety perception, employer commute subsidies, event schedules, and cultural habits all matter but are not captured in census or OSM data. The model produces a <strong>best guess</strong> — dramatically better than placing stations by intuition or politics alone, but still a guess.`)}
${p(`This is why the pilot must be designed with iteration in mind. Modular, relocatable stations. Comprehensive data collection. And a commitment to adjusting placements based on observed usage (see <a href="#proposal-iterate" class="text-blue-600 hover:underline">Iterative Improvement</a>).`)}
  `,
  children: [],
};

const hardware: DocSection = {
  id: "proposal-hardware",
  title: "Bikes, Docks & Hardware",
  shortTitle: "Hardware",
  content: `
${p(`Dock-based bike-share is a mature product category. Multiple suppliers manufacture proven, weather-hardened stations and fleet bikes that operate reliably in Canadian winters — including in Montreal, Toronto, and Vancouver. Rather than engineering custom hardware from scratch, this proposal recommends <strong>purchasing proven equipment from an established supplier through a competitive procurement process</strong>.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Equipment Suppliers</h4>
${p(`The city would issue a competitive RFP for stations, bikes, and docking hardware. Potential suppliers include but are not limited to:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Lyft Urban Solutions (formerly PBSC)</strong> — the largest bike-share equipment supplier globally. Manufactures the hardware used by BIXI Montreal, Bike Share Toronto, and dozens of other systems. Bikes are made by Cycles Devinci in Saguenay, QC. Stations are solar-powered, modular, and bolt-down.</li>
  <li><strong>Bewegen Technologies</strong> (QC) — Canadian manufacturer of e-bike-share systems, used in several North American cities.</li>
  <li><strong>Smoove</strong> (France) — used in cities across Europe and Australia, with a modular dock design.</li>
</ul>
${p(`The specific supplier is not predetermined — the RFP process ensures competitive pricing and allows the city to evaluate proposals against its data ownership and open standards requirements. What matters is that the contract terms, not the brand name, protect the city's interests.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Why Not Build Custom?</h4>
${p(`Edmonton has excellent metal fabrication shops that could build dock frames, and Canadian companies like Biktrix (Saskatoon) and Devinci (Saguenay) manufacture bikes domestically. However, a fleet-grade bike-share dock is not just steel — it's an integrated electromechanical system (solenoid locks, sensors, solar charge controllers, wireless communication) that must work reliably thousands of times in −30°C to +35°C conditions. No Edmonton shop has built one before.`)}
${p(`Custom engineering adds cost, timeline, and risk. Proven vendor hardware eliminates the prototyping phase entirely and delivers a system that works on day one. The tradeoff is some degree of vendor dependency on the hardware layer — but the contract's data ownership and open standards clauses ensure the city retains control of everything that matters for long-term planning and operations.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Fleet Composition</h4>
${p(`We recommend a <strong>mixed fleet of regular pedal bikes and pedal-assist e-bikes</strong> in a roughly 70/30 split (350 regular + 150 e-bikes). E-bikes expand the usable range of a bike-share trip — especially given Edmonton's river valley topography — and every Canadian system that has introduced e-bikes has seen ridership increases. All bikes include front baskets, internal hub gears, puncture-resistant tires, and integrated GPS tracking.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Station Design</h4>
${p(`Modern bike-share stations are solar-powered, wireless, and bolt-down — no buried conduit or permanent foundations. A station can typically be installed in a day and <strong>relocated for a fraction of the new-installation cost</strong>. This modularity is essential for the iterative approach described later in this proposal.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Winter Considerations</h4>
${p(`The pilot would launch in spring and operate through at least the full cycling season (April–October). Whether to extend into winter months is a decision that can be made based on first-season ridership data. BIXI Montreal began operating year-round in 2023; Bike Share Toronto now runs 12 months. If demand supports it, winter service with a smaller fleet on well-maintained corridors is a proven option — but not a requirement for a successful launch.`)}
  `,
  children: [],
};

const digital: DocSection = {
  id: "proposal-digital",
  title: "Digital Infrastructure & App",
  shortTitle: "Digital Platform",
  content: `
${p(`The digital layer — the user app, payment system, operations dashboard, and data feeds — is what makes the system usable, manageable, and transparent.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Open Standards</h4>
${p(`Two open standards are non-negotiable in any supplier contract:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>GBFS (General Bikeshare Feed Specification)</strong> — the industry standard that allows Google Maps, Apple Maps, Transit App, and any third-party tool to show real-time station availability.</li>
  <li><strong>Open trip data</strong> — anonymized, aggregated trip data published as open data. This enables civic analysis, academic research, and tools like BikeShareYEG to optimize the network using real usage patterns.</li>
</ul>

<h4 class="font-semibold text-base mt-6 mb-2">Software Platform</h4>
${p(`Most equipment suppliers offer an integrated software platform — user app, fleet management, payment processing, and rebalancing dispatch — bundled with the hardware. This is the simplest path to launch and is how most Canadian systems operate. The key contractual requirement is that the city has <strong>full, real-time API access to all data</strong> generated by the platform, and full data export rights at contract termination.`)}
${p(`If the city prefers to separate software from hardware (for greater flexibility or to reduce vendor dependency), independent platforms like <strong>Movatic</strong> (supports 300+ operators globally, integrates with multiple locking systems) or open-source options like <strong>OpenSourceBikeShare</strong> are available. This decision can be evaluated during the RFP process.`)}

<h4 class="font-semibold text-base mt-6 mb-2">User-Facing App</h4>
${p(`Riders need a mobile app (iOS + Android) to find nearby stations with real-time availability, unlock bikes (QR code or NFC), purchase memberships, view trip history, and report issues. A kiosk at each station handles walk-up users and tourists.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Payment Processing</h4>
${p(`The system must support credit/debit (contactless + chip), Apple Pay / Google Pay, and a low-income pass option with cash or voucher enrollment.`)}

<h4 class="font-semibold text-base mt-6 mb-2">BikeShareYEG's Role</h4>
${p(`This tool is not the operational app — it's the <strong>planning and public engagement layer</strong>. BikeShareYEG helps citizens and planners design network layouts, compare scenarios, and evaluate tradeoffs <em>before</em> procurement begins. Once the system is live, the same tool can ingest real trip data to inform expansion and station relocation decisions.`)}
  `,
  children: [],
};

const budget: DocSection = {
  id: "proposal-budget",
  title: "Estimated Budget",
  shortTitle: "Budget",
  content: `
${p(`The following estimates are based on publicly reported equipment purchase costs from <strong>Bike Share Toronto</strong> (Toronto Parking Authority board reports, 2020–2025) and comparable North American deployments. These are planning-level estimates — actual costs will depend on the supplier selected through the RFP process, order volume, and market conditions at time of procurement.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Toronto Benchmarks</h4>
${p(`Bike Share Toronto's public board reports provide the most transparent cost data available for a comparable Canadian system:`)}
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Item</th>
      <th class="text-right py-2 font-semibold">Published Cost</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Regular bike (2020 TPA report)</td><td class="text-right py-2">$1,090 / unit</td></tr>
    <tr><td class="py-2 pr-4">E-bike — E-FIT model (2020 TPA report)</td><td class="text-right py-2">$2,595 / unit</td></tr>
    <tr><td class="py-2 pr-4">Station, all-in (derived from 2024–2025 orders)</td><td class="text-right py-2">~$43,000–$53,000 / station</td></tr>
  </tbody>
</table>
</div>
${p(`Station costs include the dock hardware, solar power, electronics, kiosk, and installation — bundled in the published order totals. Per-station prices have trended downward as Toronto's order volumes have increased. For a first-time 50-station order, we estimate conservatively at the higher end of this range.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Estimated Capital Costs (Year One)</h4>
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
    <tr><td class="py-2 pr-4">Dock stations (all-in: hardware, solar, kiosk, install)</td><td class="text-right py-2 pr-4">$50,000</td><td class="text-right py-2 pr-4">50</td><td class="text-right py-2">$2,500,000</td></tr>
    <tr><td class="py-2 pr-4">Regular bikes</td><td class="text-right py-2 pr-4">$1,200</td><td class="text-right py-2 pr-4">350</td><td class="text-right py-2">$420,000</td></tr>
    <tr><td class="py-2 pr-4">Pedal-assist e-bikes</td><td class="text-right py-2 pr-4">$3,000</td><td class="text-right py-2 pr-4">150</td><td class="text-right py-2">$450,000</td></tr>
    <tr><td class="py-2 pr-4">Spare bikes (10% reserve, mixed)</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">50</td><td class="text-right py-2">$90,000</td></tr>
    <tr><td class="py-2 pr-4">Software platform (licensing or bundled)</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2">$200,000</td></tr>
    <tr><td class="py-2 pr-4">Rebalancing vehicles (2 cargo vans)</td><td class="text-right py-2 pr-4">$50,000</td><td class="text-right py-2 pr-4">2</td><td class="text-right py-2">$100,000</td></tr>
    <tr><td class="py-2 pr-4">Contingency (8%)</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2">$300,000</td></tr>
    <tr class="border-t-2 border-gray-300 font-semibold"><td class="py-2 pr-4">Estimated Total Capital</td><td class="text-right py-2 pr-4"></td><td class="text-right py-2 pr-4"></td><td class="text-right py-2">$4,060,000</td></tr>
  </tbody>
</table>
</div>
${p(`Bike unit costs are adjusted slightly upward from the 2020 Toronto figures to account for inflation and the smaller order volume. The 8% contingency reflects the lower risk profile of purchasing proven equipment versus custom engineering. All figures exclude HST.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Estimated Annual Operating Costs</h4>
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Category</th>
      <th class="text-right py-2 font-semibold">Estimated Annual Cost</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Operating contract / staff (mechanics, rebalancing, customer service, 8–10 FTEs)</td><td class="text-right py-2">$700,000</td></tr>
    <tr><td class="py-2 pr-4">City oversight team (2–3 FTEs — contract management, data, planning)</td><td class="text-right py-2">$250,000</td></tr>
    <tr><td class="py-2 pr-4">Rebalancing & logistics (fuel, vehicle maintenance)</td><td class="text-right py-2">$150,000</td></tr>
    <tr><td class="py-2 pr-4">Bike & station parts and repairs</td><td class="text-right py-2">$200,000</td></tr>
    <tr><td class="py-2 pr-4">Software licensing & payment processing</td><td class="text-right py-2">$120,000</td></tr>
    <tr><td class="py-2 pr-4">Insurance & liability</td><td class="text-right py-2">$100,000</td></tr>
    <tr><td class="py-2 pr-4">Marketing & community engagement</td><td class="text-right py-2">$75,000</td></tr>
    <tr class="border-t-2 border-gray-300 font-semibold"><td class="py-2 pr-4">Estimated Total Annual Operating</td><td class="text-right py-2">$1,595,000</td></tr>
  </tbody>
</table>
</div>
${p(`The pilot-phase operating model uses a contracted operator for front-line work (8–10 FTEs: mechanics, rebalancing crews, customer service) plus a small city team (2–3 FTEs) to manage the contract, own the data, and build institutional knowledge. Bike Share Toronto runs ~850 stations with 60–80 operational staff; at that ratio, 50 stations requires roughly 4–5 front-line staff, but a small standalone system is inherently less efficient, so we budget conservatively.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Five-Year Summary</h4>
<div class="grid grid-cols-3 gap-3 my-5">
  <div class="text-center p-4 rounded-xl bg-gray-50 border border-gray-200">
    <div class="text-2xl font-bold text-gray-800">$4.1M</div>
    <div class="text-xs text-gray-500 mt-1">Capital (Year 1)</div>
  </div>
  <div class="text-center p-4 rounded-xl bg-gray-50 border border-gray-200">
    <div class="text-2xl font-bold text-gray-800">$8.0M</div>
    <div class="text-xs text-gray-500 mt-1">Operations (5 yrs)</div>
  </div>
  <div class="text-center p-4 rounded-xl bg-blue-50 border border-blue-200">
    <div class="text-2xl font-bold text-blue-700">$12.1M</div>
    <div class="text-xs text-blue-600/80 mt-1">Total (5-year est.)</div>
  </div>
</div>
${p(`These are estimates, not quotes. Actual costs will be determined by the RFP process. For context, comparable North American pilots include: Redmond, WA ($5.8–7.0M for 28 stations); Memphis, TN ($11.1M for 63 stations). Edmonton's 50-station estimate falls squarely within the range of systems at this scale.`)}
  `,
  children: [],
};

const revenue: DocSection = {
  id: "proposal-revenue",
  title: "Revenue Model & Funding",
  shortTitle: "Revenue & Funding",
  content: `
${p(`No bike-share system in the world is fully self-sustaining from user fees alone. Like public transit, bike-share is a public service that requires ongoing subsidy — but one that generates significant returns in reduced congestion, health outcomes, and economic activity.`)}

<h4 class="font-semibold text-base mt-6 mb-2">User Fee Revenue</h4>
${p(`Based on pricing structures from comparable Canadian systems:`)}
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Pass Type</th>
      <th class="text-right py-2 pr-4 font-semibold">Price</th>
      <th class="text-left py-2 font-semibold">Model</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Annual membership</td><td class="text-right py-2 pr-4">$110/year</td><td class="py-2">Unlimited 45-min rides on regular bikes; e-bikes at reduced per-minute rate</td></tr>
    <tr><td class="py-2 pr-4">Monthly membership</td><td class="text-right py-2 pr-4">$25/month</td><td class="py-2">Same benefits as annual, month-to-month</td></tr>
    <tr><td class="py-2 pr-4">Day pass</td><td class="text-right py-2 pr-4">$15</td><td class="py-2">Unlimited 90-min rides on regular bikes for 24 hours</td></tr>
    <tr><td class="py-2 pr-4">Single ride (pay-as-you-go)</td><td class="text-right py-2 pr-4">$1 unlock + $0.12/min</td><td class="py-2">Regular bike; e-bike at $0.20/min</td></tr>
    <tr><td class="py-2 pr-4">Low-income pass</td><td class="text-right py-2 pr-4">$5/year</td><td class="py-2">Same as annual, income-qualified (following Toronto/Montreal model)</td></tr>
  </tbody>
</table>
</div>
${p(`Conservatively estimating 1,500–2,500 annual members, 10,000 day passes, and 50,000 casual rides in Year One, user fee revenue would be in the range of <strong>$350,000–$550,000 per year</strong> — covering roughly 22–35% of operating costs. This is typical for a new system; BIXI Montreal took several years to reach approximately 50% cost recovery.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Funding Sources</h4>
${p(`The <strong>minimum viable funding package</strong> is municipal capital budget + corporate sponsorship. Federal and provincial grants are significant upside but should not be assumed:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Municipal capital budget.</strong> The City of Edmonton's $100M active transportation commitment demonstrates political will. Bike-share is a natural next step. This is the baseline funding source.</li>
  <li><strong>Corporate sponsorship.</strong> Title sponsorship (e.g., "ATB Bike Share Edmonton") is a proven model. Bike Share Toronto's partnership with RBC and BIXI Montreal's corporate sponsors cover a significant share of operating costs. This is the most reliable non-municipal revenue stream.</li>
  <li><strong>Federal / provincial grants (upside).</strong> Infrastructure Canada's Active Transportation Fund provides up to $400M for active transportation projects. Bike-share systems are eligible. But grants have competitive timelines and should be treated as acceleration funding, not a dependency.</li>
  <li><strong>Transit integration.</strong> If the system is integrated with ETS fare products, the transit authority becomes a funding and distribution partner.</li>
  <li><strong>Advertising.</strong> Station kiosks and bike frames can carry advertising panels, generating incremental revenue.</li>
</ul>
  `,
  children: [],
};

const goals: DocSection = {
  id: "proposal-goals",
  title: "Goals & Success Metrics",
  shortTitle: "Goals",
  content: `
${p(`The pilot should be evaluated against clear, measurable goals — not just ridership numbers but indicators of whether the system is achieving its broader purpose.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Year One Targets</h4>
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Metric</th>
      <th class="text-right py-2 pr-4 font-semibold">Target</th>
      <th class="text-left py-2 font-semibold">Why It Matters</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Total trips</td><td class="text-right py-2 pr-4">150,000+</td><td class="py-2">Basic demand validation (~410/day over a 7-month season)</td></tr>
    <tr><td class="py-2 pr-4">Annual members</td><td class="text-right py-2 pr-4">1,500+</td><td class="py-2">Habitual use indicates the system is integrated into daily routines</td></tr>
    <tr><td class="py-2 pr-4">Trips per bike per day (peak season)</td><td class="text-right py-2 pr-4">3–5</td><td class="py-2">Fleet utilization — too low means wrong locations; too high means too few bikes</td></tr>
    <tr><td class="py-2 pr-4">Transit-connected trips</td><td class="text-right py-2 pr-4">30%+</td><td class="py-2">Validates the last-mile value proposition for ETS</td></tr>
    <tr><td class="py-2 pr-4">Low-income pass enrollment</td><td class="text-right py-2 pr-4">200+</td><td class="py-2">Equity — the system serves all Edmontonians, not just downtown professionals</td></tr>
    <tr><td class="py-2 pr-4">Station uptime</td><td class="text-right py-2 pr-4">98%+</td><td class="py-2">Reliability builds trust; frequent outages kill adoption</td></tr>
    <tr><td class="py-2 pr-4">Net Promoter Score</td><td class="text-right py-2 pr-4">40+</td><td class="py-2">User satisfaction — 40+ is strong for a new public service</td></tr>
  </tbody>
</table>
</div>

<h4 class="font-semibold text-base mt-6 mb-2">Longer-Term Goals (Years 2–5)</h4>
<ul class="list-disc pl-6 space-y-2 my-3">
  <li>Expand to 100–150 stations covering all mature LRT-adjacent neighbourhoods</li>
  <li>Achieve 40–50% cost recovery from user fees and sponsorship</li>
  <li>Measurable reduction in short car trips within the pilot area (travel survey data)</li>
  <li>Integration with ETS fare products (e.g., bike-share included in monthly transit pass)</li>
  <li>Transition governance to a dedicated arms-length public corporation</li>
  <li>Publish all trip data as open data for civic and academic research</li>
</ul>
  `,
  children: [],
};

const iterate: DocSection = {
  id: "proposal-iterate",
  title: "Iterative Improvement",
  shortTitle: "Iteration",
  content: `
${p(`The most important thing to understand about this proposal is that <strong>the first network will not be perfect, and it doesn't need to be</strong>. Every successful bike-share system in the world — Montreal, Toronto, New York, Paris, London — launched with an imperfect first network and improved it year over year based on data.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Why Iteration Matters</h4>
${p(`No model can fully predict how people will use a new transportation system. BikeShareYEG's suitability engine uses seven data-driven factors and proven optimization algorithms, but it's working from proxies (census data, OSM tags) rather than observed cycling behaviour — because Edmonton has none yet. The model's output is a <strong>best guess</strong>, dramatically better than intuition but still a guess.`)}
${p(`What changes everything is <strong>operational data</strong>. Once the system is live, every trip, every empty-station event, every GPS trace generates ground truth that no proxy can replicate. This is why the data ownership clauses in the operating contract are so critical — the city needs full access to this data to make informed decisions about the system's future.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Data Collection in Year One</h4>
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Data Type</th>
      <th class="text-left py-2 font-semibold">What It Reveals</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Trip origin–destination pairs</td><td class="py-2">Actual demand corridors — where people really go</td></tr>
    <tr><td class="py-2 pr-4">Station checkout/return counts by hour</td><td class="py-2">Commute vs. leisure patterns, peak hours, weekday vs. weekend</td></tr>
    <tr><td class="py-2 pr-4">Empty/full station events</td><td class="py-2">Which stations need more docks (or fewer)</td></tr>
    <tr><td class="py-2 pr-4">GPS traces</td><td class="py-2">Preferred routes, infrastructure gaps, desire lines for new paths</td></tr>
    <tr><td class="py-2 pr-4">Rebalancing truck dispatches</td><td class="py-2">Operational cost hotspots, directional flow imbalances</td></tr>
    <tr><td class="py-2 pr-4">Weather vs. ridership correlation</td><td class="py-2">Edmonton-specific seasonal curves, cold-weather thresholds</td></tr>
  </tbody>
</table>
</div>

<h4 class="font-semibold text-base mt-6 mb-2">The Feedback Loop</h4>
<div class="grid gap-2 my-4">
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/80 text-sm">
    <span class="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
    <div><strong>Design</strong> — Data-informed station placement (BikeShareYEG + planning expertise)</div>
  </div>
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/80 text-sm">
    <span class="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
    <div><strong>Deploy</strong> — Install modular, relocatable stations</div>
  </div>
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/80 text-sm">
    <span class="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
    <div><strong>Observe</strong> — Collect trip data, usage patterns, failure events for one season</div>
  </div>
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/80 text-sm">
    <span class="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">4</span>
    <div><strong>Learn</strong> — Recalibrate model weights, discover what the data says vs. what we assumed</div>
  </div>
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/80 text-sm">
    <span class="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">5</span>
    <div><strong>Adapt</strong> — Relocate underperformers, expand high-demand zones, add capacity where needed</div>
  </div>
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/80 text-sm">
    <span class="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">6</span>
    <div><strong>Repeat</strong> — Return to step 1 with a better model and more confidence</div>
  </div>
</div>

<h4 class="font-semibold text-base mt-6 mb-2">A Note on Station Relocation</h4>
${p(`Modern bolt-down stations can be relocated at a fraction of the initial installation cost. But we should be honest: <strong>removing a station from a neighbourhood is politically harder than the logistics suggest</strong>. Once a station is placed, residents come to rely on it, and moving it will generate complaints regardless of what the data says. The operating plan should include a clear public communication process for relocations, tied to published performance data, so the rationale is transparent.`)}
${p(`This is not a failure mode — it's the plan. BIXI Montreal has relocated and added stations every year since 2009. Bike Share Toronto expanded from 80 to 850+ stations over a decade. BikeShareYEG's optimization engine can ingest real trip data to recommend station moves, capacity changes, and expansion zones — replacing modelled proxies with observed behaviour.`)}
  `,
  children: [],
};

const timeline: DocSection = {
  id: "proposal-timeline",
  title: "Proposed Timeline",
  shortTitle: "Timeline",
  content: `
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Phase</th>
      <th class="text-left py-2 pr-4 font-semibold">Timeline</th>
      <th class="text-left py-2 font-semibold">Activities</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4 font-medium">Planning & Public Engagement</td><td class="py-2 pr-4">Months 1–6</td><td class="py-2">Establish governance model, finalize station locations using BikeShareYEG, public consultations, council approval</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Procurement</td><td class="py-2 pr-4">Months 4–10</td><td class="py-2">Issue RFP for equipment and operating contract, evaluate proposals, select supplier, negotiate data ownership terms</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Manufacturing & Delivery</td><td class="py-2 pr-4">Months 10–14</td><td class="py-2">Supplier manufactures and ships 50 stations and 500 bikes, software configuration, staff hiring and training</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Installation</td><td class="py-2 pr-4">Months 14–16</td><td class="py-2">Site preparation, station installation, system integration testing, soft launch with staff</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Pilot Launch</td><td class="py-2 pr-4">Month 16 (spring)</td><td class="py-2">Public launch (ideally April/May), marketing push, free trial period</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Year One Operations</td><td class="py-2 pr-4">Months 16–28</td><td class="py-2">Full operations, data collection, seasonal adjustments, first full season</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Year Two Review & Expansion</td><td class="py-2 pr-4">Months 28–36</td><td class="py-2">Analyze Year One data, optimize placements, plan governance transition, order expansion hardware</td></tr>
  </tbody>
</table>
</div>
${p(`Total time from project start to launch: approximately <strong>14–16 months</strong>. Using proven vendor hardware eliminates the prototyping and custom integration phases that a locally-built system would require. The spring launch timing aligns with peak cycling season and maximizes data collected in the first operating year.`)}
  `,
  children: [],
};

const risks: DocSection = {
  id: "proposal-risks",
  title: "Risks & Mitigations",
  shortTitle: "Risks",
  content: `
${p(`Any honest proposal must address what could go wrong.`)}
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold w-[25%]">Risk</th>
      <th class="text-left py-2 pr-4 font-semibold w-[35%]">Impact</th>
      <th class="text-left py-2 font-semibold">Mitigation</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Ridership below targets</td><td class="py-2.5 pr-4">Revenue shortfall, political pressure to shut down</td><td class="py-2.5">Clear minimum-viability thresholds set before launch; station relocation plan funded from Year One; modular stations mean sunk costs are lower than fixed infrastructure</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Vendor data access falls short</td><td class="py-2.5 pr-4">City cannot optimize network or evaluate performance independently</td><td class="py-2.5">Data ownership and real-time API access are non-negotiable contract terms, tested before signing; RFP disqualifies vendors who won't comply</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Federal grant doesn't materialize</td><td class="py-2.5 pr-4">Full capital cost falls on municipal budget</td><td class="py-2.5">Budget is designed to be fundable from municipal capital + sponsorship alone; grants treated as upside, not dependency</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Vandalism / theft higher than expected</td><td class="py-2.5 pr-4">Increased repair costs, public perception damage</td><td class="py-2.5">GPS tracking on all bikes; station placement in visible, high-traffic areas; insurance line in operating budget; supplier provides replaceable modular components</td></tr>
    <tr><td class="py-2.5 pr-4 font-medium text-gray-700">Supplier underperforms or exits market</td><td class="py-2.5 pr-4">Service disruption, replacement cost</td><td class="py-2.5">City owns all physical assets outright; data portability clause ensures no lock-in; competitive RFP can be re-run for operations; hardware is standard enough that maintenance can be contracted independently</td></tr>
  </tbody>
</table>
</div>
${p(`The overarching mitigation is the public ownership model itself. Because the city owns the physical assets and the data, no single vendor failure can take down the system. Equipment can be maintained independently, operations can be rebid, and data is never held hostage.`)}
  `,
  children: [],
};

const comparable: DocSection = {
  id: "proposal-comparable",
  title: "Comparable Canadian Programs",
  shortTitle: "Comparables",
  content: `
${p(`Edmonton would not be pioneering an untested concept. Dock-based bike-share is a mature, proven model across Canada:`)}
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">City</th>
      <th class="text-left py-2 pr-4 font-semibold">System</th>
      <th class="text-right py-2 pr-4 font-semibold">Stations</th>
      <th class="text-right py-2 pr-4 font-semibold">Bikes</th>
      <th class="text-left py-2 pr-4 font-semibold">Launched</th>
      <th class="text-left py-2 font-semibold">Governance</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Montreal</td><td class="py-2 pr-4">BIXI</td><td class="text-right py-2 pr-4">750+</td><td class="text-right py-2 pr-4">9,000+</td><td class="py-2 pr-4">2009</td><td class="py-2">Public non-profit</td></tr>
    <tr><td class="py-2 pr-4">Toronto</td><td class="py-2 pr-4">Bike Share Toronto</td><td class="text-right py-2 pr-4">850+</td><td class="text-right py-2 pr-4">9,000+</td><td class="py-2 pr-4">2011</td><td class="py-2">TTC division</td></tr>
    <tr><td class="py-2 pr-4">Vancouver</td><td class="py-2 pr-4">Mobi</td><td class="text-right py-2 pr-4">250+</td><td class="text-right py-2 pr-4">2,500+</td><td class="py-2 pr-4">2016</td><td class="py-2">Private operator</td></tr>
    <tr><td class="py-2 pr-4">Hamilton</td><td class="py-2 pr-4">Hamilton Bike Share</td><td class="text-right py-2 pr-4">125</td><td class="text-right py-2 pr-4">750</td><td class="py-2 pr-4">2015</td><td class="py-2">Non-profit operator</td></tr>
    <tr><td class="py-2 pr-4">Ottawa</td><td class="py-2 pr-4">VéloGO</td><td class="text-right py-2 pr-4">50+</td><td class="text-right py-2 pr-4">600+</td><td class="py-2 pr-4">2023</td><td class="py-2">Private operator</td></tr>
  </tbody>
</table>
</div>
${p(`Edmonton's metro population (1.1M) is larger than Ottawa's and Hamilton's, and comparable to the size Montreal and Toronto were when they launched. Every one of these systems uses equipment from a major supplier (predominantly PBSC/Lyft Urban Solutions). The model is proven. The technology is proven. The question for Edmonton is not <em>whether</em> bike-share works, but whether the city is ready to invest in it.`)}
${p(`What would make Edmonton's approach distinctive is the emphasis on <strong>data ownership from day one</strong>. Most cities negotiated data access as an afterthought; Edmonton can build it into the founding contract, ensuring the city has the tools to optimize and expand the network based on evidence rather than vendor recommendations.`)}
  `,
  children: [],
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const PROPOSAL_SECTIONS: DocSection[] = [
  intro,
  theCase,
  existingMicromobility,
  governance,
  pilot,
  placement,
  hardware,
  digital,
  budget,
  revenue,
  goals,
  iterate,
  timeline,
  risks,
  comparable,
];
