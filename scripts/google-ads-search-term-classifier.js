/**
 * Google Ads Script: Search Term Intent Classifier
 * 
 * This script:
 * 1. Connects to a Google Sheet containing search terms
 * 2. Uses OpenAI API to classify search terms by customer intent
 * 3. Writes results back to the spreadsheet
 * 4. Creates a summary report
 */

// Configuration variables
const OPENAI_API_KEY = ''; // Add your OpenAI API key here
const OPENAI_MODEL = "gpt-4o";
const OPENAI_CHEAP_MODEL = "gpt-4o-mini";
const SPREADSHEET_URL = ''; // Add your Google Sheet URL here
const USE_CHEAP_MODEL = true;
const SEARCH_TERMS_SHEET_NAME = 'Search Terms';
const RESULTS_SHEET_NAME = 'Classified Results';
const SUMMARY_SHEET_NAME = 'Summary Report';

// Column indices in the Search Terms sheet
const SEARCH_TERM_COL = 0;
const CATEGORY_COL = 1;
const CONFIDENCE_COL = 2;
const DATE_COL = 3;

// Intent categories
const INTENT_CATEGORIES = [
  'Informational', // User seeking information or answers
  'Navigational',  // User looking for a specific website or page
  'Transactional', // User ready to make a purchase or complete an action
  'Commercial',    // User comparing products, researching before purchase
];

/**
 * Main function - entry point for the script
 */
function main() {
  try {
    Logger.log('Starting search term intent classification script...');
    
    // Access the spreadsheet
    const spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    
    // Get search terms from the spreadsheet
    const searchTerms = getSearchTerms(spreadsheet);
    
    if (searchTerms.length === 0) {
      Logger.log('No search terms found to classify.');
      return;
    }
    
    Logger.log(`Found ${searchTerms.length} search terms to classify.`);
    
    // Classify each search term
    const classifiedTerms = classifySearchTerms(searchTerms);
    
    // Write results back to spreadsheet
    writeResultsToSpreadsheet(spreadsheet, classifiedTerms);
    
    // Generate and write summary report
    createSummaryReport(spreadsheet, classifiedTerms);
    
    Logger.log('Search term classification completed successfully.');
    
  } catch (error) {
    Logger.log(`Error in main function: ${error.message}`);
    Logger.log(`Stack trace: ${error.stack}`);
  }
}

/**
 * Retrieves search terms from the specified spreadsheet
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 * @return {Array} Array of search terms
 */
function getSearchTerms(spreadsheet) {
  try {
    const sheet = spreadsheet.getSheetByName(SEARCH_TERMS_SHEET_NAME);
    
    if (!sheet) {
      Logger.log(`Sheet "${SEARCH_TERMS_SHEET_NAME}" not found. Creating it...`);
      createSearchTermsSheet(spreadsheet);
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      // Only header row exists
      return [];
    }
    
    const dataRange = sheet.getRange(2, SEARCH_TERM_COL + 1, lastRow - 1, 1);
    const data = dataRange.getValues();
    
    // Filter out empty rows
    return data.filter(row => row[0] !== "").map(row => row[0]);
    
  } catch (error) {
    Logger.log(`Error getting search terms: ${error.message}`);
    return [];
  }
}

/**
 * Creates the Search Terms sheet if it doesn't exist
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 */
function createSearchTermsSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet(SEARCH_TERMS_SHEET_NAME);
  sheet.getRange('A1').setValue('Search Term');
  sheet.getRange('B1').setValue('Intent Category');
  sheet.getRange('C1').setValue('Confidence Score');
  sheet.getRange('D1').setValue('Date Classified');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 4);
}

/**
 * Classifies search terms using OpenAI API
 * @param {Array} searchTerms - Array of search terms to classify
 * @return {Array} Array of objects with classified search terms
 */
function classifySearchTerms(searchTerms) {
  const classifiedTerms = [];
  const model = USE_CHEAP_MODEL ? OPENAI_CHEAP_MODEL : OPENAI_MODEL;
  
  Logger.log(`Using OpenAI model: ${model}`);
  
  for (let i = 0; i < searchTerms.length; i++) {
    const searchTerm = searchTerms[i];
    
    try {
      Logger.log(`Classifying search term (${i+1}/${searchTerms.length}): "${searchTerm}"`);
      
      // Prepare the prompt for OpenAI
      const prompt = createClassificationPrompt(searchTerm);
      
      // Call OpenAI API
      const apiResponse = generateTextOpenAI(prompt, OPENAI_API_KEY, model);
      
      // Parse the response
      const classification = parseOpenAIResponse(apiResponse, searchTerm);
      
      classifiedTerms.push({
        searchTerm: searchTerm,
        category: classification.category,
        confidence: classification.confidence,
        date: new Date()
      });
      
      // Sleep to avoid rate limiting
      if (i < searchTerms.length - 1) {
        Utilities.sleep(1000);
      }
      
    } catch (error) {
      Logger.log(`Error classifying "${searchTerm}": ${error.message}`);
      
      classifiedTerms.push({
        searchTerm: searchTerm,
        category: "Error",
        confidence: 0,
        date: new Date()
      });
    }
  }
  
  return classifiedTerms;
}

/**
 * Creates the prompt for OpenAI to classify search term intent
 * @param {string} searchTerm - The search term to classify
 * @return {string} Formatted prompt for OpenAI
 */
function createClassificationPrompt(searchTerm) {
  return `Classify the following search term based on user intent into one of these categories: ${INTENT_CATEGORIES.join(', ')}.
  
Search term: "${searchTerm}"

Respond with ONLY a JSON object in this exact format:
{
  "category": "category_name",
  "confidence": confidence_score_between_0_and_1,
  "explanation": "brief_explanation_of_classification"
}`;
}

/**
 * Parses the OpenAI API response
 * @param {string} response - The text response from OpenAI
 * @param {string} searchTerm - The original search term (for error reporting)
 * @return {Object} Parsed category and confidence
 */
function parseOpenAIResponse(response, searchTerm) {
  try {
    // Extract JSON from the response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("No JSON object found in response");
    }
    
    const jsonStr = jsonMatch[0];
    const result = JSON.parse(jsonStr);
    
    // Validate response format
    if (!result.category || typeof result.confidence !== 'number') {
      throw new Error("Response missing required fields");
    }
    
    // Validate category is one of the expected values
    if (!INTENT_CATEGORIES.includes(result.category)) {
      Logger.log(`Warning: Category "${result.category}" for "${searchTerm}" is not in the predefined list. Using anyway.`);
    }
    
    return {
      category: result.category,
      confidence: result.confidence
    };
    
  } catch (error) {
    Logger.log(`Error parsing OpenAI response for "${searchTerm}": ${error.message}`);
    Logger.log(`Response was: ${response}`);
    
    return {
      category: "Error",
      confidence: 0
    };
  }
}

/**
 * Writes classification results back to the spreadsheet
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 * @param {Array} classifiedTerms - Array of classified search terms
 */
function writeResultsToSpreadsheet(spreadsheet, classifiedTerms) {
  try {
    // Create or get the results sheet
    let resultsSheet = spreadsheet.getSheetByName(RESULTS_SHEET_NAME);
    
    if (!resultsSheet) {
      resultsSheet = spreadsheet.insertSheet(RESULTS_SHEET_NAME);
      resultsSheet.getRange('A1').setValue('Search Term');
      resultsSheet.getRange('B1').setValue('Intent Category');
      resultsSheet.getRange('C1').setValue('Confidence Score');
      resultsSheet.getRange('D1').setValue('Date Classified');
      resultsSheet.setFrozenRows(1);
    }
    
    // Clear existing data (except header)
    const lastRow = resultsSheet.getLastRow();
    if (lastRow > 1) {
      resultsSheet.getRange(2, 1, lastRow - 1, 4).clearContent();
    }
    
    // Prepare data for writing
    const resultsData = classifiedTerms.map(term => [
      term.searchTerm,
      term.category,
      term.confidence,
      term.date
    ]);
    
    // Write data to sheet
    if (resultsData.length > 0) {
      resultsSheet.getRange(2, 1, resultsData.length, 4).setValues(resultsData);
      
      // Format confidence as percentage
      resultsSheet.getRange(2, 3, resultsData.length, 1).setNumberFormat("0.00%");
      
      // Format date column
      resultsSheet.getRange(2, 4, resultsData.length, 1).setNumberFormat("yyyy-MM-dd HH:mm:ss");
      
      // Auto-resize columns
      resultsSheet.autoResizeColumns(1, 4);
    }
    
    Logger.log(`Results saved to "${RESULTS_SHEET_NAME}" sheet.`);
    
  } catch (error) {
    Logger.log(`Error writing results to spreadsheet: ${error.message}`);
  }
}

/**
 * Creates a summary report of the classifications
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 * @param {Array} classifiedTerms - Array of classified search terms
 */
function createSummaryReport(spreadsheet, classifiedTerms) {
  try {
    // Create or get the summary sheet
    let summarySheet = spreadsheet.getSheetByName(SUMMARY_SHEET_NAME);
    
    if (!summarySheet) {
      summarySheet = spreadsheet.insertSheet(SUMMARY_SHEET_NAME);
    } else {
      summarySheet.clear();
    }
    
    // Add title and timestamp
    summarySheet.getRange('A1').setValue("Search Term Intent Classification Summary");
    summarySheet.getRange('A2').setValue(`Generated on: ${new Date().toLocaleString()}`);
    
    // Count occurrences of each category
    const categoryCounts = {};
    let totalClassified = 0;
    let errorsCount = 0;
    
    classifiedTerms.forEach(term => {
      if (term.category === "Error") {
        errorsCount++;
      } else {
        categoryCounts[term.category] = (categoryCounts[term.category] || 0) + 1;
        totalClassified++;
      }
    });
    
    // Write category counts
    summarySheet.getRange('A4').setValue("Intent Category");
    summarySheet.getRange('B4').setValue("Count");
    summarySheet.getRange('C4').setValue("Percentage");
    
    let row = 5;
    for (const category of INTENT_CATEGORIES) {
      const count = categoryCounts[category] || 0;
      const percentage = totalClassified > 0 ? count / totalClassified : 0;
      
      summarySheet.getRange(row, 1).setValue(category);
      summarySheet.getRange(row, 2).setValue(count);
      summarySheet.getRange(row, 3).setValue(percentage);
      
      row++;
    }
    
    // Add total row
    summarySheet.getRange(row, 1).setValue("Total Classified");
    summarySheet.getRange(row, 2).setValue(totalClassified);
    
    // Add errors row if any
    if (errorsCount > 0) {
      row++;
      summarySheet.getRange(row, 1).setValue("Errors/Unclassified");
      summarySheet.getRange(row, 2).setValue(errorsCount);
    }
    
    // Format percentages
    summarySheet.getRange(5, 3, INTENT_CATEGORIES.length, 1).setNumberFormat("0.00%");
    
    // Format headers
    summarySheet.getRange('A1:C1').merge();
    summarySheet.getRange('A1:C1').setFontWeight('bold').setHorizontalAlignment('center');
    summarySheet.getRange('A4:C4').setFontWeight('bold');
    
    // Auto-resize columns
    summarySheet.autoResizeColumns(1, 3);
    
    Logger.log(`Summary report created in "${SUMMARY_SHEET_NAME}" sheet.`);
    
  } catch (error) {
    Logger.log(`Error creating summary report: ${error.message}`);
  }
}

/**
 * Calls the OpenAI API to generate text based on a prompt
 * Based on the provided sample code
 * @param {string} prompt - The prompt to send to OpenAI
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - OpenAI model to use
 * @return {string} The generated text response
 */
function generateTextOpenAI(prompt, apiKey, model) {
  Logger.log('Calling OpenAI API...');
  
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
  
  // Retry logic if needed
  let startTime = Date.now();
  while (responseCode !== 200 && Date.now() - startTime < 30000) {
    Logger.log(`Retrying API call (status: ${responseCode})...`);
    Utilities.sleep(5000);
    response = UrlFetchApp.fetch(url, httpOptions);
    responseCode = response.getResponseCode();
    responseContent = response.getContentText();
    Logger.log(`Time elapsed: ${(Date.now() - startTime) / 1000} seconds`);
  }
  
  if (responseCode !== 200) {
    Logger.log(`Error: OpenAI API request failed with status ${responseCode}.`);
    Logger.log(`Read more about error codes here: https://help.openai.com/en/articles/6891839-api-error-codes`);
    
    try {
      const errorResponse = JSON.parse(responseContent);
      Logger.log(`Error details: ${JSON.stringify(errorResponse.error)}`);
      throw new Error(`OpenAI API Error: ${errorResponse.error.message}`);
    } catch (e) {
      Logger.log('Error parsing OpenAI API error response.');
      throw new Error('Failed to parse the OpenAI API error response.');
    }
  }
  
  const responseJson = JSON.parse(responseContent);
  const text = responseJson.choices[0].message.content;
  
  return text;
}