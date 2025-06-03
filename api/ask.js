
// ask.js
// trigger redeploy
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
require('dotenv').config();

const { OpenAI } = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const port = process.env.PORT || 3001;


app.use(cors());
app.use(bodyParser.json());

const assistantId = process.env.OPENAI_ASSISTANT_ID;
console.log("✅ Assistant ID:", assistantId);

// Utility: Log Q&A pairs to local file
function appendToLog(entry) {
  const logEntry = `${entry.timestamp.toISOString()} | ${entry.user} | ${entry.prompt} => ${entry.answer}\n`;
  fs.appendFileSync('ask-log.txt', logEntry);
}

// Route: Handle incoming prompt
app.post('/ask', async (req, res) => {
  const { prompt, user } = req.body;
  console.log("📥 Incoming request:", { prompt, user });

  try {
    // Step 1: Create a new thread
    const thread = await openai.beta.threads.create(
      {},
      {
        headers: { 'OpenAI-Beta': 'assistants=v2' }
      }
    );
    console.log("🧵 Thread created:", thread);

    // Step 2: Add message to thread
    await openai.beta.threads.messages.create(
      thread.id,
      { role: 'user', content: prompt },
      {
        headers: { 'OpenAI-Beta': 'assistants=v2' }
      }
    );

    // Step 3: Run the assistant
    const run = await openai.beta.threads.runs.create(
      thread.id,
      { assistant_id: assistantId },
      {
        headers: { 'OpenAI-Beta': 'assistants=v2' }
      }
    );
    console.log("🚀 Assistant run created:", run);

    // Step 4: Poll for completion
    let attempts = 0;
    const maxAttempts = 10;
    let runStatus;

    console.log("➡️ Polling using thread.id:", thread.id, "| run.id:", run.id);
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(
        thread.id,
        run.id,
        {
          headers: { 'OpenAI-Beta': 'assistants=v2' }
        }
      );
      console.log(`⏳ Polling attempt ${attempts + 1}: run status = ${runStatus.status}`);
      attempts++;
    } while (runStatus.status !== 'completed' && attempts < maxAttempts);

    if (runStatus.status !== 'completed') {
      console.error("❌ Assistant run never completed. Final status:", runStatus.status);
      res.status(500).json({ error: 'Assistant run did not complete in time.' });
      return;
    }

    // Step 5: Retrieve messages
    const messages = await openai.beta.threads.messages.list(
      thread.id,
      {
        headers: { 'OpenAI-Beta': 'assistants=v2' }
      }
    );
    const lastMessage = messages.data.find(msg => msg.role === 'assistant');
    const answer = lastMessage?.content?.[0]?.text?.value || "No response received.";

    // Step 6: Log it
    appendToLog({ timestamp: new Date(), user, prompt, answer });

    // Step 7: Send response
    res.json({ answer });

  } catch (error) {
    console.error("💥 Error in assistant flow:", error);
    res.status(500).json({ error: 'Error communicating with assistant.' });
  }
});


app.listen(port, () => {
  console.log(`🧠 KnowledgeOps API (Assistants API) running at http://localhost:${port}`);
});

