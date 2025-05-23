require('dotenv').config();
const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";

if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    process.exit(1);
}

app.post("/generate-plan", async (req, res) => {
    const { className, hours, level } = req.body;

    if (!className || !hours || !level) {
        return res.status(400).json({ error: "Missing required parameters: className, hours, or level." });
    }

    if (isNaN(hours) || hours <= 0) {
        return res.status(400).json({ error: "Hours must be a positive number." });
    }

    if (isNaN(level) || level < 1 || level > 10) {
        return res.status(400).json({ error: "Level must be a number between 1 and 10." });
    }

    const prompt = `
You are an AI Study Buddy. A student is studying ${className} and currently has about ${hours} hours per day to study. The student rates their understanding as ${level}/10. Create a personalized 4-week ${className} study plan designed to help them improve steadily.

The plan should be clearly structured by week, with daily learning goals and focus areas. Include short descriptions for each week and what topics are covered.

In addition to the study plan, include exactly 5 high-quality, functional, free YouTube videos, each from a different ${className} topic, that the student can use to learn. The videos must:

Be from highly reputable educational channels like Khan Academy, Crash Course, or TED-Ed (at least 4 of the 5 should be from these).

Be 100% accessible and not part of a playlist or shortened URL. Use direct, full-length YouTube video links in the format: https://www.youtube.com/watch?v=VIDEO_ID.

Include a brief 1–2 sentence description of each video, what it teaches, and why it’s useful.

Each video link should be on a separate line.

Be recent or still relevant, clearly explained, and not marked as “unavailable.” The AI must check this before recommending.

Format the entire response aesthetically and professionally, like an official syllabus or student guide. Do not use asterisks or code blocks.
`;

    try {
        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 100000
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error Response:", errorData);
            return res.status(response.status).json({ error: "Gemini API Error", details: errorData });
        }

        const data = await response.json();

        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            let textContent = data.candidates[0].content.parts[0].text;
            textContent = processLinks(textContent);
            res.json({ message: textContent });
        } else {
            console.error("Unexpected response format from Gemini API:", data);
            res.status(500).json({ error: "Unexpected response format from Gemini API" });
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        res.status(500).json({ error: "Error calling Gemini API" });
    }
});

function processLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

// Serve static files
app.use(express.static("."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
