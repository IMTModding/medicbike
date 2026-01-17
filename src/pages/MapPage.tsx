import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchActiveInterventions, InterventionWithResponses } from '@/services/interventions';
import { ArrowLeft, Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createCustomIcon = (urgency: string) => {
  const color = urgency === 'high' ? '#ef4444' : urgency === 'medium' ? '#f59e0b' : '#22c55e';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 32px;
      height: 32px;
      background: ${color};
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

const MapPage = () => {
  const [interventions, setInterventions] = useState<InterventionWithResponses[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchActiveInterventions();
        // Filter only interventions with coordinates
        setInterventions(data.filter(i => i.latitude && i.longitude));
      } catch (error) {
        console.error('Error loading interventions:', error);
        toast.error('Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

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

  // Default center on France
  const defaultCenter: [number, number] = [46.603354, 1.888334];
  const hasInterventions = interventions.length > 0;
  const center: [number, number] = hasInterventions 
    ? [interventions[0].latitude!, interventions[0].longitude!]
    : defaultCenter;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-[1000] bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-lg text-foreground">Carte</h1>
              <p className="text-xs text-muted-foreground">{interventions.length} intervention(s) active(s)</p>
            </div>
          </div>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        {!hasInterventions ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Aucune intervention géolocalisée</h3>
            <p className="text-sm text-muted-foreground">
              Les interventions avec coordonnées apparaîtront ici
            </p>
          </div>
        ) : (
          <MapContainer 
            center={center} 
            zoom={8} 
            className="h-full w-full"
            style={{ height: 'calc(100vh - 64px)' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {interventions.map(intervention => (
              <Marker 
                key={intervention.id}
                position={[intervention.latitude!, intervention.longitude!]}
                icon={createCustomIcon(intervention.urgency)}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full inline-block mb-2",
                      intervention.urgency === 'high' ? 'bg-red-100 text-red-700' :
                      intervention.urgency === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    )}>
                      {intervention.urgency === 'high' ? 'Urgent' : 
                       intervention.urgency === 'medium' ? 'Moyen' : 'Normal'}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{intervention.title}</h3>
                    {intervention.description && (
                      <p className="text-sm text-gray-600 mb-2">{intervention.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                      <MapPin className="w-3 h-3" />
                      <span>{intervention.location}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {format(new Date(intervention.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                    <Button 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => navigate('/')}
                    >
                      Voir les détails
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default MapPage;
