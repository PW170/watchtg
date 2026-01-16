import React from 'react';

interface AdBannerProps {
  onRemoveAds: () => void;
  isPremium: boolean;
}

const AdBanner: React.FC<AdBannerProps> = ({ onRemoveAds, isPremium }) => {
  if (isPremium) return null;

  return (
    <div className="w-full bg-gradient-to-r from-slate-900 via-surface to-slate-900 border-y border-slate-800 p-2 relative overflow-hidden group">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        
        {/* Mock Ad Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <span className="text-xs text-slate-500 uppercase tracking-widest mb-1">Advertisement</span>
          <div className="text-slate-300 font-medium">
             Host your own SaaS with <span className="text-violet-400 font-bold">VibeCloud</span>. 
             <span className="mx-2 text-slate-600">|</span> 
             Use code VIBE for 20% off.
          </div>
        </div>

        {/* Upgrade Trigger */}
        <button 
          onClick={onRemoveAds}
          className="hidden md:flex items-center gap-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 px-3 py-1.5 rounded-full transition-colors absolute right-4 top-1/2 -translate-y-1/2"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          Remove Ads
        </button>
      </div>
    </div>
  );
};

export default AdBanner;