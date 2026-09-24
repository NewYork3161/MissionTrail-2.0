import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

import { supabase } from "../../lib/supabase";
import {
  calculateDistanceMeters,
  type Coordinate,
} from "@/utils/distance";

// ============================================================
// HOME BACKUP - COMPANION SYSTEM
// ============================================================
// Complete Companion-hunt module extracted from home-backup.tsx.
// home-backup.tsx remains the screen/controller and supplies live GPS.
// This module owns:
// - catalog loading
// - demo fallback Companions
// - destination generation
// - walking routing
// - tap/click selection
// - active route state
// - distance/collection checks
// - Supabase user_companions writes
// ============================================================

export type CompanionSearchState = "idle" | "traveling" | "found";

export type CompanionCatalogRow = {
  id: string;
  companion_key: string;
  name: string;
  description: string | null;
  rarity: string;
  model_path: string | null;
  thumbnail_path: string | null;
  base_health: number;
  base_energy: number;
};

export type CompanionRouteStep = {
  instruction: string;
  name: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  type: number | null;
  wayPoints: [number, number] | null;
};

export type CompanionWalkingRouteResult = {
  coordinates: Coordinate[];
  distanceMeters: number | null;
  duration: number | null;
  steps: CompanionRouteStep[];
};

type CompanionRoutingResponse = {
  coordinate?: Coordinate;
  formattedAddress?: string;
  coordinates?: Coordinate[];
  distanceMeters?: number | null;
  duration?: number | null;
  steps?: unknown[];
  error?: string;
};

export type CompanionMapController = {
  fitToCoordinates?: (
    coordinates: Coordinate[],
    options?: {
      edgePadding?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
      };
      animated?: boolean;
    },
  ) => void;
};

export type HomeBackupCompanionOptions = {
  userId: string | null | undefined;
  playerCoordinate: Coordinate | null;
  isMovingTooFast: boolean;
  mapRef?: { current: CompanionMapController | null };
  onError?: (message: string | null) => void;
};

export type HomeBackupCompanionSystem = {
  companionSearchState: CompanionSearchState;
  companionRoute: Coordinate[];
  companionWalkerCoordinate: Coordinate | null;
  selectedCompanion: CompanionCatalogRow | null;
  selectedCompanions: CompanionCatalogRow[];
  companionDestinations: Coordinate[];
  activeCompanionIndex: number;
  routeDistanceMeters: number | null;
  routeDurationSeconds: number | null;
  routeSteps: CompanionRouteStep[];
  nextRouteStep: CompanionRouteStep | null;
  activeDestination: Coordinate | null;
  distanceToActiveCompanionMeters: number | null;
  startCompanionSearch: (scanOrigin: Coordinate) => Promise<void>;
  selectCompanion: (index: number) => Promise<void>;
  resetCompanionSearch: () => void;
};

export const COMPANION_COLLECTION_RADIUS_METERS = 15;
export const COMPANION_MIN_SPAWN_METERS = 180;
export const COMPANION_MAX_SPAWN_METERS = 320;

const ORS_PROXY_FUNCTION = "companion-routing";

export const DEMO_COMPANIONS: CompanionCatalogRow[] = [
  {
    id: "local-demo-companion-1",
    companion_key: "companion-1",
    name: "Companion 1",
    description: "Nearby Companion",
    rarity: "Unknown",
    model_path: null,
    thumbnail_path: null,
    base_health: 100,
    base_energy: 100,
  },
  {
    id: "local-demo-companion-2",
    companion_key: "companion-2",
    name: "Companion 2",
    description: "Nearby Companion",
    rarity: "Unknown",
    model_path: null,
    thumbnail_path: null,
    base_health: 100,
    base_energy: 100,
  },
];

function createNearbyCompanionDestination(origin: Coordinate): Coordinate {
  const distanceMeters =
    COMPANION_MIN_SPAWN_METERS +
    Math.random() * (COMPANION_MAX_SPAWN_METERS - COMPANION_MIN_SPAWN_METERS);
  const bearingRadians = Math.random() * Math.PI * 2;
  const northMeters = Math.cos(bearingRadians) * distanceMeters;
  const eastMeters = Math.sin(bearingRadians) * distanceMeters;
  const latitudeOffset = northMeters / 111_320;
  const longitudeScale = Math.max(
    0.2,
    Math.cos((origin.latitude * Math.PI) / 180),
  );
  const longitudeOffset = eastMeters / (111_320 * longitudeScale);

  return {
    latitude: origin.latitude + latitudeOffset,
    longitude: origin.longitude + longitudeOffset,
  };
}

function normalizeRouteStep(value: unknown): CompanionRouteStep | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const instruction =
    typeof raw.instruction === "string"
      ? raw.instruction
      : typeof raw.text === "string"
        ? raw.text
        : "";

  if (!instruction.trim()) return null;

  const rawWayPoints = Array.isArray(raw.wayPoints)
    ? raw.wayPoints
    : Array.isArray(raw.way_points)
      ? raw.way_points
      : null;

  const wayPoints: [number, number] | null =
    rawWayPoints &&
    rawWayPoints.length >= 2 &&
    Number.isFinite(Number(rawWayPoints[0])) &&
    Number.isFinite(Number(rawWayPoints[1]))
      ? [Number(rawWayPoints[0]), Number(rawWayPoints[1])]
      : null;

  return {
    instruction,
    name: typeof raw.name === "string" ? raw.name : null,
    distanceMeters:
      typeof raw.distanceMeters === "number"
        ? raw.distanceMeters
        : typeof raw.distance === "number"
          ? raw.distance
          : null,
    durationSeconds:
      typeof raw.durationSeconds === "number"
        ? raw.durationSeconds
        : typeof raw.duration === "number"
          ? raw.duration
          : null,
    type: typeof raw.type === "number" ? raw.type : null,
    wayPoints,
  };
}

async function callCompanionRoutingProxy(
  body: Record<string, unknown>,
): Promise<CompanionRoutingResponse> {
  const { data, error } = await supabase.functions.invoke(ORS_PROXY_FUNCTION, {
    body,
  });

  if (error) {
    throw new Error(
      `Mission Trail routing service failed: ${error.message ?? "Unknown Edge Function error."}`,
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("Mission Trail routing service returned an invalid response.");
  }

  const result = data as CompanionRoutingResponse;
  if (result.error) throw new Error(result.error);
  return result;
}

export async function getCompanionWalkingRoute(
  origin: Coordinate,
  destination: Coordinate,
): Promise<CompanionWalkingRouteResult> {
  try {
    const data = await callCompanionRoutingProxy({
      action: "route",
      origin,
      destination,
    });

    const coordinates = Array.isArray(data.coordinates)
      ? data.coordinates
          .filter(
            (point): point is Coordinate =>
              !!point &&
              Number.isFinite(Number(point.latitude)) &&
              Number.isFinite(Number(point.longitude)),
          )
          .map((point) => ({
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
          }))
      : [];

    const steps = Array.isArray(data.steps)
      ? data.steps
          .map(normalizeRouteStep)
          .filter((step): step is CompanionRouteStep => step !== null)
      : [];

    if (coordinates.length >= 2) {
      return {
        coordinates,
        distanceMeters:
          typeof data.distanceMeters === "number" ? data.distanceMeters : null,
        duration: typeof data.duration === "number" ? data.duration : null,
        steps,
      };
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "Walking-route service unavailable; using straight-line fallback:",
        error,
      );
    }
  }

  return {
    coordinates: [origin, destination],
    distanceMeters: calculateDistanceMeters(origin, destination),
    duration: null,
    steps: [],
  };
}

async function createRoutableCompanionDestination(
  origin: Coordinate,
): Promise<{ destination: Coordinate; route: CompanionWalkingRouteResult }> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = createNearbyCompanionDestination(origin);

    try {
      const route = await getCompanionWalkingRoute(origin, candidate);
      const destination =
        route.coordinates[route.coordinates.length - 1] ?? candidate;

      if (calculateDistanceMeters(origin, destination) < 100) continue;
      return { destination, route };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Mission Trail could not find a nearby walkable Companion location.");
}

async function loadAvailableCompanions(
  userId: string,
): Promise<CompanionCatalogRow[]> {
  let companionsForToday: CompanionCatalogRow[] = [];

  try {
    const { data: catalogData, error: catalogError } = await supabase
      .from("companions")
      .select(
        "id, companion_key, name, description, rarity, model_path, thumbnail_path, base_health, base_energy",
      );

    if (catalogError) throw catalogError;

    const catalog = (catalogData ?? []) as CompanionCatalogRow[];

    const { data: ownedData, error: ownedError } = await supabase
      .from("user_companions")
      .select("companion_id")
      .eq("user_id", userId);

    if (ownedError) throw ownedError;

    const ownedIds = new Set(
      (ownedData ?? []).map((row) => row.companion_id),
    );

    companionsForToday = catalog
      .filter((companion) => !ownedIds.has(companion.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
  } catch (catalogError) {
    console.warn(
      "Companion catalog unavailable; using local Companion 1/2 markers:",
      catalogError,
    );
  }

  for (const demoCompanion of DEMO_COMPANIONS) {
    if (companionsForToday.length >= 2) break;
    if (!companionsForToday.some((item) => item.id === demoCompanion.id)) {
      companionsForToday.push(demoCompanion);
    }
  }

  return companionsForToday.slice(0, 2);
}

async function saveCollectedCompanion(
  userId: string,
  companion: CompanionCatalogRow,
): Promise<void> {
  if (companion.id.startsWith("local-demo-companion-")) return;

  const { error } = await supabase.from("user_companions").insert({
    user_id: userId,
    companion_id: companion.id,
    level: 1,
    xp: 0,
    bond: 0,
    energy: companion.base_energy ?? 100,
    hunger: 100,
    happiness: 100,
    health: companion.base_health ?? 100,
  });

  if (error && error.code !== "23505") throw error;
}

function fitRouteOnMap(
  mapRef: HomeBackupCompanionOptions["mapRef"],
  route: Coordinate[],
) {
  if (route.length < 2) return;

  mapRef?.current?.fitToCoordinates?.(route, {
    edgePadding: { top: 180, right: 80, bottom: 150, left: 80 },
    animated: true,
  });
}

export function useHomeBackupCompanions(
  options: HomeBackupCompanionOptions,
): HomeBackupCompanionSystem {
  const {
    userId,
    playerCoordinate,
    isMovingTooFast,
    mapRef,
    onError,
  } = options;

  const [companionSearchState, setCompanionSearchState] =
    useState<CompanionSearchState>("idle");
  const [companionRoute, setCompanionRoute] = useState<Coordinate[]>([]);
  const [companionWalkerCoordinate, setCompanionWalkerCoordinate] =
    useState<Coordinate | null>(null);
  const [selectedCompanion, setSelectedCompanion] =
    useState<CompanionCatalogRow | null>(null);
  const [selectedCompanions, setSelectedCompanions] =
    useState<CompanionCatalogRow[]>([]);
  const [companionDestinations, setCompanionDestinations] =
    useState<Coordinate[]>([]);
  const [activeCompanionIndex, setActiveCompanionIndex] = useState(0);
  const [routeDistanceMeters, setRouteDistanceMeters] =
    useState<number | null>(null);
  const [routeDurationSeconds, setRouteDurationSeconds] =
    useState<number | null>(null);
  const [routeSteps, setRouteSteps] = useState<CompanionRouteStep[]>([]);

  const companionCollectingRef = useRef(false);
  const routeRequestIdRef = useRef(0);

  const activeDestination =
    companionDestinations[activeCompanionIndex] ?? null;

  const distanceToActiveCompanionMeters = useMemo(() => {
    if (!playerCoordinate || !activeDestination) return null;
    return calculateDistanceMeters(playerCoordinate, activeDestination);
  }, [activeDestination, playerCoordinate]);

  const nextRouteStep = routeSteps[0] ?? null;

  const applyRoute = useCallback(
    (route: CompanionWalkingRouteResult, walker: Coordinate) => {
      setCompanionRoute(route.coordinates);
      setCompanionWalkerCoordinate(walker);
      setRouteDistanceMeters(route.distanceMeters);
      setRouteDurationSeconds(route.duration);
      setRouteSteps(route.steps);
      fitRouteOnMap(mapRef, route.coordinates);
    },
    [mapRef],
  );

  const selectCompanion = useCallback(
    async (index: number) => {
      const companion = selectedCompanions[index];
      const destination = companionDestinations[index];

      if (!companion || !destination) return;

      if (!playerCoordinate) {
        const message =
          "Mission Trail needs your current location before it can route to that Companion.";
        onError?.(message);
        Alert.alert("LOCATION REQUIRED", message);
        return;
      }

      const requestId = ++routeRequestIdRef.current;
      companionCollectingRef.current = false;

      setActiveCompanionIndex(index);
      setSelectedCompanion(companion);
      setCompanionSearchState("traveling");
      setCompanionWalkerCoordinate(playerCoordinate);
      onError?.(null);

      try {
        const route = await getCompanionWalkingRoute(
          playerCoordinate,
          destination,
        );

        if (routeRequestIdRef.current !== requestId) return;
        applyRoute(route, playerCoordinate);
      } catch (error) {
        if (routeRequestIdRef.current !== requestId) return;

        const message =
          error instanceof Error
            ? error.message
            : "Mission Trail could not calculate the walking route.";

        console.error("Could not route to selected Companion:", error);
        onError?.(message);
        Alert.alert("ROUTE UNAVAILABLE", message);
      }
    },
    [
      applyRoute,
      companionDestinations,
      onError,
      playerCoordinate,
      selectedCompanions,
    ],
  );

  const startCompanionSearch = useCallback(
    async (scanOrigin: Coordinate) => {
      if (!userId) {
        Alert.alert(
          "SIGN IN REQUIRED",
          "Sign in before searching for a Companion.",
        );
        return;
      }

      try {
        onError?.(null);

        const companions = await loadAvailableCompanions(userId);
        if (companions.length === 0) {
          throw new Error("Mission Trail could not find any available Companions.");
        }

        const routed = [];
        for (let index = 0; index < companions.length; index += 1) {
          routed.push(await createRoutableCompanionDestination(scanOrigin));
        }

        const destinations = routed.map((item) => item.destination);
        const firstRoute = routed[0]?.route;

        if (!destinations[0] || !firstRoute || firstRoute.coordinates.length < 2) {
          throw new Error("Mission Trail could not create a walking Companion route.");
        }

        routeRequestIdRef.current += 1;
        companionCollectingRef.current = false;

        setSelectedCompanions(companions);
        setCompanionDestinations(destinations);
        setActiveCompanionIndex(0);
        setSelectedCompanion(companions[0]);
        setCompanionSearchState("traveling");
        applyRoute(firstRoute, scanOrigin);
      } catch (error) {
        console.error("Could not start Companion search:", error);

        const message =
          error instanceof Error ? error.message : "Companion search failed.";

        setCompanionSearchState("idle");
        onError?.(message);
        Alert.alert("COMPANION SEARCH FAILED", message);
      }
    },
    [applyRoute, onError, userId],
  );

  const resetCompanionSearch = useCallback(() => {
    routeRequestIdRef.current += 1;
    companionCollectingRef.current = false;
    setCompanionSearchState("idle");
    setCompanionRoute([]);
    setCompanionWalkerCoordinate(null);
    setSelectedCompanion(null);
    setSelectedCompanions([]);
    setCompanionDestinations([]);
    setActiveCompanionIndex(0);
    setRouteDistanceMeters(null);
    setRouteDurationSeconds(null);
    setRouteSteps([]);
  }, []);

  useEffect(() => {
    if (companionSearchState !== "traveling" || !playerCoordinate) return;
    setCompanionWalkerCoordinate(playerCoordinate);
  }, [companionSearchState, playerCoordinate]);

  useEffect(() => {
    const companion = selectedCompanions[activeCompanionIndex];
    const destination = companionDestinations[activeCompanionIndex];

    if (
      companionSearchState !== "traveling" ||
      !playerCoordinate ||
      !companion ||
      !destination ||
      !userId ||
      companionCollectingRef.current
    ) {
      return;
    }

    const distanceMeters = calculateDistanceMeters(
      playerCoordinate,
      destination,
    );

    if (distanceMeters > COMPANION_COLLECTION_RADIUS_METERS) return;
    if (isMovingTooFast) return;

    companionCollectingRef.current = true;

    void (async () => {
      try {
        await saveCollectedCompanion(userId, companion);

        const otherIndex = selectedCompanions.findIndex(
          (_, index) =>
            index !== activeCompanionIndex &&
            companionDestinations[index] !== undefined,
        );

        if (otherIndex >= 0) {
          const continueToOther = () => {
            companionCollectingRef.current = false;
            void selectCompanion(otherIndex);
          };

          if (Platform.OS === "web") {
            continueToOther();
          } else {
            Alert.alert(
              "COMPANION FOUND",
              `${companion.name} was added to your collection. Continue to the other Companion?`,
              [
                {
                  text: "No",
                  style: "cancel",
                  onPress: () => {
                    setCompanionWalkerCoordinate(destination);
                    setCompanionSearchState("found");
                    companionCollectingRef.current = false;
                  },
                },
                { text: "Yes", onPress: continueToOther },
              ],
            );
          }
          return;
        }

        setCompanionWalkerCoordinate(destination);
        setCompanionSearchState("found");
        setCompanionRoute([]);
        setRouteDistanceMeters(0);
        setRouteDurationSeconds(0);
        setRouteSteps([]);
        companionCollectingRef.current = false;

        Alert.alert(
          "COMPANION FOUND",
          `${companion.name} has been added to your Companion collection.`,
        );
      } catch (error) {
        console.error("Could not save Companion collection:", error);
        companionCollectingRef.current = false;
        Alert.alert(
          "SAVE FAILED",
          "You reached the Companion, but it could not be saved. Please try again.",
        );
      }
    })();
  }, [
    activeCompanionIndex,
    companionDestinations,
    companionSearchState,
    isMovingTooFast,
    playerCoordinate,
    selectCompanion,
    selectedCompanions,
    userId,
  ]);

  return {
    companionSearchState,
    companionRoute,
    companionWalkerCoordinate,
    selectedCompanion,
    selectedCompanions,
    companionDestinations,
    activeCompanionIndex,
    routeDistanceMeters,
    routeDurationSeconds,
    routeSteps,
    nextRouteStep,
    activeDestination,
    distanceToActiveCompanionMeters,
    startCompanionSearch,
    selectCompanion,
    resetCompanionSearch,
  };
}

export default useHomeBackupCompanions;
