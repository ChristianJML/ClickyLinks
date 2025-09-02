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
    if (!userMessage) {
        return res.status(400).json({ error: 'No message provided' });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Or "gpt-4" depending on your preference and access
            messages: [
                { role: "system", content: "You are a helpful assistant. When the user provides text, rephrase it to remove any instances of 'click here' and replace it with an appropriate alternative call to action that does not contain the words 'click' or 'here'. The alternative call to action should be returned within square brackets, e.g., [learn more], without any accompanying URL or additional markdown link formatting." },
                { role: "user", content: userMessage }
            ]
        });
        const chatResponse = completion.choices[0].message.content;
        
        // Post-process the ChatGPT response to convert bracketed text into an HTML link
        const processedResponse = chatResponse.replace(/\[(.*?)\]/g, '<a href="#">$1</a>');
        res.json({ response: processedResponse });
    } catch (error) {
        console.error('Error communicating with OpenAI:', error);
        res.status(500).json({ error: error.message || 'Something went wrong.' });
    }
});

app.listen(port, () => {
    console.log(`Node.js backend listening at http://localhost:${port}`);
});
