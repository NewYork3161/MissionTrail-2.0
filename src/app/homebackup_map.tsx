import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  Circle,
  MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "@/components/maps/map-components";
import { MeetupMapMarker } from "@/components/meetups/MeetupMapMarker";
import type { Relic } from "@/constants/relics";
import type { Meetup } from "@/types/meetups";
import type { MysteryZone } from "@/types/relic-proximity";
import type { ActiveTrailActivity } from "@/types/trails";
import type { RelicHuntStage } from "@/utils/relic-hunt";
import { getRelicHuntIntensity } from "@/utils/relic-hunt";
import {
  calculateFriendsAttending,
} from "@/utils/meetup-discovery";
import type { Coordinate } from "@/utils/distance";

import type {
  CompanionCatalogRow,
  CompanionSearchState,
} from "./homebackup_companions";
import {
  getStableFootprintLocation,
  makeMapCoordinate,
  type Region,
} from "./homebackup_location";

// ============================================================
// HOME BACKUP - MAP SYSTEM
// ============================================================
//
// Complete map presentation extracted from home-backup.tsx.
//
// This file owns the MAP itself:
// - MapView configuration
// - active trail route/destination
// - walked path
// - footprint trail
// - live player footprint
// - relic test markers
// - mystery relic zones
// - Companion route
// - Companion 1 / Companion 2 destination markers
// - YOU ARE HERE Companion tracking marker
// - meetup markers
//
// It does NOT own GPS acquisition or Companion game rules.
// homebackup_location.tsx owns GPS.
// homebackup_companions.tsx owns Companion logic/routing.
// home-backup.tsx remains the brain/controller.
// ============================================================

export type PlacedRelic = {
  relic: Relic;
  coordinate: Coordinate;
};

export type HomeBackupFootprintOption = {
  name: string;
  source: any;
};

export type HomeBackupMapProps = {
  mapRef: React.MutableRefObject<any>;

  mapRegion: Region | null;
  onRegionChangeComplete: (region: Region) => void;

  activeTrailActivity: ActiveTrailActivity | null;
  mapCoordinates: Coordinate[];

  visualGpsPoints: Location.LocationObject[];
  selectedAuraColor: string;
  selectedFootprint: HomeBackupFootprintOption;
  huntStage: RelicHuntStage;

  relicTestModeEnabled: boolean;
  placedRelics: PlacedRelic[];
  collectedRelicIds: string[];

  mysteryZones: MysteryZone[];
  selectedRelicAssignmentId: string | null;
  onSelectRelicSignal: (assignmentId: string) => void;

  companionSearchState: CompanionSearchState;
  companionRoute: Coordinate[];
  companionDestinations: Coordinate[];
  selectedCompanions: CompanionCatalogRow[];
  activeCompanionIndex: number;
  companionTrackingCoordinate: Coordinate | null;
  onSelectCompanion: (index: number) => void | Promise<void>;

  visibleMapMeetups: Meetup[];
  meetupFriendIds: string[];
  onSelectMeetupMarker: (meetupId: string) => void;
};

const darkMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#09051D" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#E9D5FF" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#13082A" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#6D28D9" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#43207A" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#A855F7" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#5B21B6" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#E879F9" }],
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#35205F" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#062B52" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#67E8F9" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#103C43" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
];

export function HomeBackupMap({
  mapRef,
  mapRegion,
  onRegionChangeComplete,
  activeTrailActivity,
  mapCoordinates,
  visualGpsPoints,
  selectedAuraColor,
  selectedFootprint,
  huntStage,
  relicTestModeEnabled,
  placedRelics,
  collectedRelicIds,
  mysteryZones,
  selectedRelicAssignmentId,
  onSelectRelicSignal,
  companionSearchState,
  companionRoute,
  companionDestinations,
  selectedCompanions,
  activeCompanionIndex,
  companionTrackingCoordinate,
  onSelectCompanion,
  visibleMapMeetups,
  meetupFriendIds,
  onSelectMeetupMarker,
}: HomeBackupMapProps) {
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      customMapStyle={Platform.OS !== "web" ? darkMapStyle : undefined}
      mapType="standard"
      initialRegion={mapRegion ?? undefined}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      showsScale
      showsPointsOfInterest
      showsBuildings
      showsIndoors
      showsTraffic={false}
      rotateEnabled
      pitchEnabled
      onRegionChangeComplete={onRegionChangeComplete}
    >
      {renderActiveTrail(activeTrailActivity)}

      {renderWalkedPath(mapCoordinates)}

      {renderFootprintMarkers(
        visualGpsPoints,
        selectedAuraColor,
        selectedFootprint,
        huntStage,
      )}

      {renderUserGlow(
        getStableFootprintLocation(visualGpsPoints),
        selectedAuraColor,
        selectedFootprint,
        huntStage,
      )}

      {relicTestModeEnabled
        ? renderRelicMarkers(placedRelics, collectedRelicIds)
        : renderMysteryZoneMarkers(
            mysteryZones,
            selectedRelicAssignmentId,
            onSelectRelicSignal,
            huntStage,
          )}

      {renderCompanionSystem({
        companionSearchState,
        companionRoute,
        companionDestinations,
        selectedCompanions,
        activeCompanionIndex,
        companionTrackingCoordinate,
        onSelectCompanion,
      })}

      {visibleMapMeetups.map((meetup) => (
        <MeetupMapMarker
          key={meetup.id}
          meetup={meetup}
          friendsAttending={calculateFriendsAttending(
            meetup,
            meetupFriendIds,
          )}
          onPress={onSelectMeetupMarker}
        />
      ))}
    </MapView>
  );
}

// ============================================================
// ACTIVE TRAIL
// ============================================================

function renderActiveTrail(
  activeTrailActivity: ActiveTrailActivity | null,
) {
  if (!activeTrailActivity) return null;

  return (
    <>
      {activeTrailActivity.trail.geometry ? (
        <Polyline
          coordinates={activeTrailActivity.trail.geometry.coordinates.map(
            ([longitude, latitude]) => ({
              latitude,
              longitude,
            }),
          )}
          strokeColor="#19D8FF"
          strokeWidth={5}
        />
      ) : null}

      <Marker
        coordinate={{
          latitude: activeTrailActivity.trail.latitude,
          longitude: activeTrailActivity.trail.longitude,
        }}
        title={activeTrailActivity.trail.name}
        description="Active trail destination"
        pinColor="#FF2DF7"
      />
    </>
  );
}

// ============================================================
// WALKED PATH
// ============================================================

function renderWalkedPath(coordinates: Coordinate[]) {
  if (coordinates.length <= 1) return null;

  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor="rgba(168, 85, 247, 0.35)"
        strokeWidth={8}
      />

      <Polyline
        coordinates={coordinates}
        strokeColor="#ff63f7"
        strokeWidth={3}
      />
    </>
  );
}

// ============================================================
// FOOTPRINT MARKERS
// ============================================================

const FOOTPRINT_MIN_MOVEMENT_METERS = 4;
const SPEED_LIMIT_METERS_PER_SECOND = 20 * 0.44704;

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

function getFootprintDistanceMeters(
  left: Location.LocationObject,
  right: Location.LocationObject,
) {
  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const latitude1 = toRadians(left.coords.latitude);
  const latitude2 = toRadians(right.coords.latitude);
  const latitudeDelta = latitude2 - latitude1;
  const longitudeDelta = toRadians(
    right.coords.longitude - left.coords.longitude,
  );

  const rawHaversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;

  const haversine = Math.max(0, Math.min(1, rawHaversine));

  return 6_371_000 * 2 * Math.asin(Math.sqrt(haversine));
}

function getWalkingFootprintLocations(
  locations: Location.LocationObject[],
) {
  const uniqueLocations = deduplicateGpsLocations(locations);

  if (uniqueLocations.length <= 1) {
    return uniqueLocations;
  }

  const walkingLocations: Location.LocationObject[] = [
    uniqueLocations[0],
  ];

  for (const location of uniqueLocations.slice(1)) {
    const previous = walkingLocations.at(-1);

    if (!previous) {
      walkingLocations.push(location);
      continue;
    }

    const distanceMeters = getFootprintDistanceMeters(
      previous,
      location,
    );

    const maximumAccuracy = Math.max(
      previous.coords.accuracy ?? 0,
      location.coords.accuracy ?? 0,
    );

    const accuracyMovementThreshold = Math.max(
      FOOTPRINT_MIN_MOVEMENT_METERS,
      Math.min(30, maximumAccuracy * 1.25),
    );

    const speedMetersPerSecond = Math.max(
      0,
      location.coords.speed ?? 0,
    );

    const movingByDistance =
      distanceMeters >= accuracyMovementThreshold;

    const speedLooksPlausible =
      speedMetersPerSecond <= SPEED_LIMIT_METERS_PER_SECOND;

    if (movingByDistance && speedLooksPlausible) {
      walkingLocations.push(location);
    }
  }

  return walkingLocations;
}

function getAuraGlowBackground(auraColor: string) {
  const normalized = auraColor.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
    return `${normalized}12`;
  }

  return "rgba(255, 99, 247, 0.07)";
}

function renderFootprintMarkers(
  locations: Location.LocationObject[],
  auraColor: string,
  selectedFootprint: HomeBackupFootprintOption,
  huntStage: RelicHuntStage,
) {
  const uniqueLocations = getWalkingFootprintLocations(locations);
  const intensity = getRelicHuntIntensity(huntStage);

  const sampleStride = 2;
  const walkedLocations = uniqueLocations.slice(0, -1);

  return walkedLocations
    .filter(
      (_, index) =>
        index % sampleStride === 0 ||
        index === walkedLocations.length - 1,
    )
    .map((location) => (
      <Marker
        key={getGpsSampleId(location)}
        coordinate={makeMapCoordinate(location)}
        tracksViewChanges={false}
        zIndex={1}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View
          style={[
            styles.mapFootprintGlow,
            {
              backgroundColor: getAuraGlowBackground(auraColor),
              shadowColor: auraColor,
              opacity: 0.55 + intensity * 0.08,
              transform: [
                { scale: 0.82 + intensity * 0.045 },
              ],
            },
          ]}
        >
          <Image
            source={selectedFootprint.source}
            style={styles.mapFootprintImage}
            resizeMode="contain"
          />
        </View>
      </Marker>
    ));
}

// ============================================================
// LIVE USER FOOTPRINT
// ============================================================

function renderUserGlow(
  location: Location.LocationObject | undefined,
  auraColor: string,
  selectedFootprint: HomeBackupFootprintOption,
  huntStage: RelicHuntStage,
) {
  if (!location) return null;

  const intensity = getRelicHuntIntensity(huntStage);

  return (
    <Marker
      coordinate={makeMapCoordinate(location)}
      tracksViewChanges
      zIndex={2}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View
        style={[
          styles.currentFootprintGlow,
          {
            backgroundColor: getAuraGlowBackground(auraColor),
            shadowColor: auraColor,
            shadowOpacity: 0.16 + intensity * 0.05,
            shadowRadius: 9 + intensity * 1.4,
            transform: [
              { scale: 0.92 + intensity * 0.025 },
            ],
          },
        ]}
      >
        <Image
          source={selectedFootprint.source}
          style={styles.currentFootprintImage}
          resizeMode="contain"
        />
      </View>
    </Marker>
  );
}

// ============================================================
// RELIC TEST MARKERS
// ============================================================

function renderRelicMarkers(
  placedRelics: PlacedRelic[],
  collectedRelicIds: string[],
) {
  return placedRelics.map(({ relic, coordinate }) => {
    const isCollected = collectedRelicIds.includes(relic.id);

    return (
      <Marker
        key={relic.id}
        coordinate={coordinate}
        title={relic.name}
        description={`${relic.rarity} relic · ${relic.mapPlacement.distanceFeet.toLocaleString()} ft from the starting point`}
      >
        <View
          style={[
            styles.relicMarker,
            {
              borderColor: relic.primaryColor,
              shadowColor: relic.primaryColor,
            },
            isCollected && styles.relicMarkerCollected,
          ]}
        >
          <Image
            source={relic.icon}
            resizeMode="contain"
            style={styles.relicMarkerImage}
          />

          {isCollected ? (
            <View style={styles.relicMarkerCheck}>
              <Ionicons
                name="checkmark"
                size={11}
                color="#FFFFFF"
              />
            </View>
          ) : null}
        </View>
      </Marker>
    );
  });
}

// ============================================================
// MYSTERY RELIC ZONES
// ============================================================

function renderMysteryZoneMarkers(
  zones: MysteryZone[],
  selectedAssignmentId: string | null,
  onSelect: (assignmentId: string) => void,
  huntStage: RelicHuntStage,
) {
  return zones.flatMap((zone) => {
    const selected =
      zone.assignmentId === selectedAssignmentId;

    const color =
      zone.availability === "locked"
        ? "#72667D"
        : selected
          ? "#E879F9"
          : "#8B5CF6";

    const intensity = selected
      ? getRelicHuntIntensity(huntStage)
      : 0;

    return [
      <Circle
        key={`${zone.assignmentId}-zone`}
        center={{
          latitude: zone.latitude,
          longitude: zone.longitude,
        }}
        radius={zone.radiusMeters}
        strokeColor={`${color}A8`}
        fillColor={`${color}${
          selected
            ? intensity >= 4
              ? "42"
              : "30"
            : "18"
        }`}
        strokeWidth={
          selected
            ? Math.min(4, 1.5 + intensity * 0.4)
            : 1
        }
      />,

      <Marker
        key={zone.assignmentId}
        coordinate={{
          latitude: zone.latitude,
          longitude: zone.longitude,
        }}
        anchor={{ x: 0.5, y: 0.5 }}
        title="Hidden Relic Area"
        description={
          zone.availability === "locked"
            ? "Keep exploring to unlock this area"
            : "Follow the clues here"
        }
        onPress={() => onSelect(zone.assignmentId)}
      >
        <HiddenRelicMarker
          color={color}
          intensity={intensity}
          locked={zone.availability === "locked"}
          selected={selected}
        />
      </Marker>,
    ];
  });
}

function HiddenRelicMarker({
  color,
  intensity,
  locked,
  selected,
}: {
  color: string;
  intensity: number;
  locked: boolean;
  selected: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || locked) {
      pulse.value = 0;
      return;
    }

    const duration = Math.max(
      520,
      1_300 - intensity * 210,
    );

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
    );
  }, [
    intensity,
    locked,
    pulse,
    reduceMotion,
  ]);

  const markerStyle = useAnimatedStyle(() => ({
    opacity: 0.82 + pulse.value * 0.18,
  }));

  return (
    <Animated.View
      accessibilityLabel={
        locked
          ? "Locked Hidden Relic Area"
          : `Hidden Relic Area. Signal level ${Math.max(
              1,
              intensity,
            )} of 5`
      }
      style={[
        styles.anomalyMarker,
        {
          borderColor: color,
          shadowColor: color,
        },
        selected &&
          styles.anomalyMarkerSelected,
        markerStyle,
      ]}
    >
      <View
        style={[
          styles.anomalyPulseCore,
          {
            backgroundColor: `${color}55`,
          },
        ]}
      />

      <Ionicons
        name={locked ? "lock-closed" : "help"}
        size={21}
        color="#FFFFFF"
      />
    </Animated.View>
  );
}

// ============================================================
// COMPANION MAP SYSTEM
// ============================================================

function renderCompanionSystem({
  companionSearchState,
  companionRoute,
  companionDestinations,
  selectedCompanions,
  activeCompanionIndex,
  companionTrackingCoordinate,
  onSelectCompanion,
}: {
  companionSearchState: CompanionSearchState;
  companionRoute: Coordinate[];
  companionDestinations: Coordinate[];
  selectedCompanions: CompanionCatalogRow[];
  activeCompanionIndex: number;
  companionTrackingCoordinate: Coordinate | null;
  onSelectCompanion: (index: number) => void | Promise<void>;
}) {
  return (
    <>
      {companionSearchState !== "idle" &&
      companionDestinations.length > 0 ? (
        <>
          {companionRoute.length > 1 ? (
            <Polyline
              coordinates={companionRoute}
              strokeColor="#FF01E2"
              strokeWidth={6}
            />
          ) : null}

          {companionDestinations.map(
            (destination, index) => {
              const active =
                index === activeCompanionIndex;

              return (
                <Marker
                  key={`companion-destination-${index}`}
                  coordinate={destination}
                  title={`Companion ${index + 1}`}
                  description={
                    selectedCompanions[index]?.rarity
                      ? `${selectedCompanions[index].rarity} Companion`
                      : `Companion ${index + 1} destination`
                  }
                  pinColor="#FF01E2"
                  zIndex={active ? 22 : 20}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => {
                    void onSelectCompanion(index);
                  }}
                >
                  <Pressable
                    onPress={() => {
                      void onSelectCompanion(index);
                    }}
                    style={[
                      styles.companionDestinationMarker,
                      !active &&
                        styles.companionDestinationMarkerInactive,
                    ]}
                  >
                    <Ionicons
                      name="paw"
                      size={22}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.companionDestinationLabel
                      }
                    >
                      {`COMPANION ${index + 1}`}
                    </Text>
                  </Pressable>
                </Marker>
              );
            },
          )}
        </>
      ) : null}

      {companionTrackingCoordinate ? (
        <Marker
          coordinate={companionTrackingCoordinate}
          title="You Are Here"
          description="Your current device location"
          zIndex={25}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View
            pointerEvents="none"
            style={styles.companionWalkerMarker}
          >
            <Ionicons
              name="navigate"
              size={21}
              color="#FFFFFF"
            />

            <Text style={styles.youAreHereLabel}>
              YOU ARE HERE
            </Text>
          </View>
        </Marker>
      ) : null}
    </>
  );
}

// ============================================================
// MAP-ONLY STYLES
// ============================================================

const styles = StyleSheet.create({
  mapFootprintGlow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 99, 247, 0.07)",
    shadowColor: "#ff63f7",
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 5,
  },

  mapFootprintImage: {
    width: 60,
    height: 60,
  },

  currentFootprintGlow: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 99, 247, 0.09)",
    shadowColor: "#ff63f7",
    shadowOpacity: 0.16,
    shadowRadius: 9,
    elevation: 6,
  },

  currentFootprintImage: {
    width: 78,
    height: 78,
  },

  relicMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9, 5, 29, 0.95)",
    shadowOpacity: 0.65,
    shadowRadius: 10,
    elevation: 8,
  },

  relicMarkerCollected: {
    opacity: 0.48,
  },

  relicMarkerImage: {
    width: 31,
    height: 31,
  },

  relicMarkerCheck: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  anomalyMarker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9, 5, 29, 0.95)",
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
    overflow: "hidden",
  },

  anomalyMarkerSelected: {
    borderWidth: 3,
  },

  anomalyPulseCore: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  companionDestinationMarker: {
    minWidth: 86,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FF01E2",
    backgroundColor: "rgba(44, 6, 55, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    shadowColor: "#FF01E2",
    shadowOpacity: 0.78,
    shadowRadius: 12,
    elevation: 12,
  },

  companionDestinationMarkerInactive: {
    opacity: 0.7,
    transform: [{ scale: 0.9 }],
  },

  companionDestinationLabel: {
    marginTop: 2,
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  companionWalkerMarker: {
    minWidth: 90,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#00E5FF",
    backgroundColor: "rgba(4, 31, 48, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    shadowColor: "#00E5FF",
    shadowOpacity: 0.75,
    shadowRadius: 12,
    elevation: 13,
  },

  youAreHereLabel: {
    marginTop: 2,
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
});

export default HomeBackupMap;