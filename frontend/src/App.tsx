import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { generateWallet, lockWallet, unlockWallet, Wallet, EncryptedVault, Contact, encryptStorage, decryptStorage, encryptSession, decryptSession } from './services/cryptoUtils';
import { SecureStorage } from './services/storage';
import { GlobalContextMenu } from './components/ui/GlobalContextMenu';
import { IntroView, Setup2FAView, LoginView, ScanSyncView } from './components/Auth';
import Dashboard from './components/Dashboard';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { NotificationContainer } from './components/NotificationContainer';
import { Shield, EyeOff, RefreshCw, Lock as LockIcon } from 'lucide-react';
import { Button, ConfirmModal, AlertModal } from './components/ui/Common';

const APP_VERSION = "2.2.0";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addNotification } = useNotification();

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
    onConfirm: () => {}
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

  const triggerConfirm = (title: string, message: string, onConfirm: () => void, variant: 'primary' | 'danger' | 'secondary' = 'primary') => {
    setConfirmState({ isOpen: true, title, message, onConfirm, variant });
  };

  const triggerAlert = (title: string, message: string, variant: 'primary' | 'danger' = 'primary') => {
    setAlertState({ isOpen: true, title, message, variant });
  };

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
  const [isBlurred, setIsBlurred] = useState(false); 
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [lockTime, setLockTime] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const meshRefs = useRef<Map<string, any>>(new Map());

  // --- PRIVACY CURTAIN ---
  useEffect(() => {
    const handleVisibilityChange = () => {
       if (document.hidden) setIsBlurred(true);
       else setIsBlurred(false);
    };
    const handleBlur = () => {
       if (location.pathname.startsWith('/dashboard') || location.pathname === '/login') setIsBlurred(true);
    };
    const handleFocus = () => setIsBlurred(false);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("blur", handleBlur);
        window.removeEventListener("focus", handleFocus);
    };
  }, [location]);

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
                            setIsInitialized(true);
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
            navigate('/login', { replace: true });
        } else {
            navigate('/', { replace: true });
        }
        setIsInitialized(true);
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

  // --- AUTO-SAVE ---
  useEffect(() => {
    if (!wallet || !location.pathname.startsWith('/dashboard')) return;
    const saveEncrypted = async () => {
        setIsSaving(true);
        const encrypted = await encryptStorage(wallet.storageKey, contacts);
        await SecureStorage.set('aether_contacts', encrypted);
        setTimeout(() => setIsSaving(false), 500);
    };
    const saveTimer = setTimeout(saveEncrypted, 1000);
    return () => clearTimeout(saveTimer);
  }, [contacts, wallet, location]);

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
    } else {
        const exp = localStorage.getItem('aether_session_exp');
        if (exp) setLockTime(parseInt(exp));
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
        navigate('/dashboard', { replace: true }); 
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
      navigate('/login', { replace: true });
  };

  const handleNuke = async () => {
    triggerConfirm(
        "CRITICAL: NUKE DATA",
        "This will permanently erase your vault, keys, and all messages. This action is IRREVERSIBLE. Proceed?",
        async () => {
            await SecureStorage.clear();
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        },
        'danger'
    );
  };

  const activeContactId = location.pathname.match(/\/dashboard\/chat\/([^/]+)/)?.[1] || null;

  const handleClearLocal = () => {
    if (!activeContactId) return;
    triggerConfirm(
        "CLEAR LOCAL HISTORY",
        "Are you sure you want to clear all local messages in this channel? This cannot be undone.",
        () => {
            setContacts(prev => prev.map(c => c.id === activeContactId ? { ...c, messages: [], unread: 0 } : c));
        }
    );
  };

  const handleClearBothSides = async () => {
    if (!activeContactId) return;
    triggerConfirm(
        "CLEAR BOTH SIDES",
        "DANGEROUS: This will attempt to clear history on BOTH devices. Proceed with extreme caution?",
        async () => {
            const mesh = meshRefs.current.get(activeContactId);
            if (mesh) {
                await mesh.broadcast({ id: crypto.randomUUID(), timestamp: Date.now(), sender: 'me', type: 'clear_chat_request' });
            }
            setContacts(prev => prev.map(c => c.id === activeContactId ? { ...c, pendingClear: true } : c));
        },
        'danger'
    );
  };

  if (!isInitialized) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-black">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
            <div className="font-mono text-[10px] text-primary tracking-[0.3em]">INITIALIZING AETHER...</div>
        </div>
      );
  }

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

      {needRefresh && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-[1000] animate-in slide-in-from-bottom duration-500">
          <div className="bg-[#1a1a1f]/90 backdrop-blur-xl border border-primary/30 p-5 rounded-2xl shadow-[0_0_30px_rgba(0,243,255,0.15)] flex flex-col gap-4 max-w-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <RefreshCw size={20} className="text-primary animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wider">PROTOCOL UPDATE</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">VERSION {APP_VERSION} READY</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setNeedRefresh(false)} className="flex-1 py-2 text-[10px]">DISMISS</Button>
              <Button onClick={() => updateServiceWorker(true)} className="flex-1 py-2 text-[10px]">UPDATE NOW</Button>
            </div>
          </div>
        </div>
      )}

      {isDecrypting && (
        <div className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center space-y-4">
             <Shield className="w-16 h-16 text-primary animate-pulse" />
             <div className="font-mono text-xs text-primary tracking-[0.3em]">DECRYPTING SECURE STORAGE...</div>
        </div>
      )}

      <GlobalContextMenu
        onLogout={handleLogout}
        onClearLocal={handleClearLocal}
        onClearBothSides={handleClearBothSides}
        onNuke={handleNuke}
        activeContactId={activeContactId}
      />
      
      <Routes>
        <Route path="/" element={
            wallet ? <Navigate to="/dashboard" replace /> : 
            vault ? <Navigate to="/login" replace /> : 
            <IntroView 
                onStart={() => generateWallet().then(w => { setTempWallet(w); navigate('/setup'); })} 
                onSync={() => navigate('/scan')} 
                installPrompt={deferredPrompt}
                onInstall={handleInstall}
                version={APP_VERSION}
            />
        } />
        <Route path="/login" element={
            vault ? <LoginView vault={vault} onSuccess={handleLoginSuccess} onReset={handleNuke} version={APP_VERSION} /> : <Navigate to="/" replace />
        } />
        <Route path="/setup" element={
            tempWallet ? <Setup2FAView 
                wallet={tempWallet} 
                onComplete={(w: Wallet, p: string) => { 
                  lockWallet(w, p).then(v => { 
                    SecureStorage.set('aether_vault', v);
                    setVault(v); handleLoginSuccess(w, -1); 
                  }); 
                }} 
                onCancel={() => navigate(-1)} 
            /> : <Navigate to="/" replace />
        } />
        <Route path="/scan" element={<ScanSyncView onBack={() => navigate(-1)} triggerAlert={triggerAlert} />} />
        <Route path="/dashboard/*" element={
            wallet ? (
                <>
                    <Dashboard 
                        wallet={wallet} contacts={contacts} setContacts={setContacts} 
                        onLogout={handleLogout} meshRefs={meshRefs} 
                        installPrompt={deferredPrompt} onInstall={handleInstall}
                        isSaving={isSaving} version={APP_VERSION}
                    />
                    {lockTime && (
                        <div 
                          onClick={() => {
                            triggerConfirm(
                                "LOCK SESSION",
                                "Terminate secure session and lock vault now?",
                                () => handleLogout()
                            );
                          }}
                          className="fixed top-0 left-1/2 -translate-x-1/2 bg-primary/10 hover:bg-danger/20 hover:text-danger cursor-pointer transition-all backdrop-blur border-b border-l border-r border-primary/30 hover:border-danger/30 text-primary text-[9px] px-3 py-1 rounded-b-lg font-mono z-[60] flex items-center gap-1.5 group"
                        >
                            <LockIcon size={8} className="group-hover:animate-pulse" />
                            <span className="group-hover:hidden">UNLOCKED UNTIL: {new Date(lockTime).toLocaleTimeString()}</span>
                            <span className="hidden group-hover:inline">LOCK SESSION NOW</span>
                        </div>
                    )}
                </>
            ) : <Navigate to="/login" replace />
        } />
      </Routes>

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
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </BrowserRouter>
  );
}