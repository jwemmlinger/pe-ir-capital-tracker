// Link OPERS opportunities to their Fund__c via FINS_Private_Equity_Fund__c
Id acctId = '001Hu000040SBiUIAW';

Map<String,Id> fundByName = new Map<String,Id>();
for (Fund__c f : [SELECT Id, Name FROM Fund__c WHERE Account__c=:acctId]) {
    fundByName.put(f.Name, f.Id);
}

// Map opportunity name -> target fund name
Map<String,String> oppToFund = new Map<String,String>{
    'Cumulus Credit Partners IV - OPERS' => 'Cumulus Credit Partners III',
    'Meridian Growth Equity I - OPERS'   => 'Meridian Buyout Fund VII',
    'Atlas Renewables Fund III - OPERS'  => 'Atlas Infrastructure Fund II',
    'Harborview Secondaries II - OPERS'  => 'Small Cap Growth'
};

List<Opportunity> toUpdate = new List<Opportunity>();
for (Opportunity o : [SELECT Id, Name FROM Opportunity WHERE AccountId=:acctId AND Name IN :oppToFund.keySet()]) {
    Id fundId = fundByName.get(oppToFund.get(o.Name));
    if (fundId != null) {
        o.FINS_Private_Equity_Fund__c = fundId;
        toUpdate.add(o);
    }
}
update toUpdate;
System.debug('Linked '+toUpdate.size()+' opportunities to funds.');
