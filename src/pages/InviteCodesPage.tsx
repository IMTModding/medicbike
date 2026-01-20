import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Copy, Users, Building2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteCode {
  id: string;
  code: string;
  organization_name: string;
  is_active: boolean;
  created_at: string;
  employee_count?: number;
}

const InviteCodesPage = () => {
  const { user, isAdmin, isCreator, role, loading } = useAuth();
  const navigate = useNavigate();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (role === null) return;
    if (!isAdmin && !isCreator) {
      navigate('/');
    }
  }, [user, isAdmin, isCreator, role, loading, navigate]);

  useEffect(() => {
    if (loading) return;
    if (user && (isAdmin || isCreator)) {
      fetchCodes();
    }
  }, [user, isAdmin, isCreator, loading]);

  const fetchCodes = async () => {
    if (!user) return;
    
    setLoadingCodes(true);
    
    // Fetch codes created by this admin
    const { data: codesData, error } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('admin_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching codes:', error);
      setLoadingCodes(false);
      return;
    }
    
    // Fetch employee counts for each code
    const codesWithCounts = await Promise.all(
      (codesData || []).map(async (code) => {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('invite_code_id', code.id);
        
        return {
          ...code,
          employee_count: count || 0,
        };
      })
    );
    
    setCodes(codesWithCounts);
    setLoadingCodes(false);
  };

  const generateCode = async () => {
    if (!newOrgName.trim() || !user) {
      toast.error('Veuillez entrer un nom d\'organisation');
      return;
    }
    
    setCreating(true);
    
    // Generate code using database function
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_invite_code');
    
    if (codeError) {
      console.error('Error generating code:', codeError);
      toast.error('Erreur lors de la génération du code');
      setCreating(false);
      return;
    }
    
    // Insert the new invite code
    const { error } = await supabase
      .from('invite_codes')
      .insert({
        code: codeData,
        admin_id: user.id,
        organization_name: newOrgName.trim(),
      });
    
    if (error) {
      console.error('Error creating invite code:', error);
      toast.error('Erreur lors de la création du code');
    } else {
      toast.success('Code d\'invitation créé !');
      setNewOrgName('');
      fetchCodes();
    }
    
    setCreating(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copié !');
  };

  const toggleCodeStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('invite_codes')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    
    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      toast.success(currentStatus ? 'Code désactivé' : 'Code réactivé');
      fetchCodes();
    }
  };

  if (loading || loadingCodes) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <main className="container mx-auto px-4 pt-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Codes d'invitation</h1>
          <p className="text-muted-foreground text-sm">
            Gérez les codes pour vos employés
          </p>
        </div>

        {/* Create new code */}
        <Card className="mb-6 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nouveau code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Nom de l'organisation"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="bg-secondary border-border"
              />
              <Button onClick={generateCode} disabled={creating}>
                {creating ? '...' : 'Générer'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Codes list */}
        <div className="space-y-3">
          {codes.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucun code d'invitation créé
              </CardContent>
            </Card>
          ) : (
            codes.map((code) => (
              <Card key={code.id} className="bg-card border-border">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-lg font-bold text-primary">
                          {code.code}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyCode(code.code)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Badge variant={code.is_active ? 'default' : 'secondary'}>
                          {code.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {code.organization_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {code.employee_count} employé(s)
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCodeStatus(code.id, code.is_active)}
                    >
                      {code.is_active ? 'Désactiver' : 'Réactiver'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default InviteCodesPage;
