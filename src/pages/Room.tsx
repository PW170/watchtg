import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import VoiceChatPanel from '../components/VoiceChatPanel';
import AdBanner from '../components/AdBanner';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { User, ChatMessage, SyncEventType, SyncEvent, VideoSource } from '../types';
import Logo from '../components/ui/Logo';
import { startTransition, useTransition } from 'react';
import { syncService, getRoom, createRoom, updateRoom, createRoomEvent } from '../services/supabaseService';
import { v4 as uuidv4 } from 'uuid';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Room State
  const [dbRoomId, setDbRoomId] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [source, setSource] = useState<VideoSource>(VideoSource.YOUTUBE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTo, setSeekTo] = useState<number>(-1);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // Host Controls
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<VideoSource>(VideoSource.YOUTUBE);
  const [showControls, setShowControls] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // UI State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('CONNECTING');

  // Refs for state access in callbacks
  const currentTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const videoUrlRef = useRef<string>('');
  const sourceRef = useRef<VideoSource>(VideoSource.YOUTUBE);

  // Keep refs synced with state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { videoUrlRef.current = videoUrl; }, [videoUrl]);
  useEffect(() => { sourceRef.current = source; }, [source]);

  // Initialize
  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    // 1. Restore or Create User
    const storedUser = localStorage.getItem(`watchwithme_user_${roomId}`);
    let user: User;

    if (!storedUser) {
      user = {
        id: uuidv4(),
        name: `Guest-${Math.floor(Math.random() * 1000)}`,
        isHost: false,
        color: '#94a3b8'
      };
      localStorage.setItem(`watchwithme_user_${roomId}`, JSON.stringify(user));
    } else {
      user = JSON.parse(storedUser);
    }
    setCurrentUser(user);

    // 3. Connect Sync & Load from DB
    const initSync = async () => {
      // Subscribe to status changes
      const cleanupStatus = syncService.onStatusChange(setConnectionStatus);

      try {
        // Load Room from DB
        let { data: room, error } = await getRoom(roomId);

        if (!room) {
          if (user.isHost) {
            // Get video from localStorage (set by Home.tsx)
            let initVideoUrl = '';
            let initSource = VideoSource.YOUTUBE;
            const storedVideo = localStorage.getItem(`watchwithme_init_video_${roomId}`);
            if (storedVideo) {
              const parsed = JSON.parse(storedVideo);
              initVideoUrl = parsed.url || '';
              initSource = parsed.source || VideoSource.YOUTUBE;
            }

            // Create Room with video
            const result = await createRoom(roomId, {
              video_url: initVideoUrl,
              source: initSource,
              is_playing: false,
              current_time: 0,
              last_updated: new Date().toISOString()
            });

            if (result.error) {
              console.error('Failed to create room:', result.error);
              alert(`Failed to create room: ${result.error.message}. Check Database RLS policies.`);
              return;
            }

            room = result.data;
          } else {
            alert('Room not found');
            navigate('/');
            return;
          }
        }

        if (room) {
          setDbRoomId(room.id);
          // Initialize State
          if (room.video_url) setVideoUrl(room.video_url);
          if (room.source) setSource(room.source as VideoSource);
          if (room.is_playing) setIsPlaying(room.is_playing);
          if (room.current_time) {
            setSeekTo(room.current_time);
            currentTimeRef.current = room.current_time;
          }

          await syncService.connect(roomId, room.id);
        }

      } catch (error) {
        console.error('[Room] Failed to connect sync service:', error);
      }

      return cleanupStatus;
    };

    const cleanupPromise = initSync();

    return () => {
      syncService.disconnect();
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [roomId, navigate]);

  // Handle Sync Events
  useEffect(() => {
    const handleSyncEvent = (event: SyncEvent) => {
      if (event.senderId === currentUser?.id) return;

      console.log('[Room] Received Sync Event:', event.type, event.payload); // Verbose log
      switch (event.type) {
        case SyncEventType.PLAY:
          setIsPlaying(true);
          break;
        case SyncEventType.PAUSE:
          setIsPlaying(false);
          // If a specific time was provided with pause (e.g. from seek), sync to it
          if (event.payload?.currentTime !== undefined) {
            setSeekTo(event.payload.currentTime);
          }
          break;
        case SyncEventType.SEEK:
          setSeekTo(event.payload.time);
          break;
        case SyncEventType.URL_CHANGE:
          console.log('[Room] URL_CHANGE Received:', event.payload.url);
          setVideoUrl(event.payload.url);
          setSource(event.payload.source);
          setIsPlaying(false);
          setSource(event.payload.source);
          setIsPlaying(false);
          break;
        case SyncEventType.SYNC_STATE:
          if (event.payload.videoUrl && event.payload.videoUrl !== videoUrlRef.current) {
            console.log('[Room] SYNC_STATE: Updating Video URL to', event.payload.videoUrl);
            setVideoUrl(event.payload.videoUrl);
          }
          if (event.payload.source && event.payload.source !== source) {
            console.log('[Room] SYNC_STATE: Updating Source to', event.payload.source);
            setSource(event.payload.source);
          }
          if (event.payload.isPlaying !== undefined && event.payload.isPlaying !== isPlayingRef.current) {
            setIsPlaying(event.payload.isPlaying);
          }
          // Drift Correction
          if (event.payload.currentTime !== undefined) {
            const drift = Math.abs(event.payload.currentTime - currentTimeRef.current);
            if (drift > 2) {
              console.log(`[Sync] Drift detected (${drift.toFixed(2)}s). Correcting...`);
              setSeekTo(event.payload.currentTime);
            }
          }
        case SyncEventType.SYNC_TIME:
          if (event.payload.currentTime !== undefined) {
            console.log('[Room] Received SYNC_TIME:', event.payload.currentTime);
            setSeekTo(event.payload.currentTime);
          }
          break;
        case SyncEventType.VOICE_STATE:
          if (event.payload.enabled !== undefined) {
            setIsVoiceEnabled(event.payload.enabled);
          }
          break;
      }
    };

    const unsubscribe = syncService.onEvent(handleSyncEvent);
    return () => unsubscribe();
  }, [currentUser, source]);

  // Host Heartbeat
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentUser?.isHost) {
      interval = setInterval(() => {
        if (!dbRoomId) return;
        updateRoom(dbRoomId, {
          video_url: videoUrlRef.current,
          source: sourceRef.current,
          is_playing: isPlayingRef.current,
          current_time: currentTimeRef.current,
          last_updated: new Date().toISOString()
        });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [currentUser, source, isPlaying]);

  // Player Callbacks
  const handleProgress = useCallback((playedSeconds: number) => {
    currentTimeRef.current = playedSeconds;
  }, []);

  const handlePlay = useCallback(() => {
    if (!isPlaying) {
      setIsPlaying(true);
      if (dbRoomId && currentUser) {
        updateRoom(dbRoomId, { is_playing: true, current_time: currentTimeRef.current, last_updated: new Date().toISOString() });
        createRoomEvent(dbRoomId, SyncEventType.PLAY, { currentTime: currentTimeRef.current }, currentUser.id);
      }
    }
  }, [isPlaying, dbRoomId, currentUser]);

  const handlePause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (dbRoomId && currentUser) {
        updateRoom(dbRoomId, { is_playing: false, current_time: currentTimeRef.current, last_updated: new Date().toISOString() });
        createRoomEvent(dbRoomId, SyncEventType.PAUSE, { currentTime: currentTimeRef.current }, currentUser.id);
      }
    }
  }, [isPlaying, dbRoomId, currentUser]);

  const handleSeek = useCallback((seconds: number) => {
    setSeekTo(seconds);
    if (dbRoomId && currentUser) {
      updateRoom(dbRoomId, { current_time: seconds, last_updated: new Date().toISOString() });
      createRoomEvent(dbRoomId, SyncEventType.SEEK, { time: seconds }, currentUser.id);
    }
  }, [dbRoomId, currentUser]);

  const handleChangeVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoUrl || !currentUser?.isHost) return;

    // Auto-detect Google Drive links
    let finalSourceType = newSourceType;
    if (newVideoUrl.includes('drive.google.com')) {
      finalSourceType = VideoSource.GOOGLE_DRIVE;
    }

    setVideoUrl(newVideoUrl);
    setSource(finalSourceType);
    setNewVideoUrl('');
    setIsPlaying(false);
    setShowControls(false);
    if (dbRoomId && currentUser) {
      updateRoom(dbRoomId, {
        video_url: newVideoUrl,
        source: finalSourceType,
        is_playing: false,
        current_time: 0,
        last_updated: new Date().toISOString()
      });
      createRoomEvent(dbRoomId, SyncEventType.URL_CHANGE, { url: newVideoUrl, source: finalSourceType }, currentUser.id);
    }
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/#/room/${roomId}`;
    navigator.clipboard.writeText(url);
    setShowInviteModal(false);
  };

  if (!currentUser) return <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center font-medium">Entering Theater...</div>;

  return (
    <div className="flex bg-[#0a0a0c] text-zinc-100 h-screen overflow-hidden font-sans">

      {/* Main Interface */}
      <div className="flex-1 flex flex-col h-full relative z-0">
        {/* Bottom Bar (Floating) */}
        <div className={`absolute bottom-0 inset-x-0 z-40 p-4 transition-all duration-300 ${showControls || !isPlaying ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
          {/* Host Controls Panel */}
          {currentUser.isHost && showControls && (
            <div className="mx-auto mb-4 w-full max-w-xl bg-[#111114]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Media Source</h3>
                <button onClick={() => setShowControls(false)} className="text-zinc-600 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <form onSubmit={handleChangeVideo} className="space-y-4">
                <div className="flex gap-1 p-1 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                  {[
                    { id: VideoSource.YOUTUBE, label: 'YouTube' },
                    { id: VideoSource.STREAMABLE, label: 'Streamable' },
                    { id: VideoSource.EXTERNAL, label: 'Direct' },
                    { id: VideoSource.GOOGLE_DRIVE, label: 'Drive' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setNewSourceType(type.id)}
                      className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${newSourceType === type.id ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste video URL..."
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                  />
                  <Button type="submit" variant="primary">Play</Button>
                </div>
              </form>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl rounded-xl px-4 py-2.5 border border-white/[0.04]">
              <Logo size="sm" className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')} />
              <div className="h-4 w-px bg-white/10"></div>
              <span className="text-xs text-zinc-400 font-mono">{roomId?.slice(0, 8)}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'CONNECTED' ? 'bg-emerald-500' : connectionStatus === 'CONNECTING' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
            </div>

            <div className="flex items-center gap-2">
              {currentUser.isHost && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowControls(!showControls)}
                >
                  Settings
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowInviteModal(true)}
              >
                Invite
              </Button>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform duration-200 ${isSidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7"></path></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Video Player Area */}
        <div className="flex-1 flex items-center justify-center bg-black relative">
          <div className="w-full h-full max-w-[1920px] max-h-[1080px] aspect-video relative">
            {videoUrl ? (
              <VideoPlayer
                url={videoUrl}
                source={source}
                isPlaying={isPlaying}
                seekToTime={seekTo}
                onProgress={handleProgress}
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handlePause}
                isHost={currentUser.isHost}
                onRequestSync={(time) => {
                  if (dbRoomId && currentUser) {
                    createRoomEvent(dbRoomId, SyncEventType.SYNC_TIME, { currentTime: time }, currentUser.id);
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                <div className="w-14 h-14 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <p className="text-xs font-medium">No media loaded</p>
                {currentUser.isHost && <p className="text-[10px] mt-1 text-zinc-700">Click Settings to add a video</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`w-72 bg-[#0a0a0c] border-l border-white/[0.04] flex flex-col transition-all duration-300 ${isSidebarOpen ? '' : 'w-0 overflow-hidden'}`}>
        {/* Voice Panel */}
        <div className="h-1/2 border-b border-white/[0.04]">
          <VoiceChatPanel
            isHost={!!currentUser?.isHost}
            isVoiceEnabled={isVoiceEnabled}
            currentUser={currentUser}
            onEnable={() => {
              if (dbRoomId && currentUser?.isHost) {
                setIsVoiceEnabled(true);
                createRoomEvent(dbRoomId, SyncEventType.VOICE_STATE, { enabled: true }, currentUser.id);
              }
            }}
          />
        </div>

        {/* Sponsors */}
        <div className="h-1/2 overflow-y-auto p-3 bg-[#08080a]">
          {!isPremium ? (
            <div className="space-y-3">
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-medium text-violet-400 uppercase tracking-wider">Partner</span>
                  <span className="text-[9px] text-zinc-700">Ad</span>
                </div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white text-xs font-semibold">V</div>
                  <div>
                    <h4 className="text-xs font-medium text-zinc-200">VibeCloud</h4>
                    <p className="text-[10px] text-zinc-600">Deploy in seconds</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 mb-2.5 leading-relaxed">Host your apps. Use code <span className="text-zinc-300 font-mono">VIBE</span> for $50 credit.</p>
                <button className="w-full h-8 rounded-lg bg-white text-zinc-900 text-xs font-medium hover:bg-zinc-100 transition-colors">
                  Get Started
                </button>
              </div>

              <button
                onClick={() => setShowPaywall(true)}
                className="w-full py-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Remove ads →
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-700">
              <svg className="w-6 h-6 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7"></path></svg>
              <p className="text-[10px]">Premium</p>
            </div>
          )}
        </div>
      </div>


      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
            {/* Glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl"></div>

            <h3 className="text-lg font-bold text-white mb-2 relative">Invite Friends</h3>
            <p className="text-zinc-400 mb-6 text-sm relative">Share this link to watch together.</p>

            <div className="flex gap-2 mb-6">
              <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 text-xs font-mono truncate">
                {`${window.location.origin}/#/room/${roomId}`}
              </div>
              <Button onClick={copyInviteLink} size="sm">Copy</Button>
            </div>

            <div className="text-right">
              <Button variant="ghost" size="sm" onClick={() => setShowInviteModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-b from-zinc-900 to-black border border-violet-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-violet-900/20 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500"></div>

            <div className="text-center mb-8 relative z-10">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl rotate-3 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">WatchWithMe Premium</h3>
              <p className="text-zinc-400 text-sm">Unlock the ultimate social streaming experience.</p>
            </div>

            <div className="space-y-4 mb-8 relative z-10">
              {[
                'Ad-free experience',
                'Higher bitrate streaming',
                'Exclusive reactions',
                'Priority server access'
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-zinc-300 text-sm p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  {feature}
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full mb-3 shadow-xl shadow-violet-900/40"
              onClick={() => {
                setIsPremium(true);
                setShowPaywall(false);
              }}
            >
              Unlock Premium - $4.99
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-zinc-500 hover:text-white" onClick={() => setShowPaywall(false)}>Maybe Later</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Room;