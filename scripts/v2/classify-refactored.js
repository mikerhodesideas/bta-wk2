// Week 2: Google Ads Script to classify search terms using AI models

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1B60gfk6h-IMCEWYf_qWpS6yySZQD8IUnvh9jz-Wtu5w/edit?gid=117479157#gid=117479157";
const CATEGORIES = ["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "LOCAL", "QUESTION"];
const MAX_RETRIES = 3;

// Model and cost configuration
const MODELS = {
    openai: {
        standard: 'gpt-4o',
        cheap: 'gpt-4o-mini',
        costs: { standard: { input: 2.5, output: 10 }, cheap: { input: 0.15, output: 0.6 } }
    },
    anthropic: {
        standard: 'claude-3-5-sonnet-latest',
        cheap: 'claude-3-5-haiku-latest',
        costs: { standard: { input: 3, output: 15 }, cheap: { input: 0.8, output: 4 } }
    },
    google: {
        standard: 'gemini-1.5-pro',
        cheap: 'gemini-2.0-flash',
        costs: { standard: { input: 0, output: 0 }, cheap: { input: 0, output: 0 } }
    }
};

// Token tracking
let tokenCounts = { input: 0, output: 0 };

function main() {
    try {
        Logger.log("Starting classification");
        const spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
        const settings = readAndValidateSettings(spreadsheet);
        const apiKey = getAPIKey(spreadsheet, settings.model);
        const results = classifyTerms(settings, apiKey);
        outputResults(spreadsheet, results);
        logCosts(settings);
    } catch (error) {
        handleError(error);
    }
}

function readAndValidateSettings(spreadsheet) {
    const settings = {
        model: spreadsheet.getRangeByName("model").getValue().toLowerCase(),
        cheap: spreadsheet.getRangeByName("cheap").getValue().toString().toLowerCase() === "true",
        topTerms: spreadsheet.getRangeByName("topTerms").getValues().flat().filter(term => term?.toString().trim())
    };

    if (!MODELS[settings.model]) throw new Error("Invalid model");
    if (!settings.topTerms.length) throw new Error("No search terms found");

    return settings;
}

function getAPIKey(spreadsheet, model) {
    const mikeKey = spreadsheet.getRangeByName(`mike_key_${model}`)?.getValue();
    const regularKey = spreadsheet.getRangeByName(`key_${model}`)?.getValue();
    const key = mikeKey || regularKey;

    if (!key) throw new Error(`No API key found for ${model}`);
    return key;
}

function classifyTerms(settings, apiKey) {
    const modelConfig = settings.model;
    const modelVersion = settings.cheap ? MODELS[settings.model].cheap : MODELS[settings.model].standard;
    const classifyFn = getClassifierFunction(settings.model);

    return settings.topTerms.map(term => {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const startTime = Date.now();
                const result = classifyFn(term, apiKey, modelVersion);
                return { ...result, term, duration: (Date.now() - startTime) / 1000 };
            } catch (error) {
                if (attempt === MAX_RETRIES - 1) {
                    return { term, category: "ERROR", confidence: 0, error: error.toString() };
                }
                Utilities.sleep(Math.pow(2, attempt) * 1000);
            }
        }
    });
}

function classifyTerm(term, apiKey, modelConfig) {
    const endpoints = {
        openai: {
            url: 'https://api.openai.com/v1/chat/completions',
            headers: { Authorization: `Bearer ${apiKey}` },
            createPayload: prompt => ({
                model: modelConfig,
                messages: [{ role: "user", content: prompt }]
            }),
            extractResponse: data => ({
                text: data.choices[0].message.content,
                usage: data.usage
            })
        },
        anthropic: {
            url: 'https://api.anthropic.com/v1/messages',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            createPayload: prompt => ({
                messages: [{ role: 'user', content: prompt }],
                model: modelConfig,
                max_tokens: 500
            }),
            extractResponse: data => ({
                text: data.content[0].text,
                usage: data.usage
            })
        },
        google: {
            url: `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig}:generateContent?key=${apiKey}`,
            headers: {},
            createPayload: prompt => ({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 500 }
            }),
            extractResponse: data => ({
                text: data.candidates[0].content.parts[0].text,
                usage: data.usageMetadata
            })
        }
    };

    const modelType = Object.keys(endpoints).find(key => modelConfig.toLowerCase().includes(key));
    if (!modelType) throw new Error(`Unknown model type: ${modelConfig}`);

    const config = endpoints[modelType];
    const prompt = createClassificationPrompt(term);

    const response = UrlFetchApp.fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify(config.createPayload(prompt))
    });

    if (response.getResponseCode() !== 200) {
        throw new Error(`API error (${response.getResponseCode()}): ${response.getContentText()}`);
    }

    const data = JSON.parse(response.getContentText());
    const { text, usage } = config.extractResponse(data);

    updateTokenCounts(usage);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    return validateResponse(JSON.parse(jsonMatch[0]));
}

function getClassifierFunction(model) {
    return (term, apiKey, modelVersion) => classifyTerm(term, apiKey, modelVersion);
}

function createClassificationPrompt(term) {
    return `Classify the following search term into exactly one of these categories: 
  ${CATEGORIES.join(", ")}
  
  Search term: "${term}"
  
  Respond with ONLY a JSON object in this EXACT format:
  {
    "category": "ONE_OF_THE_CATEGORIES_ABOVE",
    "confidence": 0.XX (a number between 0 and 1)
  }`;
}

function validateResponse(result) {
    if (!result.category || !CATEGORIES.includes(result.category)) {
        throw new Error(`Invalid category: ${result.category}`);
    }
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
        result.confidence = 0.5;
    }
    return result;
}

function updateTokenCounts(usage) {
    if (!usage) return;
    tokenCounts.input += usage.prompt_tokens || usage.input_tokens || usage.promptTokenCount || 0;
    tokenCounts.output += usage.completion_tokens || usage.output_tokens || usage.candidatesTokenCount || 0;
}

function outputResults(spreadsheet, results) {
    const resultsSheet = spreadsheet.getSheetByName("Results") || spreadsheet.insertSheet("Results");
    resultsSheet.clear();

    resultsSheet.getRange(1, 1, 1, 5)
        .setValues([["Search Term", "Category", "Confidence", "Duration (sec)", "Error"]])
        .setFontWeight("bold");

    if (results.length) {
        resultsSheet.getRange(2, 1, results.length, 5).setValues(
            results.map(r => [r.term, r.category, r.confidence || "", r.duration || "", r.error || ""])
        );
    }

    resultsSheet.autoResizeColumns(1, 5);
}

function logCosts(settings) {
    const modelConfig = settings.model;
    const modelVersion = settings.cheap ? MODELS[settings.model].cheap : MODELS[settings.model].standard;
    const costs = settings.cheap ? MODELS[settings.model].costs.cheap : MODELS[settings.model].costs.standard;

    const inputCost = (tokenCounts.input / 1000000) * costs.input;
    const outputCost = (tokenCounts.output / 1000000) * costs.output;

    Logger.log(`Tokens - Input: ${tokenCounts.input}, Output: ${tokenCounts.output}`);
    Logger.log(`Costs - Input: $${inputCost.toFixed(4)}, Output: $${outputCost.toFixed(4)}`);
    Logger.log(`Total: $${(inputCost + outputCost).toFixed(4)}`);
}

function handleError(error) {
    Logger.log(`Error: ${error}`);
    try {
        const spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
        const logsSheet = spreadsheet.getSheetByName("Logs") || spreadsheet.insertSheet("Logs");

        if (logsSheet.getRange(1, 1).getValue() === "") {
            logsSheet.getRange(1, 1, 1, 3)
                .setValues([["Timestamp", "Type", "Message"]])
                .setFontWeight("bold");
        }

        logsSheet.appendRow([new Date().toISOString(), "ERROR", error.toString()]);
        logsSheet.autoResizeColumns(1, 3);
    } catch (e) {
        Logger.log(`Could not log error to sheet: ${e}`);
    }
}