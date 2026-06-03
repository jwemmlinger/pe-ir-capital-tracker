/**
 * PortfolioIntelligenceController
 * ---------------------------------------------------------------------------
 * Server-side actions for the `portfolioIntelligence` LWC. Turns a target
 * company surfaced by the (mock) market-intelligence feed into real Salesforce
 * records:
 *   - createAccount        -> an Account for the company
 *   - addToPipeline        -> an Account + a FinancialDeal (the pipeline deal)
 *   - draftOutreach        -> an Account + a FinancialDeal (client then opens
 *                              the Email action on the returned deal)
 *
 * Accounts are de-duplicated by name so repeated clicks reuse the same Account
 * rather than creating duplicates.
 * ---------------------------------------------------------------------------
 */
public with sharing class PortfolioIntelligenceController {

    /** Inbound payload describing a target company from the intel feed. */
    public class TargetInput {
        @AuraEnabled public String company;
        @AuraEnabled public String sector;       // -> Account.Industry (free text)
        @AuraEnabled public String location;
        @AuraEnabled public String revenue;
        @AuraEnabled public Integer employees;    // -> Account.NumberOfEmployees
        @AuraEnabled public String website;
        @AuraEnabled public String intent;
        @AuraEnabled public Integer fitScore;
        @AuraEnabled public String recommendation;
        @AuraEnabled public String contactName;
        @AuraEnabled public String contactEmail;
    }

    /** Result returned to the client so it can navigate / toast. */
    public class ActionResult {
        @AuraEnabled public Id accountId;
        @AuraEnabled public Id dealId;
        @AuraEnabled public Boolean accountCreated;
        public ActionResult(Id acc, Id deal, Boolean created) {
            this.accountId = acc;
            this.dealId = deal;
            this.accountCreated = created;
        }
    }

    /**
     * Create (or reuse) an Account for the target company.
     * @return ActionResult with accountId (dealId null).
     */
    @AuraEnabled
    public static ActionResult createAccount(TargetInput target) {
        validate(target);
        Account acc = upsertAccount(target);
        return new ActionResult(acc.Id, null, true);
    }

    /**
     * Create an Account + a FinancialDeal representing the pipeline deal.
     */
    @AuraEnabled
    public static ActionResult addToPipeline(TargetInput target) {
        validate(target);
        Account acc = upsertAccount(target);
        FinancialDeal deal = createDeal(target, acc.Id);
        return new ActionResult(acc.Id, deal.Id, true);
    }

    /**
     * Create an Account + a FinancialDeal for outreach. The LWC then opens the
     * Email action on the returned FinancialDeal record.
     */
    @AuraEnabled
    public static ActionResult draftOutreach(TargetInput target) {
        validate(target);
        Account acc = upsertAccount(target);
        FinancialDeal deal = createDeal(target, acc.Id);
        return new ActionResult(acc.Id, deal.Id, true);
    }

    /* =====================================================================
     *  HELPERS
     * ===================================================================== */

    private static void validate(TargetInput target) {
        if (target == null || String.isBlank(target.company)) {
            throw new AuraHandledException('A target company is required.');
        }
    }

    /** Find an existing Account by name, or create a new one from the target. */
    private static Account upsertAccount(TargetInput target) {
        try {
            List<Account> existing = [
                SELECT Id FROM Account
                WHERE Name = :target.company
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            if (!existing.isEmpty()) {
                return existing[0];
            }

            Account acc = new Account(Name = target.company);
            if (String.isNotBlank(target.sector)) {
                acc.Industry = target.sector;
            }
            if (target.employees != null) {
                acc.NumberOfEmployees = target.employees;
            }
            if (String.isNotBlank(target.website)) {
                acc.Website = target.website;
            }
            if (String.isNotBlank(target.location)) {
                acc.Description = 'Sourced via market intelligence — ' + target.location +
                    (String.isNotBlank(target.revenue) ? ' · ' + target.revenue : '');
            }
            insert acc;
            return acc;
        } catch (DmlException de) {
            throw new AuraHandledException('Could not create the Account: ' + de.getDmlMessage(0));
        }
    }

    /** Create a FinancialDeal for the target, linked to the Account. */
    private static FinancialDeal createDeal(TargetInput target, Id accountId) {
        try {
            FinancialDeal deal = new FinancialDeal(
                Name = target.company + ' — Sourced Deal',
                AccountId = accountId
            );
            // Best-effort population of optional standard fields when present.
            assignIfExists(deal, 'Status', 'Open');
            assignIfExists(deal, 'Stage', 'Initial_Evaluation');
            insert deal;
            return deal;
        } catch (DmlException de) {
            throw new AuraHandledException('Could not create the Financial Deal: ' + de.getDmlMessage(0));
        }
    }

    /**
     * Set a field only if it exists and is createable on FinancialDeal, so the
     * controller stays portable across orgs with different field availability.
     */
    private static void assignIfExists(FinancialDeal deal, String fieldName, Object value) {
        Schema.SObjectField f =
            Schema.SObjectType.FinancialDeal.fields.getMap().get(fieldName);
        if (f != null && f.getDescribe().isCreateable()) {
            deal.put(fieldName, value);
        }
    }
}
