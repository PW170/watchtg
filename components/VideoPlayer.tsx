import React, { useRef, useEffect, useState } from 'react';
import ReactPlayer from 'react-player';
import { SyncEventType } from '../types';

interface VideoPlayerProps {
  url: string;
  isPlaying: boolean;
  seekToTime?: number; // External command to seek
  onProgress: (playedSeconds: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  isHost: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  isPlaying,
  seekToTime,
  onProgress,
  onPlay,
  onPause,
  onEnded,
  isHost,
}) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [ready, setReady] = useState(false);
  
  // Handle seeking when the prop changes
  useEffect(() => {
    if (seekToTime !== undefined && seekToTime >= 0 && playerRef.current) {
      // Avoid seeking if strictly close to current time to prevent loops
      const current = playerRef.current.getCurrentTime();
      if (Math.abs(current - seekToTime) > 1.5) {
        playerRef.current.seekTo(seekToTime, 'seconds');
      }
    }
  }, [seekToTime]);

  // A helper to block restricted URLs
  const isRestricted = (testUrl: string) => {
    const restricted = ['netflix.com', 'hulu.com', 'disneyplus.com', 'primevideo.com', 'hotstar.com'];
    return restricted.some(domain => testUrl.includes(domain));
  };

  if (isRestricted(url)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-red-400 flex-col gap-4">
        <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <p className="text-xl font-semibold">Source Not Supported</p>
        <p className="text-sm opacity-75">We do not support paid OTT platforms (Netflix, Prime, etc.). Please use YouTube or direct open web links.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-slate-800">
      <ReactPlayer
        ref={playerRef}
        url={url}
        width="100%"
        height="100%"
        playing={isPlaying}
        controls={true} // We allow native controls for simplicity in this demo, though custom controls are better for strict sync
        onReady={() => setReady(true)}
        onProgress={(state) => {
          // Only send progress if playing
          if (isPlaying) onProgress(state.playedSeconds);
        }}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        config={{
          youtube: {
            playerVars: { showinfo: 1 }
          }
        }}
      />
      
      {/* Overlay to prevent non-hosts from messing with playback? 
          For this user request, usually all users can control, or just host. 
          We will let anyone control for a "collaborative" feel, but could block here with a div if !isHost 
      */}
    </div>
  );
};

export default VideoPlayer;