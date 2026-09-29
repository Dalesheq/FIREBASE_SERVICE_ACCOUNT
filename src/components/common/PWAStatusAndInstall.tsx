import React, { useEffect, useState } from 'react';
import { Download, Wifi, WifiOff, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {/* Online / Offline Status Pill */}
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
          isOnline
            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
            : 'bg-amber-950/80 text-amber-300 border-amber-700/70'
        }`}
        title={
          isOnline
            ? 'Connected — Offline cache active'
            : 'Offline Mode — All inspections, findings, actions & photos are saved locally and sync automatically when online'
        }
      >
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3 text-emerald-400" />
            <span className="hidden md:inline">Offline Ready</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-amber-400 animate-pulse" />
            <span>Offline Mode</span>
          </>
        )}
      </div>

      {/* Chromium / Android / Desktop Install Button */}
      {!isInstalled && isInstallable && (
        <button
          type="button"
          onClick={install}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors cursor-pointer"
          title="Install SHEQ Hub for offline home screen access"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      )}

      {/* iOS Safari Install Guide */}
      {!isInstalled && !isInstallable && isIOS && (
        <>
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Install</span>
          </button>

          {showIOSGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
              <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl text-slate-900 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Share className="h-4 w-4 text-amber-600" />
                    Install on iPhone / iPad
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  1. Tap the <strong>Share</strong> button in your Safari toolbar.<br />
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.<br />
                  3. Open from your home screen for full offline access.
                </p>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full rounded-lg bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                >
                  Got It
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg border border-amber-500">
      <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse shrink-0" />
      <span>
        Offline Mode — Working from local device database. All changes save offline &amp; sync automatically when reconnected.
      </span>
    </div>
  );
};
