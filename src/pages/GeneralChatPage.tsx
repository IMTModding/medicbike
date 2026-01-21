import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { sendChatNotification } from '@/services/pushNotifications';
import { Send, MessageCircle, ArrowLeft, Trash2, Pencil, Check, X, Reply, XCircle } from 'lucide-react';
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
  reply_to_id?: string | null;
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
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const { data: messagesData, error } = await supabase
        .from('general_messages')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
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

    // Subscribe to messages (INSERT, UPDATE, DELETE)
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'general_messages',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'general_messages',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      )
      .subscribe();

    // Refresh messages when app comes back to foreground (mobile)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also refresh on window focus (desktop)
    const handleFocus = () => {
      fetchMessages();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      channel.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [organizationId, profiles]);

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
        reply_to_id: replyingTo?.id || null,
      });

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Erreur lors de l\'envoi');
      setNewMessage(messageToSend); // Restore message on error
    } else {
      // Send push notification to ALL users in the organization (including sender for testing)
      setReplyingTo(null);
      sendChatNotification(
        currentUserName || 'Nouveau message',
        messageToSend,
        organizationId
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

  const handleMessagePress = (msgId: string) => {
    // Toggle selection on tap for mobile
    setSelectedMessageId(prev => prev === msgId ? null : msgId);
  };

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
    setSelectedMessageId(null);
    inputRef.current?.focus();
  };

  const getReplyMessage = (replyToId: string | null | undefined): Message | undefined => {
    if (!replyToId) return undefined;
    return messages.find(m => m.id === replyToId);
  };

  const handleLongPressStart = (msg: Message) => {
    longPressTimer.current = setTimeout(() => {
      if (msg.user_id === user?.id) {
        startEditing(msg);
      }
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
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
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-background/80 backdrop-blur-lg border-b border-border z-10">
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
      <main className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
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
              const replyMessage = getReplyMessage(msg.reply_to_id);
              const replySenderName = replyMessage ? profiles.get(replyMessage.user_id) || 'Utilisateur' : '';

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col w-full",
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
                    <div className="flex flex-col max-w-[80%]">
                      {/* Reply preview */}
                      {replyMessage && (
                        <div 
                          className={cn(
                            "text-xs px-3 py-1.5 mb-1 rounded-t-lg border-l-2 cursor-pointer",
                            isOwn 
                              ? "bg-primary/20 border-primary-foreground/50 text-primary-foreground/80" 
                              : "bg-muted border-primary text-muted-foreground"
                          )}
                          onClick={() => {
                            document.getElementById(`msg-${replyMessage.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                        >
                          <span className="font-medium">{replySenderName}</span>
                          <p className="truncate">{replyMessage.message}</p>
                        </div>
                      )}
                      <div
                        id={`msg-${msg.id}`}
                        className={cn(
                          "rounded-2xl px-4 py-2 group relative",
                          isOwn
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-secondary text-foreground rounded-bl-md",
                          replyMessage && "rounded-t-md"
                        )}
                        onClick={() => handleMessagePress(msg.id)}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        
                        {/* Desktop: buttons visible on hover */}
                        <div className={cn(
                          "absolute -top-2 flex gap-1 transition-opacity",
                          isOwn ? "-left-24" : "-right-24",
                          "opacity-0 group-hover:opacity-100 max-md:hidden"
                        )}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReply(msg);
                            }}
                            className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-accent"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          {isOwn && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(msg);
                              }}
                              className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-accent"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMessageToDelete(msg.id);
                              }}
                              className="w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Mobile: action buttons below message when selected */}
                      {selectedMessageId === msg.id && (
                        <div className={cn(
                          "flex gap-2 mt-2 md:hidden flex-wrap",
                          isOwn ? "justify-end" : "justify-start"
                        )}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReply(msg);
                            }}
                          >
                            <Reply className="w-3.5 h-3.5" />
                            Répondre
                          </Button>
                          {isOwn && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(msg);
                                setSelectedMessageId(null);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Modifier
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 gap-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMessageToDelete(msg.id);
                                setSelectedMessageId(null);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Supprimer
                            </Button>
                          )}
                        </div>
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
      <footer className="flex-shrink-0 bg-background border-t border-border pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* Reply preview */}
        {replyingTo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b border-border">
            <Reply className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">
                {profiles.get(replyingTo.user_id) || 'Utilisateur'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{replyingTo.message}</p>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:bg-accent rounded-full"
            >
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-2 max-w-2xl mx-auto p-4">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={replyingTo ? "Répondre..." : "Écrire un message..."}
            className="flex-1 bg-secondary border-border text-base"
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
