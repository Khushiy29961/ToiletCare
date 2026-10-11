'use client';

import React, { useState } from 'react';
import { CopilotResponse } from '../types';
import { api } from '../services/api';

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToilet?: (toiletId: string) => void;
  onSelectTask?: (taskId: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  toolsExecuted?: string[];
  dataSources?: string[];
  engineMode?: string;
  suggestedActions?: Array<{ label: string; toilet_id?: string; task_id?: string; worker_id?: string }>;
  timestamp: string;
}

export const AiCopilotDrawer: React.FC<AiCopilotDrawerProps> = ({
  isOpen,
  onClose,
  onSelectToilet,
  onSelectTask,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-0',
      sender: 'copilot',
      text: "👋 Hello Officer! I am the **ToiletCare AI Operations Copilot**.\n\nI answer operational questions using real database data and deterministic telemetry tools. How can I assist you with public sanitation oversight today?",
      engineMode: 'ToiletCare Grounded Copilot',
      timestamp: 'Now',
    },
  ]);

  if (!isOpen) return null;

  const handleSendQuery = async (queryText?: string) => {
    const query = queryText || inputQuery;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res: CopilotResponse = await api.askCopilot(query.trim());
      const copilotMsg: ChatMessage = {
        id: `cop-${Date.now()}`,
        sender: 'copilot',
        text: res.response,
        toolsExecuted: res.tools_executed,
        dataSources: res.data_sources,
        engineMode: res.engine_mode,
        suggestedActions: res.suggested_actions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, copilotMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'copilot',
        text: `⚠️ **Error communicating with AI Copilot**: ${err.message || 'Service unavailable'}. Please verify backend connection.`,
        engineMode: 'Error Guardrail',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "Which toilets need immediate attention?",
    "Which tasks are currently unresolved?",
    "Which workers are available?",
    "What happened at TC-003?",
    "Who is recommended for TASK-001?",
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 p-5 text-white">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-xl">
              🤖
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base tracking-tight">AI Operations Copilot</h3>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                  Grounded
                </span>
              </div>
              <p className="text-xs text-slate-300">Live Tool Execution & Database Grounding</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Quick Prompts Bar */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Quick Operational Inquiries:
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendQuery(prompt)}
                disabled={isLoading}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-900 transition-all whitespace-nowrap disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white rounded-br-xs'
                    : 'bg-slate-50 text-slate-900 border border-slate-200/80 rounded-bl-xs'
                }`}
              >
                {/* Formatted Markdown Content */}
                <div className="whitespace-pre-wrap space-y-2">{msg.text}</div>

                {/* Tool Traces for Copilot */}
                {msg.sender === 'copilot' && msg.toolsExecuted && msg.toolsExecuted.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-1.5 text-[10px]">
                    <div className="flex items-center space-x-1 text-indigo-700 font-bold">
                      <span>🔧 Tools Consulted:</span>
                      <span className="font-mono">{msg.toolsExecuted.join(', ')}</span>
                    </div>
                    {msg.dataSources && msg.dataSources.length > 0 && (
                      <div className="text-slate-500 flex items-center space-x-1">
                        <span>🗄️ Data Sources:</span>
                        <span>{msg.dataSources.join(' | ')}</span>
                      </div>
                    )}
                    {msg.engineMode && (
                      <div className="text-slate-400 text-[9px]">
                        ⚡ Engine: {msg.engineMode}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <span className="mt-1 text-[10px] text-slate-400 px-1">
                {msg.sender === 'user' ? 'Officer' : 'AI Copilot'} • {msg.timestamp}
              </span>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-2 text-slate-500 text-xs p-3 bg-slate-50 rounded-xl border border-slate-200 animate-pulse">
              <span className="animate-spin text-sm">⚙️</span>
              <span>Executing grounded tools & querying database...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-200 bg-white p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask Copilot about facilities, tasks, workers, or history..."
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="submit"
              disabled={isLoading || !inputQuery.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Ask Copilot 🚀
            </button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            Answers are fact-checked against SQLite records. Copilot cannot mutate data without officer confirmation.
          </p>
        </div>
      </div>
    </div>
  );
};
