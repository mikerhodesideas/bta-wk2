const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1QgNpe-HniHsMPLdHicegAg1ka01l-GNKbvOw_XBMNTM/edit?gid=0#gid=0'; // leave blank or add a sheet here
const TAB = 'SearchTerms';

const mike_test = ''

// GAQL query for search terms
const QUERY = `
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
ORDER BY metrics.impressions DESC
`;

function main() {
  try {
    // is mike_test present & valid, set SHEET_URL to it's value
    sheet_url = mike_test ? mike_test : SHEET_URL;

    // Access the Google Sheet
    let ss;
    if (!sheet_url) {
      ss = SpreadsheetApp.create("Search Term Report");
      let url = ss.getUrl();
      Logger.log("No SHEET_URL found, so this sheet was created: " + url);
    } else {
      ss = SpreadsheetApp.openByUrl(sheet_url);
    }

    // Get or create the tab
    let sheet;
    try {
      sheet = ss.getSheetByName(TAB);
      if (!sheet) {
        sheet = ss.insertSheet(TAB);
      } else {
        // Clear existing data
        sheet.clear();
      }
    } catch (e) {
      Logger.log("Error with sheet: " + e);
      return;
    }

    // Set headers
    const headers = ["Search Term", "Campaign", "Ad Group", "Impressions", "Clicks", "Cost", "Conversions", "Conversion Value", "CPC", "CTR", "Conv Rate", "CPA", "ROAS", "AOV"];

    // Run the search term query
    const report = AdsApp.report(QUERY);
    const rows = report.rows();

    // Process data and calculate metrics
    const data = calculateMetrics(rows);

    // Write data to sheet (only if we have data)
    if (data.length > 0) {
      const allData = [headers, ...data];
      sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
      Logger.log("Successfully wrote " + data.length + " rows to the sheet.");
    } else {
      Logger.log("No data found for the specified criteria.");
    }

  } catch (e) {
    Logger.log("Error in main function: " + e);
  }
}

function calculateMetrics(rows) {
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