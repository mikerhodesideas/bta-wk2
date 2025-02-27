/**
 * Google Ads Script: Search Term Report
 * Fetches search term data for the last 30 days segmented by campaign
 * No filters or constraints applied
 */

// Sheet URL provided by the user
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1QgNpe-HniHsMPLdHicegAg1ka01l-GNKbvOw_XBMNTM/edit?gid=0#gid=0';
const TAB = 'Search Terms';

// Query to fetch search term data
const QUERY = `
SELECT 
  campaign.id,
  campaign.name,
  search_term_view.search_term,
  search_term_view.status,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
AND campaign.advertising_channel_type = "SEARCH"
`;

// Headers for the output sheet
const HEADERS = [
    'Campaign ID',
    'Campaign',
    'Search Term',
    'Status',
    'Impr',
    'Clicks',
    'Cost',
    'Conv',
    'Value',
    'CTR',
    'CvR',
    'CPA',
    'ROAS',
    'AOV'
];

function main() {
    try {
        // Open the specified spreadsheet
        const ss = SpreadsheetApp.openByUrl(SHEET_URL);

        // Check if the tab exists, create it if not
        let sheet;
        try {
            sheet = ss.getSheetByName(TAB);
            if (!sheet) {
                sheet = ss.insertSheet(TAB);
            } else {
                // Clear existing data if sheet already exists
                sheet.clear();
            }
        } catch (e) {
            Logger.log("Error with sheet: " + e);
            return;
        }

        // Write headers
        sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

        // Execute the query
        Logger.log("Executing search term query...");
        const report = AdsApp.search(QUERY);

        // Process the data
        const data = processData(report);

        // Write data to sheet
        if (data.length > 0) {
            sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
            Logger.log("Data written to sheet: " + data.length + " rows");
        } else {
            Logger.log("No data found");
        }
    } catch (e) {
        Logger.log("Error in main function: " + e);
    }
}

function processData(report) {
    const data = [];
    let count = 0;

    try {
        while (report.hasNext()) {
            const row = report.next();
            count++;

            // Debug logging for first few rows
            if (count <= 3) {
                Logger.log("Sample row data: " + JSON.stringify(row));
            }

            // Extract raw metrics with null/undefined checks
            const campaignId = row['campaign.id'] || '';
            const campaignName = row['campaign.name'] || '';
            const searchTerm = row['search_term_view.search_term'] || '';
            const status = row['search_term_view.status'] || '';

            // Parse numeric values carefully
            const impr = parseInt(row['metrics.impressions']) || 0;
            const clicks = parseInt(row['metrics.clicks']) || 0;
            const costMicros = parseFloat(row['metrics.cost_micros']) || 0;
            const conv = parseFloat(row['metrics.conversions']) || 0;
            const value = parseFloat(row['metrics.conversions_value']) || 0;

            // Calculate derived metrics safely
            const cost = costMicros / 1000000;  // Convert micros to actual currency
            const ctr = impr > 0 ? clicks / impr : 0;
            const cvr = clicks > 0 ? conv / clicks : 0;
            const cpa = conv > 0 ? cost / conv : 0;
            const roas = cost > 0 ? value / cost : 0;
            const aov = conv > 0 ? value / conv : 0;

            // Add to data array
            data.push([
                campaignId,
                campaignName,
                searchTerm,
                status,
                impr,
                clicks,
                cost,
                conv,
                value,
                ctr,
                cvr,
                cpa,
                roas,
                aov
            ]);
        }

        // Sort by cost descending (default sort)
        return data.sort((a, b) => b[6] - a[6]);
    } catch (e) {
        Logger.log("Error processing data: " + e);
        return data; // Return whatever data we have so far
    }
} 