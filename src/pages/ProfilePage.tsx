import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, User, Mail, Shield, Save, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ProfilePage = () => {
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
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
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setFullName(data.full_name || '');
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

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Profil mis à jour');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
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
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-warning flex items-center justify-center mb-4">
            <User className="w-12 h-12 text-white" />
          </div>
          <div className={cn(
            "text-xs font-medium px-3 py-1 rounded-full",
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
