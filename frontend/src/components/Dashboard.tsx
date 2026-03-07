import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import {
    Send, Paperclip, Activity, File, Download, LogOut,
    Settings, Menu, X, Copy, Share2, ScanLine, Trash2, Users, Edit2, Timer, CheckCircle, UserPlus, Smartphone, Shield, Lock, Eye, MessageSquare, HardDrive, Layout, ChevronLeft, Plus, QrCode, ArrowRightLeft, Camera, Upload, Hash
} from 'lucide-react';
import { Button, Input, Modal } from './ui/Common';
import { Contact, Message, Wallet, computeSharedSecret, hashString, hashBuffer, generateGroupKey, getRendezvousTopic, unlockWallet, encryptStorage, decryptStorage, buf2hex } from '../services/cryptoUtils';
import { MeshNetwork } from '../services/mesh';
import { SecureStorage } from '../services/storage';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

type Tab = 'CHATS' | 'VAULT' | 'SETTINGS';

const normalizeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const SidebarRail = ({ activeTab, setActiveTab, showNotifications, setShowNotifications, totalUnread }: any) => {
    return (
        <div className="hidden md:flex w-20 flex-col bg-surface border-r border-white/5 items-center py-6 gap-8 z-50 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center font-bold text-black font-mono shadow-[0_0_15px_rgba(0,243,255,0.3)] shrink-0">A</div>

            <div className="flex-1 flex flex-col gap-2">
                <button title="Communications" onClick={() => setActiveTab('CHATS')} className={`p-4 rounded-xl transition-all ${activeTab === 'CHATS' ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                    <MessageSquare size={24} />
                </button>
                <button title="Secure Vault" onClick={() => setActiveTab('VAULT')} className={`p-4 rounded-xl transition-all ${activeTab === 'VAULT' ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                    <HardDrive size={24} />
                </button>
                <button title="System Settings" onClick={() => setActiveTab('SETTINGS')} className={`p-4 rounded-xl transition-all ${activeTab === 'SETTINGS' ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(0,243,255,0.1)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                    <Layout size={24} />
                </button>
            </div>

            <button title="Network Signals" onClick={() => setShowNotifications(!showNotifications)} className="relative p-4 text-slate-500 hover:text-white transition-colors hover:bg-white/5 rounded-xl mb-4">
                <Activity size={24} className={totalUnread > 0 ? 'text-primary animate-pulse' : ''} />
                {totalUnread > 0 && (
                    <span className="absolute top-3 right-3 w-5 h-5 bg-primary text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(0,243,255,0.5)] border-2 border-surface">
                        {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                )}
            </button>
        </div>
    );
};

const ChatList = ({ wallet, contacts, activeId, setActiveId, onLogout, setMobileMenuOpen, setShowInvite, setShowScan, setShowGroup, setShowSync, statusMap, showNotifications, setShowNotifications, totalUnread }: any) => {
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

                <button onClick={() => setShowNotifications(!showNotifications)} className="md:hidden relative p-2 text-slate-400 hover:text-white transition-colors">
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
                    <button key={c.id} onClick={() => setActiveId(c.id)}
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
    const [notes, setNotes] = useState<{ id: string, title: string, content: string, date: number }[]>([]);
    const [viewing, setViewing] = useState<string | null>(null);
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

    const saveNote = async () => {
        setSaving(true);
        const newNote = { id: viewing || crypto.randomUUID(), title: title || 'Untitled', content, date: Date.now() };
        const updated = viewing ? notes.map(n => n.id === viewing ? newNote : n) : [newNote, ...notes];
        setNotes(updated);
        const enc = await encryptStorage(wallet.storageKey, updated);
        await SecureStorage.set('aether_vault_notes', enc);
        setSaving(false);
        setViewing(null); setTitle(''); setContent('');
    };

    const deleteNote = async (id: string) => {
        if (!confirm("Destroy this record?")) return;
        const updated = notes.filter(n => n.id !== id);
        setNotes(updated);
        const enc = await encryptStorage(wallet.storageKey, updated);
        await SecureStorage.set('aether_vault_notes', enc);
    };

    if (viewing === 'new' || notes.find(n => n.id === viewing)) {
        return (
            <div className="flex-1 flex flex-col h-full bg-black/40 safe-pt safe-pb">
                <div className="p-4 border-b border-white/10 flex items-center justify-center relative bg-surface/50 backdrop-blur">
                    <button onClick={() => { setViewing(null); setTitle(''); setContent(''); }} className="absolute left-4 text-slate-400 hover:text-white"><ChevronLeft /></button>
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
                <button onClick={() => { setViewing('new'); setTitle(''); setContent(''); }} className="bg-white/10 p-2 rounded-full text-primary hover:bg-white/20"><Plus size={20} /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto">
                {notes.map(n => (
                    <div key={n.id} onClick={() => { setViewing(n.id); setTitle(n.title); setContent(n.content); }} className="bg-white/5 border border-white/5 p-4 rounded-xl hover:border-primary/30 transition-all cursor-pointer relative group aspect-square flex flex-col">
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

const ChatWindow = ({ activeContact, messages, onSend, onDelete, status, onBack, setShowSettings, pass, activeTransfer, onCancelTransfer }: any) => {
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
                    <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"><ChevronLeft /></button>
                    <div className="text-3xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{activeContact.emoji}</div>
                    <div onClick={() => setShowSettings(true)} className="cursor-pointer hover:opacity-80 transition-opacity ml-2">
                        <div className="font-bold text-white leading-none flex items-center gap-2 text-lg">
                            {activeContact.alias}
                        </div>
                        <div className="text-[10px] font-mono text-primary flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
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
                <ChatInput onSend={onSend} defaultVanish={activeContact.vanishTime} pass={pass} />
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

const ChatInput = ({ onSend, defaultVanish, pass }: any) => {
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

export default function Dashboard({ wallet, contacts, setContacts, onLogout, meshRefs, installPrompt, onInstall, isSaving }: any) {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
                <Shield size={48} className="text-danger mb-6 animate-pulse" />
                <h1 className="text-xl font-bold text-white mb-2 tracking-widest">ENCRYPTION ENGINE ERROR</h1>
                <p className="text-xs text-slate-400 font-mono leading-relaxed max-w-xs">
                    This browser does not support the Web Crypto API or is running in an insecure context.
                    <br /><br />
                    Please use Safari 11+, Chrome, or Firefox over HTTPS.
                </p>
            </div>
        );
    }

    const [pass, setPass] = useState('');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('CHATS');

    const activeIdRef = useRef<string | null>(null);
    const activeTabRef = useRef<Tab>('CHATS');
    const contactsRef = useRef<Contact[]>([]);

    useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
    useEffect(() => { contactsRef.current = contacts; }, [contacts]);

    const [showInvite, setShowInvite] = useState(false);
    const [showScan, setShowScan] = useState(false);
    const [showGroup, setShowGroup] = useState(false);
    const [showSync, setShowSync] = useState(false);
    const [activeTransfer, setActiveTransfer] = useState<{ id: string, progress: number } | null>(null);
    const [activeInvite, setActiveInvite] = useState<{ code: string, timeLeft: number, secret: string } | null>(null);
    const inviteMeshRef = useRef<any>(null);
    const handshakeLockedRef = useRef<boolean>(false);
    const [showSettings, setShowSettings] = useState(false);
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
                // Debounce syncHistory — topic rotation fires SECURE_RELAY_CONNECTED
                // once per joined topic window (up to 5x). Without this, 5 sync
                // manifests go out simultaneously on every 15s rotation.
                const syncDebounce = { timer: null as ReturnType<typeof setTimeout> | null };

                const m = new MeshNetwork(
                    c.sharedSecret,
                    (raw: unknown) => {
                        const msg = raw as Message;
                        handleIncomingMessage(c.id, msg);
                        const isNotThisChat = activeIdRef.current !== c.id || activeTabRef.current !== 'CHATS';
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
                    if (activeId === contactId) setActiveId(null);
                }, 100);
                return c;
            }

            if (msg.type === 'seen') {
                return { ...c, messages: c.messages.map(m => (m.id === msg.text || !msg.text) ? { ...m, status: 'seen' } : m) };
            }

            if (msg.type === 'ack_receipt') {
                return { ...c, messages: c.messages.map(m => m.id === msg.text ? { ...m, status: 'received' } : m) };
            }

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
        if (mesh) {
            await mesh.broadcast({ id: crypto.randomUUID(), timestamp: Date.now(), sender: 'me', ...payload });
        }
    };

    useEffect(() => {
        if (activeId && !document.hidden) {
            const contact = contacts.find((c: any) => c.id === activeId);
            if (contact && contact.unread > 0) {
                sendSignal(activeId, { type: 'seen' });
                setContacts((prev: Contact[]) => prev.map(c => c.id === activeId ? { ...c, unread: 0 } : c));
            }
        }
    }, [activeId, contacts]);

    const activeContact = contacts.find((c: Contact) => c.id === activeId);

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
        setActiveId(c.id);
        setShowInvite(false);
        setShowScan(false);
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

    const cancelInvite = () => {
        if (inviteMeshRef.current) { inviteMeshRef.current.destroy(); inviteMeshRef.current = null; }
        setActiveInvite(null);
    };

    // Sync all active topic windows to the SW so background polling works
    // correctly across rotation boundaries
    useEffect(() => {
        const syncSwTopics = async () => {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                const topicArrays = await Promise.all(contacts.map(async (c: Contact) => {
                    const mesh = meshRefs.current.get(c.id);
                    if (mesh && mesh.sharedSecret) {
                        return Promise.all(
                            [-2, -1, 0, 1, 2].map(o => getRendezvousTopic(mesh.sharedSecret, o * 60))
                        );
                    }
                    return [];
                }));
                const validTopics = [...new Set(topicArrays.flat().filter(Boolean))];
                navigator.serviceWorker.controller.postMessage({
                    type: 'SYNC_TOPICS',
                    topics: validTopics,
                    url: import.meta.env.VITE_BACKEND_URL || window.location.origin
                });
            }
        };
        if (contacts.length > 0) syncSwTopics();
        const interval = setInterval(syncSwTopics, 45000);
        return () => clearInterval(interval);
    }, [contacts]);

    // Retry messages that haven't been ACK'd — 15s threshold avoids
    // hammering the relay immediately after a reconnect
    useEffect(() => {
        const retryUnacked = async () => {
            const now = Date.now();
            for (const contact of contacts) {
                const unacked = contact.messages.filter((m: Message) =>
                    m.sender === 'me' &&
                    m.status === 'delivered' &&
                    m.type !== 'system' &&
                    (now - m.timestamp) > 15000 &&
                    (now - (m.timestamp || 0)) < 300000
                );
                if (unacked.length > 0) {
                    const mesh = meshRefs.current.get(contact.id);
                    if (mesh) {
                        for (const msg of unacked) {
                            mesh.broadcast(msg, undefined, msg.id).catch(() => { });
                        }
                    }
                }
            }
        };
        const interval = setInterval(retryUnacked, 10000);
        return () => clearInterval(interval);
    }, [contacts]);

    const [showNotifications, setShowNotifications] = useState(false);
    const totalUnread = contacts.reduce((sum: number, c: Contact) => sum + (c.unread || 0), 0);

    const clearAllNotifications = () => {
        setContacts((prev: Contact[]) => prev.map(c => ({ ...c, unread: 0 })));
        setShowNotifications(false);
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

    const createGroup = async (name: string, members: string[]) => {
        const groupKey = await generateGroupKey();
        const groupId = crypto.randomUUID();
        const groupEmoji = "🛡️";
        setContacts((prev: Contact[]) => [...prev, { id: groupId, alias: name, emoji: groupEmoji, sharedSecret: groupKey, messages: [], unread: 0, isGroup: true, myGroupAlias: 'Admin' }]);
        const invitePayload = JSON.stringify({ id: groupId, name, key: groupKey, emoji: groupEmoji });
        members.forEach(mId => {
            const mesh = meshRefs.current.get(mId);
            if (mesh) mesh.broadcast({ id: crypto.randomUUID(), type: 'invite', text: invitePayload, timestamp: Date.now(), sender: 'me' });
        });
        setShowGroup(false);
    };

    return (
        <div className="flex-1 flex bg-background relative overflow-hidden h-full">
            <SidebarRail activeTab={activeTab} setActiveTab={setActiveTab} showNotifications={showNotifications} setShowNotifications={setShowNotifications} totalUnread={totalUnread} />

            <div className={`${activeId ? 'hidden md:flex' : 'flex'} md:w-80 w-full flex-col h-full bg-surface z-10`}>
                {activeTab === 'CHATS' && (
                    <ChatList
                        wallet={wallet} contacts={contacts} activeId={activeId} setActiveId={setActiveId} onLogout={onLogout}
                        setShowInvite={setShowInvite} setShowScan={setShowScan} setShowGroup={setShowGroup} setShowSync={setShowSync} statusMap={statusMap}
                        isSaving={isSaving} showNotifications={showNotifications} setShowNotifications={setShowNotifications} totalUnread={totalUnread}
                    />
                )}
                {activeTab === 'VAULT' && <VaultView wallet={wallet} />}
                {activeTab === 'SETTINGS' && (
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
                            AETHER PROTOCOL v2.0<br />ENCRYPTED PWA
                        </div>
                    </div>
                )}
            </div>

            <div className={`flex-1 flex flex-col relative w-full h-full ${!activeId && 'hidden md:flex'}`}>
                <ChatWindow
                    activeContact={activeContact} messages={activeContact?.messages || []} onSend={sendMessage} onDelete={sendDelete}
                    status={activeContact ? statusMap[activeContact.id] : ''} onBack={() => setActiveId(null)} setShowSettings={setShowSettings}
                    pass={pass} activeTransfer={activeTransfer} onCancelTransfer={cancelTransfer}
                />
            </div>

            <div className={`md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-white/5 flex items-center justify-around z-40 safe-pb ${activeId ? 'hidden' : 'flex'}`}>
                <button onClick={() => setActiveTab('CHATS')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'CHATS' ? 'text-primary' : 'text-slate-500'}`}>
                    <MessageSquare size={20} />
                    <span className="text-[9px] font-bold tracking-wider">COMMS</span>
                </button>
                <button onClick={() => setActiveTab('VAULT')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'VAULT' ? 'text-primary' : 'text-slate-500'}`}>
                    <HardDrive size={20} />
                    <span className="text-[9px] font-bold tracking-wider">VAULT</span>
                </button>
                <button onClick={() => setActiveTab('SETTINGS')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'SETTINGS' ? 'text-primary' : 'text-slate-500'}`}>
                    <Layout size={20} />
                    <span className="text-[9px] font-bold tracking-wider">SYSTEM</span>
                </button>
            </div>

            <Modal isOpen={showNotifications} onClose={() => setShowNotifications(false)} title="NETWORK SIGNALS">
                <div className="space-y-4">
                    {(typeof window !== 'undefined' && 'Notification' in window && (Notification as any).permission !== 'granted') && (
                        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex flex-col items-center gap-3 text-center mb-4">
                            <Shield className="text-primary" size={24} />
                            <div className="space-y-1">
                                <div className="text-xs font-bold text-white uppercase tracking-widest">Enable Desktop Alerts</div>
                                <p className="text-[10px] text-slate-400">Receive encrypted signal notifications while Aether is in the background.</p>
                            </div>
                            <Button onClick={() => (Notification as any).requestPermission()} className="w-full py-2 text-xs">GRANT ACCESS</Button>
                        </div>
                    )}
                    {contacts.filter((c: Contact) => (c.unread || 0) > 0).length === 0 ? (
                        <div className="p-8 text-center text-slate-500 font-mono text-xs">NO UNREAD TRANSMISSIONS</div>
                    ) : (
                        <div className="space-y-2">
                            {contacts.filter((c: Contact) => (c.unread || 0) > 0).map((c: Contact) => (
                                <button key={c.id} onClick={() => { setActiveId(c.id); setShowNotifications(false); }} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors">
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
                            <Button variant="ghost" className="w-full text-xs text-slate-500 uppercase tracking-widest mt-4" onClick={clearAllNotifications}>Clear All</Button>
                        </div>
                    )}
                </div>
            </Modal>
            <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="BURNER INVITATION">
                <BurnerInvite activeInvite={activeInvite} onStart={startInvite} onCancel={cancelInvite} />
            </Modal>
            <Modal isOpen={showScan} onClose={() => setShowScan(false)} title="ADD CONTACT">
                <BurnerScanner wallet={wallet} onConnect={handleAddContact} />
            </Modal>
            <Modal isOpen={showGroup} onClose={() => setShowGroup(false)} title="MESH GROUP CREATION">
                <GroupCreator contacts={contacts} onCreate={createGroup} />
            </Modal>
            <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="CONTACT PROTOCOLS">
                {activeContact && <ContactSettings contact={activeContact}
                    onSave={(updates: any) => { setContacts((prev: Contact[]) => prev.map(c => c.id === activeContact.id ? { ...c, ...updates } : c)); setShowSettings(false); }}
                    onSignal={(type: string) => { sendSignal(activeContact.id, { type }); setShowSettings(false); }}
                />}
            </Modal>
            <Modal isOpen={showSync} onClose={() => setShowSync(false)} title="IDENTITY MIGRATION">
                <SyncDeviceModal wallet={wallet} contacts={contacts} onClose={() => setShowSync(false)} />
            </Modal>
        </div>
    );
}

const BurnerInvite = ({ activeInvite, onStart, onCancel }: any) => {
    useEffect(() => {
        if (!activeInvite) onStart();
    }, [activeInvite, onStart]);

    if (!activeInvite) return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-background rounded-xl">
            <Activity size={32} className="text-primary animate-spin mb-4" />
            <p className="text-xs text-slate-500 font-mono">Generating Secure Channel...</p>
        </div>
    );

    const { code, timeLeft } = activeInvite;
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    const copy = () => { navigator.clipboard.writeText(code); alert("ID Copied"); };

    return (
        <div className="text-center space-y-6">
            <div className="bg-white p-4 rounded-xl inline-block border-4 border-primary/20 shadow-[0_0_20px_rgba(0,243,255,0.2)]">
                {code && <QRCode value={JSON.stringify({ type: 'AETHER_INVITE', code })} size={180} />}
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                    <code className="bg-white/10 px-3 py-1 rounded text-primary font-mono text-sm tracking-wider">{code}</code>
                    <button onClick={copy} className="p-2 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"><Copy size={14} /></button>
                </div>
                <div className="text-3xl font-mono text-primary font-bold animate-pulse">{fmtTime(timeLeft)}</div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Link Active in Background</p>
                <Button variant="secondary" onClick={onCancel} className="mt-4 text-[10px] border-danger/30 text-danger hover:bg-danger/20">REGENERATE / CANCEL</Button>
            </div>
        </div>
    );
};

const BurnerScanner = ({ wallet, onConnect }: any) => {
    const [mode, setMode] = useState<'CHOOSER' | 'SCAN' | 'MANUAL'>('CHOOSER');
    const [manual, setManual] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const meshRef = useRef<MeshNetwork | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const connect = async (c: string) => {
        if (!c.trim() || loading) return;
        const normalized = normalizeId(c);
        setLoading(true);
        setError('');
        const handshakeProcessed = { current: false };

        try {
            const secret = await hashString("BURNER_" + normalized);
            const m = new MeshNetwork(secret, async (msg: any) => {
                if (msg.type === 'HANDSHAKE_REPLY' && !handshakeProcessed.current) {
                    handshakeProcessed.current = true;
                    try {
                        const sharedSecret = await computeSharedSecret(wallet.privateKey, msg.publicKeyRaw);
                        const peerId = await hashString(msg.publicKeyRaw);
                        for (let i = 0; i < 5; i++) {
                            m.broadcast({ type: 'HANDSHAKE_ACK' });
                            await new Promise(r => setTimeout(r, 300));
                        }
                        onConnect({ id: peerId, alias: msg.alias, emoji: msg.emoji, sharedSecret, messages: [], unread: 0 });
                        m.destroy();
                    } catch (e) {
                        console.error("Scanner handshake error:", e);
                        handshakeProcessed.current = false;
                    }
                }
            }, () => { });
            meshRef.current = m;
            const broadcastInterval = setInterval(() => {
                if (!handshakeProcessed.current) {
                    m.broadcast({ type: 'HANDSHAKE', publicKeyRaw: wallet.publicKeyRaw, alias: wallet.alias || 'Peer', emoji: wallet.emoji || '👋' });
                }
            }, 1000);

            setTimeout(() => {
                clearInterval(broadcastInterval);
                if (loading) { setLoading(false); setError('CONNECTION TIMEOUT'); }
            }, 20000);
        } catch (e) {
            setError('FAILED TO INITIALIZE MESH');
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');
        const html5QrCode = new Html5Qrcode("reader-hidden");
        try {
            const result = await html5QrCode.scanFile(file, true);
            const d = JSON.parse(result);
            if (d.code) { connect(d.code); } else { setError('INVALID QR CODE'); }
        } catch { setError('COULD NOT READ QR'); }
    };

    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        if (mode === 'SCAN') {
            const initScanner = async () => {
                try {
                    await navigator.mediaDevices.getUserMedia({ video: true });
                    setTimeout(() => {
                        if (document.getElementById("reader")) {
                            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
                            scanner.render((t) => {
                                try {
                                    const d = JSON.parse(t);
                                    if (d.code) { scanner?.clear(); connect(d.code); }
                                } catch { }
                            }, () => { });
                        }
                    }, 100);
                } catch { setError('CAMERA PERMISSION DENIED'); setMode('CHOOSER'); }
            };
            initScanner();
        }
        return () => { try { scanner?.clear() } catch { } meshRef.current?.destroy(); };
    }, [mode]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-primary font-mono animate-pulse">ESTABLISHING QUANTUM LINK...</p>
        </div>
    );

    return (
        <div className="space-y-4">
            <div id="reader-hidden" style={{ display: 'none' }}></div>
            {mode === 'CHOOSER' && (
                <div className="grid grid-cols-1 gap-3">
                    <Button onClick={() => setMode('SCAN')} className="flex items-center justify-center gap-3 h-16 bg-primary/20 border-primary/40 hover:bg-primary/30">
                        <Camera size={20} /> SCAN QR CODE
                    </Button>
                    <Button onClick={() => fileRef.current?.click()} variant="secondary" className="flex items-center justify-center gap-3 h-16">
                        <Upload size={20} /> UPLOAD FROM GALLERY
                    </Button>
                    <Button onClick={() => setMode('MANUAL')} variant="secondary" className="flex items-center justify-center gap-3 h-16">
                        <Hash size={20} /> ENTER ID MANUALLY
                    </Button>
                    <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                </div>
            )}
            {mode === 'SCAN' && (
                <div className="space-y-4">
                    <div id="reader" className="rounded overflow-hidden border border-white/10 shadow-lg"></div>
                    <Button variant="secondary" onClick={() => setMode('CHOOSER')} className="w-full">BACK</Button>
                </div>
            )}
            {mode === 'MANUAL' && (
                <div className="space-y-4">
                    <Input placeholder="PASTE PEER ID HERE" value={manual} onChange={(e: any) => setManual(e.target.value.toUpperCase())} autoFocus />
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setMode('CHOOSER')} className="flex-1">BACK</Button>
                        <Button onClick={() => connect(manual)} className="flex-1">CONNECT</Button>
                    </div>
                </div>
            )}
            {error && <p className="text-danger text-[10px] text-center uppercase tracking-widest animate-pulse">{error}</p>}
        </div>
    );
};

const GroupCreator = ({ contacts, onCreate }: any) => {
    const [name, setName] = useState('');
    const [ids, setIds] = useState<string[]>([]);
    const toggle = (id: string) => setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    return (
        <div className="space-y-4">
            <Input placeholder="GROUP NAME" value={name} onChange={(e: any) => setName(e.target.value)} />
            <div className="max-h-60 overflow-y-auto space-y-1">
                {contacts.filter((c: any) => !c.isGroup).map((c: any) => (
                    <button key={c.id} onClick={() => toggle(c.id)} className={`w-full p-3 flex justify-between rounded border ${ids.includes(c.id) ? 'bg-primary/10 border-primary' : 'bg-transparent border-white/5'}`}>
                        {c.alias} {ids.includes(c.id) && <CheckCircle size={14} />}
                    </button>
                ))}
            </div>
            <Button onClick={() => onCreate(name, ids)} disabled={!name || ids.length === 0} className="w-full">CREATE</Button>
        </div>
    );
};

const ContactSettings = ({ contact, onSave, onSignal }: any) => {
    const [alias, setAlias] = useState(contact.alias);
    const [del, setDel] = useState(contact.autoDeleteInterval || 0);
    const [confirmClear, setConfirmClear] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div className="space-y-6">
            <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Display Identity</label>
                <Input value={alias} onChange={(e: any) => setAlias(e.target.value)} placeholder="CONTACT ALIAS" />
            </div>
            <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Ephemeral Logic</label>
                <select value={del} onChange={(e: any) => setDel(parseInt(e.target.value))} className="w-full bg-black/40 border border-white/10 text-white p-3 rounded text-sm">
                    <option value={0}>NEVER AUTO-PURGE</option>
                    <option value={3600000}>EVERY HOUR</option>
                    <option value={86400000}>EVERY 24 HOURS</option>
                    <option value={604800000}>EVERY 7 DAYS</option>
                </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => onSave({ alias, autoDeleteInterval: del })} className="col-span-2">SAVE PROTOCOL UPDATES</Button>
                <Button variant="secondary" className="text-danger hover:bg-danger/10 border-danger/20" onClick={() => setConfirmClear(true)}>CLEAR CHAT</Button>
                <Button variant="secondary" className="text-danger hover:bg-danger/10 border-danger/20" onClick={() => setConfirmDelete(true)}>DISCONNECT</Button>
            </div>
            <Modal isOpen={confirmClear} onClose={() => setConfirmClear(false)} title="WIPE CONVERSATION?">
                <div className="space-y-4">
                    <p className="text-xs text-slate-400">This will wipe all messages on BOTH ends. This action is irreversible.</p>
                    <Button className="w-full bg-danger hover:bg-danger/80" onClick={() => { onSignal('clear_chat'); setConfirmClear(false); }}>CONFIRM WIPE</Button>
                </div>
            </Modal>
            <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="SEVER CONNECTION?">
                <div className="space-y-4">
                    <p className="text-xs text-slate-400">This will delete the contact and block all traffic from their identity. BOTH ends will be disconnected.</p>
                    <Button className="w-full bg-danger hover:bg-danger/80" onClick={() => { onSignal('disconnect'); setConfirmDelete(false); }}>CONFIRM DISCONNECT</Button>
                </div>
            </Modal>
        </div>
    );
};

const SyncDeviceModal = ({ wallet, contacts, onClose }: any) => {
    const [mode, setMode] = useState<'DISPLAY' | 'SCAN'>('DISPLAY');
    const [step, setStep] = useState(1);
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [syncData, setSyncData] = useState<any>(null);
    const [status, setStatus] = useState('IDLE');
    const meshRef = useRef<MeshNetwork | null>(null);

    const initiateSync = async () => {
        try {
            const rawVault = await SecureStorage.get('aether_vault');
            if (!rawVault) throw new Error('NO VAULT');
            await unlockWallet(rawVault, pass);
            setStep(2);
            const rawContacts = await SecureStorage.get('aether_contacts');
            const payload = { vault: rawVault, contacts: rawContacts };
            const syncId = crypto.randomUUID();
            const syncSecret = await hashString("SYNC_" + syncId);
            setSyncData({ type: 'AETHER_SYNC', code: syncId });
            const m = new MeshNetwork(syncSecret, () => { }, () => { });
            meshRef.current = m;
            const interval = setInterval(() => { m.broadcast({ type: 'SYNC_PAYLOAD', data: payload }); }, 2000);
            return () => clearInterval(interval);
        } catch { setError("AUTH FAILED"); }
    };

    const scanTarget = async () => {
        setMode('SCAN');
        try {
            const rawVault = await SecureStorage.get('aether_vault');
            if (!rawVault) throw new Error('NO VAULT');
            await unlockWallet(rawVault, pass);
            setStep(2);
            const rawContacts = await SecureStorage.get('aether_contacts');
            const payload = { vault: rawVault, contacts: rawContacts };

            const initScanner = async () => {
                try {
                    await navigator.mediaDevices.getUserMedia({ video: true });
                    setTimeout(() => {
                        if (document.getElementById("source-reader")) {
                            const scanner = new Html5QrcodeScanner("source-reader", { fps: 10, qrbox: 250 }, false);
                            scanner.render(async (t) => {
                                try {
                                    const d = JSON.parse(t);
                                    if (d.type === 'AETHER_REVERSE_SYNC' && d.code) {
                                        scanner?.clear();
                                        setStatus('CONNECTING TO TARGET...');
                                        const secret = await hashString("SYNC_" + d.code);
                                        const m = new MeshNetwork(secret, () => { }, () => { });
                                        meshRef.current = m;
                                        const interval = setInterval(() => {
                                            m.broadcast({ type: 'SYNC_PAYLOAD', data: payload });
                                            setStatus('SENDING ENCRYPTED VAULT...');
                                        }, 1500);
                                        setTimeout(() => { clearInterval(interval); setStatus('MIGRATION COMPLETE'); }, 10000);
                                    }
                                } catch { }
                            }, () => { });
                        }
                    }, 100);
                } catch { setError('CAMERA PERMISSION DENIED'); }
            };
            initScanner();
        } catch { setError("AUTH FAILED"); }
    };

    useEffect(() => { return () => meshRef.current?.destroy(); }, []);

    return (
        <div className="space-y-6">
            {step === 1 ? (
                <>
                    <div className="bg-danger/10 border border-danger/30 p-4 rounded text-xs text-danger/80">
                        <div className="font-bold flex items-center gap-2 mb-2"><Shield size={14} /> SECURITY CHECKPOINT</div>
                        You are about to export your entire encrypted identity. Ensure no cameras are watching.
                    </div>
                    <Input type="password" placeholder="MASTER PASSWORD" value={pass} onChange={(e: any) => setPass(e.target.value)} />
                    {error && <p className="text-danger text-center text-xs animate-pulse">{error}</p>}
                    <div className="flex gap-2">
                        <Button onClick={initiateSync} className="flex-1">SHOW EXPORT QR</Button>
                        <Button onClick={scanTarget} variant="secondary" className="flex-1 flex items-center justify-center gap-2"><ScanLine size={12} /> SCAN TARGET</Button>
                    </div>
                    <p className="text-[9px] text-slate-500 text-center">Use "Scan Target" if the new device has a broken camera.</p>
                </>
            ) : mode === 'DISPLAY' ? (
                <div className="text-center space-y-4">
                    <div className="bg-white p-4 rounded-xl inline-block border-4 border-warning/20">
                        {syncData && <QRCode value={JSON.stringify(syncData)} size={200} />}
                    </div>
                    <div className="text-warning text-xs font-mono animate-pulse">BROADCASTING ENCRYPTED VAULT...</div>
                    <p className="text-slate-500 text-[10px]">Scan this with the new device.</p>
                </div>
            ) : (
                <div className="space-y-4 text-center">
                    {status === 'IDLE' ? <div id="source-reader" className="w-full max-w-sm overflow-hidden rounded-lg border border-white/20 mb-4"></div> : <div className="text-primary font-bold animate-pulse">{status}</div>}
                    <p className="text-[10px] text-slate-500">Scan the "Reverse Sync" QR displayed on the NEW device.</p>
                </div>
            )}
        </div>
    );
};