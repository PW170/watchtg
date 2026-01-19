import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { VideoSource } from '../types';
import Logo from '../components/ui/Logo';
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

    const roomId = uuidv4().slice(0, 8);
    const user = { id: uuidv4(), name: hostName, isHost: true, color: '#8b5cf6' };
    localStorage.setItem(`watchwithme_user_${roomId}`, JSON.stringify(user));
    localStorage.setItem(`watchwithme_init_video_${roomId}`, JSON.stringify({ url: videoUrl, source: sourceType }));

    navigate(`/room/${roomId}`);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName || !joinCode) return;

    const roomId = joinCode;
    const user = { id: uuidv4(), name: joinName, isHost: false, color: '#ec4899' };
    localStorage.setItem(`watchwithme_user_${roomId}`, JSON.stringify(user));

    navigate(`/room/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 relative overflow-y-auto flex flex-col font-sans">
      {/* Cinematic Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Deep atmospheric glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-violet-600/[0.05] rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-600/[0.05] rounded-full blur-[120px] mix-blend-screen"></div>

        {/* Noise overlay for texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      {/* Header - Minimal & Floating */}
      <header className="absolute top-0 inset-x-0 z-50 px-6 py-6 lg:px-12">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Logo showText size="md" className="cursor-pointer" />

          <nav className="hidden md:flex items-center gap-8">
            {['Features', 'Pricing', 'Docs'].map((item) => (
              <a key={item} href="#" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors relative group">
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-violet-500 transition-all group-hover:w-full"></span>
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-4 pl-6 border-l border-white/10">
                <span className="text-sm font-medium text-zinc-300">{hostName}</span>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-500 hover:text-white">Sign Out</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => { setActiveTab('create'); setAuthMode('login'); }}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Centered Grid */}
      <main className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10 w-full max-w-7xl mx-auto mt-16 lg:mt-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center w-full">

          {/* Left: Brand Narrative */}
          <div className="space-y-10 max-w-xl">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Live Sync v2.0</span>
            </div>

            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05]">
                Watch together,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 to-zinc-600">perfectly synced.</span>
              </h1>
              <p className="text-lg text-zinc-400 leading-relaxed max-w-md">
                Create a private theater for you and your friends.
                Stream YouTube or direct video links with <span className="text-zinc-200 font-medium">zero latency drift</span>.
              </p>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-[#0a0a0c] flex items-center justify-center text-xs font-bold text-zinc-500 ring-2 ring-black/20">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
                <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-[#0a0a0c] flex items-center justify-center text-xs text-zinc-500 ring-2 ring-black/20">+</div>
              </div>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">100k+</span>
                <span className="text-xs text-zinc-500">Sessions Hosted</span>
              </div>
            </div>
          </div>

          {/* Right: Interaction Card */}
          <div className="w-full max-w-md mx-auto lg:ml-auto relative">
            {/* Glow backing */}
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 rounded-[32px] blur-xl opacity-50"></div>

            <div className="bg-[#050506] border border-white/[0.08] rounded-[24px] p-1 shadow-2xl relative">
              <div className="bg-[#0a0a0c] rounded-[20px] p-6 sm:p-8 space-y-8">

                {/* Tab Switcher */}
                <div className="grid grid-cols-2 gap-1 p-1.5 bg-[#121214] rounded-xl border border-white/[0.04]">
                  {['create', 'join'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as 'create' | 'join')}
                      className={`relative py-2.5 text-xs font-semibold uppercase tracking-wide rounded-lg transition-all duration-300 ${activeTab === tab ? 'text-white shadow-[0_1px_10px_rgba(0,0,0,0.5)]' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {activeTab === tab && (
                        <div className="absolute inset-0 bg-zinc-800 rounded-lg shadow-inner border-t border-white/5"></div>
                      )}
                      <span className="relative z-10">{tab === 'create' ? 'Host Party' : 'Join Party'}</span>
                    </button>
                  ))}
                </div>

                {activeTab === 'create' ? (
                  isAuthenticated ? (
                    <form onSubmit={handleCreate} className="space-y-8 animate-fade-in">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Select Source</label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => setSourceType(VideoSource.YOUTUBE)}
                            className={`group relative h-24 rounded-2xl border transition-all duration-300 overflow-hidden ${sourceType === VideoSource.YOUTUBE ? 'bg-zinc-800/40 border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.1)]' : 'bg-transparent border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex flex-col items-center justify-center gap-3 relative z-10">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${sourceType === VideoSource.YOUTUBE ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200'}`}>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                              </div>
                              <span className={`text-xs font-medium ${sourceType === VideoSource.YOUTUBE ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>YouTube</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSourceType(VideoSource.STREAMABLE)}
                            className={`group relative h-24 rounded-2xl border transition-all duration-300 overflow-hidden ${sourceType === VideoSource.STREAMABLE ? 'bg-zinc-800/40 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-transparent border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex flex-col items-center justify-center gap-3 relative z-10">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${sourceType === VideoSource.STREAMABLE ? 'bg-white text-black' : 'bg-zinc-800 text-blue-500 group-hover:bg-zinc-700 group-hover:text-blue-400'}`}>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>
                              </div>
                              <span className={`text-xs font-medium ${sourceType === VideoSource.STREAMABLE ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>Streamable</span>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Content URL</label>
                        <div className="relative group">
                          <input
                            placeholder="Paste YouTube Link..."
                            value={videoUrl}
                            onChange={e => setVideoUrl(e.target.value)}
                            required
                            className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all hover:border-zinc-700"
                          />
                          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500"></div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <button
                          type="button"
                          onClick={(e) => {
                            // This is just a visual wrapper, the form submit handles it
                            // We use type="button" to prevent default if clicked outside logic, but inside form it should be submit
                            // Actually better to just use type="submit" on the button itself
                            handleCreate(e as any);
                          }}
                          className="w-full group relative py-4 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 transition-opacity"></div>
                          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <span className="relative text-sm font-bold text-white uppercase tracking-wide">Launch Theater</span>
                        </button>

                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] text-zinc-500">Hosting as</span>
                          <span className="text-[10px] font-bold text-zinc-300 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{hostName}</span>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-8 animate-fade-in">
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                          <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        </div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {authMode === 'signup' ? 'Create Account' : 'Welcome Back'}
                        </h3>
                        <p className="text-xs text-zinc-500 max-w-[200px] mx-auto">Enter your details to start hosting your own cinema rooms.</p>
                      </div>

                      <form onSubmit={handleAuth} className="space-y-4">
                        {authMode === 'signup' && (
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              placeholder="First Name"
                              value={hostName}
                              onChange={e => setHostName(e.target.value)}
                              className="!bg-[#121214] !border-zinc-800"
                            />
                            <Input
                              placeholder="Last Name"
                              value={lastName}
                              onChange={e => setLastName(e.target.value)}
                              className="!bg-[#121214] !border-zinc-800"
                            />
                          </div>
                        )}

                        <Input
                          type="email"
                          placeholder="Email Address"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          className="!bg-[#121214] !border-zinc-800"
                        />

                        <Input
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          className="!bg-[#121214] !border-zinc-800"
                        />

                        <button
                          type="submit"
                          className="w-full py-3.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors uppercase tracking-wide"
                        >
                          {authMode === 'signup' ? 'Sign Up' : 'Sign In'}
                        </button>
                      </form>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-zinc-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-2 bg-[#0a0a0c] text-zinc-600 font-medium">Or continue with</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const { error } = await signInWithGoogle();
                          if (error) alert(error.message);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#121214] hover:bg-zinc-800 border border-zinc-800 transition-all text-zinc-300 text-xs font-medium"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.347.533 12S5.867 24 12.48 24c3.44 0 6.04-1.133 7.973-3.24 1.96-2.107 2.48-5.24 2.48-7.827 0-.547-.053-1.08-.16-1.6H12.48z" /></svg>
                        Google
                      </button>

                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                          className="text-xs text-zinc-500 hover:text-white transition-colors underline decoration-zinc-700 underline-offset-4"
                        >
                          {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <form onSubmit={handleJoin} className="space-y-8 animate-fade-in py-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Display Name</label>
                        <Input
                          placeholder="Your Name"
                          value={joinName}
                          onChange={e => setJoinName(e.target.value)}
                          required
                          className="!bg-[#121214] !border-zinc-800"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Room Code</label>
                        <Input
                          placeholder="e.g. A7F2-99C1"
                          value={joinCode}
                          onChange={e => setJoinCode(e.target.value)}
                          required
                          className="font-mono uppercase tracking-widest text-center !text-lg !bg-[#121214] !border-zinc-800 py-4"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors uppercase tracking-wide"
                    >
                      Enter Room
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

};

export default Home;