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
                { role: "user", content: userMessage }
            ]
        });
        const chatResponse = completion.choices[0].message.content;
        res.json({ response: chatResponse });
    } catch (error) {
        console.error('Error communicating with OpenAI:', error);
        res.status(500).json({ error: error.message || 'Something went wrong.' });
    }
});

app.listen(port, () => {
    console.log(`Node.js backend listening at http://localhost:${port}`);
});
