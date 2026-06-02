// Seed PE IR demo data for OPERS
Id acctId = '001Hu000040SBiUIAW';
Id rtId   = '012Hu000002zfRUIAY'; // InvestmentAccount

// ---- 3 active fund commitments ----
List<FinServ__FinancialAccount__c> fas = new List<FinServ__FinancialAccount__c>{
    new FinServ__FinancialAccount__c(
        Name='Cumulus Credit Partners III', RecordTypeId=rtId,
        FinServ__PrimaryOwner__c=acctId, FinServ__Status__c='Active',
        FinServ__Balance__c=150000000, Total_Called_Capital__c=93000000,
        Total_Distributions__c=41000000, Current_NAV__c=88000000),
    new FinServ__FinancialAccount__c(
        Name='Meridian Buyout Fund VII', RecordTypeId=rtId,
        FinServ__PrimaryOwner__c=acctId, FinServ__Status__c='Active',
        FinServ__Balance__c=100000000, Total_Called_Capital__c=45000000,
        Total_Distributions__c=12000000, Current_NAV__c=52000000),
    new FinServ__FinancialAccount__c(
        Name='Atlas Infrastructure Fund II', RecordTypeId=rtId,
        FinServ__PrimaryOwner__c=acctId, FinServ__Status__c='Active',
        FinServ__Balance__c=75000000, Total_Called_Capital__c=60000000,
        Total_Distributions__c=28000000, Current_NAV__c=49000000)
};
insert fas;

// ---- Ledger transactions (Credit = distribution, Debit = capital call) ----
List<FinServ__FinancialAccountTransaction__c> txns = new List<FinServ__FinancialAccountTransaction__c>();
Datetime now = System.now();
String[] refs = new String[]{'CALL-2024-08','CALL-2024-11','DIST-2025-02','CALL-2025-04','DIST-2025-05'};
Integer i = 0;
for (FinServ__FinancialAccount__c fa : fas) {
    txns.add(new FinServ__FinancialAccountTransaction__c(
        FinServ__FinancialAccount__c=fa.Id, FinServ__TransactionType__c='Debit',
        FinServ__Amount__c=20000000, FinServ__TransactionDate__c=now.addDays(-280),
        Reference_Code__c='CALL-'+(2024)+'-'+(i+1), Txn_Status__c='Settled'));
    txns.add(new FinServ__FinancialAccountTransaction__c(
        FinServ__FinancialAccount__c=fa.Id, FinServ__TransactionType__c='Debit',
        FinServ__Amount__c=15000000, FinServ__TransactionDate__c=now.addDays(-150),
        Reference_Code__c='CALL-'+(2025)+'-'+(i+1), Txn_Status__c='Settled'));
    txns.add(new FinServ__FinancialAccountTransaction__c(
        FinServ__FinancialAccount__c=fa.Id, FinServ__TransactionType__c='Credit',
        FinServ__Amount__c=10000000, FinServ__TransactionDate__c=now.addDays(-60),
        Reference_Code__c='DIST-'+(2025)+'-'+(i+1), Txn_Status__c='Settled'));
    txns.add(new FinServ__FinancialAccountTransaction__c(
        FinServ__FinancialAccount__c=fa.Id, FinServ__TransactionType__c='Debit',
        FinServ__Amount__c=8000000, FinServ__TransactionDate__c=now.addDays(-12),
        Reference_Code__c='CALL-2025-Q3-'+(i+1), Txn_Status__c='Pending'));
    i++;
}
insert txns;

// ---- Fundraising pipeline opportunities ----
List<Opportunity> opps = new List<Opportunity>{
    new Opportunity(Name='Cumulus Credit Partners IV - OPERS', AccountId=acctId,
        Fund_Offering_Name__c='Cumulus Credit Partners IV', Amount=125000000,
        StageName='Qualification', Probability=30, CloseDate=Date.today().addDays(90)),
    new Opportunity(Name='Meridian Growth Equity I - OPERS', AccountId=acctId,
        Fund_Offering_Name__c='Meridian Growth Equity I', Amount=80000000,
        StageName='Due Diligence', Probability=40, CloseDate=Date.today().addDays(60)),
    new Opportunity(Name='Atlas Renewables Fund III - OPERS', AccountId=acctId,
        Fund_Offering_Name__c='Atlas Renewables Fund III', Amount=95000000,
        StageName='Negotiation', Probability=65, CloseDate=Date.today().addDays(45)),
    new Opportunity(Name='Harborview Secondaries II - OPERS', AccountId=acctId,
        Fund_Offering_Name__c='Harborview Secondaries II', Amount=60000000,
        StageName='Closing - Legal and Docs', Probability=80, CloseDate=Date.today().addDays(30))
};
insert opps;

System.debug('Seeded FAs='+fas.size()+' Txns='+txns.size()+' Opps='+opps.size());
