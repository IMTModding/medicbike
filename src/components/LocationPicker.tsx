import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Crosshair, Search, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  address?: string;
}

const MapClickHandler = ({ onClick }: { onClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Component to recenter map when coordinates change
const MapRecenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 16);
    }
  }, [lat, lng, map]);
  
  return null;
};

interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
}

export const LocationPicker = ({ latitude, longitude, onLocationChange, address }: LocationPickerProps) => {
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchAddress, setSearchAddress] = useState(address || '');
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Default center (Paris)
  const defaultCenter: [number, number] = [48.8566, 2.3522];
  const center: [number, number] = latitude && longitude 
    ? [latitude, longitude] 
    : defaultCenter;

  // Geocode address using Nominatim (OpenStreetMap)
  const geocodeAddress = async (query: string): Promise<GeocodingResult[]> => {
    if (!query || query.length < 3) return [];
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=fr&limit=5`,
        {
          headers: {
            'Accept-Language': 'fr',
          },
        }
      );
      
      if (!response.ok) throw new Error('Erreur de géocodage');
      
      return await response.json();
    } catch (error) {
      console.error('Geocoding error:', error);
      return [];
    }
  };

  // Handle address search with debounce
  const handleAddressChange = (value: string) => {
    setSearchAddress(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (value.length >= 3) {
      searchTimeoutRef.current = setTimeout(async () => {
        const results = await geocodeAddress(value);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Select a suggestion
  const selectSuggestion = (result: GeocodingResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    onLocationChange(lat, lng);
    setSearchAddress(result.display_name.split(',').slice(0, 2).join(', '));
    setSuggestions([]);
    setShowSuggestions(false);
    toast.success('Position mise à jour');
  };

  // Search for exact address
  const handleSearch = async () => {
    if (!searchAddress || searchAddress.length < 3) {
      toast.error('Entrez une adresse plus complète');
      return;
    }
    
    setIsSearching(true);
    const results = await geocodeAddress(searchAddress);
    setIsSearching(false);
    
    if (results.length > 0) {
      selectSuggestion(results[0]);
    } else {
      toast.error('Adresse non trouvée. Essayez avec plus de détails.');
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée par votre navigateur');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationChange(position.coords.latitude, position.coords.longitude);
        setIsLocating(false);
        toast.success('Position GPS obtenue');
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsLocating(false);
        toast.error('Impossible d\'obtenir votre position');
      },
      { enableHighAccuracy: true }
    );
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      {/* Address search */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Rechercher une adresse..."
              value={searchAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="pr-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleSearch}
            disabled={isSearching}
          >
            <Search className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGetCurrentLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Crosshair className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((result, index) => (
              <button
                key={index}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b border-border last:border-0"
                onClick={() => selectSuggestion(result)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span className="line-clamp-2">{result.display_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Recherchez une adresse ou cliquez sur la carte pour définir la position
      </p>
      
      <div className="relative h-48 rounded-lg overflow-hidden border border-border" style={{ zIndex: 0 }}>
        <MapContainer
          center={center}
          zoom={latitude && longitude ? 15 : 12}
          className="h-full w-full"
          style={{ zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onClick={onLocationChange} />
          {latitude && longitude && (
            <>
              <Marker position={[latitude, longitude]} />
              <MapRecenter lat={latitude} lng={longitude} />
            </>
          )}
        </MapContainer>
      </div>
      
      {latitude && longitude && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
};