import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
    Send, Paperclip, Activity, File, Download,
    Settings, X, Share2, Trash2, UserPlus, Shield, Lock, MessageSquare, HardDrive, Layout, ChevronLeft, Plus, Timer, CheckCircle, Copy, QrCode as QrCodeIcon, ScanLine, ShieldAlert, RefreshCw,
    Search, Wrench, Eye, EyeOff as EyeOffIcon, DownloadCloud, Ban
} from 'lucide-react';
import { Button, Input, Modal, ConfirmModal, AlertModal } from './ui/Common';
import { Contact, Message, Wallet, computeSharedSecret, hashString, hashBuffer, generateGroupKey, getRendezvousTopic, encryptStorage, decryptStorage } from '../services/cryptoUtils';
import { MeshNetwork } from '../services/mesh';
import { SecureStorage } from '../services/storage';

type Tab = 'CHATS' | 'VAULT' | 'SETTINGS';

const normalizeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const SidebarRail = ({ activeTab, totalUnread, setShowNotifications, onLogout }: any) => {
    const navigate = useNavigate();
    return (
        <div className="hidden md:flex w-20 flex-col bg-surface border-r border-white/5 items-center py-6 gap-8 z-50 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center font-bold text-black font-mono shadow-[0_0_15px_rgba(0,243,255,0.3)] shrink-0">A</div>

            <div className="flex-1 flex flex-col gap-2">
                <button title="Communications" onClick={() => navigate('/dashboard')} className={`p-4 rounded-xl transition-all ${activeTab === 'CHATS' ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                    <MessageSquare size={24} />
                </button>
                <button title="Secure Vault" onClick={() => navigate('/dashboard/vault')} className={`p-4 rounded-xl transition-all ${activeTab === 'VAULT' ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                    <HardDrive size={24} />
                </button>
                <button title="System Settings" onClick={() => navigate('/dashboard/settings')} className={`p-4 rounded-xl transition-all ${activeTab === 'SETTINGS' ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                    <Layout size={24} />
                </button>
            </div>

            <div className="flex flex-col gap-4 mb-4 items-center">
                <button title="Lock Session" onClick={onLogout} className="p-4 text-slate-500 hover:text-danger transition-colors hover:bg-danger/5 rounded-xl">
                    <Lock size={24} />
                </button>
                <button title="Network Signals" onClick={() => setShowNotifications(true)} className="relative p-4 text-slate-500 hover:text-white transition-colors hover:bg-white/5 rounded-xl">
                    <Activity size={24} className={totalUnread > 0 ? 'text-primary animate-pulse' : ''} />
                    {totalUnread > 0 && (
                        <span className="absolute top-3 right-3 w-5 h-5 bg-primary text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(0,243,255,0.5)] border-2 border-surface">
                            {totalUnread > 9 ? '9+' : totalUnread}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

const ChatList = ({ wallet, contacts, activeId, setShowInvite, setShowScan, statusMap, totalUnread, setShowNotifications }: any) => {
    const navigate = useNavigate();
    const [rollingId, setRollingId] = useState("INITIALIZING...");

    useEffect(() => {
        const update = async () => {
            const topic = await getRendezvousTopic(wallet.publicKeyRaw, 0);
            setRollingId(topic.substring(0, 12));
        };
        update();
        const i = setInterval(update, 10000);
        return () => clearInterval(i);
    }, [wallet]);

    const copyRolling = () => {
        navigator.clipboard.writeText(rollingId);
    };

    return (
        <div className="h-full flex flex-col bg-surface/95 backdrop-blur-xl border-r border-white/5 safe-pt">
            <div className="p-4 border-b border-white/5 flex items-center justify-between h-16 bg-black/20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="md:hidden w-8 h-8 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center font-bold text-black font-mono shadow-[0_0_15px_rgba(0,243,255,0.3)]">A</div>
                    <div className="flex flex-col">
                        <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Rolling Network ID</div>
                        <div className="flex items-center gap-2">
                            <div className="text-xs font-mono text-primary animate-pulse">{rollingId}</div>
                            <button onClick={copyRolling} className="hover:text-white text-slate-500"><Copy size={10} /></button>
                        </div>
                    </div>
                </div>

                <button onClick={() => setShowNotifications(true)} className="md:hidden relative p-2 text-slate-400 hover:text-white transition-colors">
                    <Activity size={20} className={totalUnread > 0 ? 'text-primary animate-pulse' : ''} />
                    {totalUnread > 0 && (
                        <span className="absolute top-0 right-0 w-4 h-4 bg-primary text-black text-[9px] font-bold rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(0,243,255,0.5)]">
                            {totalUnread > 9 ? '9+' : totalUnread}
                        </span>
                    )}
                </button>
            </div>

            <div className="p-3 grid grid-cols-2 gap-2 shrink-0">
                <Button onClick={() => setShowInvite(true)} className="w-full flex items-center justify-center gap-2 py-3 text-[10px] px-1">
                    <Share2 size={12} /> SHARE ID
                </Button>
                <Button onClick={() => setShowScan(true)} variant="secondary" className="w-full flex items-center justify-center gap-2 py-3 text-[10px] px-1">
                    <UserPlus size={12} /> ADD PEER
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
                <div className="px-2 py-2 text-[9px] font-mono text-slate-600 uppercase tracking-widest mt-2 sticky top-0 bg-surface/95 backdrop-blur z-10">Active Signals</div>
                {contacts.length === 0 && (
                    <div className="p-8 text-center opacity-30 text-[10px] font-mono">NO ACTIVE LINKS<br />INITIATE HANDSHAKE</div>
                )}
                {contacts.map((c: Contact) => (
                    <button key={c.id} onClick={() => navigate(`/dashboard/chat/${c.id}`)}
                        className={`w-full p-4 md:p-3 flex items-center gap-4 rounded-xl border transition-all duration-200 group relative overflow-hidden
                    ${activeId === c.id ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(0,243,255,0.1)]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                        <span className="text-2xl relative filter grayscale group-hover:grayscale-0 transition-all">
                            {c.emoji}
                            {c.isGroup && <span className="absolute -bottom-1 -right-1 text-[8px] bg-primary text-black px-1 rounded-full font-bold">G</span>}
                        </span>
                        <div className="flex-1 text-left min-w-0">
                            <div className="flex justify-between items-center">
                                <span className={`text-sm font-bold truncate ${activeId === c.id ? 'text-primary' : 'text-slate-300'}`}>{c.alias}</span>
                                {c.pendingClear && (
                                    <span className="flex items-center gap-1 text-[8px] bg-warning/20 text-warning px-1.5 py-0.5 rounded font-mono animate-pulse">
                                        <Timer size={8} /> CLEARING...
                                    </span>
                                )}
                                {c.unread > 0 && !c.pendingClear && (
                                    <span className="flex items-center gap-1">
                                        <span className="text-[10px] bg-primary text-black px-1.5 rounded-full font-bold">{c.unread}</span>
                                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(0,243,255,0.5)]" />
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono truncate flex items-center gap-1 mt-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusMap[c.id] ? 'bg-green-500 shadow-[0_0_5px_lime]' : 'bg-slate-700'}`}></span>
                                {statusMap[c.id] || 'OFFLINE'}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
};

const VaultView = ({ wallet, notes, setNotes, triggerConfirm }: any) => {
    const navigate = useNavigate();
    const { id: viewing } = useParams();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (viewing && viewing !== 'new') {
            const note = notes.find((n: any) => n.id === viewing);
            if (note) {
                setTitle(note.title);
                setContent(note.content);
            }
        } else {
            setTitle('');
            setContent('');
        }
    }, [viewing, notes]);

    const saveNote = async () => {
        setSaving(true);
        const newNote = { id: (viewing && viewing !== 'new') ? viewing : crypto.randomUUID(), title: title || 'Untitled', content, date: Date.now() };
        const updated = (viewing && viewing !== 'new') ? notes.map((n: any) => n.id === viewing ? newNote : n) : [newNote, ...notes];
        
        const enc = await encryptStorage(wallet.storageKey, updated);
        await SecureStorage.set('aether_vault_notes', enc);
        setNotes(updated);
        setSaving(false);
        navigate('/dashboard/vault');
    };

    const deleteNote = async (id: string) => {
        triggerConfirm(
            "DESTROY RECORD",
            "Are you sure you want to permanently destroy this secure record?",
            async () => {
                const updated = notes.filter((n: any) => n.id !== id);
                const enc = await encryptStorage(wallet.storageKey, updated);
                await SecureStorage.set('aether_vault_notes', enc);
                setNotes(updated);
            },
            'danger'
        );
    };

    if (viewing) {
        return (
            <div className="flex-1 flex flex-col h-full bg-surface safe-pt safe-pb z-50">
                <div className="p-4 border-b border-white/10 flex items-center justify-center relative bg-surface/50 backdrop-blur">
                    <button onClick={() => navigate('/dashboard/vault')} className="absolute left-4 text-slate-400 hover:text-white"><ChevronLeft /></button>
                    <span className="font-mono text-xs tracking-widest text-primary">SECURE RECORD</span>
                    <button onClick={saveNote} className="absolute right-4 text-primary hover:text-white font-bold text-sm" disabled={saving}>{saving ? '...' : 'SAVE'}</button>
                </div>
                <div className="p-6 flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full">
                    <input className="bg-transparent text-3xl font-bold text-white placeholder-slate-700 outline-none border-b border-white/5 pb-4 focus:border-primary/30 transition-colors" placeholder="Subject / Title" value={title} onChange={e => setTitle(e.target.value)} />
                    <textarea className="flex-1 bg-transparent text-lg font-mono text-slate-300 resize-none outline-none leading-relaxed custom-scrollbar" placeholder="Enter secure data..." value={content} onChange={e => setContent(e.target.value)} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-surface border-r border-white/5 safe-pt">
            <div className="p-4 border-b border-white/5 flex items-center justify-between h-16 bg-black/20 shrink-0">
                <div className="flex items-center gap-2">
                    <HardDrive size={18} className="text-primary" />
                    <span className="font-bold text-sm uppercase tracking-widest text-slate-300">Vault</span>
                </div>
                <button onClick={() => navigate('/dashboard/vault/new')} className="text-primary hover:scale-110 transition-transform"><Plus size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {notes.length === 0 && (
                    <div className="p-12 text-center opacity-20 text-[10px] font-mono tracking-[0.2em]">VAULT EMPTY</div>
                )}
                {notes.map((n: any) => (
                    <div key={n.id} onClick={() => navigate(`/dashboard/vault/${n.id}`)} className="bg-white/5 border border-white/5 p-4 rounded-xl hover:border-primary/30 hover:bg-white/10 transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-1">
                            <div className="font-bold text-sm truncate text-slate-200">{n.title}</div>
                            <button onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }} className="text-slate-600 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono line-clamp-2 leading-relaxed">{n.content}</div>
                        <div className="mt-3 text-[8px] text-slate-700 font-mono uppercase tracking-tighter">
                            Record ID: {n.id.substring(0,8)} • {new Date(n.date).toLocaleDateString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Linkify = ({ text }: { text: string }) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
        <span className="whitespace-pre-wrap">
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all" onClick={(e) => e.stopPropagation()}>{part}</a>;
                }
                return part;
            })}
        </span>
    );
};

const ChatHistory = ({ messages, onDelete, jumpToId, onViewFile }: any) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [limit, setLimit] = useState(50);
    
    useEffect(() => {
        if (jumpToId) {
            const index = messages.findIndex((m: any) => m.id === jumpToId);
            if (index !== -1) {
                const fromEnd = messages.length - index;
                if (fromEnd > limit) setLimit(fromEnd + 10);
                
                setTimeout(() => {
                    const el = document.getElementById(`msg-${jumpToId}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el?.classList.add('highlight-pulse');
                    setTimeout(() => el?.classList.remove('highlight-pulse'), 2000);
                }, 100);
            }
        } else if (limit === 50) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, limit, jumpToId]);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const msgId = entry.target.id.replace('msg-', '');
                    const msg = messages.find((m: any) => m.id === msgId);
                    if (msg && msg.file && msg.sender !== 'me' && !msg.file._viewedSent) {
                        onViewFile(msgId);
                        msg.file._viewedSent = true; 
                    }
                }
            });
        }, { threshold: 0.5 });

        messages.forEach((m: any) => {
            if (m.file && m.sender !== 'me') {
                const el = document.getElementById(`msg-${m.id}`);
                if (el) observer.observe(el);
            }
        });

        return () => observer.disconnect();
    }, [messages, onViewFile]);

    const getReplyText = (id: string) => {
        const m = messages.find((x: any) => x.id === id);
        return m ? (m.text.substring(0, 30) + (m.text.length > 30 ? '...' : '')) : 'Deleted Message';
    };

    const visibleMessages = useMemo(() => {
        return messages.slice(-limit);
    }, [messages, limit]);

    const hasMore = messages.length > limit;

    return (
        <>
            {hasMore && (
                <div className="flex justify-center pb-4">
                    <button 
                        onClick={() => setLimit(prev => prev + 50)}
                        className="text-[10px] font-mono text-primary bg-primary/5 border border-primary/20 px-4 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
                    >
                        LOAD OLDER MESSAGES ({messages.length - limit} REMAINING)
                    </button>
                </div>
            )}
            {visibleMessages.map((msg: Message) => {
                if (msg.type === 'system') return (
                    <div key={msg.id} className="text-center text-[9px] text-slate-600 font-mono my-4 uppercase tracking-widest border-t border-white/5 pt-2 w-3/4 mx-auto">
                        {msg.text}
                    </div>
                );
                return (
                    <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'} group relative z-10 transition-all duration-500`}>
                        {msg.sender !== 'me' && <span className="text-[9px] text-slate-500 mb-1 ml-1 font-mono">{msg.sender}</span>}
                        <div className={`max-w-[85%] md:max-w-[60%] relative`}>
                            {msg.replyTo && (
                                <div className="text-[10px] text-slate-400 mb-1 opacity-70 border-l-2 border-slate-500 pl-2 italic">
                                    Replying to: {getReplyText(msg.replyTo)}
                                </div>
                            )}
                            <div className={`p-3 md:p-4 rounded-2xl border backdrop-blur-sm relative shadow-lg
                                ${msg.sender === 'me'
                                    ? 'bg-primary/10 border-primary/20 text-white rounded-tr-sm'
                                    : 'bg-[#1a1a1f] border-white/10 text-slate-200 rounded-tl-sm'}`}>

                                {msg.text && <p className="text-sm leading-relaxed font-sans select-text"><Linkify text={msg.text} /></p>}
                                {msg.file && (
                                    <div className="mt-3 p-3 bg-black/40 rounded border border-white/10 flex flex-col gap-3 overflow-hidden hover:border-primary/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            {msg.file.type.startsWith('image') ? (
                                                (msg.file.viewLimit && (msg.file.viewCount || 0) >= msg.file.viewLimit && msg.sender !== 'me') ? (
                                                    <div className="h-32 w-full flex flex-col items-center justify-center bg-white/5 rounded border border-dashed border-white/10">
                                                        <EyeOffIcon size={24} className="text-slate-600 mb-2" />
                                                        <span className="text-[10px] font-mono text-slate-500 uppercase">VIEW LIMIT REACHED</span>
                                                    </div>
                                                ) : <img src={msg.file.data} className="h-32 object-contain" />
                                            ) : <File size={24} className="text-primary" />}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1 overflow-hidden">
                                                    <div className="text-xs font-bold truncate">{msg.file.name}</div>
                                                    {msg.file.integrity && <Shield size={10} className="text-primary shrink-0" />}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{(msg.file.size / 1024).toFixed(1)}KB</div>
                                            </div>
                                            {msg.file.isDownloadable !== false && (
                                                <a href={msg.file.data} download={msg.file.name} className="p-2 hover:bg-white/10 rounded-full text-primary"><Download size={16} /></a>
                                            )}
                                        </div>
                                        
                                        {(msg.file.viewLimit || msg.sender === 'me') && (
                                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                                <div className="flex items-center gap-1 text-[8px] font-mono text-slate-500 uppercase">
                                                    <Eye size={10} /> {msg.file.viewCount || 0} / {msg.file.viewLimit || '∞'} VIEWS
                                                </div>
                                                {msg.file.isDownloadable === false && (
                                                    <div className="flex items-center gap-1 text-[8px] font-mono text-danger uppercase">
                                                        <Ban size={10} /> VIEW ONLY
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center gap-1">
                                    {msg.expiresAt && <Timer size={10} className="text-danger animate-pulse mr-1" />}
                                    <div className="text-[9px] opacity-40 font-mono tracking-wider">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    {msg.sender === 'me' && (
                                        <div className="flex items-center -ml-0.5">
                                            <CheckCircle size={8} className={`${(msg.status === 'seen' || msg.status === 'received') ? (msg.status === 'seen' ? 'text-primary' : 'text-slate-500') : 'text-slate-700'}`} />
                                            {(msg.status === 'seen' || msg.status === 'received') && (
                                                <CheckCircle size={8} className={`${msg.status === 'seen' ? 'text-primary' : 'text-slate-500'} -ml-1`} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {msg.sender === 'me' && (
                                <button onClick={() => onDelete(msg.id)} className="absolute top-2 -left-8 p-2 text-slate-600 hover:text-danger opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
            <div ref={bottomRef} />
        </>
    );
};

const ChatInput = ({ onSend, defaultVanish, triggerAlert, searchQuery }: any) => {
    const [txt, setTxt] = useState('');
    const [file, setFile] = useState<any>(null);
    const [vanish, setVanish] = useState<number>(defaultVanish || 0);
    const [showVanishMenu, setShowVanishMenu] = useState(false);
    const [showCustomVanish, setShowCustomVanish] = useState(false);
    const [customVanishValue, setCustomVanishValue] = useState(10);
    const [customVanishUnit, setCustomVanishUnit] = useState<'S' | 'M' | 'H' | 'D'>('M');
    
    const [isDownloadable, setIsDownloadable] = useState(true);
    const [viewLimit, setViewLimit] = useState(0); // 0 = unlimited

    const fileRef = useRef<HTMLInputElement>(null);
    const MAX_FILE_SIZE = 16 * 1024 * 1024;

    const submit = () => {
        if (!txt.trim() && !file) return;
        
        const fileSettings = file ? {
            isDownloadable,
            viewLimit: viewLimit > 0 ? viewLimit : undefined
        } : undefined;

        onSend(txt, file ? { ...file, ...fileSettings } : null, undefined, vanish);
        setTxt(''); setFile(null);
    };

    const processFile = async (f: File) => {
        try {
            const buffer = await f.arrayBuffer();
            const integrity = await hashBuffer(buffer);
            const reader = new FileReader();
            reader.onload = (e: any) => {
                setFile({ name: f.name, type: f.type, size: f.size, data: e.target.result, integrity });
            };
            reader.readAsDataURL(f);
        } catch (e) {
            console.error("File integrity check failed", e);
        }
    };

    const getCustomVanishMs = () => {
        const multipliers = { S: 1000, M: 60000, H: 3600000, D: 86400000 };
        return customVanishValue * multipliers[customVanishUnit];
    };

    return (
        <div className="p-3 md:p-4 relative">
            {showVanishMenu && (
                <div className="absolute bottom-full left-4 mb-2 w-48 bg-[#0a0a0c] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-bottom-2">
                    <div className="p-2 border-b border-white/5 flex items-center justify-between bg-white/5">
                        <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-widest pl-2">Vanish Timer</span>
                        <button onClick={() => setShowCustomVanish(!showCustomVanish)} className={`p-1.5 rounded transition-colors ${showCustomVanish ? 'bg-primary text-black' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                            <Wrench size={12} />
                        </button>
                    </div>
                    
                    {!showCustomVanish ? (
                        <div className="p-1 grid grid-cols-1 gap-0.5">
                            {[0, 10000, 60000, 3600000, 86400000].map(v => (
                                <button key={v} onClick={() => { setVanish(v); setShowVanishMenu(false); }} className={`w-full text-left px-3 py-2 text-[10px] font-mono rounded hover:bg-white/5 transition-colors ${vanish === v ? 'text-primary' : 'text-slate-400'}`}>
                                    {v === 0 ? 'OFF (PERMANENT)' : 
                                     v === 10000 ? '10 SECONDS' : 
                                     v === 60000 ? '1 MINUTE' : 
                                     v === 3600000 ? '1 HOUR' : '24 HOURS'}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-3 space-y-3 bg-primary/5">
                            <div className="flex gap-1">
                                {['S', 'M', 'H', 'D'].map((u: any) => (
                                    <button key={u} onClick={() => setCustomVanishUnit(u)} className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${customVanishUnit === u ? 'bg-primary text-black border-primary' : 'border-white/10 text-slate-500'}`}>{u}</button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="range" min="1" max="60" value={customVanishValue} onChange={e => setCustomVanishValue(parseInt(e.target.value))} className="flex-1 accent-primary h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                <span className="text-xs font-mono text-primary w-6">{customVanishValue}</span>
                            </div>
                            <Button onClick={() => { setVanish(getCustomVanishMs()); setShowVanishMenu(false); setShowCustomVanish(false); }} className="w-full h-8 text-[10px]">SET TIMER</Button>
                        </div>
                    )}
                </div>
            )}
            {file && (
                <div className="flex flex-col bg-white/5 border border-white/10 rounded-xl p-3 animate-in slide-in-from-bottom-2 duration-200 mb-2">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-primary">
                            <File size={16} />
                            <span className="text-xs max-w-[200px] truncate font-mono font-bold">{file.name}</span>
                        </div>
                        <button onClick={() => setFile(null)} className="p-1 hover:bg-white/10 rounded"><X size={14} className="text-danger" /></button>
                    </div>
                    
                    <div className="flex items-center gap-4 border-t border-white/5 pt-3">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsDownloadable(!isDownloadable)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono transition-all ${isDownloadable ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-danger/10 text-danger border border-danger/20'}`}
                            >
                                {isDownloadable ? <DownloadCloud size={12} /> : <Ban size={12} />}
                                {isDownloadable ? 'ALLOW DOWNLOAD' : 'VIEW ONLY'}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                            <Eye size={12} />
                            <span>LIMIT:</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setViewLimit(v => Math.max(0, v - 1))} className="w-5 h-5 flex items-center justify-center bg-white/5 rounded hover:bg-white/10">-</button>
                                <span className={viewLimit > 0 ? 'text-primary font-bold w-4 text-center' : 'text-slate-600 w-4 text-center'}>{viewLimit === 0 ? '∞' : viewLimit}</span>
                                <button onClick={() => setViewLimit(v => v + 1)} className="w-5 h-5 flex items-center justify-center bg-white/5 rounded hover:bg-white/10">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex gap-2 items-end">
                <button onClick={() => setShowVanishMenu(!showVanishMenu)} className={`p-3 transition-colors rounded-xl border border-transparent hover:bg-white/5 ${vanish > 0 ? 'text-danger border-danger/20' : 'text-slate-400'}`}>
                    <div className="relative">
                        <Timer size={20} />
                        {vanish > 0 && <span className="absolute -top-2 -right-2 text-[8px] font-bold bg-danger text-white px-1 rounded-full min-w-[14px] flex items-center justify-center">
                            {vanish < 60000 ? `${vanish/1000}S` : 
                             vanish < 3600000 ? `${Math.round(vanish/60000)}M` : 
                             vanish < 86400000 ? `${Math.round(vanish/3600000)}H` : '1D'}
                        </span>}
                    </div>
                </button>
                <button onClick={() => fileRef.current?.click()} className="p-3 text-slate-400 hover:text-white transition-colors hover:bg-white/5 rounded-xl relative group">
                    <Paperclip size={20} />
                </button>
                <input type="file" ref={fileRef} className="hidden" onChange={(e: any) => {
                    const f = e.target.files[0];
                    if (f) {
                        if (f.size > MAX_FILE_SIZE) {
                            triggerAlert("FILE TOO LARGE", "TRANSMISSION ERROR: File exceeds 16MB encryption limit.", 'danger');
                            e.target.value = null;
                            return;
                        }
                        processFile(f);
                    }
                }} />
                <textarea
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 resize-none max-h-32 min-h-[46px] transition-all"
                    rows={1} placeholder={searchQuery ? "Searching messages..." : "Message..."} value={txt} onChange={e => setTxt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                />
                <button onClick={submit} className="p-3 bg-primary text-black rounded-xl hover:bg-primary/80 transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.4)] transform active:scale-95"><Send size={20} /></button>
            </div>
        </div>
    );
};

const ChatWindow = ({ activeContact, messages, onSend, onDelete, status, setShowSettings, activeTransfer, onCancelTransfer, triggerAlert, searchQuery, setSearchQuery, searchResults, onViewFile }: any) => {
    const navigate = useNavigate();
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [jumpToId, setJumpToId] = useState<string | null>(null);

    const scrollToMessage = (id: string) => {
        setJumpToId(id);
        setSearchQuery('');
    };

    if (!activeContact) {
        return (
            <div className="flex-1 hidden md:flex flex-col items-center justify-center opacity-20 pointer-events-none select-none">
                <Activity size={100} className="animate-pulse-slow" />
                <p className="mt-8 font-mono tracking-[0.5em] text-sm">AWAITING SIGNAL</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 md:static md:inset-auto flex-1 flex flex-col w-full h-full bg-surface">
            {activeTransfer && (
                <div className="bg-black/80 backdrop-blur-md p-3 border-b border-primary/20 flex flex-col gap-2 animate-in slide-in-from-top duration-300 z-30">
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                            <Activity size={14} className="text-primary animate-pulse" />
                            <span className="text-[10px] font-mono text-primary tracking-widest uppercase">Securing Transmission...</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{activeTransfer.progress}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden flex items-center">
                        <div
                            className="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_#00f3ff]"
                            style={{ width: `${activeTransfer.progress}%` }}
                        />
                    </div>
                    <button
                        onClick={onCancelTransfer}
                        className="self-center mt-1 px-4 py-1.5 rounded-full bg-danger/10 border border-danger/20 text-danger text-[10px] font-mono hover:bg-danger hover:text-white transition-all transform active:scale-95 flex items-center gap-1.5"
                    >
                        <X size={10} /> CANCEL UPLOAD
                    </button>
                </div>
            )}

            <div className="h-16 border-b border-white/5 bg-surface/95 backdrop-blur flex items-center px-4 justify-between z-20 shadow-sm safe-pt shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => navigate('/dashboard')} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"><ChevronLeft /></button>
                    <div className="text-3xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{activeContact.emoji}</div>
                    <div onClick={() => setShowSettings(true)} className="cursor-pointer hover:opacity-80 transition-opacity ml-2 min-w-0">
                        <div className="font-bold text-white leading-none flex items-center gap-2 text-lg truncate">
                            {activeContact.alias}
                        </div>
                        <div className="text-[10px] font-mono text-primary flex items-center gap-2 mt-1 truncate">
                            <div className="flex items-center gap-1">
                                <Lock size={10} className="text-primary/70" />
                                {status || 'ENCRYPTED'}
                            </div>
                            {activeContact.vanishTime ? (
                                <span className="text-danger flex items-center gap-1 border border-danger/30 px-1 rounded bg-danger/5">
                                    <Timer size={8} /> TTL
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative hidden sm:block">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Find..." 
                            className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-[10px] text-white focus:outline-none focus:border-primary/30 w-24 focus:w-40 transition-all font-mono"
                        />
                        {searchQuery && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-[#0a0a0c] border border-white/10 rounded-xl shadow-2xl z-[110] max-h-80 overflow-y-auto custom-scrollbar">
                                <div className="p-2 text-[9px] font-mono text-primary uppercase border-b border-white/5 bg-white/5 sticky top-0">Found {searchResults.length} matches</div>
                                {searchResults.map((m: any) => (
                                    <button key={m.id} onClick={() => scrollToMessage(m.id)} className="w-full p-3 text-left hover:bg-white/5 border-b border-white/5 transition-colors group">
                                        <div className="text-[10px] text-slate-300 line-clamp-2 mb-1 font-sans">{m.text}</div>
                                        <div className="text-[8px] text-slate-600 font-mono">{new Date(m.timestamp).toLocaleString()}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={() => setShowSettings(true)} className="text-slate-500 hover:text-white p-2 flex items-center gap-2">
                        <div className="hidden lg:flex flex-col items-end">
                            <span className="text-[8px] text-slate-500 font-mono">LINK STRENGTH</span>
                            <div className="flex gap-0.5 mt-0.5">
                                {[1, 2, 3, 4].map(i => <div key={i} className={`w-3 h-1 rounded-full ${status === 'SECURE_RELAY_CONNECTED' ? 'bg-primary' : 'bg-slate-800'}`}></div>)}
                            </div>
                        </div>
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar relative bg-black/50" ref={chatContainerRef}>
                <div className="absolute inset-0 bg-cyber-grid bg-[length:30px_30px] opacity-[0.03] pointer-events-none" />
                <ChatHistory messages={messages} onDelete={onDelete} jumpToId={jumpToId} onViewFile={onViewFile} />
            </div>

            <div className="p-4 bg-surface border-t border-white/5 safe-pb shrink-0">
                <ChatInput onSend={onSend} defaultVanish={activeContact?.vanishTime} triggerAlert={triggerAlert} searchQuery={searchQuery} />
            </div>
        </div>
    );
};

export default function Dashboard({ wallet, contacts, setContacts, onLogout, meshRefs, installPrompt, onInstall, isSaving, version }: any) {
    const navigate = useNavigate();
    const location = useLocation();
    
    const activeId = useMemo(() => {
        const match = location.pathname.match(/\/dashboard\/chat\/([^/]+)/);
        return match ? match[1] : undefined;
    }, [location.pathname]);

    const activeVaultId = useMemo(() => {
        const match = location.pathname.match(/\/dashboard\/vault\/([^/]+)/);
        return match ? match[1] : undefined;
    }, [location.pathname]);
    
    const activeTab = useMemo<Tab>(() => {
        if (location.pathname.startsWith('/dashboard/vault')) return 'VAULT';
        if (location.pathname.startsWith('/dashboard/settings')) return 'SETTINGS';
        return 'CHATS';
    }, [location]);

    const [showInvite, setShowInvite] = useState(false);
    const [showScan, setShowScan] = useState(false);
    const [showGroup, setShowGroup] = useState(false);
    const [showSync, setShowSync] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    // Modal State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'primary' | 'danger' | 'secondary';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'primary',
        onConfirm: () => { }
    });

    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'primary' | 'danger';
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'primary'
    });

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    
    const activeContact = useMemo(() => contacts.find((c: Contact) => c.id === activeId), [contacts, activeId]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim() || !activeContact) return [];
        return activeContact.messages.filter((m: Message) => 
            m.text?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            m.file?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, activeContact]);

    const totalUnread = useMemo(() => contacts.reduce((sum: number, c: Contact) => sum + (c.unread || 0), 0), [contacts]);

    const triggerConfirm = (title: string, message: string, onConfirm: () => void, variant: 'primary' | 'danger' | 'secondary' = 'primary') => {
        setConfirmState({ isOpen: true, title, message, onConfirm, variant });
    };

    const triggerAlert = (title: string, message: string, variant: 'primary' | 'danger' = 'primary') => {
        setAlertState({ isOpen: true, title, message, variant });
    };

    // Vault State
    const [notes, setNotes] = useState<{ id: string, title: string, content: string, date: number }[]>([]);
    useEffect(() => {
        SecureStorage.get('aether_vault_notes').then(async (enc) => {
            if (enc && wallet) {
                const decrypted = await decryptStorage(wallet.storageKey, enc);
                setNotes(decrypted || []);
            }
        });
    }, [wallet]);

    // Alias Editing State
    const [editAlias, setEditAlias] = useState('');

    // Pull to Refresh State
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [touchStart, setTouchStart] = useState(0);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        // Force sync for all contacts
        contacts.forEach((c: Contact) => syncHistory(c.id));
        setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
        }, 1500);
    };

    // Service Worker Sync for Background Notifications
    useEffect(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const syncTopics = async () => {
                const topics = await Promise.all(contacts.map((c: Contact) => getRendezvousTopic(c.sharedSecret, 0)));
                navigator.serviceWorker.controller?.postMessage({
                    type: 'SYNC_TOPICS',
                    topics,
                    url: (import.meta as any).env?.VITE_BACKEND_URL || (window.location.origin === 'http://localhost:5173' ? 'http://localhost:3000' : window.location.origin)
                });
            };
            syncTopics();
        }
    }, [contacts]);
    
    // Peer Handshake Logic for the person SCANNING
    const [scanStatus, setScanStatus] = useState('IDLE');
    const [manualCode, setManualCode] = useState('');
    
    // Identity Sync Logic
    const [syncStatus, setSyncStatus] = useState('IDLE');
    const [syncCode, setSyncCode] = useState('');

    const startSync = async () => {
        setSyncStatus('GENERATING CODE...');
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 12; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
            if ((i + 1) % 4 === 0 && i !== 11) code += '-';
        }
        setSyncCode(code);
        setSyncStatus('PREPARING PAYLOAD...');
        
        const secret = await hashString("SYNC_" + code);
        const mesh = new MeshNetwork(secret, () => {}, () => {});
        
        const vault = await SecureStorage.get('aether_vault');
        const encryptedContacts = await SecureStorage.get('aether_contacts');
        
        setSyncStatus('BROADCASTING VAULT...');
        await mesh.broadcast({ 
            type: 'SYNC_PAYLOAD', 
            data: { vault, contacts: encryptedContacts } 
        });
        setSyncStatus('AWAITING PICKUP...');
    };

    const initiateHandshake = async (code: string) => {
        try {
            setScanStatus('ESTABLISHING CONNECTION...');
            const secret = await hashString("BURNER_" + normalizeId(code));
            
            const mesh = new MeshNetwork(secret, async (msg: any) => {
                if (msg.type === 'HANDSHAKE_REPLY') {
                    setScanStatus('COMPUTING KEYS...');
                    const sharedSecret = await computeSharedSecret(wallet.privateKey, msg.publicKeyRaw);
                    const peerId = await hashString(msg.publicKeyRaw);
                    
                    // Send ACK
                    await mesh.broadcast({ type: 'HANDSHAKE_ACK' });
                    
                    handleAddContact({ 
                        id: peerId, 
                        alias: msg.alias || 'Peer', 
                        emoji: msg.emoji || '👤', 
                        sharedSecret, 
                        messages: [], 
                        unread: 0 
                    });
                    mesh.destroy();
                    setScanStatus('IDLE');
                }
            }, () => {});

            // Broadcast Handshake
            await mesh.broadcast({ 
                type: 'HANDSHAKE', 
                publicKeyRaw: wallet.publicKeyRaw, 
                alias: wallet.alias || 'Anonymous', 
                emoji: wallet.emoji || '👤' 
            });
            setScanStatus('AWAITING PEER RESPONSE...');
        } catch (e) {
            console.error("Handshake Failed:", e);
            setScanStatus('HANDSHAKE FAILED');
        }
    };

    useEffect(() => {
        if (showScan && scanStatus === 'IDLE') {
            let scanner: Html5QrcodeScanner | null = null;
            const timer = setTimeout(() => {
                const el = document.getElementById("peer-scanner");
                if (el) {
                    scanner = new Html5QrcodeScanner("peer-scanner", { fps: 10, qrbox: 250 }, false);
                    scanner.render((t) => {
                        try {
                            const d = JSON.parse(t);
                            if (d.type === 'AETHER_SYNC' && d.code) {
                                scanner?.clear();
                                initiateHandshake(d.code);
                            }
                        } catch { 
                            if (t.length >= 12) {
                                scanner?.clear();
                                initiateHandshake(t);
                            }
                        }
                    }, () => { });
                }
            }, 100);
            return () => { 
                if (scanner) {
                    try { scanner.clear() } catch (e) { console.warn(e) }
                }
                clearTimeout(timer); 
            };
        }
    }, [showScan, scanStatus]);

    const contactsRef = useRef<Contact[]>([]);
    useEffect(() => { contactsRef.current = contacts; }, [contacts]);

    const [activeTransfer, setActiveTransfer] = useState<{ id: string, progress: number } | null>(null);
    const [activeInvite, setActiveInvite] = useState<{ code: string, timeLeft: number, secret: string } | null>(null);
    const inviteMeshRef = useRef<any>(null);
    const handshakeLockedRef = useRef<boolean>(false);
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});

    const notify = (title: string, body: string) => {
        const hasNotification = typeof window !== 'undefined' && 'Notification' in window && (Notification as any).permission === 'granted';
        if (hasNotification) {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'NOTIFY_IF_SAFE', title, body });
            } else {
                const n = new Notification(title, { body, icon: '/logo.png', badge: '/logo.png', silent: true });
                const close = () => n.close();
                n.onclick = close;
                setTimeout(close, 4000);
            }
        }
    };

    useEffect(() => {
        contacts.forEach((c: Contact) => {
            if (!meshRefs.current.has(c.id)) {
                const syncDebounce = { timer: null as ReturnType<typeof setTimeout> | null };
                const m = new MeshNetwork(
                    c.sharedSecret,
                    (raw: unknown) => {
                        const msg = raw as Message;
                        handleIncomingMessage(c.id, msg);
                        const isNotThisChat = activeId !== c.id || activeTab !== 'CHATS';
                        if (document.hidden || isNotThisChat) {
                            if (msg.type !== 'seen' && msg.type !== 'delete' && msg.type !== 'sync_manifest' && msg.type !== 'sync_delivery') {
                                notify("Aether Signal", "New secure transmission received.");
                            }
                        }
                    },
                    (s) => {
                        setStatusMap(prev => ({ ...prev, [c.id]: s }));
                        if (s === 'SECURE_RELAY_CONNECTED') {
                            if (syncDebounce.timer) clearTimeout(syncDebounce.timer);
                            syncDebounce.timer = setTimeout(() => {
                                syncDebounce.timer = null;
                                syncHistory(c.id);
                            }, 1200);
                        }
                    }
                );
                meshRefs.current.set(c.id, m);
            }
        });
    }, [contacts]);

    const syncHistory = (contactId: string) => {
        const contact = contactsRef.current.find(c => c.id === contactId);
        if (!contact) return;
        const lastIds = contact.messages.filter(m => m.type !== 'system' && m.id).slice(-10).map(m => m.id);
        sendSignal(contactId, { type: 'sync_manifest', ids: lastIds });
    };

    const handleIncomingMessage = (contactId: string, msg: Message) => {
        setContacts((prev: Contact[]) => prev.map(c => {
            if (c.id !== contactId) return c;
            if (msg.type === 'clear_chat_request') {
                sendSignal(contactId, { type: 'clear_chat_ack' });
                return { ...c, messages: [], unread: 0 };
            }
            if (msg.type === 'clear_chat_ack') {
                return { ...c, messages: [], unread: 0, pendingClear: false };
            }
            if (msg.type === 'clear_chat') return { ...c, messages: [], unread: 0 };
            if (msg.type === 'delete') return { ...c, messages: c.messages.filter(m => m.id !== msg.text) };
            if (msg.type === 'disconnect') {
                setTimeout(() => {
                    setContacts((curr: Contact[]) => curr.filter(contact => contact.id !== contactId));
                    if (activeId === contactId) navigate('/dashboard');
                }, 100);
                return c;
            }
            if (msg.type === 'seen') return { ...c, messages: c.messages.map(m => (m.id === msg.text || !msg.text) ? { ...m, status: 'seen' } : m) };
            if (msg.type === 'ack_receipt') return { ...c, messages: c.messages.map(m => m.id === msg.text ? { ...m, status: 'received' } : m) };
            if (msg.type === 'viewed') return { ...c, messages: c.messages.map(m => m.id === msg.text ? { ...m, file: m.file ? { ...m.file, viewCount: (m.file.viewCount || 0) + 1 } : undefined } : m) };
            if (msg.type === 'sync_manifest') {
                const theirIds = new Set(msg.ids);
                const toSend = c.messages.filter(m => m.type !== 'system' && !theirIds.has(m.id)).slice(-10);
                if (toSend.length > 0) sendSignal(contactId, { type: 'sync_delivery', messages: toSend });
                return c;
            }
            if (msg.type === 'sync_delivery' && msg.messages) {
                const myIds = new Set(c.messages.map(m => m.id));
                const newMsgs = msg.messages.filter((m: Message) => !myIds.has(m.id));
                if (newMsgs.length === 0) return c;
                const combined = [...c.messages, ...newMsgs].sort((a, b) => a.timestamp - b.timestamp);
                return { ...c, messages: combined, unread: c.unread + newMsgs.length };
            }
            if (msg.type === 'invite') {
                try {
                    const inviteData = JSON.parse(msg.text);
                    setTimeout(() => {
                        setContacts((curr: Contact[]) => {
                            if (curr.find(g => g.id === inviteData.id)) return curr;
                            return [...curr, { id: inviteData.id, alias: inviteData.name, emoji: inviteData.emoji, sharedSecret: inviteData.key, messages: [], unread: 1, isGroup: true }];
                        });
                    }, 100);
                    return { ...c, messages: [...c.messages, { ...msg, type: 'system', text: `Invited you to group: ${inviteData.name}` }] };
                } catch { return c; }
            }
            if (c.messages.find(m => m.id === msg.id)) {
                if ((msg.type as any) !== 'ack_receipt' && (msg.type as any) !== 'seen' && msg.type !== 'system') {
                    setTimeout(() => sendSignal(contactId, { type: 'ack_receipt', text: msg.id }), 200);
                }
                return c;
            }
            if ((msg.type as any) !== 'ack_receipt' && (msg.type as any) !== 'seen' && msg.type !== 'system' && (msg.type as any) !== 'sync_manifest' && (msg.type as any) !== 'sync_delivery') {
                setTimeout(() => sendSignal(contactId, { type: 'ack_receipt', text: msg.id }), 200);
            }
            const isCurrent = activeId === contactId;
            if (isCurrent && !document.hidden) {
                setTimeout(() => sendSignal(contactId, { type: 'seen', text: msg.id }), 500);
            }
            return { ...c, messages: [...c.messages, { ...msg, sender: msg.senderAlias || 'them' }], unread: isCurrent ? 0 : c.unread + 1 };
        }));
    };

    const sendSignal = async (contactId: string, payload: any) => {
        const mesh = meshRefs.current.get(contactId);
        if (mesh) await mesh.broadcast({ id: crypto.randomUUID(), timestamp: Date.now(), sender: 'me', ...payload });
    };

    useEffect(() => {
        if (activeId && !document.hidden) {
            const contact = contacts.find((c: any) => c.id === activeId);
            if (contact && contact.unread > 0) {
                sendSignal(activeId, { type: 'seen' });
                setContacts((prev: Contact[]) => prev.map(c => c.id === activeId ? { ...c, unread: 0 } : c));
            }
        }
    }, [activeId]);

    useEffect(() => {
        if (showSettings && activeContact) {
            setEditAlias(activeContact.alias);
        }
    }, [showSettings, activeContact]);

    const saveAlias = () => {
        if (!activeContact || !editAlias.trim()) return;
        setContacts((prev: Contact[]) => prev.map(c => c.id === activeContact.id ? { ...c, alias: editAlias.trim() } : c));
        setShowSettings(false);
    };

    const sendMessage = async (txt: string, file: any, replyTo?: string, vanishTime?: number) => {
        if (!activeContact) return;
        const mesh = meshRefs.current.get(activeContact.id);
        if (mesh) {
            const msgId = crypto.randomUUID();
            const payload: Message = {
                id: msgId, text: txt, file, timestamp: Date.now(), sender: 'me',
                senderAlias: activeContact.myGroupAlias || undefined,
                replyTo, expiresAt: vanishTime ? Date.now() + vanishTime : undefined,
                status: 'delivered'
            };
            if (file) setActiveTransfer({ id: msgId, progress: 0 });
            try {
                await mesh.broadcast(payload, (p: number) => {
                    if (file) setActiveTransfer({ id: msgId, progress: p });
                }, msgId);
                setContacts((prev: Contact[]) => prev.map(c => c.id === activeContact.id ? { ...c, messages: [...c.messages, { ...payload }] } : c));
            } catch (e) {
                console.warn("[MESH] Broadcast failed:", e);
            } finally {
                if (file) setActiveTransfer(null);
            }
        }
    };

    const cancelTransfer = () => {
        if (activeTransfer && activeId) {
            const mesh = meshRefs.current.get(activeId);
            if (mesh) {
                mesh.cancelBroadcast(activeTransfer.id);
                setActiveTransfer(null);
            }
        }
    };

    const copyInviteCode = () => {
        if (activeInvite) {
            navigator.clipboard.writeText(activeInvite.code);
            triggerAlert("COPIED", "Invite code copied to clipboard.", 'primary');
        }
    };

    useEffect(() => {
        if (!activeInvite) return;
        const initInviteMesh = async () => {
            if (inviteMeshRef.current) return;
            const mesh = new MeshNetwork(activeInvite.secret, async (msg: any) => {
                if (msg.type === 'HANDSHAKE' && !handshakeLockedRef.current) {
                    handshakeLockedRef.current = true;
                    (mesh as any)._peerManifest = msg;
                    (mesh as any)._replyInterval = setInterval(() => {
                        mesh.broadcast({ type: 'HANDSHAKE_REPLY', publicKeyRaw: wallet.publicKeyRaw, alias: wallet.alias || 'Anonymous', emoji: wallet.emoji || '👤' });
                    }, 1000);
                    
                    (mesh as any)._handshakeTimeout = setTimeout(() => {
                        if (handshakeLockedRef.current) {
                            clearInterval((mesh as any)._replyInterval);
                            handshakeLockedRef.current = false;
                        }
                    }, 30000);
                } else if (msg.type === 'HANDSHAKE_ACK' && handshakeLockedRef.current) {
                    const replyInterval = (mesh as any)._replyInterval;
                    const hTimeout = (mesh as any)._handshakeTimeout;
                    const peerMsg = (mesh as any)._peerManifest;
                    if (replyInterval) clearInterval(replyInterval);
                    if (hTimeout) clearTimeout(hTimeout);
                    if (peerMsg) {
                        try {
                            const sharedSecret = await computeSharedSecret(wallet.privateKey, peerMsg.publicKeyRaw);
                            const peerId = await hashString(peerMsg.publicKeyRaw);
                            handleAddContact({ id: peerId, alias: peerMsg.alias || 'Peer', emoji: peerMsg.emoji || '👤', sharedSecret, messages: [], unread: 0 });
                            mesh.destroy();
                            inviteMeshRef.current = null;
                            setActiveInvite(null);
                            setShowInvite(false);
                            handshakeLockedRef.current = false;
                        } catch (e) {
                            console.error("Handshake error:", e);
                            handshakeLockedRef.current = false;
                        }
                    }
                }
            }, () => { });
            inviteMeshRef.current = mesh;
        };
        if (!inviteMeshRef.current) initInviteMesh();
        const t = setInterval(() => {
            setActiveInvite(prev => {
                if (!prev) return null;
                if (prev.timeLeft <= 1) {
                    if (inviteMeshRef.current) { inviteMeshRef.current.destroy(); inviteMeshRef.current = null; }
                    return null;
                }
                return { ...prev, timeLeft: prev.timeLeft - 1 };
            });
        }, 1000);
        return () => {
            clearInterval(t);
            if (inviteMeshRef.current) {
                const ri = (inviteMeshRef.current as any)._replyInterval;
                if (ri) clearInterval(ri);
            }
        };
    }, [activeInvite, wallet]);

    const handleAddContact = (c: Contact) => {
        setContacts((curr: Contact[]) => {
            const exists = curr.find(g => g.id === c.id || g.sharedSecret === c.sharedSecret);
            if (exists) return curr;
            return [...curr, c];
        });
        setShowScan(false);
        navigate(`/dashboard/chat/${c.id}`);
    };

    const startInvite = async () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let res = '';
        for (let i = 0; i < 12; i++) {
            res += chars.charAt(Math.floor(Math.random() * chars.length));
            if ((i + 1) % 4 === 0 && i !== 11) res += '-';
        }
        const secret = await hashString("BURNER_" + normalizeId(res));
        setActiveInvite({ code: res, timeLeft: 600, secret });
        
        // Reset lock for new invite
        handshakeLockedRef.current = false;
    };

    const onViewFile = async (msgId: string) => {
        if (!activeContact) return;
        setContacts((prev: Contact[]) => prev.map(c => {
            if (c.id !== activeContact.id) return c;
            return {
                ...c,
                messages: c.messages.map(m => m.id === msgId ? { ...m, file: m.file ? { ...m.file, viewCount: (m.file.viewCount || 0) + 1, _viewedSent: true } : undefined } : m)
            };
        }));
        await sendSignal(activeContact.id, { type: 'viewed', text: msgId });
    };

    const sendDelete = async (msgId: string) => {
        if (!activeContact) return;
        const mesh = meshRefs.current.get(activeContact.id);
        if (mesh) {
            setContacts((prev: Contact[]) => prev.map(c =>
                c.id === activeContact.id ? { ...c, messages: c.messages.filter(m => m.id !== msgId) } : c
            ));
            await mesh.broadcast({ id: crypto.randomUUID(), text: msgId, timestamp: Date.now(), sender: 'me', type: 'delete' });
        }
    };

    return (
        <div 
            className="flex-1 flex bg-background relative overflow-hidden h-full touch-none"
            onTouchStart={(e) => setTouchStart(e.touches[0].clientY)}
            onTouchMove={(e) => {
                const dist = e.touches[0].clientY - touchStart;
                if (dist > 0 && dist < 120 && window.scrollY === 0 && !activeId && !activeVaultId) {
                    setPullDistance(dist);
                }
            }}
            onTouchEnd={() => {
                if (pullDistance > 80) handleRefresh();
                else setPullDistance(0);
            }}
        >
            {/* Pull to Refresh Indicator */}
            {(pullDistance > 0 || isRefreshing) && (
                <div 
                    className="absolute top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none transition-transform duration-200"
                    style={{ transform: `translateY(${Math.min(pullDistance, 80)}px)` }}
                >
                    <div className="bg-surface/90 backdrop-blur-xl border border-primary/20 p-3 rounded-full shadow-[0_0_20px_rgba(0,243,255,0.1)] flex items-center gap-3">
                        <RefreshCw size={16} className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
                        <span className="text-[10px] font-mono text-primary uppercase tracking-widest">
                            {isRefreshing ? 'Syncing...' : pullDistance > 80 ? 'Release to Refresh' : 'Pull to Refresh'}
                        </span>
                    </div>
                </div>
            )}

            <SidebarRail activeTab={activeTab} totalUnread={totalUnread} setShowNotifications={setShowNotifications} onLogout={onLogout} />

            <div className={`${(activeId || activeVaultId) ? 'hidden md:flex' : 'flex'} md:w-80 w-full flex-col h-full bg-surface z-10`}>
                <Routes>
                    <Route path="/" element={
                        <ChatList
                            wallet={wallet} contacts={contacts} activeId={activeId}
                            setShowInvite={setShowInvite} setShowScan={setShowScan} statusMap={statusMap}
                            totalUnread={totalUnread} setShowNotifications={setShowNotifications}
                        />
                    } />
                    <Route path="/chat/:id" element={
                        <ChatList
                            wallet={wallet} contacts={contacts} activeId={activeId}
                            setShowInvite={setShowInvite} setShowScan={setShowScan} statusMap={statusMap}
                            totalUnread={totalUnread} setShowNotifications={setShowNotifications}
                        />
                    } />
                    <Route path="/vault/*" element={<VaultView wallet={wallet} notes={notes} setNotes={setNotes} triggerConfirm={triggerConfirm} />} />
                    <Route path="/settings" element={
                        <div className="p-6 space-y-4 safe-pt">
                            <h2 className="text-xl font-bold tracking-widest text-white mb-6">SETTINGS</h2>
                            <Button onClick={() => setShowSync(true)} variant="secondary" className="w-full text-xs">SYNC IDENTITY</Button>
                            <Button onClick={onLogout} variant="ghost" className="w-full text-xs text-danger border-danger/20">DISCONNECT</Button>
                            {installPrompt && (
                                <div className="mt-8 p-4 bg-primary/10 rounded-xl border border-primary/30 text-center">
                                    <h3 className="text-primary font-bold mb-2">INSTALL APP</h3>
                                    <p className="text-xs text-slate-400 mb-4">Install Aether for offline access and native performance.</p>
                                    <Button onClick={onInstall} className="w-full">INSTALL TO HOME</Button>
                                </div>
                            )}
                            <div className="mt-auto text-[10px] text-slate-600 font-mono text-center pt-8">
                                AETHER PROTOCOL v{version}<br />ENCRYPTED PWA
                            </div>
                        </div>
                    } />
                </Routes>
            </div>

            <div className={`flex-1 flex flex-col relative w-full h-full ${!(activeId || activeVaultId) && 'hidden md:flex'}`}>
                <Routes>
                    <Route path="/chat/:id" element={
                        <ChatWindow
                            activeContact={activeContact} messages={activeContact?.messages || []} onSend={sendMessage} onDelete={sendDelete}
                            status={activeContact ? statusMap[activeContact.id] : ''} setShowSettings={setShowSettings}
                            activeTransfer={activeTransfer} onCancelTransfer={cancelTransfer}
                            triggerAlert={triggerAlert}
                            searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults}
                            onViewFile={onViewFile}
                        />
                    } />
                    <Route path="/vault/:id" element={<VaultView wallet={wallet} notes={notes} setNotes={setNotes} triggerConfirm={triggerConfirm} />} />
                    <Route path="*" element={
                        <div className="flex-1 hidden md:flex flex-col items-center justify-center opacity-20 pointer-events-none select-none">
                            <Activity size={100} className="animate-pulse-slow" />
                            <p className="mt-8 font-mono tracking-[0.5em] text-sm">AWAITING SIGNAL</p>
                        </div>
                    } />
                </Routes>
            </div>

            <div className={`md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-white/5 flex items-center justify-around z-40 safe-pb ${(activeId || activeVaultId) ? 'hidden' : 'flex'}`}>
                <button onClick={() => navigate('/dashboard')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'CHATS' ? 'text-primary' : 'text-slate-500'}`}>
                    <MessageSquare size={20} />
                    <span className="text-[9px] font-bold tracking-wider">COMMS</span>
                </button>
                <button onClick={() => navigate('/dashboard/vault')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'VAULT' ? 'text-primary' : 'text-slate-500'}`}>
                    <HardDrive size={20} />
                    <span className="text-[9px] font-bold tracking-wider">VAULT</span>
                </button>
                <button onClick={() => navigate('/dashboard/settings')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'SETTINGS' ? 'text-primary' : 'text-slate-500'}`}>
                    <Layout size={20} />
                    <span className="text-[9px] font-bold tracking-wider">SYSTEM</span>
                </button>
            </div>

            <Modal isOpen={showNotifications} onClose={() => setShowNotifications(false)} title="NETWORK SIGNALS">
                <div className="space-y-4">
                    {contacts.filter((c: Contact) => (c.unread || 0) > 0).length === 0 ? (
                        <div className="p-8 text-center text-slate-500 font-mono text-xs">NO UNREAD TRANSMISSIONS</div>
                    ) : (
                        <div className="space-y-2">
                            {contacts.filter((c: Contact) => (c.unread || 0) > 0).map((c: Contact) => (
                                <button key={c.id} onClick={() => { navigate(`/dashboard/chat/${c.id}`); setShowNotifications(false); }} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{c.emoji}</span>
                                        <div className="text-left">
                                            <div className="font-bold text-sm text-white">{c.alias}</div>
                                            <div className="text-[10px] text-primary font-mono">{c.unread} NEW MESSAGE{c.unread > 1 ? 'S' : ''}</div>
                                        </div>
                                    </div>
                                    <ChevronLeft className="rotate-180 text-slate-600" size={16} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {showInvite && (
                <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="SHARE IDENTITY">
                    <div className="flex flex-col items-center space-y-6">
                        {!activeInvite ? (
                            <>
                                <p className="text-xs text-slate-400 text-center">Generate a temporary handshake code to link with a new peer.</p>
                                <Button onClick={startInvite} className="w-full">GENERATE CODE</Button>
                            </>
                        ) : (
                            <>
                                <div className="bg-white p-4 rounded-xl">
                                    <QRCode value={JSON.stringify({ type: 'AETHER_SYNC', code: activeInvite.code })} size={200} />
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-2xl font-mono text-primary tracking-widest">{activeInvite.code}</div>
                                    <button onClick={copyInviteCode} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-primary transition-all">
                                        <Copy size={18} />
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500">EXPIRES IN {Math.floor(activeInvite.timeLeft / 60)}:{(activeInvite.timeLeft % 60).toString().padStart(2, '0')}</p>
                                <Button variant="secondary" onClick={() => setShowInvite(false)} className="w-full">DONE</Button>
                            </>
                        )}
                    </div>
                </Modal>
            )}

            {showSync && (
                <Modal isOpen={showSync} onClose={() => { setShowSync(false); setSyncStatus('IDLE'); }} title="MIGRATE IDENTITY">
                    <div className="space-y-6">
                        {syncStatus === 'IDLE' ? (
                            <div className="flex flex-col items-center space-y-4">
                                <p className="text-xs text-slate-400 text-center">Generate a migration code to clone this identity onto another device.</p>
                                <Button onClick={startSync} className="w-full">GENERATE MIGRATION CODE</Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center space-y-6">
                                <div className="bg-white p-4 rounded-xl border-4 border-primary/30 shadow-[0_0_30px_rgba(0,243,255,0.2)]">
                                    <QRCode value={JSON.stringify({ type: 'AETHER_SYNC', code: syncCode })} size={200} />
                                </div>
                                <div className="text-2xl font-mono text-primary tracking-[0.2em]">{syncCode}</div>
                                <div className="flex items-center gap-2 text-[10px] text-primary font-mono animate-pulse">
                                    <Activity size={12} /> {syncStatus}
                                </div>
                                <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                                    On your new device, go to Sync Identity and scan this code. 
                                    Do not close this window until the migration is complete.
                                </p>
                                <Button variant="secondary" onClick={() => setShowSync(false)} className="w-full">DONE</Button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {showScan && (
                <Modal isOpen={showScan} onClose={() => { setShowScan(false); setScanStatus('IDLE'); }} title="ADD NEW PEER">
                    <div className="space-y-6">
                        {scanStatus !== 'IDLE' ? (
                            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                                <Activity className="w-12 h-12 text-primary animate-pulse" />
                                <div className="text-xs font-mono text-primary tracking-widest uppercase">{scanStatus}</div>
                                <Button variant="ghost" onClick={() => setScanStatus('IDLE')}>CANCEL</Button>
                            </div>
                        ) : (
                            <>
                                <div id="peer-scanner" className="w-full max-w-sm mx-auto overflow-hidden rounded-lg border border-white/10 bg-black/50 aspect-square [&_video]:object-cover [&_#html5-qrcode-button-camera-permission]:bg-primary [&_#html5-qrcode-button-camera-permission]:text-black [&_#html5-qrcode-button-camera-permission]:p-2 [&_#html5-qrcode-button-camera-permission]:rounded-lg [&_#html5-qrcode-anchor-scan-type]:hidden"></div>
                                <div className="text-[9px] text-center text-slate-500 font-mono uppercase tracking-widest">Scanner active • align code within frame</div>
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                                    <div className="relative flex justify-center text-[10px] uppercase font-mono"><span className="bg-surface px-2 text-slate-600">OR ENTER CODE</span></div>
                                </div>
                                <div className="flex gap-2">
                                    <Input placeholder="XXXX-XXXX-XXXX" value={manualCode} onChange={(e: any) => setManualCode(e.target.value.toUpperCase())} className="font-mono text-center tracking-widest" />
                                    <Button onClick={() => initiateHandshake(manualCode)} disabled={manualCode.length < 12}>LINK</Button>
                                </div>
                            </>
                        )}
                    </div>
                </Modal>
            )}

            {showSettings && activeContact && (
                <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="CHANNEL SETTINGS">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                            <div className="text-4xl">{activeContact.emoji}</div>
                            <div className="flex-1">
                                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Identity</div>
                                <Input value={editAlias} onChange={(e: any) => setEditAlias(e.target.value)} placeholder="Display Name" className="h-10 text-base font-bold bg-white/5" />
                                <div className="text-[9px] text-slate-600 font-mono truncate max-w-[200px] mt-1 uppercase">{activeContact.id}</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-1">Security Options</div>
                            <Button onClick={() => {
                                triggerConfirm(
                                    "CLEAR HISTORY",
                                    "Clear all messages in this channel? (Local device only)",
                                    () => {
                                        setContacts((prev: Contact[]) => prev.map(c => c.id === activeContact.id ? { ...c, messages: [], unread: 0 } : c));
                                        setShowSettings(false);
                                    }
                                );
                            }} variant="ghost" className="w-full flex justify-start gap-3 border-white/5 h-12">
                                <Trash2 size={16} className="text-slate-400" /> CLEAR LOCAL HISTORY
                            </Button>
                            <Button onClick={() => {
                                triggerConfirm(
                                    "CLEAR BOTH SIDES",
                                    "DANGEROUS: This will attempt to clear history on BOTH devices. Proceed?",
                                    () => {
                                        sendSignal(activeContact.id, { type: 'clear_chat_request' });
                                        setContacts((prev: Contact[]) => prev.map(c => c.id === activeContact.id ? { ...c, pendingClear: true } : c));
                                        setShowSettings(false);
                                    },
                                    'danger'
                                );
                            }} variant="ghost" className="w-full flex justify-start gap-3 border-white/5 h-12 text-warning">
                                <ShieldAlert size={16} /> CLEAR CHAT (BOTH SIDES)
                            </Button>
                            <Button onClick={() => {
                                triggerConfirm(
                                    "DESTROY CHANNEL",
                                    "Permanently disconnect and delete this contact? This cannot be undone.",
                                    () => {
                                        sendSignal(activeContact.id, { type: 'disconnect' });
                                        setTimeout(() => {
                                            setContacts((prev: Contact[]) => prev.filter(c => c.id !== activeContact.id));
                                            navigate('/dashboard');
                                            setShowSettings(false);
                                        }, 200);
                                    },
                                    'danger'
                                );
                            }} variant="ghost" className="w-full flex justify-start gap-3 border-white/5 h-12 text-danger">
                                <X size={16} /> DESTROY CHANNEL
                            </Button>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-white/5">
                            <Button onClick={() => setShowSettings(false)} variant="ghost" className="flex-1 h-12">CANCEL</Button>
                            <Button onClick={saveAlias} className="flex-1 h-12">SAVE CHANGES</Button>
                        </div>
                    </div>
                </Modal>
            )}

            <ConfirmModal 
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                variant={confirmState.variant}
            />

            <AlertModal 
                isOpen={alertState.isOpen}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                title={alertState.title}
                message={alertState.message}
                variant={alertState.variant}
            />
        </div>
    );
}
