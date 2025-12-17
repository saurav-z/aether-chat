import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Radio, Shield, RefreshCw, EyeOff, Lock, Activity, Clock, Download, QrCode, ScanLine, ArrowRightLeft, Copy, Check } from 'lucide-react';
import { Button, Input } from './ui/Common';
import { getTOTPUri, verifyTOTP, Wallet, EncryptedVault, generateWallet, lockWallet, unlockWallet, hashString } from '../services/cryptoUtils';
import { MeshNetwork } from '../services/mesh';
import { SecureStorage } from '../services/storage';

// --- INTRO VIEW ---
export const IntroView = ({ onStart, onSync, installPrompt, onInstall }: any) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden h-full safe-pt safe-pb">
    <div className="absolute inset-0 bg-cyber-grid bg-[length:50px_50px] opacity-10 pointer-events-none" />
    <div className="relative z-10 max-w-md w-full text-center space-y-8">
      <div>
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/5 border border-primary/30 mb-6 shadow-[0_0_30px_rgba(0,243,255,0.1)]">
          <Radio className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-5xl font-sans font-bold text-white tracking-tight mb-2">AETHER</h1>
        <p className="text-primary font-mono text-xs tracking-[0.3em] uppercase text-slate-400">Sovereign Mesh Protocol</p>
      </div>

      <p className="text-slate-400 text-sm font-light leading-relaxed">
        End-to-end encrypted communications with zero server knowledge. Your conversations are yours alone.
      </p>

      <div className="space-y-3">
        <Button onClick={onStart} className="w-full h-14 text-base shadow-[0_0_20px_rgba(0,243,255,0.1)]">NEW IDENTITY</Button>
        <Button onClick={onSync} variant="secondary" className="w-full flex items-center justify-center gap-2 h-12">
            <ArrowRightLeft size={16} /> SYNC IDENTITY
        </Button>
        {installPrompt && (
          <Button onClick={onInstall} variant="ghost" className="w-full flex items-center justify-center gap-2 border border-white/10 h-12">
            <Download size={14} /> INSTALL APP
            </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 text-[9px] font-mono text-slate-500 pt-6 border-t border-white/5">
        <div className="flex flex-col items-center gap-2"><Shield size={14} /><span>AES-256-GCM</span></div>
        <div className="flex flex-col items-center gap-2"><RefreshCw size={14} /><span>ROLLING KEYS</span></div>
        <div className="flex flex-col items-center gap-2"><EyeOff size={14} /><span>ZERO LOGS</span></div>
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
  const [copied, setCopied] = useState(false);

  const copySecret = () => {
    navigator.clipboard.writeText(wallet.totpSecret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 h-full">
      <div className="glass-panel p-8 max-w-md w-full relative border border-primary/30 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" />
        <h2 className="text-2xl font-sans font-bold text-white mb-2 flex items-center gap-2">
          <Shield className="text-primary" size={24} /> SECURE GATEWAY
        </h2>
        <p className="text-xs text-slate-400 mb-6 font-light">Step {step} of 2</p>
        
        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-mono text-slate-400 mb-3 uppercase tracking-wide">1. Install an Authenticator App</p>
              <p className="text-xs text-slate-500 mb-4">Download one of these apps on your phone:</p>
              <ul className="text-xs text-slate-400 space-y-1 ml-4">
                <li>• Google Authenticator</li>
                <li>• Microsoft Authenticator</li>
                <li>• Authy</li>
                <li>• Any RFC 6238 TOTP app</li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-mono text-slate-400 mb-3 uppercase tracking-wide">2. Scan or Enter Key</p>
              <div className="bg-white p-4 rounded-lg mx-auto w-fit shadow-inner mb-4">
                <QRCode value={getTOTPUri(wallet.totpSecret, "Aether Identity")} size={160} />
              </div>
              <p className="text-center text-xs text-slate-500 mb-4">or manually enter this key:</p>

              <div className="bg-black/40 border border-white/20 rounded p-3 flex items-center justify-between gap-2 mb-2">
                <code className="text-xs font-mono text-primary tracking-wider select-all">{wallet.totpSecret}</code>
                <button
                  onClick={copySecret}
                  className="flex-shrink-0 p-2 hover:bg-white/10 rounded transition-colors"
                  title="Copy secret key"
                >
                  {copied ? (
                    <Check size={16} className="text-success" />
                  ) : (
                    <Copy size={16} className="text-slate-400 hover:text-white" />
                  )}
                </button>
              </div>
              <p className="text-[9px] text-slate-600 text-center">Click to copy the key</p>
            </div>

            <div>
              <p className="text-xs font-mono text-slate-400 mb-3 uppercase tracking-wide">3. Enter the 6-Digit Code</p>
              <Input placeholder="000 000" maxLength={6} className="text-center text-2xl tracking-[0.5em] font-bold" value={token} onChange={(e: any) => setToken(e.target.value.replace(/[^0-9]/g, ''))} />
            </div>

            {err && <p className="text-danger text-xs text-center font-bold animate-pulse">{err}</p>}
            <div className="flex gap-4">
               <Button variant="ghost" onClick={onCancel} className="flex-1">CANCEL</Button>
              <Button onClick={() => verifyTOTP(wallet.totpSecret, token) ? setStep(2) : setErr('INVALID CODE')} className="flex-1">VERIFY CODE</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
              <div>
                <p className="text-xs text-slate-400 font-light leading-relaxed">
                  Create a strong master password. This encrypts your local vault. If lost, your data is unrecoverable.
                </p>
              </div>
              <div>
                <p className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-wide">Master Password</p>
                <Input type="password" placeholder="Enter strong password (8+ characters)" value={pass} onChange={(e: any) => setPass(e.target.value)} />
                {pass.length > 0 && (
                  <p className={`text-xs mt-2 ${pass.length >= 8 ? 'text-success' : 'text-warning'}`}>
                    {pass.length < 8 ? '⚠ At least 8 characters required' : '✓ Password strength: Good'}
                  </p>
                )}
              </div>
              <Button onClick={() => pass.length > 7 ? onComplete(wallet, pass) : setErr('MIN 8 CHARACTERS REQUIRED')} className="w-full" disabled={pass.length < 8}>COMPLETE SETUP</Button>
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
        <div className="mx-auto w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-2">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-wide font-sans">UNLOCK VAULT</h2>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-wide">Password</p>
            <Input type="password" placeholder="Enter your master password" value={pass} onChange={(e: any) => setPass(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && unlock()} />
          </div>

          <div>
            <p className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-wide">2FA Code</p>
            <Input placeholder="000 000" maxLength={6} className="text-center tracking-[0.5em] text-lg font-bold" value={token} onChange={(e: any) => setToken(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e: any) => e.key === 'Enter' && unlock()} />
          </div>
           
          <div>
            <p className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-wide">Session Duration</p>
             <select 
                value={duration} 
                onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full bg-black/40 border border-white/10 rounded p-3 text-xs text-white outline-none font-light cursor-pointer hover:border-white/20 transition-colors"
             >
              <option value={-1}>Session Access (Until tab closes)</option>
                <option value={0}>Lock on Refresh (Maximum Security)</option>
                <option value={15}>Keep Unlocked: 15 Minutes</option>
                <option value={60}>Keep Unlocked: 1 Hour</option>
                <option value={240}>Keep Unlocked: 4 Hours</option>
             </select>
            <p className="text-[8px] text-slate-500 text-left mt-2">
              Session persists data in memory. Closing the tab or browser will lock your vault.
            </p>
          </div>
        </div>

        <Button onClick={unlock} className="w-full h-12">AUTHENTICATE</Button>

        {status && (
          <p className={`text-xs font-mono h-4 ${status.includes('DENIED') || status.includes('FAILED') ? 'text-danger' : 'text-primary'}`}>
            {status}
          </p>
        )}

        <div className="pt-6 border-t border-white/5">
          <button
            onClick={onReset}
            className="text-[10px] text-slate-600 hover:text-danger tracking-widest uppercase transition-colors font-light"
          >
            Emergency: Wipe Vault
          </button>
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
        <h2 className="text-white mb-2 text-xl font-bold tracking-wide font-sans">IDENTITY MIGRATION</h2>
        <div className="text-xs text-slate-400 mb-6 max-w-xs text-center border-b border-white/10 pb-4 font-light leading-relaxed">
          Clone your identity to a new device. Note: Messages are deleted upon delivery. Only the first active device receives new messages to preserve privacy.
            </div>
            
            {/* TOGGLE TABS */}
            <div className="flex bg-white/5 p-1 rounded-lg mb-6 w-full max-w-xs">
                <button 
                    onClick={() => { setMode('SCAN'); setStatus('IDLE'); }} 
            className={`flex-1 py-2 text-xs font-light rounded flex items-center justify-center gap-2 transition-all ${mode === 'SCAN' ? 'bg-primary text-black font-semibold' : 'text-slate-400 hover:text-slate-300'}`}
                >
            <ScanLine size={14} /> RECEIVE CODE
                </button>
                <button 
                    onClick={() => { setMode('DISPLAY'); setStatus('IDLE'); }}
            className={`flex-1 py-2 text-xs font-light rounded flex items-center justify-center gap-2 transition-all ${mode === 'DISPLAY' ? 'bg-primary text-black font-semibold' : 'text-slate-400 hover:text-slate-300'}`}
                >
            <QrCode size={14} /> SEND CODE
                </button>
            </div>

            {status !== 'IDLE' && status !== 'WAITING FOR SOURCE DEVICE...' ? (
                <div className="text-center space-y-4">
                     <Activity size={48} className="text-primary animate-pulse mx-auto" />
            <div className="text-primary font-mono text-sm">{status}</div>
                </div>
            ) : mode === 'SCAN' ? (
                <>
              <div id="sync-reader" className="w-full max-w-sm overflow-hidden rounded-lg border border-white/20 mb-4 bg-black/50"></div>
              <p className="text-xs text-slate-500 font-light">Scan the code from your old device to receive your identity.</p>
                </>
            ) : (
              <div className="text-center space-y-4">
                <div className="bg-white p-4 rounded-xl inline-block border-4 border-primary/30 shadow-[0_0_30px_rgba(0,243,255,0.15)]">
                        {displayData && <QRCode value={JSON.stringify(displayData)} size={200} />}
                    </div>
                <div className="text-primary text-xs font-light animate-pulse">WAITING FOR OLD DEVICE...</div>
                <p className="text-slate-500 text-xs max-w-xs mx-auto font-light leading-relaxed">
                  On your logged-in device, go to Settings → Sync Identity and scan this code.
                    </p>
                </div>
            )}
            
            <Button variant="ghost" onClick={onBack} className="mt-8">CANCEL</Button>
        </div>
    );
};