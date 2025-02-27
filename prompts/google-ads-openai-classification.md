# Prompt: Google Ads Script for OpenAI-Powered Search Term Intent Classification

Create a Google Ads script that reads search terms from a Google Ads account, classifies them based on user intent using OpenAI's API, and updates a Google Sheet with the classification results. The script should be entirely self-contained and executable within the Google Ads Scripts environment.

## Requirements:

1. **Data Access**:
   - Read search terms report data from the Google Ads account
   - Include key metrics with each search term: impressions, clicks, cost, conversions, and conversion value
   - Calculate and include derived metrics: CTR, conversion rate, average order value, ROAS, and CPA

2. **OpenAI Integration**:
   - Connect to OpenAI API using UrlFetchApp
   - Send batches of search terms to be classified
   - Implement proper error handling for API rate limits and failures
   - Use a clear prompt that instructs OpenAI to classify search terms by user intent

3. **Intent Classification Categories**:
   - Informational: User seeking information or answers
   - Navigational: User looking for a specific website or page
   - Transactional: User ready to make a purchase
   - Commercial Investigation: User researching products before buying

4. **Google Sheets Integration**:
   - Create or update a Google Sheet with the results
   - Include original search term, metrics, and intent classification
   - Implement sorting/filtering capability based on intent types

5. **Script Optimization**:
   - Handle pagination for large amounts of search terms
   - Respect Google Ads script execution time limit (30 minutes)
   - Implement logging for debugging and monitoring
   - Add comments explaining key parts of the code

## Technical Constraints:

1. Use proper error handling with try/catch blocks
2. Implement proper OpenAI API authentication
3. Follow Google Ads script best practices for performance
4. Use UrlFetchApp for all external API calls
5. Consider quota limitations (both Google Ads scripts and OpenAI API)

## Example Structure:

```javascript
// Configuration variables (API keys, sheet ID, etc.)
const OPENAI_API_KEY = 'YOUR_API_KEY';
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const DATE_RANGE = 'LAST_30_DAYS';

function main() {
  try {
    // 1. Fetch search terms from Google Ads
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

Please create a complete, working Google Ads script that implements all these requirements. The script should be ready for deployment in the Google Ads Scripts interface with minimal modifications (just needing API keys and Sheet IDs). 