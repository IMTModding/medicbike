import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Loader2, Mail, User, Shield, Copy, Check } from 'lucide-react';

interface InviteCode {
  id: string;
  code: string;
  organization_name: string;
}

interface InviteUserDialogProps {
  onUserInvited?: () => void;
}

const InviteUserDialog = ({ onUserInvited }: InviteUserDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [selectedInviteCode, setSelectedInviteCode] = useState<string>('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchInviteCodes();
    }
  }, [open, user]);

  const fetchInviteCodes = async () => {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('id, code, organization_name')
      .eq('is_active', true);

    if (!error && data) {
      setInviteCodes(data);
      if (data.length > 0) {
        setSelectedInviteCode(data[0].id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !fullName.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (role === 'employee' && !selectedInviteCode) {
      toast.error('Veuillez sélectionner une organisation');
      return;
    }

    setLoading(true);
    setTempPassword(null);

    try {
      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: email.trim(),
          fullName: fullName.trim(),
          role,
          inviteCodeId: role === 'employee' ? selectedInviteCode : undefined,
        },
      });

      // Check for error in response data first (custom error messages from edge function)
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Then check for generic function invoke error
      if (response.error) {
        // Try to parse the error context for a more specific message
        const errorMessage = response.error.message || 'Erreur lors de l\'invitation';
        throw new Error(errorMessage);
      }

      // If tempPassword is returned (email not configured), show it
      if (response.data?.tempPassword) {
        setTempPassword(response.data.tempPassword);
        toast.success('Utilisateur créé ! Notez le mot de passe temporaire.');
      } else {
        toast.success('Invitation envoyée par email !');
        resetForm();
        setOpen(false);
      }

      onUserInvited?.();

    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error(error.message || 'Erreur lors de l\'invitation');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setRole('employee');
    setTempPassword(null);
    setCopied(false);
  };

  const handleCopyPassword = async () => {
    if (tempPassword) {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      toast.success('Mot de passe copié !');
      setTimeout(() => setCopied(false), 2000);
    }
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
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Inviter un utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Inviter un utilisateur
          </DialogTitle>
          <DialogDescription>
            Créez un compte pour un nouvel utilisateur. Il recevra ses identifiants par email.
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <p className="text-sm text-warning font-medium mb-2">
                ⚠️ L'email n'a pas pu être envoyé
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                Transmettez manuellement ces identifiants à l'utilisateur :
              </p>
              <div className="space-y-2 bg-background rounded p-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Email :</span>{' '}
                  <strong>{email}</strong>
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm flex-1">
                    <span className="text-muted-foreground">Mot de passe :</span>{' '}
                    <strong className="font-mono">{tempPassword}</strong>
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCopyPassword}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>
              Fermer
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nom complet
              </Label>
              <Input
                id="fullName"
                placeholder="Jean Dupont"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="jean@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Rôle
              </Label>
              <Select
                value={role}
                onValueChange={(value: 'admin' | 'employee') => setRole(value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employé</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === 'employee' && inviteCodes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="organization">Organisation</Label>
                <Select
                  value={selectedInviteCode}
                  onValueChange={setSelectedInviteCode}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {inviteCodes.map((code) => (
                      <SelectItem key={code.id} value={code.id}>
                        {code.organization_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {role === 'employee' && inviteCodes.length === 0 && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                Vous devez d'abord créer un code d'invitation pour ajouter des employés.
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || (role === 'employee' && inviteCodes.length === 0)}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Envoyer l'invitation
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InviteUserDialog;
