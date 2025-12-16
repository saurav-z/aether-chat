import React from 'react';
import { X } from 'lucide-react';

export const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const base = "relative px-6 py-3 font-sans font-bold tracking-wider text-sm transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase";
  const styles: any = {
    primary: "bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 hover:border-primary hover:shadow-[0_0_15px_rgba(0,243,255,0.3)]",
    secondary: "bg-secondary/10 text-secondary border border-secondary/50 hover:bg-secondary/20 hover:border-secondary hover:shadow-[0_0_15px_rgba(188,19,254,0.3)]",
    danger: "bg-danger/10 text-danger border border-danger/50 hover:bg-danger/20 hover:border-danger hover:shadow-[0_0_15px_rgba(255,46,84,0.3)]",
    ghost: "text-slate-400 hover:text-white hover:bg-white/5"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
};

export const Input = ({ ...props }: any) => (
  <input 
    {...props}
    className={`w-full cyber-input p-4 text-white font-mono text-sm placeholder-slate-600 focus:outline-none bg-black/40 border border-white/10 transition-all focus:border-primary/50 ${props.className || ''}`}
  />
);

export const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-lg glass-panel p-6 animate-[float_0.3s_ease-out] border border-white/10 shadow-2xl relative">
        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
          <h3 className="text-xl font-sans font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};