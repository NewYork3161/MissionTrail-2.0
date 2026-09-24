import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Alert,
  Platform,
} from "react-native";

import { supabase } from "../../lib/supabase";

import {
  calculateDistanceMeters,
  type Coordinate,
} from "@/utils/distance";

// ============================================================
// HOME BACKUP - COMPANION SYSTEM
// ============================================================
//
// This module owns:
//
// - catalog loading
// - demo fallback Companions
// - destination generation
// - walking routing
// - tap/click selection
// - active route state
// - LIVE GPS rerouting
// - distance/collection checks
// - Supabase user_companions writes
//
// IMPORTANT:
//
// Scanning discovers and places Companions.
//
// Scanning DOES NOT automatically select a Companion.
//
// The user must click/tap Companion 1 or Companion 2.
//
// Once selected:
//
// 1. A walking route is requested.
// 2. YOU ARE HERE follows the real GPS.
// 3. The route is periodically recalculated as the user moves.
// 4. The selected Companion remains the destination.
// 5. Clicking the other Companion switches destinations.
//
// ============================================================


// ============================================================
// TYPES
// ============================================================

export type CompanionSearchState =
  | "idle"
  | "searching"
  | "ready"
  | "traveling"
  | "found";


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
  instructions?: unknown[];
  error?: string;
  success?: boolean;
  data?: unknown;
  route?: unknown;
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

  mapRef?: {
    current: CompanionMapController | null;
  };

  onError?: (
    message: string | null
  ) => void;
};


export type HomeBackupCompanionSystem = {
  companionSearchState: CompanionSearchState;

  companionRoute: Coordinate[];

  companionWalkerCoordinate:
    Coordinate | null;

  selectedCompanion:
    CompanionCatalogRow | null;

  selectedCompanions:
    CompanionCatalogRow[];

  companionDestinations:
    Coordinate[];

  activeCompanionIndex:
    number;

  routeDistanceMeters:
    number | null;

  routeDurationSeconds:
    number | null;

  routeSteps:
    CompanionRouteStep[];

  nextRouteStep:
    CompanionRouteStep | null;

  activeDestination:
    Coordinate | null;

  distanceToActiveCompanionMeters:
    number | null;

  startCompanionSearch: (
    scanOrigin: Coordinate
  ) => Promise<void>;

  selectCompanion: (
    index: number
  ) => Promise<void>;

  resetCompanionSearch: () => void;
};


// ============================================================
// CONSTANTS
// ============================================================

export const COMPANION_COLLECTION_RADIUS_METERS =
  15;


export const COMPANION_MIN_SPAWN_METERS =
  180;


export const COMPANION_MAX_SPAWN_METERS =
  320;


const ORS_PROXY_FUNCTION =
  "companion-routing";


// ============================================================
// LIVE ROUTING SETTINGS
// ============================================================
//
// GPS itself may update every few seconds.
//
// We do NOT want to hit OpenRouteService every time the GPS
// changes.
//
// Instead:
//
// - YOU ARE HERE updates immediately.
// - Route recalculation occurs after meaningful movement.
// - A minimum amount of time must pass between route requests.
//
// ============================================================

const COMPANION_REROUTE_DISTANCE_METERS =
  25;


const COMPANION_REROUTE_MIN_INTERVAL_MS =
  8_000;


// ============================================================
// DEMO COMPANIONS
// ============================================================

export const DEMO_COMPANIONS:
CompanionCatalogRow[] = [
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


// ============================================================
// CREATE NEARBY DESTINATION
// ============================================================

function createNearbyCompanionDestination(
  origin: Coordinate
): Coordinate {

  const distanceMeters =
    COMPANION_MIN_SPAWN_METERS +
    Math.random() *
      (
        COMPANION_MAX_SPAWN_METERS -
        COMPANION_MIN_SPAWN_METERS
      );


  const bearingRadians =
    Math.random() *
    Math.PI *
    2;


  const northMeters =
    Math.cos(
      bearingRadians
    ) *
    distanceMeters;


  const eastMeters =
    Math.sin(
      bearingRadians
    ) *
    distanceMeters;


  const latitudeOffset =
    northMeters /
    111_320;


  const longitudeScale =
    Math.max(
      0.2,

      Math.cos(
        (
          origin.latitude *
          Math.PI
        ) /
        180
      ),
    );


  const longitudeOffset =
    eastMeters /
    (
      111_320 *
      longitudeScale
    );


  return {
    latitude:
      origin.latitude +
      latitudeOffset,

    longitude:
      origin.longitude +
      longitudeOffset,
  };
}


// ============================================================
// NORMALIZE ROUTE STEP
// ============================================================

function normalizeRouteStep(
  value: unknown
): CompanionRouteStep | null {

  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }


  const raw =
    value as Record<
      string,
      unknown
    >;


  const instruction =
    typeof raw.instruction ===
    "string"
      ? raw.instruction

      : typeof raw.text ===
          "string"
        ? raw.text
        : "";


  if (
    !instruction.trim()
  ) {
    return null;
  }


  const rawWayPoints =
    Array.isArray(
      raw.wayPoints
    )
      ? raw.wayPoints

      : Array.isArray(
          raw.way_points
        )
        ? raw.way_points
        : null;


  const wayPointIndex =
    typeof raw.wayPointIndex ===
      "number" &&
    Number.isFinite(
      raw.wayPointIndex
    )
      ? raw.wayPointIndex
      : null;


  const wayPoints:
  [number, number] | null =

    rawWayPoints &&
    rawWayPoints.length >= 2 &&
    Number.isFinite(
      Number(
        rawWayPoints[0]
      )
    ) &&
    Number.isFinite(
      Number(
        rawWayPoints[1]
      )
    )

      ? [
          Number(
            rawWayPoints[0]
          ),

          Number(
            rawWayPoints[1]
          ),
        ]

      : wayPointIndex !==
          null

        ? [
            wayPointIndex,
            wayPointIndex,
          ]

        : null;


  return {
    instruction,

    name:
      typeof raw.streetName ===
      "string"
        ? raw.streetName

        : typeof raw.name ===
            "string"
          ? raw.name
          : null,

    distanceMeters:
      typeof raw.distanceMeters ===
      "number"
        ? raw.distanceMeters

        : typeof raw.distance ===
            "number"
          ? raw.distance
          : null,

    durationSeconds:
      typeof raw.durationSeconds ===
      "number"
        ? raw.durationSeconds

        : typeof raw.duration ===
            "number"
          ? raw.duration
          : null,

    type:
      typeof raw.maneuverType ===
      "number"
        ? raw.maneuverType

        : typeof raw.type ===
            "number"
          ? raw.type
          : null,

    wayPoints,
  };
}


// ============================================================
// CALL ROUTING EDGE FUNCTION
// ============================================================

async function callCompanionRoutingProxy(
  body: Record<string, unknown>,
): Promise<CompanionRoutingResponse> {
  const { data: sessionData } =
    await supabase.auth.getSession();

  const accessToken =
    sessionData?.session?.access_token;

  const unwrapRoutingResponse = (
    value: unknown,
  ): CompanionRoutingResponse => {
    if (!value || typeof value !== "object") {
      throw new Error(
        "Mission Trail routing service returned an invalid response.",
      );
    }

    const root = value as Record<string, unknown>;

    if (
      typeof root.error === "string" &&
      root.error.trim()
    ) {
      throw new Error(root.error);
    }

    const nestedCandidates = [
      root,
      root.data,
      root.route,
      root.data && typeof root.data === "object"
        ? (root.data as Record<string, unknown>).route
        : undefined,
    ];

    for (const candidate of nestedCandidates) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }

      const objectCandidate =
        candidate as Record<string, unknown>;

      if (
        typeof objectCandidate.error === "string" &&
        objectCandidate.error.trim()
      ) {
        throw new Error(objectCandidate.error);
      }

      if (
        Array.isArray(objectCandidate.coordinates) ||
        objectCandidate.coordinate
      ) {
        return objectCandidate as CompanionRoutingResponse;
      }
    }

    if (__DEV__) {
      console.error(
        "[COMPANION ROUTING] Unexpected Edge Function payload:",
        value,
      );
    }

    throw new Error(
      "Mission Trail routing service returned a response, but it did not contain route coordinates.",
    );
  };

  let invokeResult;

  try {
    invokeResult =
      await supabase.functions.invoke(
        ORS_PROXY_FUNCTION,
        {
          body,
          headers: accessToken
            ? {
                Authorization:
                  `Bearer ${accessToken}`,
              }
            : undefined,
        },
      );
  } catch (networkErr) {
    const supabaseUrl =
      process.env.EXPO_PUBLIC_SUPABASE_URL;

    const anonKey =
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && anonKey) {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/${ORS_PROXY_FUNCTION}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: accessToken
              ? `Bearer ${accessToken}`
              : `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify(body),
        },
      );

      const responseText =
        await response.text();

      let json: unknown = null;

      if (responseText.trim()) {
        try {
          json = JSON.parse(responseText);
        } catch {
          json = null;
        }
      }

      if (!response.ok) {
        const apiMessage =
          json &&
          typeof json === "object" &&
          typeof (json as Record<string, unknown>).error === "string"
            ? String(
                (json as Record<string, unknown>).error,
              )
            : responseText.trim();

        throw new Error(
          apiMessage ||
            `Edge Function returned status ${response.status}.`,
        );
      }

      return unwrapRoutingResponse(json);
    }

    throw networkErr;
  }

  const { data, error } = invokeResult;

  if (error) {
    let details = "";

    const context =
      (error as any)?.context;

    if (context) {
      try {
        if (typeof context.clone === "function") {
          const bodyText =
            await context.clone().text();

          if (bodyText?.trim()) {
            details = ` ${bodyText.trim()}`;
          }
        } else if (typeof context.text === "function") {
          const bodyText =
            await context.text();

          if (bodyText?.trim()) {
            details = ` ${bodyText.trim()}`;
          }
        }
      } catch {
        // Keep the normal Supabase error if its body cannot be read.
      }
    }

    throw new Error(
      `Mission Trail routing service failed: ${
        error.message ??
        "Unknown Edge Function error."
      }${details}`,
    );
  }

  return unwrapRoutingResponse(data);
}


// ============================================================
// GET WALKING ROUTE
// ============================================================

export async function getCompanionWalkingRoute(
  origin: Coordinate,
  destination: Coordinate,
): Promise<CompanionWalkingRouteResult> {

  try {

    const data =
      await callCompanionRoutingProxy(
        {
          action:
            "route",

          origin,

          destination,
        }
      );


    const coordinates =
      Array.isArray(
        data.coordinates
      )

        ? data.coordinates
            .filter(
              (
                point
              ): point is Coordinate =>

                !!point &&

                Number.isFinite(
                  Number(
                    point.latitude
                  )
                ) &&

                Number.isFinite(
                  Number(
                    point.longitude
                  )
                ),
            )

            .map(
              (
                point
              ) => ({
                latitude:
                  Number(
                    point.latitude
                  ),

                longitude:
                  Number(
                    point.longitude
                  ),
              })
            )

        : [];


    const steps =
      Array.isArray(
        data.instructions
      )

        ? data.instructions
            .map(
              normalizeRouteStep
            )

            .filter(
              (
                step
              ): step is CompanionRouteStep =>
                step !== null
            )

        : [];


    if (
      coordinates.length >= 2
    ) {

      return {
        coordinates,

        distanceMeters:
          typeof data.distanceMeters ===
          "number"
            ? data.distanceMeters
            : null,

        duration:
          typeof data.duration ===
          "number"
            ? data.duration
            : null,

        steps,
      };
    }

  } catch (
    error
  ) {

    if (
      __DEV__
    ) {

      console.warn(
        "Walking-route service unavailable:",
        error
      );
    }


    throw error instanceof Error
      ? error
      : new Error(
          "Mission Trail could not calculate a real walking route."
        );
  }


  if (__DEV__) {
    console.error(
      "[COMPANION ROUTING] Route payload contained fewer than two valid coordinates.",
    );
  }

  throw new Error(
    "Mission Trail routing service did not return at least two valid walking-route coordinates."
  );
}


// ============================================================
// LOAD AVAILABLE COMPANIONS
// ============================================================

async function loadAvailableCompanions(
  userId: string,
): Promise<
  CompanionCatalogRow[]
> {

  let companionsForToday:
    CompanionCatalogRow[] =
      [];


  try {

    const {
      data:
        catalogData,

      error:
        catalogError,
    } =
      await supabase
        .from(
          "companions"
        )

        .select(
          "id, companion_key, name, description, rarity, model_path, thumbnail_path, base_health, base_energy"
        );


    if (
      catalogError
    ) {
      throw catalogError;
    }


    const catalog =
      (
        catalogData ??
        []
      ) as
        CompanionCatalogRow[];


    const {
      data:
        ownedData,

      error:
        ownedError,
    } =
      await supabase
        .from(
          "user_companions"
        )

        .select(
          "companion_id"
        )

        .eq(
          "user_id",
          userId
        );


    if (
      ownedError
    ) {
      throw ownedError;
    }


    const ownedIds =
      new Set(
        (
          ownedData ??
          []
        ).map(
          (
            row
          ) =>
            row.companion_id
        )
      );


    companionsForToday =
      catalog
        .filter(
          (
            companion
          ) =>
            !ownedIds.has(
              companion.id
            )
        )

        .sort(
          () =>
            Math.random() -
            0.5
        )

        .slice(
          0,
          2
        );

  } catch (
    catalogError
  ) {

    console.warn(
      "Companion catalog unavailable; using local Companion 1/2 markers:",
      catalogError
    );
  }


  for (
    const demoCompanion
    of DEMO_COMPANIONS
  ) {

    if (
      companionsForToday.length >=
      2
    ) {
      break;
    }


    if (
      !companionsForToday.some(
        (
          item
        ) =>
          item.id ===
          demoCompanion.id
      )
    ) {

      companionsForToday.push(
        demoCompanion
      );
    }
  }


  return companionsForToday.slice(
    0,
    2
  );
}


// ============================================================
// SAVE COLLECTED COMPANION
// ============================================================

async function saveCollectedCompanion(
  userId: string,

  companion:
    CompanionCatalogRow,
): Promise<void> {

  if (
    companion.id.startsWith(
      "local-demo-companion-"
    )
  ) {
    return;
  }


  const {
    error,
  } =
    await supabase
      .from(
        "user_companions"
      )

      .insert({
        user_id:
          userId,

        companion_id:
          companion.id,

        level:
          1,

        xp:
          0,

        bond:
          0,

        energy:
          companion.base_energy ??
          100,

        hunger:
          100,

        happiness:
          100,

        health:
          companion.base_health ??
          100,
      });


  if (
    error &&
    error.code !==
      "23505"
  ) {

    throw error;
  }
}


// ============================================================
// FIT ROUTE ON MAP
// ============================================================

function fitRouteOnMap(
  mapRef:
    HomeBackupCompanionOptions[
      "mapRef"
    ],

  route:
    Coordinate[],
) {

  if (
    route.length < 2
  ) {
    return;
  }


  mapRef
    ?.current
    ?.fitToCoordinates
    ?.(
      route,
      {
        edgePadding: {
          top:
            180,

          right:
            80,

          bottom:
            150,

          left:
            80,
        },

        animated:
          true,
      },
    );
}


// ============================================================
// HOOK
// ============================================================

export function useHomeBackupCompanions(
  options:
    HomeBackupCompanionOptions,
): HomeBackupCompanionSystem {

  const {
    userId,
    playerCoordinate,
    isMovingTooFast,
    mapRef,
    onError,
  } =
    options;


  // ==========================================================
  // STATE
  // ==========================================================

  const [
    companionSearchState,
    setCompanionSearchState,
  ] =
    useState<
      CompanionSearchState
    >(
      "idle"
    );


  const [
    companionRoute,
    setCompanionRoute,
  ] =
    useState<
      Coordinate[]
    >(
      []
    );


  const [
    companionWalkerCoordinate,
    setCompanionWalkerCoordinate,
  ] =
    useState<
      Coordinate | null
    >(
      null
    );


  const [
    selectedCompanion,
    setSelectedCompanion,
  ] =
    useState<
      CompanionCatalogRow | null
    >(
      null
    );


  const [
    selectedCompanions,
    setSelectedCompanions,
  ] =
    useState<
      CompanionCatalogRow[]
    >(
      []
    );


  const [
    companionDestinations,
    setCompanionDestinations,
  ] =
    useState<
      Coordinate[]
    >(
      []
    );


  // -1 means:
  // Companions are visible but no Companion is selected.
  const [
    activeCompanionIndex,
    setActiveCompanionIndex,
  ] =
    useState(
      -1
    );


  const [
    routeDistanceMeters,
    setRouteDistanceMeters,
  ] =
    useState<
      number | null
    >(
      null
    );


  const [
    routeDurationSeconds,
    setRouteDurationSeconds,
  ] =
    useState<
      number | null
    >(
      null
    );


  const [
    routeSteps,
    setRouteSteps,
  ] =
    useState<
      CompanionRouteStep[]
    >(
      []
    );


  // ==========================================================
  // REFS
  // ==========================================================

  const companionCollectingRef =
    useRef(
      false
    );


  // Every routing request receives an ID.
  //
  // If the user clicks the other Companion before the previous
  // route finishes, the old response is ignored.
  const routeRequestIdRef =
    useRef(
      0
    );


  // Prevent overlapping automatic reroute requests.
  const rerouteInProgressRef =
    useRef(
      false
    );


  // Position from which the currently displayed route was
  // calculated.
  const lastRoutedPlayerCoordinateRef =
    useRef<
      Coordinate | null
    >(
      null
    );


  // Time of the most recent route request.
  const lastRouteRequestAtRef =
    useRef(
      0
    );


  // ==========================================================
  // ACTIVE DESTINATION
  // ==========================================================

  const activeDestination =
    activeCompanionIndex >=
    0

      ? companionDestinations[
          activeCompanionIndex
        ] ??
        null

      : null;


  // ==========================================================
  // DISTANCE TO ACTIVE COMPANION
  // ==========================================================

  const distanceToActiveCompanionMeters =
    useMemo(
      () => {

        if (
          !playerCoordinate ||
          !activeDestination
        ) {
          return null;
        }


        return calculateDistanceMeters(
          playerCoordinate,
          activeDestination
        );

      },
      [
        activeDestination,
        playerCoordinate,
      ],
    );


  // ==========================================================
  // NEXT ROUTE STEP
  // ==========================================================

  const nextRouteStep =
    routeSteps[0] ??
    null;


  // ==========================================================
  // APPLY ROUTE
  // ==========================================================

  const applyRoute =
    useCallback(
      (
        route:
          CompanionWalkingRouteResult,

        walker:
          Coordinate,

        fitMap = true,
      ) => {

        setCompanionRoute(
          route.coordinates
        );


        setCompanionWalkerCoordinate(
          walker
        );


        setRouteDistanceMeters(
          route.distanceMeters
        );


        setRouteDurationSeconds(
          route.duration
        );


        setRouteSteps(
          route.steps
        );


        lastRoutedPlayerCoordinateRef.current =
          walker;


        if (
          fitMap
        ) {

          fitRouteOnMap(
            mapRef,
            route.coordinates
          );
        }

      },
      [
        mapRef,
      ],
    );


  // ==========================================================
  // SELECT COMPANION
  // ==========================================================
  //
  // Called when the user taps Companion 1 or Companion 2.
  //
  // The route starts ONLY after this function is called.
  // ==========================================================

  const selectCompanion =
    useCallback(
      async (
        index:
          number
      ) => {

        const companion =
          selectedCompanions[
            index
          ];


        const destination =
          companionDestinations[
            index
          ];


        if (
          !companion ||
          !destination
        ) {
          return;
        }


        if (
          !playerCoordinate
        ) {

          const message =
            "Mission Trail needs your current location before it can route to that Companion.";


          onError?.(
            message
          );


          Alert.alert(
            "LOCATION REQUIRED",
            message
          );


          return;
        }


        // Cancel any older manual or automatic route request.
        const requestId =
          ++routeRequestIdRef.current;


        rerouteInProgressRef.current =
          false;


        companionCollectingRef.current =
          false;


        lastRoutedPlayerCoordinateRef.current =
          playerCoordinate;


        lastRouteRequestAtRef.current =
          Date.now();


        // Clear the old route immediately when switching targets.
        setCompanionRoute(
          []
        );


        setRouteDistanceMeters(
          null
        );


        setRouteDurationSeconds(
          null
        );


        setRouteSteps(
          []
        );


        setActiveCompanionIndex(
          index
        );


        setSelectedCompanion(
          companion
        );


        setCompanionSearchState(
          "traveling"
        );


        setCompanionWalkerCoordinate(
          playerCoordinate
        );


        onError?.(
          null
        );


        try {

          const route =
            await getCompanionWalkingRoute(
              playerCoordinate,
              destination
            );


          // The user may have clicked the other Companion while
          // this request was still running.
          if (
            routeRequestIdRef.current !==
            requestId
          ) {
            return;
          }


          applyRoute(
            route,
            playerCoordinate,
            true
          );

        } catch (
          error
        ) {

          if (
            routeRequestIdRef.current !==
            requestId
          ) {
            return;
          }


          const message =
            error instanceof Error
              ? error.message
              : "Mission Trail could not calculate the walking route.";


          console.error(
            "Could not route to selected Companion:",
            error
          );


          onError?.(
            message
          );


          Alert.alert(
            "ROUTE UNAVAILABLE",
            message
          );
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


  // ==========================================================
  // START COMPANION SEARCH
  // ==========================================================
  //
  // Scanning ONLY discovers and places the two Companions.
  //
  // IMPORTANT:
  //
  // Do NOT call OpenRouteService during the scan.
  // The user must tap Companion 1 or Companion 2 first.
  // selectCompanion() owns the initial walking-route request.
  // ==========================================================

  const startCompanionSearch =
    useCallback(
      async (
        scanOrigin:
          Coordinate
      ) => {

        if (
          !userId
        ) {

          Alert.alert(
            "SIGN IN REQUIRED",
            "Sign in before searching for a Companion."
          );

          return;
        }

        try {

          onError?.(
            null
          );

          setCompanionSearchState(
            "searching"
          );

          // Cancel any old route/reroute request.
          routeRequestIdRef.current +=
            1;

          rerouteInProgressRef.current =
            false;

          companionCollectingRef.current =
            false;

          lastRoutedPlayerCoordinateRef.current =
            null;

          lastRouteRequestAtRef.current =
            0;

          // Clear the previous active route and selection.
          setCompanionRoute(
            []
          );

          setRouteDistanceMeters(
            null
          );

          setRouteDurationSeconds(
            null
          );

          setRouteSteps(
            []
          );

          setSelectedCompanion(
            null
          );

          setActiveCompanionIndex(
            -1
          );

          setCompanionWalkerCoordinate(
            scanOrigin
          );

          const companions =
            await loadAvailableCompanions(
              userId
            );

          if (
            companions.length ===
            0
          ) {

            throw new Error(
              "Mission Trail could not find any available Companions."
            );
          }

          // ==================================================
          // PLACE COMPANION MARKERS ONLY
          // ==================================================
          //
          // This is intentionally NOT a routing operation.
          //
          // Previously the scan called
          // createRoutableCompanionDestination(), which meant a
          // failed walking-route request killed the entire scan.
          //
          // Now the scan simply creates nearby destinations.
          // Routing begins only after the user taps a marker.
          // ==================================================

          const destinations =
            companions.map(
              () =>
                createNearbyCompanionDestination(
                  scanOrigin
                )
            );

          if (
            destinations.length ===
            0
          ) {

            throw new Error(
              "Mission Trail could not create Companion destinations."
            );
          }

          setSelectedCompanions(
            companions
          );

          setCompanionDestinations(
            destinations
          );

          setSelectedCompanion(
            null
          );

          setActiveCompanionIndex(
            -1
          );

          setCompanionRoute(
            []
          );

          setRouteDistanceMeters(
            null
          );

          setRouteDurationSeconds(
            null
          );

          setRouteSteps(
            []
          );

          // Both markers are now visible.
          // Wait for the user to tap one.
          setCompanionSearchState(
            "ready"
          );

        } catch (
          error
        ) {

          console.error(
            "Could not start Companion search:",
            error
          );

          const message =
            error instanceof Error
              ? error.message
              : "Companion search failed.";

          setCompanionSearchState(
            "idle"
          );

          setSelectedCompanion(
            null
          );

          setSelectedCompanions(
            []
          );

          setCompanionDestinations(
            []
          );

          setActiveCompanionIndex(
            -1
          );

          setCompanionRoute(
            []
          );

          setRouteDistanceMeters(
            null
          );

          setRouteDurationSeconds(
            null
          );

          setRouteSteps(
            []
          );

          rerouteInProgressRef.current =
            false;

          lastRoutedPlayerCoordinateRef.current =
            null;

          lastRouteRequestAtRef.current =
            0;

          onError?.(
            message
          );

          Alert.alert(
            "COMPANION SEARCH FAILED",
            message
          );
        }
      },
      [
        onError,
        userId,
      ],
    );


  // ==========================================================
  // RESET COMPANION SEARCH
  // ==========================================================

  const resetCompanionSearch =
    useCallback(
      () => {

        // Cancel any outstanding route response.
        routeRequestIdRef.current +=
          1;


        rerouteInProgressRef.current =
          false;


        companionCollectingRef.current =
          false;


        lastRoutedPlayerCoordinateRef.current =
          null;


        lastRouteRequestAtRef.current =
          0;


        setCompanionSearchState(
          "idle"
        );


        setCompanionRoute(
          []
        );


        setCompanionWalkerCoordinate(
          null
        );


        setSelectedCompanion(
          null
        );


        setSelectedCompanions(
          []
        );


        setCompanionDestinations(
          []
        );


        setActiveCompanionIndex(
          -1
        );


        setRouteDistanceMeters(
          null
        );


        setRouteDurationSeconds(
          null
        );


        setRouteSteps(
          []
        );

      },
      [],
    );


  // ==========================================================
  // LIVE PLAYER POSITION
  // ==========================================================
  //
  // YOU ARE HERE moves immediately whenever the controller
  // provides a new accepted GPS coordinate.
  //
  // This does NOT wait for a route recalculation.
  // ==========================================================

  useEffect(
    () => {

      if (
        companionSearchState !==
          "traveling" ||
        !playerCoordinate
      ) {
        return;
      }


      setCompanionWalkerCoordinate(
        playerCoordinate
      );

    },
    [
      companionSearchState,
      playerCoordinate,
    ],
  );


  // ==========================================================
  // LIVE WALKING REROUTE
  // ==========================================================
  //
  // This is the new behavior.
  //
  // While traveling:
  //
  // - watch the real GPS coordinate
  // - keep the selected Companion as the destination
  // - don't call the API for tiny GPS changes
  // - reroute after meaningful movement
  // - throttle route requests
  // - ignore stale responses
  //
  // ==========================================================

  useEffect(
    () => {

      if (
        companionSearchState !==
          "traveling"
      ) {
        return;
      }


      if (
        !playerCoordinate ||
        !activeDestination
      ) {
        return;
      }


      // If the user is moving at an invalid speed, do not
      // perform automatic rerouting.
      if (
        isMovingTooFast
      ) {
        return;
      }


      // Do not reroute once we're inside collection distance.
      const distanceToDestination =
        calculateDistanceMeters(
          playerCoordinate,
          activeDestination
        );


      if (
        distanceToDestination <=
        COMPANION_COLLECTION_RADIUS_METERS
      ) {
        return;
      }


      const previousRouteOrigin =
        lastRoutedPlayerCoordinateRef.current;


      // The initial manual selection normally establishes this.
      //
      // This fallback protects against state restoration or a
      // future code path that enters traveling mode directly.
      if (
        !previousRouteOrigin
      ) {

        lastRoutedPlayerCoordinateRef.current =
          playerCoordinate;

        return;
      }


      const movedSinceLastRoute =
        calculateDistanceMeters(
          previousRouteOrigin,
          playerCoordinate
        );


      // Ignore small GPS movement / GPS wobble.
      if (
        movedSinceLastRoute <
        COMPANION_REROUTE_DISTANCE_METERS
      ) {
        return;
      }


      // Don't allow two automatic reroutes at once.
      if (
        rerouteInProgressRef.current
      ) {
        return;
      }


      const now =
        Date.now();


      const elapsedSinceLastRequest =
        now -
        lastRouteRequestAtRef.current;


      // Throttle the routing service.
      if (
        elapsedSinceLastRequest <
        COMPANION_REROUTE_MIN_INTERVAL_MS
      ) {
        return;
      }


      rerouteInProgressRef.current =
        true;


      lastRouteRequestAtRef.current =
        now;


      const routeOrigin =
        playerCoordinate;


      const destination =
        activeDestination;


      const requestId =
        ++routeRequestIdRef.current;


      void (
        async () => {

          try {

            const route =
              await getCompanionWalkingRoute(
                routeOrigin,
                destination
              );


            // Ignore this response if another selection,
            // reroute, scan, or reset superseded it.
            if (
              routeRequestIdRef.current !==
              requestId
            ) {
              return;
            }


            // Apply the updated route without repeatedly
            // zooming/reframing the map every time the user
            // walks 25 meters.
            applyRoute(
              route,
              routeOrigin,
              false
            );


            onError?.(
              null
            );

          } catch (
            error
          ) {

            // A failed automatic reroute should NOT destroy the
            // existing route.
            //
            // Keep the current route visible and try again after
            // the user moves farther.
            if (
              routeRequestIdRef.current ===
              requestId
            ) {

              if (
                __DEV__
              ) {

                console.warn(
                  "Live Companion reroute failed:",
                  error
                );
              }
            }

          } finally {

            if (
              routeRequestIdRef.current ===
              requestId
            ) {

              rerouteInProgressRef.current =
                false;
            }
          }
        }
      )();

    },
    [
      activeDestination,
      applyRoute,
      companionSearchState,
      isMovingTooFast,
      onError,
      playerCoordinate,
    ],
  );


  // ==========================================================
  // COLLECTION CHECK
  // ==========================================================

  useEffect(
    () => {

      // No Companion has been selected yet.
      if (
        activeCompanionIndex <
        0
      ) {
        return;
      }


      const companion =
        selectedCompanions[
          activeCompanionIndex
        ];


      const destination =
        companionDestinations[
          activeCompanionIndex
        ];


      if (
        companionSearchState !==
          "traveling" ||

        !playerCoordinate ||

        !companion ||

        !destination ||

        !userId ||

        companionCollectingRef.current
      ) {
        return;
      }


      const distanceMeters =
        calculateDistanceMeters(
          playerCoordinate,
          destination
        );


      if (
        distanceMeters >
        COMPANION_COLLECTION_RADIUS_METERS
      ) {
        return;
      }


      if (
        isMovingTooFast
      ) {
        return;
      }


      companionCollectingRef.current =
        true;


      // Cancel any outstanding automatic reroute.
      routeRequestIdRef.current +=
        1;


      rerouteInProgressRef.current =
        false;


      void (
        async () => {

          try {

            await saveCollectedCompanion(
              userId,
              companion
            );


            // ==================================================
            // CHECK FOR SECOND COMPANION
            // ==================================================

            const otherIndex =
              selectedCompanions.findIndex(
                (
                  _,
                  index
                ) =>

                  index !==
                    activeCompanionIndex &&

                  companionDestinations[
                    index
                  ] !==
                    undefined
              );


            if (
              otherIndex >=
              0
            ) {

              // ================================================
              // DO NOT AUTO-SELECT THE OTHER COMPANION
              // ================================================
              //
              // The remaining marker stays visible.
              //
              // The user decides whether to select it.
              // ================================================

              setCompanionWalkerCoordinate(
                playerCoordinate
              );


              setCompanionRoute(
                []
              );


              setRouteDistanceMeters(
                null
              );


              setRouteDurationSeconds(
                null
              );


              setRouteSteps(
                []
              );


              setSelectedCompanion(
                null
              );


              setActiveCompanionIndex(
                -1
              );


              setCompanionSearchState(
                "ready"
              );


              lastRoutedPlayerCoordinateRef.current =
                null;


              lastRouteRequestAtRef.current =
                0;


              rerouteInProgressRef.current =
                false;


              companionCollectingRef.current =
                false;


              if (
                Platform.OS !==
                "web"
              ) {

                Alert.alert(
                  "COMPANION FOUND",
                  `${companion.name} was added to your collection. Select the other Companion on the map if you want to continue.`
                );
              }


              return;
            }


            // ==================================================
            // NO COMPANIONS REMAIN
            // ==================================================

            setCompanionWalkerCoordinate(
              playerCoordinate
            );


            setCompanionSearchState(
              "found"
            );


            setCompanionRoute(
              []
            );


            setRouteDistanceMeters(
              0
            );


            setRouteDurationSeconds(
              0
            );


            setRouteSteps(
              []
            );


            lastRoutedPlayerCoordinateRef.current =
              null;


            lastRouteRequestAtRef.current =
              0;


            rerouteInProgressRef.current =
              false;


            companionCollectingRef.current =
              false;


            Alert.alert(
              "COMPANION FOUND",
              `${companion.name} has been added to your Companion collection.`
            );

          } catch (
            error
          ) {

            console.error(
              "Could not save Companion collection:",
              error
            );


            companionCollectingRef.current =
              false;


            Alert.alert(
              "SAVE FAILED",
              "You reached the Companion, but it could not be saved. Please try again."
            );
          }
        }
      )();

    },
    [
      activeCompanionIndex,
      companionDestinations,
      companionSearchState,
      isMovingTooFast,
      playerCoordinate,
      selectedCompanions,
      userId,
    ],
  );


  // ==========================================================
  // RETURN
  // ==========================================================

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


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default useHomeBackupCompanions;