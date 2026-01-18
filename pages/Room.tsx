import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import ChatWindow from '../components/ChatWindow';
import AdBanner from '../components/AdBanner';
import Button from '../components/Button';
import Input from '../components/Input';
import { User, ChatMessage, SyncEventType, SyncEvent, VideoSource } from '../types';
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPremium, setIsPremium] = useState(false);

  // Host Controls
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<VideoSource>(VideoSource.YOUTUBE);
  const [showControls, setShowControls] = useState(false);

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
    const storedUser = localStorage.getItem(`vibestream_user_${roomId}`);
    let user: User;

    if (!storedUser) {
      user = {
        id: uuidv4(),
        name: `Guest-${Math.floor(Math.random() * 1000)}`,
        isHost: false,
        color: '#94a3b8'
      };
      localStorage.setItem(`vibestream_user_${roomId}`, JSON.stringify(user));
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
            const storedVideo = localStorage.getItem(`vibestream_init_video_${roomId}`);
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

          // System Message
          const joinMsg = {
            id: uuidv4(),
            userId: 'system',
            userName: 'System',
            text: `${user.name} joined the party.`,
            timestamp: Date.now(),
            isSystem: true
          };
          // For now, simple join message
          // await createRoomEvent(room.id, SyncEventType.CHAT_MESSAGE, joinMsg, user.id);
          setMessages(prev => [...prev, joinMsg as ChatMessage]);
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

      // console.log('[Room] Received Sync Event:', event.type, event.payload); // Verbose log
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
          setMessages(prev => [...prev, {
            id: uuidv4(),
            userId: 'system',
            userName: 'System',
            text: 'The host changed the video.',
            timestamp: Date.now(),
            isSystem: true
          }]);
          break;
        case SyncEventType.CHAT_MESSAGE:
          setMessages(prev => [...prev, event.payload]);
          break;
        case SyncEventType.REQUEST_STATE:
          // Deprecated: State is now loaded from DB on join
          break;
        case SyncEventType.SYNC_STATE:
          //   console.log('[Room] Processing SYNC_STATE:', event.payload);
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
        //  console.log('[Room] Sending Heartbeat...', { url: videoUrlRef.current });
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
  }, [currentUser, source, isPlaying]); // Re-create interval if state changes significantly to ensure closure captures fresh state? Actually refs are used in payload construction if we used refs, but we're passing state in previous send.
  // Wait, the previous send used refs. Let's make sure heartbeat uses refs or fresh state.
  // We should use refs for the heartbeat payload to avoid re-creating the interval too often, OR just depend on the values.
  // Let's use refs for the heartbeat payload to be safe and clean.
  // But wait, the source state isn't in a ref in the original code, I should fix that or use state.
  // I will use the state variables directly in the dependency array to keep it simple, or add a ref for source. 
  // Actually, let's just use the state. 


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

  const handleSendMessage = (text: string) => {
    if (!currentUser) return;

    const msg: ChatMessage = {
      id: uuidv4(),
      userId: currentUser.id,
      userName: currentUser.name,
      text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, msg]);
    if (dbRoomId) createRoomEvent(dbRoomId, SyncEventType.CHAT_MESSAGE, msg, currentUser.id);
  };

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
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    // Could show a toast here
    setShowInviteModal(false);
  };

  if (!currentUser) return <div className="min-h-screen bg-background flex items-center justify-center">Loading Party...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content: Player */}
        <div className="flex-1 flex flex-col relative bg-black/50 overflow-y-auto">
          <AdBanner isPremium={isPremium} onRemoveAds={() => setShowPaywall(true)} />

          <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center min-h-[400px]">
            {/* Host Controls Dropdown */}
            {currentUser.isHost && showControls && (
              <div className="w-full max-w-2xl mb-6 bg-surface border border-slate-700 p-4 rounded-xl animate-fade-in-down">
                <form onSubmit={handleChangeVideo} className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setNewSourceType(VideoSource.YOUTUBE)}
                      className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${newSourceType === VideoSource.YOUTUBE ? 'bg-violet-500/20 border-violet-500 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                    >
                      YouTube
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewSourceType(VideoSource.EXTERNAL)}
                      className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${newSourceType === VideoSource.EXTERNAL ? 'bg-violet-500/20 border-violet-500 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                    >
                      Web Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewSourceType(VideoSource.GOOGLE_DRIVE)}
                      className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${newSourceType === VideoSource.GOOGLE_DRIVE ? 'bg-violet-500/20 border-violet-500 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                    >
                      Google Drive
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder={
                        newSourceType === VideoSource.YOUTUBE ? "Paste YouTube link..." :
                          newSourceType === VideoSource.GOOGLE_DRIVE ? "Paste Google Drive Link..." :
                            "Paste MP4/Web link..."
                      }
                      value={newVideoUrl}
                      onChange={(e) => setNewVideoUrl(e.target.value)}
                    />
                    <Button type="submit" variant="secondary">Change</Button>
                  </div>
                </form>
              </div>
            )}

            {videoUrl ? (
              <div className="w-full max-w-4xl">
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
                />
                <div className="mt-4 flex items-center justify-between text-slate-400 text-sm px-1">
                  <span>Now Playing: <span className="text-white">{videoUrl}</span></span>
                  {currentUser.isHost && <span className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded text-xs border border-violet-500/30">You are Host</span>}
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500">
                <p className="text-xl mb-2">No video loaded.</p>
                {currentUser.isHost && <p className="text-sm">Use the Controls to add a video URL.</p>}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Chat */}
        <div className="w-72 md:w-80 border-l border-slate-800 bg-surface/30 shrink-0 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ChatWindow
              messages={messages}
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
            />
          </div>
          {/* Sidebar Ad Banner */}
          {!isPremium && (
            <div className="border-t border-slate-800 p-4 bg-slate-900/80 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-slate-800"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Partner Content</span>
                <div className="h-px flex-1 bg-slate-800"></div>
              </div>

              <div className="relative group cursor-pointer overflow-hidden rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-600/10 via-slate-900 to-fuchsia-600/10 p-4 transition-all hover:border-violet-500/50">
                {/* Decorative glow */}
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-violet-600/10 rounded-full blur-2xl group-hover:bg-violet-600/20 transition-all"></div>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">VibeCloud Hosting</h4>
                      <p className="text-[11px] text-violet-400 font-semibold tracking-wide">DEPLOY IN SECONDS</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    The fastest way to host your watch party apps and SaaS. Use <span className="text-white font-bold">VIBESTREAM</span> for $50 credit.
                  </p>

                  <button
                    onClick={() => setShowPaywall(true)}
                    className="w-full py-2 bg-white text-slate-950 text-xs font-bold rounded-lg hover:bg-violet-50 transition-colors shadow-lg shadow-white/5"
                  >
                    Get Started Free
                  </button>

                  <button
                    onClick={() => setShowPaywall(true)}
                    className="w-full mt-2 py-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Hide all ads with Premium
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Bar (Moved to Bottom) */}
      <div className="h-16 border-t border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-lg">V</span>
            </div>
          </button>
          <div className="hidden sm:block">
            <h1 className="font-bold text-slate-100 leading-tight">VibeStream</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span>Room: {roomId?.slice(0, 6)}</span>
              <span className={`w-2 h-2 rounded-full ${connectionStatus === 'CONNECTED' ? 'bg-green-500' : connectionStatus === 'CONNECTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} title={`Status: ${connectionStatus}`}></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser.isHost && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowControls(!showControls)}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>}
            >
              Controls
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowInviteModal(true)}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>}
          >
            Invite
          </Button>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Invite Friends</h3>
            <p className="text-slate-400 mb-6 text-sm">Share this link with your friends to watch together. No sign-up required for them.</p>

            <div className="flex gap-2 mb-6">
              <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm truncate">
                {window.location.href}
              </div>
              <Button onClick={copyInviteLink}>Copy</Button>
            </div>

            <div className="text-right">
              <Button variant="ghost" onClick={() => setShowInviteModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-violet-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-violet-900/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-violet-500/20 text-violet-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Upgrade to Premium</h3>
              <p className="text-slate-400">Remove all ads and unlock 4K streaming limits.</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-slate-300 text-sm">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                No more ads
              </div>
              <div className="flex items-center gap-3 text-slate-300 text-sm">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                Higher bitrate limits
              </div>
              <div className="flex items-center gap-3 text-slate-300 text-sm">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                Priority support
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full mb-3"
              onClick={() => {
                setIsPremium(true);
                setShowPaywall(false);
                alert("Thank you for your purchase! (Mock)");
              }}
            >
              Pay One-Time $25.00
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setShowPaywall(false)}>Maybe Later</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Room;