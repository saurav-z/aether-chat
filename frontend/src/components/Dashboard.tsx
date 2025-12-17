import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  Send, Paperclip, Activity, File, Download, LogOut,
  Settings, Menu, X, Copy, Share2, ScanLine, Trash2, Users, Edit2, Timer, CheckCircle, UserPlus, Smartphone, Shield, Lock, Eye, MessageSquare, HardDrive, Layout, ChevronLeft, Plus, QrCode, ArrowRightLeft
} from 'lucide-react';
import { Button, Input, Modal } from './ui/Common';
import { Contact, Message, Wallet, computeSharedSecret, hashString, generateGroupKey, getRendezvousTopic, verifyTOTP, encryptStorage, decryptStorage } from '../services/cryptoUtils';
import { MeshNetwork } from '../services/mesh';
import { SecureStorage } from '../services/storage';

// --- TYPES ---
type Tab = 'CHATS' | 'VAULT' | 'SETTINGS';

// --- SIDEBAR (CHATS LIST) ---
const ChatList = ({ wallet, contacts, activeId, setActiveId, onLogout, setMobileMenuOpen, setShowInvite, setShowScan, setShowGroup, setShowSync, statusMap }: any) => {
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
        {/* HEADER */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between h-16 bg-black/20 shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center font-bold text-black font-mono shadow-[0_0_10px_rgba(0,243,255,0.3)]">A</div>
                <div className="flex flex-col">
                    <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Rolling Network ID</div>
                    <div className="flex items-center gap-2">
                        <div className="text-xs font-mono text-primary animate-pulse">{rollingId}</div>
                        <button onClick={copyRolling} className="hover:text-white text-slate-500"><Copy size={10} /></button>
                    </div>
                </div>
            </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="p-3 grid grid-cols-2 gap-2 shrink-0">
            <Button onClick={() => setShowInvite(true)} className="w-full flex items-center justify-center gap-2 py-3 text-[10px] px-1">
                <Share2 size={12} /> SHARE ID
            </Button>
            <Button onClick={() => setShowScan(true)} variant="secondary" className="w-full flex items-center justify-center gap-2 py-3 text-[10px] px-1">
                <UserPlus size={12} /> ADD PEER
            </Button>
        </div>

        {/* LIST */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
            <div className="px-2 py-2 text-[9px] font-mono text-slate-600 uppercase tracking-widest mt-2 sticky top-0 bg-surface/95 backdrop-blur z-10">Active Signals</div>
            {contacts.length === 0 && (
                <div className="p-8 text-center opacity-30 text-[10px] font-mono">NO ACTIVE LINKS<br/>INITIATE HANDSHAKE</div>
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
                            {c.unread > 0 && <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(0,243,255,0.5)]" />}
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
)};

// --- VAULT COMPONENT (SECURE NOTES) ---
const VaultView = ({ wallet }: any) => {
    const [notes, setNotes] = useState<{id: string, title: string, content: string, date: number}[]>([]);
    const [viewing, setViewing] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Load notes from SecureStorage
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
        // Persist
        const enc = await encryptStorage(wallet.storageKey, updated);
        await SecureStorage.set('aether_vault_notes', enc);
        
        setSaving(false);
        setViewing(null); setTitle(''); setContent('');
    };

    const deleteNote = async (id: string) => {
        if(!confirm("Destroy this record?")) return;
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

// --- CHAT WINDOW COMPONENT ---
const ChatWindow = ({ activeContact, messages, onSend, onDelete, status, onBack, setShowSettings }: any) => {
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
            {/* HEADER */}
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
                <button onClick={() => setShowSettings(true)} className="text-slate-500 hover:text-white p-2"><Settings size={20} /></button>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar relative bg-black/50">
                <div className="absolute inset-0 bg-cyber-grid bg-[length:30px_30px] opacity-[0.03] pointer-events-none" />
                <ChatHistory messages={messages} onDelete={onDelete} />
            </div>

            {/* INPUT */}
            <div className="safe-pb bg-surface border-t border-white/5">
                <ChatInput onSend={onSend} defaultVanish={activeContact.vanishTime} />
            </div>
        </div>
    );
};

// --- LINKIFY UTILITY ---
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
        const m = messages.find((x:any) => x.id === id);
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
                                            <div className="text-xs font-bold truncate">{msg.file.name}</div>
                                            <div className="text-[10px] text-slate-500">{(msg.file.size/1024).toFixed(1)}KB</div>
                                        </div>
                                        <a href={msg.file.data} download={msg.file.name} className="p-2 hover:bg-white/10 rounded-full"><Download size={16} /></a>
                                    </div>
                                )}
                                <div className="flex justify-end items-center mt-2 gap-2">
                                    {msg.expiresAt && <Timer size={10} className="text-danger animate-pulse" />}
                                    <div className="text-[9px] opacity-40 font-mono tracking-wider">
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            </div>
                            {/* Actions */}
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
    
    // STRICT PROTOCOL LIMIT: 16MB
    const MAX_FILE_SIZE = 16 * 1024 * 1024;
 
    const submit = () => {
       if (!txt.trim() && !file) return;
       onSend(txt, file, undefined, vanish); 
       setTxt(''); setFile(null);
    };

    // Metadata Stripper Logic
    const processFile = (f: File) => {
        if (f.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e: any) => {
                const img = new Image();
                img.onload = () => {
                    // Draw to canvas to strip EXIF
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0);
                    const cleanData = canvas.toDataURL(f.type);
                    setFile({
                        name: f.name,
                        type: f.type,
                        size: Math.round((cleanData.length * 3) / 4), // Approx base64 size
                        data: cleanData
                    });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(f);
        } else {
            // For non-images, just load directly (cannot easily strip without ffmpeg.wasm etc)
            const reader = new FileReader();
            reader.onload = (e: any) => {
                setFile({name:f.name, type:f.type, size:f.size, data:e.target.result});
            };
            reader.readAsDataURL(f);
        }
    };
 
    const vanishLabel = vanish === 0 ? 'OFF' : vanish === 60000 ? '1m' : vanish === 300000 ? '5m' : '1h';
 
    return (
       <div className="p-3 md:p-4 relative">
          {showVanishMenu && (
              <div className="absolute bottom-full left-4 bg-black border border-white/20 p-2 rounded-lg flex gap-2 shadow-2xl z-50 mb-2 animate-[float_0.2s_ease-out]">
                  {[0, 60000, 300000, 3600000].map(t => (
                      <button key={t} onClick={() => { setVanish(t); setShowVanishMenu(false); }} className={`px-3 py-1 text-xs font-mono rounded transition-colors ${vanish === t ? 'bg-primary text-black font-bold' : 'text-slate-400 hover:bg-white/10'}`}>
                          {t===0?'OFF':t===60000?'1m':t===300000?'5m':'1h'}
                      </button>
                  ))}
              </div>
          )}
          {file && (
             <div className="mb-3 p-2 bg-white/5 rounded border border-white/10 inline-flex items-center gap-3 animate-[float_0.3s_ease-out]">
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
             <div className="hidden md:block absolute bottom-14 left-14 text-[9px] text-slate-600 font-mono tracking-widest pointer-events-none">MAX 16MB</div>
             
             <input type="file" ref={fileRef} className="hidden" onChange={(e:any) => {
                const f = e.target.files[0];
                if(f) {
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
                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }}}
             />
             <button onClick={submit} className="p-3 bg-primary text-black rounded-xl hover:bg-primary/80 transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.4)] transform active:scale-95"><Send size={20} /></button>
          </div>
       </div>
    );
 };

// --- MAIN DASHBOARD EXPORT ---
export default function Dashboard({ wallet, contacts, setContacts, onLogout, meshRefs, installPrompt, onInstall, isSaving }: any) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('CHATS'); // Mobile Tab State
  
  // Modal States
  const [showInvite, setShowInvite] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showSync, setShowSync] = useState(false); // Renamed internally to Sync for state, but UI shows Migration
  const [showSettings, setShowSettings] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  // Privacy-Safe Notification Handler
  // Only notifies if user has already granted permission
  // Never requests permission (respects privacy)
  const notify = (title: string, body: string) => {
      // Only show notification if permission is already granted
      if (Notification.permission === 'granted') {
          // Try service worker notification first (better for PWA)
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                  type: 'NOTIFY_IF_SAFE',
                  title,
                  body
              });
          } else {
              // Fallback to regular Notification API
              const n = new Notification(title, { 
                  body, 
                  icon: '/logo.png',
                  badge: '/logo.png',
                  silent: true 
              });
              const close = () => n.close();
              n.onclick = close;
              setTimeout(close, 4000);
          }
      }
      // If permission is denied, silently do nothing (respects user privacy)
  };

  useEffect(() => {
    // DO NOT REQUEST NOTIFICATION PERMISSION
    // Only use notifications if user has already granted permission
    // This respects privacy and doesn't show intrusive prompts

    contacts.forEach((c: Contact) => {
      if (!meshRefs.current.has(c.id)) {
        const m = new MeshNetwork(
          c.sharedSecret,
          (msg: Message) => {
              handleIncomingMessage(c.id, msg);
              if (document.hidden) {
                  notify("Aether Signal", "Encrypted transmission received.");
              }
          },
          (s) => setStatusMap(prev => ({...prev, [c.id]: s}))
        );
        meshRefs.current.set(c.id, m);
      }
    });
  }, [contacts]);

  const handleIncomingMessage = (contactId: string, msg: Message) => {
    setContacts((prev: Contact[]) => prev.map(c => {
       if (c.id !== contactId) return c;
       
       // Handle Deletions
       if (msg.type === 'delete') return { ...c, messages: c.messages.filter(m => m.id !== msg.text) };
       
       // Handle Invites
       if (msg.type === 'invite') {
         try {
           const inviteData = JSON.parse(msg.text);
           setTimeout(() => {
             setContacts((curr: Contact[]) => {
               if (curr.find(g => g.id === inviteData.id)) return curr;
               return [...curr, {
                 id: inviteData.id, alias: inviteData.name, emoji: inviteData.emoji, sharedSecret: inviteData.key,
                 messages: [], unread: 1, isGroup: true
               }];
             });
           }, 100);
           return { ...c, messages: [...c.messages, { ...msg, type: 'system', text: `Invited you to group: ${inviteData.name}` }] };
         } catch { return c; }
       }

       // DEDUPLICATION LOGIC:
       // If a message with this ID already exists, do not add it again.
       if (c.messages.find(m => m.id === msg.id)) {
           return c;
       }

       const isCurrent = activeId === contactId;
       return { ...c, messages: [...c.messages, { ...msg, sender: msg.senderAlias || 'them' }], unread: isCurrent ? 0 : c.unread + 1 };
    }));
  };

  const activeContact = contacts.find((c: Contact) => c.id === activeId);

  const sendMessage = async (txt: string, file: any, replyTo?: string, vanishTime?: number) => {
    if (!activeContact) return;
    const mesh = meshRefs.current.get(activeContact.id);
    if (mesh) {
        const msgId = crypto.randomUUID();
        const payload: Message = { 
            id: msgId, text: txt, file, timestamp: Date.now(), sender: 'me', senderAlias: activeContact.myGroupAlias || undefined,
            replyTo, expiresAt: vanishTime ? Date.now() + vanishTime : undefined
        };
        await mesh.broadcast(payload);
        setContacts((prev: Contact[]) => prev.map(c => c.id === activeContact.id ? { ...c, messages: [...c.messages, { ...payload }] } : c));
    }
  };

  const sendDelete = async (msgId: string) => {
    if (!activeContact) return;
    const mesh = meshRefs.current.get(activeContact.id);
    if (mesh) {
        // 1. Optimistic Deletion: Instant Removal from UI (Sender Side)
        setContacts((prev: Contact[]) => prev.map(c => 
            c.id === activeContact.id 
                ? { ...c, messages: c.messages.filter(m => m.id !== msgId) } 
                : c
        ));
        
        // 2. Broadcast Kill Signal to Receiver
        await mesh.broadcast({ 
            id: crypto.randomUUID(), 
            text: msgId, // payload is the ID to delete
            timestamp: Date.now(), 
            sender: 'me', 
            type: 'delete' 
        });
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
          if(mesh) mesh.broadcast({ id: crypto.randomUUID(), type: 'invite', text: invitePayload, timestamp: Date.now(), sender: 'me' });
      });
      setShowGroup(false);
  };

  // --- RENDER ---
  return (
    <div className="flex-1 flex flex-col md:flex-row bg-background relative overflow-hidden h-full">
      
      {/* DESKTOP SIDEBAR / MOBILE TAB CONTENT */}
      <div className={`
        ${activeId ? 'hidden md:flex' : 'flex'} 
        md:w-80 w-full flex-col h-full bg-surface z-10
      `}>
         {activeTab === 'CHATS' && (
             <ChatList 
                wallet={wallet} contacts={contacts} activeId={activeId} setActiveId={setActiveId} onLogout={onLogout} 
                setShowInvite={setShowInvite} setShowScan={setShowScan} setShowGroup={setShowGroup} setShowSync={setShowSync} statusMap={statusMap}
                isSaving={isSaving}
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
                     AETHER PROTOCOL v2.0<br/>ENCRYPTED PWA
                 </div>
             </div>
         )}
      </div>
      
      {/* CHAT AREA (FULL ON DESKTOP, OVERLAY ON MOBILE) */}
      <div className={`flex-1 flex flex-col relative w-full h-full ${!activeId && 'hidden md:flex'}`}>
         <ChatWindow 
            activeContact={activeContact} messages={activeContact?.messages || []} onSend={sendMessage} onDelete={sendDelete} 
            status={activeContact ? statusMap[activeContact.id] : ''} onBack={() => setActiveId(null)} setShowSettings={setShowSettings}
         />
      </div>

      {/* MOBILE BOTTOM NAV */}
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

      {/* MODALS */}
      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="BURNER INVITATION">
         <BurnerInvite wallet={wallet} onClose={() => setShowInvite(false)} onConnect={(c: Contact) => { setContacts((prev: Contact[]) => [...prev, c]); setShowInvite(false); }} />
      </Modal>
      <Modal isOpen={showScan} onClose={() => setShowScan(false)} title="ADD CONTACT">
         <BurnerScanner wallet={wallet} onClose={() => setShowScan(false)} onConnect={(c: Contact) => { setContacts((prev: Contact[]) => [...prev, c]); setShowScan(false); }} />
      </Modal>
      <Modal isOpen={showGroup} onClose={() => setShowGroup(false)} title="MESH GROUP CREATION">
         <GroupCreator contacts={contacts} onCreate={createGroup} />
      </Modal>
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="CONTACT PROTOCOLS">
         {activeContact && <ContactSettings contact={activeContact} onSave={(updates: any) => { setContacts((prev: Contact[]) => prev.map(c => c.id === activeContact.id ? { ...c, ...updates } : c)); setShowSettings(false); }} />}
      </Modal>
      <Modal isOpen={showSync} onClose={() => setShowSync(false)} title="IDENTITY MIGRATION">
         <SyncDeviceModal wallet={wallet} contacts={contacts} onClose={() => setShowSync(false)} />
      </Modal>
    </div>
  );
}

// --- SUB-COMPONENTS (BURNER INVITE, SCANNER, ETC - UNCHANGED BUT INCLUDED FOR CONTEXT) ---
const BurnerInvite = ({ wallet, onClose, onConnect }: any) => {
   const [code, setCode] = useState('');
   const [timeLeft, setTimeLeft] = useState(600); 
   const meshRef = useRef<MeshNetwork | null>(null);

   useEffect(() => {
      const id = crypto.randomUUID();
      hashString("BURNER_" + id).then(secret => {
         setCode(id);
         const m = new MeshNetwork(secret, (msg: any) => {
            if (msg.type === 'HANDSHAKE') {
               const replyInterval = setInterval(() => m.broadcast({ type: 'HANDSHAKE_REPLY', publicKeyRaw: wallet.publicKeyRaw, alias: 'Anonymous', emoji: '👤' }), 500);
               setTimeout(() => { clearInterval(replyInterval); computeSharedSecret(wallet.privateKey, msg.publicKeyRaw).then(s => { onConnect({ id: crypto.randomUUID(), alias: msg.alias || 'Peer', emoji: msg.emoji || '👤', sharedSecret: s, messages: [], unread: 0 }); m.destroy(); }); }, 2000);
            }
         }, () => {});
         meshRef.current = m;
      });
      const t = setInterval(() => setTimeLeft(prev => { if (prev <= 1) { onClose(); return 0; } return prev - 1; }), 1000);
      return () => { clearInterval(t); meshRef.current?.destroy(); };
   }, []);

   const fmtTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
   const copy = () => { navigator.clipboard.writeText(code); alert("ID Copied"); };

   return (
    <div className="text-center space-y-6">
        <div className="bg-white p-4 rounded-xl inline-block border-4 border-primary/20 shadow-[0_0_20px_rgba(0,243,255,0.2)]">
            {code && <QRCode value={JSON.stringify({ type: 'AETHER_INVITE', code })} size={180} />}
        </div>
        <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
                <code className="bg-white/10 px-3 py-1 rounded text-primary font-mono text-sm tracking-wider">{code.substring(0,8)}...</code>
                <Button variant="secondary" onClick={copy} className="py-1 px-3 text-xs"><Copy size={12} /></Button>
            </div>
            <div className="text-3xl font-mono text-primary font-bold animate-pulse">{fmtTime(timeLeft)}</div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Link Auto-Destructs</p>
        </div>
    </div>
   );
};

const BurnerScanner = ({ wallet, onClose, onConnect }: any) => {
    const [manual, setManual] = useState('');
    const meshRef = useRef<MeshNetwork | null>(null);
    const connect = async (c: string) => {
        const secret = await hashString("BURNER_" + c);
        const m = new MeshNetwork(secret, (msg: any) => {
            if (msg.type === 'HANDSHAKE_REPLY') {
                computeSharedSecret(wallet.privateKey, msg.publicKeyRaw).then(s => { onConnect({ id: crypto.randomUUID(), alias: msg.alias, emoji: msg.emoji, sharedSecret: s, messages: [], unread: 0 }); m.destroy(); });
            }
        }, () => {});
        meshRef.current = m;
        setInterval(() => m.broadcast({ type: 'HANDSHAKE', publicKeyRaw: wallet.publicKeyRaw, alias: 'Peer', emoji: '👋' }), 1500);
    };
    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        setTimeout(() => { if(document.getElementById("reader")) { scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false); scanner.render((t) => { try { const d = JSON.parse(t); if (d.code) { scanner?.clear(); connect(d.code); } } catch {} }, () => {}); }}, 100);
        return () => { try{scanner?.clear()}catch{}; meshRef.current?.destroy(); };
    }, []);
    return <div className="space-y-4"><div id="reader" className="rounded overflow-hidden"></div><Input placeholder="ENTER ID" value={manual} onChange={(e:any) => setManual(e.target.value)} /><Button onClick={() => connect(manual)}>CONNECT</Button></div>;
};

const GroupCreator = ({ contacts, onCreate }: any) => {
    const [name, setName] = useState('');
    const [ids, setIds] = useState<string[]>([]);
    const toggle = (id: string) => setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    return <div className="space-y-4"><Input placeholder="GROUP NAME" value={name} onChange={(e:any) => setName(e.target.value)} /><div className="max-h-60 overflow-y-auto space-y-1">{contacts.filter((c:any) => !c.isGroup).map((c: any) => (<button key={c.id} onClick={() => toggle(c.id)} className={`w-full p-3 flex justify-between rounded border ${ids.includes(c.id) ? 'bg-primary/10 border-primary' : 'bg-transparent border-white/5'}`}>{c.alias} {ids.includes(c.id) && <CheckCircle size={14} />}</button>))}</div><Button onClick={() => onCreate(name, ids)} disabled={!name || ids.length === 0} className="w-full">CREATE</Button></div>;
};

const ContactSettings = ({ contact, onSave }: any) => {
    const [alias, setAlias] = useState(contact.alias);
    const [del, setDel] = useState(contact.autoDeleteInterval || 0);
    return <div className="space-y-4"><Input value={alias} onChange={(e:any) => setAlias(e.target.value)} /><select value={del} onChange={(e:any) => setDel(parseInt(e.target.value))} className="w-full bg-black/40 border border-white/10 text-white p-3 rounded"><option value={0}>Never Auto-Delete</option><option value={3600000}>Every Hour</option><option value={86400000}>24 Hours</option></select><Button onClick={() => onSave({ alias, autoDeleteInterval: del })} className="w-full">SAVE</Button></div>;
};

const SyncDeviceModal = ({ wallet, contacts, onClose }: any) => {
    const [mode, setMode] = useState<'DISPLAY' | 'SCAN'>('DISPLAY');
    const [step, setStep] = useState(1);
    const [pass, setPass] = useState('');
    const [totp, setTotp] = useState('');
    const [error, setError] = useState('');
    const [syncData, setSyncData] = useState<any>(null);
    const [status, setStatus] = useState('IDLE');
    const meshRef = useRef<MeshNetwork | null>(null);

    // MODE: DISPLAY (Source displays QR for Target to scan)
    const initiateSync = async () => {
        try {
            if (!verifyTOTP(wallet.totpSecret, totp)) throw new Error("INVALID 2FA CODE");
            setStep(2);
            // We fetch the raw encrypted strings from IDB
            const rawVault = await SecureStorage.get('aether_vault');
            const rawContacts = await SecureStorage.get('aether_contacts');
            const payload = { vault: rawVault, contacts: rawContacts };
            const syncId = crypto.randomUUID();
            const syncSecret = await hashString("SYNC_" + syncId);
            setSyncData({ type: 'AETHER_SYNC', code: syncId });
            const m = new MeshNetwork(syncSecret, () => {}, () => {});
            meshRef.current = m;
            const interval = setInterval(() => {
                m.broadcast({ type: 'SYNC_PAYLOAD', data: payload });
            }, 2000);
            return () => clearInterval(interval);
        } catch (e) { setError("AUTH FAILED"); }
    };

    // MODE: SCAN (Source scans Target's "Reverse Sync" QR)
    const scanTarget = async () => {
        setMode('SCAN');
        // Pre-fetch data
        try {
            if (!verifyTOTP(wallet.totpSecret, totp)) throw new Error("INVALID 2FA CODE");
            setStep(2);
            
            const rawVault = await SecureStorage.get('aether_vault');
            const rawContacts = await SecureStorage.get('aether_contacts');
            const payload = { vault: rawVault, contacts: rawContacts };

            let scanner: Html5QrcodeScanner | null = null;
            setTimeout(() => {
                if (document.getElementById("source-reader")) {
                    scanner = new Html5QrcodeScanner("source-reader", { fps: 10, qrbox: 250 }, false);
                    scanner.render(async (t) => {
                        try {
                            const d = JSON.parse(t);
                            if (d.type === 'AETHER_REVERSE_SYNC' && d.code) {
                                scanner?.clear();
                                setStatus('CONNECTING TO TARGET...');
                                const secret = await hashString("SYNC_" + d.code);
                                const m = new MeshNetwork(secret, () => {}, () => {});
                                meshRef.current = m;
                                
                                // Broadcast Immediately
                                const interval = setInterval(() => {
                                    m.broadcast({ type: 'SYNC_PAYLOAD', data: payload });
                                    setStatus('SENDING ENCRYPTED VAULT...');
                                }, 1500);
                                setTimeout(() => { clearInterval(interval); setStatus('MIGRATION COMPLETE'); }, 10000);
                            }
                        } catch {}
                    }, () => {});
                }
            }, 100);
        } catch (e) { setError("AUTH FAILED"); }
    };

    useEffect(() => { return () => meshRef.current?.destroy(); }, []);

    return (
        <div className="space-y-6">
            {step === 1 ? (
                <>
                    <div className="bg-danger/10 border border-danger/30 p-4 rounded text-xs text-danger/80"><div className="font-bold flex items-center gap-2 mb-2"><Shield size={14} /> SECURITY CHECKPOINT</div>You are about to export your entire encrypted identity. Ensure no cameras are watching.</div>
                    <Input type="password" placeholder="MASTER PASSWORD" value={pass} onChange={(e:any) => setPass(e.target.value)} />
                    <Input placeholder="2FA CODE" maxLength={6} className="text-center tracking-widest" value={totp} onChange={(e:any) => setTotp(e.target.value)} />
                    {error && <p className="text-danger text-center text-xs animate-pulse">{error}</p>}
                    
                    <div className="flex gap-2">
                        <Button onClick={initiateSync} className="flex-1">SHOW EXPORT QR</Button>
                        <Button onClick={scanTarget} variant="secondary" className="flex-1 flex items-center justify-center gap-2"><ScanLine size={12} /> SCAN TARGET</Button>
                    </div>
                    <p className="text-[9px] text-slate-500 text-center">Use "Scan Target" if the new device has a broken camera.</p>
                </>
            ) : mode === 'DISPLAY' ? (
                <div className="text-center space-y-4"><div className="bg-white p-4 rounded-xl inline-block border-4 border-warning/20">{syncData && <QRCode value={JSON.stringify(syncData)} size={200} />}</div><div className="text-warning text-xs font-mono animate-pulse">BROADCASTING ENCRYPTED VAULT...</div><p className="text-slate-500 text-[10px]">Scan this with the new device.</p></div>
            ) : (
                <div className="space-y-4 text-center">
                    {status === 'IDLE' ? <div id="source-reader" className="w-full max-w-sm overflow-hidden rounded-lg border border-white/20 mb-4"></div> : <div className="text-primary font-bold animate-pulse">{status}</div>}
                    <p className="text-[10px] text-slate-500">Scan the "Reverse Sync" QR displayed on the NEW device.</p>
                </div>
            )}
        </div>
    );
};