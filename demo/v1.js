// demo/v1-script.js

const SHEET_URL = ''; // Will create a new sheet if not provided
const TAB = 'Search Terms';

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
ORDER BY metrics.cost_micros DESC
`;

function main() {
    try {
        // Create or open spreadsheet
        let ss;
        if (!SHEET_URL) {
            ss = SpreadsheetApp.create("Google Ads Search Terms Report");
            let url = ss.getUrl();
            Logger.log("New spreadsheet created: " + url);
        } else {
            ss = SpreadsheetApp.openByUrl(SHEET_URL);
        }

        // Get or create the tab
        let sheet;
        try {
            sheet = ss.getSheetByName(TAB);
            if (!sheet) {
                sheet = ss.insertSheet(TAB);
            }
            sheet.clear();
        } catch (e) {
            Logger.log("Error setting up sheet: " + e);
            return;
        }

        // Execute the search query
        const rows = AdsApp.search(QUERY);

        // Log sample row structure for debugging
        const sampleQuery = QUERY + ' LIMIT 1';
        const sampleRows = AdsApp.search(sampleQuery);
        if (sampleRows.hasNext()) {
            const sampleRow = sampleRows.next();
            Logger.log("Sample row structure: " + JSON.stringify(sampleRow));
            Logger.log("metrics object: " + JSON.stringify(sampleRow.metrics));
        }

        // Process data
        const processedData = processData(rows);

        // Write to spreadsheet
        if (processedData.length > 0) {
            sheet.getRange(1, 1, processedData.length, processedData[0].length).setValues(processedData);
            Logger.log("Data written to spreadsheet.");
        } else {
            Logger.log("No data to write to spreadsheet.");
        }

    } catch (e) {
        Logger.log("Error in main function: " + e);
    }
}

function processData(rows) {
    // Create headers 
    const headers = [
        'Search Term',
        'Campaign',
        'Ad Group',
        'Impressions',
        'Clicks',
        'Cost',
        'Conversions',
        'Conv. Value',
        'CPC',
        'CTR',
        'Conv. Rate',
        'CPA',
        'ROAS',
        'AOV'
    ];

    // Start with headers
    const data = [headers];

    // Process rows
    while (rows.hasNext()) {
        try {
            const row = rows.next();

            // Access data properly with camelCase
            const searchTerm = row.searchTermView ? row.searchTermView.searchTerm : 'N/A';
            const campaignName = row.campaign ? row.campaign.name : 'N/A';
            const adGroupName = row.adGroup ? row.adGroup.name : 'N/A';

            // Get metrics and convert to numbers
            const metrics = row.metrics || {};
            const impressions = Number(metrics.impressions) || 0;
            const clicks = Number(metrics.clicks) || 0;
            const costMicros = Number(metrics.costMicros) || 0;
            const conversions = Number(metrics.conversions) || 0;
            const conversionValue = Number(metrics.conversionsValue) || 0;

            // Calculate derived metrics
            const cost = costMicros / 1000000;
            const cpc = clicks > 0 ? cost / clicks : 0;
            const ctr = impressions > 0 ? clicks / impressions : 0;
            const convRate = clicks > 0 ? conversions / clicks : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;
            const roas = cost > 0 ? conversionValue / cost : 0;
            const aov = conversions > 0 ? conversionValue / conversions : 0;

            // Add row to data
            data.push([
                searchTerm,
                campaignName,
                adGroupName,
                impressions,
                clicks,
                cost,
                conversions,
                conversionValue,
                cpc,
                ctr,
                convRate,
                cpa,
                roas,
                aov
            ]);

        } catch (e) {
            Logger.log("Error processing row: " + e);
            // Continue with next row
        }
    }

    return data;
}
