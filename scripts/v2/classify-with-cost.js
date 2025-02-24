/**
 * Google Ads Script to classify search terms using AI models
 * This script reads settings from a Google Sheet, classifies search terms,
 * and outputs results back to the sheet.
 */

// Model constants
const OPENAI_MODEL = "gpt-4o";
const OPENAI_CHEAP_MODEL = "gpt-4o-mini";
const ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";
const ANTHROPIC_CHEAP_MODEL = "claude-3-5-haiku-latest";
const GOOGLE_MODEL = "gemini-1.5-pro";
const GOOGLE_CHEAP_MODEL = "gemini-2.0-flash";

// Token cost constants (per million tokens)
const TOKEN_COSTS = {
  [OPENAI_MODEL]: { input: 2.5, output: 10 },         // 4o
  [OPENAI_CHEAP_MODEL]: { input: 0.15, output: 0.6 }, // 4o-mini
  [ANTHROPIC_MODEL]: { input: 3, output: 15 },        // 3.5-sonnet
  [ANTHROPIC_CHEAP_MODEL]: { input: 0.8, output: 4 }, // 3.5-haiku
  [GOOGLE_MODEL]: { input: 0, output: 0 },            // 1.5-pro
  [GOOGLE_CHEAP_MODEL]: { input: 0, output: 0 }       // 2.0-flash
};

// Token tracking object
let tokenCounts = {
  input: 0,
  output: 0
};

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

    // Reset token counts
    tokenCounts = { input: 0, output: 0 };

    // Access the spreadsheet
    const spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);

    // Read settings
    const settings = readSettings(spreadsheet);
    Logger.log("Settings read: " + JSON.stringify(settings));

    // Validate settings
    validateSettings(settings);

    // Setup API keys
    const apiKeys = getAPIKeys(spreadsheet, settings.model);

    // Classify search terms
    const results = classifySearchTerms(settings, apiKeys);

    // Output results
    outputResults(spreadsheet, results);

    // Calculate and log costs
    calculateCost(getModelVersion(settings.model, settings.cheap), tokenCounts);

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

  // Read model type
  try {
    settings.model = spreadsheet.getRangeByName("model").getValue().toLowerCase();
  } catch (e) {
    throw new Error("Could not read 'model' setting. Error: " + e);
  }

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
  // Validate model
  if (!["openai", "anthropic", "google"].includes(settings.model)) {
    throw new Error("Invalid model. Must be one of: openai, anthropic, google");
  }

  // Validate topTerms
  if (!settings.topTerms || !Array.isArray(settings.topTerms) || settings.topTerms.length === 0) {
    throw new Error("No search terms found to classify");
  }

  Logger.log("Settings validated successfully");
}

/**
 * Get API keys from the spreadsheet, using mike_ prefixed keys if available
 */
function getAPIKeys(spreadsheet, model) {
  let mikeKeyRange, keyRange;

  switch (model) {
    case "openai":
      mikeKeyRange = spreadsheet.getRangeByName("mike_key_openai");
      keyRange = spreadsheet.getRangeByName("key_openai");
      break;
    case "anthropic":
      mikeKeyRange = spreadsheet.getRangeByName("mike_key_anthropic");
      keyRange = spreadsheet.getRangeByName("key_anthropic");
      break;
    case "google":
      mikeKeyRange = spreadsheet.getRangeByName("mike_key_google");
      keyRange = spreadsheet.getRangeByName("key_google");
      break;
  }

  // Try mike_ key first, then fall back to key_
  let apiKey;
  if (mikeKeyRange && mikeKeyRange.getValue()) {
    apiKey = mikeKeyRange.getValue();
    Logger.log(`Using mike_key_${model}`);
  } else if (keyRange && keyRange.getValue()) {
    apiKey = keyRange.getValue();
    Logger.log(`Using key_${model}`);
  } else {
    throw new Error(`No API key found for ${model}`);
  }

  return apiKey;
}

/**
 * Classify search terms using the selected model
 */
function classifySearchTerms(settings, apiKey) {
  const results = [];
  const modelToUse = getModelVersion(settings.model, settings.cheap);


  for (let i = 0; i < settings.topTerms.length; i++) {
    const term = settings.topTerms[i];

    let retryCount = 0;
    let success = false;
    let result;

    while (!success && retryCount < 3) {
      try {
        const startTime = new Date().getTime();

        switch (settings.model) {
          case "openai":
            result = classifyWithOpenAI(term, apiKey, modelToUse);
            break;
          case "anthropic":
            result = classifyWithAnthropic(term, apiKey, modelToUse);
            break;
          case "google":
            result = classifyWithGoogle(term, apiKey, modelToUse);
            break;
        }

        const endTime = new Date().getTime();
        const duration = (endTime - startTime) / 1000;

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
 * Get the appropriate model version based on model type and 'cheap' setting
 */
function getModelVersion(model, cheap) {
  switch (model) {
    case "openai":
      return cheap ? OPENAI_CHEAP_MODEL : OPENAI_MODEL;
    case "anthropic":
      return cheap ? ANTHROPIC_CHEAP_MODEL : ANTHROPIC_MODEL;
    case "google":
      return cheap ? GOOGLE_CHEAP_MODEL : GOOGLE_MODEL;
    default:
      throw new Error(`Unknown model type: ${model}`);
  }
}

/**
 * Classify a search term using OpenAI
 */
function classifyWithOpenAI(term, apiKey, model) {

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

  const response = UrlFetchApp.fetch(url, httpOptions);
  const responseJson = JSON.parse(response.getContentText());

  // Track token usage
  if (responseJson.usage) {
    tokenCounts.input += responseJson.usage.prompt_tokens;
    tokenCounts.output += responseJson.usage.completion_tokens;
  }

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
 * Classify a search term using Anthropic
 */
function classifyWithAnthropic(term, apiKey, model) {

  const prompt = `Classify the following search term into exactly one of these categories: 
${CATEGORIES.join(", ")}

Search term: "${term}"

Respond with ONLY a JSON object in this EXACT format:
{
  "category": "ONE_OF_THE_CATEGORIES_ABOVE",
  "confidence": 0.XX (a number between 0 and 1)
}`;

  const url = 'https://api.anthropic.com/v1/messages';
  const message = [
    { 'role': 'user', 'content': prompt }
  ];

  const payload = {
    'messages': message,
    'model': model,
    'max_tokens': 500
  };

  const httpOptions = {
    'method': 'POST',
    'muteHttpExceptions': true,
    'contentType': 'application/json',
    'headers': {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
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
    Logger.log(`Error: Anthropic API request failed with status ${responseCode}.`);
    try {
      const errorResponse = JSON.parse(responseContent);
      throw new Error(errorResponse.error.message);
    } catch (e) {
      throw new Error(`Anthropic error (${responseCode}): ${responseContent}`);
    }
  }

  const responseJson = JSON.parse(responseContent);

  // Track token usage - Anthropic provides this in response.usage
  if (responseJson.usage) {
    tokenCounts.input += responseJson.usage.input_tokens;
    tokenCounts.output += responseJson.usage.output_tokens;
  }

  let answerText;

  if (responseJson && responseJson.content && responseJson.content.length > 0) {
    answerText = responseJson.content[0].text;
  } else {
    throw new Error('No answer found in the Anthropic response');
  }

  try {
    // Extract JSON from response
    const jsonMatch = answerText.match(/\{[\s\S]*\}/);
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
    throw new Error(`Failed to parse Anthropic response: ${e}. Response was: ${answerText}`);
  }
}

/**
 * Classify a search term using Google's Gemini
 */
function classifyWithGoogle(term, apiKey, model) {
  const prompt = `Classify the following search term into exactly one of these categories: 
${CATEGORIES.join(", ")}

Search term: "${term}"

Respond with ONLY a JSON object in this EXACT format:
{
  "category": "ONE_OF_THE_CATEGORIES_ABOVE",
  "confidence": 0.XX (a number between 0 and 1)
}`;

  // Generate the response
  const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generatePayload = {
    'contents': [{
      'parts': [{
        'text': prompt
      }]
    }],
    'generationConfig': {
      'maxOutputTokens': 500
    }
  };

  const generateOptions = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(generatePayload)
  };

  const response = UrlFetchApp.fetch(generateUrl, generateOptions);
  const responseCode = response.getResponseCode();
  const responseContent = response.getContentText();

  if (responseCode !== 200) {
    Logger.log(`Error: Google API request failed with status ${responseCode}.`);
    throw new Error(`Google API error (${responseCode}): ${responseContent}`);
  }

  const responseJson = JSON.parse(responseContent);

  // Track token usage from usageMetadata
  if (responseJson.usageMetadata) {
    tokenCounts.input += responseJson.usageMetadata.promptTokenCount;
    tokenCounts.output += responseJson.usageMetadata.candidatesTokenCount;
  }

  const text = responseJson.candidates[0].content.parts[0].text;

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
    throw new Error(`Failed to parse Google response: ${e}. Response was: ${text}`);
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

/**
 * Calculate total cost based on token usage
 */
function calculateCost(model, tokenCounts) {
  const costs = TOKEN_COSTS[model];
  if (!costs) {
    Logger.log(`Warning: No cost data for model ${model}`);
    return 0;
  }

  const inputCost = (tokenCounts.input / 1000000) * costs.input;
  const outputCost = (tokenCounts.output / 1000000) * costs.output;
  const totalCost = inputCost + outputCost;

  Logger.log(`Token usage - Input: ${tokenCounts.input}, Output: ${tokenCounts.output}`);
  Logger.log(`Cost breakdown - Input: $${inputCost.toFixed(4)}, Output: $${outputCost.toFixed(3)}`);
  Logger.log(`Total cost: $${totalCost.toFixed(3)}`);

  return totalCost;
}