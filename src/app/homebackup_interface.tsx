import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import type { Router } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import React, { useEffect } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Circle,
  MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "@/components/maps/map-components";
import { MeetupMapMarker } from "@/components/meetups/MeetupMapMarker";
import { MeetupMapPreview } from "@/components/meetups/MeetupMapPreview";
import { MeetupsTodaySection } from "@/components/meetups/MeetupsTodaySection";
import { RelicAwakening } from "@/components/relic-awakening";
import { SecureRelicCard } from "@/components/secure-relic-card";
import { RELICS, type Relic } from "@/constants/relics";
import type { Meetup } from "@/types/meetups";
import type { MysteryZone } from "@/types/relic-proximity";
import type { ActiveTrailActivity } from "@/types/trails";
import {
  calculateDistanceMeters,
  formatDistanceFeetAndInches,
  type Coordinate,
} from "@/utils/distance";
import {
  calculateFriendsAttending,
  MEETUP_RADIUS_OPTIONS,
  type MeetupRadiusMiles,
} from "@/utils/meetup-discovery";
import { getRelicHuntIntensity, type RelicHuntStage } from "@/utils/relic-hunt";
import { formatRelicSignalDistance } from "@/utils/relic-radar";
import MissionTrailBot from "./MissionTrailBot";

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type PlacedRelic = {
  relic: Relic;
  coordinate: Coordinate;
};

export type CompanionSearchState = "idle" | "traveling" | "found";

export type InterfaceCompanion = {
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

type NeonIconName = React.ComponentProps<typeof Ionicons>["name"];

const screen = Dimensions.get("window");
const isSmallPhone = screen.height < 740 || screen.width < 380;
const sidePadding = isSmallPhone ? 9 : 12;
const tabBarHeight = isSmallPhone ? 72 : 82;

const tabImages = {
  home: require("../../assets/images/tabIcons/homemain.png"),
  mission: require("../../assets/images/tabIcons/mission.png"),
  trails: require("../../assets/images/tabIcons/trails.png"),
  vault: require("../../assets/images/tabIcons/vault.png"),
  profile: require("../../assets/images/tabIcons/profile.png"),
  companion: require("../../assets/images/tabIcons/companion.png"),
};

export const auraOptions = [
  { name: "Cosmic Rose", emoji: "💗", color: "#FF4FD8" },
  { name: "Cosmic Sapphire", emoji: "💙", color: "#3B82F6" },
  { name: "Cosmic Nebula", emoji: "💜", color: "#A855F7" },
  { name: "Emerald Star", emoji: "💚", color: "#22C55E" },
  { name: "Solar Gold", emoji: "💛", color: "#FACC15" },
  { name: "Lunar Cyan", emoji: "🩵", color: "#22D3EE" },
] as const;

export const footprintOptions = [
  { name: "Aries", source: require("../../assets/images/footprints/aries.png") },
  { name: "Cancer", source: require("../../assets/images/footprints/cancer.png") },
  { name: "Capricorn", source: require("../../assets/images/footprints/capricorn.png") },
  { name: "Gemini", source: require("../../assets/images/footprints/gemini.png") },
  { name: "Leo", source: require("../../assets/images/footprints/leo.png") },
  { name: "Pisces", source: require("../../assets/images/footprints/pisces.png") },
  { name: "Sagittarius", source: require("../../assets/images/footprints/sagittarius.png") },
  { name: "Scorpion", source: require("../../assets/images/footprints/scorpion.png") },
  { name: "Taurus", source: require("../../assets/images/footprints/taraus.png") },
  { name: "Virgo", source: require("../../assets/images/footprints/virgo.png") },
  { name: "Libra", source: require("../../assets/images/footprints/libra.png") },
  { name: "Aquarius", source: require("../../assets/images/footprints/aquarius.png") },
  { name: "Footprint", source: require("../../assets/images/footprints/footprints.png") },
] as const;

const bottomTabs = [
  { key: "home", label: "Home", image: tabImages.home, route: "/home-backup" },
  { key: "mission", label: "Mission", image: tabImages.mission, route: "/mission" },
  { key: "trails", label: "Trails", image: tabImages.trails, route: "/trails" },
  { key: "vault", label: "Vault", image: tabImages.vault, route: "/vault" },
  { key: "profile", label: "Profile", image: tabImages.profile, route: "/profile" },
  { key: "companion", label: "Compan...", image: tabImages.companion, route: "/companion" },
] as const;

const mapButtons = [
  { icon: "add", action: "chatbot", label: "Open Mission Trail Bot" },
  { icon: "remove", action: "zoom-out", label: "Zoom out" },
  { icon: "locate", action: "current-location", label: "Current location" },
] as const;


const speedLimitMetersPerSecond = 20 * 0.44704;

function makeMapCoordinate(location: Location.LocationObject): Coordinate {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

function getGpsSampleId(location: Location.LocationObject) {
  return `location-${Math.round(location.timestamp)}`;
}

function deduplicateGpsLocations(locations: Location.LocationObject[]) {
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

function getCardinalDirection(bearing: number) {
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

  return directions[Math.round(bearing / 45) % directions.length];
}

const RELIC_COLLECTION_RADIUS_FEET = 10;
const ENABLE_RELIC_TEST_MODE =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_RELIC_TEST_MODE === "true";

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#09051D" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#E9D5FF" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#13082A" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#6D28D9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#43207A" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#A855F7" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#5B21B6" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#E879F9" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#35205F" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#062B52" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#67E8F9" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#103C43" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export type HomeBackupInterfaceProps = {
  router: any;
  mapRef: React.MutableRefObject<any>;
  safeArea: { top: number; bottom: number; left?: number; right?: number };

  mapRegion: Region | null;
  setMapRegion: (region: Region) => void;

  activeTrailActivity: ActiveTrailActivity | null;
  mapCoordinates: Coordinate[];
  visualGpsPoints: Location.LocationObject[];
  selectedAura: (typeof auraOptions)[number];
  selectedFootprint: (typeof footprintOptions)[number];

  secureRelicField: any;
  placedRelics: PlacedRelic[];
  collectedRelicIds: string[];

  companionSearchState: CompanionSearchState;
  companionRoute: Coordinate[];
  companionDestinations: Coordinate[];
  selectedCompanions: InterfaceCompanion[];
  activeCompanionIndex: number;
  companionTrackingCoordinate: Coordinate | null;
  onSelectCompanion: (index: number) => void | Promise<void>;

  visibleMapMeetups: Meetup[];
  meetupFriendIds: string[];
  selectedMeetup: Meetup | null;
  selectMeetupMarker: (meetupId: string) => void;

  liveStats: {
    distance: string;
    steps: string;
    items: string;
  };

  isMovingTooFast: boolean;
  locationError: string | null;
  onRestartTracking: () => void;

  nearestRelic: PlacedRelic | null;
  distanceToRelic: number | null;
  relicDirection: string | null;
  canCollectRelic: boolean;
  isProgressLoaded: boolean;
  collectingRelicId: string | null;
  compassBearing: number | null;
  isRelicCardOpen: boolean;
  setIsRelicCardOpen: (open: boolean) => void;
  handleCollectRelic: (ignoreDistanceForTesting?: boolean) => void | Promise<void>;

  startCompanionSearch: () => void | Promise<void>;

  zoomOutMap: () => void;
  centerMapOnUser: () => void;
  openMissionTrailBot: () => void;

  meetupSheetBottom: number;
  meetupSheetHeight: number;
  playerCoordinate: Coordinate | null;
  meetupViewerId: string | null;
  joiningMeetupId: string | null;
  joinMeetup: (meetup: Meetup) => void;
  viewMeetupDetails: (meetup: Meetup) => void;

  isAuraModalOpen: boolean;
  setIsAuraModalOpen: (open: boolean) => void;
  selectAura: (aura: (typeof auraOptions)[number]) => void;

  isFootprintModalOpen: boolean;
  setIsFootprintModalOpen: (open: boolean) => void;
  selectFootprint: (footprint: (typeof footprintOptions)[number]) => void;

  canUseTrails: boolean;
  canUseMeetups: boolean;

  awakeningRelic: Relic | null;
  totalXp: number;
  setAwakeningRelic: (relic: Relic | null) => void;

  isMeetupListOpen: boolean;
  setIsMeetupListOpen: (open: boolean) => void;
  mapMeetups: Meetup[];
  meetupRadiusMiles: MeetupRadiusMiles;
  setMeetupRadiusMiles: (radius: MeetupRadiusMiles) => void;
  setSelectedMeetupId: (id: string | null) => void;

  botOpen: boolean;
  closeMissionTrailBot: () => void;
};

export function HomeBackupInterface(props: HomeBackupInterfaceProps) {
  const {
    router,
    mapRef,
    safeArea,
    mapRegion,
    setMapRegion,
    activeTrailActivity,
    mapCoordinates,
    visualGpsPoints,
    selectedAura,
    selectedFootprint,
    secureRelicField,
    placedRelics,
    collectedRelicIds,
    companionSearchState,
    companionRoute,
    companionDestinations,
    selectedCompanions,
    activeCompanionIndex,
    companionTrackingCoordinate,
    onSelectCompanion,
    visibleMapMeetups,
    meetupFriendIds,
    selectedMeetup,
    selectMeetupMarker,
    liveStats,
    isMovingTooFast,
    locationError,
    onRestartTracking,
    nearestRelic,
    distanceToRelic,
    relicDirection,
    canCollectRelic,
    isProgressLoaded,
    collectingRelicId,
    compassBearing,
    isRelicCardOpen,
    setIsRelicCardOpen,
    handleCollectRelic,
    startCompanionSearch,
    zoomOutMap,
    centerMapOnUser,
    openMissionTrailBot,
    meetupSheetBottom,
    meetupSheetHeight,
    playerCoordinate,
    meetupViewerId,
    joiningMeetupId,
    joinMeetup,
    viewMeetupDetails,
    isAuraModalOpen,
    setIsAuraModalOpen,
    selectAura,
    isFootprintModalOpen,
    setIsFootprintModalOpen,
    selectFootprint,
    canUseTrails,
    canUseMeetups,
    awakeningRelic,
    totalXp,
    setAwakeningRelic,
    isMeetupListOpen,
    setIsMeetupListOpen,
    mapMeetups,
    meetupRadiusMiles,
    setMeetupRadiusMiles,
    setSelectedMeetupId,
    botOpen,
    closeMissionTrailBot,
  } = props;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <MapView
        ref={mapRef}
        style={[StyleSheet.absoluteFill, styles.mapLayer]}
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
        onRegionChangeComplete={setMapRegion}
      >
        {activeTrailActivity?.trail.geometry ? (
          <Polyline
            coordinates={activeTrailActivity.trail.geometry.coordinates.map(
              ([longitude, latitude]) => ({ latitude, longitude }),
            )}
            strokeColor="#19D8FF"
            strokeWidth={5}
          />
        ) : null}

        {activeTrailActivity ? (
          <Marker
            coordinate={{
              latitude: activeTrailActivity.trail.latitude,
              longitude: activeTrailActivity.trail.longitude,
            }}
            title={activeTrailActivity.trail.name}
            description="Active trail destination"
            pinColor="#FF2DF7"
          />
        ) : null}

        {renderWalkedPath(mapCoordinates)}

        {renderFootprintMarkers(
          visualGpsPoints,
          selectedAura.color,
          selectedFootprint,
          secureRelicField.huntStage,
        )}

        {renderUserGlow(
          getStableFootprintLocation(visualGpsPoints),
          selectedAura.color,
          selectedFootprint,
          secureRelicField.huntStage,
        )}

        {ENABLE_RELIC_TEST_MODE
          ? renderRelicMarkers(placedRelics, collectedRelicIds)
          : renderMysteryZoneMarkers(
              secureRelicField.zones,
              secureRelicField.selectedAssignmentId,
              secureRelicField.selectSignal,
              secureRelicField.huntStage,
            )}

        {companionSearchState !== "idle" && companionDestinations.length > 0 ? (
          <>
            {companionRoute.length > 1 ? (
              <Polyline
                coordinates={companionRoute}
                strokeColor="#FF01E2"
                strokeWidth={6}
              />
            ) : null}

            {companionDestinations.map((destination, index) => (
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
                zIndex={index === activeCompanionIndex ? 22 : 20}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => {
                  void onSelectCompanion(index);
                }}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.companionDestinationMarker,
                    index !== activeCompanionIndex &&
                      styles.companionDestinationMarkerInactive,
                  ]}
                >
                  <Ionicons name="paw" size={22} color="#FFFFFF" />
                  <Text style={styles.companionDestinationLabel}>
                    {`COMPANION ${index + 1}`}
                  </Text>
                </View>
              </Marker>
            ))}
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
            <View style={styles.companionWalkerMarker}>
              <Ionicons name="navigate" size={21} color="#FFFFFF" />
              <Text style={styles.youAreHereLabel}>YOU ARE HERE</Text>
            </View>
          </Marker>
        ) : null}

        {visibleMapMeetups.map((meetup) => (
          <MeetupMapMarker
            key={meetup.id}
            meetup={meetup}
            friendsAttending={calculateFriendsAttending(meetup, meetupFriendIds)}
            onPress={selectMeetupMarker}
          />
        ))}
      </MapView>

      <View style={styles.cosmicOverlay} pointerEvents="none" />
      <HuntEnergyOverlay stage={secureRelicField.huntStage} />

      <View
        style={[
          styles.fixedOverlay,
          {
            paddingTop: safeArea.top,
            paddingBottom: safeArea.bottom,
          },
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.topOverlay,
            {
              top: safeArea.top + 4,
            },
          ]}
        >
          {renderHeader(() => router.push("/leaderboard"))}
          {renderTopStatsCard(liveStats)}

          {activeTrailActivity ? (
            <ActiveTrailCard activity={activeTrailActivity} />
          ) : null}

          {renderWarningCard(
            isMovingTooFast,
            locationError,
            onRestartTracking,
          )}

          <View style={styles.huntCardsRow}>
            <View style={styles.huntCardColumn}>
              {ENABLE_RELIC_TEST_MODE ? (
                <RelicDistanceCard
                  relic={nearestRelic?.relic ?? null}
                  distanceMeters={distanceToRelic}
                  direction={relicDirection}
                  canCollect={canCollectRelic}
                  isProgressLoaded={isProgressLoaded}
                  isCollecting={collectingRelicId !== null}
                  testModeEnabled
                  onCollect={() => handleCollectRelic(false)}
                  onTestCollect={() => handleCollectRelic(true)}
                />
              ) : (
                <SecureRelicCard
                  field={secureRelicField}
                  navigationDirection={
                    compassBearing === null
                      ? null
                      : getCardinalDirection(compassBearing)
                  }
                  navigationBearing={compassBearing}
                  expanded={isRelicCardOpen}
                  onExpandedChange={setIsRelicCardOpen}
                />
              )}
            </View>

            <CompanionSearchCard
              state={companionSearchState}
              onScan={startCompanionSearch}
            />
          </View>
        </View>

        <SideMapButtons
          onZoomOut={zoomOutMap}
          onCenterMap={centerMapOnUser}
          onOpenBot={openMissionTrailBot}
        />

        {selectedMeetup ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.meetupPreviewOverlay,
              { bottom: meetupSheetBottom, height: meetupSheetHeight },
            ]}
          >
            <MeetupMapPreview
              meetup={selectedMeetup}
              userLocation={playerCoordinate}
              friendUserIds={meetupFriendIds}
              currentUserId={meetupViewerId}
              joining={joiningMeetupId === selectedMeetup.id}
              onClose={() => setSelectedMeetupId(null)}
              onJoin={joinMeetup}
              onViewDetails={viewMeetupDetails}
            />
          </View>
        ) : null}

        <View style={styles.mapStyleButtons}>
          <AuraButton
            auraColor={selectedAura.color}
            onPress={() => setIsAuraModalOpen(true)}
          />
          <FootprintButton
            auraColor={selectedAura.color}
            onPress={() => setIsFootprintModalOpen(true)}
          />
        </View>

        <AuraPickerModal
          visible={isAuraModalOpen}
          selectedAura={selectedAura}
          onSelect={selectAura}
          onClose={() => setIsAuraModalOpen(false)}
        />

        <FootprintPickerModal
          visible={isFootprintModalOpen}
          selectedFootprint={selectedFootprint}
          auraColor={selectedAura.color}
          onSelect={selectFootprint}
          onClose={() => setIsFootprintModalOpen(false)}
        />

        <View
          style={[
            styles.bottomOverlay,
            {
              bottom: safeArea.bottom + 10,
            },
          ]}
        >
          {renderBottomTabBar(router, canUseTrails)}
        </View>
      </View>

      <RelicAwakening
        relic={awakeningRelic}
        totalXp={totalXp}
        onClose={() => setAwakeningRelic(null)}
      />

      <MeetupListModal
        visible={canUseMeetups && isMeetupListOpen}
        meetups={canUseMeetups ? mapMeetups : []}
        radiusMiles={meetupRadiusMiles}
        userLocation={playerCoordinate}
        currentUserId={meetupViewerId}
        friendUserIds={meetupFriendIds}
        joiningMeetupId={joiningMeetupId}
        onChangeRadius={setMeetupRadiusMiles}
        onClose={() => setIsMeetupListOpen(false)}
        onJoin={joinMeetup}
        onViewDetails={(meetup) => {
          setSelectedMeetupId(meetup.id);
          setIsMeetupListOpen(false);
        }}
      />

      <MissionTrailBot visible={botOpen} onClose={closeMissionTrailBot} />
    </View>
  );
}


function renderWalkedPath(coordinates: Coordinate[]) {
  if (coordinates.length <= 1) {
    return null;
  }

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

// =======================
// FOOTPRINT MARKERS
// =======================

const FOOTPRINT_MIN_MOVEMENT_METERS = 4;

// Purpose: Measures visual GPS movement without changing secure GPS evidence.
function getFootprintDistanceMeters(
  left: Location.LocationObject,
  right: Location.LocationObject,
) {
  // Purpose: Converts degrees to radians for the distance calculation.
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

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

// Purpose: Keeps visual footprints frozen during normal GPS drift.
function getWalkingFootprintLocations(locations: Location.LocationObject[]) {
  const uniqueLocations = deduplicateGpsLocations(locations);

  if (uniqueLocations.length <= 1) {
    return uniqueLocations;
  }

  const walkingLocations: Location.LocationObject[] = [uniqueLocations[0]];

  for (const location of uniqueLocations.slice(1)) {
    const previous = walkingLocations.at(-1);

    if (!previous) {
      walkingLocations.push(location);
      continue;
    }

    const distanceMeters = getFootprintDistanceMeters(previous, location);

    const maximumAccuracy = Math.max(
      previous.coords.accuracy ?? 0,
      location.coords.accuracy ?? 0,
    );

    // Poorer GPS accuracy requires a larger displacement before the visual
    // footprint is allowed to move. This prevents stationary GPS wobble from
    // walking the player's icon around the map.
    const accuracyMovementThreshold = Math.max(
      FOOTPRINT_MIN_MOVEMENT_METERS,
      Math.min(30, maximumAccuracy * 1.25),
    );

    const speedMetersPerSecond = Math.max(0, location.coords.speed ?? 0);

    const movingByDistance = distanceMeters >= accuracyMovementThreshold;

    const speedLooksPlausible =
      speedMetersPerSecond <= speedLimitMetersPerSecond;

    // Purpose: Moves footprints only after movement clears GPS uncertainty.
    if (movingByDistance && speedLooksPlausible) {
      walkingLocations.push(location);
    }
  }

  return walkingLocations;
}

// Purpose: Keeps the live footprint marker on the last confirmed movement point.
function getStableFootprintLocation(locations: Location.LocationObject[]) {
  return getWalkingFootprintLocations(locations).at(-1) ?? locations.at(-1);
}

// Purpose: Renders footprint markers.
function renderFootprintMarkers(
  locations: Location.LocationObject[],
  auraColor: string,
  selectedFootprint: (typeof footprintOptions)[number],
  huntStage: RelicHuntStage,
) {
  const uniqueLocations = getWalkingFootprintLocations(locations);
  const intensity = getRelicHuntIntensity(huntStage);

  // Footprint spacing stays constant. Relic hunt intensity may change the
  // glow, but it must never make old footprints jump around or respawn.
  const sampleStride = 2;
  const walkedLocations = uniqueLocations.slice(0, -1);
  // The newest GPS point belongs exclusively to the live-position marker.
  // Keeping it out of the trail prevents two native markers from competing at
  // the exact same coordinate. Timestamps remain stable when the rolling GPS
  // window shifts, so existing markers are not destroyed and recreated.
  return walkedLocations
    .filter(
      (_, index) =>
        index % sampleStride === 0 || index === walkedLocations.length - 1,
    )
    .map((location) => (
      <Marker
        key={getGpsSampleId(location)}
        coordinate={makeMapCoordinate(location)}
        tracksViewChanges={false}
        zIndex={1}
        anchor={{
          x: 0.5,
          y: 0.5,
        }}
      >
        <View
          style={[
            styles.mapFootprintGlow,
            {
              backgroundColor: getAuraGlowBackground(auraColor),
              shadowColor: auraColor,
              opacity: 0.55 + intensity * 0.08,
              transform: [{ scale: 0.82 + intensity * 0.045 }],
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

// =======================
// USER LOCATION GLOW
// =======================

// Purpose: Renders user glow.
function renderUserGlow(
  location?: Location.LocationObject,
  auraColor?: string,
  selectedFootprint?: (typeof footprintOptions)[number],
  huntStage: RelicHuntStage = "SEARCHING",
) {
  if (!location || !auraColor || !selectedFootprint) {
    return null;
  }
  const intensity = getRelicHuntIntensity(huntStage);

  return (
    <Marker
      coordinate={makeMapCoordinate(location)}
      tracksViewChanges
      zIndex={2}
      anchor={{
        x: 0.5,
        y: 0.5,
      }}
    >
      <View
        style={[
          styles.currentFootprintGlow,
          {
            backgroundColor: getAuraGlowBackground(auraColor),
            shadowColor: auraColor,
            shadowOpacity: 0.16 + intensity * 0.05,
            shadowRadius: 9 + intensity * 1.4,
            transform: [{ scale: 0.92 + intensity * 0.025 }],
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

// Purpose: Renders relic markers.
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
              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      </Marker>
    );
  });
}

// Purpose: Renders mystery zone markers.
function renderMysteryZoneMarkers(
  zones: MysteryZone[],
  selectedAssignmentId: string | null,
  onSelect: (assignmentId: string) => void,
  huntStage: RelicHuntStage,
) {
  return zones.flatMap((zone) => {
    const selected = zone.assignmentId === selectedAssignmentId;
    const color =
      zone.availability === "locked"
        ? "#72667D"
        : selected
          ? "#E879F9"
          : "#8B5CF6";
    const intensity = selected ? getRelicHuntIntensity(huntStage) : 0;
    return [
      <Circle
        key={`${zone.assignmentId}-zone`}
        center={{ latitude: zone.latitude, longitude: zone.longitude }}
        radius={zone.radiusMeters}
        strokeColor={`${color}A8`}
        fillColor={`${color}${selected ? (intensity >= 4 ? "42" : "30") : "18"}`}
        strokeWidth={selected ? Math.min(4, 1.5 + intensity * 0.4) : 1}
      />,
      <Marker
        key={zone.assignmentId}
        coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
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

// Purpose: Renders the hidden relic marker interface.
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

    const duration = Math.max(520, 1_300 - intensity * 210);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [intensity, locked, pulse, reduceMotion]);

  // Keep the map marker's physical bounds completely stable.
  // Scaling the custom Marker itself can cause it to briefly jump
  // away from its map coordinate while React Native Maps redraws it.
  const markerStyle = useAnimatedStyle(() => ({
    opacity: 0.82 + pulse.value * 0.18,
  }));

  return (
    <Animated.View
      accessibilityLabel={
        locked
          ? "Locked Hidden Relic Area"
          : `Hidden Relic Area. Signal level ${Math.max(1, intensity)} of 5`
      }
      style={[
        styles.anomalyMarker,
        { borderColor: color, shadowColor: color },
        selected && styles.anomalyMarkerSelected,
        markerStyle,
      ]}
    >
      <View
        style={[styles.anomalyPulseCore, { backgroundColor: `${color}55` }]}
      />
      <Ionicons
        name={locked ? "lock-closed" : "help"}
        size={21}
        color="#FFFFFF"
      />
    </Animated.View>
  );
}

// Purpose: Renders the relic distance card interface.
function RelicDistanceCard({
  relic,
  distanceMeters,
  direction,
  canCollect,
  isProgressLoaded,
  isCollecting,
  testModeEnabled,
  onCollect,
  onTestCollect,
}: {
  relic: Relic | null;
  distanceMeters: number | null;
  direction: string | null;
  canCollect: boolean;
  isProgressLoaded: boolean;
  isCollecting: boolean;
  testModeEnabled: boolean;
  onCollect: () => void;
  onTestCollect: () => void;
}) {
  // Step 3: The button is enabled only after progress loads, GPS is in range,
  // and there is another uncollected relic.
  const isButtonDisabled =
    !isProgressLoaded || !canCollect || !relic || isCollecting;

  return (
    <View
      style={[
        styles.relicDistanceCard,
        canCollect && styles.relicDistanceCardReady,
      ]}
    >
      <Text style={styles.relicDistanceText}>
        {!relic && isProgressLoaded
          ? "All relics collected. Your vault is complete!"
          : distanceMeters === null
            ? "Finding the relics around you..."
            : direction
              ? `${relic?.name} is ${formatDistanceFeetAndInches(distanceMeters)} ${direction} of you.`
              : `${relic?.name} is ${formatDistanceFeetAndInches(distanceMeters)} away.`}
      </Text>
      {canCollect && relic && (
        <Text style={styles.relicReadyText}>
          You are within {RELIC_COLLECTION_RADIUS_FEET} ft. Collect {relic.name}
          !
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          relic ? `Collect ${relic.name}` : "No relic available"
        }
        accessibilityState={{ disabled: isButtonDisabled }}
        disabled={isButtonDisabled}
        onPress={onCollect}
        style={({ pressed }) => [
          styles.collectRelicButton,
          isButtonDisabled && styles.collectRelicButtonDisabled,
          pressed && !isButtonDisabled && styles.pressed,
        ]}
      >
        <Text style={styles.collectRelicButtonText}>
          {isCollecting
            ? "Saving..."
            : relic
              ? `Collect ${relic.name}`
              : "All Collected"}
        </Text>
      </Pressable>

      {testModeEnabled && relic && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Collect ${relic.name} for testing`}
          disabled={!isProgressLoaded || isCollecting}
          onPress={onTestCollect}
          style={({ pressed }) => [
            styles.testCollectButton,
            (!isProgressLoaded || isCollecting) &&
              styles.collectRelicButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.testCollectButtonText}>Collect For Testing</Text>
        </Pressable>
      )}
    </View>
  );
}

// Purpose: Renders the hunt energy overlay interface.
function HuntEnergyOverlay({ stage }: { stage: RelicHuntStage }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const intensity = getRelicHuntIntensity(stage);
  const visible = stage === "VERY_CLOSE" || stage === "SIGNAL_LOCKED";

  useEffect(() => {
    if (!visible || reduceMotion) {
      pulse.value = 0;
      return;
    }
    const duration = stage === "SIGNAL_LOCKED" ? 520 : 760;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [pulse, reduceMotion, stage, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visible ? 0.12 + intensity * 0.025 + pulse.value * 0.12 : 0,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.huntEnergyOverlay, animatedStyle]}
    />
  );
}

// Purpose: Renders the relic compass interface.
function RelicCompass({
  relicBearing,
  phoneHeading,
  direction,
  distanceFeet,
  huntStage,
}: {
  relicBearing: number | null;
  phoneHeading: number | null;
  direction: string | null;
  distanceFeet?: number | null;
  huntStage: RelicHuntStage;
}) {
  const reduceMotion = useReducedMotion();
  const huntIntensity = getRelicHuntIntensity(huntStage);

  const hasRelicTarget = relicBearing !== null && direction !== null;

  const hasPhoneHeading = phoneHeading !== null;

  const hasGuidance = hasRelicTarget && hasPhoneHeading;

  // -------------------------------------------------
  // PHONE COMPASS DIAL
  // -------------------------------------------------

  const dialRotation = useSharedValue(0);

  useEffect(() => {
    if (phoneHeading === null) {
      return;
    }

    // The compass rose moves opposite the way the phone turns.
    const target = (360 - phoneHeading) % 360;

    const currentNormalized = ((dialRotation.value % 360) + 360) % 360;

    let difference = target - currentNormalized;

    // Always take the shortest rotation path.
    if (difference > 180) {
      difference -= 360;
    } else if (difference < -180) {
      difference += 360;
    }

    const nextRotation = dialRotation.value + difference;

    dialRotation.value = reduceMotion
      ? nextRotation
      : withTiming(nextRotation, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
        });
  }, [dialRotation, phoneHeading, reduceMotion]);

  const dialAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotateZ: `${dialRotation.value}deg`,
      },
    ],
  }));

  // Keep N / E / S / W letters upright while their
  // positions rotate around the compass.
  const labelCounterRotationStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotateZ: `${-dialRotation.value}deg`,
      },
    ],
  }));

  // -------------------------------------------------
  // RELIC NAVIGATION ARROW
  // -------------------------------------------------

  const relativeBearing =
    relicBearing === null || phoneHeading === null
      ? null
      : (relicBearing - phoneHeading + 360) % 360;

  const needleRotation = useSharedValue(0);

  useEffect(() => {
    if (relativeBearing === null) {
      return;
    }

    const target = ((relativeBearing % 360) + 360) % 360;

    const currentNormalized = ((needleRotation.value % 360) + 360) % 360;

    let difference = target - currentNormalized;

    if (difference > 180) {
      difference -= 360;
    } else if (difference < -180) {
      difference += 360;
    }

    const nextRotation = needleRotation.value + difference;

    needleRotation.value = reduceMotion
      ? nextRotation
      : withTiming(nextRotation, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        });
  }, [needleRotation, reduceMotion, relativeBearing]);

  const needleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotateZ: `${needleRotation.value}deg`,
      },
    ],
  }));

  const huntPulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || huntIntensity === 0) {
      huntPulse.value = 0;
      return;
    }
    const duration =
      [2_200, 2_200, 1_600, 1_100, 750, 520][huntIntensity] ?? 2_200;
    huntPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [huntIntensity, huntPulse, reduceMotion]);

  const huntPulseStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + huntIntensity * 0.04 + huntPulse.value * 0.2,
    transform: [
      { scale: 1 + huntPulse.value * (0.04 + huntIntensity * 0.008) },
    ],
  }));

  // -------------------------------------------------
  // TEXT GUIDANCE
  // -------------------------------------------------

  const phoneDirection =
    phoneHeading === null ? null : getCardinalDirection(phoneHeading);

  const headingText =
    phoneHeading === null
      ? "WAITING FOR COMPASS"
      : `FACING ${phoneDirection?.toUpperCase() ?? ""} · ${Math.round(
          phoneHeading,
        )}°`;

  const turnInstruction = (() => {
    if (!hasPhoneHeading) {
      return "COMPASS STARTING";
    }

    if (!hasRelicTarget || relativeBearing === null) {
      return "FIND A RELIC";
    }

    if (relativeBearing <= 15 || relativeBearing >= 345) {
      return "STRAIGHT AHEAD";
    }

    if (relativeBearing >= 165 && relativeBearing <= 195) {
      return "BEHIND YOU";
    }

    return relativeBearing < 180 ? "TURN RIGHT" : "TURN LEFT";
  })();

  const signalText = huntStage.replaceAll("_", " ");

  return (
    <View
      accessible
      accessibilityLabel={
        hasGuidance
          ? `Relic navigator. ${signalText}. ${headingText}. Relic is ${direction}. ${turnInstruction}.`
          : `Compass. ${headingText}.`
      }
      pointerEvents="none"
      style={[
        styles.relicCompass,
        !hasRelicTarget && styles.relicCompassWaiting,
      ]}
    >
      <Text style={styles.compassTitle}>RELIC NAVIGATOR</Text>

      <View style={styles.compassDial}>
        <Animated.View style={[styles.compassRadarPulse, huntPulseStyle]} />
        {/* Moving compass rose */}
        <Animated.View
          style={[StyleSheet.absoluteFillObject, dialAnimatedStyle]}
        >
          <Animated.Text
            style={[
              styles.compassPoint,
              styles.compassNorth,
              labelCounterRotationStyle,
            ]}
          >
            N
          </Animated.Text>

          <Animated.Text
            style={[
              styles.compassPoint,
              styles.compassEast,
              labelCounterRotationStyle,
            ]}
          >
            E
          </Animated.Text>

          <Animated.Text
            style={[
              styles.compassPoint,
              styles.compassSouth,
              labelCounterRotationStyle,
            ]}
          >
            S
          </Animated.Text>

          <Animated.Text
            style={[
              styles.compassPoint,
              styles.compassWest,
              labelCounterRotationStyle,
            ]}
          >
            W
          </Animated.Text>
        </Animated.View>

        {/* Gold arrow points toward relic */}
        {hasGuidance ? (
          <Animated.View
            style={[styles.compassNeedleLayer, needleAnimatedStyle]}
          >
            <Ionicons name="arrow-up" size={29} color="#facc15" />
          </Animated.View>
        ) : (
          // Cyan arrow represents the direction
          // the top of the phone is facing.
          <Ionicons name="arrow-up" size={25} color="#6FE7FF" />
        )}

        <View style={styles.compassCenterDot} />
      </View>

      {/* This ALWAYS tells us whether the sensor works */}
      <Text style={styles.compassDirection}>{headingText}</Text>

      <Text style={styles.compassHint}>{turnInstruction}</Text>

      {hasRelicTarget && direction ? (
        <Text style={styles.compassHint}>RELIC {direction.toUpperCase()}</Text>
      ) : null}

      {distanceFeet !== null && distanceFeet !== undefined ? (
        <Text style={styles.compassDistance}>
          {formatRelicSignalDistance(distanceFeet)}
        </Text>
      ) : null}

      <Text style={styles.compassStage}>{signalText}</Text>
    </View>
  );
}

// Purpose: Returns aura glow background.
function getAuraGlowBackground(auraColor: string) {
  return `${auraColor}24`;
}

// Purpose: Renders the aura button interface.
function AuraButton({
  auraColor,
  onPress,
}: {
  auraColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Choose footprint aura color"
      onPress={onPress}
      style={({ pressed }) => [
        styles.auraButton,
        { borderColor: auraColor, shadowColor: auraColor },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name="color-palette"
        size={isSmallPhone ? 19 : 21}
        color={auraColor}
      />
    </Pressable>
  );
}

// Purpose: Renders the footprint button interface.
function FootprintButton({
  auraColor,
  onPress,
}: {
  auraColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Choose zodiac footprint"
      onPress={onPress}
      style={({ pressed }) => [
        styles.auraButton,
        { borderColor: auraColor, shadowColor: auraColor },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name="footsteps"
        size={isSmallPhone ? 19 : 21}
        color={auraColor}
      />
    </Pressable>
  );
}

// Purpose: Renders the aura picker modal interface.
function AuraPickerModal({
  visible,
  selectedAura,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedAura: (typeof auraOptions)[number];
  onSelect: (aura: (typeof auraOptions)[number]) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.auraModalBackdrop}>
        <View style={styles.auraModalCard}>
          <Text style={styles.auraModalTitle}>Choose Your Cosmic Aura</Text>

          <View style={styles.auraOptionGrid}>
            {auraOptions.map((aura) => {
              const isSelected = aura.name === selectedAura.name;

              return (
                <Pressable
                  key={aura.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelect(aura)}
                  style={({ pressed }) => [
                    styles.auraOptionCard,
                    {
                      borderColor: isSelected
                        ? aura.color
                        : "rgba(168, 85, 247, 0.35)",
                      shadowColor: aura.color,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.auraEmoji}>{aura.emoji}</Text>
                  <Text style={styles.auraName}>{aura.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.auraCloseButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.auraCloseText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Purpose: Renders the footprint picker modal interface.
function FootprintPickerModal({
  visible,
  selectedFootprint,
  auraColor,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedFootprint: (typeof footprintOptions)[number];
  auraColor: string;
  onSelect: (footprint: (typeof footprintOptions)[number]) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.auraModalBackdrop}>
        <View style={styles.auraModalCard}>
          <Text style={styles.auraModalTitle}>
            Choose Your Zodiac Footprint
          </Text>

          <View style={styles.auraOptionGrid}>
            {footprintOptions.map((footprint) => {
              const isSelected = footprint.name === selectedFootprint.name;

              return (
                <Pressable
                  key={footprint.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelect(footprint)}
                  style={({ pressed }) => [
                    styles.auraOptionCard,
                    {
                      borderColor: isSelected
                        ? auraColor
                        : "rgba(168, 85, 247, 0.35)",
                      shadowColor: auraColor,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Image
                    source={footprint.source}
                    style={styles.footprintOptionImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.auraName}>{footprint.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.auraCloseButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.auraCloseText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// =======================
// HEADER
// =======================

// Purpose: Renders header.
function renderHeader(openLeaderboard: () => void) {
  return (
    <View style={styles.headerBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open leaderboard"
        onPress={openLeaderboard}
        style={({ pressed }) => [
          styles.leaderboardButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="trophy" size={isSmallPhone ? 17 : 19} color="#facc15" />
      </Pressable>

      <View style={styles.logoOrbit}>
        <Ionicons
          name="planet-outline"
          size={isSmallPhone ? 21 : 24}
          color="#ff68f4"
        />
      </View>

      <Text style={styles.headerTitle}>MISSION TRAIL</Text>

      <View style={styles.bellWrap}>
        <Ionicons
          name="notifications-outline"
          size={isSmallPhone ? 18 : 20}
          color="#ffffff"
        />
      </View>
    </View>
  );
}

// =======================
// TOP STATS
// =======================

// Purpose: Renders top stats card.
function renderTopStatsCard(liveStats: HomeBackupInterfaceProps["liveStats"]) {
  const stats = [
    {
      label: "Distance",

      value: liveStats.distance,

      unit: "mi",

      icon: "location-outline" as NeonIconName,

      color: "#00e5ff",
    },

    {
      label: "Steps",

      value: liveStats.steps,

      unit: "steps",

      icon: "footsteps-outline" as NeonIconName,

      color: "#ff63f7",
    },

    {
      label: "Items",

      value: liveStats.items,

      unit: "found",

      icon: "gift-outline" as NeonIconName,

      color: "#a855f7",
    },
  ];

  return (
    <View style={styles.statsCard}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.statItem}>
          <View style={styles.statLabelRow}>
            <Ionicons name={stat.icon} size={13} color={stat.color} />

            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>

          <Text style={styles.statValue}>{stat.value}</Text>

          <Text style={styles.statUnit}>{stat.unit}</Text>
        </View>
      ))}
    </View>
  );
}

// =======================
// WARNING CARD
// =======================

// Purpose: Renders warning card.
function renderWarningCard(
  isMovingTooFast: boolean,

  locationError: string | null,

  onTryAgain: () => void,
) {
  if (!isMovingTooFast && !locationError) {
    return null;
  }

  return (
    <View style={styles.warningCard}>
      <Ionicons name="warning-outline" size={21} color="#ffffff" />

      <View style={styles.warningCopy}>
        <Text style={styles.warningTitle}>
          {locationError ? "Location needed" : "DRIVING DETECTED"}
        </Text>

        <Text style={styles.warningText}>
          {locationError ??
            "Mission Trails is paused while moving at vehicle speed. Stop moving to continue exploring."}
        </Text>
        {locationError ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try location again"
            onPress={onTryAgain}
            style={styles.warningRetryButton}
          >
            <Text style={styles.warningRetryText}>Try Again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Purpose: Renders the active trail card interface.
function ActiveTrailCard({ activity }: { activity: ActiveTrailActivity }) {
  return (
    <View style={styles.activeTrailCard}>
      <Ionicons name="trail-sign" size={18} color="#6FE7FF" />
      <View style={styles.activeTrailCopy}>
        <Text numberOfLines={1} style={styles.activeTrailTitle}>
          {activity.trail.name}
        </Text>
        <Text style={styles.activeTrailText}>
          Active trail · verified GPS tracking is on
        </Text>
      </View>
    </View>
  );
}

// =======================
// GPS STATUS BADGE
// =======================

// Purpose: Renders gps status badge.
function renderGpsStatusBadge(
  isTracking: boolean,

  currentSpeedMph: number,

  safeBottom: number,
) {
  return (
    <View
      style={[
        styles.mapCenterBadge,

        {
          bottom: safeBottom + tabBarHeight + 28,
        },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.mapCenterTitle}>GPS ACTIVE</Text>

      <Text style={styles.mapCenterText}>
        {isTracking ? "Tracking footsteps" : "Tracking paused"} |{" "}
        {currentSpeedMph.toFixed(1)} MPH
      </Text>
    </View>
  );
}
// =======================
// SIDE MAP BUTTONS
// =======================

// Purpose: Renders the side map buttons interface.
function CompanionSearchCard({
  state,
  onScan,
}: {
  state: CompanionSearchState;
  onScan: () => void;
}) {
  const isTraveling = state === "traveling";
  const isFound = state === "found";

  return (
    <View style={styles.companionSearchCard}>
      <View style={styles.companionSearchHeader}>
        <Ionicons name="sparkles" size={15} color="#FF63F7" />
        <Text style={styles.companionSearchEyebrow}>HIDDEN COMPANION</Text>
        <Ionicons name="cellular" size={18} color="#A855F7" />
      </View>

      <Text style={styles.companionSearchTitle}>
        {isFound ? "COMPANION FOUND" : isTraveling ? "TRACKING" : "SEARCHING"}
      </Text>
      <Text style={styles.companionSearchSignal}>
        {isFound
          ? "COMPANION SUCCESSFULLY COLLECTED"
          : isTraveling
            ? "FOLLOWING COMPANION SIGNAL"
            : "SEARCHING FOR A COMPANION"}
      </Text>

      <View style={styles.companionLiveGpsRow}>
        <Ionicons name="navigate-circle" size={13} color="#C4B5FD" />
        <Text style={styles.companionLiveGpsText}>
          FIND YOUR COMPANION — REAL-TIME GPS
        </Text>
      </View>

      <Text style={styles.companionSearchCopy}>
        {isFound
          ? "Your new Companion has been registered."
          : isTraveling
            ? "Take your phone outside and walk toward the Companion. Your Explorer moves only when your real GPS moves."
            : "Scan to place a nearby Companion, then take your phone outside and follow the live GPS marker."}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan for Companion"
        disabled={isTraveling}
        onPress={onScan}
        style={({ pressed }) => [
          styles.companionScanButton,
          isTraveling && styles.companionScanButtonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name={isFound ? "checkmark-circle" : "scan"} size={16} color="#FFFFFF" />
        <Text style={styles.companionScanButtonText}>
          {isFound ? "SCAN AGAIN" : isTraveling ? "TRACKING..." : "SCAN FOR COMPANION"}
        </Text>
      </Pressable>

      <Text style={styles.companionSearchDetails}>Details⌄</Text>
    </View>
  );
}

function SideMapButtons({
  onZoomOut,
  onCenterMap,
  onOpenBot,
}: {
  onZoomOut: () => void;
  onCenterMap: () => void;
  onOpenBot: () => void;
}) {
  return (
    <View style={styles.floatingButtons}>
      {mapButtons.map((button) => (
        <Pressable
          key={button.label}
          accessibilityRole="button"
          accessibilityLabel={button.label}
          style={({ pressed }) => [
            styles.floatingButton,

            pressed && styles.pressed,
          ]}
          onPress={() => {
            if (button.action === "chatbot") {
              onOpenBot();
            }

            if (button.action === "zoom-out") {
              onZoomOut();
            }

            if (button.action === "current-location") {
              onCenterMap();
            }
          }}
        >
          <Ionicons
            name={button.icon as any}
            size={isSmallPhone ? 19 : 21}
            color="#d9f7ff"
          />
        </Pressable>
      ))}
    </View>
  );
}

// This modal keeps meetup markers accessible through a readable card list.
// Purpose: Renders the meetup list modal interface.
function MeetupListModal({
  visible,
  meetups,
  radiusMiles,
  userLocation,
  currentUserId,
  friendUserIds,
  joiningMeetupId,
  onChangeRadius,
  onClose,
  onJoin,
  onViewDetails,
}: {
  visible: boolean;
  meetups: readonly Meetup[];
  radiusMiles: MeetupRadiusMiles;
  userLocation: Coordinate | null;
  currentUserId: string | null;
  friendUserIds: readonly string[];
  joiningMeetupId: string | null;
  onChangeRadius: (radius: MeetupRadiusMiles) => void;
  onClose: () => void;
  onJoin: (meetup: Meetup) => void | Promise<void>;
  onViewDetails: (meetup: Meetup) => void;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.meetupModalBackdrop}>
        <View style={styles.meetupModalCard}>
          <View style={styles.meetupModalHeader}>
            <View style={styles.meetupModalHeadingCopy}>
              <Text style={styles.meetupModalTitle}>Meetups Today</Text>
              <Text style={styles.meetupModalSubtitle}>
                Public landmark locations only
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close meetups list"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.meetupModalClose}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <View
            accessibilityLabel="Meetup search radius"
            style={styles.meetupRadiusRow}
          >
            {MEETUP_RADIUS_OPTIONS.map((radius) => {
              const selected = radius === radiusMiles;
              return (
                <Pressable
                  key={radius}
                  accessibilityLabel={`Show meetups within ${radius} miles`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onChangeRadius(radius)}
                  style={[
                    styles.meetupRadiusChip,
                    selected && styles.meetupRadiusChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.meetupRadiusText,
                      selected && styles.meetupRadiusTextSelected,
                    ]}
                  >
                    {radius} mi
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <MeetupsTodaySection
            meetups={meetups}
            userLocation={userLocation}
            radiusMiles={radiusMiles}
            currentUserId={currentUserId}
            friendUserIds={friendUserIds}
            joiningMeetupId={joiningMeetupId}
            onJoinMeetup={onJoin}
            onViewDetails={onViewDetails}
          />
        </View>
      </View>
    </Modal>
  );
}

// =======================
// BOTTOM TAB BAR
// =======================

// Purpose: Renders bottom tab bar.
function renderBottomTabBar(
  router: Router,
  canUseTrails: boolean,
) {

  // Purpose:
  // Opens normal tabs while preventing Kids or pending
  // accounts from entering the protected Trails route.
  const openTab = (
    tab: (typeof bottomTabs)[number],
  ) => {

    if (
      tab.key === "trails" &&
      !canUseTrails
    ) {
      Alert.alert(
        "Trails Locked",
        "Trails and Meetups require ID verification. Kids Mode can continue using the rest of Mission Trails.",
      );

      return;
    }

    router.push(tab.route);
  };

  return (
    <View style={styles.tabBar}>
      {bottomTabs.map((tab) => {
        const isActiveTab = tab.key === "home";

        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.tabButton,

              pressed && styles.pressed,
            ]}
            onPress={() => openTab(tab)}
          >
            <View
              style={[
                styles.tabIconWrap,

                isActiveTab && styles.activeTabIconWrap,
              ]}
            >
              <Image
                source={tab.image}
                style={styles.tabIcon}
                resizeMode="contain"
              />
            </View>

            <Text
              style={[styles.tabLabel, isActiveTab && styles.activeTabLabel]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// =======================+
// STYLES
// =======================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: "relative",
    backgroundColor: "#0a0a1a",
  },

  // Keep the real MapLibre/native map as the bottom layer. The HUD, side
  // controls and navigation are siblings rendered after it and must remain
  // above the web iframe.
  mapLayer: {
    zIndex: 0,
    elevation: 0,
  },

  locationEntryBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3, 2, 18, 0.78)",
    paddingHorizontal: 18,
  },

  locationEntryCard: {
    width: "100%",
    maxWidth: 620,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 1, 226, 0.78)",
    backgroundColor: "rgba(9, 5, 29, 0.99)",
    padding: 18,
    shadowColor: "#FF01E2",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 18,
  },

  locationEntryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  locationEntryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C3AED",
    borderWidth: 1,
    borderColor: "#FF63F7",
  },

  locationEntryHeaderCopy: { flex: 1 },
  locationEntryTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  locationEntrySubtitle: {
    color: "#C4B5FD",
    fontSize: 11,
    marginTop: 3,
  },
  locationEntryLabel: {
    color: "#E9D5FF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  locationEntryInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.72)",
    backgroundColor: "rgba(20, 10, 34, 0.98)",
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  locationEntryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  locationEntryCityColumn: { flex: 2, minWidth: 180 },
  locationEntryStateColumn: { flex: 1, minWidth: 90 },
  locationEntryZipColumn: { flex: 1, minWidth: 110 },
  locationEntryPrivacy: {
    color: "#9F93B3",
    fontSize: 9,
    lineHeight: 13,
    marginTop: 1,
  },
  locationEntryActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  locationEntryCancelButton: {
    minHeight: 44,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#6D5A7D",
    backgroundColor: "#140A22",
    paddingHorizontal: 16,
  },
  locationEntryCancelText: {
    color: "#DDD6FE",
    fontSize: 10,
    fontWeight: "900",
  },
  locationEntrySubmitButton: {
    minHeight: 44,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 10,
    backgroundColor: "#7C3AED",
    borderWidth: 1,
    borderColor: "#FF63F7",
    paddingHorizontal: 16,
  },
  locationEntrySubmitText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  cosmicOverlay: {
    position: "absolute",
    zIndex: 1,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,

    backgroundColor: "rgba(18, 10, 46, 0.18)",
  },

  huntEnergyOverlay: {
    position: "absolute",
    zIndex: 2,
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    borderWidth: 5,
    borderRadius: 22,
    borderColor: "#D968FF",
    backgroundColor: "rgba(126,34,206,0.08)",
  },

  fixedOverlay: {
    // On web this MUST be fixed to the browser viewport.  The MapLibre map
    // lives in an iframe and can otherwise create its own stacking/scrolling
    // context, which is what caused the right controls and bottom tabs to
    // disappear even though the React components were still mounted.
    position: (Platform.OS === "web" ? "fixed" : "absolute") as any,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    paddingHorizontal: sidePadding,
    zIndex: 2147483000,
    elevation: 100,
  },

  topOverlay: {
    position: "absolute",
    left: sidePadding,
    right: sidePadding,
    gap: 9,
    zIndex: 2147483100,
    elevation: 120,
  },


  huntCardsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    zIndex: 135,
    elevation: 135,
  },

  huntCardColumn: {
    width: isSmallPhone ? 245 : 286,
  },

  companionSearchCard: {
    width: isSmallPhone ? 245 : 286,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.9)",
    backgroundColor: "rgba(7, 4, 28, 0.96)",
    padding: 10,
    shadowColor: "#A855F7",
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 12,
  },

  companionSearchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  companionSearchEyebrow: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  companionSearchTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 8,
  },

  companionSearchSignal: {
    color: "#FF4FD8",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 4,
  },

  companionSearchCopy: {
    color: "#C7BDD3",
    fontSize: 8,
    marginTop: 3,
  },

  companionLiveGpsRow: {
    marginTop: 6,
    minHeight: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(196, 181, 253, 0.72)",
    backgroundColor: "rgba(124, 58, 237, 0.20)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  companionLiveGpsText: {
    color: "#DDD6FE",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.35,
    textAlign: "center",
  },

  companionScanButton: {
    minHeight: 36,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: "#7C3AED",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  companionScanButtonDisabled: {
    opacity: 0.72,
  },

  companionScanButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  companionSearchDetails: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 7,
  },

  webCompanionMap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#09051D",
    zIndex: 1,
  },

  webCompanionMapTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(31, 10, 70, 0.22)",
  },

  webMissionTrailBrand: {
    position: "absolute",
    top: 160,
    left: "50%",
    transform: [{ translateX: -92 }],
    minWidth: 184,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 79, 216, 0.75)",
    backgroundColor: "rgba(7, 4, 28, 0.90)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    shadowColor: "#A855F7",
    shadowOpacity: 0.45,
    shadowRadius: 14,
  },

  webMissionTrailBrandText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
  },

  webMissionTrailBrandSubtext: {
    color: "#FF63F7",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 2,
  },

  webRouteLine: {
    position: "absolute",
    height: 5,
    marginTop: -2.5,
    transformOrigin: "0% 50%" as any,
    borderRadius: 999,
    backgroundColor: "#19D8FF",
    shadowColor: "#19D8FF",
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },

  webStartDot: {
    position: "absolute",
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#19D8FF",
  },

  webCompanionDestination: {
    position: "absolute",
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -24,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#FFB4FA",
    backgroundColor: "#A855F7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF2DF7",
    shadowOpacity: 0.95,
    shadowRadius: 16,
  },

  webMapMarkerLabel: {
    position: "absolute",
    top: 51,
    minWidth: 120,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    backgroundColor: "rgba(7, 4, 28, 0.88)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  webExplorerMarker: {
    position: "absolute",
    width: 42,
    height: 42,
    marginLeft: -21,
    marginTop: -21,
    borderRadius: 21,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#126BFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#19D8FF",
    shadowOpacity: 0.95,
    shadowRadius: 14,
  },

  webExplorerLabel: {
    position: "absolute",
    top: 45,
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    backgroundColor: "rgba(7, 4, 28, 0.88)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  webDemoBadge: {
    position: "absolute",
    left: "50%",
    bottom: 104,
    transform: [{ translateX: -125 }],
    width: 250,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(25, 216, 255, 0.7)",
    backgroundColor: "rgba(7, 4, 28, 0.92)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
  },

  webDemoBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  companionDestinationMarker: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#FF01E2",
    shadowColor: "#FF01E2",
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 12,
  },

  companionDestinationMarkerInactive: {
    opacity: 0.68,
    transform: [{ scale: 0.9 }],
  },

  companionDestinationLabel: {
    position: "absolute",
    top: 50,
    minWidth: 118,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    backgroundColor: "rgba(7, 4, 28, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 45, 247, 0.7)",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  companionWalkerMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#C084FC",
    shadowColor: "#FF01E2",
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 12,
  },

  youAreHereLabel: {
    position: "absolute",
    top: 46,
    minWidth: 104,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.45,
    backgroundColor: "rgba(7, 4, 28, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 1, 226, 0.75)",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  bottomOverlay: {
    position: "absolute",
    left: sidePadding,
    right: sidePadding,
    zIndex: 2147483300,
    elevation: 140,
  },

  meetupPreviewOverlay: {
    position: "absolute",
    left: sidePadding,
    right: sidePadding,
    justifyContent: "flex-end",
    zIndex: 70,
    elevation: 20,
  },

  meetupModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3, 2, 18, 0.72)",
  },

  meetupModalCard: {
    maxHeight: "76%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(155, 92, 255, 0.75)",
    backgroundColor: "rgba(6, 4, 26, 0.99)",
    paddingTop: 14,
    paddingBottom: 24,
    shadowColor: "#9B5CFF",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 16,
  },

  meetupModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },

  meetupModalHeadingCopy: {
    flex: 1,
  },

  meetupModalTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },

  meetupModalSubtitle: {
    color: "#B7A7C5",
    fontSize: 11,
    marginTop: 2,
  },

  meetupModalClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#4B2A63",
    backgroundColor: "#140A22",
  },

  meetupRadiusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    paddingHorizontal: 16,
    marginTop: 12,
  },

  meetupRadiusChip: {
    minWidth: 58,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4B2A63",
    backgroundColor: "#140A22",
    paddingHorizontal: 10,
  },

  meetupRadiusChipSelected: {
    borderColor: "#19D8FF",
    backgroundColor: "#0D2732",
  },

  meetupRadiusText: {
    color: "#B7A7C5",
    fontSize: 11,
    fontWeight: "900",
  },

  meetupRadiusTextSelected: {
    color: "#19D8FF",
  },

  relicDistanceCard: {
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.7)",
    borderRadius: 12,
    backgroundColor: "rgba(6, 4, 26, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
  },

  relicDistanceCardReady: {
    borderColor: "#ffd700",
    backgroundColor: "rgba(66, 47, 0, 0.92)",
  },

  relicDistanceText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  relicReadyText: {
    color: "#ffd700",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 3,
  },

  collectRelicButton: {
    marginTop: 9,
    minWidth: 150,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  collectRelicButtonDisabled: {
    backgroundColor: "#353047",
    opacity: 0.65,
  },

  collectRelicButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  testCollectButton: {
    marginTop: 7,
    minWidth: 150,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ff9f0a",
    backgroundColor: "rgba(255, 159, 10, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  testCollectButtonText: {
    color: "#ffb340",
    fontSize: 12,
    fontWeight: "900",
  },

  relicMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#ffd700",
    backgroundColor: "rgba(66, 20, 90, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffd700",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
    overflow: "visible",
  },

  relicMarkerImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },

  relicMarkerCheck: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },

  relicMarkerCollected: {
    opacity: 0.55,
    backgroundColor: "rgba(18, 54, 45, 0.92)",
  },

  anomalyMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    backgroundColor: "rgba(32, 12, 58, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.75,
    shadowRadius: 10,
    elevation: 8,
  },

  anomalyMarkerSelected: {
    borderWidth: 3,
    backgroundColor: "rgba(85, 22, 112, 0.96)",
  },

  anomalyPulseCore: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  headerBar: {
    height: isSmallPhone ? 40 : 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    zIndex: 130,
    elevation: 130,
    borderRadius: 12,
    backgroundColor: "rgba(6, 4, 26, 0.90)",
  },

  leaderboardButton: {
    position: "absolute",
    left: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.58)",
    backgroundColor: "rgba(65, 46, 5, 0.62)",
  },

  logoOrbit: {
    width: isSmallPhone ? 25 : 28,

    height: isSmallPhone ? 25 : 28,

    borderRadius: 14,

    alignItems: "center",

    justifyContent: "center",

    borderWidth: 1,

    borderColor: "rgba(168, 85, 247, 0.6)",

    backgroundColor: "rgba(86, 19, 216, 0.18)",
  },

  headerTitle: {
    color: "#ffffff",

    fontSize: isSmallPhone ? 17 : 19,

    fontWeight: "900",

    fontStyle: "italic",

    letterSpacing: 1.2,

    textShadowColor: "#a855f7",

    textShadowRadius: 7,
  },

  bellWrap: {
    position: "absolute",

    right: 4,

    width: 30,
    height: 30,

    alignItems: "center",

    justifyContent: "center",
  },

  statsCard: {
    minHeight: isSmallPhone ? 58 : 64,
    zIndex: 130,

    borderRadius: 14,

    borderWidth: 1,

    borderColor: "#a855f7",

    backgroundColor: "rgba(8, 5, 28, 0.88)",

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    paddingHorizontal: 8,

    elevation: 8,
  },

  statItem: {
    flex: 1,

    alignItems: "center",

    gap: 1,

    paddingHorizontal: 2,

    borderRightWidth: 1,

    borderRightColor: "rgba(168, 85, 247, 0.18)",
  },

  statLabelRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 2,
  },

  statLabel: {
    color: "#ffffff",

    fontSize: isSmallPhone ? 8 : 9,

    fontWeight: "900",

    letterSpacing: 0.7,

    textTransform: "uppercase",
  },

  statValue: {
    color: "#ffffff",

    fontSize: isSmallPhone ? 17 : 19,

    fontWeight: "900",
  },

  statUnit: {
    color: "#d9ddff",

    fontSize: isSmallPhone ? 7 : 8,

    fontWeight: "700",
  },

  warningCard: {
    minHeight: 48,

    borderRadius: 14,

    borderWidth: 1,

    borderColor: "#ff2d75",

    backgroundColor: "rgba(65, 6, 26, 0.9)",

    flexDirection: "row",

    alignItems: "center",

    gap: 8,

    paddingHorizontal: 10,
  },

  activeTrailCard: {
    display: "none",
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#19D8FF",
    backgroundColor: "rgba(5, 38, 57, 0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },

  activeTrailCopy: { flex: 1 },
  activeTrailTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  activeTrailText: { color: "#9DDFEF", fontSize: 9, marginTop: 2 },

  warningCopy: {
    flex: 1,

    gap: 2,
  },

  warningTitle: {
    color: "#ffffff",

    fontSize: 13,

    fontWeight: "900",
  },

  warningText: {
    color: "#ffffff",

    fontSize: 10,

    fontWeight: "600",
  },

  warningRetryButton: {
    minHeight: 36,
    alignSelf: "flex-start",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffffff",
    paddingHorizontal: 12,
    marginTop: 4,
  },

  warningRetryText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },

  mapCenterBadge: {
    display: "none",
    position: "absolute",

    alignSelf: "center",

    borderRadius: 999,

    borderWidth: 1,

    borderColor: "rgba(0, 229, 255, 0.5)",

    backgroundColor: "rgba(3, 2, 18, 0.82)",

    paddingHorizontal: 12,

    paddingVertical: 6,

    alignItems: "center",
  },

  mapCenterTitle: {
    color: "#ffffff",

    fontSize: 10,

    fontWeight: "900",

    letterSpacing: 1,
  },

  mapCenterText: {
    color: "#74eaff",

    fontSize: 9,

    fontWeight: "700",
  },

  floatingButtons: {
    position: "absolute",
    right: sidePadding,
    top: "40%",
    gap: 10,
    zIndex: 2147483400,
    elevation: 150,
  },

  relicCompass: {
    zIndex: 60,
    width: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.55)",
    backgroundColor: "rgba(3, 2, 18, 0.84)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center",
    elevation: 8,
  },

  relicCompassWaiting: {
    borderColor: "rgba(167, 139, 250, 0.7)",
  },

  compassTitle: {
    color: "#facc15",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  compassDial: {
    width: 72,
    height: 72,
    marginTop: 3,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(116, 234, 255, 0.42)",
    backgroundColor: "rgba(8, 5, 28, 0.82)",
    alignItems: "center",
    justifyContent: "center",
  },

  compassRadarPulse: {
    position: "absolute",
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderRadius: 39,
    borderWidth: 2,
    borderColor: "#D86BFF",
    backgroundColor: "rgba(216,107,255,0.06)",
  },

  compassPoint: {
    position: "absolute",
    color: "#d9ddff",
    fontSize: 8,
    fontWeight: "900",
  },

  compassNorth: {
    top: 4,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#ff647c",
  },

  compassEast: {
    right: 6,
    top: 30,
    textAlign: "center",
  },

  compassSouth: {
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: "center",
  },

  compassWest: {
    left: 6,
    top: 30,
    textAlign: "center",
  },

  compassNeedleLayer: {
    position: "absolute",
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    alignItems: "center",
  },

  compassCenterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ffffff",
    backgroundColor: "#7c3aed",
  },

  compassDirection: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 4,
    textAlign: "center",
  },

  compassDistance: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
  },

  compassHint: {
    color: "#c4b5fd",
    fontSize: 7,
    fontWeight: "700",
    marginTop: 1,
  },

  compassStage: {
    color: "#F5C451",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: "center",
  },

  floatingButton: {
    width: isSmallPhone ? 40 : 44,

    height: isSmallPhone ? 40 : 44,

    borderRadius: 22,

    alignItems: "center",

    justifyContent: "center",

    borderWidth: 1,

    borderColor: "#d946ef",

    backgroundColor: "rgba(15, 7, 39, 0.92)",

    elevation: 8,
  },

  mapStyleButtons: {
    position: "absolute",
    right: sidePadding,
    top: "62%",
    alignItems: "flex-end",
    gap: 10,
    zIndex: 2147483400,
    elevation: 150,
  },

  auraButton: {
    width: isSmallPhone ? 40 : 44,
    height: isSmallPhone ? 40 : 44,
    borderRadius: isSmallPhone ? 20 : 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(15, 7, 39, 0.92)",
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 8,
  },

  auraModalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "rgba(3, 2, 18, 0.78)",
  },

  auraModalCard: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "92%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.65)",
    backgroundColor: "rgba(6, 4, 26, 0.97)",
    padding: 16,
    shadowColor: "#a855f7",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },

  auraModalTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "#a855f7",
    textShadowRadius: 8,
  },

  auraOptionGrid: {
    marginTop: 14,
    gap: 8,
  },

  auraOptionCard: {
    minHeight: 44,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "rgba(10, 4, 32, 0.9)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  auraEmoji: {
    fontSize: 22,
  },

  auraName: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  footprintOptionImage: {
    width: 34,
    height: 34,
  },

  auraCloseButton: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(116, 234, 255, 0.4)",
    backgroundColor: "rgba(3, 2, 18, 0.82)",
  },

  auraCloseText: {
    color: "#74eaff",
    fontSize: 13,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.72,

    transform: [
      {
        scale: 0.97,
      },
    ],
  },

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

  tabBar: {
    minHeight: tabBarHeight,
    zIndex: 2147483500,

    maxHeight: tabBarHeight,

    borderRadius: 14,

    borderWidth: 1,

    borderColor: "#6d28d9",

    backgroundColor: "rgba(6, 4, 26, 0.95)",

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-around",

    paddingHorizontal: 4,

    paddingVertical: 4,

    elevation: 9,
  },

  tabButton: {
    flex: 1,

    height: tabBarHeight - 6,

    alignItems: "center",

    justifyContent: "center",

    gap: 4,
  },

  tabIconWrap: {
    width: isSmallPhone ? 38 : 44,

    height: isSmallPhone ? 38 : 44,

    borderRadius: 22,

    alignItems: "center",

    justifyContent: "center",
  },

  activeTabIconWrap: {
    borderWidth: 1,

    borderColor: "#00e5ff",

    backgroundColor: "rgba(86, 19, 216, 0.32)",
  },

  tabIcon: {
    width: isSmallPhone ? 61 : 56,

    height: isSmallPhone ? 61 : 56,
  },

  tabLabel: {
    color: "#ffffff",

    fontSize: isSmallPhone ? 9 : 10,

    fontWeight: "800",
  },

  activeTabLabel: {
    color: "#00e5ff",
  },
});

export default HomeBackupInterface;
