/**
 * Google Ads Script to classify search terms using OpenAI models
 * This script reads settings from a Google Sheet, classifies search terms,
 * and outputs results back to the sheet.
 */

// Model constants
const OPENAI_MODEL = "gpt-4o";
const OPENAI_CHEAP_MODEL = "gpt-4o-mini";

// Sheet URL
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1B60gfk6h-IMCEWYf_qWpS6yySZQD8IUnvh9jz-Wtu5w/edit?gid=117479157#gid=117479157";

// Classification categories
const CATEGORIES = [
  "INFORMATIONAL", // Queries seeking general information
  "NAVIGATIONAL",  // Queries looking for a specific website or page
  "COMMERCIAL",    // Queries with buying intent
  "LOCAL",         // Queries related to local businesses or services
  "QUESTION"       // Queries phrased as questions
];

/**
 * Main function to execute the script
 */
function main() {
  try {
    Logger.log("Starting search term classification script");
    
    // Access the spreadsheet
    const spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
    
    // Read settings
    const settings = readSettings(spreadsheet);
    Logger.log("Settings read: " + JSON.stringify(settings));
    
    // Validate settings
    validateSettings(settings);
    
    // Setup API key
    const apiKey = getAPIKey(spreadsheet);
    
    // Classify search terms
    const results = classifySearchTerms(settings, apiKey);
    
    // Output results
    outputResults(spreadsheet, results);
    
    Logger.log("Script completed successfully");
  } catch (error) {
    Logger.log("Error in main function: " + error);
    
    // Try to log error to spreadsheet if possible
    try {
      const spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
      logErrorToSheet(spreadsheet, error);
    } catch (e) {
      Logger.log("Could not log error to sheet: " + e);
    }
  }
}

/**
 * Read settings from the spreadsheet
 */
function readSettings(spreadsheet) {
  const settings = {};
  
  // Read cheap setting
  try {
    const cheapValue = spreadsheet.getRangeByName("cheap").getValue().toString().toLowerCase();
    settings.cheap = (cheapValue === "yes" || cheapValue === "true");
  } catch (e) {
    throw new Error("Could not read 'cheap' setting. Error: " + e);
  }
  
  // Read top terms
  try {
    const topTermsRange = spreadsheet.getRangeByName("topTerms");
    if (topTermsRange) {
      const values = topTermsRange.getValues();
      settings.topTerms = values.flat().filter(term => term && term.toString().trim() !== "");
    } else {
      throw new Error("topTerms named range not found");
    }
  } catch (e) {
    throw new Error("Could not read 'topTerms' setting. Error: " + e);
  }
  
  return settings;
}

/**
 * Validate the settings
 */
function validateSettings(settings) {
  // Validate topTerms
  if (!settings.topTerms || !Array.isArray(settings.topTerms) || settings.topTerms.length === 0) {
    throw new Error("No search terms found to classify");
  }
  
  Logger.log("Settings validated successfully");
}

/**
 * Get API key from the spreadsheet, using mike_ prefixed key if available
 */
function getAPIKey(spreadsheet) {
  const mikeKeyRange = spreadsheet.getRangeByName("mike_key_openai");
  const keyRange = spreadsheet.getRangeByName("key_openai");
  
  // Try mike_ key first, then fall back to key_
  let apiKey;
  if (mikeKeyRange && mikeKeyRange.getValue()) {
    apiKey = mikeKeyRange.getValue();
    Logger.log("Using mike_key_openai");
  } else if (keyRange && keyRange.getValue()) {
    apiKey = keyRange.getValue();
    Logger.log("Using key_openai");
  } else {
    throw new Error("No OpenAI API key found");
  }
  
  return apiKey;
}

/**
 * Classify search terms using OpenAI
 */
function classifySearchTerms(settings, apiKey) {
  const results = [];
  const modelToUse = settings.cheap ? OPENAI_CHEAP_MODEL : OPENAI_MODEL;
  
  Logger.log(`Classifying ${settings.topTerms.length} search terms using ${modelToUse}`);
  
  for (let i = 0; i < settings.topTerms.length; i++) {
    const term = settings.topTerms[i];
    Logger.log(`Processing term ${i+1}/${settings.topTerms.length}: ${term}`);
    
    let retryCount = 0;
    let success = false;
    let result;
    
    while (!success && retryCount < 3) {
      try {
        const startTime = new Date().getTime();
        result = classifyWithOpenAI(term, apiKey, modelToUse);
        
        const endTime = new Date().getTime();
        const duration = (endTime - startTime) / 1000;
        
        Logger.log(`Classification for "${term}" completed in ${duration} seconds`);
        
        result.term = term;
        result.duration = duration;
        success = true;
      } catch (error) {
        retryCount++;
        Logger.log(`Error classifying term "${term}" (attempt ${retryCount}/3): ${error}`);
        
        if (retryCount < 3) {
          // Exponential backoff
          const waitTime = Math.pow(2, retryCount) * 1000;
          Logger.log(`Waiting ${waitTime}ms before retry...`);
          Utilities.sleep(waitTime);
        } else {
          // After 3 attempts, record the error
          result = {
            term: term,
            category: "ERROR",
            confidence: 0,
            error: error.toString()
          };
        }
      }
    }
    
    results.push(result);
  }
  
  return results;
}

/**
 * Classify a search term using OpenAI
 */
function classifyWithOpenAI(term, apiKey, model) {
  Logger.log(`Classifying with OpenAI: "${term}" using ${model}`);
  
  const prompt = `Classify the following search term into exactly one of these categories: 
${CATEGORIES.join(", ")}

Search term: "${term}"

Respond with ONLY a JSON object in this EXACT format:
{
  "category": "ONE_OF_THE_CATEGORIES_ABOVE",
  "confidence": 0.XX (a number between 0 and 1)
}`;
  
  const url = 'https://api.openai.com/v1/chat/completions';
  const messages = [
    { "role": "user", "content": prompt }
  ];
  
  const payload = {
    "model": model,
    "messages": messages
  };
  
  const httpOptions = {
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
  
  const startTime = Date.now();
  while (responseCode !== 200 && Date.now() - startTime < 30000) {
    Utilities.sleep(5000);
    response = UrlFetchApp.fetch(url, httpOptions);
    responseCode = response.getResponseCode();
    responseContent = response.getContentText();
    Logger.log('Time elapsed: ' + (Date.now() - startTime) / 1000 + ' seconds');
  }
  
  if (responseCode !== 200) {
    Logger.log(`Error: OpenAI API request failed with status ${responseCode}.`);
    try {
      const errorResponse = JSON.parse(responseContent);
      Logger.log(`Error details: ${JSON.stringify(errorResponse.error)}`);
      throw new Error(errorResponse.error.message);
    } catch (e) {
      throw new Error(`OpenAI error (${responseCode}): ${responseContent}`);
    }
  }
  
  const responseJson = JSON.parse(responseContent);
  const text = responseJson.choices[0].message.content;
  
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    // Validate result
    if (!result.category || !CATEGORIES.includes(result.category)) {
      throw new Error(`Invalid category: ${result.category}`);
    }
    
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      Logger.log(`Invalid confidence value: ${result.confidence}, setting to 0.5`);
      result.confidence = 0.5;
    }
    
    return result;
  } catch (e) {
    throw new Error(`Failed to parse OpenAI response: ${e}. Response was: ${text}`);
  }
}

/**
 * Output results to a new sheet
 */
function outputResults(spreadsheet, results) {
  Logger.log("Outputting results to sheet");
  
  // Create or get "Results" sheet
  let resultsSheet;
  try {
    resultsSheet = spreadsheet.getSheetByName("Results");
    if (resultsSheet) {
      resultsSheet.clear();
    } else {
      resultsSheet = spreadsheet.insertSheet("Results");
    }
  } catch (e) {
    throw new Error("Could not create Results sheet: " + e);
  }
  
  // Set headers
  resultsSheet.getRange(1, 1, 1, 5).setValues([["Search Term", "Category", "Confidence", "Duration (sec)", "Error"]]);
  resultsSheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  
  // Add results
  const resultsData = results.map(result => [
    result.term,
    result.category,
    result.confidence ? result.confidence : "",
    result.duration ? result.duration : "",
    result.error ? result.error : ""
  ]);
  
  if (resultsData.length > 0) {
    resultsSheet.getRange(2, 1, resultsData.length, 5).setValues(resultsData);
  }
  
  // Auto-resize columns
  resultsSheet.autoResizeColumns(1, 5);
  
  Logger.log(`Results output complete. ${results.length} records written.`);
}

/**
 * Log an error to the spreadsheet
 */
function logErrorToSheet(spreadsheet, error) {
  try {
    // Create or get "Logs" sheet
    let logsSheet = spreadsheet.getSheetByName("Logs");
    if (!logsSheet) {
      logsSheet = spreadsheet.insertSheet("Logs");
      logsSheet.getRange(1, 1, 1, 3).setValues([["Timestamp", "Type", "Message"]]);
      logsSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    }
    
    // Add log entry
    const timestamp = new Date().toISOString();
    logsSheet.appendRow([timestamp, "ERROR", error.toString()]);
    
    // Auto-resize columns
    logsSheet.autoResizeColumns(1, 3);
    
    Logger.log("Error logged to sheet");
  } catch (e) {
    Logger.log("Failed to log error to sheet: " + e);
  }
}