import { useEffect, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_TILES } from '../../config/endpoints';
import { formatLatLonHuman } from '../../utils/format';
import { formatAge } from '../../utils/time';

/**
 * The online map.
 *
 * Tiles come from the internet, which the vehicle hotspot does not have. The
 * component reports back through `onTilesUnavailable` as soon as a tile fails
 * or nothing has loaded within the probe timeout, and the page then swaps in
 * the offline card. A circle marker is used rather than Leaflet's default pin
 * so no marker image has to be bundled or fetched.
 */
export function VehicleMap({
  latitude,
  longitude,
  accuracyMeters,
  valid,
  timestamp,
  now,
  onTilesUnavailable,
}: {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  valid: boolean;
  timestamp: string | null;
  now: number;
  onTilesUnavailable: () => void;
}) {
  const [anyTileLoaded, setAnyTileLoaded] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!anyTileLoaded && !reported.current) {
        reported.current = true;
        onTilesUnavailable();
      }
    }, MAP_TILES.probeTimeoutMs);
    return () => clearTimeout(timer);
  }, [anyTileLoaded, onTilesUnavailable]);

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      scrollWheelZoom={false}
      style={{ width: '100%', height: '100%' }}
      attributionControl
    >
      <TileLayer
        url={MAP_TILES.urlTemplate}
        attribution={MAP_TILES.attribution}
        maxZoom={MAP_TILES.maxZoom}
        eventHandlers={{
          tileload: () => setAnyTileLoaded(true),
          tileerror: () => {
            if (!reported.current) {
              reported.current = true;
              onTilesUnavailable();
            }
          },
        }}
      />
      <Recentre latitude={latitude} longitude={longitude} />
      <CircleMarker
        center={[latitude, longitude]}
        radius={10}
        pathOptions={{
          color: valid ? 'var(--accent)' : 'var(--offline)',
          fillColor: valid ? 'var(--accent)' : 'var(--offline)',
          fillOpacity: valid ? 0.75 : 0.35,
          dashArray: valid ? undefined : '4 4',
          weight: 3,
        }}
      >
        <Popup>
          <strong>{valid ? 'Current position' : 'Last known position'}</strong>
          <br />
          {formatLatLonHuman(latitude, longitude)}
          <br />
          {valid ? 'Updated' : 'Recorded'} {formatAge(timestamp, now)}
          {accuracyMeters !== null ? (
            <>
              <br />
              Accurate to about {accuracyMeters} m
            </>
          ) : null}
        </Popup>
      </CircleMarker>
    </MapContainer>
  );
}

/** Keeps the view on the vehicle as it moves, without fighting a manual pan. */
function Recentre({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  const last = useRef<[number, number]>([latitude, longitude]);

  useEffect(() => {
    const [previousLat, previousLon] = last.current;
    const moved =
      Math.abs(previousLat - latitude) > 0.0015 || Math.abs(previousLon - longitude) > 0.0015;
    if (moved) {
      last.current = [latitude, longitude];
      map.panTo([latitude, longitude], { animate: false });
    }
  }, [latitude, longitude, map]);

  return null;
}
