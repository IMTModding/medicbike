import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  intervention_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profile?: { full_name: string | null };
}

interface Intervention {
  id: string;
  title: string;
  status: string;
}

const ChatPage = () => {
  const { interventionId } = useParams<{ interventionId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const loadData = async () => {
      if (!interventionId) return;

      try {
        // Load intervention
        const { data: intData, error: intError } = await supabase
          .from('interventions')
          .select('id, title, status')
          .eq('id', interventionId)
          .single();

        if (intError) throw intError;
        setIntervention(intData);

        // Load messages with profiles
        const { data: msgData, error: msgError } = await supabase
          .from('intervention_messages')
          .select(`
            *,
            profile:user_id(full_name)
          `)
          .eq('intervention_id', interventionId)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;
        
        const formattedMessages = (msgData || []).map(msg => ({
          ...msg,
          profile: Array.isArray(msg.profile) ? msg.profile[0] : msg.profile
        }));
        
        setMessages(formattedMessages);
      } catch (error) {
        console.error('Error loading chat:', error);
        toast.error('Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    if (user && interventionId) {
      loadData();
    }
  }, [user, interventionId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!interventionId) return;

    const channel = supabase
      .channel(`chat-${interventionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'intervention_messages',
          filter: `intervention_id=eq.${interventionId}`
        },
        async (payload) => {
          // Fetch the profile for the new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', payload.new.user_id)
            .maybeSingle();

          const newMsg: Message = {
            ...payload.new as Message,
            profile: profile || null
          };
          
          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [interventionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !interventionId || !newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('intervention_messages')
        .insert({
          intervention_id: interventionId,
          user_id: user.id,
          message: newMessage.trim()
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user || !intervention) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center h-16 px-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors mr-4"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-foreground truncate">{intervention.title}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {messages.length} message(s)
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Aucun message</h3>
            <p className="text-sm text-muted-foreground">
              Soyez le premier à envoyer un message
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === user.id;
            
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  isOwn ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2",
                  isOwn 
                    ? "bg-primary text-primary-foreground rounded-br-sm" 
                    : "bg-card border border-border rounded-bl-sm"
                )}>
                  {!isOwn && (
                    <p className="text-xs font-medium text-primary mb-1">
                      {msg.profile?.full_name || 'Utilisateur'}
                    </p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p className={cn(
                    "text-[10px] mt-1",
                    isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form 
        onSubmit={handleSendMessage}
        className="sticky bottom-0 bg-background border-t border-border p-4"
      >
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrire un message..."
            className="flex-1 bg-secondary"
            disabled={sending}
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={sending || !newMessage.trim()}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatPage;
