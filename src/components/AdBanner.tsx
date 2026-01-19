import React from 'react';

interface AdBannerProps {
  onRemoveAds: () => void;
  isPremium: boolean;
}

const AdBanner: React.FC<AdBannerProps> = ({ onRemoveAds, isPremium }) => {
  if (isPremium) return null;

  return (
    <div className="w-full bg-[#09090b] border-b border-white/5 py-3 px-4 relative overflow-hidden group">

      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Ad Label */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="px-1.5 py-0.5 rounded border border-violet-500/20 bg-violet-500/5 text-violet-400 font-bold uppercase tracking-wider text-[10px]">
            Partner
          </div>
          <p className="text-zinc-400">
            Launch your app with <span className="font-semibold text-zinc-200">VibeCloud</span>.
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 text-white font-mono">CODE: VIBE</span>
          </p>
        </div>

        {/* Remove Ads Button */}
        <button
          onClick={onRemoveAds}
          className="w-full sm:w-auto flex items-center justify-center gap-2 text-zinc-500 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/5"
        >
          <span className="hidden sm:inline">Remove Ads</span>
          <span className="sm:hidden">Remove Ads (Premium)</span>
          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AdBanner;