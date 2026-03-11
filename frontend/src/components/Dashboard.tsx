import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import {
    Send, Paperclip, Activity, File, Download,
    Settings, X, Share2, Trash2, UserPlus, Shield, Lock, MessageSquare, HardDrive, Layout, ChevronLeft, Plus, Timer, CheckCircle, Copy
} from 'lucide-react';
import { Button, Input, Modal } from './ui/Common';
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
                    <div className="md:hidden w-8 h-8 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center font-bold text-black font-mono shadow-[0_0_10px_rgba(0,243,255,0.3)]">A</div>
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
                                {c.unread > 0 && (
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

const VaultView = ({ wallet }: any) => {
    const navigate = useNavigate();
    const { id: viewing } = useParams();
    const [notes, setNotes] = useState<{ id: string, title: string, content: string, date: number }[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        SecureStorage.get('aether_vault_notes').then(async (enc) => {
            if (enc && wallet) {
                const decrypted = await decryptStorage(wallet.storageKey, enc);
                setNotes(decrypted || []);
            }
        });
    }, []);

    useEffect(() => {
        if (viewing && viewing !== 'new') {
            const note = notes.find(n => n.id === viewing);
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
        const updated = (viewing && viewing !== 'new') ? notes.map(n => n.id === viewing ? newNote : n) : [newNote, ...notes];
        setNotes(updated);
        const enc = await encryptStorage(wallet.storageKey, updated);
        await SecureStorage.set('aether_vault_notes', enc);
        setSaving(false);
        navigate('/dashboard/vault');
    };

    const deleteNote = async (id: string) => {
        if (!confirm("Destroy this record?")) return;
        const updated = notes.filter(n => n.id !== id);
        setNotes(updated);
        const enc = await encryptStorage(wallet.storageKey, updated);
        await SecureStorage.set('aether_vault_notes', enc);
    };

    if (viewing) {
        return (
            <div className="flex-1 flex flex-col h-full bg-black/40 safe-pt safe-pb">
                <div className="p-4 border-b border-white/10 flex items-center justify-center relative bg-surface/50 backdrop-blur">
                    <button onClick={() => navigate(-1)} className="absolute left-4 text-slate-400 hover:text-white"><ChevronLeft /></button>
                    <span className="font-mono text-xs tracking-widest text-primary">SECURE RECORD</span>
                    <button onClick={saveNote} className="absolute right-4 text-primary hover:text-white font-bold text-sm" disabled={saving}>{saving ? '...' : 'SAVE'}</button>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-4">
                    <input className="bg-transparent text-xl font-bold text-white placeholder-slate-600 outline-none" placeholder="Subject / Title" value={title} onChange={e => setTitle(e.target.value)} />
                    <textarea className="flex-1 bg-transparent text-sm font-mono text-slate-300 resize-none outline-none leading-relaxed" placeholder="Enter secure data..." value={content} onChange={e => setContent(e.target.value)} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-black/40 safe-pt safe-pb">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-surface/50 backdrop-blur">
                <div className="flex items-center gap-2">
                    <HardDrive size={18} className="text-primary" />
                    <span className="font-bold text-lg">Vault</span>
                </div>
                <button onClick={() => navigate('/dashboard/vault/new')} className="bg-white/10 p-2 rounded-full text-primary hover:bg-white/20"><Plus size={20} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto">
                {notes.map(n => (
                    <div key={n.id} onClick={() => navigate(`/dashboard/vault/${n.id}`)} className="bg-white/5 border border-white/5 p-4 rounded-xl hover:border-primary/30 transition-all cursor-pointer relative group aspect-square flex flex-col">
                        <div className="font-bold text-sm truncate mb-2">{n.title}</div>
                        <div className="text-[10px] text-slate-500 font-mono flex-1 overflow-hidden">{n.content.substring(0, 100)}...</div>
                        <div className="mt-2 flex justify-between items-end">
                            <span className="text-[8px] text-slate-600">{new Date(n.date).toLocaleDateString()}</span>
                            <button onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }} className="text-slate-600 hover:text-danger"><Trash2 size={12} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ChatWindow = ({ activeContact, messages, onSend, onDelete, status, setShowSettings, activeTransfer, onCancelTransfer }: any) => {
    const navigate = useNavigate();
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

            <div className="h-16 border-b border-white/5 bg-surface/95 backdrop-blur flex items-center px-4 justify-between z-20 shadow-sm safe-pt">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/dashboard')} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"><ChevronLeft /></button>
                    <div className="text-3xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{activeContact.emoji}</div>
                    <div onClick={() => setShowSettings(true)} className="cursor-pointer hover:opacity-80 transition-opacity ml-2">
                        <div className="font-bold text-white leading-none flex items-center gap-2 text-lg">
                            {activeContact.alias}
                        </div>
                        <div className="text-[10px] font-mono text-primary flex items-center gap-2 mt-1">
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
                <button onClick={() => setShowSettings(true)} className="text-slate-500 hover:text-white p-2 flex items-center gap-2">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-slate-500 font-mono">LINK STRENGTH</span>
                        <div className="flex gap-0.5 mt-0.5">
                            {[1, 2, 3, 4].map(i => <div key={i} className={`w-3 h-1 rounded-full ${status === 'SECURE_RELAY_CONNECTED' ? 'bg-primary' : 'bg-slate-800'}`}></div>)}
                        </div>
                    </div>
                    <Settings size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar relative bg-black/50">
                <div className="absolute inset-0 bg-cyber-grid bg-[length:30px_30px] opacity-[0.03] pointer-events-none" />
                <ChatHistory messages={messages} onDelete={onDelete} />
            </div>

            <div className="safe-pb bg-surface border-t border-white/5">
                <ChatInput onSend={onSend} defaultVanish={activeContact.vanishTime} />
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

const ChatHistory = ({ messages, onDelete }: any) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

    const getReplyText = (id: string) => {
        const m = messages.find((x: any) => x.id === id);
        return m ? (m.text.substring(0, 30) + (m.text.length > 30 ? '...' : '')) : 'Deleted Message';
    };

    return (
        <>
            {messages.map((msg: Message) => {
                if (msg.type === 'system') return (
                    <div key={msg.id} className="text-center text-[9px] text-slate-600 font-mono my-4 uppercase tracking-widest border-t border-white/5 pt-2 w-3/4 mx-auto">
                        {msg.text}
                    </div>
                );
                return (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'} group relative z-10`}>
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
                                    <div className="mt-3 p-3 bg-black/40 rounded border border-white/10 flex items-center gap-3 overflow-hidden hover:border-primary/50 transition-colors cursor-pointer">
                                        {msg.file.type.startsWith('image') ? <img src={msg.file.data} className="h-32 object-contain" /> : <File size={24} className="text-primary" />}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1 overflow-hidden">
                                                <div className="text-xs font-bold truncate">{msg.file.name}</div>
                                                {msg.file.integrity && <Shield size={10} className="text-primary shrink-0" />}
                                            </div>
                                            <div className="text-[10px] text-slate-500">{(msg.file.size / 1024).toFixed(1)}KB</div>
                                        </div>
                                        <a href={msg.file.data} download={msg.file.name} className="p-2 hover:bg-white/10 rounded-full"><Download size={16} /></a>
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

const ChatInput = ({ onSend, defaultVanish }: any) => {
    const [txt, setTxt] = useState('');
    const [file, setFile] = useState<any>(null);
    const [vanish, setVanish] = useState<number>(defaultVanish || 0);
    const [showVanishMenu, setShowVanishMenu] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const MAX_FILE_SIZE = 16 * 1024 * 1024;

    const submit = () => {
        if (!txt.trim() && !file) return;
        onSend(txt, file, undefined, vanish);
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

    const vanishLabel = vanish === 0 ? 'OFF' : vanish === 60000 ? '1m' : vanish === 300000 ? '5m' : '1h';

    return (
        <div className="p-3 md:p-4 relative">
            {showVanishMenu && (
                <div className="absolute bottom-full left-4 bg-black border border-white/20 p-2 rounded-lg flex gap-2 shadow-2xl z-50 mb-2">
                    {[0, 60000, 300000, 3600000].map(t => (
                        <button key={t} onClick={() => { setVanish(t); setShowVanishMenu(false); }} className={`px-3 py-1 text-xs font-mono rounded transition-colors ${vanish === t ? 'bg-primary text-black font-bold' : 'text-slate-400 hover:bg-white/10'}`}>
                            {t === 0 ? 'OFF' : t === 60000 ? '1m' : t === 300000 ? '5m' : '1h'}
                        </button>
                    ))}
                </div>
            )}
            {file && (
                <div className="mb-3 p-2 bg-white/5 rounded border border-white/10 inline-flex items-center gap-3">
                    <Paperclip size={14} className="text-primary" />
                    <span className="text-xs max-w-[200px] truncate font-mono">{file.name}</span>
                    <button onClick={() => setFile(null)}><X size={14} className="text-danger hover:scale-110 transition-transform" /></button>
                </div>
            )}
            <div className="flex gap-2 items-end">
                <button onClick={() => setShowVanishMenu(!showVanishMenu)} className={`p-3 transition-colors rounded-xl border border-transparent hover:bg-white/5 ${vanish > 0 ? 'text-danger border-danger/20' : 'text-slate-400'}`}>
                    <div className="relative">
                        <Timer size={20} />
                        {vanish > 0 && <span className="absolute -top-2 -right-2 text-[8px] font-bold bg-danger text-white px-1 rounded-full">{vanishLabel}</span>}
                    </div>
                </button>
                <button onClick={() => fileRef.current?.click()} className="p-3 text-slate-400 hover:text-white transition-colors hover:bg-white/5 rounded-xl relative group">
                    <Paperclip size={20} />
                </button>
                <input type="file" ref={fileRef} className="hidden" onChange={(e: any) => {
                    const f = e.target.files[0];
                    if (f) {
                        if (f.size > MAX_FILE_SIZE) {
                            alert("TRANSMISSION ERROR: File exceeds 16MB encryption limit.");
                            e.target.value = null;
                            return;
                        }
                        processFile(f);
                    }
                }} />
                <textarea
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 resize-none max-h-32 min-h-[46px] transition-all"
                    rows={1} placeholder="Message..." value={txt} onChange={e => setTxt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                />
                <button onClick={submit} className="p-3 bg-primary text-black rounded-xl hover:bg-primary/80 transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.4)] transform active:scale-95"><Send size={20} /></button>
            </div>
        </div>
    );
};

export default function Dashboard({ wallet, contacts, setContacts, onLogout, meshRefs, installPrompt, onInstall, isSaving, version }: any) {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: activeId } = useParams();
    
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
            if (msg.type === 'delete') return { ...c, messages: c.messages.filter(m => m.id !== msg.text) };
            if (msg.type === 'clear_chat') return { ...c, messages: [], unread: 0 };
            if (msg.type === 'disconnect') {
                setTimeout(() => {
                    setContacts((curr: Contact[]) => curr.filter(contact => contact.id !== contactId));
                    if (activeId === contactId) navigate('/dashboard');
                }, 100);
                return c;
            }
            if (msg.type === 'seen') return { ...c, messages: c.messages.map(m => (m.id === msg.text || !msg.text) ? { ...m, status: 'seen' } : m) };
            if (msg.type === 'ack_receipt') return { ...c, messages: c.messages.map(m => m.id === msg.text ? { ...m, status: 'received' } : m) };
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

    const activeContact = useMemo(() => contacts.find((c: Contact) => c.id === activeId), [contacts, activeId]);

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

    useEffect(() => {
        if (!activeInvite) return;
        const initInviteMesh = async () => {
            if (inviteMeshRef.current) return;
            const mesh = new MeshNetwork(activeInvite.secret, async (msg: any) => {
                if (msg.type === 'HANDSHAKE' && !handshakeLockedRef.current) {
                    handshakeLockedRef.current = true;
                    (mesh as any)._replyInterval = setInterval(() => {
                        mesh.broadcast({ type: 'HANDSHAKE_REPLY', publicKeyRaw: wallet.publicKeyRaw, alias: wallet.alias || 'Anonymous', emoji: wallet.emoji || '👤' });
                    }, 1000);
                    (mesh as any)._peerManifest = msg;
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
        return () => clearInterval(t);
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
    };

    const totalUnread = useMemo(() => contacts.reduce((sum: number, c: Contact) => sum + (c.unread || 0), 0), [contacts]);

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
        <div className="flex-1 flex bg-background relative overflow-hidden h-full">
            <SidebarRail activeTab={activeTab} totalUnread={totalUnread} setShowNotifications={setShowNotifications} onLogout={onLogout} />

            <div className={`${activeId ? 'hidden md:flex' : 'flex'} md:w-80 w-full flex-col h-full bg-surface z-10`}>
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
                    <Route path="/vault/*" element={<VaultView wallet={wallet} />} />
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

            <div className={`flex-1 flex flex-col relative w-full h-full ${!activeId && !location.pathname.includes('/vault/') && 'hidden md:flex'}`}>
                <Routes>
                    <Route path="/chat/:id" element={
                        <ChatWindow
                            activeContact={activeContact} messages={activeContact?.messages || []} onSend={sendMessage} onDelete={sendDelete}
                            status={activeContact ? statusMap[activeContact.id] : ''} setShowSettings={setShowSettings}
                            activeTransfer={activeTransfer} onCancelTransfer={cancelTransfer}
                        />
                    } />
                    <Route path="/vault/:id" element={<VaultView wallet={wallet} />} />
                    <Route path="*" element={
                        <div className="flex-1 hidden md:flex flex-col items-center justify-center opacity-20 pointer-events-none select-none">
                            <Activity size={100} className="animate-pulse-slow" />
                            <p className="mt-8 font-mono tracking-[0.5em] text-sm">AWAITING SIGNAL</p>
                        </div>
                    } />
                </Routes>
            </div>

            <div className={`md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-white/5 flex items-center justify-around z-40 safe-pb ${activeId || location.pathname.includes('/vault/') ? 'hidden' : 'flex'}`}>
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

            {/* Other Modals (Invite, Scan, etc.) should be similarly adapted or kept as state if simple */}
            {/* Keeping them as state for now for brevity, but they should really be routes if possible */}
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
                                <div className="text-2xl font-mono text-primary tracking-widest">{activeInvite.code}</div>
                                <p className="text-[10px] text-slate-500">EXPIRES IN {Math.floor(activeInvite.timeLeft / 60)}:{(activeInvite.timeLeft % 60).toString().padStart(2, '0')}</p>
                                <Button variant="secondary" onClick={() => setShowInvite(false)} className="w-full">DONE</Button>
                            </>
                        )}
                    </div>
                </Modal>
            )}

            {/* Add more modals here as needed (Scan, Sync, etc.) */}
        </div>
    );
}