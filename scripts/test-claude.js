const CLAUDE_API_KEY = '';
const CLAUDE_MODEL = 'claude-3-5-sonnet-latest';
const CLAUDE_CHEAP_MODEL = 'claude-3-5-haiku-latest';
const PROMPT = 'Describe the view from the top of the tallest mountain in the world?';
const CHEAP = true;

function main() {
    if (CHEAP) {
        model = CLAUDE_CHEAP_MODEL;
    } else {
        model = CLAUDE_MODEL;
    }
    try {
        let output = generateTextAnthropicAPI(PROMPT, CLAUDE_API_KEY, model); // output
        Logger.log('Output: ' + output);

    } catch (error) {
        Logger.log('An error occurred: ' + error);
    }
}

function generateTextAnthropicAPI(prompt, api_key, model) {
    Logger.log('Generating report with Anthropic API');
    let url = 'https://api.anthropic.com/v1/messages';
    let message = [
        { 'role': 'user', 'content': prompt }
    ];

    let payload = {
        'messages': message,
        'model': model,
        'max_tokens': 500
    };

    let httpOptions = {
        'method': 'POST',
        'muteHttpExceptions': true,
        'contentType': 'application/json',
        'headers': {
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01'
        },
        'payload': JSON.stringify(payload)
    };

    let response = UrlFetchApp.fetch(url, httpOptions);
    let rCode = response.getResponseCode();
    let rText = response.getContentText();

    let start = Date.now();
    while (rCode !== 200 && Date.now() - start < 10000) {
        Utilities.sleep(1000);
        response = UrlFetchApp.fetch(url, httpOptions);
    }

    if (rCode !== 200) {
        Logger.log(`Error: Anthropic API request failed with status ${rCode}.`);
        try {
            let errorResponse = JSON.parse(rText);
            return `Error: ${errorResponse.error.message}`;
        } catch (e) {
            return 'Error: Failed to parse the Anthropic API error response.';
        }
    }

    let rJson = JSON.parse(rText);

    let answerText;
    if (rJson && rJson.content && rJson.content.length > 0) {
        answerText = rJson.content[0].text;
    } else {
        answerText = 'No answer found in the response.';
    }

    return answerText; // Return the extracted text.

}