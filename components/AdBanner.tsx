import React from 'react';

interface AdBannerProps {
  onRemoveAds: () => void;
  isPremium: boolean;
}

const AdBanner: React.FC<AdBannerProps> = ({ onRemoveAds, isPremium }) => {
  if (isPremium) return null;

  return (
    <div className="w-full bg-gradient-to-r from-violet-600/20 via-fuchsia-500/20 to-violet-600/20 border-y border-violet-500/30 py-3 px-4 relative overflow-hidden">
      {/* Animated shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]"
        style={{ animation: 'shimmer 3s infinite' }} />

      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        {/* Ad Label */}
        <div className="hidden sm:flex items-center gap-2 text-violet-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider">Sponsored</span>
        </div>

        {/* Main Ad Content */}
        <div className="flex-1 flex items-center justify-center gap-3 text-center">
          <span className="text-white font-semibold text-sm sm:text-base">
            🚀 Launch your SaaS with
            <span className="text-violet-300 font-bold mx-1">VibeCloud</span>
          </span>
          <span className="hidden sm:inline text-slate-400">•</span>
          <span className="hidden sm:inline bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-bold text-sm sm:text-base animate-pulse">
            Use code VIBE for 20% off!
          </span>
        </div>

        {/* Remove Ads Button */}
        <button
          onClick={onRemoveAds}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 px-3 py-1.5 rounded-full transition-all border border-slate-700 hover:border-slate-500"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="hidden sm:inline">Remove Ads</span>
        </button>
      </div>
    </div>
  );
};

export default AdBanner;