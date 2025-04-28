// classify search terms using openAI
// just add your OpenAI API key to the sheet this time & use a named range (key_openai)
// create a named range for a range containing the terms you want to test (topTerms)
// and run the script


const SHEET_URL = "https://docs.google.com/spreadsheets/d/1B60gfk6h-IMCEWYf_qWpS6yySZQD8IUnvh9jz-Wtu5w/";
const OPENAI_MODEL = "gpt-4o-mini";

// Cost per million tokens (in USD)
const COST_PER_1M_INPUT_TOKENS = 0.15;
const COST_PER_1M_OUTPUT_TOKENS = 0.60;

// Categories
const CATEGORIES = {
    PRIMARY: ["Swimwear", "Fashion", "Services", "Information/How-to", "Location-based", "Other"],
    INTENT: ["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "LOCAL", "QUESTION"]
};

// Global counters for token usage
let totalInputTokens = 0;
let totalOutputTokens = 0;

function main() {
    try {
        const apiKey = getApiKey();
        const ss = SpreadsheetApp.openByUrl(SHEET_URL);
        const terms = ss.getRangeByName('topTerms').getValues();

        // Create or get Results sheet and clear it
        let resultsSheet = ss.getSheetByName('Results');
        if (!resultsSheet) {
            resultsSheet = ss.insertSheet('Results');
        } else {
            resultsSheet.clear();
        }

        // Set up headers
        const headers = ['Search Term', 'Primary Category', 'Search Intent', 'Tokens Used', 'Cost (USD)'];
        resultsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Format headers
        resultsSheet.getRange(1, 1, 1, headers.length)
            .setFontWeight('bold')
            .setBackground('#E8EAED');

        // Process each term
        let results = [];
        terms.forEach((row, index) => {
            const term = row[0];
            if (!term) return; // Skip empty rows

            const prompt = `Classify the following Google Ads search term: "${term}"
                Please provide two classifications:
                1. Primary Category (choose one): ${CATEGORIES.PRIMARY.join(', ')}
                2. Search Intent (choose one): 
                - INFORMATIONAL (queries seeking general information)
                - NAVIGATIONAL (queries looking for a specific website or page)
                - COMMERCIAL (queries with buying intent)
                - LOCAL (queries related to local businesses or services)
                - QUESTION (queries phrased as questions)

                Return ONLY the two classifications separated by a pipe character (|) like this example:
                Swimwear|COMMERCIAL`;

            const { classification, inputTokens, outputTokens, cost } = generateTextOpenAI(prompt, apiKey, OPENAI_MODEL);
            const [category, intent] = classification.split('|');

            results.push([
                term,
                category.trim(),
                intent.trim(),
                `${inputTokens}/${outputTokens}`,
                cost.toFixed(4)
            ]);

            // Write results in batches
            if (results.length === 10 || index === terms.length - 1) {
                const startRow = resultsSheet.getLastRow() + 1;
                resultsSheet.getRange(startRow, 1, results.length, 5).setValues(results);
                results = [];
            }

            // Avoid rate limits
            Utilities.sleep(1000);
        });

        // Add summary row
        const totalCost = (totalInputTokens * COST_PER_1M_INPUT_TOKENS + totalOutputTokens * COST_PER_1M_OUTPUT_TOKENS) / 1000000;
        const summaryRow = [
            'TOTAL',
            '',
            '',
            `${totalInputTokens}/${totalOutputTokens}`,
            totalCost.toFixed(4)
        ];
        const lastRow = resultsSheet.getLastRow() + 1;
        resultsSheet.getRange(lastRow, 1, 1, 5).setValues([summaryRow])
            .setFontWeight('bold')
            .setBackground('#E8EAED');

        // Auto-resize columns
        resultsSheet.autoResizeColumns(1, 5);

        Logger.log(`Classification complete! Total cost: $${totalCost.toFixed(4)}`);
        Logger.log(`Total tokens used - Input: ${totalInputTokens}, Output: ${totalOutputTokens}`);

    } catch (error) {
        Logger.log('An error occurred: ' + error);
    }
}

// Get OpenAI API key from sheet
function getApiKey() {
    const ss = SpreadsheetApp.openByUrl(SHEET_URL);
    const keyRange = ss.getRangeByName('key_openai');
    if (!keyRange) {
        throw new Error('Named range "key_openai" not found in spreadsheet');
    }
    const key = keyRange.getValue();
    if (!key) {
        throw new Error('OpenAI API key not found in named range "key_openai"');
    }
    return key;
}

function generateTextOpenAI(prompt, apiKey, model) {
    let url = 'https://api.openai.com/v1/chat/completions';
    let messages = [
        { "role": "user", "content": prompt }
    ];
    let payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.3 // Lower temperature for more consistent classifications
    };
    let httpOptions = {
        "method": "POST",
        "muteHttpExceptions": true,
        "contentType": "application/json",
        "headers": {
            "Authorization": 'Bearer ' + apiKey
        },
        'payload': JSON.stringify(payload)
    };

    let response = UrlFetchApp.fetch(url, httpOptions);
    let responseCode = response.getResponseCode();
    let responseContent = response.getContentText();

    if (responseCode !== 200) {
        Logger.log(`Error: OpenAI API request failed with status ${responseCode}.`);
        throw new Error(`OpenAI API request failed: ${responseContent}`);
    }

    let responseJson = JSON.parse(responseContent);

    // Get token counts from response
    const inputTokens = responseJson.usage.prompt_tokens;
    const outputTokens = responseJson.usage.completion_tokens;

    // Calculate cost for this request
    const cost = (inputTokens * COST_PER_1M_INPUT_TOKENS + outputTokens * COST_PER_1M_OUTPUT_TOKENS) / 1000000;

    // Update global counters
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;

    return {
        classification: responseJson.choices[0].message.content.trim(),
        inputTokens,
        outputTokens,
        cost
    };
} 