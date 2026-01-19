import { useEffect, useState, lazy, Suspense } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTeamLocations } from '@/hooks/useGeolocation';
import { Loader2, MapPin, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Custom marker icon
const createUserIcon = (isRecent: boolean) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="relative">
        <div class="w-8 h-8 rounded-full ${isRecent ? 'bg-primary' : 'bg-muted-foreground'} flex items-center justify-center shadow-lg border-2 border-white">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        ${isRecent ? '<span class="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border border-white animate-pulse"></span>' : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

interface UserLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  updated_at: string;
  is_active: boolean;
  full_name?: string;
}

// Inner map component that uses react-leaflet hooks
const MapContent = ({ locations }: { locations: UserLocation[] }) => {
  const [mapReady, setMapReady] = useState(false);
  const { MapContainer, TileLayer, Marker, Popup, useMap } = require('react-leaflet');

  // Component to fit bounds to all markers
  const FitBounds = ({ locations }: { locations: { latitude: number; longitude: number }[] }) => {
    const map = useMap();
    
    useEffect(() => {
      if (locations.length > 0) {
        const bounds = L.latLngBounds(
          locations.map(loc => [loc.latitude, loc.longitude] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }, [locations, map]);
    
    return null;
  };

  // Default center (France)
  const defaultCenter: [number, number] = [46.603354, 1.888334];
  const center: [number, number] = locations.length > 0 
    ? [locations[0].latitude, locations[0].longitude] 
    : defaultCenter;

  return (
    <MapContainer
      center={center}
      zoom={10}
      className="h-[calc(100%-48px)] w-full"
      whenReady={() => setMapReady(true)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {mapReady && <FitBounds locations={locations} />}
      
      {locations.map((loc) => {
        const isRecent = new Date(loc.updated_at).getTime() > Date.now() - 5 * 60 * 1000; // Last 5 min
        
        return (
          <Marker
            key={loc.user_id}
            position={[loc.latitude, loc.longitude]}
            icon={createUserIcon(isRecent)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{loc.full_name || 'Intervenant'}</p>
                <p className="text-muted-foreground text-xs">
                  Mis à jour {formatDistanceToNow(new Date(loc.updated_at), { addSuffix: true, locale: fr })}
                </p>
                {loc.accuracy && (
                  <p className="text-muted-foreground text-xs">
                    Précision: {Math.round(loc.accuracy)}m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

const TeamLocationMap = () => {
  const { locations, loading } = useTeamLocations();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (loading) {
    return (
      <div className="h-[400px] bg-card rounded-xl border border-border flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="h-[400px] bg-card rounded-xl border border-border flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">Aucun intervenant actif</h3>
        <p className="text-sm text-muted-foreground">
          Les positions des intervenants apparaîtront ici quand ils activeront le suivi GPS
        </p>
      </div>
    );
  }

  // Wait for client-side mount to avoid SSR issues with Leaflet
  if (!isMounted) {
    return (
      <div className="h-[400px] bg-card rounded-xl border border-border flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[400px] bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">Équipe en temps réel</span>
        </div>
        <span className="text-sm text-muted-foreground">{locations.length} actif(s)</span>
      </div>
      
      <MapContent locations={locations} />
    </div>
  );
};

export default TeamLocationMap;
