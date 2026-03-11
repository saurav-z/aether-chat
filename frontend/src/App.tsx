import React, { useState, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { generateWallet, lockWallet, unlockWallet, Wallet, EncryptedVault, Contact, encryptStorage, decryptStorage, encryptSession, decryptSession } from './services/cryptoUtils';
import { SecureStorage } from './services/storage';
import { GlobalContextMenu } from './components/ui/GlobalContextMenu';
import { IntroView, Setup2FAView, LoginView, ScanSyncView } from './components/Auth';
import Dashboard from './components/Dashboard';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { NotificationContainer } from './components/NotificationContainer';
import { Download, Shield, EyeOff, Lock, RefreshCw } from 'lucide-react';
import { Button } from './components/ui/Common';

function AppContent() {
  const [view, setView] = useState<'intro' | 'setup_2fa' | 'login' | 'dashboard' | 'scan_sync'>('intro');
  const [lastBackPress, setLastBackPress] = useState(0);
  const { addNotification } = useNotification();

  // --- PWA UPDATE HANDLER ---
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error);
    },
  });

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
       if (document.hidden) setIsBlurred(true);
       else setIsBlurred(false);
    };

    const handleBlur = () => {
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

  // --- INITIALIZATION & SESSION RESTORE ---
  useEffect(() => {
    const init = async () => {
        const savedVault = await SecureStorage.get('aether_vault');
        const savedSession = sessionStorage.getItem('aether_session') || localStorage.getItem('aether_session');
        const sessionExpiry = localStorage.getItem('aether_session_exp');

        if (savedVault) {
            setVault(savedVault); 
            if (savedSession) {
                const isValid = !sessionExpiry || (Date.now() < parseInt(sessionExpiry));
                if (isValid) {
                    try {
                        const restoredWallet = await decryptSession(savedSession);
                        if (restoredWallet) {
                            await handleLoginSuccess(restoredWallet, sessionExpiry ? 0 : -1, true);
                            return;
                        }
                    } catch (e) {
                        console.error("Session corrupted");
                    }
                } else {
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
    if (view !== 'dashboard' || !wallet) return;
    const interval = setInterval(() => {
      setContacts(prev => prev.map(c => {
        if (!c.messages) return c;
        const now = Date.now();
        const validMsgs = c.messages.filter(m => !m.expiresAt || m.expiresAt > now);
        if (c.autoDeleteInterval && c.messages.length > 0) {
            return { ...c, messages: validMsgs.filter(m => m.timestamp > (now - (c.autoDeleteInterval || 0))) };
        }
        return { ...c, messages: validMsgs };
      }));
    }, 1000);

    const saveEncrypted = async () => {
        setIsSaving(true);
        const encrypted = await encryptStorage(wallet.storageKey, contacts);
        await SecureStorage.set('aether_contacts', encrypted);
        setTimeout(() => setIsSaving(false), 500);
    };
    const saveTimer = setTimeout(saveEncrypted, 1000);
    return () => {
        clearInterval(interval);
        clearTimeout(saveTimer);
    };
  }, [contacts, wallet, view]);

  // --- HISTORY MANAGEMENT ---
  useEffect(() => {
    window.history.replaceState({ view: 'intro' }, '');
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.view) {
        setView(state.view);
      } else if (!state || !state.view) {
        if (view === 'intro' || view === 'login' || (view === 'dashboard' && !state?.activeId)) {
          const now = Date.now();
          if (now - lastBackPress < 2000) {
            // Exit handled by browser
          } else {
            setLastBackPress(now);
            window.history.pushState({ view }, ''); 
            addNotification("Press back again to exit Aether", 'info', { duration: 3000 });
          }
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, lastBackPress, addNotification]);

  const navigateTo = (newView: typeof view) => {
    if (newView !== view) {
      window.history.pushState({ view: newView }, '');
      setView(newView);
    }
  };

  const handleLoginSuccess = async (w: Wallet, duration: number, isRestoring = false) => { 
    setWallet(w); 
    if (!isRestoring) {
        const sessionBlob = await encryptSession(w);
        if (duration === -1) {
             sessionStorage.setItem('aether_session', sessionBlob);
             localStorage.removeItem('aether_session');
             localStorage.removeItem('aether_session_exp');
             setLockTime(null);
        } else if (duration > 0) {
             const expiry = Date.now() + (duration * 60 * 1000);
             localStorage.setItem('aether_session', sessionBlob);
             localStorage.setItem('aether_session_exp', expiry.toString());
             sessionStorage.removeItem('aether_session');
             setLockTime(expiry);
        } else {
             sessionStorage.removeItem('aether_session');
             localStorage.removeItem('aether_session');
             localStorage.removeItem('aether_session_exp');
        }
    }
    setIsDecrypting(true);
    if (isRestoring) await new Promise(r => setTimeout(r, 800));
    try {
        const encryptedContacts = await SecureStorage.get('aether_contacts');
        if (encryptedContacts) {
            const decrypted = await decryptStorage(w.storageKey, encryptedContacts);
            if (decrypted) setContacts(decrypted);
        }
    } catch (e) {
        console.error("Storage Load Failure", e);
    } finally {
        setIsDecrypting(false);
        navigateTo('dashboard'); 
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
      navigateTo('login');
  };

  const handleNuke = async () => {
    if (window.confirm("CRITICAL WARNING: This will permanently erase your vault, keys, and all messages. Proceed?")) {
        await SecureStorage.clear();
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }
  };

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
            onStart={() => generateWallet().then(w => { setTempWallet(w); navigateTo('setup_2fa'); })} 
            onSync={() => navigateTo('scan_sync')} 
            installPrompt={deferredPrompt}
            onInstall={handleInstall}
        />;
      case 'scan_sync':
        return <ScanSyncView onBack={() => window.history.back()} />;
      case 'setup_2fa':
        return tempWallet && <Setup2FAView 
            wallet={tempWallet} 
            onComplete={(w: Wallet, p: string) => { 
              lockWallet(w, p).then(v => { 
                SecureStorage.set('aether_vault', v);
                setVault(v); setWallet(w); navigateTo('dashboard'); 
              }); 
            }} 
            onCancel={() => window.history.back()} 
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
      <NotificationContainer />

      {/* PWA UPDATE PROMPT */}
      {needRefresh && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-[1000] animate-in slide-in-from-bottom duration-500">
          <div className="bg-[#1a1a1f]/90 backdrop-blur-xl border border-primary/30 p-5 rounded-2xl shadow-[0_0_30px_rgba(0,243,255,0.15)] flex flex-col gap-4 max-w-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <RefreshCw size={20} className="text-primary animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wider">PROTOCOL UPDATE</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">NEW VERSION OF AETHER IS READY</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={() => setNeedRefresh(false)} 
                className="flex-1 py-2 text-[10px] border-white/5 hover:bg-white/5"
              >
                DISMISS
              </Button>
              <Button 
                onClick={() => updateServiceWorker(true)} 
                className="flex-1 py-2 text-[10px] shadow-[0_0_15px_rgba(0,243,255,0.3)]"
              >
                UPDATE NOW
              </Button>
            </div>
          </div>
        </div>
      )}

      <GlobalContextMenu
        onLogout={handleLogout}
        onClearActiveChat={() => { }}
        onNuke={handleNuke}
        activeContactId={null}
      />
      <div className="h-full w-full flex flex-col">{renderView()}</div>
    </>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}