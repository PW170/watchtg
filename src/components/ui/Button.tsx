import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'white';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  icon,
  className = '',
  disabled,
  ...props
}) => {

  const baseStyles = `
    relative inline-flex items-center justify-center 
    font-medium transition-all duration-150 ease-out
    rounded-xl overflow-hidden
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c]
    disabled:opacity-40 disabled:pointer-events-none
    active:scale-[0.97]
  `.replace(/\s+/g, ' ').trim();

  const variants: Record<string, string> = {
    // Refined primary - less glow, more solid
    primary: `
      bg-violet-600 text-white
      border border-violet-500/30
      hover:bg-violet-500
      focus-visible:ring-violet-500
      shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]
    `,
    // Muted secondary
    secondary: `
      bg-white/[0.03] text-zinc-300
      border border-white/[0.06]
      hover:bg-white/[0.06] hover:text-white hover:border-white/10
      focus-visible:ring-zinc-500
    `,
    // Minimal ghost
    ghost: `
      bg-transparent text-zinc-400
      hover:text-zinc-100 hover:bg-white/[0.04]
      focus-visible:ring-zinc-500
    `,
    // Danger
    danger: `
      bg-red-500/10 text-red-400
      border border-red-500/20
      hover:bg-red-500/20
      focus-visible:ring-red-500
    `,
    // Inverted white - less harsh
    white: `
      bg-zinc-100 text-zinc-900
      border border-transparent
      hover:bg-white
      focus-visible:ring-zinc-400
      shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]
    `
  };

  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-xs gap-1.5",
    md: "h-10 px-4 text-sm gap-2",
    lg: "h-12 px-6 text-base gap-2.5"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]?.replace(/\s+/g, ' ').trim()} ${sizes[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : icon ? (
        <span className="shrink-0 opacity-70">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

export default Button;