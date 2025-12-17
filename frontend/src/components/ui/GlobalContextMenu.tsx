import React, { useEffect, useState, useRef } from 'react';
import { LogOut, Trash2, ShieldAlert, RefreshCw, Eraser, XCircle } from 'lucide-react';

interface ContextMenuProps {
  onLogout: () => void;
  onClearActiveChat: () => void;
  onNuke: () => void;
  activeContactId: string | null;
}

export const GlobalContextMenu = ({ onLogout, onClearActiveChat, onNuke, activeContactId }: ContextMenuProps) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // KILL DEFAULT BROWSER MENU
      
      // Calculate position to keep it in viewport
      let x = e.pageX;
      let y = e.pageY;
      
      if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
      if (y + 300 > window.innerHeight) y = window.innerHeight - 310;

      setPosition({ x, y });
      setVisible(true);
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };

    const handleScroll = () => setVisible(false);

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  if (!visible) return null;

  const MenuItem = ({ icon: Icon, label, onClick, variant = 'default', shortcut }: any) => (
    <button 
      onClick={() => { onClick(); setVisible(false); }}
      className={`w-full flex items-center justify-between px-4 py-3 text-xs font-mono tracking-wider transition-colors
        ${variant === 'danger' ? 'text-danger hover:bg-danger/10' : 'text-slate-300 hover:bg-white/5 hover:text-white'}
      `}
    >
      <div className="flex items-center gap-3">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      {shortcut && <span className="opacity-30 text-[9px]">{shortcut}</span>}
    </button>
  );

  return (
    <div 
      ref={menuRef}
      style={{ top: position.y, left: position.x }}
      className="fixed z-[9999] w-56 bg-[#0a0a0c] border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl rounded-sm overflow-hidden animate-[fade_0.1s_ease-out]"
    >
      <div className="px-4 py-2 bg-white/5 border-b border-white/5 text-[9px] text-primary font-bold tracking-[0.2em] uppercase">
        System Command
      </div>

      <div className="py-1">
        {activeContactId && (
            <MenuItem icon={Eraser} label="CLEAR LOCAL HISTORY" onClick={onClearActiveChat} />
        )}
        <MenuItem icon={RefreshCw} label="RELOAD SHELL" onClick={() => window.location.reload()} shortcut="F5" />
        <MenuItem icon={LogOut} label="DISCONNECT NODE" onClick={onLogout} />
      </div>

      <div className="border-t border-white/10 py-1">
        <MenuItem icon={ShieldAlert} label="PANIC: NUKE DATA" onClick={onNuke} variant="danger" shortcut="⚠️" />
      </div>
    </div>
  );
};