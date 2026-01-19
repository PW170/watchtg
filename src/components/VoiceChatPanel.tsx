import React from 'react';
import Button from './ui/Button';

interface VoiceChatPanelProps {
    isHost: boolean;
    isVoiceEnabled: boolean;
    onEnable: () => void;
    currentUser: any;
}

const VoiceChatPanel: React.FC<VoiceChatPanelProps> = ({ isHost, isVoiceEnabled, onEnable, currentUser }) => {
    // Voice Chat Active
    if (isVoiceEnabled) {
        return (
            <div className="flex flex-col h-full bg-[#0a0a0c]">
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Voice</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">24ms</span>
                </div>

                {/* User List */}
                <div className="flex-1 p-3 overflow-y-auto space-y-1">
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-[11px] font-semibold text-white">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-300 font-medium truncate">{currentUser.name}</p>
                            <p className="text-[10px] text-zinc-600">Speaking</p>
                        </div>
                        <div className="flex gap-0.5 items-end h-3">
                            <div className="w-0.5 bg-emerald-500/70 rounded-full animate-pulse" style={{ height: '6px' }}></div>
                            <div className="w-0.5 bg-emerald-500/70 rounded-full animate-pulse" style={{ height: '10px', animationDelay: '0.1s' }}></div>
                            <div className="w-0.5 bg-emerald-500/70 rounded-full animate-pulse" style={{ height: '4px', animationDelay: '0.2s' }}></div>
                        </div>
                    </div>

                    <div className="py-6 text-center">
                        <p className="text-[10px] text-zinc-700">Invite friends to join</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="p-3 border-t border-white/[0.04]">
                    <div className="flex gap-2">
                        <button className="flex-1 h-8 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 text-xs font-medium transition-colors">
                            Mute
                        </button>
                        <button className="flex-1 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/15 text-red-400 text-xs font-medium transition-colors">
                            Leave
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Host Enable View
    if (isHost) {
        return (
            <div className="flex flex-col items-center justify-center p-6 h-full bg-[#0a0a0c]">
                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                    </svg>
                </div>
                <h3 className="text-sm font-medium text-zinc-300 mb-1">Voice Channel</h3>
                <p className="text-[11px] text-zinc-600 text-center mb-5 max-w-[180px]">
                    Start a voice session for your room
                </p>
                <Button onClick={onEnable} variant="primary" size="sm">
                    Enable Voice
                </Button>
            </div>
        );
    }

    // Guest Waiting View
    return (
        <div className="flex flex-col items-center justify-center p-6 h-full bg-[#0a0a0c]">
            <div className="w-10 h-10 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                </svg>
            </div>
            <p className="text-xs text-zinc-500 mb-1">Voice Disabled</p>
            <p className="text-[10px] text-zinc-700">Waiting for host</p>
        </div>
    );
};

export default VoiceChatPanel;
