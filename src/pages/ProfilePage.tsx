import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, User, Mail, Shield, Save, LogOut, Lock, Eye, EyeOff, Camera, Phone, KeyRound } from 'lucide-react';
import { useTwoFactor } from '@/hooks/useTwoFactor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');

const ProfilePage = () => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { isEnabled: is2FAEnabled } = useTwoFactor();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const [profileRes, contactsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('profile_contacts')
            .select('phone')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (profileRes.error) throw profileRes.error;
        // contacts row might not exist yet (PGRST116 = no rows)
        if (contactsRes.error && contactsRes.error.code !== 'PGRST116') throw contactsRes.error;

        if (profileRes.data) {
          setFullName(profileRes.data.full_name || '');
          setAvatarUrl(profileRes.data.avatar_url || null);
        }
        if (contactsRes.data) {
          setPhone(contactsRes.data.phone || '');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadProfile();
    }
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2 Mo');
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl + '?t=' + Date.now()); // Add cache buster
      toast.success('Photo de profil mise à jour');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const [profileUpdate, contactsUpsert] = await Promise.all([
        supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('user_id', user.id),
        supabase
          .from('profile_contacts')
          .upsert({ user_id: user.id, phone }, { onConflict: 'user_id' }),
      ]);

      if (profileUpdate.error) throw profileUpdate.error;
      if (contactsUpsert.error) throw contactsUpsert.error;

      toast.success('Profil mis à jour');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    // Validate new password
    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    // Check if MFA is enabled and AAL level
    if (is2FAEnabled) {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel !== 'aal2') {
        // Need to verify MFA first
        setMfaDialogOpen(true);
        return;
      }
    }

    await performPasswordChange();
  };

  const performPasswordChange = async () => {
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        if (error.message.includes('AAL2')) {
          toast.error('Veuillez vérifier votre 2FA avant de changer le mot de passe');
          setMfaDialogOpen(true);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Mot de passe mis à jour avec succès');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      toast.error('Erreur lors du changement de mot de passe');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleMfaVerify = async () => {
    if (mfaCode.length !== 6) return;

    setVerifyingMfa(true);
    try {
      // Get the TOTP factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      
      if (!totpFactor) {
        toast.error('Aucun facteur 2FA trouvé');
        return;
      }

      // Challenge and verify
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id
      });

      if (challengeError) {
        toast.error('Erreur lors de la vérification');
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: mfaCode
      });

      if (verifyError) {
        toast.error('Code invalide');
        return;
      }

      // MFA verified, now change password
      setMfaDialogOpen(false);
      setMfaCode('');
      await performPasswordChange();
    } catch (error) {
      toast.error('Erreur lors de la vérification 2FA');
    } finally {
      setVerifyingMfa(false);
    }
  };


  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-lg text-foreground">Mon Profil</h1>
              <p className="text-xs text-muted-foreground">Gérez vos informations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative w-24 h-24 rounded-full overflow-hidden group"
            >
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Photo de profil" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-warning flex items-center justify-center">
                  <User className="w-12 h-12 text-white" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Cliquez pour changer
          </p>
          <div className={cn(
            "text-xs font-medium px-3 py-1 rounded-full mt-2",
            isAdmin 
              ? "bg-primary/20 text-primary" 
              : "bg-secondary text-muted-foreground"
          )}>
            <Shield className="w-3 h-3 inline-block mr-1" />
            {isAdmin ? 'Administrateur' : 'Employé'}
          </div>
        </div>

        {/* Form */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div>
            <Label htmlFor="fullName" className="flex items-center gap-2 mb-1.5">
              <User className="w-4 h-4" />
              Nom complet
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Votre nom"
              className="bg-secondary"
            />
          </div>

          <div>
            <Label className="flex items-center gap-2 mb-1.5">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input
              value={user.email || ''}
              disabled
              className="bg-secondary opacity-60"
            />
            <p className="text-xs text-muted-foreground mt-1">
              L'email ne peut pas être modifié
            </p>
          </div>

          <div>
            <Label className="flex items-center gap-2 mb-1.5">
              <Phone className="w-4 h-4" />
              Téléphone
            </Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className="bg-secondary"
            />
          </div>

          <Button 
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Enregistrer
          </Button>
        </div>


        {/* Change Password */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Changer le mot de passe
          </h3>
          
          <div className="relative">
            <Label htmlFor="newPassword" className="mb-1.5 block text-sm">
              Nouveau mot de passe
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                className="bg-secondary pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="mb-1.5 block text-sm">
              Confirmer le mot de passe
            </Label>
            <Input
              id="confirmPassword"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Répétez le mot de passe"
              className="bg-secondary"
            />
          </div>

          <Button 
            onClick={handleChangePassword}
            disabled={changingPassword || !newPassword || !confirmPassword}
            variant="secondary"
            className="w-full gap-2"
          >
            {changingPassword ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            Mettre à jour le mot de passe
          </Button>
        </div>

        {/* Stats */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-medium text-foreground mb-4">Mes statistiques</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatItem label="Réponses" value="--" />
            <StatItem label="Disponibilités" value="--" />
          </div>
        </div>

        {/* Sign Out */}
        <Button 
          variant="destructive"
          onClick={handleSignOut}
          className="w-full gap-2"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </Button>
      </main>

      {/* MFA Verification Dialog */}
      <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Vérification 2FA requise
            </DialogTitle>
            <DialogDescription>
              Pour changer votre mot de passe, veuillez entrer le code de votre application d'authentification.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            <InputOTP
              value={mfaCode}
              onChange={setMfaCode}
              maxLength={6}
              onComplete={handleMfaVerify}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            
            <Button
              onClick={handleMfaVerify}
              disabled={mfaCode.length !== 6 || verifyingMfa}
              className="w-full"
            >
              {verifyingMfa ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Vérifier et changer le mot de passe
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatItem = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center">
    <p className="text-2xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

export default ProfilePage;
