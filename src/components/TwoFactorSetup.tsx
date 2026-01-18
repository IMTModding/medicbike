import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Shield, Copy, Check } from 'lucide-react';

interface TwoFactorSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const TwoFactorSetup = ({ open, onOpenChange, onSuccess }: TwoFactorSetupProps) => {
  const [step, setStep] = useState<'start' | 'verify'>('start');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'MEDICBIKE App'
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep('verify');
      }
    } catch (error: any) {
      console.error('Error enrolling MFA:', error);
      toast.error(error.message || 'Erreur lors de la configuration 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!factorId || verifyCode.length !== 6) return;

    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode
      });

      if (verifyError) throw verifyError;

      toast.success('Authentification à deux facteurs activée !');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error verifying MFA:', error);
      toast.error(error.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('start');
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setVerifyCode('');
    onOpenChange(false);
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Authentification à deux facteurs
          </DialogTitle>
          <DialogDescription>
            {step === 'start' 
              ? 'Renforcez la sécurité de votre compte avec un code TOTP'
              : 'Scannez le QR code avec votre application d\'authentification'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'start' ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">Comment ça fonctionne ?</h4>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li>1. Téléchargez une app d'authentification (Google Authenticator, Authy...)</li>
                <li>2. Scannez le QR code qui sera affiché</li>
                <li>3. Entrez le code à 6 chiffres pour vérifier</li>
              </ol>
            </div>

            <Button 
              onClick={handleEnroll} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Configuration...
                </>
              ) : (
                'Configurer 2FA'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {qrCode && (
              <div className="flex justify-center">
                <img 
                  src={qrCode} 
                  alt="QR Code 2FA" 
                  className="w-48 h-48 rounded-lg border border-border"
                />
              </div>
            )}

            {secret && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Clé secrète (si vous ne pouvez pas scanner) :</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all">{secret}</code>
                  <Button size="sm" variant="ghost" onClick={copySecret}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Code de vérification</label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <Button 
              onClick={handleVerify} 
              disabled={loading || verifyCode.length !== 6}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                'Vérifier et activer'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorSetup;
