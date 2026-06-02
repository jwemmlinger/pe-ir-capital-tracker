/**
 * IRCapitalTrackerController
 * ---------------------------------------------------------------------------
 * Apex controller backing the `irCapitalTracker` Lightning Web Component for a
 * Private Equity (PE) firm's Investor Relations (IR) team.
 *
 * BUSINESS / DATA MODEL MAPPING (Financial Services Cloud):
 *   - Institutional LP            => Account (the record page host)
 *   - Commitment (a fund stake)   => FinServ__FinancialAccount__c
 *                                      (Record Type: InvestmentAccount)
 *       * FinServ__Balance__c        = Total Committed Capital
 *       * Total_Called_Capital__c    = Cash actually drawn down (paid-in)
 *       * Total_Distributions__c     = Cash returned to the LP (exits/dividends)
 *       * Current_NAV__c             = Residual capital account value
 *   - Ledger Transactions          => FinServ__FinancialAccountTransaction__c
 *       * Each row is a capital call (drawdown) or a distribution.
 *   - Fundraising Pipeline         => Opportunity (Fund_Offering_Name__c product)
 *   - Operational Workflows        => Task
 *
 * SECURITY: declared `with sharing` so the running user's FSC sharing rules and
 * record visibility are enforced. Read methods are cacheable for performance;
 * the single DML method is non-cacheable (writes can never be cached).
 * ---------------------------------------------------------------------------
 */
public with sharing class IRCapitalTrackerController {

    /* =====================================================================
     *  WRAPPER / DTO CLASSES
     *  These are serialized to the LWC. Keeping explicit @AuraEnabled wrappers
     *  (rather than returning raw SObjects) lets us shape exactly the PE data
     *  the UI needs and keeps the client contract stable.
     * ===================================================================== */

    /**
     * One active commitment (FinServ__FinancialAccount__c). Doubles as the
     * option list source for the Fund Filter combobox AND as the per-fund
     * metrics payload so the client can recompute KPIs/multiples locally.
     */
    public class CommitmentDTO {
        @AuraEnabled public Id    id;
        @AuraEnabled public String name;
        @AuraEnabled public Decimal committed;     // FinServ__Balance__c
        @AuraEnabled public Decimal called;        // Total_Called_Capital__c
        @AuraEnabled public Decimal distributions; // Total_Distributions__c
        @AuraEnabled public Decimal nav;           // Current_NAV__c
    }

    /** A single ledger row (capital call or distribution). */
    public class TransactionDTO {
        @AuraEnabled public Id       id;
        @AuraEnabled public Datetime txnDate;
        @AuraEnabled public String   txnType;        // e.g. Capital Call / Distribution
        @AuraEnabled public Decimal amount;
        @AuraEnabled public String referenceCode;
        @AuraEnabled public String status;
        @AuraEnabled public Id     financialAccountId;
    }

    /** A fundraising opportunity for the Kanban board + pipeline datatable. */
    public class OpportunityDTO {
        @AuraEnabled public Id      id;
        @AuraEnabled public String  name;
        @AuraEnabled public String  fundOffering;  // Fund_Offering_Name__c (free-text label)
        @AuraEnabled public Id      fundId;        // FINS_Private_Equity_Fund__c (real lookup)
        @AuraEnabled public String  fundName;      // FINS_Private_Equity_Fund__r.Name
        @AuraEnabled public Decimal amount;
        @AuraEnabled public String  stageName;
        @AuraEnabled public Decimal probability;
        @AuraEnabled public Date    closeDate;
        @AuraEnabled public Boolean isClosed;
        @AuraEnabled public Boolean isWon;
    }

    /**
     * A PE fund vehicle (custom Fund__c object) sponsored by / linked to the LP
     * Account. Surfaces the firm-level fund structure alongside the LP's own
     * commitments so IR can see committed vs. invested, fundraising progress,
     * vintage, terms, and investor counts at a glance.
     */
    public class FundDTO {
        @AuraEnabled public Id      id;
        @AuraEnabled public String  name;
        @AuraEnabled public String  fundType;          // Fund_Type__c
        @AuraEnabled public String  status;            // Status__c (lifecycle)
        @AuraEnabled public String  fundraisingStatus; // Fundraising_Status__c
        @AuraEnabled public String  vintage;           // FINS_Vintage__c
        @AuraEnabled public Decimal committed;         // Committed_Capital__c
        @AuraEnabled public Decimal invested;          // Invested__c
        @AuraEnabled public Decimal targetAmount;      // Fund_Target_Amount__c
        @AuraEnabled public Decimal pipeline;          // Fundraising_Pipeline__c
        @AuraEnabled public Decimal remainingToGoal;   // Remaining_to_Goal__c
        @AuraEnabled public Decimal numberOfInvestors; // Number_of_Investors__c
        @AuraEnabled public Decimal dealsInvested;     // of_Deals_Invested__c
        @AuraEnabled public Decimal managementFee;     // FINS_Private_Equity_Management_Fee__c (percent)
        @AuraEnabled public Decimal term;              // FINS_Private_Equity_Term__c (years)
        @AuraEnabled public String  info;              // Fund_Info__c
        // Convenience: % of target raised, computed server-side for the bar.
        @AuraEnabled public Decimal raisedPct;
        // Live rollups from related Opportunities (linked via the
        // FINS_Private_Equity_Fund__c lookup) so each fund card shows its own
        // active fundraising activity.
        @AuraEnabled public Integer relatedOppCount  = 0;
        @AuraEnabled public Decimal relatedOppAmount = 0;
        @AuraEnabled public List<OpportunityDTO> relatedOpps = new List<OpportunityDTO>();
    }

    /**
     * Top-level payload for Tab 1. Bundling commitments + transactions in a
     * single round trip lets the client cache one cacheable result and do all
     * scope filtering (All vs. a single fund) reactively on the client.
     */
    public class CapitalSnapshot {
        @AuraEnabled public List<CommitmentDTO>  commitments  = new List<CommitmentDTO>();
        @AuraEnabled public List<TransactionDTO> transactions = new List<TransactionDTO>();
    }

    /* =====================================================================
     *  READ METHODS (cacheable for high performance)
     * ===================================================================== */

    /**
     * Returns every active investment commitment for the LP Account plus the
     * recent ledger transactions across all of those commitments.
     *
     * The client uses this single snapshot to:
     *   - populate the Fund Filter combobox,
     *   - compute "All Combined Commitments" totals, and
     *   - filter the ledger datatable to the selected scope.
     *
     * @param accountId  The Institutional LP Account Id (record page context).
     */
    @AuraEnabled(cacheable=true)
    public static CapitalSnapshot getCapitalSnapshot(Id accountId) {
        if (accountId == null) {
            throw new AuraHandledException('An Account Id is required to load capital data.');
        }

        CapitalSnapshot snapshot = new CapitalSnapshot();

        try {
            // ---- Commitments (active investment financial accounts) ----------
            // Note: FSC ties a FinancialAccount to its owner via the
            // FinServ__PrimaryOwner__c lookup to the Account.
            List<FinServ__FinancialAccount__c> commitments = [
                SELECT Id,
                       Name,
                       FinServ__Balance__c,
                       Total_Called_Capital__c,
                       Total_Distributions__c,
                       Current_NAV__c
                FROM FinServ__FinancialAccount__c
                WHERE FinServ__PrimaryOwner__c = :accountId
                  AND FinServ__Status__c = 'Active'
                WITH SECURITY_ENFORCED
                ORDER BY Name ASC
                LIMIT 200
            ];

            Set<Id> commitmentIds = new Set<Id>();
            for (FinServ__FinancialAccount__c fa : commitments) {
                CommitmentDTO dto    = new CommitmentDTO();
                dto.id               = fa.Id;
                dto.name             = fa.Name;
                // Coalesce nulls to 0 so the UI math never sees a null.
                dto.committed        = nz(fa.FinServ__Balance__c);
                dto.called           = nz(fa.Total_Called_Capital__c);
                dto.distributions    = nz(fa.Total_Distributions__c);
                dto.nav              = nz(fa.Current_NAV__c);
                snapshot.commitments.add(dto);
                commitmentIds.add(fa.Id);
            }

            // ---- Ledger transactions for those commitments ------------------
            if (!commitmentIds.isEmpty()) {
                for (FinServ__FinancialAccountTransaction__c txn : [
                        SELECT Id,
                               FinServ__TransactionDate__c,
                               FinServ__TransactionType__c,
                               FinServ__Amount__c,
                               Reference_Code__c,
                               Txn_Status__c,
                               FinServ__FinancialAccount__c
                        FROM FinServ__FinancialAccountTransaction__c
                        WHERE FinServ__FinancialAccount__c IN :commitmentIds
                        WITH SECURITY_ENFORCED
                        ORDER BY FinServ__TransactionDate__c DESC
                        LIMIT 500
                ]) {
                    TransactionDTO t       = new TransactionDTO();
                    t.id                   = txn.Id;
                    t.txnDate              = txn.FinServ__TransactionDate__c;
                    t.txnType              = txn.FinServ__TransactionType__c;
                    t.amount               = nz(txn.FinServ__Amount__c);
                    t.referenceCode        = txn.Reference_Code__c;
                    t.status               = txn.Txn_Status__c;
                    t.financialAccountId   = txn.FinServ__FinancialAccount__c;
                    snapshot.transactions.add(t);
                }
            }

            return snapshot;

        } catch (System.QueryException qe) {
            // Surfaces a clean, user-friendly message instead of a raw stack trace.
            throw new AuraHandledException('Unable to query capital data: ' + qe.getMessage());
        }
    }

    /**
     * Returns the fundraising pipeline (Opportunities) for the LP Account.
     * Powers both the Kanban board and the pipeline datatable on Tab 2.
     *
     * @param accountId  The Institutional LP Account Id.
     */
    @AuraEnabled(cacheable=true)
    public static List<OpportunityDTO> getPipeline(Id accountId) {
        if (accountId == null) {
            throw new AuraHandledException('An Account Id is required to load the pipeline.');
        }

        List<OpportunityDTO> results = new List<OpportunityDTO>();

        try {
            for (Opportunity opp : [
                    SELECT Id,
                           Name,
                           Fund_Offering_Name__c,
                           FINS_Private_Equity_Fund__c,
                           FINS_Private_Equity_Fund__r.Name,
                           Amount,
                           StageName,
                           Probability,
                           CloseDate,
                           IsClosed,
                           IsWon
                    FROM Opportunity
                    WHERE AccountId = :accountId
                    WITH SECURITY_ENFORCED
                    ORDER BY CloseDate ASC
                    LIMIT 200
            ]) {
                OpportunityDTO dto = new OpportunityDTO();
                dto.id             = opp.Id;
                dto.name           = opp.Name;
                dto.fundOffering   = opp.Fund_Offering_Name__c;
                dto.fundId         = opp.FINS_Private_Equity_Fund__c;
                dto.fundName       = opp.FINS_Private_Equity_Fund__r.Name;
                dto.amount         = nz(opp.Amount);
                dto.stageName      = opp.StageName;
                dto.probability    = nz(opp.Probability);
                dto.closeDate      = opp.CloseDate;
                dto.isClosed       = opp.IsClosed;
                dto.isWon          = opp.IsWon;
                results.add(dto);
            }
            return results;

        } catch (System.QueryException qe) {
            throw new AuraHandledException('Unable to query the fundraising pipeline: ' + qe.getMessage());
        }
    }

    /**
     * Returns the PE fund vehicles (custom Fund__c) linked to the LP Account.
     * Powers the "Fund Vehicles" tab: a card grid of committed-vs-invested
     * capital, fundraising progress, vintage, terms, and investor counts.
     *
     * @param accountId  The Institutional LP Account Id.
     */
    @AuraEnabled(cacheable=true)
    public static List<FundDTO> getFunds(Id accountId) {
        if (accountId == null) {
            throw new AuraHandledException('An Account Id is required to load funds.');
        }

        List<FundDTO>     results   = new List<FundDTO>();
        Map<Id, FundDTO>  fundById  = new Map<Id, FundDTO>();

        try {
            for (Fund__c f : [
                    SELECT Id, Name, Fund_Type__c, Status__c, Fundraising_Status__c,
                           FINS_Vintage__c, Committed_Capital__c, Invested__c,
                           Fund_Target_Amount__c, Fundraising_Pipeline__c,
                           Remaining_to_Goal__c, Number_of_Investors__c,
                           of_Deals_Invested__c, FINS_Private_Equity_Management_Fee__c,
                           FINS_Private_Equity_Term__c, Fund_Info__c
                    FROM Fund__c
                    WHERE Account__c = :accountId
                    WITH SECURITY_ENFORCED
                    ORDER BY FINS_Vintage__c DESC NULLS LAST, Name ASC
                    LIMIT 200
            ]) {
                FundDTO dto           = new FundDTO();
                dto.id                = f.Id;
                dto.name              = f.Name;
                dto.fundType          = f.Fund_Type__c;
                dto.status            = f.Status__c;
                dto.fundraisingStatus = f.Fundraising_Status__c;
                dto.vintage           = f.FINS_Vintage__c;
                dto.committed         = nz(f.Committed_Capital__c);
                dto.invested          = nz(f.Invested__c);
                dto.targetAmount      = nz(f.Fund_Target_Amount__c);
                dto.pipeline          = nz(f.Fundraising_Pipeline__c);
                dto.remainingToGoal   = nz(f.Remaining_to_Goal__c);
                dto.numberOfInvestors = nz(f.Number_of_Investors__c);
                dto.dealsInvested     = nz(f.of_Deals_Invested__c);
                dto.managementFee     = nz(f.FINS_Private_Equity_Management_Fee__c);
                dto.term              = nz(f.FINS_Private_Equity_Term__c);
                dto.info              = f.Fund_Info__c;
                // % of target raised (committed / target), clamped to 100.
                Decimal pct = dto.targetAmount > 0
                    ? (dto.committed / dto.targetAmount) * 100
                    : 0;
                dto.raisedPct = pct > 100 ? 100 : pct.setScale(1);
                results.add(dto);
                fundById.put(f.Id, dto);
            }

            // ---- Attach related Opportunities to each fund -------------------
            // Opportunities are tied to a fund via FINS_Private_Equity_Fund__c.
            // We roll up open-pipeline count/amount and carry the open deals so
            // each fund card can show its live fundraising activity.
            if (!fundById.isEmpty()) {
                for (Opportunity opp : [
                        SELECT Id, Name, Fund_Offering_Name__c,
                               FINS_Private_Equity_Fund__c,
                               Amount, StageName, Probability, CloseDate,
                               IsClosed, IsWon
                        FROM Opportunity
                        WHERE FINS_Private_Equity_Fund__c IN :fundById.keySet()
                        WITH SECURITY_ENFORCED
                        ORDER BY CloseDate ASC
                        LIMIT 500
                ]) {
                    FundDTO parent = fundById.get(opp.FINS_Private_Equity_Fund__c);
                    if (parent == null) {
                        continue;
                    }
                    OpportunityDTO o = new OpportunityDTO();
                    o.id           = opp.Id;
                    o.name         = opp.Name;
                    o.fundOffering = opp.Fund_Offering_Name__c;
                    o.fundId       = opp.FINS_Private_Equity_Fund__c;
                    o.amount       = nz(opp.Amount);
                    o.stageName    = opp.StageName;
                    o.probability  = nz(opp.Probability);
                    o.closeDate    = opp.CloseDate;
                    o.isClosed     = opp.IsClosed;
                    o.isWon        = opp.IsWon;
                    parent.relatedOpps.add(o);
                    // Roll up only still-open opportunities into the headline.
                    if (!opp.IsClosed) {
                        parent.relatedOppCount  += 1;
                        parent.relatedOppAmount += o.amount;
                    }
                }
            }

            return results;

        } catch (System.QueryException qe) {
            throw new AuraHandledException('Unable to query fund vehicles: ' + qe.getMessage());
        }
    }

    /* =====================================================================
     *  WRITE METHOD (NOT cacheable — performs DML)
     * ===================================================================== */

    /**
     * Finalizes a fundraising Opportunity by transitioning it to Closed Won and
     * "activating" the commitment: a new FinServ__FinancialAccount__c record is
     * instantiated for the LP with the subscribed amount as its committed
     * capital (FinServ__Balance__c).
     *
     * This mirrors the real PE onboarding step where a signed subscription
     * agreement converts a pipeline opportunity into a funded commitment.
     *
     * @param opportunityId  The Opportunity to activate.
     * @return The Id of the newly created FinServ__FinancialAccount__c commitment.
     */
    @AuraEnabled
    public static Id finalizeOpportunitySubscription(Id opportunityId) {
        if (opportunityId == null) {
            throw new AuraHandledException('An Opportunity Id is required.');
        }

        // Load the opportunity with the fields needed to seed the commitment.
        Opportunity opp;
        try {
            opp = [
                SELECT Id, Name, AccountId, Amount, StageName,
                       Fund_Offering_Name__c, IsClosed, IsWon
                FROM Opportunity
                WHERE Id = :opportunityId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
        } catch (System.QueryException qe) {
            throw new AuraHandledException('Opportunity not found or not accessible.');
        }

        if (opp.AccountId == null) {
            throw new AuraHandledException('This opportunity is not linked to an LP Account, so a commitment cannot be created.');
        }
        if (opp.IsWon) {
            throw new AuraHandledException('This opportunity is already Closed Won.');
        }

        // Resolve the InvestmentAccount record type so the new commitment is
        // categorized correctly in FSC. getRecordTypeInfosByDeveloperName is
        // null-safe lookups against the running describe.
        Schema.RecordTypeInfo rtInfo =
            Schema.SObjectType.FinServ__FinancialAccount__c
                .getRecordTypeInfosByDeveloperName()
                .get('InvestmentAccount');

        // Wrap the multi-object write in a savepoint so a partial failure rolls
        // back cleanly (we never want a won opp without its commitment).
        System.Savepoint sp = Database.setSavepoint();
        try {
            // 1) Transition the opportunity to Closed Won.
            opp.StageName = 'Closed Won';
            update opp;

            // 2) Instantiate the activated commitment.
            FinServ__FinancialAccount__c commitment = new FinServ__FinancialAccount__c();
            commitment.Name                   = (opp.Fund_Offering_Name__c != null
                                                    ? opp.Fund_Offering_Name__c
                                                    : opp.Name);
            commitment.FinServ__PrimaryOwner__c = opp.AccountId;
            commitment.FinServ__Balance__c      = nz(opp.Amount); // committed capital
            commitment.FinServ__Status__c       = 'Active';
            if (rtInfo != null && rtInfo.isAvailable()) {
                commitment.RecordTypeId = rtInfo.getRecordTypeId();
            }
            insert commitment;

            return commitment.Id;

        } catch (DmlException de) {
            Database.rollback(sp);
            throw new AuraHandledException('Failed to activate the commitment: ' + de.getDmlMessage(0));
        }
    }

    /* =====================================================================
     *  HELPERS
     * ===================================================================== */

    /** Null-coalesce a Decimal to zero so client-side math is always safe. */
    private static Decimal nz(Decimal value) {
        return value == null ? 0 : value;
    }
}
