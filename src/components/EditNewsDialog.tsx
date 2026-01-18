import { useState, useRef, useEffect } from 'react';
import { ImagePlus, X, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface EditNewsDialogProps {
  news: {
    id: string;
    title: string;
    content: string | null;
    image_url: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export const EditNewsDialog = ({ news, open, onOpenChange, onUpdated }: EditNewsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(news.title);
  const [content, setContent] = useState(news.content || '');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(news.image_url);
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      setTitle(news.title);
      setContent(news.content || '');
      setImagePreview(news.image_url);
      setSelectedImage(null);
      setRemoveCurrentImage(false);
    }
  }, [open, news]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('L\'image ne doit pas dépasser 5 Mo');
        return;
      }
      setSelectedImage(file);
      setRemoveCurrentImage(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setRemoveCurrentImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setLoading(true);
    try {
      let imageUrl: string | null = news.image_url;

      // Handle image changes
      if (removeCurrentImage && news.image_url) {
        // Delete old image from storage
        const oldPath = news.image_url.split('/news/')[1];
        if (oldPath) {
          await supabase.storage.from('news').remove([oldPath]);
        }
        imageUrl = null;
      }

      if (selectedImage) {
        // Delete old image if exists
        if (news.image_url) {
          const oldPath = news.image_url.split('/news/')[1];
          if (oldPath) {
            await supabase.storage.from('news').remove([oldPath]);
          }
        }

        // Upload new image
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('news')
          .upload(filePath, selectedImage);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('news')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      // Update news entry
      const { error: updateError } = await supabase
        .from('news')
        .update({
          title: title.trim(),
          content: content.trim() || null,
          image_url: imageUrl,
        })
        .eq('id', news.id);

      if (updateError) throw updateError;

      toast.success('Actualité modifiée');
      onOpenChange(false);
      onUpdated?.();
    } catch (error) {
      console.error('Error updating news:', error);
      toast.error('Erreur lors de la modification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier l'actualité</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Titre *</Label>
            <Input
              id="edit-title"
              placeholder="Titre de l'actualité"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-content">Contenu</Label>
            <Textarea
              id="edit-content"
              placeholder="Description ou détails..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Image (optionnel)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Aperçu"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={removeImage}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-32 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <ImagePlus className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Ajouter une image
                  </span>
                </div>
              </Button>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !title.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
