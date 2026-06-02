// Seed / complete fully-populated Fund__c records for OPERS
Id acctId = '001Hu000040SBiUIAW';

// ---- Complete the two existing partially-filled funds ----
Fund__c venture = [SELECT Id FROM Fund__c WHERE Account__c=:acctId AND Name='Venture Alpha Fund I' LIMIT 1];
venture.Fund_Type__c                          = 'Private Equity';
venture.Status__c                             = 'Investing';
venture.Fundraising_Status__c                 = 'Accepting New Capital';
venture.Offering_Type__c                      = 'Private';
venture.Committed_Capital__c                  = 150000000;
venture.Invested__c                           = 93000000;
venture.Fund_Target_Amount__c                 = 250000000;
venture.Fundraising_Pipeline__c               = 107000000;
venture.Remaining_to_Goal__c                  = 100000000;
venture.Number_of_Investors__c                = 18;
venture.of_Deals_Invested__c                  = 11;
venture.Pending_Deals__c                      = 4;
venture.FINS_Vintage__c                       = '2025';
venture.FINS_Private_Equity_Management_Fee__c = 2.0;
venture.FINS_Private_Equity_Term__c           = 10;
venture.FINS_Private_Equity_Target_Size__c    = 250000000;
venture.FINS_Private_Equity_Fund_EIN__c       = '88-1234567';
venture.FINS_Private_Equity_Closed__c         = false;
venture.FINS_Fund_Long_Name__c                = 'Cumulus Venture Alpha Private Equity Fund I, L.P.';
venture.FINS_Fund_Short_Name__c               = 'Venture Alpha I';
venture.External_ID__c                        = 'FUND-VAF-1';
venture.Co_Invest__c                          = true;
venture.Close_Date__c                         = Date.newInstance(2026,10,31);
venture.Formation_Date__c                     = Date.newInstance(2024,1,15);
venture.Fund_Info__c                          = 'Cumulus Venture Alpha Private Equity Fund I is a forward-focused investment vehicle specializing in early to growth-stage companies with high disruptive potential. Focus on technology, healthcare, and emerging markets.';

Fund__c smallCap = [SELECT Id FROM Fund__c WHERE Account__c=:acctId AND Name='Small Cap Growth' LIMIT 1];
smallCap.Fund_Type__c                          = 'Equity';
smallCap.Status__c                             = 'Investing';
smallCap.Fundraising_Status__c                 = 'Closed';
smallCap.Offering_Type__c                      = 'Private';
smallCap.Committed_Capital__c                  = 80000000;
smallCap.Invested__c                           = 62000000;
smallCap.Fund_Target_Amount__c                 = 80000000;
smallCap.Fundraising_Pipeline__c               = 0;
smallCap.Remaining_to_Goal__c                  = 0;
smallCap.Number_of_Investors__c                = 12;
smallCap.of_Deals_Invested__c                  = 22;
smallCap.Pending_Deals__c                      = 2;
smallCap.FINS_Vintage__c                       = '2023';
smallCap.FINS_Private_Equity_Management_Fee__c = 1.75;
smallCap.FINS_Private_Equity_Term__c           = 8;
smallCap.FINS_Private_Equity_Target_Size__c    = 80000000;
smallCap.FINS_Private_Equity_Fund_EIN__c       = '88-7654321';
smallCap.FINS_Private_Equity_Closed__c         = true;
smallCap.FINS_Fund_Long_Name__c                = 'Cumulus Small Cap Growth Equity Fund, L.P.';
smallCap.FINS_Fund_Short_Name__c               = 'Small Cap Growth';
smallCap.External_ID__c                        = 'FUND-SCG-1';
smallCap.Co_Invest__c                          = false;
smallCap.Close_Date__c                         = Date.newInstance(2024,6,30);
smallCap.Formation_Date__c                     = Date.newInstance(2022,9,1);
smallCap.Fund_Info__c                          = 'Small Cap Growth targets U.S. small-capitalization equities with durable revenue growth and expanding margins. Concentrated portfolio of 20-25 high-conviction positions across industrials, consumer, and software.';

update new List<Fund__c>{ venture, smallCap };

// ---- Three brand-new, fully-populated funds ----
List<Fund__c> newFunds = new List<Fund__c>{
    new Fund__c(
        Name='Cumulus Credit Partners III', Account__c=acctId,
        Fund_Type__c='Credit', Status__c='Investing', Fundraising_Status__c='Closed',
        Offering_Type__c='Private', Committed_Capital__c=150000000, Invested__c=93000000,
        Fund_Target_Amount__c=150000000, Fundraising_Pipeline__c=0, Remaining_to_Goal__c=0,
        Number_of_Investors__c=27, of_Deals_Invested__c=34, Pending_Deals__c=5,
        FINS_Vintage__c='2022', FINS_Private_Equity_Management_Fee__c=1.5,
        FINS_Private_Equity_Term__c=7, FINS_Private_Equity_Target_Size__c=150000000,
        FINS_Private_Equity_Fund_EIN__c='88-2003001', FINS_Private_Equity_Closed__c=true,
        FINS_Fund_Long_Name__c='Cumulus Credit Partners Fund III, L.P.',
        FINS_Fund_Short_Name__c='Cumulus Credit III', External_ID__c='FUND-CCP-3',
        Co_Invest__c=true, Close_Date__c=Date.newInstance(2023,3,31),
        Formation_Date__c=Date.newInstance(2021,11,1),
        Fund_Info__c='Direct lending and opportunistic credit strategy targeting senior secured loans to lower-middle-market companies. Floating-rate income with downside protection through covenants and collateral.'),
    new Fund__c(
        Name='Meridian Buyout Fund VII', Account__c=acctId,
        Fund_Type__c='Private Equity', Status__c='Investing', Fundraising_Status__c='Accepting New Capital',
        Offering_Type__c='Private', Committed_Capital__c=100000000, Invested__c=45000000,
        Fund_Target_Amount__c=120000000, Fundraising_Pipeline__c=20000000, Remaining_to_Goal__c=20000000,
        Number_of_Investors__c=21, of_Deals_Invested__c=8, Pending_Deals__c=3,
        FINS_Vintage__c='2025', FINS_Private_Equity_Management_Fee__c=2.0,
        FINS_Private_Equity_Term__c=10, FINS_Private_Equity_Target_Size__c=120000000,
        FINS_Private_Equity_Fund_EIN__c='88-2007007', FINS_Private_Equity_Closed__c=false,
        FINS_Fund_Long_Name__c='Meridian Buyout Fund VII, L.P.',
        FINS_Fund_Short_Name__c='Meridian VII', External_ID__c='FUND-MBF-7',
        Co_Invest__c=true, Close_Date__c=Date.newInstance(2026,12,31),
        Formation_Date__c=Date.newInstance(2024,7,1),
        Fund_Info__c='Control-oriented buyouts of profitable middle-market businesses in business services, healthcare, and industrial technology. Operational value creation through margin expansion and buy-and-build.'),
    new Fund__c(
        Name='Atlas Infrastructure Fund II', Account__c=acctId,
        Fund_Type__c='Real Estate', Status__c='Liquidating', Fundraising_Status__c='Closed',
        Offering_Type__c='Private', Committed_Capital__c=75000000, Invested__c=60000000,
        Fund_Target_Amount__c=75000000, Fundraising_Pipeline__c=0, Remaining_to_Goal__c=0,
        Number_of_Investors__c=15, of_Deals_Invested__c=12, Pending_Deals__c=1,
        FINS_Vintage__c='2020', FINS_Private_Equity_Management_Fee__c=1.25,
        FINS_Private_Equity_Term__c=12, FINS_Private_Equity_Target_Size__c=75000000,
        FINS_Private_Equity_Fund_EIN__c='88-2002002', FINS_Private_Equity_Closed__c=true,
        FINS_Fund_Long_Name__c='Atlas Infrastructure Fund II, L.P.',
        FINS_Fund_Short_Name__c='Atlas Infra II', External_ID__c='FUND-AIF-2',
        Co_Invest__c=false, Close_Date__c=Date.newInstance(2021,2,28),
        Formation_Date__c=Date.newInstance(2019,10,1),
        Fund_Info__c='Core-plus infrastructure across renewable power, digital infrastructure, and regulated utilities. Long-duration, inflation-linked cash flows now in harvest/liquidation phase.')
};
insert newFunds;

System.debug('Funds updated=2 inserted='+newFunds.size());
