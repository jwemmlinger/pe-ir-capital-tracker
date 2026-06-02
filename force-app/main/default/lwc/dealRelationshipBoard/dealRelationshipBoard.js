/**
 * dealRelationshipBoard
 * ---------------------------------------------------------------------------
 * An Actionable Relationship Center (ARC)-style graph for a Private Equity
 * deal. A central deal node fans out to role-based relationship groups
 * (Co-Investors, Deal Team, Legal Counsel, Target PortCo, Intermediaries),
 * each rendering its related participant cards.
 *
 * EDITABLE — click "Edit" to modify the board directly in place:
 *   - edit the deal node label,
 *   - edit each card's title and field values,
 *   - add / remove cards and fields,
 *   - rename group headers.
 * Click "Save" to persist the whole board (as JSON) to a
 * Deal_Relationship_Board__c record keyed by the host record Id, so the edits
 * survive a refresh.
 *
 * CUSTOMIZABLE — App Builder properties (deal label, icon, accent color,
 * columns per row, toggles) and an optional `groupsJson` seed the initial
 * board when nothing has been saved yet.
 * ---------------------------------------------------------------------------
 */
import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getBoardConfig from '@salesforce/apex/DealRelationshipBoardController.getBoardConfig';
import saveBoardConfig from '@salesforce/apex/DealRelationshipBoardController.saveBoardConfig';

// Default board used when nothing is saved and no groupsJson is supplied.
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
    /** Host record (Account/Opportunity) — used as the save key. */
    @api recordId;

    // ===================== Customizable App Builder properties =====================

    @api dealName = '*Census, Inc. // $22m // Series B';
    @api dealIcon = 'standard:opportunity';
    @api accentColor = '#0176d3';
    @api columnsPerRow = 5;
    @api hideToggle = false;
    @api hideToolbar = false;
    @api showFieldsByDefault;
    @api startCollapsed = false;
    @api groupsJson;

    // ===================== Internal reactive state =====================

    @track showFields;
    @track groups = [];
    @track isEditing = false;
    @track dealNameDraft = '';
    isSaving = false;

    wiredConfig;          // retained provisioned value for refreshApex
    hasLoadedFromServer = false;

    connectedCallback() {
        this.showFields = this.showFieldsByDefault !== false;
        // Seed from default/groupsJson; the wire will override if a saved
        // config exists.
        this.initGroups(this.seedSource());
        this.dealNameDraft = this.dealName;
    }

    /** Resolve the initial seed: explicit groupsJson, else the default board. */
    seedSource() {
        if (this.groupsJson && this.groupsJson.trim()) {
            try {
                const parsed = JSON.parse(this.groupsJson);
                if (Array.isArray(parsed) && parsed.length) {
                    return { dealName: this.dealName, dealIcon: this.dealIcon, groups: parsed };
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('dealRelationshipBoard: invalid groupsJson, using default board.', e);
            }
        }
        return { dealName: this.dealName, dealIcon: this.dealIcon, groups: DEFAULT_GROUPS };
    }

    /** Load any saved board for this host record. */
    @wire(getBoardConfig, { hostRecordId: '$recordId' })
    wiredBoard(result) {
        this.wiredConfig = result;
        const { data } = result;
        if (data) {
            try {
                const cfg = JSON.parse(data);
                this.applyConfig(cfg);
                this.hasLoadedFromServer = true;
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('dealRelationshipBoard: saved config is not valid JSON.', e);
            }
        }
    }

    /** Apply a full config object (deal node + groups) to component state. */
    applyConfig(cfg) {
        if (cfg.dealName) {
            this.dealName = cfg.dealName;
            this.dealNameDraft = cfg.dealName;
        }
        if (cfg.dealIcon) {
            this.dealIcon = cfg.dealIcon;
        }
        this.initGroups(cfg);
    }

    /** Normalize a config's groups array into internal, stably-keyed state. */
    initGroups(cfg) {
        const source = (cfg && cfg.groups) || DEFAULT_GROUPS;
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
                    key: f.key || `f-${i}-${ci}-${fi}`,
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
    get columnsStyle() {
        const cols = Math.max(1, Number(this.columnsPerRow) || 5);
        return `grid-template-columns: repeat(${cols}, minmax(0, 1fr));`;
    }
    get dealIconStyle() {
        return `--sds-c-icon-color-background: ${this.accentColor};`;
    }
    get editButtonLabel() {
        return this.isEditing ? 'Cancel' : 'Edit';
    }

    get decoratedGroups() {
        return this.groups.map((g) => ({
            ...g,
            count: g.cards.length,
            chevron: g.collapsed ? 'utility:chevronright' : 'utility:chevrondown',
            iconStyle: `background: ${g.color};`,
            // In edit mode groups never appear collapsed (so users can edit).
            isCollapsed: g.collapsed && !this.isEditing,
            cards: g.cards.map((c) => ({
                ...c,
                cardStyle: `border-top-color: ${g.color};`,
                visibleFields: this.showFields || this.isEditing ? c.fields : []
            }))
        }));
    }

    // ===================== Toolbar handlers =====================

    handleToggleFields(event) {
        this.showFields = event.target.checked;
    }

    handleToggleGroup(event) {
        if (this.isEditing) {
            return; // groups stay open while editing
        }
        const key = event.currentTarget.dataset.key;
        this.groups = this.groups.map((g) =>
            g.key === key ? { ...g, collapsed: !g.collapsed } : g
        );
    }

    handleNew(event) {
        const key = event.currentTarget.dataset.key;
        if (this.isEditing) {
            this.addCard(key);
        } else {
            this.dispatchEvent(
                new CustomEvent('newrecord', { detail: { groupKey: key } })
            );
        }
    }

    // ===================== Edit mode =====================

    toggleEdit() {
        if (this.isEditing) {
            // Cancelling: reload last-known-good config (saved or seed).
            if (this.hasLoadedFromServer && this.wiredConfig && this.wiredConfig.data) {
                try {
                    this.applyConfig(JSON.parse(this.wiredConfig.data));
                } catch (e) {
                    this.initGroups(this.seedSource());
                }
            } else {
                this.applyConfig(this.seedSource());
            }
        } else {
            this.dealNameDraft = this.dealName;
        }
        this.isEditing = !this.isEditing;
    }

    handleDealNameChange(event) {
        this.dealNameDraft = event.target.value;
    }

    handleCardTitleChange(event) {
        const { groupKey, cardId } = event.target.dataset;
        const val = event.target.value;
        this.mutateCard(groupKey, cardId, (card) => {
            card.title = val;
        });
    }

    handleFieldLabelChange(event) {
        const { groupKey, cardId, fieldKey } = event.target.dataset;
        const val = event.target.value;
        this.mutateField(groupKey, cardId, fieldKey, (f) => {
            f.label = val;
        });
    }

    handleFieldValueChange(event) {
        const { groupKey, cardId, fieldKey } = event.target.dataset;
        const val = event.target.value;
        this.mutateField(groupKey, cardId, fieldKey, (f) => {
            f.value = val;
        });
    }

    handleGroupLabelChange(event) {
        const { groupKey } = event.target.dataset;
        const val = event.target.value;
        this.groups = this.groups.map((g) =>
            g.key === groupKey ? { ...g, label: val } : g
        );
    }

    addCard(groupKey) {
        // Deterministic id without Date.now()/random (unavailable in some
        // contexts): use group size + a short suffix.
        this.groups = this.groups.map((g) => {
            if (g.key !== groupKey) {
                return g;
            }
            const newCard = {
                id: `${g.key}-card-${g.cards.length + 1}`,
                title: 'New Record',
                fields: [{ key: `${g.key}-nf-${g.cards.length + 1}`, label: 'Field', value: '' }]
            };
            return { ...g, cards: [...g.cards, newCard] };
        });
    }

    handleRemoveCard(event) {
        const { groupKey, cardId } = event.currentTarget.dataset;
        this.groups = this.groups.map((g) =>
            g.key === groupKey
                ? { ...g, cards: g.cards.filter((c) => c.id !== cardId) }
                : g
        );
    }

    handleAddField(event) {
        const { groupKey, cardId } = event.currentTarget.dataset;
        this.mutateCard(groupKey, cardId, (card) => {
            card.fields = [
                ...card.fields,
                { key: `${cardId}-nf-${card.fields.length + 1}`, label: 'Field', value: '' }
            ];
        });
    }

    handleRemoveField(event) {
        const { groupKey, cardId, fieldKey } = event.currentTarget.dataset;
        this.mutateCard(groupKey, cardId, (card) => {
            card.fields = card.fields.filter((f) => f.key !== fieldKey);
        });
    }

    // ---- immutable mutation helpers ----
    mutateCard(groupKey, cardId, fn) {
        this.groups = this.groups.map((g) => {
            if (g.key !== groupKey) {
                return g;
            }
            return {
                ...g,
                cards: g.cards.map((c) => {
                    if (c.id !== cardId) {
                        return c;
                    }
                    const copy = { ...c, fields: c.fields.map((f) => ({ ...f })) };
                    fn(copy);
                    return copy;
                })
            };
        });
    }

    mutateField(groupKey, cardId, fieldKey, fn) {
        this.mutateCard(groupKey, cardId, (card) => {
            card.fields = card.fields.map((f) => {
                if (f.key !== fieldKey) {
                    return f;
                }
                const fc = { ...f };
                fn(fc);
                return fc;
            });
        });
    }

    // ===================== Persistence =====================

    /** Serialize current state to the stored config shape. */
    buildConfig() {
        return {
            dealName: this.dealNameDraft || this.dealName,
            dealIcon: this.dealIcon,
            groups: this.groups.map((g) => ({
                key: g.key,
                label: g.label,
                icon: g.icon,
                color: g.color,
                showNew: g.showNew,
                collapsed: g.collapsed,
                cards: g.cards.map((c) => ({
                    id: c.id,
                    title: c.title,
                    fields: c.fields.map((f) => ({
                        key: f.key,
                        label: f.label,
                        value: f.value
                    }))
                }))
            }))
        };
    }

    async handleSave() {
        if (!this.recordId) {
            this.toast(
                'Cannot save',
                'This board must be placed on a record page to save changes.',
                'warning'
            );
            return;
        }
        this.isSaving = true;
        try {
            const cfg = this.buildConfig();
            await saveBoardConfig({
                hostRecordId: this.recordId,
                configJson: JSON.stringify(cfg)
            });
            // Commit drafts to live state.
            this.dealName = cfg.dealName;
            this.isEditing = false;
            this.hasLoadedFromServer = true;
            if (this.wiredConfig) {
                await refreshApex(this.wiredConfig);
            }
            this.toast('Saved', 'Board changes saved.', 'success');
        } catch (error) {
            this.toast('Save failed', this.reduceError(error), 'error');
        } finally {
            this.isSaving = false;
        }
    }

    // ===================== Utilities =====================

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

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
