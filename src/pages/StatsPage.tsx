import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, BarChart3, TrendingUp, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Stats {
  totalInterventions: number;
  completedInterventions: number;
  activeInterventions: number;
  totalResponses: number;
  availableResponses: number;
  urgencyDistribution: { name: string; value: number; color: string }[];
  dailyInterventions: { date: string; count: number }[];
  responseRate: number;
}

const COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e'
};

const StatsPage = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Fetch all interventions
        const { data: interventions, error: intError } = await supabase
          .from('interventions')
          .select('*');

        if (intError) throw intError;

        // Fetch all responses
        const { data: responses, error: respError } = await supabase
          .from('intervention_responses')
          .select('*');

        if (respError) throw respError;

        const allInterventions = interventions || [];
        const allResponses = responses || [];

        // Calculate stats
        const totalInterventions = allInterventions.length;
        const completedInterventions = allInterventions.filter(i => i.status === 'completed').length;
        const activeInterventions = allInterventions.filter(i => i.status === 'active').length;
        
        const totalResponses = allResponses.length;
        const availableResponses = allResponses.filter(r => r.status === 'available').length;
        const responseRate = totalResponses > 0 ? Math.round((availableResponses / totalResponses) * 100) : 0;

        // Urgency distribution
        const highCount = allInterventions.filter(i => i.urgency === 'high').length;
        const mediumCount = allInterventions.filter(i => i.urgency === 'medium').length;
        const lowCount = allInterventions.filter(i => i.urgency === 'low').length;
        
        const urgencyDistribution = [
          { name: 'Urgent', value: highCount, color: COLORS.high },
          { name: 'Moyen', value: mediumCount, color: COLORS.medium },
          { name: 'Normal', value: lowCount, color: COLORS.low }
        ];

        // Daily interventions (last 30 days)
        const last30Days = eachDayOfInterval({
          start: subDays(new Date(), 29),
          end: new Date()
        });

        const dailyInterventions = last30Days.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const count = allInterventions.filter(i => 
            format(new Date(i.created_at), 'yyyy-MM-dd') === dayStr
          ).length;
          return {
            date: format(day, 'dd/MM', { locale: fr }),
            count
          };
        });

        setStats({
          totalInterventions,
          completedInterventions,
          activeInterventions,
          totalResponses,
          availableResponses,
          urgencyDistribution,
          dailyInterventions,
          responseRate
        });
      } catch (error) {
        console.error('Error loading stats:', error);
        toast.error('Erreur lors du chargement des statistiques');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadStats();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user || !stats) {
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
              <h1 className="font-bold text-lg text-foreground">Statistiques</h1>
              <p className="text-xs text-muted-foreground">Tableau de bord</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalInterventions}</p>
            <p className="text-xs text-muted-foreground">Total interventions</p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.completedInterventions}</p>
            <p className="text-xs text-muted-foreground">Terminées</p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.activeInterventions}</p>
            <p className="text-xs text-muted-foreground">En cours</p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <Users className="w-5 h-5 text-foreground" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.responseRate}%</p>
            <p className="text-xs text-muted-foreground">Taux de disponibilité</p>
          </div>
        </div>

        {/* Urgency Distribution */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Répartition par urgence</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.urgencyDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {stats.urgencyDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Interventions Chart */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Interventions (30 derniers jours)</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyInterventions}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  interval={4}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Summary */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Résumé des réponses</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total réponses</span>
              <span className="font-semibold text-foreground">{stats.totalResponses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Disponibles</span>
              <span className="font-semibold text-success">{stats.availableResponses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Indisponibles</span>
              <span className="font-semibold text-muted-foreground">{stats.totalResponses - stats.availableResponses}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden mt-2">
              <div 
                className="h-full bg-success transition-all"
                style={{ width: `${stats.responseRate}%` }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StatsPage;
