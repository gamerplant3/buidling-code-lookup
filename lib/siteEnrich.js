/**
 * One-shot geocode enrichment: climate station, elevation, zoning, frontage.
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { findNearestClimateStation } from '@/lib/nearestClimate';
import { fetchElevationM } from '@/lib/elevation';
import { lookupMunicipalZoning } from '@/lib/municipalZoning';
import { estimateOsmFrontage } from '@/lib/roadFrontage';

const SNAP_KM = 30;
let climateLocationsCache = null;

async function climateLocations() {
  if (!climateLocationsCache) {
    const raw = await readFile(
      path.join(process.cwd(), 'data', 'table-c2-canada.json'),
      'utf-8'
    );
    climateLocationsCache = JSON.parse(raw).locations || [];
  }
  return climateLocationsCache;
}

export async function enrichSiteFromCoordinates(lat, lng) {
  const hints = [];
  const patch = {};

  const [nearest, elevation, zoning] = await Promise.all([
    findNearestClimateStation(lat, lng, await climateLocations()),
    fetchElevationM(lat, lng),
    lookupMunicipalZoning(lat, lng),
  ]);

  let climate = null;
  if (nearest) {
    const useSnap = nearest.distanceKm <= SNAP_KM;
    climate = {
      ...nearest,
      useSnap,
      willInterpolate: !useSnap,
    };
    if (useSnap) {
      patch.locationKey = nearest.key;
      patch.lat = nearest.lat;
      patch.lng = nearest.lng;
      hints.push(
        `Climate: ${nearest.name}, ${nearest.province} (${nearest.distanceKm} km, Ss ${nearest.ssKPa} kPa)`
      );
    } else {
      delete patch.locationKey;
      patch.lat = lat;
      patch.lng = lng;
      hints.push(
        `Climate: no Table C-2 station within ${SNAP_KM} km — snow assess will use IDW at these coordinates`
      );
    }
  } else {
    patch.lat = lat;
    patch.lng = lng;
    hints.push('Climate: no nearby station — IDW on assess');
  }

  if (elevation.elevationM != null) {
    patch.elevationM = elevation.elevationM;
    hints.push(`Elevation ~${elevation.elevationM} m`);
  }

  if (zoning.found && zoning.zoning) {
    patch.zoning = zoning.zoning;
    if (zoning.roadFrontageM) patch.roadFrontageM = zoning.roadFrontageM;
    hints.push(
      `Zoning: ${zoning.zoneCode || zoning.zoning}${zoning.label ? ` (${zoning.label})` : ''}`
    );
    if (zoning.roadFrontageM) hints.push(`By-law frontage: ${zoning.roadFrontageM} m`);
  }

  let frontage = null;
  if (!patch.roadFrontageM) {
    frontage = await estimateOsmFrontage(lat, lng);
    if (frontage.found && frontage.roadFrontageM) {
      patch.roadFrontageM = frontage.roadFrontageM;
      hints.push(`Est. frontage ~${frontage.roadFrontageM} m (OSM)`);
    }
  }

  return { climate, elevation, zoning, frontage, patch, hints };
}
