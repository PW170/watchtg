import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-zinc-400 transition-colors">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full h-11 px-4 ${icon ? 'pl-10' : ''}
            bg-white/[0.02] 
            border border-white/[0.06]
            rounded-xl
            text-sm text-zinc-100 placeholder:text-zinc-600
            transition-all duration-150
            focus:outline-none focus:bg-white/[0.04] focus:border-white/[0.12]
            hover:bg-white/[0.03] hover:border-white/[0.08]
            disabled:opacity-40 disabled:pointer-events-none
            ${error ? 'border-red-500/50 focus:border-red-500' : ''}
            ${className}
          `.replace(/\s+/g, ' ').trim()}
          {...props}
        />
        {/* Subtle inner glow on focus */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none shadow-[inset_0_0_0_1px_rgba(139,92,246,0.1)]"></div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
};

export default Input;