import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CompletionNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interventionId: string;
  interventionTitle: string;
  currentNotes: string | null;
  onSaved: () => void;
}

const CompletionNotesDialog = ({
  open,
  onOpenChange,
  interventionId,
  interventionTitle,
  currentNotes,
  onSaved,
}: CompletionNotesDialogProps) => {
  const [notes, setNotes] = useState(currentNotes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes(currentNotes || '');
    }
  }, [open, currentNotes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('interventions')
        .update({ completion_notes: notes.trim() || null })
        .eq('id', interventionId);

      if (error) throw error;

      toast.success('Notes enregistrées');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Notes de fin d'intervention
          </DialogTitle>
          <DialogDescription className="line-clamp-1">
            {interventionTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Descriptif de l'intervention
            </label>
            <Textarea
              placeholder="Décrivez comment s'est déroulée l'intervention, les actions effectuées, les observations importantes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[150px] bg-secondary resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Ce descriptif sera visible dans l'historique des interventions.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CompletionNotesDialog;
