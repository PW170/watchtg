import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Button from '../components/Button';
import Input from '../components/Input';
import { VideoSource } from '../types';
import { signIn, signUp, signOut, supabase, signInWithGoogle } from '../services/supabaseService';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Create Form State
  const [hostName, setHostName] = useState('');
  const [lastName, setLastName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [sourceType, setSourceType] = useState<VideoSource>(VideoSource.YOUTUBE);

  // Join Form State
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setHostName(session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setHostName(session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User');
      } else {
        setIsAuthenticated(false);
        setHostName('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (authMode === 'signup' && !hostName) return;

    try {
      if (authMode === 'signup') {
        const { error } = await signUp(email, password, hostName);
        if (error) throw error;
        // Auto-login logic handled by onAuthStateChange or Supabase behavior
        alert('Account created! Please check your email for verification if enabled, or sign in.');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (error: any) {
      alert(error.message || 'Authentication failed');
    }
  };

  const handleLogout = async () => {
    await signOut();
    setIsAuthenticated(false);
    setHostName('');
    setEmail('');
    setPassword('');
    setAuthMode('login');
    setActiveTab('create');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName || !videoUrl || !isAuthenticated) return;

    // Generate a clean 6-char room code or UUID
    const roomId = uuidv4().slice(0, 8);

    // Store user info
    const user = { id: uuidv4(), name: hostName, isHost: true, color: '#8b5cf6' };
    localStorage.setItem(`vibestream_user_${roomId}`, JSON.stringify(user));
    localStorage.setItem(`vibestream_init_video_${roomId}`, JSON.stringify({ url: videoUrl, source: sourceType }));

    navigate(`/room/${roomId}`);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName || !joinCode) return;

    const roomId = joinCode; // Assuming code is the ID for simplicity
    const user = { id: uuidv4(), name: joinName, isHost: false, color: '#ec4899' };
    localStorage.setItem(`vibestream_user_${roomId}`, JSON.stringify(user));

    navigate(`/room/${roomId}`);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl opacity-40"></div>
      </div>

      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-3 bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-full shadow-2xl shadow-black/20">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setActiveTab('create'); }}>
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/20">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <span className="font-bold text-lg tracking-tight hidden sm:block">VibeStream</span>
        </div>

        <div className="h-6 w-px bg-white/10"></div>

        <nav className="flex gap-1">
          {['Features', 'Pricing', 'FAQ'].map((item) => (
            <a key={item} href="#" className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-all">
              {item}
            </a>
          ))}
        </nav>

        <div className="h-6 w-px bg-white/10"></div>

        <div className="flex items-center">
          {isAuthenticated ? (
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/5 rounded-full pl-4 pr-1 py-1">
              <span className="text-xs font-semibold text-violet-300">{hostName}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="!h-7 !px-3 !text-xs !rounded-full hover:!bg-white/10">Logout</Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setActiveTab('create'); setAuthMode('login'); }}
              className="!h-8 !px-5 !text-xs !bg-white/5 hover:!bg-white/10 !border !border-white/5 !rounded-full !backdrop-blur-sm shadow-sm"
            >
              Login / Sign up
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 pt-32">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Left Column: Hero Text */}
          <div className="space-y-8 text-center lg:text-left animate-fade-in">
            <div className="space-y-4">
              <span className="inline-block px-3 py-1 bg-violet-500/10 text-violet-300 rounded-full text-xs font-semibold tracking-wider border border-violet-500/20">
                LIVE NOW • WATCH TOGETHER FREE
              </span>
              <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                Watch videos with friends, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400">in sync.</span>
              </h1>
              <p className="text-lg text-slate-400 max-w-xl mx-auto lg:mx-0">
                Create a private room, invite friends, and binge YouTube or external videos together. No sign-up required for guests.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                <span>Real-time Sync</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                <span>Private & Free</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interaction Card */}
          <div className="bg-surface/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl shadow-2xl shadow-black/40 relative">

            {/* Main Tabs (Create / Join) */}
            {!(!isAuthenticated && activeTab === 'create') && (
              <div className="flex gap-2 p-1 bg-slate-900/50 rounded-lg mb-8">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'create' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Create Room
                </button>
                <button
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'join' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Join Party
                </button>
              </div>
            )}

            {activeTab === 'create' ? (
              isAuthenticated ? (
                /* CREATE ROOM FORM (Authenticated) */
                <form onSubmit={handleCreate} className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Setup Room</h3>
                    <span className="text-xs text-slate-400">Hosting as <span className="text-violet-400">{hostName}</span></span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Select Source</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setSourceType(VideoSource.YOUTUBE)}
                        className={`border rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${sourceType === VideoSource.YOUTUBE ? 'border-violet-500 bg-violet-500/10 text-white' : 'border-slate-700 hover:border-slate-500 text-slate-400'}`}
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                        <span className="text-sm">YouTube</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceType(VideoSource.EXTERNAL)}
                        className={`border rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${sourceType === VideoSource.EXTERNAL ? 'border-violet-500 bg-violet-500/10 text-white' : 'border-slate-700 hover:border-slate-500 text-slate-400'}`}
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                        <span className="text-sm">Web Link</span>
                      </button>
                    </div>
                  </div>

                  <Input
                    label="Video URL"
                    placeholder={sourceType === VideoSource.YOUTUBE ? "https://youtube.com/watch?v=..." : "https://example.com/video.mp4"}
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    required
                  />

                  <Button type="submit" size="lg" className="w-full">Start Party</Button>
                  <p className="text-xs text-center text-slate-500">
                    By starting, you agree to our Terms. No paid OTT links allowed.
                  </p>
                </form>
              ) : (
                /* AUTH FORM (Unauthenticated) */
                <div className="animate-fade-in w-full max-w-sm mx-auto">
                  {/* Top Switcher */}
                  <div className="flex bg-slate-900/80 p-1 rounded-full w-fit mb-8 border border-slate-700/50 relative z-10">
                    <button
                      onClick={() => setAuthMode('signup')}
                      className={`px-6 py-1.5 text-xs font-medium rounded-full transition-all ${authMode === 'signup' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                      Sign up
                    </button>
                    <button
                      onClick={() => setAuthMode('login')}
                      className={`px-6 py-1.5 text-xs font-medium rounded-full transition-all ${authMode === 'login' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                      Sign in
                    </button>
                  </div>

                  {/* Close button simulation (optional, just to match vibe) */}
                  <div className="absolute top-6 right-6 text-slate-500 hover:text-white cursor-pointer" onClick={() => setActiveTab('join')}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-6">
                    {authMode === 'signup' ? 'Create an account' : 'Welcome back'}
                  </h3>

                  <form onSubmit={handleAuth} className="space-y-4">
                    {authMode === 'signup' && (
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="First Name"
                          value={hostName}
                          onChange={e => setHostName(e.target.value)}
                          className="!bg-slate-900/50 !border-slate-700 focus:!bg-slate-900"
                        />
                        <Input
                          placeholder="Last Name"
                          value={lastName}
                          onChange={e => setLastName(e.target.value)}
                          className="!bg-slate-900/50 !border-slate-700 focus:!bg-slate-900"
                        />
                      </div>
                    )}

                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="!bg-slate-900/50 !border-slate-700 focus:!bg-slate-900"
                      required
                    />

                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="!bg-slate-900/50 !border-slate-700 focus:!bg-slate-900"
                      required
                    />

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full !mt-6 !text-sm"
                      variant="white"
                    >
                      {authMode === 'signup' ? 'Create an account' : 'Log in'}
                    </Button>
                  </form>

                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700/50"></div></div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-[#1e293b] px-2 text-slate-500">Or sign in with</span></div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <button
                      type="button"
                      onClick={async () => {
                        const { error } = await signInWithGoogle();
                        if (error) alert(error.message);
                      }}
                      className="flex items-center justify-center py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-700 transition-colors text-white"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.347.533 12S5.867 24 12.48 24c3.44 0 6.04-1.133 7.973-3.24 1.96-2.107 2.48-5.24 2.48-7.827 0-.547-.053-1.08-.16-1.6H12.48z" /></svg>
                      <span className="ml-2 text-sm font-medium">Continue with Google</span>
                    </button>
                  </div>

                  <p className="text-xs text-center text-slate-500 mt-6 max-w-xs mx-auto">
                    By creating an account, you agree to our <a href="#" className="hover:text-slate-300 underline">Terms & Service</a>
                  </p>
                </div>
              )
            ) : (
              /* JOIN FORM (Guest) */
              <form onSubmit={handleJoin} className="space-y-6 animate-fade-in">
                <div className="text-center mb-2">
                  <h3 className="text-lg font-semibold text-white">Join a Party</h3>
                  <p className="text-slate-400 text-xs">Enter your guest name and code.</p>
                </div>
                <Input
                  label="Guest Name"
                  placeholder="e.g. Guest123"
                  value={joinName}
                  onChange={e => setJoinName(e.target.value)}
                  required
                />
                <Input
                  label="Room Code"
                  placeholder="e.g. a7f2-99c1"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  required
                />
                <Button type="submit" size="lg" className="w-full" variant="secondary">Join Room</Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;