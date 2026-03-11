import React from 'react';
import { X, ShieldAlert, Info } from 'lucide-react';

export const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const base = "relative px-6 py-3 font-sans font-semibold tracking-wide text-sm transition-all duration-200 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase";
  const styles: any = {
    primary: "bg-primary/10 text-primary border border-primary/40 hover:bg-primary/20 hover:border-primary hover:shadow-[0_0_15px_rgba(0,243,255,0.25)]",
    secondary: "bg-secondary/10 text-secondary border border-secondary/40 hover:bg-secondary/20 hover:border-secondary hover:shadow-[0_0_15px_rgba(188,19,254,0.25)]",
    danger: "bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20 hover:border-danger hover:shadow-[0_0_15px_rgba(255,46,84,0.25)]",
    ghost: "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
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
    className={`w-full cyber-input p-3.5 text-white font-light text-sm placeholder-slate-600 focus:outline-none bg-black/40 border border-white/10 rounded transition-all focus:border-primary/50 focus:shadow-[0_0_10px_rgba(0,243,255,0.15)] ${props.className || ''}`}
  />
);

export const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-panel p-6 border border-white/10 shadow-2xl relative rounded-xl bg-[#0a0a0c]/80 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
          <h3 className="text-lg font-sans font-semibold text-white tracking-tight flex items-center gap-2 uppercase">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(0,243,255,1)]"></span>
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, variant = 'primary', confirmText = 'PROCEED' }: any) => {
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
          {variant === 'danger' ? <ShieldAlert className="text-danger shrink-0 mt-1" size={24} /> : <Info className="text-primary shrink-0 mt-1" size={24} />}
          <p className="text-sm text-slate-300 leading-relaxed font-mono">{message}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 h-12">CANCEL</Button>
          <Button variant={variant} onClick={() => { onConfirm(); onClose(); }} className="flex-1 h-12">{confirmText}</Button>
        </div>
      </div>
    </Modal>
  );
};

export const AlertModal = ({ isOpen, onClose, title, message, variant = 'primary' }: any) => {
    if (!isOpen) return null;
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
            {variant === 'danger' ? <ShieldAlert className="text-danger shrink-0 mt-1" size={24} /> : <Info className="text-primary shrink-0 mt-1" size={24} />}
            <p className="text-sm text-slate-300 leading-relaxed font-mono">{message}</p>
          </div>
          <Button variant={variant} onClick={onClose} className="w-full h-12 uppercase tracking-widest font-bold">ACKNOWLEDGE</Button>
        </div>
      </Modal>
    );
};
