// Configuration and constants

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1B60gfk6h-IMCEWYf_qWpS6yySZQD8IUnvh9jz-Wtu5w/edit?gid=117479157#gid=117479157';

const CATEGORIES = {
    INFORMATIONAL: 'Queries seeking general information',
    NAVIGATIONAL: 'Queries looking for a specific website or page',
    COMMERCIAL: 'Queries with buying intent',
    LOCAL: 'Queries related to local businesses or services',
    QUESTION: 'Queries phrased as questions'
  };
  
  const MODELS = {
    CHEAP: 'gpt-4o-mini',
    PREMIUM: 'gpt-4o'
  };
  
  /**
   * Main function to orchestrate the classification process
   */
  function main() {
    try {
      Logger.log('Starting search term classification process');
      
      // Get sheet and settings
      const settings = getSheetSettings();
      if (!validateSettings(settings)) {
        Logger.log('Invalid settings. Script terminated.');
        return;
      }
  
      // Prepare OpenAI configuration
      const model = settings.cheap.toLowerCase() === 'yes' ? MODELS.CHEAP : MODELS.PREMIUM;
      Logger.log(`Using OpenAI model: ${model}`);
  
      // Process search terms
      const results = processSearchTerms(settings.searchTerms, settings.apiKey, model);
      
      // Write results back to sheet
      writeResultsToSheet(results, settings.spreadsheet);
      
      Logger.log('Classification process completed successfully');
    } catch (error) {
      Logger.log(`Error in main execution: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Retrieves and validates settings from the Google Sheet
   */
  function getSheetSettings() {
    try {
      const spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
      
      return {
        spreadsheet: spreadsheet,
        searchTerms: spreadsheet.getRangeByName('topTerms').getValues(),
        cheap: spreadsheet.getRangeByName('cheap').getValue(),
        apiKey: spreadsheet.getRangeByName('mike_key_openai').getValue()
      };
    } catch (error) {
      Logger.log(`Error getting sheet settings: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Validates the retrieved settings
   */
  function validateSettings(settings) {
    if (!settings.apiKey) {
      Logger.log('Error: OpenAI API key is missing');
      return false;
    }
    
    if (!settings.searchTerms || settings.searchTerms.length === 0) {
      Logger.log('Error: No search terms found');
      return false;
    }
    
    if (!settings.cheap || !['yes', 'no'].includes(settings.cheap.toLowerCase())) {
      Logger.log('Error: Invalid "cheap" setting. Must be "yes" or "no"');
      return false;
    }
    
    return true;
  }
  
  /**
   * Processes search terms using OpenAI API
   */
  function processSearchTerms(searchTerms, apiKey, model) {
    const results = [];
    const prompt = createClassificationPrompt();
    
    for (let i = 0; i < searchTerms.length; i++) {
      const term = searchTerms[i][0];
      if (!term) continue;
      
      try {
        Logger.log(`Processing term (${i + 1}/${searchTerms.length}): ${term}`);
        
        const fullPrompt = prompt.replace('{SEARCH_TERM}', term);
        const response = generateTextOpenAI(fullPrompt, apiKey, model);
        const parsed = parseOpenAIResponse(response);
        
        results.push({
          term: term,
          category: parsed.category,
          explanation: parsed.explanation
        });
        
        // Add delay to avoid rate limiting
        Utilities.sleep(1000);
      } catch (error) {
        Logger.log(`Error processing term "${term}": ${error.message}`);
        results.push({
          term: term,
          category: 'ERROR',
          explanation: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Creates the classification prompt for OpenAI
   */
  function createClassificationPrompt() {
    const categoriesText = Object.entries(CATEGORIES)
      .map(([category, description]) => `${category}: ${description}`)
      .join('\n');
      
    return `Classify the following search term into one of these categories:\n\n${categoriesText}\n\n` +
           `Search term: "{SEARCH_TERM}"\n\n` +
           `Respond in this format only:\n` +
           `Category: [CATEGORY_NAME]\n` +
           `Explanation: [Brief explanation for the classification]`;
  }
  
  /**
   * Parses the OpenAI response into structured data
   */
  function parseOpenAIResponse(response) {
    const categoryMatch = response.match(/Category:\s*([A-Z]+)/i);
    const explanationMatch = response.match(/Explanation:\s*(.+)/i);
    
    if (!categoryMatch || !explanationMatch) {
      throw new Error('Unable to parse AI response');
    }
    
    return {
      category: categoryMatch[1].trim().toUpperCase(),
      explanation: explanationMatch[1].trim()
    };
  }
  
  /**
   * Writes results back to the Google Sheet in a new "Results" tab
   */
  function writeResultsToSheet(results, spreadsheet) {
    try {
      // Create or get the Results sheet
      let resultsSheet;
      try {
        resultsSheet = spreadsheet.getSheetByName('Results');
        if (resultsSheet) {
          // Clear existing content if sheet exists
          resultsSheet.clear();
        } else {
          // Create new sheet if it doesn't exist
          resultsSheet = spreadsheet.insertSheet('Results');
        }
      } catch (error) {
        Logger.log(`Error handling Results sheet: ${error.message}`);
        throw error;
      }
  
      // Set up headers
      const headers = [['Search Term', 'Category', 'Explanation']];
      resultsSheet.getRange(1, 1, 1, 3).setValues(headers);
      
      // Format headers
      resultsSheet.getRange(1, 1, 1, 3)
        .setBackground('#f3f3f3')
        .setFontWeight('bold')
        .setBorder(true, true, true, true, true, true);
  
      // Prepare data for writing
      const resultsData = results.map(result => [
        result.term,
        result.category,
        result.explanation
      ]);
      
      // Write data
      if (resultsData.length > 0) {
        resultsSheet.getRange(2, 1, resultsData.length, 3).setValues(resultsData);
      }
      
      // Auto-resize columns to fit content
      resultsSheet.autoResizeColumns(1, 3);
      
      // Freeze header row
      resultsSheet.setFrozenRows(1);
      
      Logger.log(`Results written to "Results" sheet successfully (${results.length} rows)`);
      
      // Activate the Results sheet
      resultsSheet.activate();
      
    } catch (error) {
      Logger.log(`Error writing results to sheet: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Makes the API call to OpenAI
   */
  function generateTextOpenAI(prompt, apiKey, model) {
      Logger.log('Generating report with OpenAI');
      let url = 'https://api.openai.com/v1/chat/completions';
      let messages = [
          { "role": "user", "content": prompt }
      ];
      let payload = {
          "model": model,
          "messages": messages
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
      
      try {
          let response = UrlFetchApp.fetch(url, httpOptions);
          let responseCode = response.getResponseCode();
          
          if (responseCode !== 200) {
              throw new Error(`API request failed with status ${responseCode}: ${response.getContentText()}`);
          }
          
          let responseJson = JSON.parse(response.getContentText());
          let choices = responseJson.choices;
          
          if (!choices || choices.length === 0) {
              throw new Error('No response choices returned from API');
          }
          
          return choices[0].message.content;
      } catch (error) {
          Logger.log(`Error in OpenAI API call: ${error.message}`);
          throw error;
      }
  }