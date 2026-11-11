import Link from 'next/link';
import { AlertCircle, Flame, Clock, ArrowLeft, Plus } from 'lucide-react';
import { getPasteAndIncrementViews } from '@/lib/db';
import PasteViewer from './PasteViewer';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PastePage(props: PageProps) {
  const { id } = await props.params;

  if (!id) {
    return <PasteNotFound reason="not_found" />;
  }

  const result = await getPasteAndIncrementViews(id);

  if (!result.success) {
    return <PasteNotFound reason={result.reason} />;
  }

  const paste = result.paste;
  const remainingViews =
    paste.max_views !== null ? Math.max(0, paste.max_views - paste.view_count) : null;

  return (
    <PasteViewer
      paste={{
        id: paste.id,
        title: paste.title,
        content: paste.content,
        language: paste.language,
        created_at: paste.created_at,
        expires_at: paste.expires_at,
        max_views: paste.max_views,
        view_count: paste.view_count,
        remaining_views: remainingViews,
      }}
    />
  );
}

function PasteNotFound({ reason }: { reason: 'not_found' | 'expired' | 'view_limit_reached' }) {
  const config = {
    view_limit_reached: {
      title: 'Paste Burned & Destroyed',
      description:
        'This paste was configured with a view limit (Burn After Reading) and has reached its maximum allowed views. The content has been permanently purged.',
      icon: <Flame className="w-12 h-12 text-amber-500 animate-pulse" />,
      badge: 'Burn Limit Reached',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    expired: {
      title: 'Paste Expired',
      description:
        'The time-to-live (TTL) for this paste has elapsed. It is no longer accessible and has expired.',
      icon: <Clock className="w-12 h-12 text-cyan-500" />,
      badge: 'TTL Elapsed',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
    not_found: {
      title: 'Paste Not Found',
      description:
        'We could not locate this paste. It might have been deleted, reached its expiration criteria, or the link may be mistyped.',
      icon: <AlertCircle className="w-12 h-12 text-rose-500" />,
      badge: '404 Not Found',
      badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
  }[reason];

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>Pastebin Lite</span>
          </Link>
        </div>
      </header>

      {/* Main error container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 flex flex-col items-center justify-center text-center py-16">
        <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 shadow-2xl">
          {config.icon}
        </div>

        <span className={`text-xs font-semibold px-3 py-1 rounded-full border mb-3 ${config.badgeColor}`}>
          {config.badge}
        </span>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-3">
          {config.title}
        </h1>

        <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
          {config.description}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Create a New Paste</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
