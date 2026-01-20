import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, Shield, Settings, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

interface ConsentPreferences {
  essential: boolean;
  analytics: boolean;
  notifications: boolean;
  geolocation: boolean;
  timestamp: string;
}

const CONSENT_STORAGE_KEY = "medicbike_consent";

export const CookieConsentBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    essential: true,
    analytics: false,
    notifications: false,
    geolocation: false,
    timestamp: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) {
      // Small delay to not show immediately on page load
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (prefs: ConsentPreferences) => {
    const consentData = {
      ...prefs,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentData));
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleAcceptAll = () => {
    saveConsent({
      essential: true,
      analytics: true,
      notifications: true,
      geolocation: true,
      timestamp: "",
    });
  };

  const handleRejectAll = () => {
    saveConsent({
      essential: true,
      analytics: false,
      notifications: false,
      geolocation: false,
      timestamp: "",
    });
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
  };

  const handleViewPrivacyPolicy = () => {
    navigate("/privacy");
  };

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[100] p-4 safe-area-bottom"
          >
            <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full flex-shrink-0">
                    <Cookie className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 sm:hidden">
                      <Cookie className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-base">Protection de vos données</h3>
                    </div>
                    <h3 className="hidden sm:block font-semibold text-lg">
                      Protection de vos données
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Nous utilisons des cookies et des technologies similaires pour améliorer votre expérience.
                      Certains sont essentiels au fonctionnement de l'application, d'autres nous aident à
                      améliorer nos services.
                    </p>
                    <button
                      onClick={handleViewPrivacyPolicy}
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Shield className="h-3 w-3" />
                      Lire notre politique de confidentialité
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none order-3 sm:order-1"
                    onClick={handleRejectAll}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Refuser tout
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none order-2"
                    onClick={() => setShowSettings(true)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Personnaliser
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-none order-1 sm:order-3"
                    onClick={handleAcceptAll}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Accepter tout
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Préférences de confidentialité
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Essential - always on */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium">Cookies essentiels</Label>
                <p className="text-xs text-muted-foreground">
                  Nécessaires au fonctionnement de l'application
                </p>
              </div>
              <Switch checked disabled className="data-[state=checked]:bg-primary" />
            </div>

            {/* Analytics */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium">Analytiques</Label>
                <p className="text-xs text-muted-foreground">
                  Nous aident à améliorer l'application
                </p>
              </div>
              <Switch
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, analytics: checked }))
                }
              />
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium">Notifications push</Label>
                <p className="text-xs text-muted-foreground">
                  Alertes d'interventions et messages
                </p>
              </div>
              <Switch
                checked={preferences.notifications}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, notifications: checked }))
                }
              />
            </div>

            {/* Geolocation */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium">Géolocalisation</Label>
                <p className="text-xs text-muted-foreground">
                  Position pendant les interventions
                </p>
              </div>
              <Switch
                checked={preferences.geolocation}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, geolocation: checked }))
                }
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowSettings(false)}>
              Annuler
            </Button>
            <Button className="flex-1" onClick={handleSavePreferences}>
              Enregistrer mes choix
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Helper hook to check consent
export const useConsentPreferences = (): ConsentPreferences | null => {
  const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

// Helper to check specific consent
export const hasConsent = (type: keyof Omit<ConsentPreferences, "timestamp">): boolean => {
  const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (!stored) return false;
  try {
    const prefs = JSON.parse(stored) as ConsentPreferences;
    return prefs[type] === true;
  } catch {
    return false;
  }
};

export default CookieConsentBanner;
