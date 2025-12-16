import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Radio, Shield, RefreshCw, EyeOff, Lock, Activity, Clock, Download, QrCode, ScanLine, ArrowRightLeft } from 'lucide-react';
import { Button, Input } from './ui/Common';
import { getTOTPUri, verifyTOTP, Wallet, EncryptedVault, generateWallet, lockWallet, unlockWallet, hashString } from '../services/cryptoUtils';
import { MeshNetwork } from '../services/mesh';
import { SecureStorage } from '../services/storage';

// --- INTRO VIEW ---
export const IntroView = ({ onStart, onSync, installPrompt, onInstall }: any) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden h-full safe-pt safe-pb">
    <div className="absolute inset-0 bg-cyber-grid bg-[length:50px_50px] opacity-20 pointer-events-none" />
    <div className="relative z-10 max-w-md w-full text-center space-y-12 animate-float">
      <div>
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 border border-primary/50 mb-6 shadow-[0_0_30px_rgba(0,243,255,0.2)]">
          <Radio className="w-12 h-12 text-primary animate-pulse-slow" />
        </div>
        <h1 className="text-6xl font-sans font-bold text-white tracking-tighter mb-2">AETHER</h1>
        <p className="text-primary font-mono text-xs tracking-[0.5em] uppercase">Sovereign Mesh Protocol</p>
      </div>

      <div className="space-y-4">
        <Button onClick={onStart} className="w-full h-16 text-lg shadow-[0_0_20px_rgba(0,243,255,0.15)]">INITIALIZE NEW IDENTITY</Button>
        <Button onClick={onSync} variant="secondary" className="w-full flex items-center justify-center gap-2">
            <ArrowRightLeft size={16} /> SYNC IDENTITY
        </Button>
        {installPrompt && (
            <Button onClick={onInstall} variant="ghost" className="w-full flex items-center justify-center gap-2 border border-white/10">
                <Download size={14} /> INSTALL APP (OFFLINE MODE)
            </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 text-[10px] font-mono text-slate-500 pt-8 border-t border-white/5">
         <div className="flex flex-col items-center gap-1"><Shield size={16} /><span>AES-256-GCM</span></div>
         <div className="flex flex-col items-center gap-1"><RefreshCw size={16} /><span>ROLLING KEYS</span></div>
         <div className="flex flex-col items-center gap-1"><EyeOff size={16} /><span>ZERO LOGS</span></div>
      </div>
    </div>
  </div>
);

// --- 2FA SETUP ---
export const Setup2FAView = ({ wallet, onComplete, onCancel }: any) => {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  return (
    <div className="flex-1 flex items-center justify-center p-4 h-full">
      <div className="glass-panel p-8 max-w-md w-full relative border border-primary/30 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" />
        <h2 className="text-2xl font-sans font-bold text-white mb-6 flex items-center gap-2">
            <Shield className="text-primary" /> SECURE GATEWAY
        </h2>
        
        {step === 1 ? (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg mx-auto w-fit shadow-inner">
              <QRCode value={getTOTPUri(wallet.totpSecret, "Aether Identity")} size={160} />
            </div>
            <p className="text-center text-xs font-mono text-slate-400">SCAN WITH AUTHENTICATOR APP</p>
            <Input placeholder="000 000" maxLength={6} className="text-center text-2xl tracking-[0.5em] font-bold" value={token} onChange={(e:any) => setToken(e.target.value.replace(/[^0-9]/g, ''))} />
            {err && <p className="text-danger text-xs text-center font-bold animate-pulse">{err}</p>}
            <div className="flex gap-4">
               <Button variant="ghost" onClick={onCancel} className="flex-1">CANCEL</Button>
               <Button onClick={() => verifyTOTP(wallet.totpSecret, token) ? setStep(2) : setErr('INVALID CODE')} className="flex-1">VERIFY</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-slate-400 text-sm font-mono">Set a strong master password. This key encrypts your local vault. If lost, data is unrecoverable.</p>
            <Input type="password" placeholder="ENTER MASTER PASSWORD" value={pass} onChange={(e:any) => setPass(e.target.value)} />
            <Button onClick={() => pass.length > 7 ? onComplete(wallet, pass) : setErr('MIN 8 CHARACTERS REQUIRED')} className="w-full">ENCRYPT VAULT</Button>
            {err && <p className="text-danger text-xs text-center">{err}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

// --- LOGIN VIEW ---
export const LoginView = ({ vault, onSuccess, onReset }: any) => {
  const [pass, setPass] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');
  const [duration, setDuration] = useState(-1); // Default to Session (Browser Open)

  const unlock = async () => {
    try {
      setStatus('VERIFYING CREDENTIALS...');
      // 1. Password Check
      const w = await unlockWallet(vault, pass);
      // 2. Auth Check
      if (!verifyTOTP(w.totpSecret, token)) {
          throw new Error('INVALID 2FA TOKEN');
      }
      // 3. Success
      onSuccess(w, duration);
    } catch (e: any) { 
        setStatus(e.message === 'INVALID 2FA TOKEN' ? 'AUTH FAILED: INVALID 2FA' : 'ACCESS DENIED: WRONG PASSWORD'); 
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 h-full">
      <div className="glass-panel p-8 max-w-sm w-full text-center space-y-6 border border-white/10 relative">
        <div className="mx-auto w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-widest font-mono">SYSTEM LOCKED</h2>
        <div className="space-y-4">
           <Input type="password" placeholder="PASSWORD" value={pass} onChange={(e:any) => setPass(e.target.value)} />
           <Input placeholder="2FA CODE" maxLength={6} className="text-center tracking-widest" value={token} onChange={(e:any) => setToken(e.target.value)} />
           
           <div className="bg-black/40 border border-white/10 rounded p-2 flex items-center gap-2">
             <Clock size={16} className="text-slate-400" />
             <select 
                value={duration} 
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="bg-transparent text-xs text-white outline-none w-full font-mono cursor-pointer"
             >
                <option value={-1}>Session Access (Data Persists)</option>
                <option value={0}>Lock on Refresh (Maximum Security)</option>
                <option value={15}>Keep Unlocked: 15 Minutes</option>
                <option value={60}>Keep Unlocked: 1 Hour</option>
                <option value={240}>Keep Unlocked: 4 Hours</option>
             </select>
           </div>
           <p className="text-[9px] text-slate-500 text-left pl-1">
             * "Session Access" unlocks automatically on reload. Key is wiped on tab close. Data remains in vault.
           </p>
        </div>
        <Button onClick={unlock} className="w-full mt-4">AUTHENTICATE</Button>
        <p className={`text-xs font-mono h-4 ${status.includes('DENIED') || status.includes('FAILED') ? 'text-danger' : 'text-primary'}`}>{status}</p>
        <div className="pt-8 border-t border-white/5">
            <button onClick={onReset} className="text-[10px] text-slate-600 hover:text-danger tracking-widest uppercase transition-colors">Emergency Wipe Vault</button>
        </div>
      </div>
    </div>
  );
};

// --- SYNC SCANNER VIEW (BI-DIRECTIONAL) ---
export const ScanSyncView = ({ onBack }: any) => {
    const [mode, setMode] = useState<'SCAN' | 'DISPLAY'>('SCAN');
    const [status, setStatus] = useState('IDLE');
    const [displayData, setDisplayData] = useState<any>(null);
    const meshRef = useRef<MeshNetwork | null>(null);

    // MODE: SCANNING (Standard)
    // Connect to the code we just scanned
    const connectToSource = async (code: string) => {
        setStatus('ESTABLISHING SECURE TUNNEL...');
        const secret = await hashString("SYNC_" + code);
        
        const m = new MeshNetwork(secret, (msg: any) => {
            if (msg.type === 'SYNC_PAYLOAD') {
                setStatus('DOWNLOADING VAULT...');
                
                // Store received encrypted blobs into IDB
                const save = async () => {
                    if (msg.data.vault) await SecureStorage.set('aether_vault', msg.data.vault);
                    if (msg.data.contacts) await SecureStorage.set('aether_contacts', msg.data.contacts);
                    m.destroy();
                    setTimeout(() => {
                        alert("Migration Successful. Please Login.");
                        window.location.reload(); 
                    }, 1000);
                };
                save();
            }
        }, () => {});
        meshRef.current = m;
    };

    // MODE: DISPLAY (Reverse)
    // Show a code, wait for Source to scan us, then receive data
    useEffect(() => {
        if (mode === 'DISPLAY') {
            const syncId = crypto.randomUUID();
            setDisplayData({ type: 'AETHER_REVERSE_SYNC', code: syncId });
            setStatus('WAITING FOR SOURCE DEVICE...');
            
            hashString("SYNC_" + syncId).then(secret => {
                const m = new MeshNetwork(secret, (msg: any) => {
                    if (msg.type === 'SYNC_PAYLOAD') {
                         setStatus('DOWNLOADING VAULT...');
                         const save = async () => {
                            if (msg.data.vault) await SecureStorage.set('aether_vault', msg.data.vault);
                            if (msg.data.contacts) await SecureStorage.set('aether_contacts', msg.data.contacts);
                            m.destroy();
                            setTimeout(() => {
                                alert("Migration Successful. Please Login.");
                                window.location.reload(); 
                            }, 1000);
                        };
                        save();
                    }
                }, () => {});
                meshRef.current = m;
            });
        }
        return () => meshRef.current?.destroy();
    }, [mode]);

    // Scanner Initialization
    useEffect(() => {
        if (mode === 'SCAN') {
            let scanner: Html5QrcodeScanner | null = null;
            setTimeout(() => {
                if (document.getElementById("sync-reader")) {
                    scanner = new Html5QrcodeScanner("sync-reader", { fps: 10, qrbox: 250 }, false);
                    scanner.render((t) => {
                        try {
                            const d = JSON.parse(t);
                            if (d.type === 'AETHER_SYNC' && d.code) {
                                scanner?.clear();
                                connectToSource(d.code);
                            }
                        } catch {}
                    }, () => {});
                }
            }, 100);
            return () => { try{scanner?.clear()}catch{}; };
        }
    }, [mode]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
            <h2 className="text-white mb-2 text-xl font-bold tracking-widest">DEVICE MIGRATION</h2>
            <div className="text-[10px] text-slate-500 mb-6 max-w-xs text-center border-b border-white/10 pb-4">
                WARNING: This will clone your identity. Messages are deleted from the server upon delivery. Only the first active device will receive new messages.
            </div>
            
            {/* TOGGLE TABS */}
            <div className="flex bg-white/5 p-1 rounded-lg mb-6 w-full max-w-xs">
                <button 
                    onClick={() => { setMode('SCAN'); setStatus('IDLE'); }} 
                    className={`flex-1 py-2 text-[10px] font-mono rounded flex items-center justify-center gap-2 ${mode === 'SCAN' ? 'bg-primary text-black font-bold' : 'text-slate-400'}`}
                >
                    <ScanLine size={12} /> SCAN OLD DEVICE
                </button>
                <button 
                    onClick={() => { setMode('DISPLAY'); setStatus('IDLE'); }}
                    className={`flex-1 py-2 text-[10px] font-mono rounded flex items-center justify-center gap-2 ${mode === 'DISPLAY' ? 'bg-primary text-black font-bold' : 'text-slate-400'}`}
                >
                    <QrCode size={12} /> SHOW CODE
                </button>
            </div>

            {status !== 'IDLE' && status !== 'WAITING FOR SOURCE DEVICE...' ? (
                <div className="text-center space-y-4">
                     <Activity size={48} className="text-primary animate-pulse mx-auto" />
                     <div className="text-primary font-mono">{status}</div>
                </div>
            ) : mode === 'SCAN' ? (
                <>
                    <div id="sync-reader" className="w-full max-w-sm overflow-hidden rounded-lg border border-white/20 mb-4"></div>
                    <p className="text-xs text-slate-500 font-mono">Scan the "Export Identity" QR code on your OLD device.</p>
                </>
            ) : (
                <div className="text-center space-y-4 animate-[float_0.3s_ease-out]">
                    <div className="bg-white p-4 rounded-xl inline-block border-4 border-primary/20 shadow-[0_0_30px_rgba(0,243,255,0.2)]">
                        {displayData && <QRCode value={JSON.stringify(displayData)} size={200} />}
                    </div>
                    <div className="text-primary text-xs font-mono animate-pulse">WAITING FOR OLD DEVICE...</div>
                    <p className="text-slate-500 text-[10px] max-w-xs mx-auto">
                        On your <strong>logged-in device</strong>, go to Settings &gt; Sync Identity &gt; Select "Scan Target" and scan this code.
                    </p>
                </div>
            )}
            
            <Button variant="ghost" onClick={onBack} className="mt-8">CANCEL</Button>
        </div>
    );
};