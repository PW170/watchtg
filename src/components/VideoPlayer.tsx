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
  onRequestSync?: (currentTime: number) => void;
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
  onRequestSync,
}) => {
  const reactPlayerRef = useRef<any>(null);
  const lastProgressRef = useRef<number>(0);
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [showPlayHint, setShowPlayHint] = useState(false);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const [useDirectStream, setUseDirectStream] = useState(false);

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
    if (seekToTime !== undefined && seekToTime >= 0) {
      if (source === VideoSource.GOOGLE_DRIVE && !useDirectStream) {
        // Drive IFrame cannot auto-seek. Show notification.
        const minutes = Math.floor(seekToTime / 60);
        const seconds = Math.floor(seekToTime % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        setSyncNotification(`Host is at ${timeStr}. Please scrub to this time.`);
        // Auto-hide after 15s
        const timer = setTimeout(() => setSyncNotification(null), 15000);
        return () => clearTimeout(timer);
      } else if (ready) {
        // Standard Seek Logic for YouTube/File
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
    }
    // Clear notification if we seek (assumption: user obeyed)
    setSyncNotification(null);
  }, [seekToTime, source, youtubePlayer, ready]);

  // Google Drive: Show hint when host plays (Only for IFrame mode)
  useEffect(() => {
    if (source === VideoSource.GOOGLE_DRIVE && !useDirectStream && isPlaying) {
      setShowPlayHint(true);
      const timer = setTimeout(() => setShowPlayHint(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, source]);

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

    // DIRECT STREAM MODE (Experimental)
    if (useDirectStream) {
      const directLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
      console.log('[VideoPlayer] Attempting Direct Stream:', directLink);

      return (
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-slate-800">
          {/* Fallback Warning Overlay if we detect frequent buffer/errors? Handled by onError */}
          <ReactPlayer
            ref={reactPlayerRef}
            url={directLink}
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
            onError={(e) => {
              console.error('[VideoPlayer] Direct Stream Failed:', e);
              alert("Auto-Sync failed (File too large or blocked). Reverting to Manual Sync.");
              setUseDirectStream(false);
            }}
            config={{ file: { attributes: { controlsList: 'nodownload' } } }}
          />

          {/* Host Toggle (To Turn OFF) */}
          {isHost && (
            <div className="absolute top-4 right-4 z-50">
              <button
                onClick={() => setUseDirectStream(false)}
                className="bg-red-500/90 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg hover:bg-red-600 transition-colors"
              >
                Disable Auto-Sync
              </button>
            </div>
          )}
        </div>
      );
    }

    // IFRAME MODE (Standard)
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
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center transition-all duration-300">
            <div className="w-20 h-20 rounded-full bg-violet-500/20 border border-violet-500/50 flex items-center justify-center text-violet-400 mb-4 animate-pulse">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-white tracking-widest uppercase">Room Paused</h3>
            <p className="text-slate-400 text-sm mt-2 max-w-xs text-center px-4">Waiting for host. Google Drive requires you to manually click play when unpaused.</p>
          </div>
        )}

        {/* Play Hint Toast */}
        {isPlaying && showPlayHint && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 animate-bounce cursor-pointer pointer-events-none">
            <div className="bg-emerald-500 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 border-2 border-white/20">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              CLICK TO PLAY NOW!
            </div>
          </div>
        )}

        {/* Host Sync Controls Bar (visible to host on hover/always) */}
        {isHost && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 opacity-100 hover:opacity-100">
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
                    alert(`Tip: Since Google Drive doesn't allow auto-syncing seeks, ask your guests to refresh or manually skip to the current time if they fall behind.`);
                  }}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                  title="Sync Tip"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </button>

                {/* Broadcast Time Button */}
                <button
                  onClick={() => {
                    const timeStr = prompt("Enter your current time (e.g. 5:30)");
                    if (timeStr) {
                      const parts = timeStr.split(':');
                      let seconds = 0;
                      if (parts.length === 2) {
                        seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                      } else {
                        seconds = parseInt(parts[0]);
                      }
                      if (!isNaN(seconds) && onRequestSync) {
                        onRequestSync(seconds);
                      }
                    }
                  }}
                  className="p-2 hover:bg-slate-800 rounded-full text-blue-400 transition-colors"
                  title="Broadcast Time to Guests"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </button>

                {/* Enable Auto-Sync Toggle */}
                <button
                  onClick={() => {
                    if (confirm("Enable Experimental Auto-Sync?\n\nThis tries to stream the raw file. It works best for small files (<100MB).\nIf it fails, it will revert to Manual Sync.")) {
                      setUseDirectStream(true);
                    }
                  }}
                  className="p-2 hover:bg-slate-800 rounded-full text-fuchsia-400 transition-colors"
                  title="Enable Auto-Sync (Experimental)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guest Sync Banner */}
        {syncNotification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-max max-w-[90%]">
            <div className="bg-blue-600/90 backdrop-blur-md text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-4 border border-blue-400/50 animate-bounce-in">
              <svg className="w-6 h-6 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-blue-200 uppercase tracking-wider">Manual Sync Required</span>
                <span>{syncNotification}</span>
              </div>
              <button onClick={() => setSyncNotification(null)} className="ml-2 hover:text-blue-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Streamable Resolver Logic
  const [streamableDirectUrl, setStreamableDirectUrl] = useState<string | null>(null);
  const streamableVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (source === VideoSource.STREAMABLE && url) {
      setStreamableDirectUrl(null); // Reset
      setReady(false);
      import('../services/streamable').then(({ resolveStreamableUrl }) => {
        resolveStreamableUrl(url).then((direct) => {
          if (direct) {
            setStreamableDirectUrl(direct);
            setReady(true);
          } else {
            console.error("Failed to resolve Streamable URL");
            // Fallback? Or show error
          }
        });
      });
    }
  }, [url, source]);

  // Sync Native Video Element
  useEffect(() => {
    if (source === VideoSource.STREAMABLE && streamableVideoRef.current) {
      const vid = streamableVideoRef.current;
      if (isPlaying && vid.paused) {
        vid.play().catch(e => console.warn("Autoplay blocked", e));
      } else if (!isPlaying && !vid.paused) {
        vid.pause();
      }
    }
  }, [isPlaying, source, streamableDirectUrl]);

  // Sync Seek for Native Video
  useEffect(() => {
    if (source === VideoSource.STREAMABLE && streamableVideoRef.current && seekToTime !== undefined && seekToTime >= 0) {
      const vid = streamableVideoRef.current;
      if (Math.abs(vid.currentTime - seekToTime) > 0.5) {
        vid.currentTime = seekToTime;
      }
    }
  }, [seekToTime, source, streamableDirectUrl]);


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

  // Render Streamable Native (Direct)
  if (source === VideoSource.STREAMABLE) {
    if (!streamableDirectUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black flex-col gap-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-blue-400">Resolving Streamable...</span>
        </div>
      );
    }

    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-slate-800">
        <video
          ref={streamableVideoRef}
          src={streamableDirectUrl}
          className="w-full h-full object-contain"
          controls
          playsInline
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          onTimeUpdate={(e) => {
            const now = Date.now();
            if (now - lastProgressRef.current > 1000) {
              onProgress(e.currentTarget.currentTime);
              lastProgressRef.current = now;
            }
          }}
          onError={(e) => console.error("Streamable Video Error", e)}
        />
        {/* Overlay for "Native Mode" branding */}
        <div className="absolute top-4 right-4 pointer-events-none">
          <div className="bg-blue-600/20 backdrop-blur-md border border-blue-500/30 px-2 py-1 rounded text-[10px] font-bold text-blue-400 uppercase tracking-widest">
            Direct MP4
          </div>
        </div>
      </div>
    );
  }

  // Render External Player (ReactPlayer) fallback
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