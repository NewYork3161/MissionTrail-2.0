import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { queueGpsLocation } from "@/services/verified-distance";
import {
  calculateDistanceMeters,
  type Coordinate,
} from "@/utils/distance";

// ============================================================
// HOME BACKUP - LOCATION / GPS SYSTEM
// ============================================================
//
// Extracted from home-backup.tsx.
//
// This file owns the complete Home location subsystem:
// - native foreground-location permission
// - browser geolocation permission/state
// - first/fresh location fixes
// - browser and native live location watchers
// - GPS accuracy/staleness filtering
// - speed detection
// - accepted GPS history / queueGpsLocation
// - browser map coordinate
// - visual GPS smoothing
// - stable player coordinate
// - native compass heading
// - map centering / zoom-out helpers
//
// home-backup.tsx remains the brain/controller.
// ============================================================

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type BrowserLocationSubscription = {
  remove: () => void;
};

type BrowserPermissionState =
  | "granted"
  | "denied"
  | "prompt"
  | "unknown";

export type HomeBackupLocationMapController = {
  animateToRegion?: (region: Region, duration?: number) => void;
};

export type HomeBackupLocationOptions = {
  userId: string | null | undefined;

  mapRef?: {
    current: HomeBackupLocationMapController | null;
  };

  /**
   * The original Home file initializes the relic test field from the
   * first accepted GPS fix. Keep that behavior outside this module by
   * supplying this callback when relic test mode is enabled.
   */
  onFirstAcceptedCoordinate?: (coordinate: Coordinate) => void;

  /**
   * Optional notification whenever an accepted raw GPS sample is stored.
   * Secure systems can consume this without owning the location watcher.
   */
  onAcceptedLocation?: (location: Location.LocationObject) => void;
};

export type HomeBackupLocationSystem = {
  mapRegion: Region | null;
  setMapRegion: React.Dispatch<React.SetStateAction<Region | null>>;

  gpsPoints: Location.LocationObject[];
  visualGpsPoints: Location.LocationObject[];

  latestGpsPoint: Location.LocationObject | undefined;
  stablePlayerLocation: Location.LocationObject | undefined;
  playerCoordinate: Coordinate | null;

  browserWebCoordinate: Coordinate | null;
  liveCoordinate: Coordinate | null;

  locationError: string | null;
  setLocationError: React.Dispatch<React.SetStateAction<string | null>>;

  isMovingTooFast: boolean;
  phoneHeading: number | null;

  saveGoodGpsPoint: (point: Location.LocationObject) => void;

  requestFreshLocation: () => Promise<Location.LocationObject>;
  requestFreshCoordinate: () => Promise<Coordinate>;

  restartTracking: () => void;
  centerMapOnUser: () => void;
  zoomOutMap: () => void;
};

// =======================
// GPS SETTINGS
// =======================

export const speedLimitMetersPerSecond = 20 * 0.44704;

// Original native secure-gameplay threshold.
export const MAX_ACCEPTED_GPS_ACCURACY_METERS = 25;
export const MAX_ACCEPTED_GPS_AGE_MS = 12_000;

// Browser scan thresholds from the current Home file.
export const BROWSER_SCAN_ACCURACY_TARGET_METERS = 75;
export const BROWSER_MAX_ACCEPTED_ACCURACY_METERS = 500;
export const BROWSER_SCAN_FIX_TIMEOUT_MS = 30_000;

// =======================
// BASIC LOCATION HELPERS
// =======================

export function makeMapRegion(
  location: Location.LocationObject,
): Region {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.006,
    longitudeDelta: 0.006,
  };
}

export function makeMapCoordinate(
  location: Location.LocationObject,
): Coordinate {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

export function getLatestGpsPoint(
  points: Location.LocationObject[],
) {
  return points[points.length - 1];
}

function getGpsSampleId(location: Location.LocationObject) {
  return `location-${Math.round(location.timestamp)}`;
}

function deduplicateGpsLocations(
  locations: Location.LocationObject[],
) {
  const seenSampleIds = new Set<string>();
  const uniqueNewestFirst: Location.LocationObject[] = [];

  for (let index = locations.length - 1; index >= 0; index -= 1) {
    const location = locations[index];
    const sampleId = getGpsSampleId(location);

    if (seenSampleIds.has(sampleId)) continue;

    seenSampleIds.add(sampleId);
    uniqueNewestFirst.push(location);
  }

  return uniqueNewestFirst.reverse();
}

// =======================
// BROWSER GEOLOCATION
// =======================

function browserPositionToExpoLocation(
  position: GeolocationPosition,
): Location.LocationObject {
  return {
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude,
      accuracy: position.coords.accuracy,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
    },
    timestamp: position.timestamp,
  };
}

export async function getBrowserLocationPermissionState(): Promise<BrowserPermissionState> {
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation
  ) {
    return "denied";
  }

  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });

      if (result.state === "granted") return "granted";
      if (result.state === "denied") return "denied";
      return "prompt";
    }
  } catch {
    // Some browsers support geolocation but not Permissions API.
  }

  return "unknown";
}

export function getBrowserCurrentLocation(): Promise<Location.LocationObject> {
  return new Promise((resolve, reject) => {
    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      reject(new Error("Browser geolocation is unavailable."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve(browserPositionToExpoLocation(position)),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 30_000,
        maximumAge: 0,
      },
    );
  });
}

export function getBestBrowserCurrentLocation(): Promise<Location.LocationObject> {
  return new Promise((resolve, reject) => {
    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      reject(new Error("Browser geolocation is unavailable."));
      return;
    }

    let bestLocation: Location.LocationObject | null = null;
    let settled = false;
    let watchId: number | null = null;

    const finish = (location: Location.LocationObject) => {
      if (settled) return;

      settled = true;

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      window.clearTimeout(timeoutId);
      resolve(location);
    };

    const timeoutId = window.setTimeout(() => {
      if (bestLocation) {
        finish(bestLocation);
        return;
      }

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      // watchPosition did not produce a usable sample in time.
      // Give Chrome/Windows one final one-shot location request before
      // failing the Companion scan.
      settled = true;

      void getBrowserCurrentLocation()
        .then((fallbackLocation) => {
          resolve(fallbackLocation);
        })
        .catch(() => {
          reject(
            new Error(
              "Timed out while waiting for browser location.",
            ),
          );
        });
    }, BROWSER_SCAN_FIX_TIMEOUT_MS);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location =
          browserPositionToExpoLocation(position);

        const accuracy =
          location.coords.accuracy ??
          Number.POSITIVE_INFINITY;

        const bestAccuracy =
          bestLocation?.coords.accuracy ??
          Number.POSITIVE_INFINITY;

        if (!bestLocation || accuracy < bestAccuracy) {
          bestLocation = location;
        }

        if (
          accuracy <=
          BROWSER_SCAN_ACCURACY_TARGET_METERS
        ) {
          finish(location);
        }
      },
      (error) => {
        if (settled) return;

        if (error.code === error.PERMISSION_DENIED) {
          window.clearTimeout(timeoutId);

          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
          }

          settled = true;
          reject(error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: BROWSER_SCAN_FIX_TIMEOUT_MS,
        maximumAge: 0,
      },
    );
  });
}

export async function askForBrowserLocationPermission() {
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation
  ) {
    return false;
  }

  try {
    // Called from a user action such as SCAN FOR COMPANION.
    await getBrowserCurrentLocation();
    return true;
  } catch {
    return false;
  }
}

function watchBrowserLocation(
  onLocationChange: (
    location: Location.LocationObject,
  ) => void,
): BrowserLocationSubscription {
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation
  ) {
    throw new Error(
      "Browser geolocation is unavailable.",
    );
  }

  const watchId =
    navigator.geolocation.watchPosition(
      (position) => {
        onLocationChange(
          browserPositionToExpoLocation(position),
        );
      },
      (error) => {
        if (__DEV__) {
          console.warn(
            "Browser live location update failed:",
            error,
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30_000,
        maximumAge: 0,
      },
    );

  return {
    remove: () => {
      navigator.geolocation.clearWatch(watchId);
    },
  };
}

// =======================
// NATIVE LOCATION
// =======================

export async function askForLocationPermission() {
  if (!(await Location.hasServicesEnabledAsync())) {
    return false;
  }

  const permission =
    await Location.requestForegroundPermissionsAsync();

  return (
    permission.status ===
    Location.PermissionStatus.GRANTED
  );
}

export async function getFirstLocation() {
  const lastKnownLocation =
    await Location.getLastKnownPositionAsync({
      maxAge: Platform.OS === "web" ? 60_000 : 15_000,
      requiredAccuracy:
        Platform.OS === "web"
          ? 5000
          : MAX_ACCEPTED_GPS_ACCURACY_METERS,
    });

  if (lastKnownLocation) {
    return lastKnownLocation;
  }

  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });
}

function watchLiveLocation(
  onLocationChange: (
    location: Location.LocationObject,
  ) => void,
) {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 0,
      timeInterval: 2500,
    },
    onLocationChange,
  );
}

// =======================
// GPS QUALITY / SPEED
// =======================

export function isUsableGpsLocation(
  location: Location.LocationObject,
) {
  const {
    latitude,
    longitude,
    accuracy,
  } = location.coords;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }

  const maximumAccuracyMeters =
    Platform.OS === "web"
      ? 5000
      : MAX_ACCEPTED_GPS_ACCURACY_METERS;

  const maximumAgeMs =
    Platform.OS === "web"
      ? 60_000
      : MAX_ACCEPTED_GPS_AGE_MS;

  if (
    Number.isFinite(location.timestamp) &&
    Date.now() - location.timestamp >
      maximumAgeMs
  ) {
    return false;
  }

  if (
    accuracy !== null &&
    accuracy !== undefined &&
    (
      !Number.isFinite(accuracy) ||
      accuracy > maximumAccuracyMeters
    )
  ) {
    return false;
  }

  return true;
}

export function isOverSpeedLimit(
  location: Location.LocationObject,
) {
  return (
    (location.coords.speed ?? 0) >
    speedLimitMetersPerSecond
  );
}

export function getSpeedMph(
  location?: Location.LocationObject,
) {
  if (
    !location?.coords.speed ||
    location.coords.speed < 0
  ) {
    return 0;
  }

  return location.coords.speed * 2.23694;
}

// =======================
// VISUAL GPS SMOOTHING
// =======================
//
// Raw gpsPoints are NOT modified. Secure relic verification can
// continue consuming the original accepted samples. This only
// produces the visual map trail / stable player position.
// =======================

export function buildVisualGpsTrack(
  points: Location.LocationObject[],
): Location.LocationObject[] {
  if (points.length <= 1) {
    return points;
  }

  const accuratePoints = points.filter((point) => {
    const accuracy = point.coords.accuracy;

    return (
      accuracy === null ||
      accuracy === undefined ||
      accuracy <=
        MAX_ACCEPTED_GPS_ACCURACY_METERS
    );
  });

  const source =
    accuratePoints.length > 0
      ? accuratePoints
      : points.slice(-1);

  if (source.length <= 1) {
    return source;
  }

  const cleaned: Location.LocationObject[] = [
    source[0],
  ];

  for (
    let index = 1;
    index < source.length;
    index += 1
  ) {
    const point = source[index];
    const previous =
      cleaned[cleaned.length - 1];

    const distanceMeters =
      calculateDistanceMeters(
        {
          latitude: previous.coords.latitude,
          longitude: previous.coords.longitude,
        },
        {
          latitude: point.coords.latitude,
          longitude: point.coords.longitude,
        },
      );

    const elapsedSeconds = Math.max(
      0.001,
      (point.timestamp - previous.timestamp) /
        1000,
    );

    const impliedSpeedMetersPerSecond =
      distanceMeters / elapsedSeconds;

    const maximumVisualAccuracy = Math.max(
      previous.coords.accuracy ?? 0,
      point.coords.accuracy ?? 0,
    );

    const visualMovementThreshold = Math.max(
      4,
      Math.min(
        30,
        maximumVisualAccuracy * 1.25,
      ),
    );

    // Ignore stationary GPS wobble.
    if (
      distanceMeters <
      visualMovementThreshold
    ) {
      continue;
    }

    // Ignore impossible visual teleporting.
    if (
      impliedSpeedMetersPerSecond > 8
    ) {
      continue;
    }

    cleaned.push(point);
  }

  return cleaned.slice(-60);
}

// =======================
// STABLE WALKING POSITION
// =======================

const FOOTPRINT_MIN_MOVEMENT_METERS = 4;

function getFootprintDistanceMeters(
  left: Location.LocationObject,
  right: Location.LocationObject,
) {
  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const latitude1 =
    toRadians(left.coords.latitude);

  const latitude2 =
    toRadians(right.coords.latitude);

  const latitudeDelta =
    latitude2 - latitude1;

  const longitudeDelta = toRadians(
    right.coords.longitude -
      left.coords.longitude,
  );

  const rawHaversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;

  const haversine = Math.max(
    0,
    Math.min(1, rawHaversine),
  );

  return (
    6_371_000 *
    2 *
    Math.asin(Math.sqrt(haversine))
  );
}

export function getWalkingFootprintLocations(
  locations: Location.LocationObject[],
) {
  const uniqueLocations =
    deduplicateGpsLocations(locations);

  if (uniqueLocations.length <= 1) {
    return uniqueLocations;
  }

  const walkingLocations: Location.LocationObject[] =
    [uniqueLocations[0]];

  for (const location of uniqueLocations.slice(1)) {
    const previous =
      walkingLocations.at(-1);

    if (!previous) {
      walkingLocations.push(location);
      continue;
    }

    const distanceMeters =
      getFootprintDistanceMeters(
        previous,
        location,
      );

    const maximumAccuracy = Math.max(
      previous.coords.accuracy ?? 0,
      location.coords.accuracy ?? 0,
    );

    const accuracyMovementThreshold =
      Math.max(
        FOOTPRINT_MIN_MOVEMENT_METERS,
        Math.min(
          30,
          maximumAccuracy * 1.25,
        ),
      );

    const speedMetersPerSecond =
      Math.max(
        0,
        location.coords.speed ?? 0,
      );

    const movingByDistance =
      distanceMeters >=
      accuracyMovementThreshold;

    const speedLooksPlausible =
      speedMetersPerSecond <=
      speedLimitMetersPerSecond;

    if (
      movingByDistance &&
      speedLooksPlausible
    ) {
      walkingLocations.push(location);
    }
  }

  return walkingLocations;
}

export function getStableFootprintLocation(
  locations: Location.LocationObject[],
) {
  return (
    getWalkingFootprintLocations(locations).at(-1) ??
    locations.at(-1)
  );
}

// =======================
// MAIN HOME LOCATION HOOK
// =======================

export function useHomeBackupLocation(
  options: HomeBackupLocationOptions,
): HomeBackupLocationSystem {
  const {
    userId,
    mapRef,
    onFirstAcceptedCoordinate,
    onAcceptedLocation,
  } = options;

  const [mapRegion, setMapRegion] =
    useState<Region | null>(null);

  const [gpsPoints, setGpsPoints] =
    useState<Location.LocationObject[]>([]);

  const [
    browserWebCoordinate,
    setBrowserWebCoordinate,
  ] = useState<Coordinate | null>(null);

  const [locationError, setLocationError] =
    useState<string | null>(null);

  const [
    isMovingTooFast,
    setIsMovingTooFast,
  ] = useState(false);

  const [
    trackingRestartKey,
    setTrackingRestartKey,
  ] = useState(0);

  const [phoneHeading, setPhoneHeading] =
    useState<number | null>(null);

  const hasCenteredOnGpsRef = useRef(false);

  const acceptedGpsSampleIdsRef =
    useRef(new Set<string>());

  const acceptedGpsUserIdRef =
    useRef<string | null>(null);

  const latestGpsPoint =
    getLatestGpsPoint(gpsPoints);

  const visualGpsPoints = useMemo(
    () => buildVisualGpsTrack(gpsPoints),
    [gpsPoints],
  );

  const stablePlayerLocation =
    getStableFootprintLocation(
      visualGpsPoints,
    ) ?? latestGpsPoint;

  const playerCoordinate =
    stablePlayerLocation
      ? makeMapCoordinate(
          stablePlayerLocation,
        )
      : null;

  const liveCoordinate = useMemo(
    () =>
      Platform.OS === "web" &&
      browserWebCoordinate
        ? browserWebCoordinate
        : latestGpsPoint
          ? makeMapCoordinate(latestGpsPoint)
          : null,
    [
      browserWebCoordinate,
      latestGpsPoint,
    ],
  );

  const saveGoodGpsPoint = useCallback(
    (point: Location.LocationObject) => {
      if (!userId) return;
      if (!isUsableGpsLocation(point)) return;

      if (
        acceptedGpsUserIdRef.current !==
        userId
      ) {
        acceptedGpsUserIdRef.current =
          userId;

        acceptedGpsSampleIdsRef.current.clear();
      }

      const sampleId =
        getGpsSampleId(point);

      if (
        acceptedGpsSampleIdsRef.current.has(
          sampleId,
        )
      ) {
        return;
      }

      acceptedGpsSampleIdsRef.current.add(
        sampleId,
      );

      if (
        acceptedGpsSampleIdsRef.current.size >
        120
      ) {
        const oldestSampleId =
          acceptedGpsSampleIdsRef.current
            .values()
            .next().value;

        if (oldestSampleId) {
          acceptedGpsSampleIdsRef.current.delete(
            oldestSampleId,
          );
        }
      }

      void queueGpsLocation(
        point,
        userId,
      ).catch(() => {
        // Offline/transient failures remain
        // queued for the next sync.
      });

      const coordinate =
        makeMapCoordinate(point);

      onFirstAcceptedCoordinate?.(
        coordinate,
      );

      onAcceptedLocation?.(point);

      if (
        !hasCenteredOnGpsRef.current
      ) {
        hasCenteredOnGpsRef.current = true;

        const firstRegion =
          makeMapRegion(point);

        setMapRegion(firstRegion);

        mapRef?.current?.animateToRegion?.(
          firstRegion,
          0,
        );
      }

      setGpsPoints((oldPoints) => [
        ...deduplicateGpsLocations(
          oldPoints,
        ).slice(-59),
        point,
      ]);
    },
    [
      mapRef,
      onAcceptedLocation,
      onFirstAcceptedCoordinate,
      userId,
    ],
  );

  // =====================
  // LIVE GPS TRACKING
  // =====================

  useEffect(() => {
    let locationWatcher:
      | Location.LocationSubscription
      | BrowserLocationSubscription
      | undefined;

    let isMounted = true;

    async function startGpsTracking() {
      // WEB
      if (Platform.OS === "web") {
        if (
          typeof navigator === "undefined" ||
          !navigator.geolocation
        ) {
          if (isMounted) {
            setLocationError(
              "This browser does not support location services.",
            );
          }
          return;
        }

        const browserPermission =
          await getBrowserLocationPermissionState();

        if (!isMounted) return;

        // Do not open a permission popup merely by loading Home.
        // A user action such as SCAN requests it.
        if (
          browserPermission !== "granted"
        ) {
          setLocationError(null);
          return;
        }

        try {
          const firstLocation =
            await getBrowserCurrentLocation();

          if (!isMounted) return;

          const firstAccuracy =
            firstLocation.coords.accuracy ??
            Number.POSITIVE_INFINITY;

          if (
            firstAccuracy <=
            BROWSER_MAX_ACCEPTED_ACCURACY_METERS
          ) {
            const firstCoordinate =
              makeMapCoordinate(firstLocation);

            setBrowserWebCoordinate(
              firstCoordinate,
            );

            setLocationError(null);

            if (
              isUsableGpsLocation(
                firstLocation,
              )
            ) {
              saveGoodGpsPoint(
                firstLocation,
              );
            }
          } else {
            setLocationError(
              `Browser location is too approximate (${Math.round(firstAccuracy)} m). Waiting for a better fix…`,
            );
          }
        } catch (error) {
          if (__DEV__) {
            console.warn(
              "Initial browser location was not ready yet:",
              error,
            );
          }

          if (isMounted) {
            setLocationError(null);
          }
        }

        if (!isMounted) return;

        locationWatcher =
          watchBrowserLocation(
            (newLocation) => {
              if (!isMounted) return;

              const browserAccuracy =
                newLocation.coords.accuracy ??
                Number.POSITIVE_INFINITY;

              if (
                browserAccuracy >
                BROWSER_MAX_ACCEPTED_ACCURACY_METERS
              ) {
                setLocationError(
                  `Browser location is too approximate (${Math.round(browserAccuracy)} m). Waiting for a better fix…`,
                );
                return;
              }

              const tooFast =
                isOverSpeedLimit(
                  newLocation,
                );

              setIsMovingTooFast(
                tooFast,
              );

              if (!tooFast) {
                const liveCoordinate =
                  makeMapCoordinate(
                    newLocation,
                  );

                setBrowserWebCoordinate(
                  liveCoordinate,
                );

                setLocationError(null);

                // Secure raw GPS history keeps the
                // original quality filter.
                if (
                  isUsableGpsLocation(
                    newLocation,
                  )
                ) {
                  saveGoodGpsPoint(
                    newLocation,
                  );
                }
              }
            },
          );

        return;
      }

      // NATIVE
      const existingPermission =
        await Location.getForegroundPermissionsAsync();

      if (!isMounted) return;

      if (
        existingPermission.status !==
        Location.PermissionStatus.GRANTED
      ) {
        setLocationError(
          "Location permission is needed. Tap SCAN FOR COMPANION to allow location access.",
        );
        return;
      }

      if (
        !(await Location.hasServicesEnabledAsync())
      ) {
        setLocationError(
          "Location Services are off. Turn them on to explore and find Companions.",
        );
        return;
      }

      try {
        const firstLocation =
          await getFirstLocation();

        if (isMounted) {
          setLocationError(null);
          saveGoodGpsPoint(firstLocation);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "Initial GPS location was not ready yet. Waiting for live GPS...",
            error,
          );
        }

        if (isMounted) {
          setLocationError(
            "Finding your location… Move to an open area for a better GPS signal.",
          );
        }
      }

      if (!isMounted) return;

      try {
        const watcher =
          await watchLiveLocation(
            (newLocation) => {
              if (!isMounted) return;

              if (
                !isUsableGpsLocation(
                  newLocation,
                )
              ) {
                setLocationError(
                  "Improving GPS accuracy… Keep your phone in an open area.",
                );
                return;
              }

              const tooFast =
                isOverSpeedLimit(
                  newLocation,
                );

              setIsMovingTooFast(
                tooFast,
              );

              if (!tooFast) {
                setLocationError(null);
                saveGoodGpsPoint(
                  newLocation,
                );
              }
            },
          );

        if (isMounted) {
          locationWatcher = watcher;
        } else {
          watcher.remove();
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "Live GPS tracking could not start:",
            error,
          );
        }

        if (isMounted) {
          setLocationError(
            "GPS tracking could not start. Check Location Services and try again.",
          );
        }
      }
    }

    void startGpsTracking();

    return () => {
      isMounted = false;
      locationWatcher?.remove();
    };
  }, [
    saveGoodGpsPoint,
    trackingRestartKey,
  ]);

  // =====================
  // LIVE COMPASS HEADING
  // =====================

  useEffect(() => {
    if (Platform.OS === "web") {
      setPhoneHeading(null);
      return;
    }

    let headingWatcher:
      | Location.LocationSubscription
      | undefined;

    let isMounted = true;

    async function startHeadingTracking() {
      try {
        headingWatcher =
          await Location.watchHeadingAsync(
            (heading) => {
              if (!isMounted) return;

              const nextHeading =
                heading.trueHeading >= 0
                  ? heading.trueHeading
                  : heading.magHeading;

              setPhoneHeading(
                nextHeading,
              );
            },
          );
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "Compass heading unavailable:",
            error,
          );
        }
      }
    }

    void startHeadingTracking();

    return () => {
      isMounted = false;
      headingWatcher?.remove();
    };
  }, []);

  // =====================
  // FRESH LOCATION REQUEST
  // =====================

  const requestFreshLocation =
    useCallback(async () => {
      if (Platform.OS === "web") {
        if (
          typeof navigator === "undefined" ||
          !navigator.geolocation
        ) {
          throw new Error(
            "This browser does not support location services.",
          );
        }

        const permissionState =
          await getBrowserLocationPermissionState();

        if (permissionState === "denied") {
          throw new Error(
            "Location permission is blocked in Chrome. Allow Location for localhost, then try again.",
          );
        }

        if (permissionState !== "granted") {
          const permissionGranted =
            await askForBrowserLocationPermission();

          if (!permissionGranted) {
            throw new Error(
              "Mission Trail needs location permission. Click Allow when Chrome asks for your location.",
            );
          }
        }

        const freshLocation =
          await getBestBrowserCurrentLocation();

        const browserAccuracy =
          freshLocation.coords.accuracy ??
          Number.POSITIVE_INFINITY;

        if (
          browserAccuracy >
          BROWSER_MAX_ACCEPTED_ACCURACY_METERS
        ) {
          throw new Error(
            `Chrome only found an approximate location (about ${Math.round(browserAccuracy)} meters accuracy). Mission Trail will not place YOU ARE HERE at a guessed city-level location. Check Windows Location Services/Wi-Fi and scan again.`,
          );
        }

        const coordinate =
          makeMapCoordinate(freshLocation);

        setBrowserWebCoordinate(
          coordinate,
        );

        setLocationError(null);

        if (
          isUsableGpsLocation(
            freshLocation,
          )
        ) {
          saveGoodGpsPoint(
            freshLocation,
          );
        }

        return freshLocation;
      }

      const canUseLocation =
        await askForLocationPermission();

      if (!canUseLocation) {
        throw new Error(
          "Location permission is required to place and track a Companion.",
        );
      }

      let freshLocation:
        | Location.LocationObject
        | null = null;

      try {
        freshLocation =
          await Location.getCurrentPositionAsync({
            accuracy:
              Location.Accuracy.BestForNavigation,
          });
      } catch (freshLocationError) {
        if (__DEV__) {
          console.warn(
            "Fresh device GPS was unavailable; using latest accepted location if possible:",
            freshLocationError,
          );
        }

        if (
          latestGpsPoint &&
          isUsableGpsLocation(
            latestGpsPoint,
          )
        ) {
          freshLocation =
            latestGpsPoint;
        }
      }

      if (!freshLocation) {
        throw new Error(
          "No usable current GPS location is available yet. Move to an open area and try again.",
        );
      }

      saveGoodGpsPoint(freshLocation);

      setTrackingRestartKey(
        (current) => current + 1,
      );

      return freshLocation;
    }, [
      latestGpsPoint,
      saveGoodGpsPoint,
    ]);

  const requestFreshCoordinate =
    useCallback(async () => {
      const location =
        await requestFreshLocation();

      return makeMapCoordinate(location);
    }, [requestFreshLocation]);

  const restartTracking =
    useCallback(() => {
      setTrackingRestartKey(
        (current) => current + 1,
      );
    }, []);

  // =====================
  // MAP LOCATION CONTROLS
  // =====================

  const centerMapOnUser =
    useCallback(() => {
      if (
        Platform.OS === "web" &&
        browserWebCoordinate
      ) {
        mapRef?.current?.animateToRegion?.(
          {
            latitude:
              browserWebCoordinate.latitude,
            longitude:
              browserWebCoordinate.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          500,
        );

        return;
      }

      if (!latestGpsPoint) return;

      mapRef?.current?.animateToRegion?.(
        makeMapRegion(latestGpsPoint),
        500,
      );
    }, [
      browserWebCoordinate,
      latestGpsPoint,
      mapRef,
    ]);

  const zoomOutMap =
    useCallback(() => {
      if (!mapRegion) return;

      const zoomAmount = 1.45;

      const nextRegion: Region = {
        ...mapRegion,

        latitudeDelta: Math.max(
          0.002,
          Math.min(
            0.08,
            mapRegion.latitudeDelta *
              zoomAmount,
          ),
        ),

        longitudeDelta: Math.max(
          0.002,
          Math.min(
            0.08,
            mapRegion.longitudeDelta *
              zoomAmount,
          ),
        ),
      };

      setMapRegion(nextRegion);

      mapRef?.current?.animateToRegion?.(
        nextRegion,
        250,
      );
    }, [mapRef, mapRegion]);

  return {
    mapRegion,
    setMapRegion,

    gpsPoints,
    visualGpsPoints,

    latestGpsPoint,
    stablePlayerLocation,
    playerCoordinate,

    browserWebCoordinate,
    liveCoordinate,

    locationError,
    setLocationError,

    isMovingTooFast,
    phoneHeading,

    saveGoodGpsPoint,

    requestFreshLocation,
    requestFreshCoordinate,

    restartTracking,
    centerMapOnUser,
    zoomOutMap,
  };
}

export default useHomeBackupLocation;
