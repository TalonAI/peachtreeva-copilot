import React, { useState } from 'react';

export default function App() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch('http://localhost:3001/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input, user: 'test-user' })
      });
      const data = await res.json();
      setResponse(data.reply || 'No response received.');
    } catch (err) {
      setResponse('Error communicating with assistant.');
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white px-6 py-8 font-sans">
      <header className="flex items-center mb-10 space-x-4">
        <img src="/peachtreeva-logo-1.png" alt="PeachtreeVA Logo" className="h-12 w-auto" />
        <h1 className="text-3xl md:text-4xl font-bold">KnowledgeOps Copilot</h1>
      </header>

      <div className="flex flex-col md:flex-row items-start gap-4 max-w-4xl">
        <textarea
          className="text-lg w-full md:w-3/4 min-h-[6rem] p-4 rounded bg-zinc-800 border border-zinc-700 resize-none"
          placeholder="Ask a VA operations question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleAsk}
          className="bg-[#e87851] hover:bg-[#f3a65f] text-white font-semibold py-3 px-6 rounded mt-1"
        >
          Ask
        </button>
      </div>

      <div className="mt-8 text-lg whitespace-pre-wrap leading-relaxed max-w-4xl">
        {loading ? 'Asking...' : response}
      </div>
    </div>
  );
}
