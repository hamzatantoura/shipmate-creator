import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Locate, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const [locating, setLocating] = useState(false);
  const center: [number, number] = [lat || 33.51, lng || 36.29]; // Damascus default

  const useGPS = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> الموقع على الخريطة (اختياري)
        </span>
        <Button type="button" variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={useGPS} disabled={locating}>
          {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Locate className="h-3 w-3" />}
          موقعي الحالي
        </Button>
      </div>
      <div className="h-48 rounded-lg overflow-hidden border border-border">
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler onChange={onChange} />
          {lat && lng && <Marker position={[lat, lng]} />}
        </MapContainer>
      </div>
      {lat && lng && (
        <p className="text-xs text-muted-foreground">
          الإحداثيات: {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
