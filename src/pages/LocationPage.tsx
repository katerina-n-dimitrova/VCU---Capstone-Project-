import { useCallback, useMemo, useState } from 'react';
import { useVehicleData } from '../state/vehicleContext';
import { VehicleMap } from '../components/location/VehicleMap';
import { CopyCoordinates } from '../components/location/CopyCoordinates';
import { Card } from '../components/common/Card';
import { Banner } from '../components/common/Banner';
import { StatusPill } from '../components/common/StatusPill';
import { StateBlock } from '../components/common/StateBlock';
import { Icon } from '../components/common/Icon';
import { SYSTEM_LIMITS } from '../config/thresholds';
import { formatCoordinate, formatLatLonHuman, formatNumber } from '../utils/format';
import { ageMs, formatAge, formatDateTime } from '../utils/time';

export function LocationPage() {
  const { status, now, loading, simulated } = useVehicleData();
  const [tilesAvailable, setTilesAvailable] = useState(true);
  const handleTilesUnavailable = useCallback(() => setTilesAvailable(false), []);

  const location = status?.location;

  const fixAge = useMemo(
    () => (location ? ageMs(location.timestamp, now) : null),
    [location, now],
  );

  const stale =
    fixAge !== null && fixAge > SYSTEM_LIMITS.gnssFixStaleMs;
  const hasCoordinates =
    location != null && location.latitude !== null && location.longitude !== null;
  const positionIsCurrent = Boolean(location?.valid) && !stale;

  if (loading || !status || !location) {
    return (
      <div className="page">
        <Heading />
        <StateBlock title="Loading location…" busy />
      </div>
    );
  }

  const coordinateText = hasCoordinates
    ? `${formatCoordinate(location.latitude)}, ${formatCoordinate(location.longitude)}`
    : '';

  return (
    <div className="page">
      <Heading />

      {simulated ? (
        <Banner tone="demo">
          <strong>Simulated position.</strong> This vehicle is not real and is not in this place.
        </Banner>
      ) : null}

      {!positionIsCurrent ? (
        <Banner tone={hasCoordinates ? 'warning' : 'offline'} role="status">
          <strong>
            {hasCoordinates
              ? 'This is the last known position, not the current one.'
              : 'No position is available.'}
          </strong>{' '}
          {location.valid === false
            ? 'Location is unavailable because the GNSS module does not have a valid signal.'
            : `The last valid fix was ${formatAge(location.timestamp, now)}.`}
        </Banner>
      ) : null}

      <div className="grid grid--wide">
        <Card
          title={positionIsCurrent ? 'Current position' : 'Last known position'}
          titleId="location-position"
          subtitle={
            positionIsCurrent
              ? `Updated ${formatAge(location.timestamp, now)}`
              : hasCoordinates
                ? `Recorded ${formatAge(location.timestamp, now)} — do not treat as current`
                : 'Nothing recorded in this session'
          }
        >
          <div className="row">
            <StatusPill
              tone={positionIsCurrent ? 'normal' : hasCoordinates ? 'warning' : 'offline'}
              icon="map-pin"
            >
              {positionIsCurrent
                ? 'Position is current'
                : hasCoordinates
                  ? 'Position is old'
                  : 'Position unavailable'}
            </StatusPill>
            <StatusPill tone={location.valid ? 'normal' : 'offline'} icon={location.valid ? 'wifi' : 'wifi-off'}>
              {location.valid ? 'GNSS has a fix' : 'GNSS has no fix'}
            </StatusPill>
          </div>

          {hasCoordinates ? (
            <>
              <p className="coordinate-block">{coordinateText}</p>
              <p className="muted">{formatLatLonHuman(location.latitude, location.longitude)}</p>
              <CopyCoordinates text={coordinateText} label="Copy coordinates" />
            </>
          ) : (
            <p>
              No coordinates have been received in this session, so there is nothing to show or
              copy.
            </p>
          )}

          <dl className="detail-list">
            <Item term="Latitude" value={hasCoordinates ? formatCoordinate(location.latitude) : 'Not available'} mono />
            <Item term="Longitude" value={hasCoordinates ? formatCoordinate(location.longitude) : 'Not available'} mono />
            <Item
              term="Accuracy"
              value={
                location.accuracyMeters === null
                  ? 'Not reported'
                  : `about ${formatNumber(location.accuracyMeters, 1)} m`
              }
            />
            <Item
              term="Satellites used"
              value={
                location.satellitesUsed === null || location.satellitesUsed === undefined
                  ? 'Not reported'
                  : String(location.satellitesUsed)
              }
            />
            <Item
              term="Time of last valid fix"
              value={location.timestamp ? formatDateTime(location.timestamp) : 'Never'}
            />
            <Item
              term="GNSS connection"
              value={status.communication.gnssConnected ? 'Connected' : 'No signal'}
            />
          </dl>

          {location.accuracyMeters !== null &&
          location.accuracyMeters > SYSTEM_LIMITS.gnssAccuracyWarningMeters ? (
            <Banner tone="warning">
              Reported accuracy is worse than {SYSTEM_LIMITS.gnssAccuracyWarningMeters} m. The
              position shown may be off by that much.
            </Banner>
          ) : null}
        </Card>

        <Card
          title="Map"
          titleId="location-map"
          subtitle={
            tilesAvailable
              ? 'Map tiles load only when this device has internet access.'
              : 'Map tiles could not be loaded.'
          }
        >
          <div className="map-frame">
            {hasCoordinates && tilesAvailable ? (
              <VehicleMap
                latitude={location.latitude as number}
                longitude={location.longitude as number}
                accuracyMeters={location.accuracyMeters}
                valid={positionIsCurrent}
                timestamp={location.timestamp}
                now={now}
                onTilesUnavailable={handleTilesUnavailable}
              />
            ) : (
              <div className="offline-map">
                <div className="offline-map__inner">
                  <Icon name="map-pin" size={26} />
                  <p style={{ fontWeight: 650 }}>
                    {hasCoordinates ? 'Map tiles are not available' : 'No position to show'}
                  </p>
                  {hasCoordinates ? (
                    <>
                      <p className="muted">
                        The vehicle hotspot has no internet connection, so the background map
                        cannot load. The position itself is still known.
                      </p>
                      <p className="coordinate-block">{coordinateText}</p>
                      <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                        {positionIsCurrent
                          ? `Updated ${formatAge(location.timestamp, now)}`
                          : `Last known position, recorded ${formatAge(location.timestamp, now)}`}
                      </p>
                      <CopyCoordinates text={coordinateText} label="Copy coordinates" />
                      {!tilesAvailable ? (
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => setTilesAvailable(true)}
                        >
                          <Icon name="refresh" size={15} />
                          Try loading the map again
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <p className="muted">
                      Location is unavailable because the GNSS module does not have a valid signal.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            The application works fully without the map. Coordinates, fix age and GNSS state are
            always shown, whether or not tiles can load.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Heading() {
  return (
    <header className="page-header">
      <h1 className="page-header__title">Vehicle location</h1>
      <p className="page-header__description">
        Where the vehicle is, with an offline fallback when map tiles cannot load.
      </p>
    </header>
  );
}

function Item({ term, value, mono }: { term: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-list__item">
      <dt className="detail-list__term">{term}</dt>
      <dd className={`detail-list__value${mono ? ' mono' : ''}`}>{value}</dd>
    </div>
  );
}
