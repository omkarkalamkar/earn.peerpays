import { useEffect, useState } from 'react';

/**
 * PWA Install Prompt - Shows "Add to Home Screen" button after login
 * Appears automatically when PWA is installable and user is logged in
 * iOS Safari: Shows manual instructions with visual guide
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if already installed (running in standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
    setIsStandalone(standalone);

    // Check if already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && Date.now() < parseInt(dismissed)) return;

    // For iOS: show manual instructions if not installed
    if (iOS && !standalone) {
      // Wait 2 seconds after login before showing
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }

    // For other browsers: Listen for beforeinstallprompt event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installed');
    }

    // Clear the prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 7 days
    const sevenDays = Date.now() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('pwa-install-dismissed', sevenDays);
  };

  if (!showPrompt || isStandalone) return null;

  // iOS Safari - Show manual instructions with visual guide
  if (isIOS) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
        <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 shadow-2xl animate-slide-up">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500">
                <span className="text-2xl">📱</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Install PeerPays</h3>
                <p className="text-xs text-slate-500">Add to Home Screen</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-slate-600">
              Install PeerPays for faster access and notifications. Follow these simple steps:
            </p>

            {/* Step 1 */}
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Tap the Share button</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-blue-500 bg-blue-50">
                    <svg className="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-xs text-slate-500">Usually at bottom or top of Safari</p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Select "Add to Home Screen"</p>
                <p className="text-xs text-slate-500 mt-1">Scroll down if you don't see it immediately</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                3
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Tap "Add"</p>
                <p className="text-xs text-slate-500 mt-1">PeerPays will appear on your home screen! 🎉</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 active:scale-95 transition"
          >
            Got it!
          </button>
        </div>
      </div>
    );
  }

  // Android/Desktop - Standard install prompt
  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="rounded-2xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 to-brand-100 p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500">
              <span className="text-2xl">📱</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-brand-900">Install PeerPays App</h3>
            <p className="text-xs text-brand-700 mt-1 leading-relaxed">
              Add PeerPays to your home screen for quick access and notifications. Works like a native app!
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:scale-95 transition"
              >
                ✨ Install Now
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 active:scale-95 transition"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
