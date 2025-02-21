const SHEET_URL = ''; // leave blank or add a sheet here
const SEARCH_TERMS_TAB = 'SearchTerms';
const DAILY_TAB = 'Daily';
const mike_test = ''

// GAQL query for search terms
const SEARCH_TERMS_QUERY = `
SELECT 
  search_term_view.search_term, 
  campaign.name,
  ad_group.name,
  metrics.impressions, 
  metrics.clicks, 
  metrics.cost_micros, 
  metrics.conversions, 
  metrics.conversions_value
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
  AND campaign.advertising_channel_type = "SEARCH"
  AND metrics.impressions >= 30
ORDER BY metrics.cost_micros DESC
`;

// GAQL query for daily campaign data
const DAILY_QUERY = `
SELECT
  campaign.name,
  campaign.id,
  metrics.clicks,
  metrics.search_budget_lost_impression_share,
  metrics.search_impression_share,
  metrics.search_rank_lost_impression_share,
  metrics.conversions_value,
  metrics.conversions,
  metrics.cost_micros,
  metrics.impressions,
  segments.date
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
  AND campaign.advertising_channel_type = "SEARCH"
ORDER BY segments.date DESC, metrics.cost_micros DESC
`;

function main() {
  try {
    // is mike_test present & valid, set SHEET_URL to it's value
    let sheet_url;
    if (mike_test) {
      sheet_url = mike_test;
    } else {
      sheet_url = SHEET_URL;
    }
    
    // Access the Google Sheet
    let ss;
    if (!sheet_url) {
      ss = SpreadsheetApp.create("Google Ads Report");
      let url = ss.getUrl();
      Logger.log("No SHEET_URL found, so this sheet was created: " + url);
    } else {
      ss = SpreadsheetApp.openByUrl(sheet_url);
    }
    
    // Process Search Terms tab
    processSearchTermsTab(ss);
    
    // Process Daily tab
    processDailyTab(ss);
    
  } catch (e) {
    Logger.log("Error in main function: " + e);
  }
}

function processSearchTermsTab(ss) {
  try {
    // Get or create the search terms tab
    let sheet;
    try {
      // Check if the old tab name exists and rename it
      sheet = ss.getSheetByName('Search_Terms');
      if (sheet) {
        sheet.setName(SEARCH_TERMS_TAB);
      } else {
        // Check if the new tab name exists
        sheet = ss.getSheetByName(SEARCH_TERMS_TAB);
        if (!sheet) {
          sheet = ss.insertSheet(SEARCH_TERMS_TAB);
        } else {
          // Clear existing data
          sheet.clear();
        }
      }
    } catch (e) {
      Logger.log("Error with search terms sheet: " + e);
      return;
    }
    
    // Set headers - using consistent naming with underscores instead of spaces
    const headers = ["search_term", "campaign", "ad_group", "impressions", "clicks", "cost", "conversions", "conversion_value", "cpc", "ctr", "conv_rate", "cpa", "roas", "aov"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    
    // Run the search term query
    const report = AdsApp.report(SEARCH_TERMS_QUERY);
    const rows = report.rows();
    
    // Process data and calculate metrics
    const data = calculateSearchTermsMetrics(rows);
    
    // Write data to sheet (only if we have data)
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
      Logger.log("Successfully wrote " + data.length + " rows to the search terms sheet.");
    } else {
      Logger.log("No data found for search terms.");
    }
  } catch (e) {
    Logger.log("Error in processSearchTermsTab function: " + e);
  }
}

function processDailyTab(ss) {
  try {
    // Get or create the daily tab
    let sheet;
    try {
      sheet = ss.getSheetByName(DAILY_TAB);
      if (!sheet) {
        sheet = ss.insertSheet(DAILY_TAB);
      } else {
        // Clear existing data
        sheet.clear();
      }
    } catch (e) {
      Logger.log("Error with daily sheet: " + e);
      return;
    }
    
    // Set headers - using consistent naming with underscores where needed
    const headers = ["campaign", "campaignId", "clicks", "lostBudget", "imprShare", "lostRank", "value", "conv", "cost", "impr", "date"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    
    // Run the daily query
    const report = AdsApp.report(DAILY_QUERY);
    const rows = report.rows();
    
    // Process the daily data
    const data = processDailyData(rows);
    
    // Write data to sheet (only if we have data)
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
      Logger.log("Successfully wrote " + data.length + " rows to the daily sheet.");
    } else {
      Logger.log("No data found for daily campaigns.");
    }
  } catch (e) {
    Logger.log("Error in processDailyTab function: " + e);
  }
}

function calculateSearchTermsMetrics(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    const searchTerm = row['search_term_view.search_term'];
    const campaign = row['campaign.name'];
    const adGroup = row['ad_group.name'];
    const impressions = parseInt(row['metrics.impressions'], 10) || 0;
    const clicks = parseInt(row['metrics.clicks'], 10) || 0;
    const costMicros = parseInt(row['metrics.cost_micros'], 10) || 0;
    const conversions = parseFloat(row['metrics.conversions']) || 0;
    const conversionValue = parseFloat(row['metrics.conversions_value']) || 0;
    
    // Calculate metrics
    const cost = costMicros / 1000000;  // Convert micros to actual currency
    const cpc = clicks > 0 ? cost / clicks : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const convRate = clicks > 0 ? conversions / clicks : 0;
    const cpa = conversions > 0 ? cost / conversions : 0;
    const roas = cost > 0 ? conversionValue / cost : 0;
    const aov = conversions > 0 ? conversionValue / conversions : 0;
    
    // Add all variables and calculated metrics to a new row
    const newRow = [searchTerm, campaign, adGroup, impressions, clicks, cost, conversions, conversionValue, cpc, ctr, convRate, cpa, roas, aov];
    
    // Push new row to the data array
    data.push(newRow);
  }
  return data;
}

function processDailyData(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    
    // Extract data according to the requested columns
    const campaign = String(row['campaign.name'] || '');
    const campaignId = String(row['campaign.id'] || '');
    const clicks = Number(row['metrics.clicks'] || 0);
    const lostBudget = Number(row['metrics.search_budget_lost_impression_share'] || 0);
    const imprShare = Number(row['metrics.search_impression_share'] || 0);
    const lostRank = Number(row['metrics.search_rank_lost_impression_share'] || 0);
    const value = Number(row['metrics.conversions_value'] || 0);
    const conv = Number(row['metrics.conversions'] || 0);
    const costMicros = Number(row['metrics.cost_micros'] || 0);
    const cost = costMicros / 1000000;  // Convert micros to actual currency
    const impr = Number(row['metrics.impressions'] || 0);
    const date = String(row['segments.date'] || '');
    
    // Create a new row with the data
    const newRow = [campaign, campaignId, clicks, lostBudget, imprShare, lostRank, value, conv, cost, impr, date];
    
    // Push new row to the data array
    data.push(newRow);
  }
  return data;
}