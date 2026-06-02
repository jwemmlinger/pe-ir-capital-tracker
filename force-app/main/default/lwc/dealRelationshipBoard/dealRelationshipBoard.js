/**
 * dealRelationshipBoard
 * ---------------------------------------------------------------------------
 * An Actionable Relationship Center (ARC)-style graph for a Private Equity
 * deal. A central deal node fans out to role-based relationship groups
 * (Co-Investors, Deal Team, Legal Counsel, Target PortCo, Intermediaries),
 * each rendering its related participant cards.
 *
 * FULLY CUSTOMIZABLE — every piece can be changed without touching code:
 *   - Lightning App Builder properties (deal label, icon, accent color, columns
 *     per row, toggle visibility, default expand/collapse state, toolbar).
 *   - A `groupsJson` property accepts a JSON array that completely redefines the
 *     groups, their icons/colors, cards, and fields. When omitted, a sensible
 *     PE default board is shown.
 *
 * Set `groupsJson` in App Builder (or pass it from a parent) to drive the board
 * from real data; the shape is documented in the README.
 * ---------------------------------------------------------------------------
 */
import { LightningElement, api, track } from 'lwc';

// Default board used when no groupsJson is provided. This is also the documented
// shape: { key, label, icon, color, accentColor, showNew, collapsed, cards:[
//   { id, title, fields:[{ label, value }] } ] }.
const DEFAULT_GROUPS = [
    {
        key: 'co-investors',
        label: 'Co-Investors',
        icon: 'standard:partners',
        color: '#0176d3',
        showNew: true,
        cards: [
            {
                id: 'FDP-0013',
                title: 'FDP-0013',
                fields: [
                    { label: 'Role', value: 'Lead Co-Investor' },
                    { label: 'Commitment', value: '$8.0M' },
                    { label: 'Status', value: 'Committed' }
                ]
            }
        ]
    },
    {
        key: 'deal-team',
        label: 'Deal Team',
        icon: 'standard:user_role',
        color: '#5867e8',
        cards: [
            {
                id: 'FDP-0014',
                title: 'FDP-0014',
                fields: [
                    { label: 'Role', value: 'Deal Lead' },
                    { label: 'Owner', value: 'A. Whitfield' },
                    { label: 'Status', value: 'Active' }
                ]
            }
        ]
    },
    {
        key: 'legal-counsel',
        label: 'Legal Counsel',
        icon: 'standard:legal_entity',
        color: '#0b827c',
        cards: [
            {
                id: 'FDP-0015',
                title: 'FDP-0015',
                fields: [
                    { label: 'Firm', value: 'Lattimer & Roe LLP' },
                    { label: 'Role', value: 'Buy-side Counsel' },
                    { label: 'Status', value: 'Engaged' }
                ]
            }
        ]
    },
    {
        key: 'target-portco',
        label: 'Target PortCo',
        icon: 'standard:account',
        color: '#2e844a',
        cards: [
            {
                id: 'FDP-0016',
                title: 'FDP-0016',
                fields: [
                    { label: 'Company', value: 'Census, Inc.' },
                    { label: 'Sector', value: 'Data Infrastructure' },
                    { label: 'Stage', value: 'Series B' }
                ]
            }
        ]
    },
    {
        key: 'intermediaries',
        label: 'Intermediaries',
        icon: 'standard:work_order',
        color: '#dd7a01',
        cards: [
            {
                id: 'FDP-0017',
                title: 'FDP-0017',
                fields: [
                    { label: 'Firm', value: 'Harbor Point Advisors' },
                    { label: 'Role', value: 'Sell-side Banker' },
                    { label: 'Status', value: 'Introduced' }
                ]
            }
        ]
    }
];

export default class DealRelationshipBoard extends LightningElement {
    /** Record context (Account/Opportunity) — reserved for future wiring. */
    @api recordId;

    // ===================== Customizable App Builder properties =====================

    /** Title of the central deal node. */
    @api dealName = '*Census, Inc. // $22m // Series B';

    /** SLDS icon for the central deal node (e.g. standard:opportunity). */
    @api dealIcon = 'standard:opportunity';

    /** Accent color (card top-border, deal icon background). Any CSS color. */
    @api accentColor = '#0176d3';

    /** Number of columns shown per row (groups wrap beyond this). */
    @api columnsPerRow = 5;

    /** Whether the "Show fields on cards" toggle is rendered. */
    @api hideToggle = false;

    /** Whether the zoom/layout/refresh toolbar buttons are rendered. */
    @api hideToolbar = false;

    /**
     * Initial state of the "Show fields on cards" toggle. Defaults to ON; set
     * the App Builder property to false to start with fields hidden. (LWC
     * requires boolean @api props to omit a `true` initializer, so the default
     * is applied in connectedCallback via the `!== false` check.)
     */
    @api showFieldsByDefault;

    /** If true, all groups start collapsed. */
    @api startCollapsed = false;

    /**
     * JSON array that fully redefines the board. When provided, it overrides the
     * built-in default. See the README for the schema. Invalid JSON falls back
     * to the default board and logs a warning.
     */
    @api groupsJson;

    // ===================== Internal reactive state =====================

    @track showFields;
    @track groups = [];

    connectedCallback() {
        // Default the toggle to ON unless explicitly set to false.
        this.showFields = this.showFieldsByDefault !== false;
        this.initGroups();
    }

    /** Parse groupsJson (if any) and normalize into the internal group shape. */
    initGroups() {
        let source = DEFAULT_GROUPS;
        if (this.groupsJson && this.groupsJson.trim()) {
            try {
                const parsed = JSON.parse(this.groupsJson);
                if (Array.isArray(parsed) && parsed.length) {
                    source = parsed;
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('dealRelationshipBoard: invalid groupsJson, using default board.', e);
            }
        }

        this.groups = source.map((g, i) => ({
            key: g.key || `group-${i}`,
            label: g.label || 'Group',
            icon: g.icon || 'standard:default',
            color: g.color || this.accentColor,
            showNew: g.showNew === true,
            collapsed: this.startCollapsed || g.collapsed === true,
            cards: (g.cards || []).map((c, ci) => ({
                id: c.id || `${g.key || i}-card-${ci}`,
                title: c.title || c.id || 'Untitled',
                fields: (c.fields || []).map((f, fi) => ({
                    key: f.key || `f-${fi}`,
                    label: f.label || '',
                    value: f.value != null ? String(f.value) : ''
                }))
            }))
        }));
    }

    // ===================== Derived display state =====================

    get showToggle() {
        return !this.hideToggle;
    }

    get showToolbar() {
        return !this.hideToolbar;
    }

    /** Grid style honoring the configurable columns-per-row. */
    get columnsStyle() {
        const cols = Math.max(1, Number(this.columnsPerRow) || 5);
        return `grid-template-columns: repeat(${cols}, minmax(0, 1fr));`;
    }

    /** Deal-node icon background uses the accent color. */
    get dealIconStyle() {
        return `--sds-c-icon-color-background: ${this.accentColor};`;
    }

    /** Decorated groups exposing per-group/per-card derived display state. */
    get decoratedGroups() {
        return this.groups.map((g) => ({
            ...g,
            count: g.cards.length,
            chevron: g.collapsed ? 'utility:chevronright' : 'utility:chevrondown',
            iconStyle: `background: ${g.color};`,
            cards: g.cards.map((c) => ({
                ...c,
                cardStyle: `border-top-color: ${g.color};`,
                visibleFields: this.showFields ? c.fields : []
            }))
        }));
    }

    // ===================== Handlers =====================

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
        // Notify parents so a host page/flow can open a create experience.
        this.dispatchEvent(
            new CustomEvent('newrecord', { detail: { groupKey: key } })
        );
    }
}
