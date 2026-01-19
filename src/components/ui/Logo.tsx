import React from 'react';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showText?: boolean;
    onClick?: () => void;
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = false, onClick }) => {
    const sizes = {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16'
    };

    return (
        <div className={`flex items-center gap-3 ${className}`} onClick={onClick}>
            <div className={`${sizes[size]} relative group`}>
                {/* Main Logo Container */}
                <svg
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full drop-shadow-[0_0_8px_rgba(139,92,246,0.3)] transition-transform duration-500 group-hover:scale-110"
                >
                    {/* Background Layer - Subtle Glow */}
                    <circle cx="50" cy="50" r="45" fill="url(#logo-gradient-bg)" fillOpacity="0.1" />

                    {/* The "W" Geometry */}
                    <path
                        d="M20 30L35 75L50 45L65 75L80 30"
                        stroke="url(#logo-gradient-main)"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Overlapping Detail Layer - The "Connection" bridge */}
                    <path
                        d="M35 75L50 45L65 75"
                        stroke="white"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity="0.3"
                    />

                    {/* Abstract Eye / Watcher Node */}
                    <path
                        d="M50 45L50 30"
                        stroke="url(#logo-gradient-accent)"
                        strokeWidth="8"
                        strokeLinecap="round"
                    />

                    <defs>
                        <linearGradient id="logo-gradient-main" x1="20" y1="30" x2="80" y2="75" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#8B5CF6" />
                            <stop offset="1" stopColor="#6366F1" />
                        </linearGradient>
                        <linearGradient id="logo-gradient-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#8B5CF6" />
                            <stop offset="1" stopColor="#4F46E5" />
                        </linearGradient>
                        <linearGradient id="logo-gradient-accent" x1="50" y1="30" x2="50" y2="45" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#C084FC" />
                            <stop offset="1" stopColor="#8B5CF6" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Ambient Glow */}
                <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
            </div>

            {showText && (
                <span className="font-bold text-xl tracking-tight text-white/90 group-hover:text-white transition-colors">
                    watchwithme
                </span>
            )}
        </div>
    );
};

export default Logo;
