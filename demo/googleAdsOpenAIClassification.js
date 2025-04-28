// demo/googleAdsOpenAIClassification.js

// Configuration variables (sheet URL, model)
const SHEET_URL = 'YOUR_GOOGLE_SHEET_URL';
const OPENAI_MODEL = 'gpt-4o-mini';

/**
 * Entry point for the Google Ads script
 */
function main() {
    try {
        const apiKey = getOpenAIApiKey();
        const searchTerms = getSearchTerms();
        const classifiedResults = classifyWithOpenAI(apiKey, searchTerms);
        writeToSheet(classifiedResults);
        Logger.log('Classification complete. Processed ' + classifiedResults.length + ' search terms.');
    } catch (error) {
        Logger.log('Error: ' + error);
    }
}

/**
 * Retrieves the OpenAI API key from the named range 'openaiApiKey'
 */
function getOpenAIApiKey() {
    const sheet = SpreadsheetApp.openByUrl(SHEET_URL);
    const range = sheet.getRangeByName('openaiApiKey');
    const apiKey = range.getValue();
    if (!apiKey) {
        throw new Error(
            'OpenAI API key not found. Please set it in the named range "openaiApiKey". Get one from https://platform.openai.com/api-keys'
        );
    }
    return apiKey;
}

/**
 * Fetches search terms from the named range 'topTerms'
 * @returns {string[]} Array of search query strings
 */
function getSearchTerms() {
    const sheet = SpreadsheetApp.openByUrl(SHEET_URL);
    const range = sheet.getRangeByName('topTerms');
    const values = range.getValues();
    // Flatten 2D array to 1D and filter out empty rows
    return values.map(row => row[0]).filter(term => term);
}

/**
 * Calls the OpenAI Chat Completions API to classify search terms
 * @param {string} apiKey - OpenAI API key
 * @param {string[]} searchTerms - Array of search queries
 * @returns {{query: string, category: string}[]} Classification results
 */
function classifyWithOpenAI(apiKey, searchTerms) {
    const url = 'https://api.openai.com/v1/chat/completions';
    const systemPrompt = `You are an assistant that classifies search queries by user intent into these categories: INFORMATIONAL, COMMERCIAL, LOCAL, GEOGRAPHICAL, QUESTION, OTHER.

- INFORMATIONAL: Seeks general information without purchase intent (e.g., "what is chlorine resistance").
- COMMERCIAL: Indicates purchase intent or product exploration, including brand/product terms (e.g., "freya swimwear").
- LOCAL: Location-specific terms for nearby results at city/neighborhood level (e.g., "plumbing services near me").
- GEOGRAPHICAL: Queries filtering by country or broad region (e.g., "swimwear australia").
- QUESTION: Explicit questions phrased with question words (e.g., "how do I bake a cake").
- OTHER: Anything not fitting above categories.

Always choose Commercial for brand+product combos, Geographical for country mentions, Local for city/neighborhood, Question for questions, Informational for general info, and Other otherwise. Only output JSON array of objects like [{"query":"...","category":"..."}].`;

    const userPrompt = `Classify these search queries:\n${searchTerms
        .map((term, idx) => `${idx + 1}. ${term}`)
        .join('\n')}`;

    const payload = {
        model: OPENAI_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0
    };

    const options = {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();
    const body = response.getContentText();
    if (status !== 200) {
        throw new Error('OpenAI API request failed (' + status + '): ' + body);
    }

    const json = JSON.parse(body);
    const content = json.choices[0].message.content;
    let results;
    try {
        results = JSON.parse(content);
    } catch (err) {
        throw new Error('Failed to parse classification response: ' + content);
    }

    return results;
}

/**
 * Writes classification results to a 'Results' sheet
 * @param {{query: string, category: string}[]} results
 */
function writeToSheet(results) {
    const ss = SpreadsheetApp.openByUrl(SHEET_URL);
    let sheet = ss.getSheetByName('Results');
    if (!sheet) {
        sheet = ss.insertSheet('Results');
    }
    sheet.clearContents();
    sheet.appendRow(['Query', 'Category']);
    const rows = results.map(item => [item.query, item.category]);
    if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 2).setValues(rows);
    }
}