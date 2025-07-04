// simple google ads script to test that your OpenAI API key is working
// just add your OpenAI API key below (get one from https://platform.openai.com/api-keys)
// and run the script

const OPENAI_API_KEY = ''    // add your OpenAI API key here between the single quotes eg 'sk-proj-...'
const MODEL = 'gpt-4o-mini'
const PROMPT = 'What is the view from the top of the tallest mountain in the world?'

function main() {
    try {
        let output = generateTextOpenAI(PROMPT, OPENAI_API_KEY, MODEL); // output
        Logger.log('Text output: ' + output);
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
        "model": MODEL,
        "messages": messages
    };
    let httpOptions = {
        "method": "POST",
        "muteHttpExceptions": true,
        "contentType": "application/json",
        "headers": {
            "Authorization": 'Bearer ' + apiKey
        },
        "payload": JSON.stringify(payload)
    };
    let response = UrlFetchApp.fetch(url, httpOptions);
    let responseCode = response.getResponseCode();
    let responseContent = response.getContentText();

    let startTime = Date.now();
    while (response.getResponseCode() !== 200 && Date.now() - startTime < 15000) {
        Utilities.sleep(5000);
        response = UrlFetchApp.fetch(url, httpOptions);
        Logger.log('Time elapsed: ' + (Date.now() - startTime) / 1000 + ' seconds');
    }

    if (responseCode !== 200) {
        Logger.log(`Error: OpenAI API request failed with status ${responseCode}.`);
        Logger.log(`Read more about error codes here: https://platform.openai.com/docs/guides/error-codes/api-errors`)
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
