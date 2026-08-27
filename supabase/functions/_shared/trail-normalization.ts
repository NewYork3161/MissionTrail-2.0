export const METERS_PER_MILE = 1_609.344;
const FEET_PER_METER = 3.280839895;
const EARTH_RADIUS_METERS = 6_371_000;

type Coordinate = { latitude: number; longitude: number };

type GeoapifyPlaceProperties = {
  place_id?: string;
  name?: string;
  lat?: number;
  lon?: number;
  distance?: number;
  categories?: string[];
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  description?: string;
  wheelchair?: string;
  datasource?: { raw?: Record<string, unknown> };
};

export type GeoapifyPlaceFeature = {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: GeoapifyPlaceProperties;
};

export type OverpassElement = {
  type?: 'node' | 'way' | 'relation';
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export type NormalizedTrail = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  category: 'trail' | 'trailhead' | 'park' | 'nature_reserve' | 'walking_path';
  address?: string;
  description?: string;
  accessibility?: string;
  difficulty: 'easy' | 'moderate' | 'challenging' | 'unknown';
  source: 'geoapify' | 'openstreetmap';
};

// Purpose: Implements the radians operation.
function radians(value: number) {
  return value * Math.PI / 180;
}

// Purpose: Implements the distance meters operation.
export function distanceMeters(from: Coordinate, to: Coordinate) {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const startLatitude = radians(from.latitude);
  const endLatitude = radians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

// Purpose: Implements the read string operation.
function readString(raw: Record<string, unknown>, key: string) {
  const value = raw[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

// Purpose: Implements the category from operation.
function categoryFrom(categories: string[], raw: Record<string, unknown>): NormalizedTrail['category'] {
  const information = readString(raw, 'information');
  if (information === 'trailhead' || categories.some((value) => value.includes('ranger_station'))) {
    return 'trailhead';
  }
  if (categories.some((value) => value.includes('nature_reserve') || value === 'natural.protected_area' || value === 'national_park')) {
    return 'nature_reserve';
  }
  if (categories.some((value) => value.startsWith('leisure.park'))) return 'park';
  if (categories.some((value) => value === 'highway.footway')) return 'walking_path';
  return 'trail';
}

// Purpose:
// Converts OpenStreetMap difficulty and trail-condition tags
// into the three difficulty levels shown by Mission Trails.
//
// Explicit hiking grades always win. When a trail does not
// provide a formal hiking grade, safe provider tags such as
// surface, smoothness, track type, incline, and MTB scale are
// used as a practical fallback.
//
// When there still is not enough information, the trail stays
// "unknown" instead of inventing a difficulty.
function difficultyFrom(
  raw: Record<string, unknown>,
): NormalizedTrail['difficulty'] {

  const explicit =
    readString(
      raw,
      'difficulty'
    )?.toLowerCase();


  if (
    explicit === 'easy' ||
    explicit === 'moderate' ||
    explicit === 'challenging'
  ) {
    return explicit;
  }


  const sacScale =
    readString(
      raw,
      'sac_scale'
    )?.toLowerCase();


  if (sacScale === 'hiking') {
    return 'easy';
  }


  if (
    sacScale === 'mountain_hiking' ||
    sacScale ===
      'demanding_mountain_hiking'
  ) {
    return 'moderate';
  }


  if (
    [
      'alpine_hiking',
      'demanding_alpine_hiking',
      'difficult_alpine_hiking',
    ].includes(
      sacScale ?? ''
    )
  ) {
    return 'challenging';
  }


  // Purpose:
  // Uses OSM mountain-bike technical scale as another
  // provider-supplied indication of trail difficulty.
  const mtbScaleText =
    readString(
      raw,
      'mtb:scale'
    );


  if (mtbScaleText) {

    const mtbScale =
      Number.parseInt(
        mtbScaleText,
        10
      );


    if (
      Number.isFinite(
        mtbScale
      )
    ) {

      if (mtbScale >= 4) {
        return 'challenging';
      }


      if (mtbScale >= 2) {
        return 'moderate';
      }


      if (mtbScale >= 0) {
        return 'easy';
      }
    }
  }


  // Purpose:
  // Reads a numeric OSM incline when one is available.
  // Steeper grades move a trail into a harder category.
  const inclineText =
    readString(
      raw,
      'incline'
    );


  if (inclineText) {

    const incline =
      Number.parseFloat(
        inclineText.replace(
          '%',
          ''
        )
      );


    if (
      Number.isFinite(
        incline
      )
    ) {

      const absoluteIncline =
        Math.abs(
          incline
        );


      if (
        absoluteIncline >= 18
      ) {
        return 'challenging';
      }


      if (
        absoluteIncline >= 8
      ) {
        return 'moderate';
      }
    }
  }


  const smoothness =
    readString(
      raw,
      'smoothness'
    )?.toLowerCase();


  if (
    [
      'very_bad',
      'horrible',
      'very_horrible',
      'impassable',
    ].includes(
      smoothness ?? ''
    )
  ) {
    return 'challenging';
  }


  if (
    [
      'bad',
      'intermediate',
    ].includes(
      smoothness ?? ''
    )
  ) {
    return 'moderate';
  }


  if (
    [
      'excellent',
      'good',
    ].includes(
      smoothness ?? ''
    )
  ) {
    return 'easy';
  }


  const surface =
    readString(
      raw,
      'surface'
    )?.toLowerCase();


  if (
    [
      'asphalt',
      'concrete',
      'paved',
      'paving_stones',
      'compacted',
      'fine_gravel',
      'wood',
    ].includes(
      surface ?? ''
    )
  ) {
    return 'easy';
  }


  if (
    [
      'gravel',
      'dirt',
      'earth',
      'ground',
      'unpaved',
      'woodchips',
      'grass',
    ].includes(
      surface ?? ''
    )
  ) {
    return 'moderate';
  }


  if (
    [
      'rock',
      'stone',
      'scree',
      'pebblestone',
    ].includes(
      surface ?? ''
    )
  ) {
    return 'challenging';
  }


  const trackType =
    readString(
      raw,
      'tracktype'
    )?.toLowerCase();


  if (
    trackType === 'grade1'
  ) {
    return 'easy';
  }


  if (
    trackType === 'grade2' ||
    trackType === 'grade3'
  ) {
    return 'moderate';
  }


  if (
    trackType === 'grade4' ||
    trackType === 'grade5'
  ) {
    return 'challenging';
  }


  const highway =
    readString(
      raw,
      'highway'
    )?.toLowerCase();


  // Purpose:
  // Clearly pedestrian-focused mapped surfaces are treated
  // as Easy when no conflicting difficulty information exists.
  if (
    highway === 'pedestrian' ||
    highway === 'footway'
  ) {
    return 'easy';
  }


  return 'unknown';
}


// Purpose: Implements the category from osm tags operation.
function categoryFromOsmTags(tags: Record<string, string>): NormalizedTrail['category'] {
  if (
    tags.highway === 'trailhead'
    || ['trailhead', 'guidepost', 'map'].includes(tags.information)
  ) {
    return 'trailhead';
  }
  if (
    tags.leisure === 'nature_reserve'
    || ['protected_area', 'national_park'].includes(tags.boundary)
  ) {
    return 'nature_reserve';
  }
  if (
    ['park', 'garden', 'recreation_ground'].includes(tags.leisure)
    || tags.landuse === 'recreation_ground'
  ) {
    return 'park';
  }
  if (['footway', 'pedestrian', 'cycleway'].includes(tags.highway)) {
    return 'walking_path';
  }
  return 'trail';
}

// Purpose:
// Converts mapped trail accessibility information into a
// value Mission Trails can safely use.
//
// Explicit wheelchair tags always win.
//
// Without an explicit wheelchair tag, Mission Trails may
// identify a paved/compact pedestrian route as a mapped
// accessibility candidate. This is not a guarantee.
function accessibilityFromMappedData(
  raw: Record<string, unknown>,
  wheelchairOverride?: string,
) {

  const wheelchair =
    (
      wheelchairOverride ??
      readString(
        raw,
        'wheelchair'
      )
    )
      ?.trim()
      .toLowerCase();


  if (wheelchair) {

    return (
      `Wheelchair access: ${wheelchair}`
    );
  }


  const highway =
    readString(
      raw,
      'highway'
    )?.toLowerCase();


  // Purpose:
  // Routes mapped as steps must never be treated as
  // accessibility candidates.
  if (
    highway === 'steps'
  ) {

    return (
      'Wheelchair access: no'
    );
  }


  const surface =
    readString(
      raw,
      'surface'
    )?.toLowerCase();


  const smoothness =
    readString(
      raw,
      'smoothness'
    )?.toLowerCase();


  const inclineText =
    readString(
      raw,
      'incline'
    );


  let incline:
    number | null =
      null;


  if (inclineText) {

    const parsed =
      Number.parseFloat(
        inclineText.replace(
          '%',
          ''
        )
      );


    if (
      Number.isFinite(
        parsed
      )
    ) {

      incline =
        Math.abs(
          parsed
        );
    }
  }


  const pedestrianRoute =
    highway === 'footway' ||
    highway === 'pedestrian';


  const usableSurface =
    [
      'asphalt',
      'concrete',
      'paved',
      'paving_stones',
      'compacted',
      'fine_gravel',
    ].includes(
      surface ?? ''
    );


  const unsuitableSmoothness =
    [
      'bad',
      'very_bad',
      'horrible',
      'very_horrible',
      'impassable',
    ].includes(
      smoothness ?? ''
    );


  const suitableIncline =
    incline === null ||
    incline <= 8;


  if (
    pedestrianRoute &&
    usableSurface &&
    !unsuitableSmoothness &&
    suitableIncline
  ) {

    return (
      'Mapped accessible candidate: paved or compact pedestrian route. Verify posted accessibility and current trail conditions.'
    );
  }


  return undefined;
}


// Purpose:
// Builds a searchable OpenStreetMap address including the
// ZIP / postal code when the provider supplies one.
function osmAddress(
  tags: Record<string, string>,
) {

  const street =
    [
      tags['addr:housenumber'],
      tags['addr:street'],
    ]
      .filter(Boolean)
      .join(' ');


  const city =
    tags['addr:city'] ||
    tags['addr:town'] ||
    tags['addr:village'] ||
    tags['addr:place'];


  const region =
    tags['addr:state'];


  const postalCode =
    tags['addr:postcode'];


  return (
    [
      street,
      city,
      region,
      postalCode,
    ]
      .filter(Boolean)
      .join(', ') ||
    undefined
  );
}

// Purpose: Normalizes overpass places.
export function normalizeOverpassPlaces(elements: OverpassElement[], origin: Coordinate) {
  const seen = new Set<string>();
  const trails: NormalizedTrail[] = [];

  for (const element of elements) {
    if (!element.type || !Number.isFinite(element.id)) continue;
    const tags = element.tags ?? {};
    const name = readString(tags, 'name');
    if (!name) continue;

    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (
      typeof latitude !== 'number'
      || !Number.isFinite(latitude)
      || latitude < -90
      || latitude > 90
      || typeof longitude !== 'number'
      || !Number.isFinite(longitude)
      || longitude < -180
      || longitude > 180
    ) {
      continue;
    }

    const id = `${element.type}:${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    trails.push({
      id,
      name,
      latitude,
      longitude,
      distanceMiles: distanceMeters(origin, { latitude, longitude }) / METERS_PER_MILE,
      category: categoryFromOsmTags(tags),
      address: osmAddress(tags),
      description: readString(tags, 'description'),
      accessibility:
        accessibilityFromMappedData(
          tags
        ),
      difficulty: difficultyFrom(tags),
      source: 'openstreetmap',
    });
  }

  const seenNames = new Set<string>();
  return trails
    .sort((left, right) => left.distanceMiles - right.distanceMiles)
    .filter((trail) => {
      const key = `${trail.category}:${trail.name.toLocaleLowerCase()}`;
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
}

// Purpose: Normalizes geoapify places.
export function normalizeGeoapifyPlaces(features: GeoapifyPlaceFeature[], origin: Coordinate) {
  const seen = new Set<string>();
  const trails: NormalizedTrail[] = [];

  for (const feature of features) {
    const properties = feature.properties ?? {};
    const coordinates = feature.geometry?.coordinates;
    const longitude = properties.lon ?? (Array.isArray(coordinates) ? coordinates[0] : undefined);
    const latitude = properties.lat ?? (Array.isArray(coordinates) ? coordinates[1] : undefined);
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const raw = properties.datasource?.raw ?? {};
    const categories = Array.isArray(properties.categories) ? properties.categories : [];
    const id = properties.place_id ?? `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const rawName = readString(raw, 'name');
    const address = properties.formatted || [properties.address_line1, properties.address_line2].filter(Boolean).join(', ') || undefined;
    const wheelchair = properties.wheelchair ?? readString(raw, 'wheelchair');
    trails.push({
      id,
      name: properties.name?.trim() || rawName || categoryLabel(categoryFrom(categories, raw)),
      latitude,
      longitude,
      distanceMiles: distanceMeters(origin, { latitude, longitude }) / METERS_PER_MILE,
      category: categoryFrom(categories, raw),
      address,
      description: properties.description ?? readString(raw, 'description'),
      accessibility:
        accessibilityFromMappedData(
          raw,
          wheelchair
        ),
      difficulty: difficultyFrom(raw),
      source: 'geoapify',
    });
  }

  return trails.sort((left, right) => left.distanceMiles - right.distanceMiles);
}

// Purpose: Implements the category label operation.
function categoryLabel(category: NormalizedTrail['category']) {
  return ({
    trail: 'Unnamed Trail',
    trailhead: 'Trailhead',
    park: 'Park',
    nature_reserve: 'Nature Reserve',
    walking_path: 'Walking Path',
  } as const)[category];
}

type GeoapifyRouteFeature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    distance?: number;
    time?: number;
    legs?: { elevation?: number[]; elevation_range?: [number, number][] }[];
  };
};

// Purpose: Implements the flatten route coordinates operation.
function flattenRouteCoordinates(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return [value as number[]];
  }
  return value.flatMap(flattenRouteCoordinates);
}

// Geoapify can attach elevation as a third coordinate. Elevation gain is shown
// only when those measured values are actually present in the response.
// Purpose: Normalizes geoapify route.
export function normalizeGeoapifyRoute(feature: GeoapifyRouteFeature) {
  const points = flattenRouteCoordinates(feature.geometry?.coordinates);
  const geometry = points
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map((point) => [point[0], point[1]] as [number, number]);
  if (geometry.length < 2) throw new Error('ROUTE_GEOMETRY_UNAVAILABLE');

  const legElevations = feature.properties?.legs?.flatMap((leg) =>
    Array.isArray(leg.elevation)
      ? leg.elevation
      : Array.isArray(leg.elevation_range)
        ? leg.elevation_range.map((entry) => entry[1])
        : [],
  ) ?? [];
  const coordinateElevations = points.map((point) => point[2]).filter((value): value is number => Number.isFinite(value));
  const elevations = legElevations.length > 1 ? legElevations : coordinateElevations;
  let elevationGainFeet: number | undefined;
  if (elevations.length > 1) {
    const gainMeters = elevations.slice(1).reduce(
      (total, elevation, index) => total + Math.max(0, elevation - elevations[index]),
      0,
    );
    elevationGainFeet = gainMeters * FEET_PER_METER;
  }

  return {
    distanceMiles: (feature.properties?.distance ?? 0) / METERS_PER_MILE,
    durationMinutes: (feature.properties?.time ?? 0) / 60,
    elevationGainFeet,
    geometry: { type: 'LineString' as const, coordinates: geometry },
  };
}
