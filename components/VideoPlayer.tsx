import React, { useRef, useEffect, useState } from 'react';
import ReactPlayer from 'react-player';
import YouTube, { YouTubeProps } from 'react-youtube';
import { SyncEventType, VideoSource } from '../types';

interface VideoPlayerProps {
  url: string;
  source: VideoSource;
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
  source,
  isPlaying,
  seekToTime,
  onProgress,
  onPlay,
  onPause,
  onEnded,
  isHost,
}) => {
  const reactPlayerRef = useRef<any>(null);
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  const [ready, setReady] = useState(false);

  // Helper to extract YouTube ID
  const getYouTubeID = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Helper to extract Google Drive File ID
  const getDriveID = (url: string) => {
    // Matches /file/d/ID, /d/ID, id=ID, or just the ID if it looks like one (20+ chars)
    const regExp = /(?:\/d\/|id=|file\/d\/)([a-zA-Z0-9_-]+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  // Handle seeking when the prop changes
  useEffect(() => {
    if (seekToTime !== undefined && seekToTime >= 0 && ready) {
      if (source === VideoSource.YOUTUBE && youtubePlayer) {
        try {
          const current = youtubePlayer.getCurrentTime();
          if (Math.abs(current - seekToTime) > 1.5) {
            youtubePlayer.seekTo(seekToTime);
          }
        } catch (e) {
          console.warn('[VideoPlayer] Seek failed, player not ready:', e);
        }
      } else if (reactPlayerRef.current) {
        const current = reactPlayerRef.current.getCurrentTime();
        if (Math.abs(current - seekToTime) > 1.5) {
          reactPlayerRef.current.seekTo(seekToTime, 'seconds');
        }
      }
    }
  }, [seekToTime, source, youtubePlayer, ready]);

  // Handle Play/Pause for YouTube Iframe manually if props change
  useEffect(() => {
    if (source === VideoSource.YOUTUBE && youtubePlayer && ready) {
      try {
        if (isPlaying) {
          if (youtubePlayer.getPlayerState() !== 1) youtubePlayer.playVideo();
        } else {
          if (youtubePlayer.getPlayerState() === 1) youtubePlayer.pauseVideo();
        }
      } catch (e) {
        console.warn('[VideoPlayer] Play/Pause failed, player not ready:', e);
      }
    }
  }, [isPlaying, source, youtubePlayer, ready]);


  // YouTube Event Handlers
  const onYouTubeReady = (event: any) => {
    setYoutubePlayer(event.target);
    setReady(true);
    // Auto-play if isPlaying is already true (e.g., guest joining mid-playback)
    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onYouTubeStateChange = (event: any) => {
    // 1 = Playing, 2 = Paused, 0 = Ended
    if (event.data === 1) {
      onPlay();
    } else if (event.data === 2) {
      onPause();
    } else if (event.data === 0) {
      onEnded();
    }
  };

  // Interval for YouTube Progress (Native API doesn't have a clean onProgress like ReactPlayer)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (source === VideoSource.YOUTUBE && isPlaying && youtubePlayer) {
      interval = setInterval(() => {
        const currentTime = youtubePlayer.getCurrentTime();
        onProgress(currentTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [source, isPlaying, youtubePlayer, onProgress]);


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

  // Render Google Drive IFrame (Priority check)
  const driveIdCandidate = getDriveID(url);
  if (source === VideoSource.GOOGLE_DRIVE || driveIdCandidate) {
    const fileId = driveIdCandidate;
    if (!fileId) {
      return <div className="w-full h-full flex items-center justify-center bg-black text-slate-400">Invalid Google Drive URL</div>;
    }

    console.log('[VideoPlayer] Drive ID:', fileId);

    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-slate-800 group">
        <iframe
          key={fileId}
          src={`https://drive.google.com/file/d/${fileId}/preview`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="eager"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          className="w-full h-full border-0"
          title="Google Drive Video"
        />

        {/* Active Sync Overlay (for all users) */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center transition-all duration-500">
            <div className="w-20 h-20 rounded-full bg-violet-500/20 border border-violet-500/50 flex items-center justify-center text-violet-400 mb-4 animate-pulse">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-white tracking-widest uppercase">Room Paused</h3>
            <p className="text-slate-400 text-sm mt-2">Waiting for host to play...</p>
          </div>
        )}

        {/* Host Sync Controls Bar (visible to host on hover/always) */}
        {isHost && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 transform translate-y-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover:-translate-y-1">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider border-r border-slate-700 pr-4">Manual Sync</span>
              <div className="flex items-center gap-2">
                {isPlaying ? (
                  <button
                    onClick={onPause}
                    className="p-2 hover:bg-slate-800 rounded-full text-white transition-colors"
                    title="Pause for everyone"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                  </button>
                ) : (
                  <button
                    onClick={onPlay}
                    className="p-2 hover:bg-slate-800 rounded-full text-emerald-400 transition-colors"
                    title="Play for everyone"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                )}

                <button
                  onClick={() => {
                    const roomCode = window.location.pathname.split('/').pop();
                    alert(`Tip: Since Google Drive doesn't allow auto-syncing seeks, ask your guests to refresh or manually skip to the current time if they fall behind.`);
                  }}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                  title="Sync Tip"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render YouTube IFrame
  if (source === VideoSource.YOUTUBE) {
    const videoId = getYouTubeID(url);
    if (!videoId) {
      return <div className="w-full h-full flex items-center justify-center bg-black text-slate-400">Invalid YouTube URL</div>;
    }

    const opts: YouTubeProps['opts'] = {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: isPlaying ? 1 : 0,
        controls: 1, // User can use controls
        modestbranding: 1,
        rel: 0,
      },
    };

    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-slate-800">
        <YouTube
          videoId={videoId}
          opts={opts}
          onReady={onYouTubeReady}
          onStateChange={onYouTubeStateChange}
          className="w-full h-full"
          iframeClassName="w-full h-full"
        />
      </div>
    );
  }

  // Render External Player (ReactPlayer)
  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-slate-800">
      <ReactPlayer
        ref={reactPlayerRef}
        url={url}
        width="100%"
        height="100%"
        playing={isPlaying}
        controls={true}
        onReady={() => setReady(true)}
        onProgress={(state: any) => {
          if (isPlaying) onProgress(state.playedSeconds);
        }}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
      />
    </div>
  );
};

export default VideoPlayer;