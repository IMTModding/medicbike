import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Mail, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExportHistoryDialogProps {
  startDate?: string;
  endDate?: string;
}

const ExportHistoryDialog = ({ startDate, endDate }: ExportHistoryDialogProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!email) {
      toast.error('Veuillez entrer une adresse email');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Adresse email invalide');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-history', {
        body: {
          email,
          format: 'pdf',
          endDate: endDate || undefined
        }
      });

      if (error) throw error;

      toast.success(`Export envoyé à ${email}`);
      setOpen(false);
      setEmail('');
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Erreur lors de l'export");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Exporter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Exporter l'historique
          </DialogTitle>
          <DialogDescription>
            Recevez l'historique des interventions par email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Adresse email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary"
            />
          </div>

          {/* Format info */}
          <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-primary bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Format PDF</p>
              <p className="text-xs text-muted-foreground">Document prêt à imprimer</p>
            </div>
          </div>

          {/* Date range info */}
          {(startDate || endDate) && (
            <div className="bg-secondary/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                📅 Période sélectionnée: {startDate && `du ${startDate}`} {endDate && `au ${endDate}`}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={() => setOpen(false)}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button 
            onClick={handleExport}
            disabled={loading || !email}
            className="flex-1 gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Envoyer
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportHistoryDialog;
