/**
 * DealRelationshipBoardController
 * ---------------------------------------------------------------------------
 * Loads and persists the configuration for the `dealRelationshipBoard` LWC.
 *
 * The board config (deal label/icon + the groups/cards/fields array) is stored
 * as JSON on a Deal_Relationship_Board__c record, keyed by the host record Id
 * (the Account/Opportunity page the board lives on) via the unique external-id
 * field Host_Record_Id__c. This lets each record page keep its own editable
 * board that survives refresh.
 * ---------------------------------------------------------------------------
 */
public with sharing class DealRelationshipBoardController {

    /**
     * Returns the saved Config_JSON__c for the given host record, or null if no
     * board has been saved yet (the LWC then renders its default board).
     *
     * @param hostRecordId  The record Id whose page hosts the board.
     */
    @AuraEnabled(cacheable=true)
    public static String getBoardConfig(String hostRecordId) {
        if (String.isBlank(hostRecordId)) {
            return null;
        }
        try {
            List<Deal_Relationship_Board__c> rows = [
                SELECT Config_JSON__c
                FROM Deal_Relationship_Board__c
                WHERE Host_Record_Id__c = :hostRecordId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            return rows.isEmpty() ? null : rows[0].Config_JSON__c;
        } catch (Exception e) {
            throw new AuraHandledException('Unable to load board config: ' + e.getMessage());
        }
    }

    /**
     * Upserts the board config for a host record. Uses the unique external id
     * Host_Record_Id__c so each host has exactly one board row.
     *
     * @param hostRecordId  The record Id whose page hosts the board.
     * @param configJson    The serialized board configuration to persist.
     * @return The Id of the saved Deal_Relationship_Board__c record.
     */
    @AuraEnabled
    public static Id saveBoardConfig(String hostRecordId, String configJson) {
        if (String.isBlank(hostRecordId)) {
            throw new AuraHandledException('A host record Id is required to save the board.');
        }
        // Validate that the payload is well-formed JSON before persisting.
        try {
            JSON.deserializeUntyped(configJson);
        } catch (Exception parseError) {
            throw new AuraHandledException('The board configuration is not valid JSON.');
        }

        try {
            Deal_Relationship_Board__c board = new Deal_Relationship_Board__c(
                Host_Record_Id__c = hostRecordId,
                Config_JSON__c    = configJson,
                Name              = 'Board ' + hostRecordId
            );
            // Upsert on the external id so re-saves update the same row.
            upsert board Host_Record_Id__c;
            return board.Id;
        } catch (DmlException de) {
            throw new AuraHandledException('Unable to save the board: ' + de.getDmlMessage(0));
        }
    }
}
