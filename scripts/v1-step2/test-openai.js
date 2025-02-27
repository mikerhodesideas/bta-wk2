const OPENAI_API_KEY = ''
const OPENAI_MODEL = "gpt-4o"
const OPENAI_CHEAP_MODEL = "gpt-4o-mini"
const PROMPT = "What's the view from the top of the tallest mountain in the world?"
const CHEAP = true;

function main() {
    if (CHEAP) {
        model = OPENAI_CHEAP_MODEL;
    } else {
        model = OPENAI_MODEL;
    }
    try {

        let start = new Date();
        let output = generateTextOpenAI(PROMPT, OPENAI_API_KEY, OPENAI_MODEL); // output

        Logger.log('Text output: ' + output);

        let end  = new Date();
        let dur = (end - start) / 1000;

        Logger.log('Time taken for script to run: ' + dur + ' seconds');

    } catch (error) {
        Logger.log('An error occurred: ' + error);
    }
}

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
    let response = UrlFetchApp.fetch(url, httpOptions);
    let responseCode = response.getResponseCode();
    let responseContent = response.getContentText();

    let startTime = Date.now();
    while (response.getResponseCode() !== 200 && Date.now() - startTime < 30000) {
        Utilities.sleep(5000);
        response = UrlFetchApp.fetch(url, httpOptions);
        Logger.log('Time elapsed: ' + (Date.now() - startTime) / 1000 + ' seconds');
    }

    if (responseCode !== 200) {
        Logger.log(`Error: OpenAI API request failed with status ${responseCode}.`);
        Logger.log(`Read more about error codes here: https://help.openai.com/en/articles/6891839-api-error-codes`)
        try {
            let errorResponse = JSON.parse(responseContent);
            Logger.log(`Error details: ${errorResponse.error}`);
            return `Error: ${errorResponse.error.message}`;
        } catch (e) {
            Logger.log('Error parsing OpenAI API error response.');
            return 'Error: Failed to parse the OpenAI API error response.';
        }
    }

    let responseJson = JSON.parse(response.getContentText());
    let choices = responseJson.choices;
    let text = choices[0].message.content;
    return (text);
}
