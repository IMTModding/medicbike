import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewsCardProps {
  id: string;
  title: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  deleting?: boolean;
}

export const NewsCard = ({
  id,
  title,
  content,
  imageUrl,
  createdAt,
  isAdmin = false,
  onDelete,
  onEdit,
  deleting = false,
}: NewsCardProps) => {
  const formattedDate = format(new Date(createdAt), "d MMMM yyyy 'à' HH:mm", { locale: fr });

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {imageUrl && (
        <div className="relative aspect-video w-full">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => onEdit(id)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(id)}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
        
        {content && (
          <p className="text-muted-foreground text-sm mt-2 whitespace-pre-wrap">
            {content}
          </p>
        )}
        
        <p className="text-xs text-muted-foreground mt-3">{formattedDate}</p>
      </div>
    </div>
  );
};
