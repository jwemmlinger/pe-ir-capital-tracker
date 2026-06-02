Id acctId = '001Hu000040SBiUIAW';
List<IRCapitalTrackerController.FundDTO> funds = IRCapitalTrackerController.getFunds(acctId);
for (IRCapitalTrackerController.FundDTO f : funds) {
    System.debug(f.name+' | raised%='+f.raisedPct+' | openOpps='+f.relatedOppCount+' | openAmt='+f.relatedOppAmount+' | totalOpps='+f.relatedOpps.size());
}
List<IRCapitalTrackerController.OpportunityDTO> pipe = IRCapitalTrackerController.getPipeline(acctId);
Integer linked = 0;
for (IRCapitalTrackerController.OpportunityDTO o : pipe) if (o.fundName != null) linked++;
System.debug('Pipeline opps='+pipe.size()+' linked to fund='+linked);
