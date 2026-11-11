'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  Clock,
  Eye,
  FileCode,
  Flame,
  ArrowLeft,
  Share2,
  FileText,
  WrapText,
} from 'lucide-react';
import { PasteResponse } from '@/lib/types';
import { formatTimeRemaining } from '@/lib/utils';

export default function PasteViewer({ paste }: { paste: PasteResponse }) {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>(
    formatTimeRemaining(paste.expires_at)
  );

  // Live countdown update
  useEffect(() => {
    if (!paste.expires_at) return;
    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(paste.expires_at));
    }, 1000);
    return () => clearInterval(interval);
  }, [paste.expires_at]);

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(paste.content);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      console.error('Failed to copy text');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      console.error('Failed to copy link');
    }
  };

  const lines = paste.content.split('\n');

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>Create New Paste</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
            </button>

            <a
              href={`/api/pastes/${paste.id}/raw`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Raw</span>
            </a>

            <button
              onClick={copyContent}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors shadow-sm shadow-indigo-600/30"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Burn warning if 0 views remaining */}
        {paste.max_views !== null && paste.remaining_views === 0 && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-amber-400 flex-shrink-0 animate-pulse" />
              <span>
                <strong>Burn Notice:</strong> This paste has reached its maximum view limit ({paste.max_views}). It will be permanently inaccessible on subsequent requests.
              </span>
            </div>
            <button
              onClick={copyContent}
              className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium transition-colors"
            >
              Save Now
            </button>
          </div>
        )}

        {/* Metadata Header Card */}
        <div className="mb-6 p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-400" />
                {paste.title || 'Untitled Snippet'}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Created on {new Date(paste.created_at).toLocaleString()}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Language */}
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                {paste.language}
              </span>

              {/* View limit / count */}
              {paste.max_views !== null ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Flame className="w-3.5 h-3.5" />
                  {paste.remaining_views === 0
                    ? 'Final view (burn)'
                    : `${paste.remaining_views} view${paste.remaining_views === 1 ? '' : 's'} remaining`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60">
                  <Eye className="w-3.5 h-3.5" />
                  Viewed {paste.view_count} time{paste.view_count === 1 ? '' : 's'}
                </span>
              )}

              {/* Expiration */}
              {paste.expires_at ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Clock className="w-3.5 h-3.5" />
                  {timeRemaining}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60">
                  <Clock className="w-3.5 h-3.5" />
                  Never expires
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Code Snippet Box */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-2xl">
          {/* Controls Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
            <span className="font-mono text-slate-400">
              {lines.length} {lines.length === 1 ? 'line' : 'lines'} • {paste.content.length.toLocaleString()} bytes
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWrapLines(!wrapLines)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                  wrapLines ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'
                }`}
                title="Toggle line wrapping"
              >
                <WrapText className="w-3.5 h-3.5" />
                <span>Wrap</span>
              </button>
            </div>
          </div>

          {/* Content display with line numbers */}
          <div className="overflow-x-auto p-4 flex font-mono text-sm leading-relaxed text-slate-200">
            {/* Line numbers */}
            <div className="select-none text-slate-600 text-right pr-4 border-r border-slate-800/80 space-y-0.5">
              {lines.map((_, idx) => (
                <div key={idx} className="leading-6">
                  {idx + 1}
                </div>
              ))}
            </div>

            {/* Code lines */}
            <div className={`pl-4 flex-1 space-y-0.5 ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
              {lines.map((line, idx) => (
                <div key={idx} className="leading-6">
                  {line || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <p>Pastebin Lite • Ephemeral & Secure Snippets</p>
      </footer>
    </div>
  );
}
