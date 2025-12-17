import React, { useState, useEffect, useRef } from 'react';
import { generateWallet, lockWallet, unlockWallet, Wallet, EncryptedVault, Contact, encryptStorage, decryptStorage, encryptSession, decryptSession } from './services/cryptoUtils';
import { SecureStorage } from './services/storage';
import { GlobalContextMenu } from './components/ui/GlobalContextMenu';
import { IntroView, Setup2FAView, LoginView, ScanSyncView } from './components/Auth';
import Dashboard from './components/Dashboard';
import { Download, Shield, EyeOff, Lock } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'intro' | 'setup_2fa' | 'login' | 'dashboard' | 'scan_sync'>('intro');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [vault, setVault] = useState<EncryptedVault | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tempWallet, setTempWallet] = useState<Wallet | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false); // Privacy Curtain State
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Session Management
  const [lockTime, setLockTime] = useState<number | null>(null);

  const meshRefs = useRef<Map<string, any>>(new Map());

  // --- PRIVACY CURTAIN & ANTI-SCREENSHOT LOGIC ---
  useEffect(() => {
    const handleVisibilityChange = () => {
       // If user switches tabs, hide content immediately to prevent OS task-switcher snapshots
       if (document.hidden) setIsBlurred(true);
       else setIsBlurred(false);
    };

    const handleBlur = () => {
       // If user clicks away (e.g. to open a Snipping Tool), hide content
       if (view === 'dashboard' || view === 'login') setIsBlurred(true);
    };

    const handleFocus = () => {
       setIsBlurred(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("blur", handleBlur);
        window.removeEventListener("focus", handleFocus);
    };
  }, [view]);

  // --- PWA INSTALL HANDLER ---
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      setDeferredPrompt(null);
    }
  };

  // --- PWA & SERVICE WORKER INITIALIZATION ---
  useEffect(() => {
    // Register service worker for offline support and privacy-safe notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[Aether] SW registered'))
        .catch(err => console.log('[Aether] SW registration failed:', err));
    }
  }, []);

  // --- INITIALIZATION & SESSION RESTORE ---
  useEffect(() => {
    const init = async () => {
        // Load Vault from IndexedDB
        const savedVault = await SecureStorage.get('aether_vault');
        
        // CHECK BOTH LOCAL STORAGE (TIMED) AND SESSION STORAGE (UNTIL TAB CLOSE)
        const savedSession = sessionStorage.getItem('aether_session') || localStorage.getItem('aether_session');
        const sessionExpiry = localStorage.getItem('aether_session_exp'); // Only exists for timed sessions

        if (savedVault) {
            setVault(savedVault); 
            
            if (savedSession) {
                // If expiry exists, check it. If not (SessionStorage), assume valid.
                const isValid = !sessionExpiry || (Date.now() < parseInt(sessionExpiry));
                
                if (isValid) {
                    try {
                        const restoredWallet = await decryptSession(savedSession);
                        if (restoredWallet) {
                            await handleLoginSuccess(restoredWallet, sessionExpiry ? 0 : -1, true);
                            return;
                        }
                    } catch (e) {
                        console.error("Session corrupted or tamper detected");
                    }
                } else {
                    // Expired
                    localStorage.removeItem('aether_session');
                    localStorage.removeItem('aether_session_exp');
                }
            }
            
            setView('login');
        }
    };
    init();
  }, []);

  // --- AUTO-LOCK CHECKER ---
  useEffect(() => {
      if (!wallet) return;
      const checkLock = () => {
          const exp = localStorage.getItem('aether_session_exp');
          if (exp && Date.now() > parseInt(exp)) handleLogout();
      };
      const interval = setInterval(checkLock, 5000); 
      return () => clearInterval(interval);
  }, [wallet]);


  // --- STRICT AUTO-DELETE & AUTO-SAVE ---
  useEffect(() => {
    // CRITICAL: Do not run auto-save unless we are fully logged in and in dashboard.
    if (view !== 'dashboard' || !wallet) return;

    // Pruning Interval: RUNS EVERY 1 SECOND (High Strictness)
    const interval = setInterval(() => {
      setContacts(prev => prev.map(c => {
        if (!c.messages) return c;
        const now = Date.now();
        // Strict Filter: Remove if expired OR if manually deleted
        const validMsgs = c.messages.filter(m => !m.expiresAt || m.expiresAt > now);
        
        // Auto-Delete Interval Logic (e.g. "Clear chat every 1 hour")
        if (c.autoDeleteInterval && c.messages.length > 0) {
            return { ...c, messages: validMsgs.filter(m => m.timestamp > (now - (c.autoDeleteInterval || 0))) };
        }
        return { ...c, messages: validMsgs };
      }));
    }, 1000); // 1 Second Interval for Instant TTL Enforcement

    // Save Encrypted State
    const saveEncrypted = async () => {
        setIsSaving(true);
        const encrypted = await encryptStorage(wallet.storageKey, contacts);
        await SecureStorage.set('aether_contacts', encrypted);
        
        // Synthetic delay for UX (so user sees the 'Encrypting' badge briefly)
        setTimeout(() => setIsSaving(false), 500);
    };
    
    // Debounce saving
    const saveTimer = setTimeout(saveEncrypted, 1000);
    
    return () => {
        clearInterval(interval);
        clearTimeout(saveTimer);
    };
  }, [contacts, wallet, view]);

  // --- HANDLERS ---
  
  const handleLoginSuccess = async (w: Wallet, duration: number, isRestoring = false) => { 
    setWallet(w); 
    
    // Create Session
    if (!isRestoring) {
        const sessionBlob = await encryptSession(w);
        
        if (duration === -1) {
             // Session Only (Until Close)
             sessionStorage.setItem('aether_session', sessionBlob);
             localStorage.removeItem('aether_session'); // Clean up old if any
             localStorage.removeItem('aether_session_exp');
             setLockTime(null);
        } else if (duration > 0) {
             // Timed
             const expiry = Date.now() + (duration * 60 * 1000);
             localStorage.setItem('aether_session', sessionBlob);
             localStorage.setItem('aether_session_exp', expiry.toString());
             sessionStorage.removeItem('aether_session');
             setLockTime(expiry);
        } else {
             // Lock on Refresh (High Security)
             sessionStorage.removeItem('aether_session');
             localStorage.removeItem('aether_session');
             localStorage.removeItem('aether_session_exp');
        }
    }

    // --- DECRYPTION PHASE ---
    setIsDecrypting(true);
    
    // Synthetic delay to prevent flickering and show the secure loading state
    if (isRestoring) await new Promise(r => setTimeout(r, 800));

    try {
        const encryptedContacts = await SecureStorage.get('aether_contacts');
        if (encryptedContacts) {
            const decrypted = await decryptStorage(w.storageKey, encryptedContacts);
            if (decrypted) {
                setContacts(decrypted);
            }
        }
    } catch (e) {
        console.error("Critical Storage Load Failure", e);
    } finally {
        setIsDecrypting(false);
        setView('dashboard'); 
    }
  };

  const handleLogout = () => {
      setContacts([]);
      setWallet(null);
      localStorage.removeItem('aether_session');
      localStorage.removeItem('aether_session_exp');
      sessionStorage.removeItem('aether_session');
      meshRefs.current.forEach((mesh: any) => mesh.destroy());
      meshRefs.current.clear();
      setView('login');
  };

  const handleNuke = async () => {
    if (window.confirm("CRITICAL WARNING: This will permanently erase your vault, keys, and all messages from this device. Proceed?")) {
        await SecureStorage.clear();
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }
  };

  // --- VIEW ROUTING ---
  const renderView = () => {
    if (isDecrypting) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-pulse">
                <Shield className="w-16 h-16 text-primary" />
                <div className="font-mono text-xs text-primary tracking-[0.3em]">DECRYPTING SECURE STORAGE...</div>
            </div>
        );
    }

    switch (view) {
      case 'intro':
        return <IntroView 
            onStart={() => generateWallet().then(w => { setTempWallet(w); setView('setup_2fa'); })} 
            onSync={() => setView('scan_sync')} 
            installPrompt={deferredPrompt}
            onInstall={handleInstall}
        />;
      case 'scan_sync':
        return <ScanSyncView onBack={() => setView('intro')} />;
      case 'setup_2fa':
        return tempWallet && <Setup2FAView 
            wallet={tempWallet} 
            onComplete={(w: Wallet, p: string) => { 
              lockWallet(w, p).then(v => { 
                SecureStorage.set('aether_vault', v); // Save to IDB
                setVault(v); setWallet(w); setView('dashboard'); 
              }); 
            }} 
            onCancel={() => setView('intro')} 
        />;
      case 'login':
        return vault && <LoginView vault={vault} onSuccess={handleLoginSuccess} onReset={handleNuke} />;
      case 'dashboard':
        return wallet && (
            <>
                <Dashboard 
                    wallet={wallet} contacts={contacts} setContacts={setContacts} 
                    onLogout={handleLogout} meshRefs={meshRefs} 
                    installPrompt={deferredPrompt} onInstall={handleInstall}
                    isSaving={isSaving} 
                />
                {lockTime && (
                    <div className="fixed top-0 left-1/2 -translate-x-1/2 bg-primary/10 backdrop-blur border-b border-l border-r border-primary/30 text-primary text-[9px] px-3 py-1 rounded-b-lg font-mono z-50">
                        UNLOCKED UNTIL: {new Date(lockTime).toLocaleTimeString()}
                    </div>
                )}
            </>
        );
      default: return null;
    }
  };

  return (
    <>
      {/* PRIVACY CURTAIN OVERLAY */}
      {isBlurred && (
        <div className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center space-y-6">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                <EyeOff size={40} className="text-primary" />
            </div>
            <div className="text-center">
                <h1 className="text-2xl font-bold text-white tracking-[0.5em] font-sans">AETHER</h1>
                <p className="text-primary font-mono text-xs mt-2 uppercase tracking-widest">Secure Session Paused</p>
            </div>
            <div className="px-4 py-2 border border-white/10 rounded bg-white/5 text-[10px] text-slate-500 font-mono">
                FOCUS WINDOW TO RESUME
            </div>
        </div>
      )}

      <GlobalContextMenu 
        onLogout={handleLogout}
        onClearActiveChat={() => {}}
        onNuke={handleNuke}
        activeContactId={null} 
      />
      <div className="h-full w-full flex flex-col">{renderView()}</div>
    </>
  );
}