import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import ChatWindow from '../components/ChatWindow';
import AdBanner from '../components/AdBanner';
import Button from '../components/Button';
import Input from '../components/Input';
import { User, ChatMessage, SyncEventType, SyncEvent, VideoSource } from '../types';
import { syncService } from '../services/supabaseService';
import { v4 as uuidv4 } from 'uuid';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Room State
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTo, setSeekTo] = useState<number>(-1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPremium, setIsPremium] = useState(false);

  // Host Controls
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [showControls, setShowControls] = useState(false);

  // UI State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Refs for state access in callbacks
  const currentTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const videoUrlRef = useRef<string>('');

  // Keep refs synced with state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { videoUrlRef.current = videoUrl; }, [videoUrl]);

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

    // 2. Restore Video (If Host) or default empty
    const storedVideo = localStorage.getItem(`vibestream_init_video_${roomId}`);
    if (storedVideo && user.isHost) {
      const { url } = JSON.parse(storedVideo);
      setVideoUrl(url);
    }

    // 3. Connect Sync
    syncService.connect(roomId, user.id);

    // 4. If guest, ask for state
    if (!user.isHost) {
      setTimeout(() => {
        syncService.send(SyncEventType.REQUEST_STATE, {});
      }, 1000);
    }

    // 5. System Message
    const joinMsg: ChatMessage = {
      id: uuidv4(),
      userId: 'system',
      userName: 'System',
      text: `${user.name} joined the party.`,
      timestamp: Date.now(),
      isSystem: true
    };
    syncService.send(SyncEventType.CHAT_MESSAGE, joinMsg);
    setMessages(prev => [...prev, joinMsg]);

    return () => {
      syncService.disconnect();
    };
  }, [roomId, navigate]);

  // Handle Sync Events
  useEffect(() => {
    const handleSyncEvent = (event: SyncEvent) => {
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
          setVideoUrl(event.payload.url);
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
          if (currentUser?.isHost) {
            syncService.send(SyncEventType.SYNC_STATE, {
              videoUrl: videoUrlRef.current,
              isPlaying: isPlayingRef.current,
              currentTime: currentTimeRef.current
            });
          }
          break;
        case SyncEventType.SYNC_STATE:
          if (event.payload.videoUrl) setVideoUrl(event.payload.videoUrl);
          if (event.payload.isPlaying !== undefined) setIsPlaying(event.payload.isPlaying);
          if (event.payload.currentTime !== undefined) setSeekTo(event.payload.currentTime);
          break;
      }
    };

    const unsubscribe = syncService.onEvent(handleSyncEvent);
    return () => unsubscribe();
  }, [currentUser]);

  // Player Callbacks
  const handleProgress = useCallback((playedSeconds: number) => {
    currentTimeRef.current = playedSeconds;
  }, []);

  const handlePlay = useCallback(() => {
    if (!isPlaying) {
      setIsPlaying(true);
      syncService.send(SyncEventType.PLAY, { currentTime: currentTimeRef.current });
    }
  }, [isPlaying]);

  const handlePause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      syncService.send(SyncEventType.PAUSE, { currentTime: currentTimeRef.current });
    }
  }, [isPlaying]);

  const handleSeek = useCallback((seconds: number) => {
    setSeekTo(seconds);
    syncService.send(SyncEventType.SEEK, { time: seconds });
  }, []);

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
    syncService.send(SyncEventType.CHAT_MESSAGE, msg);
  };

  const handleChangeVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoUrl || !currentUser?.isHost) return;

    setVideoUrl(newVideoUrl);
    setNewVideoUrl('');
    setIsPlaying(false);
    setShowControls(false);
    syncService.send(SyncEventType.URL_CHANGE, { url: newVideoUrl });
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
      {/* Navigation Bar */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-lg">V</span>
            </div>
          </button>
          <div className="hidden sm:block">
            <h1 className="font-bold text-slate-100 leading-tight">VibeStream</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Room: {roomId?.slice(0, 6)}</p>
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

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content: Player */}
        <div className="flex-1 flex flex-col relative bg-black/50 overflow-y-auto">
          <AdBanner isPremium={isPremium} onRemoveAds={() => setShowPaywall(true)} />

          <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center min-h-[400px]">
            {/* Host Controls Dropdown */}
            {currentUser.isHost && showControls && (
              <div className="w-full max-w-2xl mb-6 bg-surface border border-slate-700 p-4 rounded-xl animate-fade-in-down">
                <form onSubmit={handleChangeVideo} className="flex gap-2">
                  <Input
                    placeholder="Paste new video URL..."
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                  />
                  <Button type="submit" variant="secondary">Change</Button>
                </form>
              </div>
            )}

            {videoUrl ? (
              <div className="w-full max-w-5xl">
                <VideoPlayer
                  url={videoUrl}
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
        <div className="w-80 md:w-96 border-l border-slate-800 bg-surface/30 shrink-0">
          <ChatWindow
            messages={messages}
            currentUser={currentUser}
            onSendMessage={handleSendMessage}
          />
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