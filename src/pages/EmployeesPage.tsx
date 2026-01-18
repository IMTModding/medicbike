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
import { Users, Search, Trash2, Building2, Calendar, UserX, Circle, Clock, User, Phone, MessageSquare, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import InviteUserDialog from '@/components/InviteUserDialog';

interface Employee {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  invite_code_id: string | null;
  organization_name?: string;
  email?: string;
}

interface PresenceState {
  [key: string]: { user_id: string; online_at: string }[];
}

interface Availability {
  user_id: string;
  start_time: string;
  end_time: string;
}

const EmployeesPage = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [todayAvailabilities, setTodayAvailabilities] = useState<Map<string, Availability>>(new Map());

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
      fetchTodayAvailabilities();
    }
  }, [user, isAdmin]);

  // Real-time presence tracking
  useEffect(() => {
    if (!user || !isAdmin) return;

    const channel = supabase.channel('employees-presence');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as PresenceState;
        const online = new Set<string>();
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.user_id) {
              online.add(presence.user_id);
            }
          });
        });
        
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
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

  const fetchTodayAvailabilities = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('availabilities')
      .select('user_id, start_time, end_time')
      .eq('date', today);

    if (error) {
      console.error('Error fetching availabilities:', error);
      return;
    }

    const availMap = new Map<string, Availability>();
    (data || []).forEach((av) => {
      availMap.set(av.user_id, av);
    });
    
    setTodayAvailabilities(availMap);
  };

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

    const codeMap = new Map(codes.map((c) => [c.id, c.organization_name]));

    // Use secure function to fetch profiles with proper phone visibility
    const { data: profiles, error: profilesError } = await supabase
      .rpc('get_organization_profiles', { p_user_id: user.id });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoadingEmployees(false);
      return;
    }

    const employeesData: Employee[] = (profiles || []).map((profile: any) => ({
      id: profile.id,
      user_id: profile.user_id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      phone: profile.phone, // Now properly filtered by the secure function
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

  const getEmployeeStatus = (userId: string) => {
    const isOnline = onlineUsers.has(userId);
    const availability = todayAvailabilities.get(userId);
    
    if (isOnline) {
      return { label: 'En ligne', color: 'bg-green-500', textColor: 'text-green-500' };
    }
    
    if (availability) {
      const now = new Date();
      const [startH, startM] = availability.start_time.split(':').map(Number);
      const [endH, endM] = availability.end_time.split(':').map(Number);
      
      const startTime = new Date();
      startTime.setHours(startH, startM, 0);
      
      const endTime = new Date();
      endTime.setHours(endH, endM, 0);
      
      if (now >= startTime && now <= endTime) {
        return { 
          label: `Dispo ${availability.start_time.slice(0,5)}-${availability.end_time.slice(0,5)}`, 
          color: 'bg-blue-500', 
          textColor: 'text-blue-500' 
        };
      }
      
      return { 
        label: `Prévu ${availability.start_time.slice(0,5)}-${availability.end_time.slice(0,5)}`, 
        color: 'bg-yellow-500', 
        textColor: 'text-yellow-500' 
      };
    }
    
    return { label: 'Hors ligne', color: 'bg-muted-foreground', textColor: 'text-muted-foreground' };
  };

  if (loading || loadingEmployees) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  // Count stats
  const onlineCount = employees.filter(e => onlineUsers.has(e.user_id)).length;
  const availableCount = employees.filter(e => {
    const av = todayAvailabilities.get(e.user_id);
    if (!av) return false;
    const now = new Date();
    const [startH, startM] = av.start_time.split(':').map(Number);
    const [endH, endM] = av.end_time.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(startH, startM, 0);
    const endTime = new Date();
    endTime.setHours(endH, endM, 0);
    return now >= startTime && now <= endTime;
  }).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="container mx-auto px-4 pt-20">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Mes employés
            </h1>
            <p className="text-muted-foreground text-sm">
              {employees.length} employé{employees.length > 1 ? 's' : ''} dans votre organisation
            </p>
          </div>
          <InviteUserDialog onUserInvited={fetchEmployees} />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-card border-border">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-xl font-bold text-foreground">{employees.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Circle className="w-4 h-4 text-green-500 fill-green-500" />
                <span className="text-xs text-muted-foreground">En ligne</span>
              </div>
              <p className="text-xl font-bold text-green-500">{onlineCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Dispo</span>
              </div>
              <p className="text-xl font-bold text-blue-500">{availableCount}</p>
            </CardContent>
          </Card>
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
            filteredEmployees.map((employee) => {
              const status = getEmployeeStatus(employee.user_id);
              
              return (
                <Card key={employee.id} className="bg-card border-border">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-warning flex items-center justify-center overflow-hidden mr-3 flex-shrink-0">
                        {employee.avatar_url ? (
                          <img 
                            src={employee.avatar_url} 
                            alt={employee.full_name || 'Avatar'} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {/* Online indicator */}
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            status.color
                          )} />
                          <h3 className="font-semibold text-foreground truncate">
                            {employee.full_name || 'Sans nom'}
                          </h3>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", status.textColor)}
                          >
                            {status.label}
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

                      {/* Contact buttons */}
                      <div className="flex items-center gap-1">
                        {employee.phone && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                              onClick={() => window.open(`tel:${employee.phone}`, '_self')}
                              title="Appeler"
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              onClick={() => window.open(`sms:${employee.phone}`, '_self')}
                              title="Envoyer un SMS"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </>
                        )}
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
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default EmployeesPage;
