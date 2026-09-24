// =======================
// HOME BACKUP CONTROLLER
// =======================
//
// This is the refactored Home screen brain.
//
// Supporting systems:
//   homebackup_location.tsx    -> GPS / browser location / heading / map movement
//   homebackup_companions.tsx  -> Companion search / routing / collection
//   homebackup_map.tsx         -> map presentation
//   homebackup_interface.tsx   -> Home HUD / controls / modals / navigation
//
// Keep feature logic in the supporting system that owns it. This file should
// remain the controller that connects those systems together.
// =======================

import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RELICS, type Relic } from "@/constants/relics";
import { useAccountAccess } from "@/hooks/use-account-access";
import { useDailyProgress } from "@/hooks/use-daily-progress";
import { useSecureRelicField } from "@/hooks/use-secure-relic-field";
import { useDailyActivity } from "@/providers/activity-progress-provider";
import { getDevelopmentMeetupsToday } from "@/services/development-meetup-data";
import { loadActiveTrailActivity } from "@/services/trail-activity-service";
import type { Meetup } from "@/types/meetups";
import type { MysteryZone } from "@/types/relic-proximity";
import type { ActiveTrailActivity } from "@/types/trails";
import {
  calculateDistanceMeters,
  feetToMeters,
  getCoordinateOffsetByFeet,
  type Coordinate,
} from "@/utils/distance";
import { playRelicCollectHaptics } from "@/utils/game-haptics";
import {
  filterMeetupsForMap,
  type MeetupRadiusMiles,
} from "@/utils/meetup-discovery";
import {
  collectRelic,
  getPlayerProgress,
} from "@/utils/player-progress";

import { useAuth } from "../../context/auth";

import {
  useHomeBackupCompanions,
} from "./homebackup_companions";
import {
  HomeBackupInterface,
  auraOptions,
  footprintOptions,
  type PlacedRelic,
} from "./homebackup_interface";
import {
  useHomeBackupLocation,
} from "./homebackup_location";

// =======================
// SETTINGS
// =======================

const RELIC_COLLECTION_RADIUS_FEET = 10;

// Both checks must pass. __DEV__ is false in production bundles,
// so relic test UI is removed there.
const ENABLE_RELIC_TEST_MODE =
  __DEV__ &&
  process.env.EXPO_PUBLIC_ENABLE_RELIC_TEST_MODE === "true";

// Keep this aligned with the interface tab-bar height.
const TAB_BAR_HEIGHT = 82;

// =======================
// HOME SCREEN
// =======================

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const mapRef = useRef<any>(null);

  const safeArea = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const {
    access: accountAccess,
  } = useAccountAccess();

  const canUseTrails =
    accountAccess?.canUseTrails === true;

  const canUseMeetups =
    accountAccess?.canUseMeetups === true;

  const dailyActivity = useDailyActivity();

  const {
    progress: sharedProgress,
    refresh: refreshSharedProgress,
  } = useDailyProgress();

  // =====================
  // HOME UI STATE
  // =====================

  const [botOpen, setBotOpen] =
    useState(false);

  const [selectedAura, setSelectedAura] =
    useState<(typeof auraOptions)[number]>(
      auraOptions[2],
    );

  const [
    isAuraModalOpen,
    setIsAuraModalOpen,
  ] = useState(false);

  const [
    selectedFootprint,
    setSelectedFootprint,
  ] = useState<
    (typeof footprintOptions)[number]
  >(footprintOptions[0]);

  const [
    isFootprintModalOpen,
    setIsFootprintModalOpen,
  ] = useState(false);

  const [
    isRelicCardOpen,
    setIsRelicCardOpen,
  ] = useState(false);

  // =====================
  // RELIC STATE
  // =====================

  const [
    collectedRelicIds,
    setCollectedRelicIds,
  ] = useState<string[]>([]);

  const [
    isProgressLoaded,
    setIsProgressLoaded,
  ] = useState(false);

  const [
    collectingRelicId,
    setCollectingRelicId,
  ] = useState<string | null>(null);

  const [
    awakeningRelic,
    setAwakeningRelic,
  ] = useState<Relic | null>(null);

  const [
    cachedTotalXp,
    setCachedTotalXp,
  ] = useState(0);

  const [
    relicFieldOrigin,
    setRelicFieldOrigin,
  ] = useState<Coordinate | null>(null);

  const totalXp =
    ENABLE_RELIC_TEST_MODE
      ? cachedTotalXp
      : (sharedProgress?.totalXp ?? 0);

  // =====================
  // TRAIL / MEETUP STATE
  // =====================

  const [
    activeTrailActivity,
    setActiveTrailActivity,
  ] = useState<ActiveTrailActivity | null>(
    null,
  );

  const [
    selectedMeetupId,
    setSelectedMeetupId,
  ] = useState<string | null>(null);

  const [
    joinedMeetupIds,
    setJoinedMeetupIds,
  ] = useState<string[]>([]);

  const [
    joiningMeetupId,
    setJoiningMeetupId,
  ] = useState<string | null>(null);

  const [
    isMeetupListOpen,
    setIsMeetupListOpen,
  ] = useState(false);

  const [
    meetupRadiusMiles,
    setMeetupRadiusMiles,
  ] = useState<MeetupRadiusMiles>(10);

  // =====================
  // LOCATION SYSTEM
  // =====================

  const location = useHomeBackupLocation({
    userId: session?.user.id,
    mapRef,

    // The original Home screen creates the local relic test field
    // from the first accepted GPS coordinate.
    onFirstAcceptedCoordinate:
      ENABLE_RELIC_TEST_MODE
        ? (coordinate) => {
            setRelicFieldOrigin(
              (current) =>
                current ?? coordinate,
            );
          }
        : undefined,
  });

  // =====================
  // SECURE RELIC SYSTEM
  // =====================

  const handleSecureCollection =
    useCallback(
      (
        relic: Relic,
        serverTotalXp: number,
      ) => {
        setCollectedRelicIds(
          (current) =>
            current.includes(relic.id)
              ? current
              : [...current, relic.id],
        );

        setCachedTotalXp(
          serverTotalXp,
        );

        setAwakeningRelic(relic);

        void refreshSharedProgress();
      },
      [refreshSharedProgress],
    );

  const secureRelicField =
    useSecureRelicField({
      enabled:
        !ENABLE_RELIC_TEST_MODE,
      gpsPoints: location.gpsPoints,
      onCollected:
        handleSecureCollection,
    });

  // =====================
  // COMPANION SYSTEM
  // =====================

  const companions =
    useHomeBackupCompanions({
      userId: session?.user.id,
      playerCoordinate:
        location.liveCoordinate ??
        location.playerCoordinate,
      isMovingTooFast:
        location.isMovingTooFast,
      mapRef,
      onError:
        location.setLocationError,
    });

  // =====================
  // LIVE INFORMATION
  // =====================

  const displayWalkingMiles =
    dailyActivity.todaySteps > 0
      ? estimateWalkingMilesFromSteps(
          dailyActivity.todaySteps,
        )
      : dailyActivity.todayDistanceMiles;

  const liveStats = getLiveStats(
    displayWalkingMiles,
    dailyActivity.todaySteps,
    collectedRelicIds.length,
    RELICS.length,
  );

  const mapCoordinates =
    location.visualGpsPoints.map(
      (point) => ({
        latitude:
          point.coords.latitude,
        longitude:
          point.coords.longitude,
      }),
    );

  // =====================
  // MEETUPS
  // =====================

  const developmentMeetups =
    useMemo(
      () =>
        getDevelopmentMeetupsToday(),
      [],
    );

  const meetupViewerId =
    session?.user.id ??
    (__DEV__
      ? "test-map-viewer"
      : null);

  const meetupFriendIds =
    useMemo(
      () =>
        Array.from(
          new Set(
            developmentMeetups.flatMap(
              (meetup) =>
                meetup.sampleFriendIds,
            ),
          ),
        ),
      [developmentMeetups],
    );

  const mapMeetups =
    useMemo<Meetup[]>(
      () =>
        developmentMeetups.map(
          (meetup) =>
            meetupViewerId &&
            joinedMeetupIds.includes(
              meetup.id,
            )
              ? {
                  ...meetup,

                  attendeeIds:
                    Array.from(
                      new Set([
                        ...meetup.attendeeIds,
                        meetupViewerId,
                      ]),
                    ),
                }
              : meetup,
        ),
      [
        developmentMeetups,
        joinedMeetupIds,
        meetupViewerId,
      ],
    );

  const visibleMapMeetups =
    useMemo(
      () => {
        if (!canUseMeetups) {
          return [];
        }

        return filterMeetupsForMap(
          mapMeetups,
          {
            currentUserId:
              meetupViewerId,

            friendUserIds:
              meetupFriendIds,

            maxMarkers: 40,

            radiusMiles:
              meetupRadiusMiles,

            userLocation:
              location.playerCoordinate,
          },
        );
      },
      [
        canUseMeetups,
        mapMeetups,
        meetupFriendIds,
        meetupRadiusMiles,
        meetupViewerId,
        location.playerCoordinate,
      ],
    );

  const selectedMeetup =
    useMemo(
      () =>
        visibleMapMeetups.find(
          (meetup) =>
            meetup.id ===
            selectedMeetupId,
        ) ?? null,
      [
        selectedMeetupId,
        visibleMapMeetups,
      ],
    );

  const meetupSheetBottom =
    safeArea.bottom +
    10 +
    TAB_BAR_HEIGHT +
    10;

  const meetupSheetAvailableHeight =
    Math.max(
      0,
      windowHeight -
        safeArea.top -
        meetupSheetBottom -
        10,
    );

  const meetupSheetHeight =
    meetupSheetAvailableHeight *
    0.36;

  // =====================
  // RELIC MAP DATA
  // =====================

  const placedRelics =
    useMemo<PlacedRelic[]>(
      () =>
        relicFieldOrigin
          ? RELICS.map(
              (relic) => ({
                relic,

                coordinate:
                  getCoordinateOffsetByFeet(
                    relicFieldOrigin,
                    relic.mapPlacement
                      .distanceFeet,
                    relic.mapPlacement
                      .bearingDegrees,
                  ),
              }),
            )
          : [],
      [relicFieldOrigin],
    );

  const nearestRelic =
    useMemo(
      () =>
        location.playerCoordinate
          ? findNearestUncollectedRelic(
              location.playerCoordinate,
              placedRelics,
              collectedRelicIds,
            )
          : null,
      [
        collectedRelicIds,
        placedRelics,
        location.playerCoordinate,
      ],
    );

  const distanceToRelic =
    location.playerCoordinate &&
    nearestRelic
      ? calculateDistanceMeters(
          location.playerCoordinate,
          nearestRelic.coordinate,
        )
      : null;

  const canCollectRelic =
    distanceToRelic !== null &&
    distanceToRelic <=
      feetToMeters(
        RELIC_COLLECTION_RADIUS_FEET,
      );

  const relicBearing =
    location.playerCoordinate &&
    nearestRelic
      ? getBearingDegrees(
          location.playerCoordinate,
          nearestRelic.coordinate,
        )
      : null;

  const relicDirection =
    relicBearing === null
      ? null
      : getCardinalDirection(
          relicBearing,
        );

  // =====================
  // SECURE RELIC COMPASS
  // =====================

  const selectedMysteryZone =
    secureRelicField.zones.find(
      (zone) =>
        zone.assignmentId ===
        secureRelicField
          .selectedAssignmentId,
    ) ?? null;

  useEffect(() => {
    if (
      secureRelicField.targetMode !==
        "manual" ||
      !selectedMysteryZone
    ) {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude:
          selectedMysteryZone.latitude,

        longitude:
          selectedMysteryZone.longitude,

        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      350,
    );
  }, [
    secureRelicField.targetMode,
    selectedMysteryZone,
  ]);

  const nearestMysteryZone =
    useMemo(() => {
      if (
        !location.playerCoordinate ||
        secureRelicField.zones
          .length === 0
      ) {
        return null;
      }

      return secureRelicField.zones.reduce<
        MysteryZone | null
      >(
        (closest, zone) => {
          if (!closest) {
            return zone;
          }

          const zoneCoordinate = {
            latitude: zone.latitude,
            longitude:
              zone.longitude,
          };

          const closestCoordinate = {
            latitude:
              closest.latitude,
            longitude:
              closest.longitude,
          };

          const zoneDistance =
            calculateDistanceMeters(
              location.playerCoordinate!,
              zoneCoordinate,
            );

          const closestDistance =
            calculateDistanceMeters(
              location.playerCoordinate!,
              closestCoordinate,
            );

          return zoneDistance <
            closestDistance
            ? zone
            : closest;
        },
        null,
      );
    }, [
      location.playerCoordinate,
      secureRelicField.zones,
    ]);

  const compassZone =
    selectedMysteryZone ??
    nearestMysteryZone;

  const zoneBearing =
    location.playerCoordinate &&
    compassZone
      ? getBearingDegrees(
          location.playerCoordinate,
          {
            latitude:
              compassZone.latitude,

            longitude:
              compassZone.longitude,
          },
        )
      : null;

  const compassBearing =
    ENABLE_RELIC_TEST_MODE
      ? relicBearing
      : secureRelicField
            .selectedSignal
            ?.encounterType ===
          "ambient"
        ? null
        : (secureRelicField
            .bearingDegrees ??
          zoneBearing);

  // =====================
  // LOAD SAVED PROGRESS
  // =====================

  useEffect(() => {
    let isMounted = true;

    async function loadProgress() {
      try {
        const progress =
          await getPlayerProgress();

        if (isMounted) {
          setCollectedRelicIds(
            progress.collectedRelicIds,
          );

          setCachedTotalXp(
            progress.totalXp,
          );
        }
      } catch (error) {
        console.error(
          "Could not load player progress:",
          error,
        );
      } finally {
        if (isMounted) {
          setIsProgressLoaded(true);
        }
      }
    }

    void loadProgress();

    return () => {
      isMounted = false;
    };
  }, []);

  // =====================
  // LOAD ACTIVE TRAIL
  // =====================

  useEffect(() => {
    void loadActiveTrailActivity().then(
      setActiveTrailActivity,
    );
  }, []);

  // =====================
  // RELIC COLLECTION
  // =====================

  async function handleCollectRelic(
    ignoreDistanceForTesting = false,
  ) {
    const isAllowedByDistance =
      canCollectRelic ||
      ignoreDistanceForTesting;

    const relic =
      nearestRelic?.relic;

    if (
      !isAllowedByDistance ||
      !isProgressLoaded ||
      !relic ||
      collectingRelicId
    ) {
      return;
    }

    setCollectingRelicId(
      relic.id,
    );

    try {
      const result =
        await collectRelic(relic);

      void playRelicCollectHaptics();

      setCollectedRelicIds(
        result.progress
          .collectedRelicIds,
      );

      setCachedTotalXp(
        result.progress.totalXp,
      );

      if (result.collected) {
        setAwakeningRelic(relic);
      }
    } catch (error) {
      console.error(
        "Could not collect relic:",
        error,
      );
    } finally {
      setCollectingRelicId(null);
    }
  }

  // =====================
  // COMPANION SEARCH
  // =====================

  const startCompanionSearch =
    useCallback(async () => {
      if (!session?.user.id) {
        Alert.alert(
          "SIGN IN REQUIRED",
          "Sign in before searching for a Companion.",
        );

        return;
      }

      try {
        const coordinate =
          await location.requestFreshCoordinate();

        const scanRegion = {
          latitude:
            coordinate.latitude,

          longitude:
            coordinate.longitude,

          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };

        location.setMapRegion(
          scanRegion,
        );

        mapRef.current?.animateToRegion(
          scanRegion,
          350,
        );

        location.setLocationError(
          null,
        );

        await companions.startCompanionSearch(
          coordinate,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Mission Trail could not get your current location.";

        console.error(
          "Could not start Companion search:",
          error,
        );

        location.setLocationError(
          message,
        );

        Alert.alert(
          "LOCATION REQUIRED",
          message,
        );
      }
    }, [
      companions.startCompanionSearch,
      location.requestFreshCoordinate,
      location.setLocationError,
      location.setMapRegion,
      session?.user.id,
    ]);

  // =====================
  // UI ACTIONS
  // =====================

  function openMissionTrailBot() {
    setBotOpen(true);
  }

  function closeMissionTrailBot() {
    setBotOpen(false);
  }

  function selectAura(
    aura:
      (typeof auraOptions)[number],
  ) {
    setSelectedAura(aura);
    setIsAuraModalOpen(false);
  }

  function selectFootprint(
    footprint:
      (typeof footprintOptions)[number],
  ) {
    setSelectedFootprint(
      footprint,
    );

    setIsFootprintModalOpen(
      false,
    );
  }

  const selectMeetupMarker =
    useCallback(
      (meetupId: string) => {
        setSelectedMeetupId(
          meetupId,
        );
      },
      [],
    );

  const joinMeetup =
    useCallback(
      (meetup: Meetup) => {
        if (!canUseMeetups) {
          Alert.alert(
            "Meetups Locked",
            "Meetups require ID verification.",
          );

          return;
        }

        if (!__DEV__) return;

        setJoiningMeetupId(
          meetup.id,
        );

        setJoinedMeetupIds(
          (current) =>
            current.includes(
              meetup.id,
            )
              ? current
              : [
                  ...current,
                  meetup.id,
                ],
        );

        setJoiningMeetupId(null);
      },
      [canUseMeetups],
    );

  const viewMeetupDetails =
    useCallback(
      (meetup: Meetup) => {
        if (!canUseMeetups) {
          Alert.alert(
            "Meetups Locked",
            "Meetups require ID verification.",
          );

          return;
        }

        setSelectedMeetupId(
          meetup.id,
        );

        setIsMeetupListOpen(
          true,
        );
      },
      [canUseMeetups],
    );

  // =====================
  // SCREEN
  // =====================

  return (
    <HomeBackupInterface
      router={router}
      mapRef={mapRef}
      safeArea={safeArea}

      mapRegion={
        location.mapRegion
      }
      setMapRegion={
        location.setMapRegion
      }

      activeTrailActivity={
        activeTrailActivity
      }
      mapCoordinates={
        mapCoordinates
      }
      visualGpsPoints={
        location.visualGpsPoints
      }
      selectedAura={
        selectedAura
      }
      selectedFootprint={
        selectedFootprint
      }

      secureRelicField={
        secureRelicField
      }
      placedRelics={
        placedRelics
      }
      collectedRelicIds={
        collectedRelicIds
      }

      companionSearchState={
        companions.companionSearchState
      }
      companionRoute={
        companions.companionRoute
      }
      companionDestinations={
        companions.companionDestinations
      }
      selectedCompanions={
        companions.selectedCompanions
      }
      activeCompanionIndex={
        companions.activeCompanionIndex
      }
      companionTrackingCoordinate={
        location.liveCoordinate
      }
      onSelectCompanion={
        companions.selectCompanion
      }

      visibleMapMeetups={
        visibleMapMeetups
      }
      meetupFriendIds={
        meetupFriendIds
      }
      selectedMeetup={
        selectedMeetup
      }
      selectMeetupMarker={
        selectMeetupMarker
      }

      liveStats={liveStats}

      isMovingTooFast={
        location.isMovingTooFast
      }
      locationError={
        location.locationError
      }
      onRestartTracking={
        location.restartTracking
      }

      nearestRelic={
        nearestRelic
      }
      distanceToRelic={
        distanceToRelic
      }
      relicDirection={
        relicDirection
      }
      canCollectRelic={
        canCollectRelic
      }
      isProgressLoaded={
        isProgressLoaded
      }
      collectingRelicId={
        collectingRelicId
      }
      compassBearing={
        compassBearing
      }
      isRelicCardOpen={
        isRelicCardOpen
      }
      setIsRelicCardOpen={
        setIsRelicCardOpen
      }
      handleCollectRelic={
        handleCollectRelic
      }

      startCompanionSearch={
        startCompanionSearch
      }

      zoomOutMap={
        location.zoomOutMap
      }
      centerMapOnUser={
        location.centerMapOnUser
      }
      openMissionTrailBot={
        openMissionTrailBot
      }

      meetupSheetBottom={
        meetupSheetBottom
      }
      meetupSheetHeight={
        meetupSheetHeight
      }
      playerCoordinate={
        location.playerCoordinate
      }
      meetupViewerId={
        meetupViewerId
      }
      joiningMeetupId={
        joiningMeetupId
      }
      joinMeetup={
        joinMeetup
      }
      viewMeetupDetails={
        viewMeetupDetails
      }

      isAuraModalOpen={
        isAuraModalOpen
      }
      setIsAuraModalOpen={
        setIsAuraModalOpen
      }
      selectAura={
        selectAura
      }

      isFootprintModalOpen={
        isFootprintModalOpen
      }
      setIsFootprintModalOpen={
        setIsFootprintModalOpen
      }
      selectFootprint={
        selectFootprint
      }

      canUseTrails={
        canUseTrails
      }
      canUseMeetups={
        canUseMeetups
      }

      awakeningRelic={
        awakeningRelic
      }
      totalXp={totalXp}
      setAwakeningRelic={
        setAwakeningRelic
      }

      isMeetupListOpen={
        isMeetupListOpen
      }
      setIsMeetupListOpen={
        setIsMeetupListOpen
      }
      mapMeetups={
        mapMeetups
      }
      meetupRadiusMiles={
        meetupRadiusMiles
      }
      setMeetupRadiusMiles={
        setMeetupRadiusMiles
      }
      setSelectedMeetupId={
        setSelectedMeetupId
      }

      botOpen={botOpen}
      closeMissionTrailBot={
        closeMissionTrailBot
      }
    />
  );
}

// =======================
// CONTROLLER HELPERS
// =======================

function estimateWalkingMilesFromSteps(
  steps: number,
) {
  const averageStepLengthFeet =
    2.2;

  return (
    Math.max(0, steps) *
    averageStepLengthFeet /
    5280
  );
}

function getLiveStats(
  distanceMiles: number,
  steps: number,
  collectedRelics: number,
  totalRelics: number,
) {
  return {
    distance:
      distanceMiles.toFixed(2),

    steps:
      Math.max(
        0,
        Math.round(steps),
      ).toLocaleString(),

    items:
      `${collectedRelics}/${totalRelics}`,
  };
}

function findNearestUncollectedRelic(
  playerCoordinate: Coordinate,
  placedRelics: PlacedRelic[],
  collectedRelicIds: string[],
) {
  const availableRelics =
    placedRelics.filter(
      ({ relic }) =>
        !collectedRelicIds.includes(
          relic.id,
        ),
    );

  if (
    availableRelics.length === 0
  ) {
    return null;
  }

  return availableRelics.reduce(
    (nearest, candidate) => {
      const nearestDistance =
        calculateDistanceMeters(
          playerCoordinate,
          nearest.coordinate,
        );

      const candidateDistance =
        calculateDistanceMeters(
          playerCoordinate,
          candidate.coordinate,
        );

      return candidateDistance <
        nearestDistance
        ? candidate
        : nearest;
    },
  );
}

function getBearingDegrees(
  from: Coordinate,
  to: Coordinate,
) {
  const toRadians =
    (degrees: number) =>
      degrees *
      (Math.PI / 180);

  const toDegrees =
    (radians: number) =>
      radians *
      (180 / Math.PI);

  const latitude1 =
    toRadians(from.latitude);

  const latitude2 =
    toRadians(to.latitude);

  const longitudeDelta =
    toRadians(
      to.longitude -
        from.longitude,
    );

  const y =
    Math.sin(longitudeDelta) *
    Math.cos(latitude2);

  const x =
    Math.cos(latitude1) *
      Math.sin(latitude2) -
    Math.sin(latitude1) *
      Math.cos(latitude2) *
      Math.cos(longitudeDelta);

  return (
    toDegrees(
      Math.atan2(y, x),
    ) +
    360
  ) % 360;
}

function getCardinalDirection(
  bearing: number,
) {
  const directions = [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ] as const;

  const normalized =
    ((bearing % 360) + 360) %
    360;

  const index =
    Math.round(
      normalized / 45,
    ) % directions.length;

  return directions[index];
}
