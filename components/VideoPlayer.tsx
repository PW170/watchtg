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

  // Handle seeking when the prop changes
  useEffect(() => {
    if (seekToTime !== undefined && seekToTime >= 0) {
      if (source === VideoSource.YOUTUBE && youtubePlayer) {
        const current = youtubePlayer.getCurrentTime();
        if (Math.abs(current - seekToTime) > 1.5) {
          youtubePlayer.seekTo(seekToTime);
        }
      } else if (reactPlayerRef.current) {
        const current = reactPlayerRef.current.getCurrentTime();
        if (Math.abs(current - seekToTime) > 1.5) {
          reactPlayerRef.current.seekTo(seekToTime, 'seconds');
        }
      }
    }
  }, [seekToTime, source, youtubePlayer]);

  // Handle Play/Pause for YouTube Iframe manually if props change (ReactPlayer handles this internally, react-youtube needs imperative)
  useEffect(() => {
    if (source === VideoSource.YOUTUBE && youtubePlayer) {
      if (isPlaying) {
        if (youtubePlayer.getPlayerState() !== 1) youtubePlayer.playVideo();
      } else {
        if (youtubePlayer.getPlayerState() === 1) youtubePlayer.pauseVideo();
      }
    }
  }, [isPlaying, source, youtubePlayer]);


  // YouTube Event Handlers
  const onYouTubeReady = (event: any) => {
    setYoutubePlayer(event.target);
    setReady(true);
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