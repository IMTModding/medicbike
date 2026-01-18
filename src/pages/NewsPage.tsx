import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Newspaper, Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { NewsCard } from '@/components/NewsCard';
import { CreateNewsDialog } from '@/components/CreateNewsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface News {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  admin_id: string;
}

const NewsPage = () => {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();

  const loadNews = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error('Error loading news:', error);
      toast.error('Erreur lors du chargement des actualités');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadNews();

      // Subscribe to realtime updates
      const channel = supabase
        .channel('news-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'news',
          },
          () => {
            loadNews();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [user, loadNews]);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette actualité ?')) return;

    setDeletingId(id);
    try {
      // Find the news item to get the image URL
      const newsItem = news.find(n => n.id === id);
      
      // Delete from database
      const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Try to delete image from storage if exists
      if (newsItem?.image_url) {
        const path = newsItem.image_url.split('/news/')[1];
        if (path) {
          await supabase.storage.from('news').remove([path]);
        }
      }

      toast.success('Actualité supprimée');
      setNews(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting news:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
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
      <Header />
      
      <main className="container px-4 py-6 pb-24">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-lg text-foreground">Actualités</h1>
            <p className="text-xs text-muted-foreground">
              {news.length} publication{news.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* News List */}
        <div className="space-y-4">
          {news.map(item => (
            <NewsCard
              key={item.id}
              id={item.id}
              title={item.title}
              content={item.content}
              imageUrl={item.image_url}
              createdAt={item.created_at}
              isAdmin={role === 'admin'}
              onDelete={handleDelete}
              deleting={deletingId === item.id}
            />
          ))}
        </div>

        {/* Empty State */}
        {news.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Newspaper className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Aucune actualité</h3>
            <p className="text-sm text-muted-foreground">
              {role === 'admin' 
                ? 'Publiez votre première actualité'
                : 'Aucune actualité pour le moment'}
            </p>
          </div>
        )}
      </main>

      {/* Admin: Create News Button */}
      {role === 'admin' && <CreateNewsDialog onCreated={loadNews} />}
    </div>
  );
};

export default NewsPage;
