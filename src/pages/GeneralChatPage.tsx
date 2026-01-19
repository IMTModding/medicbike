import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { sendChatNotification } from '@/services/pushNotifications';
import { Send, MessageCircle, ArrowLeft, Trash2, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Message {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profile?: {
    full_name: string | null;
  };
}

interface Profile {
  user_id: string;
  full_name: string | null;
}

const GeneralChatPage = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Get organization ID
  useEffect(() => {
    const fetchOrganization = async () => {
      if (!user) return;

      // Get current user's name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileData?.full_name) {
        setCurrentUserName(profileData.full_name);
      }

      if (isAdmin) {
        // Admin: get active invite code they created
        const { data } = await supabase
          .from('invite_codes')
          .select('id')
          .eq('admin_id', user.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (data) {
          setOrganizationId(data.id);
        }
      } else {
        // Employee: get their organization from profile
        const { data } = await supabase
          .from('profiles')
          .select('invite_code_id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data?.invite_code_id) {
          setOrganizationId(data.invite_code_id);
        }
      }
    };

    fetchOrganization();
  }, [user, isAdmin]);

  // Fetch messages and profiles
  useEffect(() => {
    if (!organizationId) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);

      const { data: messagesData, error } = await supabase
        .from('general_messages')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        setLoadingMessages(false);
        return;
      }

      // Fetch profiles for all unique user IDs
      const userIds = [...new Set((messagesData || []).map(m => m.user_id))];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const profileMap = new Map<string, string>();
        (profilesData || []).forEach(p => {
          profileMap.set(p.user_id, p.full_name || 'Utilisateur');
        });
        setProfiles(profileMap);
      }

      setMessages(messagesData || []);
      setLoadingMessages(false);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('general-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'general_messages',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          // Fetch profile if not already cached
          if (!profiles.has(newMsg.user_id)) {
            const { data } = await supabase
              .from('profiles')
              .select('user_id, full_name')
              .eq('user_id', newMsg.user_id)
              .maybeSingle();
            
            if (data) {
              setProfiles(prev => new Map(prev).set(data.user_id, data.full_name || 'Utilisateur'));
            }
          }

          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [organizationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user || !organizationId) return;

    const messageToSend = newMessage.trim();
    setSending(true);
    setNewMessage('');

    const { error } = await supabase
      .from('general_messages')
      .insert({
        user_id: user.id,
        message: messageToSend,
        organization_id: organizationId,
      });

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Erreur lors de l\'envoi');
      setNewMessage(messageToSend); // Restore message on error
    } else {
      // Send push notification to other users in the organization
      sendChatNotification(
        currentUserName || 'Nouveau message',
        messageToSend,
        organizationId,
        user.id
      );
    }

    setSending(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('general_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
      toast.error('Erreur lors de la suppression');
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message supprimé');
    }
    setMessageToDelete(null);
  };

  const startEditing = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.message);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleEditMessage = async () => {
    if (!editingMessageId || !editingText.trim()) return;

    const { error } = await supabase
      .from('general_messages')
      .update({ message: editingText.trim() })
      .eq('id', editingMessageId);

    if (error) {
      console.error('Error updating message:', error);
      toast.error('Erreur lors de la modification');
    } else {
      setMessages(prev => prev.map(m => 
        m.id === editingMessageId ? { ...m, message: editingText.trim() } : m
      ));
      toast.success('Message modifié');
    }
    cancelEditing();
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return format(date, 'HH:mm', { locale: fr });
    }
    return format(date, 'dd/MM HH:mm', { locale: fr });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!organizationId && !loadingMessages) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 pt-20">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Pas d'organisation</h2>
            <p className="text-muted-foreground mb-4">
              {isAdmin 
                ? 'Créez un code d\'invitation pour activer le chat'
                : 'Vous n\'êtes pas encore rattaché à une organisation'}
            </p>
            {isAdmin && (
              <Button onClick={() => navigate('/invite-codes')}>
                Créer un code d'invitation
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center gap-4 h-16 px-4">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">Chat général</h1>
              <p className="text-xs text-muted-foreground">
                {messages.length} message{messages.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-muted-foreground">Chargement...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun message</p>
            <p className="text-sm text-muted-foreground">Soyez le premier à écrire !</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {messages.map((msg, index) => {
              const isOwn = msg.user_id === user?.id;
              const showName = index === 0 || messages[index - 1].user_id !== msg.user_id;
              const senderName = profiles.get(msg.user_id) || 'Utilisateur';

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col",
                    isOwn ? "items-end" : "items-start"
                  )}
                >
                  {showName && !isOwn && (
                    <span className="text-xs text-muted-foreground ml-3 mb-1">
                      {senderName}
                    </span>
                  )}
                  {editingMessageId === msg.id ? (
                    <div className="flex items-center gap-2 max-w-[80%]">
                      <Input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="flex-1 text-sm h-9"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleEditMessage();
                          } else if (e.key === 'Escape') {
                            cancelEditing();
                          }
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleEditMessage}>
                        <Check className="w-4 h-4 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditing}>
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2 group relative",
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-secondary text-foreground rounded-bl-md"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      
                      {/* Edit button - only for own messages */}
                      {isOwn && (
                        <button
                          onClick={() => startEditing(msg)}
                          className={cn(
                            "absolute -top-2 -right-3 opacity-0 group-hover:opacity-100 transition-opacity",
                            "w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-accent"
                          )}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      
                      {/* Delete button - only for admins */}
                      {isAdmin && (
                        <button
                          onClick={() => setMessageToDelete(msg.id)}
                          className={cn(
                            "absolute -top-2 opacity-0 group-hover:opacity-100 transition-opacity",
                            "w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center",
                            isOwn ? "-left-3" : "-right-3"
                          )}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                  <span className={cn(
                    "text-xs text-muted-foreground mt-1",
                    isOwn ? "mr-1" : "ml-1"
                  )}>
                    {formatMessageTime(msg.created_at)}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <footer className="sticky bottom-0 bg-background border-t border-border p-4">
        <form onSubmit={handleSend} className="flex gap-2 max-w-2xl mx-auto">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrire un message..."
            className="flex-1 bg-secondary border-border"
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </footer>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!messageToDelete}
        onOpenChange={(open) => !open && setMessageToDelete(null)}
        title="Supprimer le message"
        description="Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={() => messageToDelete && handleDeleteMessage(messageToDelete)}
        variant="destructive"
      />
    </div>
  );
};

export default GeneralChatPage;
