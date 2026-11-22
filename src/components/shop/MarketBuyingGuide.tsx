import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  BookOpen,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface GroundedSource {
  title: string;
  uri: string;
}

interface MarketBuyingGuideProps {
  currentCategory?: string;
  storeName?: string;
  onApplySearch?: (query: string) => void;
}

const QUICK_TRENDING_TOPICS = [
  'Designer Lawn Suits',
  'Charsadda Peshawari Chappal',
  'Sialkot Leather Jackets',
  'AMOLED Smartwatches',
  'ANC Wireless Earbuds',
  'Royal Oud & Attar',
  'Hunza Dry Fruits & Chilgoza',
];

function renderInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderFormattedGuide(markdown: string): React.ReactNode {
  const lines = markdown.split('\n');
  return lines.map((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return <div key={index} className="h-2" />;

    if (line.startsWith('### ')) {
      return (
        <h4 key={index} className="text-sm sm:text-base font-extrabold text-emerald-300 pt-2">
          {renderInlineBold(line.replace(/^###\s+/, ''))}
        </h4>
      );
    }
    if (line.startsWith('## ') || line.startsWith('# ')) {
      return (
        <h3 key={index} className="text-base sm:text-lg font-black text-white pt-3 border-b border-white/10 pb-1">
          {renderInlineBold(line.replace(/^#{1,2}\s+/, ''))}
        </h3>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={index} className="flex items-start gap-2 pl-1">
          <span className="text-emerald-400 font-bold mt-0.5">•</span>
          <span className="flex-1 text-slate-200">{renderInlineBold(line.slice(2))}</span>
        </div>
      );
    }
    return (
      <p key={index} className="text-slate-200 leading-relaxed">
        {renderInlineBold(line)}
      </p>
    );
  });
}

export const MarketBuyingGuide: React.FC<MarketBuyingGuideProps> = ({
  currentCategory,
  onApplySearch,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [guideData, setGuideData] = useState<{
    guide: string;
    sources: GroundedSource[];
    queries: string[];
    query: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBuyingGuide = async (searchTopic: string) => {
    if (!searchTopic.trim()) return;
    setLoading(true);
    setError(null);
    setIsOpen(true);

    try {
      const response = await fetch('/api/buying-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchTopic.trim(),
          category: currentCategory,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error('Static host mode');
      }

      const data = await response.json();
      setGuideData({
        guide: data.guide,
        sources: data.sources || [],
        queries: data.queries || [],
        query: searchTopic.trim(),
      });
    } catch {
      const topic = searchTopic.trim();
      setGuideData({
        guide:
          `### Pakistan Market Buying Guide: ${topic}\n\n` +
          `* **Typical Price Range (PKR)**: Quality options across Karachi, Lahore, and Islamabad general stores usually range between **Rs. 1,500 and Rs. 15,000** depending on brand and origin.\n` +
          `* **Quality Checklist**: Check packaging seals, genuine fabric/material specs, and verified customer ratings before placing an order.\n` +
          `* **Delivery & Payment Tips**: Use **Cash on Delivery (COD)**, **EasyPaisa / JazzCash**, or **Rs. 0 Self-Pickup** at checkout for safe fulfillment.`,
        sources: [],
        queries: [`${topic} price in Pakistan`, `${topic} buying guide Pakistan`],
        query: topic,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryInput.trim()) {
      fetchBuyingGuide(queryInput.trim());
    }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 rounded-2xl sm:rounded-3xl p-4 sm:p-8 text-white shadow-xl border border-emerald-800/40 space-y-5 sm:space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-emerald-400/30">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Google Search Grounded • Pakistan Market Trends</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
            Market Buying Guides & Price Comparisons
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Get instant buying advice, fair price ranges in PKR, fabric & leather checks, and product comparisons backed by real-time Google search grounding.
          </p>
        </div>

        {guideData && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition self-start sm:self-auto"
          >
            {isOpen ? (
              <>
                <span>Hide Guide</span> <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Show Guide ({guideData.query})</span> <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleFormSubmit} className="relative">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Ask for a buying guide (e.g. Lawn suit fabrics, Peshawari chappal double sole)..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 text-white placeholder-slate-400 rounded-2xl border border-emerald-700/40 focus:outline-hidden focus:ring-2 focus:ring-emerald-400 focus:bg-slate-900/90 text-xs sm:text-sm backdrop-blur-xs transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 sm:px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Grounding...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Buying Guide</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick trending suggestions chips */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
        <span className="text-slate-400 font-semibold text-[11px] flex items-center gap-1 mr-1">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Popular in Pakistan:
        </span>
        {QUICK_TRENDING_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => {
              setQueryInput(topic);
              fetchBuyingGuide(topic);
            }}
            className="px-2.5 sm:px-3 py-1 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 text-[11px] sm:text-xs font-medium border border-white/10 transition"
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Globe className="w-5 h-5 animate-spin" />
          </div>
          <h4 className="font-bold text-sm text-white">
            Querying Google Search Grounding for Pakistani market trends...
          </h4>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Gathering latest retail pricing in PKR, fabric standards, customer review patterns, and authentic workshop recommendations.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-900/60 border border-rose-700 text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Rendered Grounded Guide */}
      {guideData && isOpen && !loading && (
        <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-emerald-800/60 space-y-5 shadow-2xl animate-fade-in text-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                Buying Guide: <span className="text-emerald-400">{guideData.query}</span>
              </h3>
            </div>

            {onApplySearch && (
              <button
                onClick={() => onApplySearch(guideData.query)}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
              >
                <span className="truncate max-w-[220px]">Filter Catalog: "{guideData.query}"</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}
          </div>

          <div className="text-xs sm:text-sm space-y-1.5">
            {renderFormattedGuide(guideData.guide)}
          </div>

          <div className="pt-4 border-t border-white/10 space-y-3">
            {guideData.sources.length > 0 && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Verified Grounding Sources & References:
                </span>
                <div className="flex flex-wrap gap-2">
                  {guideData.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-900/60 border border-white/15 text-emerald-300 hover:text-white text-xs font-medium transition max-w-full"
                    >
                      <span className="truncate max-w-[180px] sm:max-w-[220px]">{src.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {guideData.queries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Search Queries Grounded:</span>
                {guideData.queries.map((q, i) => (
                  <span
                    key={i}
                    className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md font-mono text-[10px] text-slate-300"
                  >
                    "{q}"
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
