'use client';

import { useState, useTransition, FormEvent, KeyboardEvent } from 'react';
import {
  Clock,
  Eye,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Flame,
  Sparkles,
  FileText,
  AlertCircle,
  Terminal,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/lib/utils';
import { CreatePasteResponse } from '@/lib/types';

const EXPIRATION_OPTIONS = [
  { label: 'Never expires', value: 'never', seconds: null },
  { label: '5 minutes', value: '5m', seconds: 300 },
  { label: '10 minutes', value: '10m', seconds: 600 },
  { label: '1 hour', value: '1h', seconds: 3600 },
  { label: '1 day', value: '1d', seconds: 86400 },
  { label: '7 days', value: '7d', seconds: 604800 },
  { label: '30 days', value: '30d', seconds: 2592000 },
];

const VIEW_LIMIT_OPTIONS = [
  { label: 'Unlimited views', value: 'unlimited', limit: null },
  { label: '1 view (Burn after reading 🔥)', value: '1', limit: 1 },
  { label: '5 views', value: '5', limit: 5 },
  { label: '10 views', value: '10', limit: 10 },
  { label: '50 views', value: '50', limit: 50 },
];

export default function Home() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('plaintext');
  const [selectedTtl, setSelectedTtl] = useState('never');
  const [selectedViewLimit, setSelectedViewLimit] = useState('unlimited');
  const [error, setError] = useState<string | null>(null);
  const [createdPaste, setCreatedPaste] = useState<CreatePasteResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isPending, startTransition] = useTransition();

  const lineCount = content.split('\n').length;
  const charCount = content.length;

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim()) {
      setError('Please provide some text or code before creating a paste.');
      return;
    }

    setError(null);

    const ttlOption = EXPIRATION_OPTIONS.find((opt) => opt.value === selectedTtl);
    const viewOption = VIEW_LIMIT_OPTIONS.find((opt) => opt.value === selectedViewLimit);

    startTransition(async () => {
      try {
        const res = await fetch('/api/pastes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            title: title.trim() || undefined,
            language,
            ttl_seconds: ttlOption?.seconds ?? undefined,
            max_views: viewOption?.limit ?? undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to create paste (${res.status})`);
        }

        const data: CreatePasteResponse = await res.json();
        setCreatedPaste(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred while creating paste.');
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    // Tab key indentation support
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      setContent(content.substring(0, start) + '  ' + content.substring(end));
      setTimeout(() => {
        const textarea = document.getElementById('paste-content') as HTMLTextAreaElement;
        if (textarea) {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const copyToClipboard = async (text: string, isRaw = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isRaw) {
        setCopiedRaw(true);
        setTimeout(() => setCopiedRaw(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      console.error('Failed to copy');
    }
  };

  const resetForm = () => {
    setContent('');
    setTitle('');
    setLanguage('plaintext');
    setSelectedTtl('never');
    setSelectedViewLimit('unlimited');
    setCreatedPaste(null);
    setError(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                Pastebin Lite
              </span>
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Ephemeral
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              API Health
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Banner */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Create & Share Ephemeral Snippets
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Store code or text with instant share links, optional self-destruct timers, and atomic view limits.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg w-fit">
            <kbd className="font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">⌘ / Ctrl + Enter</kbd>
            <span>to publish</span>
          </div>
        </div>

        {/* Success Modal / Card */}
        {createdPaste && (
          <div className="mb-8 p-6 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 shadow-xl shadow-indigo-950/50 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Paste Published Successfully!</h3>
                  <p className="text-xs text-slate-400">Your shareable link is live and ready to send.</p>
                </div>
              </div>
              <button
                onClick={resetForm}
                className="text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Create Another
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Web Link */}
              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-xs font-medium text-slate-400 block mb-1.5">Shareable Web Link</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdPaste.url}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300 selection:bg-indigo-600 focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(createdPaste.url, false)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <a
                    href={createdPaste.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    title="Open paste"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Raw URL */}
              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-xs font-medium text-slate-400 block mb-1.5">Raw Text Endpoint</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdPaste.raw_url}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 selection:bg-indigo-600 focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(createdPaste.raw_url, true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    {copiedRaw ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedRaw ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Constraints overview */}
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-indigo-900/40 text-xs">
              {createdPaste.max_views !== null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Flame className="w-3.5 h-3.5" />
                  {createdPaste.max_views === 1
                    ? 'Burn after 1 view'
                    : `Self-destructs after ${createdPaste.max_views} views`}
                </span>
              )}
              {createdPaste.expires_at !== null ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Clock className="w-3.5 h-3.5" />
                  Expires: {new Date(createdPaste.expires_at).toLocaleString()}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/50">
                  <Clock className="w-3.5 h-3.5" />
                  No expiration time
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Top metadata toolbar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="title" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Title (Optional)
              </label>
              <input
                id="title"
                type="text"
                placeholder="e.g. config.json or My Snippet"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="language" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Syntax Highlighting
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="ttl" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Expires In
                </label>
                <select
                  id="ttl"
                  value={selectedTtl}
                  onChange={(e) => setSelectedTtl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                >
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="maxViews" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  View Limit
                </label>
                <select
                  id="maxViews"
                  value={selectedViewLimit}
                  onChange={(e) => setSelectedViewLimit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                >
                  {VIEW_LIMIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Editor Container */}
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-inner focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            {/* Editor Top Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Text / Code Content</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
                <span>•</span>
                <span>{charCount.toLocaleString()} chars</span>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              id="paste-content"
              rows={16}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type or paste your text or code snippet here...&#10;&#10;Supports Tab indentation and Cmd/Ctrl + Enter to create."
              className="w-full bg-transparent p-4 font-mono text-sm leading-relaxed text-slate-200 placeholder-slate-600 focus:outline-none resize-y selection:bg-indigo-600"
              spellCheck={false}
              autoFocus
            />

            {/* Bottom bar inside editor */}
            <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                {selectedViewLimit === '1' && (
                  <span className="text-amber-400 flex items-center gap-1 font-medium">
                    <Flame className="w-3.5 h-3.5" /> Burn after 1 view is active!
                  </span>
                )}
                {selectedTtl !== 'never' && (
                  <span className="text-cyan-400 flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5" /> Expiration set to {EXPIRATION_OPTIONS.find((o) => o.value === selectedTtl)?.label}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending || !content.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98]"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Creating Paste...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Create Paste</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* REST API & Curl Guide */}
        <section className="mt-12 p-6 rounded-2xl bg-slate-900/30 border border-slate-800/60">
          <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-indigo-400" />
            Automated Tests & CLI / curl Integration
          </h2>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Automated test runners and command-line scripts can interface directly with our standard REST endpoints:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 font-mono text-xs">
              <span className="text-slate-500 block mb-1"># Create paste with curl</span>
              <code className="text-indigo-300 block select-all overflow-x-auto">
                curl -X POST /api/pastes \<br />
                &nbsp;&nbsp;-H &apos;Content-Type: application/json&apos; \<br />
                &nbsp;&nbsp;-d &apos;{JSON.stringify({ content: "Hello from curl", ttl_seconds: 3600, max_views: 5 })}&apos;
              </code>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 font-mono text-xs">
              <span className="text-slate-500 block mb-1"># Retrieve raw text</span>
              <code className="text-emerald-300 block select-all overflow-x-auto">
                curl /api/pastes/:id/raw
              </code>
              <span className="text-slate-500 block mt-2 mb-1"># Retrieve JSON metadata</span>
              <code className="text-cyan-300 block select-all overflow-x-auto">
                curl /api/pastes/:id
              </code>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <p>Pastebin Lite • Built with Next.js & PostgreSQL</p>
      </footer>
    </div>
  );
}
