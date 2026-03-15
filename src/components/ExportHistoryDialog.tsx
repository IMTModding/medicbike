import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExportHistoryDialogProps {
  startDate?: string;
  endDate?: string;
}

const ExportHistoryDialog = ({ startDate, endDate }: ExportHistoryDialogProps) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-history', {
        body: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }
      });

      if (error) throw error;

      if (!data?.pdf) {
        throw new Error('Aucun PDF généré');
      }

      // Decode base64 and trigger download
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `historique-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${data.count} intervention(s) exportée(s)`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Erreur lors de l'export");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="secondary" 
      size="icon"
      onClick={handleExport}
      disabled={loading}
      title="Télécharger le PDF"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
    </Button>
  );
};

export default ExportHistoryDialog;
