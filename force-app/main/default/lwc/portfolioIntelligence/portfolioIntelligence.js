/**
 * portfolioIntelligence
 * ---------------------------------------------------------------------------
 * A MOCK integration with a Marketing / Market-Intelligence platform (think
 * 6sense / ZoomInfo / Demandbase-style intent data) for a Private Equity deal
 * team. It surfaces targeted portfolio companies to reach out to, each scored
 * for fit and intent, with detected buying signals and a suggested next action.
 *
 * This is a demo/scaffold: there is NO real callout. A simulated async "sync"
 * (setTimeout) mimics the latency of an external API so the UI behaves like a
 * live integration. To make it real, swap `runMockSync()` for an Apex
 * @AuraEnabled method that performs the HTTP callout and returns the same
 * shape (see the README).
 * ---------------------------------------------------------------------------
 */
import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createAccount from '@salesforce/apex/PortfolioIntelligenceController.createAccount';
import addToPipeline from '@salesforce/apex/PortfolioIntelligenceController.addToPipeline';
import draftOutreach from '@salesforce/apex/PortfolioIntelligenceController.draftOutreach';

// Simulated provider catalog so the "Connect" step feels real.
const PROVIDERS = [
    { label: 'Crunchbase', value: 'crunchbase' },
    { label: 'QuickBooks', value: 'quickbooks' }
];

// Mock universe of intelligence records the "platform" returns on sync.
const MOCK_TARGETS = [
    {
        id: 'PC-2041',
        company: 'Northwind Logistics',
        sector: 'Supply Chain SaaS',
        location: 'Austin, TX',
        revenue: '$48M ARR',
        employees: 320,
        fitScore: 92,
        intent: 'Surging',
        signals: ['Hiring 12 RevOps roles', 'Visited pricing page 14x', 'Researching "logistics automation"'],
        recommendation: 'Warm intro via shared board member; lead with platform-consolidation thesis.',
        website: 'www.northwind.example',
        contact: { name: 'Dana Mercer', title: 'CFO', email: 'dmercer@northwind.example' }
    },
    {
        id: 'PC-2042',
        company: 'Helix Diagnostics',
        sector: 'Healthtech',
        location: 'Boston, MA',
        revenue: '$31M ARR',
        employees: 210,
        fitScore: 88,
        intent: 'Strong',
        signals: ['New CFO hire (ex-PE portco)', 'Downloaded M&A whitepaper', 'Funding round rumored'],
        recommendation: 'Reach out pre-emptively before round closes; position as growth-equity partner.',
        website: 'www.helixdx.example',
        contact: { name: 'Arjun Patel', title: 'CEO', email: 'apatel@helixdx.example' }
    },
    {
        id: 'PC-2043',
        company: 'Cobalt Energy Systems',
        sector: 'Climate / Energy',
        location: 'Denver, CO',
        revenue: '$67M ARR',
        employees: 540,
        fitScore: 81,
        intent: 'Moderate',
        signals: ['Expanding into EU', 'Competitor acquired last quarter'],
        recommendation: 'Nurture; share infrastructure-fund case studies and re-engage in 30 days.',
        website: 'www.cobaltsys.example',
        contact: { name: 'Lena Ortiz', title: 'VP Corp Dev', email: 'lortiz@cobaltsys.example' }
    },
    {
        id: 'PC-2044',
        company: 'Brightloom Retail',
        sector: 'Commerce / Retail Tech',
        location: 'Chicago, IL',
        revenue: '$22M ARR',
        employees: 140,
        fitScore: 76,
        intent: 'Moderate',
        signals: ['Margin compression in filings', 'Exploring strategic alternatives'],
        recommendation: 'Turnaround candidate; route to operations-focused deal team.',
        website: 'www.brightloom.example',
        contact: { name: 'Sam Whitfield', title: 'COO', email: 'swhitfield@brightloom.example' }
    },
    {
        id: 'PC-2045',
        company: 'Veridian Analytics',
        sector: 'Data Infrastructure',
        location: 'Seattle, WA',
        revenue: '$54M ARR',
        employees: 410,
        fitScore: 95,
        intent: 'Surging',
        signals: ['CEO posted "open to inbound"', 'Usage up 40% QoQ', 'Two co-investors circling'],
        recommendation: 'Top priority — move fast; competitive process likely forming.',
        website: 'www.veridian.example',
        contact: { name: 'Priya Nair', title: 'Founder & CEO', email: 'pnair@veridian.example' }
    }
];

export default class PortfolioIntelligence extends NavigationMixin(LightningElement) {
    /** Host record (Account/Opportunity/FinancialDeal) — for future wiring. */
    @api recordId;

    /** Card title (configurable in App Builder). */
    @api cardTitle = 'Market Intelligence — Target Companies';

    /** Minimum fit score to include (configurable). */
    @api minFitScore = 0;

    // ---- Reactive state ----
    @track provider = 'crunchbase';
    @track isConnected = false;
    @track isSyncing = false;
    @track isWorking = false;
    @track lastSync;
    @track targets = [];
    @track searchTerm = '';

    providerOptions = PROVIDERS;
    _timer;

    disconnectedCallback() {
        // Clean up any pending simulated-sync timer.
        if (this._timer) {
            clearTimeout(this._timer);
        }
    }

    // ===================== Derived getters =====================

    get providerLabel() {
        const p = PROVIDERS.find((x) => x.value === this.provider);
        return p ? p.label : this.provider;
    }

    get connectionStatusLabel() {
        return this.isConnected ? 'Connected' : 'Not connected';
    }

    get connectionPillClass() {
        return this.isConnected
            ? 'pi-pill pi-pill_connected'
            : 'pi-pill pi-pill_disconnected';
    }

    get syncButtonLabel() {
        return this.targets.length ? 'Re-sync' : 'Sync Targets';
    }

    get hasTargets() {
        return this.filteredTargets.length > 0;
    }

    get lastSyncLabel() {
        return this.lastSync ? `Last sync: ${this.lastSync}` : '';
    }

    /** Targets filtered by min fit score + search term, decorated for display. */
    get filteredTargets() {
        const term = (this.searchTerm || '').toLowerCase();
        return this.targets
            .filter((t) => t.fitScore >= (Number(this.minFitScore) || 0))
            .filter(
                (t) =>
                    !term ||
                    t.company.toLowerCase().includes(term) ||
                    t.sector.toLowerCase().includes(term)
            )
            .map((t) => ({
                ...t,
                scoreClass: this.scoreClass(t.fitScore),
                scoreBarStyle: `width:${t.fitScore}%;`,
                intentClass: this.intentClass(t.intent)
            }));
    }

    /** Headline metrics for the summary strip. */
    get summary() {
        const list = this.filteredTargets;
        const count = list.length;
        const avg = count
            ? Math.round(list.reduce((s, t) => s + t.fitScore, 0) / count)
            : 0;
        const surging = list.filter((t) => t.intent === 'Surging').length;
        return { count, avg, surging };
    }

    // ===================== Style helpers =====================

    scoreClass(score) {
        if (score >= 90) return 'pi-score pi-score_high';
        if (score >= 80) return 'pi-score pi-score_mid';
        return 'pi-score pi-score_low';
    }

    intentClass(intent) {
        switch (intent) {
            case 'Surging':
                return 'pi-intent pi-intent_surging';
            case 'Strong':
                return 'pi-intent pi-intent_strong';
            default:
                return 'pi-intent pi-intent_moderate';
        }
    }

    // ===================== Handlers =====================

    handleProviderChange(event) {
        this.provider = event.detail.value;
        // Switching providers drops the connection (like a real integration).
        this.isConnected = false;
        this.targets = [];
    }

    handleConnect() {
        this.isConnected = true;
        this.toast(
            'Connected',
            `Authenticated with ${this.providerLabel} (mock).`,
            'success'
        );
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    /** Simulate an async sync against the external intelligence platform. */
    handleSync() {
        if (!this.isConnected) {
            this.toast('Connect first', 'Connect to a provider before syncing.', 'warning');
            return;
        }
        this.isSyncing = true;
        this.runMockSync()
            .then((rows) => {
                // Sort by fit score desc, like a real intent feed.
                this.targets = [...rows].sort((a, b) => b.fitScore - a.fitScore);
                this.lastSync = this.nowLabel();
                this.toast(
                    'Sync complete',
                    `${this.targets.length} target companies retrieved from ${this.providerLabel}.`,
                    'success'
                );
            })
            .finally(() => {
                this.isSyncing = false;
            });
    }

    /**
     * Mock "API call". Returns the canned dataset after a short delay to mimic
     * network latency. Replace with an Apex callout to go live.
     */
    runMockSync() {
        return new Promise((resolve) => {
            this._timer = setTimeout(() => resolve(MOCK_TARGETS), 1100);
        });
    }

    /** Build the Apex TargetInput payload from a mock target row. */
    toTargetInput(target) {
        return {
            company: target.company,
            sector: target.sector,
            location: target.location,
            revenue: target.revenue,
            employees: target.employees,
            website: target.website,
            intent: target.intent,
            fitScore: target.fitScore,
            recommendation: target.recommendation,
            contactName: target.contact ? target.contact.name : null,
            contactEmail: target.contact ? target.contact.email : null
        };
    }

    findTarget(event) {
        const id = event.currentTarget.dataset.id;
        return this.targets.find((t) => t.id === id);
    }

    /** Click into a card -> create an Account for the company and open it. */
    async handleCardClick(event) {
        // Ignore clicks that originate from the action buttons.
        if (event.target.closest('lightning-button')) {
            return;
        }
        const target = this.findTarget(event);
        if (!target) {
            return;
        }
        this.isWorking = true;
        try {
            const res = await createAccount({ target: this.toTargetInput(target) });
            this.toast('Account created', `${target.company} created as an Account.`, 'success');
            this.navigateToRecord(res.accountId, 'Account');
        } catch (error) {
            this.toast('Could not create Account', this.reduceError(error), 'error');
        } finally {
            this.isWorking = false;
        }
    }

    /** Add to Pipeline -> create Account + FinancialDeal, open the deal. */
    async handleAddToPipeline(event) {
        const target = this.findTarget(event);
        if (!target) {
            return;
        }
        this.isWorking = true;
        try {
            const res = await addToPipeline({ target: this.toTargetInput(target) });
            this.toast(
                'Added to pipeline',
                `${target.company}: Account + Financial Deal created.`,
                'success'
            );
            this.dispatchEvent(new CustomEvent('addtopipeline', { detail: { target, ...res } }));
            this.navigateToRecord(res.dealId, 'FinancialDeal');
        } catch (error) {
            this.toast('Could not add to pipeline', this.reduceError(error), 'error');
        } finally {
            this.isWorking = false;
        }
    }

    /**
     * Draft Outreach -> create Account + FinancialDeal, navigate to the deal,
     * and trigger its global Email action so the composer opens.
     */
    async handleDraftOutreach(event) {
        const target = this.findTarget(event);
        if (!target) {
            return;
        }
        this.isWorking = true;
        try {
            const res = await draftOutreach({ target: this.toTargetInput(target) });
            this.toast(
                'Outreach started',
                `${target.company}: Account + Financial Deal created. Opening email…`,
                'success'
            );
            this.dispatchEvent(new CustomEvent('draftoutreach', { detail: { target, ...res } }));
            // Navigate to the deal and invoke the standard Email quick action.
            this.navigateToEmail(res.dealId);
        } catch (error) {
            this.toast('Could not draft outreach', this.reduceError(error), 'error');
        } finally {
            this.isWorking = false;
        }
    }

    // ===================== Navigation =====================

    navigateToRecord(recordId, objectApiName) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId, objectApiName, actionName: 'view' }
        });
    }

    /**
     * Navigate to the FinancialDeal record and open its standard Email action
     * so the email composer launches. Requires the SendEmail action to be on
     * the FinancialDeal page layout (it is, by default, with Activities enabled).
     */
    navigateToEmail(recordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__quickAction',
            attributes: {
                apiName: 'FinancialDeal.SendEmail'
            },
            state: {
                recordId,
                backgroundContext: '/lightning/r/FinancialDeal/' + recordId + '/view'
            }
        });
    }

    // ===================== Utilities =====================

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    /** Readable "HH:MM" timestamp for the last-sync label. */
    nowLabel() {
        try {
            return new Intl.DateTimeFormat(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date());
        } catch (e) {
            return 'just now';
        }
    }
}
