/**
 * Proposal content — structured data for the bike-share proposal.
 *
 * This is a standalone document aimed at city councillors and decision-makers,
 * separate from the BikeShareYEG technical documentation.
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
${p(`Edmonton is spending billions on LRT expansion — but ridership depends on what happens at both ends of the trip. If a rider can't get from the station to their actual destination quickly and cheaply, they drive instead, and the train runs empty. This is the <strong>last-mile problem</strong>, and it is the single biggest barrier to transit ROI in sprawling cities. Bike-share is the most cost-effective solution that exists: for the price of a single LRT station, a city can deploy hundreds of bikes that feed riders into the entire rail network.`)}
${p(`Edmonton has also invested over $100 million in protected bike lanes and shared-use paths since 2022 — but lanes without vehicles are just paint on concrete. A public bike-share system turns that infrastructure into a real mobility service: last-mile LRT connections, short trips that replace car traffic downtown, and affordable transportation for residents who can't or don't want to drive.`)}
${p(`This proposal outlines what that system would look like: governance, hardware, digital platform, station placement, costs, and a phased plan for growth. Four principles guide every decision:`)}
<div class="grid gap-3 my-4">
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5">🎯</span>
    <div><strong>Cost-effective mobility.</strong> The purpose of this system is to get Edmontonians where they need to go as affordably and reliably as possible. Every design choice — station count, bike type, software platform — is evaluated against that goal. Features that do not directly improve the rider experience or reduce operating costs are out of scope.</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5">🏛️</span>
    <div><strong>Public ownership.</strong> The City of Edmonton owns the stations, the bikes, and the data. Contracts can be replaced and vendors can be switched without losing the physical system or the operational knowledge behind it.</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5">🔓</span>
    <div><strong>No vendor lock-in.</strong> Hardware, software, and operations are independent, interchangeable layers built on open standards. The city is never dependent on a single supplier for parts, code, or permission to expand.</div>
  </div>
  <div class="flex gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
    <span class="text-lg leading-none mt-0.5">🔧</span>
    <div><strong>Build it here.</strong> Edmonton and Alberta have the fabrication shops, bike manufacturers, and software talent to build and maintain this system. Spending locally on manufacturing, assembly, and operations keeps dollars in the regional economy and builds institutional knowledge that outlasts any individual contract.</div>
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
${p(`Bike-share programs in comparable cities have demonstrated consistent, measurable benefits:`)}
<div class="grid gap-2.5 my-4">
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">🚇</span><div><strong>Transit connectivity.</strong> Bike-share solves the "last mile" problem — getting riders from an LRT station or bus stop to their actual destination. BIXI Montreal reports that over 40% of members use the system in combination with public transit. Edmonton's $100M active transportation investment has built the paths; bike-share puts people on them.</div></div>
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">🚗</span><div><strong>Reduced car trips.</strong> Bike Share Toronto's ridership data shows that a significant share of trips replace short car trips (under 5 km). For a city trying to reduce vehicle congestion on corridors like Whyte Avenue, Jasper Avenue, and the downtown core, bike-share is a cost-effective alternative to adding road capacity.</div></div>
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">❤️</span><div><strong>Public health.</strong> Active transportation reduces cardiovascular disease, diabetes, and obesity. Even moderate cycling — a few short bike-share trips per week — produces measurable health outcomes at the population level.</div></div>
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">🏪</span><div><strong>Economic activity.</strong> Studies consistently show that cycling infrastructure and bike-share stations increase foot traffic and spending at local businesses. A station on Whyte Avenue or 124 Street isn't a loss of parking — it's a stream of customers arriving ready to walk and shop.</div></div>
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">✈️</span><div><strong>Tourism and city identity.</strong> Bike-share is a visible, tangible amenity that signals a modern, livable city. Visitors to Edmonton for events, festivals, or business can orient themselves on a bike in a way that ride-hailing and buses don't replicate.</div></div>
  <div class="flex gap-3 items-start"><span class="text-base leading-none mt-1">⚖️</span><div><strong>Equity.</strong> A well-designed bike-share system with low-income pricing (as BIXI and Bike Share Toronto offer) provides affordable, reliable mobility to residents who can't afford a car or don't live on a frequent transit route.</div></div>
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
${p(`The short answer is that they solve different problems. Lime is a convenience service. Bike-share is transportation infrastructure. The comparison below explains why one does not replace the other.`)}

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
${p(`The fare difference is significant, especially for regular users:`)}
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Scenario</th>
      <th class="text-right py-2 pr-4 font-semibold">Lime E-Scooter</th>
      <th class="text-right py-2 font-semibold">Dock-Based Bike-Share</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Casual 15-min ride</td><td class="text-right py-2 pr-4">$4.75–$5.50</td><td class="text-right py-2 text-green-700 font-medium">$2.80</td></tr>
    <tr><td class="py-2 pr-4">Daily commute (2 × 15-min rides)</td><td class="text-right py-2 pr-4">$9.50–$11.00</td><td class="text-right py-2 text-green-700 font-medium">$0 with annual pass</td></tr>
    <tr class="bg-amber-50/60"><td class="py-2 pr-4 font-medium">Monthly cost (weekday commuter)</td><td class="text-right py-2 pr-4 text-red-700 font-semibold">$190–$220</td><td class="text-right py-2 text-green-700 font-semibold">~$10 (annual pass)</td></tr>
    <tr><td class="py-2 pr-4">Annual membership</td><td class="text-right py-2 pr-4 text-gray-400">Not available</td><td class="text-right py-2 text-green-700 font-medium">$105–$120</td></tr>
    <tr><td class="py-2 pr-4">Low-income option</td><td class="text-right py-2 pr-4 text-gray-400">None</td><td class="text-right py-2 text-green-700 font-medium">$5/year</td></tr>
  </tbody>
</table>
</div>
${p(`Lime's pricing model — $1 unlock + $0.25–0.39/min — is designed for occasional, short trips. It is not economically viable as a daily transportation option. A weekday commuter taking two 15-minute rides per day would spend roughly <strong>$200/month on Lime</strong> versus <strong>$10/month amortized on an annual bike-share membership</strong>. For lower-income Edmontonians, Lime offers no discounted access at all.`)}

<h4 class="font-semibold text-base mt-6 mb-2">They Coexist</h4>
${p(`This is not an argument against Lime or private micromobility. Scooters serve a real purpose — spontaneous short trips, recreation, tourism. But they are not a substitute for a reliable, publicly-accountable transit service with fixed stations at LRT stops and commuter corridors. Edmonton doesn't cancel bus routes because Uber exists. The same logic applies here.`)}
  `,
  children: [],
};

const governance: DocSection = {
  id: "proposal-governance",
  title: "Governance: A Dedicated Public Operator",
  shortTitle: "Governance",
  content: `
${p(`How a bike-share system is governed matters as much as where the stations go. The governance model determines how fast the system can adapt, who is accountable, who owns the data, and whether the program serves the public or a vendor's shareholders.`)}

<h4 class="font-semibold text-base mt-6 mb-2">The Problem with Outsourcing Everything</h4>
${p(`The default approach in many cities is to issue an RFP, contract a private operator (typically Lyft/PBSC), and let them handle hardware, software, operations, and branding as a bundled package. This is fast to launch but creates serious long-term problems:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Vendor lock-in.</strong> Lyft/PBSC's stations, bikes, and software are a proprietary stack. The bikes only work with their docks; the app only works with their backend. If the city wants to switch providers, add capacity from another source, or bring operations in-house — it can't. Miami signed a de facto 10-year exclusivity agreement with a dock provider. That's not a partnership, it's a dependency.</li>
  <li><strong>Misaligned incentives.</strong> A for-profit operator's goal is to maximize revenue and minimize cost. The city's goal is to maximize public benefit — which sometimes means putting stations in lower-ridership areas for equity, or maintaining service during lower-demand periods to build habitual use. These goals conflict.</li>
  <li><strong>Loss of knowledge.</strong> When a vendor handles everything, the city learns nothing about how to operate the system. When the contract expires, there is no institutional capacity to continue, renegotiate from strength, or switch vendors. The city is permanently dependent.</li>
  <li><strong>Data as leverage.</strong> Trip data, usage patterns, and operational metrics are the system's most valuable long-term asset. Under a vendor contract, the operator controls this data. The city gets reports; the vendor gets leverage.</li>
</ul>

<h4 class="font-semibold text-base mt-6 mb-2">The Recommended Model: Arms-Length Public Non-Profit</h4>
${p(`We recommend that Edmonton establish a <strong>dedicated, arms-length public non-profit corporation</strong> to own and operate the bike-share system. This is the model that post-2014 BIXI Montreal uses — and it has been their most successful era, growing from 459 to 750+ stations.`)}

${p(`The structure:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>City Council creates the entity</strong> by bylaw, appoints a board of directors (citizens, transit experts, cycling advocates, a council liaison), and sets the mandate: operate a public bike-share system, maximize ridership and equity, publish open data, and break even on operations within five years.</li>
  <li><strong>The city owns the physical assets</strong> — stations, bikes, vehicles. The corporation operates them under a service agreement. If the corporation underperforms, the city retains the assets and can restructure or replace it. No vendor holds the infrastructure.</li>
  <li><strong>The corporation has operational independence</strong> — it hires its own staff, sets pricing within council-approved ranges, makes station relocation decisions, and manages vendor relationships for hardware and software. It doesn't need council approval to move a station or adjust rebalancing schedules.</li>
  <li><strong>Separate contracts for separate things.</strong> The corporation contracts local fabricators for dock hardware, a Canadian bike manufacturer for the fleet, and an independent software provider (or open-source platform) for the app and backend. No single vendor controls the whole stack.</li>
</ul>

<h4 class="font-semibold text-base mt-6 mb-2">Why Not ETS?</h4>
${p(`Edmonton Transit Service is a branch of the City of Edmonton — not an independent entity. Adding bike-share to ETS means every station move, pricing change, and fleet decision goes through the same bureaucratic process as a bus route change. Bike-share in its first year needs to iterate weekly — relocating underperforming stations, adjusting dock counts, responding to events and seasons. That pace is incompatible with a city department's approval chain.`)}
${p(`ETS should be a <strong>partner</strong> (integrated fare products, shared data, coordinated station siting near transit hubs) — but not the operator.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Edmonton Has Done This Before</h4>
${p(`EPCOR — the city-owned utility corporation — is proof that Edmonton knows how to stand up an independent, publicly-owned entity that operates competently at scale. EPCOR runs water, wastewater, and electrical distribution with its own board, budget, and staff, while remaining 100% city-owned. The governance model exists. The legal framework exists. It works.`)}
  `,
  children: [],
};

const pilot: DocSection = {
  id: "proposal-pilot",
  title: "Pilot Scope: 50 Stations, 500 Bikes",
  shortTitle: "Pilot Scope",
  content: `
<div class="grid grid-cols-2 gap-4 my-6">
  <div class="text-center p-5 rounded-xl bg-blue-50 border border-blue-100">
    <div class="text-3xl font-bold text-blue-700">50</div>
    <div class="text-sm text-blue-600/80 mt-1">Dock Stations</div>
  </div>
  <div class="text-center p-5 rounded-xl bg-blue-50 border border-blue-100">
    <div class="text-3xl font-bold text-blue-700">500</div>
    <div class="text-sm text-blue-600/80 mt-1">Bikes</div>
  </div>
</div>
${p(`We recommend launching with a focused pilot covering Edmonton's highest-demand corridors. Fifty stations and 500 bikes is large enough to form a usable, connected network — not just scattered stations — but small enough to be fiscally responsible as a first investment.`)}

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
${p(`This coverage area is roughly 15 km² — comparable to BIXI Montreal's original 2009 launch footprint and Bike Share Toronto's initial 2011 deployment. BikeShareYEG's optimization engine can model exact station placements within these zones, testing tradeoffs between coverage, connectivity, and budget constraints.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Why 50 Stations?</h4>
${p(`Network density matters more than network size. Research on bike-share systems consistently finds that <strong>riders need a station within 300–500 metres of both their origin and destination</strong> to choose bike-share over alternatives. Fifty stations, concentrated in a contiguous area, can achieve that density. Twenty stations scattered across the whole city cannot.`)}
${p(`The pilot should be dense enough that a user standing at any station can see or easily walk to the next one. This builds confidence in the system and encourages habitual use.`)}
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
${p(`The conventional approach is to buy a turnkey system from a single vendor — Lyft/PBSC supplies the bikes, docks, kiosks, software, and app as an integrated package. This is fast but creates exactly the vendor lock-in this proposal aims to avoid. The bikes only work with their docks; the app only works with their backend; and the city owns nothing it can maintain, modify, or replace independently.`)}
${p(`We propose a different approach: <strong>source hardware from separate, independent suppliers — prioritizing local and Canadian manufacturers</strong> — and integrate them with open-standard software. This costs more in integration effort upfront, but produces a system the city actually owns and can sustain.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Docking Stations: Local Fabrication</h4>
${p(`A bike dock is mechanically straightforward: powder-coated steel frames with fork guides, bolt-down base plates, modular connectors, and a solenoid lock triggered by the control system. The structural fabrication is well within the capability of Edmonton's metal fabrication sector.`)}
${p(`Edmonton has multiple CWB-certified shops with the equipment and expertise to produce dock hardware:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Terrick Enterprises</strong> — 30+ years of custom steel/aluminum/stainless fabrication, design-to-delivery, structural products</li>
  <li><strong>IMARK Metals</strong> — 25+ years of architectural metal fabrication across Western Canada, specializing in outdoor infrastructure</li>
  <li><strong>Raylin Manufacturing</strong> — architectural and functional steel projects, exactly the category bike docks fall into</li>
  <li><strong>Midwest Fabricators</strong> — CNC machining, laser/plasma cutting, welding; industrial and commercial applications</li>
  <li><strong>ARC Metal Industries</strong> — precision fabrication with CNC punch press, laser cutting, forming up to ½" material</li>
</ul>
${p(`The mechanical dock hardware (frames, base plates, fork guides, covers) would be contracted to a local fab shop. The electronics layer — solenoid locks, solar charge controllers, wireless communication modules, and the station control board — is commodity IoT hardware that can be specified independently and integrated by an electronics engineering firm or a university partnership (the U of A's Faculty of Engineering is a natural collaborator for prototyping).`)}
${p(`Each station is solar-powered, wireless, and bolt-down — no buried conduit or permanent foundations. A station can be installed in a day and <strong>relocated for roughly $6,500</strong>, compared to $45,000–55,000 for a new installation. This modularity is essential for the iterative approach: moving a station that isn't working should be cheap and routine.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Bikes: Canadian Manufacturers</h4>
${p(`Several Canadian companies manufacture or assemble e-bikes domestically and could produce fleet-grade bikes for a bike-share system:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Biktrix</strong> (Saskatoon, SK) — 50+ employees, designs and hand-assembles e-bikes in Saskatoon, custom powder-coating, small-batch capable, recently expanded with $3.5M investment. Five hours from Edmonton.</li>
  <li><strong>Devinci</strong> (Saguenay, QC) — manufactures complete bikes including e-bikes in their Canadian factory since 1987. Production-scale capability.</li>
  <li><strong>OHM Cycles</strong> (BC) — Canada's original e-bike company since 2005, full domestic production, engineered for Canadian weather.</li>
  <li><strong>ENVO</strong> (North Vancouver, BC) — premium e-bikes with domestic manufacturing since 2015.</li>
  <li><strong>Structure Cycleworks</strong> (Calgary, AB) — innovative e-bike designs, right in Alberta.</li>
</ul>
${p(`We recommend a <strong>mixed fleet of regular pedal bikes and pedal-assist e-bikes</strong> in a roughly 70/30 split (350 regular + 150 e-bikes). E-bikes dramatically expand the usable range of a bike-share trip — especially given Edmonton's river valley topography — and every Canadian system that has introduced e-bikes has seen ridership increases.`)}
${p(`Fleet bikes must be purpose-built for sharing: heavy-duty frame, puncture-resistant tires, integrated lock mechanism, GPS tracker, chain guard, and front basket. The bike manufacturer would be selected through a competitive bid process, with a strong preference for Canadian production. The key requirement is that <strong>the bike's lock interface is an open specification</strong> — compatible with the dock hardware, but not married to a proprietary ecosystem.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Winter Considerations</h4>
${p(`The pilot would launch in spring and operate through at least the full cycling season (April–October). Whether to extend into winter months is a decision that can be made based on first-season ridership data and demand. BIXI Montreal began operating year-round in 2023 with a reduced fleet on plowed corridors, and Bike Share Toronto now runs 12 months. Edmonton's climate is comparable. If demand supports it, winter service with a smaller fleet concentrated on high-traffic, well-maintained corridors is a proven option — but not a requirement for a successful launch.`)}
  `,
  children: [],
};

const digital: DocSection = {
  id: "proposal-digital",
  title: "Digital Infrastructure & App",
  shortTitle: "Digital Platform",
  content: `
${p(`The digital layer — the user app, payment system, operations dashboard, and data feeds — is what makes the system usable, manageable, and transparent. It is also the layer most vulnerable to vendor lock-in. The principle here is: <strong>open standards, open data, replaceable components</strong>.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Open Standards First</h4>
${p(`Two open standards are non-negotiable:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>GBFS (General Bikeshare Feed Specification)</strong> — the industry standard that allows Google Maps, Apple Maps, Transit App, and any third-party tool to show real-time station availability. This is how BikeShareYEG (and tools like it) integrate live data. Any software platform we choose must publish a GBFS feed.</li>
  <li><strong>Open trip data</strong> — anonymized, aggregated trip data published as open data (following BIXI Montreal's example). This enables civic analysis, academic research, and tools like BikeShareYEG to optimize the network using real usage patterns.</li>
</ul>

<h4 class="font-semibold text-base mt-6 mb-2">Software Options</h4>
${p(`The software platform — user app, fleet management, payment processing — should be contracted <strong>separately from the hardware</strong>. This is the single most important architectural decision for avoiding lock-in. Options include:`)}
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Movatic</strong> — an open platform supporting 300+ operators globally, with flexible hardware integration (6+ locking systems), user apps, billing, memberships, and marketing tools. Designed specifically for multi-vendor hardware setups.</li>
  <li><strong>OpenSourceBikeShare</strong> — a fully open-source platform (GPL-3.0) deployed in Bratislava and elsewhere, with web app, SMS/QR unlocking, and admin tools. Lower polish but zero licensing cost and full code ownership.</li>
  <li><strong>Custom development</strong> — Edmonton has a strong tech sector. A local software firm could build a bespoke platform using open-source components, giving the operating corporation full ownership of the codebase. Higher upfront cost, but eliminates all software licensing dependencies.</li>
</ul>
${p(`In any case, the contract must require that the operating corporation <strong>retains ownership of the codebase or has full data export and migration rights</strong>. No software vendor should be able to hold the system hostage at contract renewal.`)}

<h4 class="font-semibold text-base mt-6 mb-2">User-Facing App</h4>
${p(`Riders need a mobile app (iOS + Android) to find nearby stations with real-time bike/dock availability, unlock bikes (QR code or NFC), purchase memberships and passes, view trip history, and report issues. The kiosk at each station handles walk-up users who don't have the app.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Payment Processing</h4>
${p(`The system must support credit/debit (contactless + chip), Apple Pay / Google Pay, and a low-income pass option with cash or voucher enrollment. Payment processing should use a standard gateway (Stripe, Moneris, etc.) — not a proprietary vendor payment system that bundles transaction fees with service fees.`)}

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
${p(`The following estimates reflect the locally-built approach: separate contracts for dock fabrication, bikes, electronics, and software, with the operating corporation managing integration. Costs are benchmarked against published figures from comparable North American deployments and adjusted for Canadian pricing.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Capital Costs (Year One)</h4>
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
    <tr><td class="py-2 pr-4">Dock stations — structural fabrication (local)</td><td class="text-right py-2 pr-4">$25,000</td><td class="text-right py-2 pr-4">50</td><td class="text-right py-2">$1,250,000</td></tr>
    <tr><td class="py-2 pr-4">Dock stations — electronics, solar, kiosk</td><td class="text-right py-2 pr-4">$20,000</td><td class="text-right py-2 pr-4">50</td><td class="text-right py-2">$1,000,000</td></tr>
    <tr><td class="py-2 pr-4">Regular bikes (Canadian manufacturer)</td><td class="text-right py-2 pr-4">$2,500</td><td class="text-right py-2 pr-4">350</td><td class="text-right py-2">$875,000</td></tr>
    <tr><td class="py-2 pr-4">Pedal-assist e-bikes (Canadian manufacturer)</td><td class="text-right py-2 pr-4">$5,000</td><td class="text-right py-2 pr-4">150</td><td class="text-right py-2">$750,000</td></tr>
    <tr><td class="py-2 pr-4">Spare bikes (10% reserve)</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">50</td><td class="text-right py-2">$150,000</td></tr>
    <tr><td class="py-2 pr-4">Software platform (licensing or development)</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2">$300,000</td></tr>
    <tr><td class="py-2 pr-4">Systems integration & testing</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2">$250,000</td></tr>
    <tr><td class="py-2 pr-4">Installation, site prep, signage</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2 pr-4">—</td><td class="text-right py-2">$300,000</td></tr>
    <tr><td class="py-2 pr-4">Rebalancing vehicles (2 cargo vans)</td><td class="text-right py-2 pr-4">$50,000</td><td class="text-right py-2 pr-4">2</td><td class="text-right py-2">$100,000</td></tr>
    <tr class="border-t-2 border-gray-300 font-semibold"><td class="py-2 pr-4">Total Capital</td><td class="text-right py-2 pr-4"></td><td class="text-right py-2 pr-4"></td><td class="text-right py-2">$4,975,000</td></tr>
  </tbody>
</table>
</div>
${p(`The locally-built approach comes in at roughly the same total capital cost as a turnkey vendor purchase (~$4.9M vs. ~$5.0M), because savings on the dock fabrication (local fab shops vs. PBSC markup) offset the added integration costs. The critical difference is that <strong>the city owns a system it understands, can maintain, and can expand without returning to a single vendor for permission or pricing</strong>.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Annual Operating Costs</h4>
<div class="overflow-x-auto my-4">
<table class="w-full text-sm border-collapse">
  <thead>
    <tr class="border-b-2 border-gray-200">
      <th class="text-left py-2 pr-4 font-semibold">Category</th>
      <th class="text-right py-2 font-semibold">Estimated Annual Cost</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-gray-100">
    <tr><td class="py-2 pr-4">Staff — operations, maintenance, customer service (12–15 FTEs)</td><td class="text-right py-2">$900,000</td></tr>
    <tr><td class="py-2 pr-4">Rebalancing & logistics (fuel, vehicle maintenance)</td><td class="text-right py-2">$200,000</td></tr>
    <tr><td class="py-2 pr-4">Bike & station parts and repairs</td><td class="text-right py-2">$250,000</td></tr>
    <tr><td class="py-2 pr-4">Software licensing & payment processing</td><td class="text-right py-2">$120,000</td></tr>
    <tr><td class="py-2 pr-4">Insurance & liability</td><td class="text-right py-2">$100,000</td></tr>
    <tr><td class="py-2 pr-4">Winter operations (snow clearing, reduced fleet mgmt)</td><td class="text-right py-2">$75,000</td></tr>
    <tr><td class="py-2 pr-4">Marketing & community engagement</td><td class="text-right py-2">$75,000</td></tr>
    <tr class="border-t-2 border-gray-300 font-semibold"><td class="py-2 pr-4">Total Annual Operating</td><td class="text-right py-2">$1,720,000</td></tr>
  </tbody>
</table>
</div>
${p(`Operating costs are slightly higher than a vendor-operated model because the corporation employs its own staff rather than paying a management fee. But these are <strong>local jobs</strong> — mechanics, logistics coordinators, customer service staff — and the institutional knowledge stays in Edmonton. When a dock needs repair, your own team fixes it with parts from a local shop. When the fleet needs expansion, you issue a new purchase order — you don't renegotiate a monopoly contract.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Five-Year Total</h4>
<div class="grid grid-cols-3 gap-3 my-5">
  <div class="text-center p-4 rounded-xl bg-gray-50 border border-gray-200">
    <div class="text-2xl font-bold text-gray-800">$5.0M</div>
    <div class="text-xs text-gray-500 mt-1">Capital (Year 1)</div>
  </div>
  <div class="text-center p-4 rounded-xl bg-gray-50 border border-gray-200">
    <div class="text-2xl font-bold text-gray-800">$8.6M</div>
    <div class="text-xs text-gray-500 mt-1">Operations (5 yrs)</div>
  </div>
  <div class="text-center p-4 rounded-xl bg-blue-50 border border-blue-200">
    <div class="text-2xl font-bold text-blue-700">$13.6M</div>
    <div class="text-xs text-blue-600/80 mt-1">Total (5-year)</div>
  </div>
</div>
${p(`This is in the range of comparable North American pilots: Redmond, WA budgeted $5.8–7.0M for a 28-station system; Memphis, TN projected $11.1M for a 63-station system.`)}
${p(`An important distinction: under the locally-built model, a significant share of this spending stays in the Edmonton and Alberta economy — fabrication contracts, bike assembly, staff salaries, software development. Under a vendor model, the majority flows to a multinational corporation headquartered elsewhere.`)}
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
${p(`Conservatively estimating 1,500–2,500 annual members, 10,000 day passes, and 50,000 casual rides in Year One, user fee revenue would be in the range of <strong>$350,000–$550,000 per year</strong> — covering roughly 20–30% of operating costs. This is typical for a new system; BIXI Montreal took several years to reach approximately 50% cost recovery.`)}

<h4 class="font-semibold text-base mt-6 mb-2">Funding Sources</h4>
<ul class="list-disc pl-6 space-y-2 my-3">
  <li><strong>Municipal capital budget.</strong> The City of Edmonton's $100M active transportation commitment demonstrates political will. Bike-share is a natural next step and could be funded from the same program or from the capital budget directly.</li>
  <li><strong>Federal / provincial grants.</strong> Infrastructure Canada's Active Transportation Fund (launched 2021) provides up to $400M for active transportation projects. Bike-share systems are eligible. The local-manufacturing angle strengthens grant applications — it's not just transit, it's economic development.</li>
  <li><strong>Corporate sponsorship.</strong> Title sponsorship (e.g., "ATB Bike Share Edmonton") is a proven model. Bike Share Toronto's partnership with RBC and BIXI Montreal's corporate sponsors cover a significant share of operating costs. Station-level sponsorship is also common.</li>
  <li><strong>Transit integration.</strong> If the system is integrated with ETS fare products — e.g., a transit pass that includes bike-share — the transit authority becomes a funding and distribution partner.</li>
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
    <tr><td class="py-2 pr-4">Total trips</td><td class="text-right py-2 pr-4">150,000+</td><td class="py-2">Basic demand validation (≈3,000/station, comparable to mid-size launches)</td></tr>
    <tr><td class="py-2 pr-4">Annual members</td><td class="text-right py-2 pr-4">1,500+</td><td class="py-2">Habitual use indicates the system is integrated into daily routines</td></tr>
    <tr><td class="py-2 pr-4">Trips per bike per day (peak season)</td><td class="text-right py-2 pr-4">3–5</td><td class="py-2">Fleet utilization — too low means wrong locations; too high means too few bikes</td></tr>
    <tr><td class="py-2 pr-4">Transit-connected trips</td><td class="text-right py-2 pr-4">30%+</td><td class="py-2">Validates the last-mile value proposition for ETS</td></tr>
    <tr><td class="py-2 pr-4">Low-income pass enrollment</td><td class="text-right py-2 pr-4">200+</td><td class="py-2">Equity — the system serves all Edmontonians, not just downtown professionals</td></tr>
    <tr><td class="py-2 pr-4">Station uptime</td><td class="text-right py-2 pr-4">98%+</td><td class="py-2">Reliability builds trust; frequent outages kill adoption</td></tr>
    <tr><td class="py-2 pr-4">Net Promoter Score</td><td class="text-right py-2 pr-4">50+</td><td class="py-2">User satisfaction — would members recommend the system to others?</td></tr>
  </tbody>
</table>
</div>

<h4 class="font-semibold text-base mt-6 mb-2">Longer-Term Goals (Years 2–5)</h4>
<ul class="list-disc pl-6 space-y-2 my-3">
  <li>Expand to 100–150 stations covering all mature LRT-adjacent neighbourhoods</li>
  <li>Achieve 40–50% cost recovery from user fees and sponsorship</li>
  <li>Measurable reduction in short car trips within the pilot area (travel survey data)</li>
  <li>Integration with ETS fare products (e.g., bike-share included in monthly transit pass)</li>
  <li>Publish all trip data as open data for civic and academic research</li>
  <li>Demonstrate the local supply chain model as replicable for other Canadian cities</li>
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
${p(`No model can fully predict how people will use a new transportation system. Our suitability engine uses seven data-driven factors and proven optimization algorithms, but it's working from proxies (census data, OSM tags) rather than observed cycling behaviour — because Edmonton has none yet. The model's output is a <strong>best guess</strong>, dramatically better than intuition but still a guess.`)}
${p(`What changes everything is <strong>operational data</strong>. Once the system is live, every trip, every empty-station event, every GPS trace generates ground truth that no proxy can replicate.`)}
${p(`The locally-built, modular approach makes iteration <em>cheap</em>. Because the operating corporation owns the assets, employs the maintenance staff, and contracts local fabricators directly, moving a station is a logistics decision — not a contract amendment. Order five more docks from the same Edmonton shop that built the first fifty. Reallocate e-bikes from a quiet station to a busy one overnight. This operational agility is the whole point of public ownership.`)}

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
    <div><strong>Deploy</strong> — Install modular, locally-built stations</div>
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
    <div><strong>Adapt</strong> — Relocate underperformers, expand high-demand zones, order more docks locally</div>
  </div>
  <div class="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100/80 text-sm">
    <span class="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">6</span>
    <div><strong>Repeat</strong> — Return to step 1 with a better model and more confidence</div>
  </div>
</div>

${p(`This is not a failure mode — it's the plan. BIXI Montreal has relocated and added stations every year since 2009. Bike Share Toronto expanded from 80 to 850+ stations over a decade. The bolt-down station design makes relocation feasible at roughly $6,500 per move — a fraction of the initial installation cost.`)}
${p(`BikeShareYEG's value extends beyond the initial design. After Year One, the same optimization engine can ingest real trip data to recommend station moves, capacity changes, and expansion zones — replacing modelled proxies with observed behaviour.`)}
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
    <tr><td class="py-2 pr-4 font-medium">Planning & Public Engagement</td><td class="py-2 pr-4">Months 1–6</td><td class="py-2">Establish operating corporation, finalize station locations using BikeShareYEG, public consultations, council approval</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Procurement & Prototyping</td><td class="py-2 pr-4">Months 4–10</td><td class="py-2">Contract local fabricator for dock prototype, select bike manufacturer, select software platform, prototype and test dock+bike+software integration</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Manufacturing</td><td class="py-2 pr-4">Months 10–14</td><td class="py-2">Production run of 50 stations and 500 bikes, software platform configuration, staff hiring and training</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Installation</td><td class="py-2 pr-4">Months 14–16</td><td class="py-2">Site preparation, station installation, system integration testing, soft launch with staff</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Pilot Launch</td><td class="py-2 pr-4">Month 16 (spring)</td><td class="py-2">Public launch (ideally April/May), marketing push, free trial period</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Year One Operations</td><td class="py-2 pr-4">Months 16–28</td><td class="py-2">Full operations, data collection, seasonal adjustments, first winter season</td></tr>
    <tr><td class="py-2 pr-4 font-medium">Year Two Review & Expansion</td><td class="py-2 pr-4">Months 28–32</td><td class="py-2">Analyze Year One data, optimize placements, order expansion hardware, plan growth to 75–100 stations</td></tr>
  </tbody>
</table>
</div>
${p(`Total time from project start to launch: approximately <strong>16 months</strong> — one month longer than a turnkey vendor approach, to account for the prototyping and integration phase. The spring launch timing aligns with peak cycling season and maximizes data collected in the first operating year.`)}
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
    <tr><td class="py-2 pr-4">Montreal</td><td class="py-2 pr-4">BIXI</td><td class="text-right py-2 pr-4">750+</td><td class="text-right py-2 pr-4">9,000+</td><td class="py-2 pr-4">2009</td><td class="py-2">Public non-profit (city-owned assets)</td></tr>
    <tr><td class="py-2 pr-4">Toronto</td><td class="py-2 pr-4">Bike Share Toronto</td><td class="text-right py-2 pr-4">850+</td><td class="text-right py-2 pr-4">9,000+</td><td class="py-2 pr-4">2011</td><td class="py-2">TTC division (transit agency)</td></tr>
    <tr><td class="py-2 pr-4">Vancouver</td><td class="py-2 pr-4">Mobi</td><td class="text-right py-2 pr-4">250+</td><td class="text-right py-2 pr-4">2,500+</td><td class="py-2 pr-4">2016</td><td class="py-2">Private operator (city contract)</td></tr>
    <tr><td class="py-2 pr-4">Hamilton</td><td class="py-2 pr-4">Hamilton Bike Share</td><td class="text-right py-2 pr-4">125</td><td class="text-right py-2 pr-4">750</td><td class="py-2 pr-4">2015</td><td class="py-2">Non-profit operator</td></tr>
    <tr><td class="py-2 pr-4">Ottawa</td><td class="py-2 pr-4">VéloGO</td><td class="text-right py-2 pr-4">50+</td><td class="text-right py-2 pr-4">600+</td><td class="py-2 pr-4">2023</td><td class="py-2">Private operator (city contract)</td></tr>
  </tbody>
</table>
</div>
${p(`Edmonton's metro population (1.1M) is larger than Ottawa's and Hamilton's, and comparable to the size Montreal and Toronto were when they launched their systems. The city has an established cycling culture (Bike Edmonton, critical mass events, River Valley trail system) and is in the midst of the largest active transportation infrastructure investment in its history.`)}
${p(`What would make Edmonton's approach <em>distinctive</em> is the commitment to public ownership, local manufacturing, and vendor independence. No Canadian city has yet built a bike-share system this way — they've all bought turnkey from PBSC/Lyft. Edmonton has the fabrication sector, the engineering talent, and the political will to prove there's a better model: one where the city owns what it builds, employs the people who run it, and keeps the money and the knowledge local.`)}
${p(`The question is not whether bike-share works in Canadian cities — it demonstrably does. The question is whether Edmonton is ready to build one that actually belongs to Edmontonians. This proposal says yes.`)}
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
  comparable,
];
