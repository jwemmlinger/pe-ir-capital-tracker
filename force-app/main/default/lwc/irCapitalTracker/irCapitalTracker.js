/**
 * irCapitalTracker
 * ---------------------------------------------------------------------------
 * Investor Relations capital & pipeline tracker for an institutional LP, hosted
 * on the Account record page of a Private Equity firm.
 *
 * Tab 1 (Capital Performance & Ledger):
 *   - Fund Filter combobox ("All Combined" vs. a single commitment)
 *   - Radial SVG drawdown gauge (called vs. uncalled capital)
 *   - KPI cards (Committed / Called / Uncalled / Distributions)
 *   - PE performance multiples (TVPI / DPI / RVPI)
 *   - Ledger datatable (FinServ__FinancialAccountTransaction__c)
 *
 * Tab 2 (Fundraising Pipeline):
 *   - Kanban board grouping Opportunities into 3 PE-aligned columns
 *   - Pipeline datatable
 *   - "Activate Commitment" action -> finalizeOpportunitySubscription (DML)
 *
 * Performance: read data is pulled with cacheable @wire; the write path calls
 * refreshApex() to repaint metrics without a full reload.
 * ---------------------------------------------------------------------------
 */
import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getCapitalSnapshot from '@salesforce/apex/IRCapitalTrackerController.getCapitalSnapshot';
import getPipeline from '@salesforce/apex/IRCapitalTrackerController.getPipeline';
import getFunds from '@salesforce/apex/IRCapitalTrackerController.getFunds';
import finalizeOpportunitySubscription from '@salesforce/apex/IRCapitalTrackerController.finalizeOpportunitySubscription';

// Sentinel value for the "All Combined Commitments" combobox option.
const ALL_SCOPE = 'ALL';

// Geometry for the radial SVG gauge. r=54 within a 120x120 viewBox leaves room
// for the stroke. Circumference = 2 * PI * r is the full dash length.
const GAUGE_RADIUS = 54;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

// Column definitions for the ledger transactions datatable (Tab 1).
const TXN_COLUMNS = [
    { label: 'Date', fieldName: 'txnDate', type: 'date', initialWidth: 150 },
    { label: 'Type', fieldName: 'txnType', type: 'text' },
    {
        label: 'Amount',
        fieldName: 'amount',
        type: 'currency',
        cellAttributes: { alignment: 'right' }
    },
    { label: 'Reference Code', fieldName: 'referenceCode', type: 'text' },
    { label: 'Status', fieldName: 'status', type: 'text' }
];

// Column definitions for the pipeline datatable (Tab 2). The row action lets an
// IR user activate (Close Won) an opportunity directly from the table.
const PIPELINE_COLUMNS = [
    { label: 'Opportunity', fieldName: 'name', type: 'text' },
    { label: 'Linked Fund', fieldName: 'fundName', type: 'text' },
    { label: 'Fund Offering', fieldName: 'fundOffering', type: 'text' },
    {
        label: 'Amount',
        fieldName: 'amount',
        type: 'currency',
        cellAttributes: { alignment: 'right' }
    },
    { label: 'Stage', fieldName: 'stageName', type: 'text' },
    {
        label: 'Probability',
        fieldName: 'probability',
        type: 'percent',
        typeAttributes: { maximumFractionDigits: 0 },
        cellAttributes: { alignment: 'right' }
    },
    { label: 'Expected Close', fieldName: 'closeDate', type: 'date-local' },
    {
        type: 'action',
        typeAttributes: {
            rowActions: [{ label: 'Activate Commitment', name: 'activate' }]
        }
    }
];

export default class IrCapitalTracker extends LightningElement {
    /** Account Id injected by the Lightning record page. */
    @api recordId;

    // ---- Reactive state -----------------------------------------------------
    @track selectedFundId = ALL_SCOPE;
    isWorking = false; // drives the spinner during the activation DML

    // Raw payloads from Apex.
    commitments = [];
    transactions = [];
    pipeline = [];
    funds = [];

    // Cached wired results so refreshApex() can re-pull after a write.
    wiredSnapshot;
    wiredPipeline;
    wiredFunds;

    // Static column configs exposed to the template.
    txnColumns = TXN_COLUMNS;
    pipelineColumns = PIPELINE_COLUMNS;

    /* =====================================================================
     *  WIRED DATA
     * ===================================================================== */

    @wire(getCapitalSnapshot, { accountId: '$recordId' })
    wiredCapital(result) {
        this.wiredSnapshot = result; // retain provisioned value for refreshApex
        const { data, error } = result;
        if (data) {
            this.commitments = data.commitments || [];
            this.transactions = data.transactions || [];
        } else if (error) {
            this.commitments = [];
            this.transactions = [];
            this.showToast('Error loading capital data', this.reduceError(error), 'error');
        }
    }

    @wire(getPipeline, { accountId: '$recordId' })
    wiredPipelineData(result) {
        this.wiredPipeline = result;
        const { data, error } = result;
        if (data) {
            this.pipeline = data;
        } else if (error) {
            this.pipeline = [];
            this.showToast('Error loading pipeline', this.reduceError(error), 'error');
        }
    }

    @wire(getFunds, { accountId: '$recordId' })
    wiredFundsData(result) {
        this.wiredFunds = result;
        const { data, error } = result;
        if (data) {
            // Decorate each fund with derived display helpers (badge theme,
            // formatted % strings) so the template stays declarative.
            this.funds = data.map((f) => ({
                ...f,
                raisedPctLabel: `${(f.raisedPct || 0).toFixed(0)}%`,
                raisedBarStyle: `width: ${Math.min(f.raisedPct || 0, 100)}%;`,
                statusBadgeClass: `slds-badge ${this.fundStatusTheme(f.status)}`,
                isOpen: f.fundraisingStatus === 'Accepting New Capital',
                hasRelatedOpps: (f.relatedOpps || []).length > 0,
                // Decorate each related opp with a formatted probability label
                // for the in-card list.
                relatedOpps: (f.relatedOpps || []).map((o) => ({
                    ...o,
                    probabilityLabel: `${Math.round(o.probability || 0)}%`
                }))
            }));
        } else if (error) {
            this.funds = [];
            this.showToast('Error loading fund vehicles', this.reduceError(error), 'error');
        }
    }

    /** Map a fund lifecycle status to an SLDS badge theme class. */
    fundStatusTheme(status) {
        switch (status) {
            case 'Investing':
                return 'slds-theme_success';
            case 'Fundraise in Progress':
            case 'Inception':
                return 'slds-theme_warning';
            case 'Liquidating':
            case 'Closed':
                return 'slds-badge_inverse';
            default:
                return '';
        }
    }

    get hasFunds() {
        return this.funds.length > 0;
    }

    /* =====================================================================
     *  FUND FILTER (combobox)
     * ===================================================================== */

    /** Options = "All Combined Commitments" + one entry per active commitment. */
    get fundOptions() {
        const options = [{ label: 'All Combined Commitments', value: ALL_SCOPE }];
        this.commitments.forEach((c) => {
            options.push({ label: c.name, value: c.id });
        });
        return options;
    }

    handleFundChange(event) {
        this.selectedFundId = event.detail.value;
    }

    get isAllScope() {
        return this.selectedFundId === ALL_SCOPE;
    }

    /* =====================================================================
     *  SCOPED AGGREGATION
     *  All KPI / multiple / gauge math derives from a single `metrics` getter so
     *  everything recalculates reactively whenever the combobox or wired data
     *  changes. "All" sums every commitment; otherwise we use the one selected.
     * ===================================================================== */

    get scopedCommitments() {
        if (this.isAllScope) {
            return this.commitments;
        }
        return this.commitments.filter((c) => c.id === this.selectedFundId);
    }

    get metrics() {
        let committed = 0;
        let called = 0;
        let distributions = 0;
        let nav = 0;

        this.scopedCommitments.forEach((c) => {
            committed += c.committed || 0;
            called += c.called || 0;
            distributions += c.distributions || 0;
            nav += c.nav || 0;
        });

        const uncalled = Math.max(committed - called, 0);

        // Drawdown % = paid-in / committed. Guard against divide-by-zero.
        const calledPct = committed > 0 ? (called / committed) * 100 : 0;

        // PE performance multiples are all relative to paid-in (called) capital.
        // TVPI = (Distributions + NAV) / Called   -> total value created
        // DPI  = Distributions / Called           -> realized cash returned
        // RVPI = NAV / Called                      -> unrealized residual value
        const tvpi = called > 0 ? (distributions + nav) / called : 0;
        const dpi = called > 0 ? distributions / called : 0;
        const rvpi = called > 0 ? nav / called : 0;

        return {
            committed,
            called,
            uncalled,
            distributions,
            nav,
            calledPct,
            tvpi,
            dpi,
            rvpi
        };
    }

    /* ---- KPI display getters (currency/percent formatted in template) ---- */

    get committedCapital() {
        return this.metrics.committed;
    }
    get calledCapital() {
        return this.metrics.called;
    }
    get uncalledCapital() {
        return this.metrics.uncalled;
    }
    get distributionsTotal() {
        return this.metrics.distributions;
    }
    get calledPercentLabel() {
        return `${this.metrics.calledPct.toFixed(1)}% called`;
    }

    /* ---- PE multiples, formatted as "1.85x" ---- */
    get tvpiLabel() {
        return `${this.metrics.tvpi.toFixed(2)}x`;
    }
    get dpiLabel() {
        return `${this.metrics.dpi.toFixed(2)}x`;
    }
    get rvpiLabel() {
        return `${this.metrics.rvpi.toFixed(2)}x`;
    }

    /* =====================================================================
     *  RADIAL SVG GAUGE
     *  We draw a background ring + a foreground ring whose stroke-dashoffset is
     *  shortened proportionally to the called %. Less offset = more arc shown.
     * ===================================================================== */

    get gaugeRadius() {
        return GAUGE_RADIUS;
    }
    get gaugeCircumference() {
        return GAUGE_CIRCUMFERENCE;
    }

    /** stroke-dashoffset for the progress arc (clamped 0–100%). */
    get gaugeDashOffset() {
        const pct = Math.min(Math.max(this.metrics.calledPct, 0), 100);
        return GAUGE_CIRCUMFERENCE * (1 - pct / 100);
    }

    /** Center label of the gauge, e.g. "62%". */
    get gaugePercentLabel() {
        return `${Math.round(this.metrics.calledPct)}%`;
    }

    /* =====================================================================
     *  LEDGER (Tab 1 datatable) — scoped to the selected fund
     * ===================================================================== */

    get scopedTransactions() {
        if (this.isAllScope) {
            return this.transactions;
        }
        return this.transactions.filter((t) => t.financialAccountId === this.selectedFundId);
    }

    get hasTransactions() {
        return this.scopedTransactions.length > 0;
    }

    /* =====================================================================
     *  PIPELINE / KANBAN (Tab 2)
     *  Three PE-aligned columns. Standard stage names are bucketed; "Closed Won"
     *  represents an activated commitment.
     * ===================================================================== */

    get prospectingColumn() {
        return this.pipeline.filter((o) => !o.isClosed && this.isProspecting(o.stageName));
    }
    get legalColumn() {
        return this.pipeline.filter((o) => !o.isClosed && this.isLegal(o.stageName));
    }
    get closedWonColumn() {
        return this.pipeline.filter((o) => o.isWon);
    }

    isProspecting(stage) {
        const s = (stage || '').toLowerCase();
        return s.includes('prospect') || s.includes('qualif') || s.includes('diligence') || s.includes('discover');
    }
    isLegal(stage) {
        const s = (stage || '').toLowerCase();
        return (
            s.includes('legal') ||
            s.includes('subscription') ||
            s.includes('document') ||
            s.includes('negoti') ||
            s.includes('proposal') ||
            s.includes('review')
        );
    }

    get hasPipeline() {
        return this.pipeline.length > 0;
    }

    /* =====================================================================
     *  ACTIVATION (write) — Closed Won + create commitment
     * ===================================================================== */

    /** Datatable row action handler. */
    handleRowAction(event) {
        const action = event.detail.action.name;
        const row = event.detail.row;
        if (action === 'activate') {
            this.activateCommitment(row.id);
        }
    }

    /** Kanban card button handler. */
    handleActivateClick(event) {
        const oppId = event.target.dataset.id;
        this.activateCommitment(oppId);
    }

    async activateCommitment(opportunityId) {
        if (!opportunityId) {
            return;
        }
        this.isWorking = true;
        try {
            const newCommitmentId = await finalizeOpportunitySubscription({
                opportunityId
            });
            this.showToast(
                'Commitment Activated',
                'Opportunity closed won and a new FSC commitment was created (' +
                    newCommitmentId +
                    ').',
                'success'
            );
            // Repaint both datasets: pipeline (stage moved) and capital (new fund).
            await Promise.all([
                refreshApex(this.wiredPipeline),
                refreshApex(this.wiredSnapshot)
            ]);
        } catch (error) {
            this.showToast('Activation Failed', this.reduceError(error), 'error');
        } finally {
            this.isWorking = false;
        }
    }

    /* =====================================================================
     *  UTILITIES
     * ===================================================================== */

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }

    /** Flattens an Apex/LDS error into a readable string. */
    reduceError(error) {
        if (Array.isArray(error?.body)) {
            return error.body.map((e) => e.message).join(', ');
        }
        if (error?.body?.message) {
            return error.body.message;
        }
        if (typeof error?.message === 'string') {
            return error.message;
        }
        return 'An unexpected error occurred.';
    }
}
