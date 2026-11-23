import React, { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { BRAND } from '../../config/brand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'sbkhush_pwa_install_dismissed_v1';

export const PWAStatusBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      // Ignore prompt cancellation errors
    } finally {
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore storage failures
    }
  };

  return (
    <>
      {isOffline && (
        <div
          role="status"
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[120] inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950 text-amber-100 text-xs font-semibold shadow-lg border border-amber-700/60"
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>You are offline — showing cached storefront content</span>
        </div>
      )}

      {installPrompt && !dismissed && (
        <div className="fixed bottom-4 right-4 z-[110] max-w-xs bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
            alt={`${BRAND.name} App`}
            width={40}
            height={40}
            decoding="async"
            className="w-10 h-10 rounded-xl shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 truncate">Install {BRAND.name}</p>
            <p className="text-[11px] text-slate-500 leading-snug">
              Quick launch for POS, orders &amp; store access.
            </p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="px-2.5 py-1.5 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
          >
            <Download className="w-3 h-3" />
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
