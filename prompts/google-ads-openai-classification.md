# Google Ads Script for OpenAI-Powered Search Term Intent Classification

Create a Google Ads script that reads search terms from a Google Sheet, classifies them based on user intent using OpenAI's API, and updates the sheet with results.

## Requirements:

1. **Data Access**:
   - Read search terms from named range 'topTerms' in the Google Sheet 

2. **OpenAI Integration**:
   - Get API key from sheet's named range 'openaiApiKey'
   - Remind users to get one from https://platform.openai.com/api-keys if none found
   - Connect to OpenAI API using UrlFetchApp
   - Use a precisely crafted prompt for accurate classification (detailed below)

3. **Intent Classification Categories** (with clearer definitions):
   - INFORMATIONAL: Queries seeking general information without showing purchase intent or location specificity (e.g., "what is chlorine resistance")
   - COMMERCIAL: Queries showing purchase intent or product exploration, including brand names, product categories, or shopping terms (e.g., "freya swimwear", "kids swimwear", "funkita swimwear")
   - LOCAL: Queries specifically mentioning neighborhoods, cities, or precise locations that indicate a search for something nearby (NOT entire countries)
   - GEOGRAPHICAL: Queries mentioning countries or regions that aren't seeking nearby results but filtering by a broader area (e.g., "swimwear australia")
   - QUESTION: Queries explicitly phrased as questions (e.g., "how do I bake a cake")
   - OTHER: Any query that doesn't fit the above categories

4. **OpenAI Prompt Design**:
   - Instruct OpenAI to prioritize commercial intent for product-related searches
   - Create clear examples for each category to ensure consistent classification
   - Explicitly instruct that brand names + product categories should typically be COMMERCIAL
   - Specify that country mentions should be classified as GEOGRAPHICAL, not LOCAL

5. **Google Sheets Integration**:
   - Create/update a 'Results' tab with the original terms and classifications

6. **Script Optimization**:
   - Implement logging and proper error handling
   - Add explanatory comments

## Technical Constraints:

1. Use proper error handling with try/catch blocks
2. Implement proper OpenAI API authentication
3. Follow Google Ads script best practices for performance
4. Use UrlFetchApp for all external API calls
5. Consider quota limitations (both Google Ads scripts and OpenAI API)
6. Add a const SHEET_URL at the top of the script that will be used to access the Google Sheet

## Example Structure:

```javascript
// Configuration variables (sheet URL, model.)
const SHEET_URL = 'YOUR_GOOGLE_SHEET_URL';
const OPENAI_MODEL = 'gpt-4o-mini';

function main() {
  try {
    // 1. Fetch search terms from Google Sheet
    const searchTerms = getSearchTerms();
    
    // 2. Classify search terms using OpenAI
    const classifiedTerms = classifyWithOpenAI(searchTerms);
    
    // 3. Write results to Google Sheet
    writeToSheet(classifiedTerms);
    
    // 4. Log summary
    Logger.log('Classification complete. Processed ' + searchTerms.length + ' search terms.');
  } catch (error) {
    Logger.log('Error: ' + error);
  }
}

// Implement the required helper functions...
```

Please create a complete, working Google Ads script in a new file that implements all these requirements. The script should be ready for deployment in the Google Ads Scripts interface with minimal modifications (just needing a sheet url). 