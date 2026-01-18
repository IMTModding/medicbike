import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PWAUpdateBanner = () => {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (registration) {
          // Check if there's already a waiting worker
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setShowUpdateBanner(true);
          }

          // Listen for new updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setWaitingWorker(newWorker);
                  setShowUpdateBanner(true);
                }
              });
            }
          });
        }

        // Listen for controller change (when update is activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      } catch (error) {
        console.error('Error checking for SW updates:', error);
      }
    };

    checkForUpdates();

    // Check for updates periodically (every 30 minutes)
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then(reg => {
        reg?.update();
      });
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback: force reload
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdateBanner(false);
  };

  if (!showUpdateBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-fade-in">
      <div className="bg-primary text-primary-foreground rounded-xl p-4 shadow-lg border border-primary-foreground/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Nouvelle version disponible</p>
            <p className="text-xs opacity-80 mt-0.5">
              Mettez à jour pour profiter des dernières améliorations
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-primary-foreground/20 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            onClick={handleUpdate}
            size="sm"
            variant="secondary"
            className="flex-1 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Mettre à jour
          </Button>
          <Button
            onClick={handleDismiss}
            size="sm"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
};
