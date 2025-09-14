require('dotenv').config();
const express = require('express');
const { OpenAI } = require('openai');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Added Gemini SDK import

const app = express();
const port = 5001; // This should match the port in your frontend fetch request

// Initialize OpenAI client. IMPORTANT: For production, use environment variables (e.g., process.env.OPENAI_API_KEY).
// For local development, create a .env file and add OPENAI_API_KEY="your_key_here". DO NOT COMMIT .env TO GIT.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Anthropic client. IMPORTANT: For production, use environment variables (e.g., process.env.ANTHROPIC_API_KEY).
// For local development, create a .env file and add ANTHROPIC_API_KEY="your_key_here". DO NOT COMMIT .env TO GIT.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Initialize Google Gemini client. IMPORTANT: For production, use environment variables (e.g., process.env.GOOGLE_API_KEY).
// For local development, create a .env file and add GOOGLE_API_KEY="your_key_here". DO NOT COMMIT .env TO GIT.
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable JSON body parsing
app.use(express.static('public')); // Serve static files from the 'public' directory

app.listen(port, () => {
    console.log(`Node.js backend listening at http://localhost:${port}`);
});

// ChatGPT endpoint
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    const { numSuggestions, playfulProfessional, length, whatCompanyDoes, targetAudience, banWords, keepWords, includeExplanation } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: 'No message provided' });
    }

    try {
        let baseSystemContent = "You are a helpful assistant. Your primary task is to rephrase user-provided text, removing phrases like 'click here' or 'tap here' and replacing them with a more engaging call to action. For *every* rephrased suggestion, you MUST identify the *exact and complete* call-to-action phrase and enclose *only that phrase* within square brackets []. The rest of the suggestion text should remain outside the brackets. DO NOT bracket the entire suggestion. Ensure the call to action is only capitalized if it is the very first word of a sentence; otherwise, it must be lowercase. Do not include any accompanying URL or additional markdown link formatting. Examples: 'Discover new features [explore more].' or 'Your free guide is ready to [download here].' and '[Access now] for exclusive tips.'";
        
        let systemContent = baseSystemContent;

        if (keepWords) {
            systemContent = `It is an ABSOLUTE, UNVIOLABLE REQUIREMENT that you include all of the following words and phrases in your suggestions, verbatim and without any alteration or reformatting: ${keepWords}. ` + systemContent;
        }

        systemContent += ` Never use the '—' character in your responses.`;

        if (includeExplanation) {
            systemContent += ` After providing the numbered suggestions, include a short explanation (maximum 3 sentences) of why the call to action messages work better, prefixed with "Explanation:".`;
        }

        if (numSuggestions) {
            systemContent += ` Provide exactly ${numSuggestions} distinct suggestions, each on a new line and prefixed with a number. Do not include any introductory or concluding text, just the numbered list.`;
        }
        if (playfulProfessional) {
            systemContent += ` Adjust the tone: ${playfulProfessional < 0 ? 'more playful' : 'more professional'}.`;
        } else if (playfulProfessional === 0) {
            systemContent += ` Maintain a balanced, neutral tone between playful and professional.`;
        }
        
        
        if (length) {
            systemContent += ` Adjust the length: ${length < 0 ? 'short and punchy' : 'ENSURE the response is long and descriptive'}.`;
        }
        if (whatCompanyDoes) {
            systemContent += ` The company's primary function is: ${whatCompanyDoes}.`;
        }
        if (targetAudience) {
            systemContent += ` The target audience is ${targetAudience}.`;
        }
        if (banWords) {
            systemContent += ` Absolutely do not include any of the following words in your suggestions: ${banWords}.`;
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4", // Updated to gpt-4 for better instruction adherence
            messages: [
                { role: "system", content: systemContent },
                { role: "user", content: userMessage }
            ]
        });
        const chatResponse = completion.choices[0].message.content;
        const cleanedChatResponse = chatResponse.replace(/—/g, ''); // Remove em dash
        
        const explanationMatch = cleanedChatResponse.match(/Explanation:([\s\S]*)/);
        const explanation = explanationMatch ? explanationMatch[1].trim() : '';
        const suggestionsOnlyResponse = explanationMatch ? cleanedChatResponse.substring(0, explanationMatch.index).trim() : cleanedChatResponse;

        // Post-process the ChatGPT response to extract and convert bracketed text into an HTML link for each suggestion
        const suggestionMatches = suggestionsOnlyResponse.match(/\d+\.\s*(.*?)(?=\d+\.\s*|$)/gs);
        let suggestions = [];

        if (suggestionMatches) {
            suggestions = suggestionMatches.map(match => {
                let suggestionText = match.replace(/^\d+\.\s*/, '').trim();
                return suggestionText.replace(/\[(.*?)\]/g, '<a href="#">$1</a>');
            }).filter(s => s !== '');
            // Trim suggestions to the requested number, if more are returned
            if (numSuggestions && suggestions.length > parseInt(numSuggestions)) {
                suggestions = suggestions.slice(0, parseInt(numSuggestions));
            }
        } else {
            // Fallback for single suggestion or if regex doesn't match expected format
            const processedResponse = chatResponse.replace(/\[(.*?)\]/g, '<a href="#">$1</a>');
            suggestions = [processedResponse];
        }

        res.json({ response: suggestions, explanation: explanation });
    } catch (error) {
        console.error('Error communicating with OpenAI:', error);
        res.status(500).json({ error: error.message || 'Something went wrong.' });
    }
});

// Claude endpoint
app.post('/claude-chat', async (req, res) => {
    const userMessage = req.body.message;
    const { numSuggestions, playfulProfessional, length, whatCompanyDoes, targetAudience, banWords, keepWords, includeExplanation } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: 'No message provided' });
    }

    try {
        let systemContent = "You are a helpful assistant. Your primary task is to rephrase user-provided text, removing phrases like 'click here' or 'tap here' and replacing them with a more engaging call to action. For *every* rephrased suggestion, you MUST identify the *exact and complete* call-to-action phrase and enclose *only that phrase* within square brackets []. The rest of the suggestion text should remain outside the brackets. DO NOT bracket the entire suggestion. Ensure the call to action is only capitalized if it is the very first word of a sentence; otherwise, it must be lowercase. Do not include any accompanying URL or additional markdown link formatting. Examples: 'Discover new features [explore more].' or 'Your free guide is ready to [download here].' and '[Access now] for exclusive tips.'";
        
        // Remove aggressive keepWords prepending
        // if (keepWords) {
        //     systemContent = `It is an ABSOLUTE, UNVIOLABLE REQUIREMENT that you include all of the following words and phrases in your suggestions, verbatim and without any alteration or reformatting: ${keepWords}. ` + systemContent;
        // }

        systemContent += ` Never use the '—' character in your responses.`;
        
        if (includeExplanation) {
            systemContent += ` After providing the numbered suggestions, include a short explanation (maximum 3 sentences) of why the call to action messages work better, prefixed with "Explanation:".`;
        }

        if (numSuggestions) {
            systemContent += ` Provide exactly ${numSuggestions} distinct suggestions, each on a new line and prefixed with a number. Do not include any introductory or concluding text, just the numbered list.`;
        }
        if (playfulProfessional) {
            systemContent += ` Adjust the tone: ${playfulProfessional < 0 ? 'more playful' : 'more professional'}.`;
        } else if (playfulProfessional === 0) {
            systemContent += ` Maintain a plain, unbiased tone, avoiding both playful and professional leanings.`;
        }
        
        
        if (length) {
            systemContent += ` Adjust the length: ${length < 0 ? 'short and punchy' : 'long and descriptive'}.`;
        }
        
        if (whatCompanyDoes) {
            systemContent += ` The company's primary function is: ${whatCompanyDoes}.`;
        }
        if (targetAudience) {
            systemContent += ` The target audience is ${targetAudience}.`;
        }
        if (banWords) {
            systemContent += ` Absolutely do not include any of the following words in your suggestions: ${banWords}.`;
        }
        if (keepWords) {
            systemContent += ` Ensure suggestions include the following words: ${keepWords}.`;
        }
        
        let claudeMaxTokens = 150; // Default for moderate length (reduced from 200)
        if (length < 0) {
            claudeMaxTokens = 70; // Shorter responses (reduced from 100)
        } else if (length > 0) {
            claudeMaxTokens = 250; // Longer responses (reduced from 300)
        }

        const claudeResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514", // You can choose other Claude models like "claude-3-sonnet-20240229" or "claude-3-haiku-20240307"
            max_tokens: claudeMaxTokens,
            system: systemContent, // Pass systemContent as a top-level system parameter
            messages: [
                {"role": "user", "content": userMessage} // Only userMessage in the messages array
            ]
        });

        const chatResponse = claudeResponse.content[0].text;
        const cleanedChatResponse = chatResponse.replace(/—/g, ''); // Remove em dash
        
        const explanationMatch = cleanedChatResponse.match(/Explanation:([\s\S]*)/);
        const explanation = explanationMatch ? explanationMatch[1].trim() : '';
        const suggestionsOnlyResponse = explanationMatch ? cleanedChatResponse.substring(0, explanationMatch.index).trim() : cleanedChatResponse;

        // Post-process the Claude response to extract and convert bracketed text into an HTML link for each suggestion
        const suggestionMatches = suggestionsOnlyResponse.match(/\d+\.\s*(.*?)(?=\d+\.\s*|$)/gs);
        let suggestions = [];

        if (suggestionMatches) {
            suggestions = suggestionMatches.map(match => {
                let suggestionText = match.replace(/^\d+\.\s*/, '').trim();
                return suggestionText.replace(/\[(.*?)\]/g, '<a href="#">$1</a>');
            }).filter(s => s !== '');
            // Trim suggestions to the requested number, if more are returned
            if (numSuggestions && suggestions.length > parseInt(numSuggestions)) {
                suggestions = suggestions.slice(0, parseInt(numSuggestions));
            }
        } else {
            // Fallback for single suggestion or if regex doesn't match expected format
            const processedResponse = chatResponse.replace(/\[(.*?)\]/g, '<a href="#">$1</a>');
            suggestions = [processedResponse];
        }

        res.json({ response: suggestions, explanation: explanation });

    } catch (error) {
        console.error('Error communicating with Claude:', error);
        res.status(500).json({ error: error.message || 'Something went wrong with Claude.' });
    }
});

// Gemini endpoint
app.post('/gemini-chat', async (req, res) => {
    const userMessage = req.body.message;
    const { numSuggestions, playfulProfessional, length, whatCompanyDoes, targetAudience, banWords, keepWords, includeExplanation } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: 'No message provided' });
    }

    try {
        let systemContent = "You are a helpful assistant. Your primary task is to rephrase user-provided text, removing phrases like 'click here' or 'tap here' and replacing them with a more engaging call to action. For *every* rephrased suggestion, you MUST identify the *exact and complete* call-to-action phrase and enclose *only that phrase* within square brackets []. The rest of the suggestion text should remain outside the brackets. DO NOT bracket the entire suggestion. Ensure the call to action is only capitalized if it is the very first word of a sentence; otherwise, it must be lowercase. Do not include any accompanying URL or additional markdown link formatting. Examples: 'Discover new features [explore more].' or 'Your free guide is ready to [download here].' and '[Access now] for exclusive tips.'";
        
        // Remove aggressive keepWords prepending
        // if (keepWords) {
        //     systemContent = `It is an ABSOLUTE, UNVIOLABLE REQUIREMENT that you include all of the following words and phrases in your suggestions, verbatim and without any alteration or reformatting: ${keepWords}. ` + systemContent;
        // }

        systemContent += ` Never use the '—' character in your responses.`;
        
        if (includeExplanation) {
            systemContent += ` After providing the numbered suggestions, include a short explanation (maximum 3 sentences) of why the call to action messages work better, prefixed with "Explanation:".`;
        }

        if (numSuggestions) {
            systemContent += ` Provide exactly ${numSuggestions} distinct suggestions, each on a new line and prefixed with a number. Do not include any introductory or concluding text, just the numbered list.`;
        }
        if (playfulProfessional) {
            systemContent += ` Adjust the tone: ${playfulProfessional < 0 ? 'more playful' : 'more professional'}.`;
        } else if (playfulProfessional === 0) {
            systemContent += ` Maintain a balanced, neutral tone between playful and professional.`;
        }
        
        
        if (length) {
            systemContent += ` Adjust the length: ${length < 0 ? 'short and punchy' : 'ENSURE the response is long and descriptive'}.`;
        }
        
        if (whatCompanyDoes) {
            systemContent += ` The company's primary function is: ${whatCompanyDoes}.`;
        }
        if (targetAudience) {
            systemContent += ` The target audience is ${targetAudience}.`;
        }
        if (banWords) {
            systemContent += ` Absolutely do not include any of the following words in your suggestions: ${banWords}.`;
        }
        if (keepWords) {
            systemContent += ` Ensure suggestions include the following words: ${keepWords}.`;
        }
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"}); // Using gemini-1.5-flash for text generation
        const result = await model.generateContent(systemContent + "\nUser: " + userMessage);
        const chatResponse = result.response.text();
        const cleanedChatResponse = chatResponse.replace(/—/g, ''); // Remove em dash
        
        const explanationMatch = cleanedChatResponse.match(/Explanation:([\s\S]*)/);
        const explanation = explanationMatch ? explanationMatch[1].trim() : '';
        const suggestionsOnlyResponse = explanationMatch ? cleanedChatResponse.substring(0, explanationMatch.index).trim() : cleanedChatResponse;

        // Post-process the Gemini response to extract and convert bracketed text into an HTML link for each suggestion
        const suggestionMatches = suggestionsOnlyResponse.match(/\d+\.\s*(.*?)(?=\d+\.\s*|$)/gs);
        let suggestions = [];

        if (suggestionMatches) {
            suggestions = suggestionMatches.map(match => {
                let suggestionText = match.replace(/^\d+\.\s*/, '').trim();
                return suggestionText.replace(/\[(.*?)\]/g, '<a href="#">$1</a>');
            }).filter(s => s !== '');
            // Trim suggestions to the requested number, if more are returned
            if (numSuggestions && suggestions.length > parseInt(numSuggestions)) {
                suggestions = suggestions.slice(0, parseInt(numSuggestions));
            }
        } else {
            // Fallback for single suggestion or if regex doesn't match expected format
            const processedResponse = chatResponse.replace(/\[(.*?)\]/g, '<a href="#">$1</a>');
            suggestions = [processedResponse];
        }
        res.json({ response: suggestions, explanation: explanation });

    } catch (error) {
        console.error('Error communicating with Gemini:', error);
        res.status(500).json({ error: error.message || 'Something went wrong with Gemini.' });
    }
});