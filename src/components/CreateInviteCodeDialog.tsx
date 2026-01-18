import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Loader2, Copy, Check, KeyRound } from 'lucide-react';

interface CreateInviteCodeDialogProps {
  onCodeCreated?: () => void;
  trigger?: React.ReactNode;
}

const CreateInviteCodeDialog = ({ onCodeCreated, trigger }: CreateInviteCodeDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationName.trim() || !user) {
      toast.error('Veuillez entrer un nom d\'organisation');
      return;
    }

    setLoading(true);

    try {
      // Generate code using database function
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_invite_code');
      
      if (codeError) {
        throw codeError;
      }
      
      // Insert the new invite code
      const { error } = await supabase
        .from('invite_codes')
        .insert({
          code: codeData,
          admin_id: user.id,
          organization_name: organizationName.trim(),
        });
      
      if (error) {
        throw error;
      }

      setCreatedCode(codeData);
      toast.success('Code d\'invitation créé !');
      onCodeCreated?.();

    } catch (error: any) {
      console.error('Error creating invite code:', error);
      toast.error('Erreur lors de la création du code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (createdCode) {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      toast.success('Code copié !');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setOrganizationName('');
    setCreatedCode(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetForm();
      }
      setOpen(isOpen);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <KeyRound className="w-4 h-4" />
            Créer un code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Créer un code d'invitation
          </DialogTitle>
          <DialogDescription>
            Créez un code pour permettre aux employés de rejoindre votre organisation.
          </DialogDescription>
        </DialogHeader>

        {createdCode ? (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/30 rounded-lg p-4">
              <p className="text-sm text-success font-medium mb-2">
                ✅ Code créé avec succès !
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                Partagez ce code avec vos employés :
              </p>
              <div className="flex items-center gap-2 bg-background rounded p-3">
                <p className="text-2xl font-bold font-mono tracking-wider flex-1 text-center">
                  {createdCode}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={handleCopyCode}
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-success" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>
              Fermer
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Nom de l'organisation
              </Label>
              <Input
                id="organizationName"
                placeholder="Ex: MedicBike Paris"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !organizationName.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Générer le code
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateInviteCodeDialog;
