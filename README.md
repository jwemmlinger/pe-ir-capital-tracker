# PE Investor Relations — Salesforce LWC Suite

A suite of production-grade **Lightning Web Components (LWCs)** for a Private Equity (PE) firm's **Investor Relations (IR)** team, built on **Salesforce Financial Services Cloud (FSC)**.

The suite contains two components:

| Component | Purpose | Surface |
|---|---|---|
| **`irCapitalTracker`** | Capital commitments, drawdown gauge, PE multiples, ledger, fundraising pipeline, and fund vehicles for an institutional LP | Account record page |
| **`dealRelationshipBoard`** | An Actionable Relationship Center (ARC)-style graph of a PE deal's participants (co-investors, deal team, counsel, target, intermediaries) | Record / App / Home page |
| **`portfolioIntelligence`** | A **mock** market-intelligence integration surfacing scored target portfolio companies, buying signals, and suggested outreach | Record / App / Home page |

![Tab 1 — Capital Performance & Ledger](docs/screenshot-capital.png)

---

## Table of Contents

- [Component 1 — IR Capital & Pipeline Tracker](#component-1--ir-capital--pipeline-tracker)
  - [Features](#features)
  - [Architecture & Data Model](#architecture--data-model)
  - [PE Financial Logic](#pe-financial-logic)
- [Component 2 — Deal Relationship Board](#component-2--deal-relationship-board)
- [Component 3 — Portfolio Market Intelligence](#component-3--portfolio-market-intelligence)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Deployment](#deployment)
- [Field-Level Security](#field-level-security)
- [Seeding Demo Data](#seeding-demo-data)
- [Adding the Components to a Page](#adding-the-components-to-a-page)
- [Component Reference](#component-reference)
- [Customization Notes](#customization-notes)
- [Troubleshooting](#troubleshooting)

---

# Component 1 — IR Capital & Pipeline Tracker

`irCapitalTracker` sits on an institutional **Limited Partner (LP)** Account record page and visualizes capital commitments, called/uncalled capital, distributions, PE performance multiples, the capital-call/distribution ledger, the active fundraising pipeline, and the linked fund vehicles — with a one-click flow to convert a won opportunity into a funded commitment.

## Features

### Tab 1 — Capital Performance & Ledger
- **Fund Commitment Filter** — combobox to view *All Combined Commitments* or drill into a single fund.
- **Radial SVG Drawdown Gauge** — interactive ring showing called vs. uncalled capital as a percentage.
- **KPI Cards** — Capital Committed, Capital Called (with %), Remaining Uncalled, Distributions.
- **PE Performance Multiples** — **TVPI**, **DPI**, **RVPI**, recalculated reactively per scope.
- **Capital Ledger Datatable** — recent capital calls (drawdowns) and distributions with date, type, amount, reference code, and status.

### Tab 2 — Fundraising Pipeline
- **Kanban Stage Board** — three PE-aligned columns: *Prospecting / Diligence*, *Legal / Subscription Review*, *Closed Won — Activated*.
- **Pipeline Datatable** — every related opportunity with **linked fund**, fund offering, amount, stage, probability, and expected close.
- **Activate Commitment** — a row action / button that transitions an Opportunity to **Closed Won** and **automatically instantiates a new FSC `FinServ__FinancialAccount__c` commitment** for the subscribed amount.

### Tab 3 — Fund Vehicles
- **Fund card grid** of the PE fund vehicles (custom `Fund__c`) linked to the LP Account.
- Each card shows lifecycle status, type, vintage, a **committed-vs-target progress bar**, capital metrics (committed / invested / target / open pipeline), and fund facts (investors, management fee, term).
- **Related opportunities** are rolled up per fund (via the `FINS_Private_Equity_Fund__c` lookup on Opportunity) — each card lists its open deals with amount, stage, and probability, plus a headline of open-opportunity count and total amount.

---

## Architecture & Data Model

The PE domain is mapped natively onto standard FSC + standard Salesforce objects:

| PE Concept | Salesforce Object | Key Fields |
|---|---|---|
| **Institutional LP** | `Account` | Host of the record page |
| **Commitment** (fund stake) | `FinServ__FinancialAccount__c` (Record Type: `InvestmentAccount`) | `FinServ__Balance__c` = Committed Capital, `Total_Called_Capital__c`, `Total_Distributions__c`, `Current_NAV__c`, `FinServ__PrimaryOwner__c` → Account |
| **Ledger Transaction** | `FinServ__FinancialAccountTransaction__c` | `FinServ__TransactionType__c` (Debit = call, Credit = distribution), `FinServ__Amount__c`, `FinServ__TransactionDate__c`, `Reference_Code__c`, `Txn_Status__c` |
| **Fund Vehicle** | `Fund__c` (custom) | `Committed_Capital__c`, `Invested__c`, `Fund_Target_Amount__c`, `Fundraising_Pipeline__c`, `Fund_Type__c`, `Status__c`, `FINS_Vintage__c`, `Account__c` → Account |
| **Fundraising** | `Opportunity` | `Fund_Offering_Name__c`, `FINS_Private_Equity_Fund__c` → `Fund__c`, `Amount`, `StageName`, `Probability`, `CloseDate` |
| **Operational Workflows** | `Task` | Wire verifications, subscription sign-offs, onboarding steps |

### Custom fields created by this project

| Object | Field | Type |
|---|---|---|
| `FinServ__FinancialAccount__c` | `Total_Called_Capital__c` | Currency(18,2) |
| `FinServ__FinancialAccount__c` | `Total_Distributions__c` | Currency(18,2) |
| `FinServ__FinancialAccount__c` | `Current_NAV__c` | Currency(18,2) |
| `FinServ__FinancialAccountTransaction__c` | `Reference_Code__c` | Text(80) |
| `FinServ__FinancialAccountTransaction__c` | `Txn_Status__c` | Picklist (Pending / Settled / Failed) |
| `Opportunity` | `Fund_Offering_Name__c` | Text(120) |

> **Note:** In a real deployment the capital metric fields are typically **roll-up summaries or formulas** sourced from the transaction ledger. Here they are plain Currency fields so they are directly populable for demos and deploy without additional dependencies.

---

## PE Financial Logic

All performance multiples are expressed relative to **paid-in (called) capital**:

| Metric | Formula | Meaning |
|---|---|---|
| **Drawdown %** | `Called / Committed` | Portion of the commitment actually funded |
| **TVPI** (Total Value to Paid-In) | `(Distributions + NAV) / Called` | Total value created per dollar invested |
| **DPI** (Distributions to Paid-In) | `Distributions / Called` | Realized cash returned per dollar invested |
| **RVPI** (Residual Value to Paid-In) | `NAV / Called` | Unrealized residual value per dollar invested |

> `TVPI = DPI + RVPI`. All calculations guard against divide-by-zero and null values.

---

# Component 2 — Deal Relationship Board

`dealRelationshipBoard` is an **Actionable Relationship Center (ARC)-style** graph that visualizes the network of participants around a single PE deal. A central deal node fans out — via CSS connector lines (a vertical stem into a horizontal bus, with stems rising into each column) — to five role-based relationship groups.

```
                         ┌───────────────────────────────────┐
                         │ ⬡ *Census, Inc. // $22m // Series B │   ← central deal node
                         └─────────────────┬─────────────────┘
        ┌───────────────┬──────────────────┼──────────────────┬───────────────┐
   Co-Investors     Deal Team        Legal Counsel       Target PortCo    Intermediaries
     [FDP-0013]     [FDP-0014]        [FDP-0015]          [FDP-0016]        [FDP-0017]
```

### Features
- **Click-to-edit** — an **Edit** button flips the board into inline edit mode: type directly into the deal label, group names, card titles, and field labels/values; **add/remove cards and fields**; then **Save** to persist. Edits are stored as JSON on a `Deal_Relationship_Board__c` record keyed to the host record, so they survive refresh.
- **Toolbar** — a functional *"Show fields on cards"* toggle that expands/collapses the field section on every card, plus a zoom/fit/layout/refresh button cluster.
- **Central deal node** — a rounded pill with an icon and the deal label (configurable via the `dealName` property in App Builder).
- **Five relationship groups** — Co-Investors, Deal Team, Legal Counsel, Target PortCo, Intermediaries. Each group header has a colored role icon, label, live **count badge**, a **collapse chevron**, and (on Co-Investors) a **New** action button.
- **Participant cards** — each card shows a record title, a hierarchy icon, and (when the toggle is on) a set of labeled fields.
- **Connector graph** — pure CSS/HTML, no external charting library or static resources.

### Design notes
- **Data-driven:** the entire board is rendered from the `groups` array in `dealRelationshipBoard.js`. Each entry defines a role (`label`, `icon`, `color`), its `cards`, and per-card `fields`.
- **Persistence:** inline edits are saved by `DealRelationshipBoardController.saveBoardConfig` to a `Deal_Relationship_Board__c` record (one per host record, via the unique external-id `Host_Record_Id__c`), and reloaded by `getBoardConfig` on the next visit. The seed order is: **saved config → `groupsJson` property → built-in default board**.
- **Exposed** to `lightning__RecordPage`, `lightning__AppPage`, and `lightning__HomePage`. Editing/saving requires the board to be on a **record page** (it uses `recordId` as the save key); on app/home pages it stays read-only.

### Editing the board

1. Place the board on a **record page** (so it has a `recordId` to save against) and **Activate**.
2. Click **Edit** in the toolbar. The board becomes editable in place:
   - Edit the **deal label**, **group names**, **card titles**, and each field's **label / value**.
   - **+ Add** (group header) adds a card; the trash icon removes one.
   - **+ Add field** adds a field to a card; the ✕ removes one.
3. Click **Save** to persist, or **Cancel** to discard and reload the last saved state.

### Backing storage (`Deal_Relationship_Board__c`)

| Field | Type | Purpose |
|---|---|---|
| `Host_Record_Id__c` | Text(18), External Id, Unique | The host record's Id — one board per record |
| `Config_JSON__c` | Long Text Area (128 KB) | The serialized board config (deal node + groups/cards/fields) |

---

# Component 3 — Portfolio Market Intelligence

`portfolioIntelligence` **mocks an integration with a market-intelligence / intent-data platform** (6sense / ZoomInfo / Demandbase-style) for a PE deal team. It demonstrates the full integration UX — connect to a provider, sync, and review **scored target portfolio companies to reach out to** — without any real callout.

### Features
- **Provider selector + Connect** — choose a mock provider (6sense / ZoomInfo / Demandbase) and "authenticate"; a connection pill reflects status.
- **Sync** — a simulated async pull (mimicking API latency) returns a ranked feed of target companies, sorted by fit score, with a "Last sync" timestamp.
- **Summary strip** — target count, average fit score, and count of "surging" intent.
- **Target cards** — each company shows sector / location / revenue / headcount, a **fit-score bar** (color-graded), an **intent badge** (Surging / Strong / Moderate), detected **buying signals**, an AI-style **recommendation**, and the **key contact**.
- **Actions** — *Draft Outreach* and *Add to Pipeline* fire `draftoutreach` / `addtopipeline` custom events (and toast), ready for a parent/flow to handle.
- **Filtering** — a live search box plus a configurable **Minimum Fit Score** property.

### It's a mock — how to make it real
There is **no HTTP callout**; `runMockSync()` resolves a canned dataset after a `setTimeout`. To go live:
1. Create an Apex `@AuraEnabled` method that performs the callout (Named Credential → the provider's REST API) and returns the **same shape** (`{ id, company, sector, location, revenue, employees, fitScore, intent, signals[], recommendation, contact{} }`).
2. Replace the body of `runMockSync()` with a call to that method.
3. Wire *Add to Pipeline* to create a `Lead`/`Account` (or a target record) via Apex.

### Customization (App Builder)
| Property | Type | Default | Controls |
|---|---|---|---|
| **Card Title** (`cardTitle`) | Text | `Market Intelligence — Target Companies` | Component heading |
| **Minimum Fit Score** (`minFitScore`) | Integer | `0` | Hide targets below this score (0–100) |

---

## Repository Structure

```
pe-ir-capital-tracker/
├── README.md
├── sfdx-project.json
├── seed.apex                         # Seed commitments, ledger & pipeline opps
├── seed_funds.apex                   # Seed / complete fully-populated Fund__c records
├── link_opps.apex                    # Link Opportunities to Fund__c vehicles
└── force-app/main/default/
    ├── classes/
    │   ├── IRCapitalTrackerController.cls
    │   ├── IRCapitalTrackerController.cls-meta.xml
    │   ├── DealRelationshipBoardController.cls      # load/save board config
    │   └── DealRelationshipBoardController.cls-meta.xml
    ├── lwc/
    │   ├── irCapitalTracker/         # Component 1 — capital tracker
    │   │   ├── irCapitalTracker.html
    │   │   ├── irCapitalTracker.js
    │   │   ├── irCapitalTracker.css
    │   │   └── irCapitalTracker.js-meta.xml
    │   ├── dealRelationshipBoard/    # Component 2 — ARC-style deal board
    │   │   ├── dealRelationshipBoard.html
    │   │   ├── dealRelationshipBoard.js
    │   │   ├── dealRelationshipBoard.css
    │   │   └── dealRelationshipBoard.js-meta.xml
    │   └── portfolioIntelligence/    # Component 3 — mock market-intel integration
    │       ├── portfolioIntelligence.html
    │       ├── portfolioIntelligence.js
    │       ├── portfolioIntelligence.css
    │       └── portfolioIntelligence.js-meta.xml
    ├── objects/                      # Custom object + field metadata
    │   ├── FinServ__FinancialAccount__c/fields/
    │   ├── FinServ__FinancialAccountTransaction__c/fields/
    │   ├── Opportunity/fields/
    │   └── Deal_Relationship_Board__c/   # stores saved board configs (JSON)
    │       └── fields/
    └── profiles/
        └── Admin.profile-meta.xml    # FLS for the System Administrator profile
```

---

## Prerequisites

- **Salesforce CLI (`sf`)** v2 — [install guide](https://developer.salesforce.com/tools/salesforcecli)
- A Salesforce org with **Financial Services Cloud** installed (the `FinServ__*` objects and the `InvestmentAccount` record type must exist).
- A user with the **System Administrator** profile (or adjust the profile/permission set accordingly).

---

## Deployment

1. **Authorize your org:**
   ```bash
   sf org login web --alias myorg --set-default
   ```

2. **Validate first (recommended):**
   ```bash
   sf project deploy start --target-org myorg --dry-run
   ```

3. **Deploy:**
   ```bash
   sf project deploy start --target-org myorg
   ```

This deploys both LWC bundles, the Apex controller, and all six custom fields in a single transaction. To deploy only the standalone board (no Apex/fields needed):

```bash
sf project deploy start --target-org myorg --metadata "LightningComponentBundle:dealRelationshipBoard"
```

---

## Field-Level Security

The custom fields deploy without FLS. To grant the **System Administrator** profile read/edit access (already included in this repo):

```bash
sf project deploy start --target-org myorg --metadata "Profile:Admin"
```

To grant other users access, either add the fields to their permission set or extend `profiles/Admin.profile-meta.xml` for their profile.

---

## Seeding Demo Data

`seed.apex` creates three active fund commitments, a ledger of capital calls/distributions, and four pipeline opportunities for a target Account.

1. Edit the top of `seed.apex` and set `acctId` (and `rtId` if your `InvestmentAccount` record type Id differs):
   ```apex
   Id acctId = '001XXXXXXXXXXXXXXX'; // your LP Account
   Id rtId   = '012XXXXXXXXXXXXXXX'; // InvestmentAccount record type
   ```
   Find them with:
   ```bash
   sf data query --query "SELECT Id, Name FROM Account WHERE Name='OPERS'" --target-org myorg
   sf data query --query "SELECT Id FROM RecordType WHERE SobjectType='FinServ__FinancialAccount__c' AND DeveloperName='InvestmentAccount'" --target-org myorg
   ```

2. Run it:
   ```bash
   sf apex run --file seed.apex --target-org myorg
   ```

### Sample dataset (combined)
- **Capital Committed:** $325M
- **Capital Called:** ~$198M (~61% drawdown)
- **Distributions:** $81M
- **TVPI ≈ 1.36x · DPI ≈ 0.41x · RVPI ≈ 0.95x**

---

## Adding the Components to a Page

### IR Capital & Pipeline Tracker
1. Open any **Account** record.
2. Click the gear ⚙️ → **Edit Page**.
3. Drag **"IR Capital & Pipeline Tracker"** from the custom components onto the canvas (or into a new tab).
4. **Save** and **Activate** the page.

The component is restricted to `lightning__RecordPage` on the **Account** object via its `*.js-meta.xml`.

### Deal Relationship Board
1. Open any record / app / home page → ⚙️ → **Edit Page**.
2. Drag **"Deal Relationship Board"** onto the canvas.
3. In the property panel, customize it (see [Customizing the Deal Relationship Board](#customizing-the-deal-relationship-board)).
4. **Save** and **Activate**.

---

## Component Reference

### `IRCapitalTrackerController.cls`
`with sharing` Apex controller.

| Method | Cacheable | Purpose |
|---|---|---|
| `getCapitalSnapshot(accountId)` | ✅ | Returns active commitments + their ledger transactions in one round trip |
| `getPipeline(accountId)` | ✅ | Returns related opportunities (with their linked `Fund__c` name) for the Kanban board + datatable |
| `getFunds(accountId)` | ✅ | Returns the linked `Fund__c` vehicles with related-opportunity rollups for the Fund Vehicles tab |
| `finalizeOpportunitySubscription(opportunityId)` | ❌ (DML) | Sets the Opportunity to Closed Won and creates a new `InvestmentAccount` commitment for the subscribed amount, wrapped in a savepoint/rollback |

All SOQL uses `WITH SECURITY_ENFORCED`; numeric values are null-coalesced to `0`; errors surface as `AuraHandledException`.

### `irCapitalTracker` (LWC)
- `@wire` to all three cacheable Apex methods.
- A single reactive `metrics` getter drives all KPIs, the gauge `stroke-dashoffset`, and the multiples — they recompute on filter change or data refresh.
- `refreshApex()` repaints datasets after an activation.
- Toast notifications via `ShowToastEvent`.

### `dealRelationshipBoard` (LWC)
- Renders from the `groups` array, seeded by a saved config, the `groupsJson` property, or `DEFAULT_GROUPS` (in that order).
- **Inline edit + save** via `DealRelationshipBoardController` — see [Editing the board](#editing-the-board).
- Eight App Builder properties make the deal label, icon, accent color, layout, toolbar, and toggle fully configurable without code (see [Customizing the Deal Relationship Board](#customizing-the-deal-relationship-board)).
- Collapsible groups, a field-visibility toggle, and a `newrecord` custom event on the **New** button (when not editing).
- Connector graph is pure CSS/HTML — no charting library or static resources.

### `DealRelationshipBoardController.cls`
`with sharing` Apex controller for board persistence.

| Method | Cacheable | Purpose |
|---|---|---|
| `getBoardConfig(hostRecordId)` | ✅ | Returns the saved `Config_JSON__c` for the host record (or null) |
| `saveBoardConfig(hostRecordId, configJson)` | ❌ (DML) | Validates the JSON and upserts the board config on the unique `Host_Record_Id__c` external id |

---

## Customization Notes

- **Kanban bucketing:** opportunities are grouped into columns by keyword-matching `StageName` (e.g. *Negotiation*, *Closing*, *Legal*, *Subscription* → Legal/Subscription Review). Adjust the `isProspecting` / `isLegal` helpers in `irCapitalTracker.js` to match your stage names.
- **Activation stage:** `finalizeOpportunitySubscription` sets `StageName = 'Closed Won'`. Change this if your org uses a different won stage (e.g. *Closed - Funded*).
- **Metric fields as roll-ups:** to make the capital metrics live, replace the Currency fields with roll-up summaries / formulas over `FinServ__FinancialAccountTransaction__c`.

### Customizing the Deal Relationship Board

The board is **fully customizable from Lightning App Builder** — no code changes required. Drop it on a page and edit these properties in the right-hand panel:

| Property | Type | Default | What it controls |
|---|---|---|---|
| **Deal Node Label** (`dealName`) | Text | `*Census, Inc. // $22m // Series B` | The text in the central node |
| **Deal Node Icon** (`dealIcon`) | Text | `standard:opportunity` | Any [SLDS icon](https://www.lightningdesignsystem.com/icons/) name |
| **Accent Color** (`accentColor`) | Text | `#0176d3` | Deal-icon background + card top borders (any CSS color/hex) |
| **Columns Per Row** (`columnsPerRow`) | Integer | `5` | Groups per row before wrapping (1–8) |
| **Show Fields By Default** (`showFieldsByDefault`) | Checkbox | ✅ | Initial toggle state |
| **Start Groups Collapsed** (`startCollapsed`) | Checkbox | ☐ | Collapse all groups on load |
| **Hide Fields Toggle** (`hideToggle`) | Checkbox | ☐ | Remove the toggle |
| **Hide Toolbar** (`hideToolbar`) | Checkbox | ☐ | Remove the whole top toolbar |
| **Groups (JSON)** (`groupsJson`) | Text | *(blank → default board)* | Completely redefine the board (see below) |

#### Redefining the board with `groupsJson`

Paste a JSON array into the **Groups (JSON)** property to change the columns, icons, colors, cards, and fields entirely. Invalid JSON safely falls back to the default board.

```json
[
  {
    "key": "co-investors",
    "label": "Co-Investors",
    "icon": "standard:partners",
    "color": "#0176d3",
    "showNew": true,
    "collapsed": false,
    "cards": [
      {
        "id": "FDP-0013",
        "title": "FDP-0013",
        "fields": [
          { "label": "Role", "value": "Lead Co-Investor" },
          { "label": "Commitment", "value": "$8.0M" }
        ]
      }
    ]
  }
]
```

**Schema:**

| Key | Level | Required | Notes |
|---|---|---|---|
| `key` | group | recommended | Unique id; auto-generated if omitted |
| `label` | group | yes | Column header text |
| `icon` | group | no | SLDS icon name (default `standard:default`) |
| `color` | group | no | Header-icon + card-border color (defaults to the accent color) |
| `showNew` | group | no | Shows a **New** button on the header |
| `collapsed` | group | no | Start this group collapsed |
| `cards` | group | no | Array of cards |
| `id` / `title` | card | recommended | Card identifier / heading |
| `fields` | card | no | Array of `{ label, value }` shown when the toggle is on |

> **Going live:** to drive the board from real records, replace the `DEFAULT_GROUPS`/`groupsJson` source with an `@wire` to an Apex method that returns the same shape (e.g. from a `Deal_Relationship__c` junction). The **New** button already fires a `newrecord` custom event with the group key for a parent/flow to handle.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| KPIs show `$0` after deploy | Confirm FLS (deploy the `Admin` profile), seed data, and hard-refresh the browser to clear the cached Apex response |
| `Illegal assignment from Datetime to Date` | `FinServ__TransactionDate__c` is a Datetime — the DTO and datatable column types account for this |
| `Unable to find Apex action class` | The LWC error cascades from an Apex compile failure — fix the Apex error first |
| Seed Apex fails on `StageName` | Your org uses a custom stage picklist — set the stages in `seed.apex` to valid values |

---

## License

Provided as-is for demonstration and educational purposes.
