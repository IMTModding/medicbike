import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound, Loader2, Copy, Check } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail?: string;
}

const ResetPasswordDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
}: ResetPasswordDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    setTempPassword(null);

    try {
      const response = await supabase.functions.invoke('reset-user-password', {
        body: { userId },
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.error) {
        throw new Error(response.error.message);
      }

      setTempPassword(response.data.tempPassword);
      toast.success('Mot de passe réinitialisé !');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = async () => {
    if (tempPassword) {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      toast.success('Mot de passe copié !');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyAll = async () => {
    if (tempPassword && userEmail) {
      const text = `Identifiants MedicBike\n\nEmail: ${userEmail}\nNouveau mot de passe: ${tempPassword}\n\n⚠️ Pensez à changer votre mot de passe après la connexion.`;
      await navigator.clipboard.writeText(text);
      toast.success('Identifiants copiés !');
    }
  };

  const handleClose = () => {
    setTempPassword(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !loading) {
        handleClose();
      }
    }}>
      <DialogContent 
        className="sm:max-w-md"
        onInteractOutside={(e) => {
          if (loading || tempPassword) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (loading || tempPassword) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Réinitialiser le mot de passe
          </DialogTitle>
          <DialogDescription>
            Créer un nouveau mot de passe temporaire pour <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border-2 border-green-500/50 rounded-lg p-4">
              <p className="text-lg text-green-600 dark:text-green-400 font-bold mb-1 flex items-center gap-2">
                ✅ Mot de passe réinitialisé !
              </p>
              <p className="text-sm text-muted-foreground">
                Transmettez le nouveau mot de passe à <strong>{userName}</strong> :
              </p>
            </div>

            <div className="space-y-3">
              {/* Email section */}
              {userEmail && (
                <div className="bg-muted rounded-lg p-4 border">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Email de connexion</Label>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-base font-semibold">{userEmail}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={async () => {
                        await navigator.clipboard.writeText(userEmail);
                        toast.success('Email copié !');
                      }}
                    >
                      <Copy className="w-3 h-3" />
                      Copier
                    </Button>
                  </div>
                </div>
              )}

              {/* Password section */}
              <div className="bg-primary/10 rounded-lg p-4 border-2 border-primary/30">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nouveau mot de passe</Label>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-xl font-bold text-primary">{tempPassword}</span>
                  <Button
                    variant={copied ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    onClick={handleCopyPassword}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copier
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Copy all button */}
              {userEmail && (
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={handleCopyAll}
                >
                  <Copy className="w-4 h-4" />
                  Copier tous les identifiants
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              ⚠️ L'ancien mot de passe ne fonctionne plus.
            </p>

            <Button className="w-full" onClick={handleClose}>
              Terminé
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <p className="text-sm text-warning font-medium mb-2">
                ⚠️ Attention
              </p>
              <p className="text-sm text-muted-foreground">
                Cette action va créer un nouveau mot de passe temporaire. L'ancien mot de passe de <strong>{userName}</strong> ne fonctionnera plus.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleReset}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Réinitialisation...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Réinitialiser
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordDialog;
