/**
 * dealRelationshipBoard
 * ---------------------------------------------------------------------------
 * An Actionable Relationship Center (ARC)-style graph for a Private Equity
 * deal. A central deal node fans out to role-based relationship groups
 * (Co-Investors, Deal Team, Legal Counsel, Target PortCo, Intermediaries),
 * each rendering its related participant cards.
 *
 * The board is data-driven via the `groups` array so it can later be wired to
 * Apex / a relationship object. A "Show fields on cards" toggle expands each
 * card to reveal additional fields, mirroring the native ARC behavior.
 * ---------------------------------------------------------------------------
 */
import { LightningElement, api, track } from 'lwc';

export default class DealRelationshipBoard extends LightningElement {
    /** Record context (Account/Opportunity) — reserved for future wiring. */
    @api recordId;

    /** Title of the central deal node. */
    @api dealName = '*Census, Inc. // $22m // Series B';

    /** Controls the "Show fields on cards" toggle. */
    @track showFields = true;

    /**
     * Relationship groups fanning out from the deal node. Each group is a role
     * with one or more participant cards. Icon names use SLDS utility/standard
     * sprites so the board renders without external assets.
     */
    @track groups = [
        {
            key: 'co-investors',
            label: 'Co-Investors',
            icon: 'standard:partners',
            iconClass: 'arc-icon arc-icon_blue',
            collapsed: false,
            showNew: true,
            cards: [
                {
                    id: 'FDP-0013',
                    title: 'FDP-0013',
                    fields: [
                        { key: 'role', label: 'Role', value: 'Lead Co-Investor' },
                        { key: 'commit', label: 'Commitment', value: '$8.0M' },
                        { key: 'status', label: 'Status', value: 'Committed' }
                    ]
                }
            ]
        },
        {
            key: 'deal-team',
            label: 'Deal Team',
            icon: 'standard:user_role',
            iconClass: 'arc-icon arc-icon_indigo',
            collapsed: false,
            showNew: false,
            cards: [
                {
                    id: 'FDP-0014',
                    title: 'FDP-0014',
                    fields: [
                        { key: 'role', label: 'Role', value: 'Deal Lead' },
                        { key: 'owner', label: 'Owner', value: 'A. Whitfield' },
                        { key: 'status', label: 'Status', value: 'Active' }
                    ]
                }
            ]
        },
        {
            key: 'legal-counsel',
            label: 'Legal Counsel',
            icon: 'standard:legal_entity',
            iconClass: 'arc-icon arc-icon_teal',
            collapsed: false,
            showNew: false,
            cards: [
                {
                    id: 'FDP-0015',
                    title: 'FDP-0015',
                    fields: [
                        { key: 'firm', label: 'Firm', value: 'Lattimer & Roe LLP' },
                        { key: 'role', label: 'Role', value: 'Buy-side Counsel' },
                        { key: 'status', label: 'Status', value: 'Engaged' }
                    ]
                }
            ]
        },
        {
            key: 'target-portco',
            label: 'Target PortCo',
            icon: 'standard:account',
            iconClass: 'arc-icon arc-icon_green',
            collapsed: false,
            showNew: false,
            cards: [
                {
                    id: 'FDP-0016',
                    title: 'FDP-0016',
                    fields: [
                        { key: 'company', label: 'Company', value: 'Census, Inc.' },
                        { key: 'sector', label: 'Sector', value: 'Data Infrastructure' },
                        { key: 'stage', label: 'Stage', value: 'Series B' }
                    ]
                }
            ]
        },
        {
            key: 'intermediaries',
            label: 'Intermediaries',
            icon: 'standard:work_order',
            iconClass: 'arc-icon arc-icon_orange',
            collapsed: false,
            showNew: false,
            cards: [
                {
                    id: 'FDP-0017',
                    title: 'FDP-0017',
                    fields: [
                        { key: 'firm', label: 'Firm', value: 'Harbor Point Advisors' },
                        { key: 'role', label: 'Role', value: 'Sell-side Banker' },
                        { key: 'status', label: 'Status', value: 'Introduced' }
                    ]
                }
            ]
        }
    ];

    /** Decorated groups exposing per-group derived display state. */
    get decoratedGroups() {
        return this.groups.map((g) => ({
            ...g,
            count: g.cards.length,
            chevron: g.collapsed ? 'utility:chevronright' : 'utility:chevrondown',
            cards: g.cards.map((c) => ({
                ...c,
                // Only surface fields when the toggle is on.
                visibleFields: this.showFields ? c.fields : []
            }))
        }));
    }

    handleToggleFields(event) {
        this.showFields = event.target.checked;
    }

    /** Collapse / expand a single relationship group. */
    handleToggleGroup(event) {
        const key = event.currentTarget.dataset.key;
        this.groups = this.groups.map((g) =>
            g.key === key ? { ...g, collapsed: !g.collapsed } : g
        );
    }

    handleNew(event) {
        const key = event.currentTarget.dataset.key;
        // Placeholder hook — in a wired version this opens a create flow.
        // eslint-disable-next-line no-console
        console.log('New record requested for group:', key);
    }
}
