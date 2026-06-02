# PE IR Capital & Pipeline Tracker

A production-grade **Lightning Web Component (LWC)** for a Private Equity (PE) firm's **Investor Relations (IR)** team, built on **Salesforce Financial Services Cloud (FSC)**.

It sits on an institutional **Limited Partner (LP)** Account record page and visualizes capital commitments, called/uncalled capital, distributions, PE performance multiples, the capital-call/distribution ledger, and the active fundraising pipeline — with a one-click flow to convert a won opportunity into a funded commitment.

![Tab 1 — Capital Performance & Ledger](docs/screenshot-capital.png)

---

## Table of Contents

- [Features](#features)
- [Architecture & Data Model](#architecture--data-model)
- [PE Financial Logic](#pe-financial-logic)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Deployment](#deployment)
- [Field-Level Security](#field-level-security)
- [Seeding Demo Data](#seeding-demo-data)
- [Adding the Component to a Page](#adding-the-component-to-a-page)
- [Component Reference](#component-reference)
- [Customization Notes](#customization-notes)
- [Troubleshooting](#troubleshooting)

---

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
    │   └── IRCapitalTrackerController.cls-meta.xml
    ├── lwc/irCapitalTracker/
    │   ├── irCapitalTracker.html
    │   ├── irCapitalTracker.js
    │   ├── irCapitalTracker.css
    │   └── irCapitalTracker.js-meta.xml
    ├── objects/                      # Custom field metadata
    │   ├── FinServ__FinancialAccount__c/fields/
    │   ├── FinServ__FinancialAccountTransaction__c/fields/
    │   └── Opportunity/fields/
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

This deploys the Apex controller, the LWC bundle, and all six custom fields in a single transaction.

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

## Adding the Component to a Page

1. Open any **Account** record.
2. Click the gear ⚙️ → **Edit Page**.
3. Drag **"IR Capital & Pipeline Tracker"** from the custom components onto the canvas (or into a new tab).
4. **Save** and **Activate** the page.

The component is restricted to `lightning__RecordPage` on the **Account** object via its `*.js-meta.xml`.

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
- `@wire` to both cacheable Apex methods.
- A single reactive `metrics` getter drives all KPIs, the gauge `stroke-dashoffset`, and the multiples — they recompute on filter change or data refresh.
- `refreshApex()` repaints both datasets after an activation.
- Toast notifications via `ShowToastEvent`.

---

## Customization Notes

- **Kanban bucketing:** opportunities are grouped into columns by keyword-matching `StageName` (e.g. *Negotiation*, *Closing*, *Legal*, *Subscription* → Legal/Subscription Review). Adjust the `isProspecting` / `isLegal` helpers in `irCapitalTracker.js` to match your stage names.
- **Activation stage:** `finalizeOpportunitySubscription` sets `StageName = 'Closed Won'`. Change this if your org uses a different won stage (e.g. *Closed - Funded*).
- **Metric fields as roll-ups:** to make the capital metrics live, replace the Currency fields with roll-up summaries / formulas over `FinServ__FinancialAccountTransaction__c`.

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
