const express = require('express');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
const ASSISTANT_ID = 'asst_KT61xnqPEngJVEHONR3fsc2O';
const VECTOR_STORE_ID = 'vs_683ba6f1954081918debb296f5e15848';

const openaiHeaders = {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  'Content-Type': 'application/json',
  'OpenAI-Beta': 'assistants=v2'
};

app.post('/api/ask', async (req, res) => {
  const { prompt, user = 'unknown' } = req.body;
  console.log('📥 Incoming request:', { prompt, user });

  if (!prompt || !OPENAI_API_KEY) {
    console.error('❌ Missing data — prompt:', prompt, 'API key present:', !!OPENAI_API_KEY);
    return res.status(400).json({ error: 'Missing prompt or API key.' });
  }

  try {
    const threadRes = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: openaiHeaders
    });
    const thread = await threadRes.json();

    await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: 'POST',
      headers: openaiHeaders,
      body: JSON.stringify({
        role: 'user',
        content: prompt
      })
    });

    const runRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: 'POST',
      headers: openaiHeaders,
      body: JSON.stringify({
        assistant_id: ASSISTANT_ID,
        tool_resources: {
          file_search: {
            vector_store_ids: [VECTOR_STORE_ID]
          }
        },
        tool_choice: "none" // <-- temporarily disable file_search to test core response
      })
    });
    const run = await runRes.json();
    console.log('🚀 Assistant run created:', JSON.stringify(run, null, 2));

    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 10;

    while (runStatus !== 'completed' && runStatus !== 'failed' && runStatus !== 'cancelled' && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000));
      const statusRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: openaiHeaders
      });
      const statusData = await statusRes.json();

      if (!statusRes.ok) {
        console.error(`❌ Error polling run status:`, statusData);
        break;
      }

      runStatus = statusData.status;
      console.log(`⏳ Polling attempt ${attempts + 1}: run status = ${runStatus}`);
      attempts++;
    }

    if (runStatus !== 'completed') {
      console.error(`❌ Assistant run never completed. Final status: ${runStatus}`);
      const errRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: openaiHeaders
      });
      const errData = await errRes.json();
      if (errData.last_error) {
        console.error('🧨 Last assistant error:', errData.last_error);
      }
      return res.json({ reply: "I wasn’t able to find that information in the current SOPs. Please check with your manager." });
    }

    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: openaiHeaders
    });
    const messages = await messagesRes.json();

    console.log('📨 All messages:', JSON.stringify(messages.data, null, 2));

    const assistantReply = messages.data
      .filter((msg) => msg.role === 'assistant')
      .sort((a, b) => b.created_at - a.created_at)[0]?.content?.[0]?.text?.value;

    const reply = assistantReply || "I wasn’t able to find that information in the current SOPs. Please check with your manager.";

    const logEntry = {
      timestamp: new Date().toISOString(),
      user,
      prompt,
      reply
    };
    fs.appendFileSync('prompt-log.json', JSON.stringify(logEntry) + ',\n');

    res.json({ reply });
  } catch (err) {
    console.error('💥 Error in assistant flow:', err);
    res.status(500).json({ error: 'Failed to complete assistant interaction.' });
  }
});

app.listen(port, () => {
  console.log(`🧠 KnowledgeOps API (Assistants API) running at http://localhost:${port}`);
});
