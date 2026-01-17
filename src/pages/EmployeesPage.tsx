import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, Trash2, Mail, Building2, Calendar, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Employee {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
  invite_code_id: string | null;
  organization_name?: string;
  email?: string;
}

const EmployeesPage = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchEmployees();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredEmployees(employees);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredEmployees(
        employees.filter(
          (emp) =>
            emp.full_name?.toLowerCase().includes(query) ||
            emp.email?.toLowerCase().includes(query) ||
            emp.organization_name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, employees]);

  const fetchEmployees = async () => {
    if (!user) return;

    setLoadingEmployees(true);

    // First, get all invite codes created by this admin
    const { data: codes, error: codesError } = await supabase
      .from('invite_codes')
      .select('id, organization_name')
      .eq('admin_id', user.id);

    if (codesError) {
      console.error('Error fetching codes:', codesError);
      setLoadingEmployees(false);
      return;
    }

    if (!codes || codes.length === 0) {
      setEmployees([]);
      setFilteredEmployees([]);
      setLoadingEmployees(false);
      return;
    }

    const codeIds = codes.map((c) => c.id);
    const codeMap = new Map(codes.map((c) => [c.id, c.organization_name]));

    // Fetch profiles linked to these invite codes
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('invite_code_id', codeIds)
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoadingEmployees(false);
      return;
    }

    // Fetch user emails from auth (we need to use an edge function or store emails differently)
    // For now, we'll show profiles without emails
    const employeesData: Employee[] = (profiles || []).map((profile) => ({
      id: profile.id,
      user_id: profile.user_id,
      full_name: profile.full_name,
      created_at: profile.created_at,
      invite_code_id: profile.invite_code_id,
      organization_name: profile.invite_code_id
        ? codeMap.get(profile.invite_code_id)
        : undefined,
    }));

    setEmployees(employeesData);
    setFilteredEmployees(employeesData);
    setLoadingEmployees(false);
  };

  const handleRemoveEmployee = async (employeeId: string, userId: string) => {
    setDeletingId(employeeId);

    try {
      // Remove the link to the organization (don't delete the profile entirely)
      const { error } = await supabase
        .from('profiles')
        .update({ invite_code_id: null, admin_id: null })
        .eq('id', employeeId);

      if (error) throw error;

      toast.success('Employé retiré de l\'organisation');
      fetchEmployees();
    } catch (error) {
      console.error('Error removing employee:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || loadingEmployees) {
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
          <h1 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Mes employés
          </h1>
          <p className="text-muted-foreground text-sm">
            {employees.length} employé{employees.length > 1 ? 's' : ''} dans votre organisation
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou organisation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

        {/* Employees list */}
        <div className="space-y-3">
          {filteredEmployees.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <UserX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">
                  {searchQuery ? 'Aucun résultat' : 'Aucun employé'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'Essayez avec d\'autres termes de recherche'
                    : 'Partagez vos codes d\'invitation pour ajouter des employés'}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate('/invite-codes')}
                  >
                    Gérer les codes d'invitation
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredEmployees.map((employee) => (
              <Card key={employee.id} className="bg-card border-border">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                          {employee.full_name || 'Sans nom'}
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          Employé
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {employee.organization_name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {employee.organization_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Inscrit le{' '}
                          {format(new Date(employee.created_at), 'dd MMM yyyy', {
                            locale: fr,
                          })}
                        </span>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={deletingId === employee.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Retirer cet employé ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {employee.full_name || 'Cet employé'} sera retiré de votre
                            organisation. Il pourra toujours accéder à son compte mais ne
                            sera plus lié à vos interventions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleRemoveEmployee(employee.id, employee.user_id)
                            }
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Retirer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

export default EmployeesPage;
