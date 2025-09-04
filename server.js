const express = require('express');
const { OpenAI } = require('openai');
const cors = require('cors');

const app = express();
const port = 5001; // This should match the port in your frontend fetch request

// Initialize OpenAI client (replace with your actual API key or environment variable)
// It's highly recommended to use environment variables for API keys in a production environment.
// For example: const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAI({ apiKey: "APIKEY" }); // Replace with your actual API key

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable JSON body parsing
app.use(express.static('public')); // Serve static files from the 'public' directory

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    const { numSuggestions, playfulProfessional, casualFormal, friendlyAuthoritative, length } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: 'No message provided' });
    }

    try {
        let systemContent = "You are a helpful assistant. When the user provides text, rephrase it to remove any instances of 'click here' and replace it with an appropriate alternative call to action. For each suggestion, clearly identify the core call to action (e.g., 'download now', 'learn more', 'get started') and enclose *only that specific phrase* within square brackets. The rest of the suggestion text should not be in brackets. For example: 'Discover our new features [Explore more].' or 'Your free guide is ready to [Download here].' Do not include any accompanying URL or additional markdown link formatting.";

        if (numSuggestions) {
            systemContent += ` Provide exactly ${numSuggestions} distinct suggestions, each on a new line and prefixed with a number. Do not include any introductory or concluding text, just the numbered list.`;
        }
        if (playfulProfessional) {
            systemContent += ` Adjust the tone: ${playfulProfessional < 0 ? 'more playful' : 'more professional'}.`;
        }
        if (casualFormal) {
            systemContent += ` Adjust the tone: ${casualFormal < 0 ? 'more casual' : 'more formal'}.`;
        }
        if (friendlyAuthoritative) {
            systemContent += ` Adjust the tone: ${friendlyAuthoritative < 0 ? 'more friendly' : 'more authoritative'}.`;
        }
        if (length) {
            systemContent += ` Adjust the length: ${length < 0 ? 'short and punchy' : 'long and descriptive'}.`;
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Or "gpt-4" depending on your preference and access
            messages: [
                { role: "system", content: systemContent },
                { role: "user", content: userMessage }
            ]
        });
        const chatResponse = completion.choices[0].message.content;
        
        // Post-process the ChatGPT response to extract and convert bracketed text into an HTML link for each suggestion
        const suggestionMatches = chatResponse.match(/\d+\.\s*(.*?)(?=\d+\.\s*|$)/gs);
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

        res.json({ response: suggestions });
    } catch (error) {
        console.error('Error communicating with OpenAI:', error);
        res.status(500).json({ error: error.message || 'Something went wrong.' });
    }
});

app.listen(port, () => {
    console.log(`Node.js backend listening at http://localhost:${port}`);
});
