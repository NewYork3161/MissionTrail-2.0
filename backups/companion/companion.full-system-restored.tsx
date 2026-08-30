import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ComponentProps } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MissionBottomTabBar } from '@/components/mission-bottom-tab-bar';
import { getCompanionById } from '@/data/companions';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import {
  clampPercent,
  formatCompanionName,
  getEnergyPercent,
} from '@/utils/companion-progress';
import { getPlayerLevelProgress } from '@/utils/player-level';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type CompanionView =
  | 'home'
  | 'feed'
  | 'evolve'
  | 'play'
  | 'profile'
  | 'skins';

type FoodPreview = {
  id: string;
  name: string;
  category: string;
  source: ImageSourcePropType;
};

const companionImage = require('../../assets/images/tabIcons/companion.png');

const FOOD_PREVIEWS: FoodPreview[] = [
  {
    id: 'cosmic-berry',
    name: 'Cosmic Berry',
    category: 'Quick Energy',
    source: require('../../assets/images/companionfoodicons/fruitsquick-energy/cosmicberry.png'),
  },
  {
    id: 'moon-milk',
    name: 'Moon Milk',
    category: 'Recovery',
    source: require('../../assets/images/companionfoodicons/drinks-recovery/moonmilk.png'),
  },
  {
    id: 'star-biscuit',
    name: 'Star Biscuit',
    category: 'Happiness',
    source: require('../../assets/images/companionfoodicons/bakedtreatssweets-happines/starbiscuit.png'),
  },
  {
    id: 'meteor-burger',
    name: 'Meteor Burger',
    category: 'Full Meal',
    source: require('../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/meteorburger.png'),
  },
];

const PLAY_GAMES: {
  id: string;
  title: string;
  subtitle: string;
  icon: IoniconName;
}[] = [
  {
    id: 'stars',
    title: 'Chase Stars',
    subtitle: 'Speed challenge',
    icon: 'sparkles',
  },
  {
    id: 'meteor',
    title: 'Catch Meteor',
    subtitle: 'Reaction challenge',
    icon: 'planet-outline',
  },
  {
    id: 'memory',
    title: 'Memory Match',
    subtitle: 'Companion puzzle',
    icon: 'grid-outline',
  },
  {
    id: 'treasure',
    title: 'Treasure Hunt',
    subtitle: 'Search together',
    icon: 'map-outline',
  },
];

// Purpose: Renders the full Companion hub and its UI sections.
export default function CompanionScreen() {
  const safeArea = useSafeAreaInsets();

  const {
    progress,
    isLoading,
    message,
  } = useDailyProgress();

  const [view, setView] = useState<CompanionView>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [feedMessage, setFeedMessage] = useState<string | null>(null);
  const [petMessage, setPetMessage] = useState<string | null>(null);

  const petScale = useRef(new Animated.Value(1)).current;

  const companion = progress?.companion;

  const companionName =
    formatCompanionName(companion?.companionId) ??
    'Your Companion';

  const companionDefinition =
    companion?.companionId
      ? getCompanionById(companion.companionId)
      : undefined;

  const bondPercent =
    clampPercent(companion?.bondPercent ?? 0);

  const energyPercent =
    getEnergyPercent(
      companion?.energy ?? 0,
      companion?.maximumEnergy ?? 100,
    );

  const playerLevel =
    getPlayerLevelProgress(progress?.totalXp ?? 0);

  const todayDistanceKm =
    (progress?.verifiedDistanceMeters ?? 0) / 1000;

  const todaySteps =
    progress?.verifiedSteps ?? 0;

  function openView(nextView: CompanionView) {
    setMenuOpen(false);
    setView(nextView);
  }

  function returnHome() {
    setMenuOpen(false);
    setView('home');
  }

  function petCompanion() {
    setPetMessage('Your companion loved that 💜');

    Animated.sequence([
      Animated.spring(petScale, {
        toValue: 1.14,
        useNativeDriver: true,
        speed: 24,
        bounciness: 12,
      }),
      Animated.spring(petScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
    ]).start();

    setTimeout(() => {
      setPetMessage(null);
    }, 1800);
  }

  function previewFeed() {
    if (!selectedFoodId) {
      setFeedMessage('Choose a food first.');
      return;
    }

    const selectedFood =
      FOOD_PREVIEWS.find(
        (food) => food.id === selectedFoodId,
      );

    setFeedMessage(
      selectedFood
        ? `${selectedFood.name} selected. Inventory saving will be connected when we build the feeding backend.`
        : 'Food selected.',
    );
  }

  return (
    <LinearGradient
      colors={[
        '#030007',
        '#090012',
        '#160326',
        '#05000B',
      ]}
      style={styles.screen}
    >
      <StatusBar style="light" />

      <View
        pointerEvents="none"
        style={styles.backgroundGlowOne}
      />

      <View
        pointerEvents="none"
        style={styles.backgroundGlowTwo}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: safeArea.top + 14,
            paddingBottom: safeArea.bottom + 120,
          },
        ]}
      >
        {view === 'home' ? (
          <HomeView
            companionName={companionName}
            companionDefinition={companionDefinition}
            isLoading={isLoading}
            hasCompanion={Boolean(companion?.companionId)}
            bondPercent={bondPercent}
            bondTier={companion?.bondTier ?? 1}
            energyPercent={energyPercent}
            totalXp={playerLevel.totalXp}
            playerLevel={playerLevel.level}
            todayDistanceKm={todayDistanceKm}
            todaySteps={todaySteps}
            menuOpen={menuOpen}
            petScale={petScale}
            petMessage={petMessage}
            onToggleMenu={() => setMenuOpen((current) => !current)}
            onFeed={() => openView('feed')}
            onPet={petCompanion}
            onEvolve={() => openView('evolve')}
            onPlay={() => openView('play')}
            onProfile={() => openView('profile')}
            onSkins={() => openView('skins')}
          />
        ) : null}

        {view === 'feed' ? (
          <FeedView
            companionName={companionName}
            selectedFoodId={selectedFoodId}
            feedMessage={feedMessage}
            onBack={returnHome}
            onSelectFood={(foodId) => {
              setSelectedFoodId(foodId);
              setFeedMessage(null);
            }}
            onFeed={previewFeed}
          />
        ) : null}

        {view === 'evolve' ? (
          <EvolveView
            companionName={companionName}
            element={companionDefinition?.element ?? null}
            rarity={companionDefinition?.rarity ?? null}
            bondPercent={bondPercent}
            onBack={returnHome}
          />
        ) : null}

        {view === 'play' ? (
          <PlayView
            companionName={companionName}
            onBack={returnHome}
          />
        ) : null}

        {view === 'profile' ? (
          <ProfileView
            companionName={companionName}
            element={companionDefinition?.element ?? null}
            rarity={companionDefinition?.rarity ?? null}
            description={companionDefinition?.description ?? null}
            playerLevel={playerLevel.level}
            totalXp={playerLevel.totalXp}
            bondPercent={bondPercent}
            bondTier={companion?.bondTier ?? 1}
            energyPercent={energyPercent}
            todayDistanceKm={todayDistanceKm}
            todaySteps={todaySteps}
            onBack={returnHome}
          />
        ) : null}

        {view === 'skins' ? (
          <SkinsView
            companionName={companionName}
            onBack={returnHome}
          />
        ) : null}

        {message ? (
          <View style={styles.syncMessage}>
            <Ionicons
              name="information-circle-outline"
              size={17}
              color="#FFC96B"
            />
            <Text
              selectable
              style={styles.syncMessageText}
            >
              {message}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomNavigation,
          {
            bottom: safeArea.bottom + 10,
          },
        ]}
      >
        <MissionBottomTabBar activeTab="companion" />
      </View>
    </LinearGradient>
  );
}

function HomeView({
  companionName,
  companionDefinition,
  isLoading,
  hasCompanion,
  bondPercent,
  bondTier,
  energyPercent,
  totalXp,
  playerLevel,
  todayDistanceKm,
  todaySteps,
  menuOpen,
  petScale,
  petMessage,
  onToggleMenu,
  onFeed,
  onPet,
  onEvolve,
  onPlay,
  onProfile,
  onSkins,
}: {
  companionName: string;
  companionDefinition:
    | ReturnType<typeof getCompanionById>
    | undefined;
  isLoading: boolean;
  hasCompanion: boolean;
  bondPercent: number;
  bondTier: number;
  energyPercent: number;
  totalXp: number;
  playerLevel: number;
  todayDistanceKm: number;
  todaySteps: number;
  menuOpen: boolean;
  petScale: Animated.Value;
  petMessage: string | null;
  onToggleMenu: () => void;
  onFeed: () => void;
  onPet: () => void;
  onEvolve: () => void;
  onPlay: () => void;
  onProfile: () => void;
  onSkins: () => void;
}) {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>
            ACTIVE COMPANION
          </Text>

          <Text
            selectable
            style={styles.heroName}
          >
            {isLoading && !hasCompanion
              ? 'Loading…'
              : companionName}
          </Text>

          <Text
            selectable
            style={styles.heroSubtitle}
          >
            {hasCompanion
              ? `Level ${playerLevel} • ${companionDefinition?.rarity ?? 'Companion'} ${capitalize(companionDefinition?.element)}`
              : 'No companion selected yet'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open companion menu"
          onPress={onToggleMenu}
          style={styles.menuButton}
        >
          <Ionicons
            name={menuOpen ? 'close' : 'menu'}
            size={24}
            color="#FFFFFF"
          />
        </Pressable>
      </View>

      {menuOpen ? (
        <View style={styles.dropdownMenu}>
          <Pressable
            onPress={onProfile}
            style={styles.dropdownRow}
          >
            <Ionicons
              name="person-circle-outline"
              size={21}
              color="#58E9FF"
            />
            <Text style={styles.dropdownText}>
              Companion Profile
            </Text>
            <Ionicons
              name="chevron-forward"
              size={17}
              color="#776B83"
            />
          </Pressable>

          <View style={styles.dropdownDivider} />

          <Pressable
            onPress={onSkins}
            style={styles.dropdownRow}
          >
            <Ionicons
              name="color-palette-outline"
              size={21}
              color="#FF56DF"
            />
            <Text style={styles.dropdownText}>
              Skins
            </Text>
            <Ionicons
              name="chevron-forward"
              size={17}
              color="#776B83"
            />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.speechBubble}>
        <Ionicons
          name="sparkles"
          size={17}
          color="#FF65E5"
        />

        <Text style={styles.speechText}>
          Ready when you are. Let&apos;s explore together.
        </Text>
      </View>

      <View style={styles.companionStage}>
        <View style={styles.orbOuter}>
          <View style={styles.orbMiddle}>
            <Animated.View
              style={[
                styles.orbInner,
                {
                  transform: [
                    {
                      scale: petScale,
                    },
                  ],
                },
              ]}
            >
              <Image
                source={companionImage}
                resizeMode="contain"
                style={styles.companionHeroImage}
              />
            </Animated.View>
          </View>
        </View>

        {petMessage ? (
          <View style={styles.petMessage}>
            <Text style={styles.petMessageText}>
              {petMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.statusPills}>
          <View style={styles.statusPill}>
            <Ionicons
              name="heart"
              size={14}
              color="#FF4AD8"
            />
            <Text style={styles.statusPillValue}>
              {bondPercent}%
            </Text>
            <Text style={styles.statusPillLabel}>
              Bond
            </Text>
          </View>

          <View style={styles.statusPill}>
            <Ionicons
              name="flash"
              size={14}
              color="#46E6FF"
            />
            <Text style={styles.statusPillValue}>
              {energyPercent}%
            </Text>
            <Text style={styles.statusPillLabel}>
              Energy
            </Text>
          </View>

          <View style={styles.statusPill}>
            <Ionicons
              name="ribbon-outline"
              size={14}
              color="#D789FF"
            />
            <Text style={styles.statusPillValue}>
              {bondTier}
            </Text>
            <Text style={styles.statusPillLabel}>
              Bond Tier
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.twoColumnGrid}>
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Ionicons
              name="star-outline"
              size={18}
              color="#F4C95D"
            />
            <Text style={styles.infoEyebrow}>
              XP & LEVEL
            </Text>
          </View>

          <Text style={styles.infoMain}>
            Level {playerLevel}
          </Text>

          <Text style={styles.infoSub}>
            {totalXp.toLocaleString()} lifetime XP
          </Text>

          <View style={styles.thinTrack}>
            <View
              style={[
                styles.thinFill,
                {
                  width: `${Math.min(
                    100,
                    Math.max(8, (playerLevel % 10) * 10),
                  )}%`,
                  backgroundColor: '#F4C95D',
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Ionicons
              name="sparkles-outline"
              size={18}
              color="#C55CFF"
            />
            <Text style={styles.infoEyebrow}>
              EVOLUTION
            </Text>
          </View>

          <Text style={styles.infoMain}>
            {companionDefinition?.rarity ?? 'Unlinked'}
          </Text>

          <Text style={styles.infoSub}>
            Evolution rules coming next
          </Text>

          <View style={styles.thinTrack}>
            <View
              style={[
                styles.thinFill,
                {
                  width: '0%',
                  backgroundColor: '#C55CFF',
                },
              ]}
            />
          </View>
        </View>
      </View>

      <LinearGradient
        colors={[
          'rgba(75,20,105,0.92)',
          'rgba(15,31,65,0.94)',
        ]}
        style={styles.todayCard}
      >
        <View>
          <Text style={styles.todayEyebrow}>
            TODAY&apos;S PROGRESS
          </Text>

          <Text style={styles.todayDistance}>
            {todayDistanceKm.toFixed(2)} km
          </Text>

          <Text style={styles.todayMessage}>
            Walk together to earn verified progress.
          </Text>
        </View>

        <View style={styles.todaySteps}>
          <Ionicons
            name="footsteps"
            size={18}
            color="#61ECFF"
          />

          <Text style={styles.todayStepsValue}>
            {todaySteps.toLocaleString()}
          </Text>

          <Text style={styles.todayStepsLabel}>
            steps
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.actionGrid}>
        <ActionButton
          icon="restaurant-outline"
          label="Feed"
          accent="#62E7FF"
          onPress={onFeed}
        />

        <ActionButton
          icon="hand-left-outline"
          label="Pet"
          accent="#FF52CF"
          onPress={onPet}
        />

        <ActionButton
          icon="sparkles-outline"
          label="Evolve"
          accent="#B264FF"
          onPress={onEvolve}
        />

        <ActionButton
          icon="game-controller-outline"
          label="Play"
          accent="#FF8A45"
          onPress={onPlay}
        />
      </View>
    </>
  );
}

function FeedView({
  companionName,
  selectedFoodId,
  feedMessage,
  onBack,
  onSelectFood,
  onFeed,
}: {
  companionName: string;
  selectedFoodId: string | null;
  feedMessage: string | null;
  onBack: () => void;
  onSelectFood: (foodId: string) => void;
  onFeed: () => void;
}) {
  return (
    <>
      <SubHeader
        title={`Feed ${companionName}`}
        onBack={onBack}
      />

      <View style={styles.subHero}>
        <View style={styles.smallOrb}>
          <Image
            source={companionImage}
            resizeMode="contain"
            style={styles.subHeroImage}
          />
        </View>

        <Text style={styles.subHeroTitle}>
          Companion Food
        </Text>

        <Text style={styles.subHeroText}>
          Select food from your Mission Trails collection.
        </Text>
      </View>

      <View style={styles.noticeCard}>
        <Ionicons
          name="information-circle-outline"
          size={19}
          color="#62E7FF"
        />

        <Text style={styles.noticeText}>
          Hunger and food quantities are not stored in your
          backend yet, so this screen will not invent them.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        FOOD COLLECTION
      </Text>

      <View style={styles.foodGrid}>
        {FOOD_PREVIEWS.map((food) => {
          const selected =
            selectedFoodId === food.id;

          return (
            <Pressable
              key={food.id}
              onPress={() => onSelectFood(food.id)}
              style={[
                styles.foodCard,
                selected
                  ? styles.foodCardSelected
                  : undefined,
              ]}
            >
              <View style={styles.foodImageWrap}>
                <Image
                  source={food.source}
                  resizeMode="contain"
                  style={styles.foodImage}
                />
              </View>

              <Text
                numberOfLines={1}
                style={styles.foodName}
              >
                {food.name}
              </Text>

              <Text style={styles.foodCategory}>
                {food.category}
              </Text>

              {selected ? (
                <View style={styles.selectedBadge}>
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color="#05000B"
                  />
                  <Text style={styles.selectedBadgeText}>
                    SELECTED
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onFeed}
        style={styles.primaryButton}
      >
        <Ionicons
          name="restaurant"
          size={18}
          color="#FFFFFF"
        />
        <Text style={styles.primaryButtonText}>
          FEED
        </Text>
      </Pressable>

      {feedMessage ? (
        <Text style={styles.helperMessage}>
          {feedMessage}
        </Text>
      ) : null}
    </>
  );
}

function EvolveView({
  companionName,
  element,
  rarity,
  bondPercent,
  onBack,
}: {
  companionName: string;
  element: string | null;
  rarity: string | null;
  bondPercent: number;
  onBack: () => void;
}) {
  return (
    <>
      <SubHeader
        title={`Evolve ${companionName}`}
        onBack={onBack}
      />

      <View style={styles.evolutionStage}>
        <Text style={styles.evolutionLabel}>
          CURRENT FORM
        </Text>

        <View style={styles.evolutionOrb}>
          <Image
            source={companionImage}
            resizeMode="contain"
            style={styles.evolutionImage}
          />
        </View>

        <Text style={styles.evolutionName}>
          {companionName}
        </Text>

        <Text style={styles.evolutionMeta}>
          {rarity ?? 'Unknown rarity'}
          {' • '}
          {capitalize(element)}
        </Text>

        <View style={styles.evolutionConnector}>
          <View style={styles.connectorDot} />
          <View style={styles.connectorLine} />
          <Ionicons
            name="chevron-down"
            size={24}
            color="#C65CFF"
          />
        </View>

        <Text style={styles.evolutionLabel}>
          NEXT FORM
        </Text>

        <View style={styles.lockedEvolutionOrb}>
          <Ionicons
            name="lock-closed"
            size={34}
            color="#8E779C"
          />
        </View>

        <Text style={styles.lockedEvolutionText}>
          Evolution path not configured
        </Text>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            Current Bond
          </Text>
          <Text style={styles.progressValue}>
            {bondPercent}%
          </Text>
        </View>

        <Meter
          value={bondPercent}
          color="#C65CFF"
        />

        <Text style={styles.progressDescription}>
          Bond is real companion progress. We will create
          separate evolution requirements instead of pretending
          Bond automatically equals evolution progress.
        </Text>
      </View>

      <Pressable
        onPress={() =>
          Alert.alert(
            'Evolution System',
            'The evolution UI is ready. Next we can define each companion evolution tree and unlock requirements.',
          )
        }
        style={styles.primaryButton}
      >
        <Ionicons
          name="sparkles"
          size={18}
          color="#FFFFFF"
        />
        <Text style={styles.primaryButtonText}>
          VIEW EVOLUTION SYSTEM
        </Text>
      </Pressable>
    </>
  );
}

function PlayView({
  companionName,
  onBack,
}: {
  companionName: string;
  onBack: () => void;
}) {
  return (
    <>
      <SubHeader
        title="Play Together"
        onBack={onBack}
      />

      <View style={styles.subHero}>
        <View style={styles.smallOrb}>
          <Image
            source={companionImage}
            resizeMode="contain"
            style={styles.subHeroImage}
          />
        </View>

        <Text style={styles.subHeroTitle}>
          Play with {companionName}
        </Text>

        <Text style={styles.subHeroText}>
          Pick an activity for your next companion mini-game.
        </Text>
      </View>

      <View style={styles.gameGrid}>
        {PLAY_GAMES.map((game) => (
          <Pressable
            key={game.id}
            onPress={() =>
              Alert.alert(
                game.title,
                `${game.title} is ready as a UI entry. We'll build the actual mini-game logic separately.`,
              )
            }
            style={styles.gameCard}
          >
            <View style={styles.gameIcon}>
              <Ionicons
                name={game.icon}
                size={31}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.gameTitle}>
              {game.title}
            </Text>

            <Text style={styles.gameSubtitle}>
              {game.subtitle}
            </Text>

            <View style={styles.gamePlayBadge}>
              <Ionicons
                name="play"
                size={11}
                color="#05000B"
              />
              <Text style={styles.gamePlayText}>
                PLAY
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function ProfileView({
  companionName,
  element,
  rarity,
  description,
  playerLevel,
  totalXp,
  bondPercent,
  bondTier,
  energyPercent,
  todayDistanceKm,
  todaySteps,
  onBack,
}: {
  companionName: string;
  element: string | null;
  rarity: string | null;
  description: string | null;
  playerLevel: number;
  totalXp: number;
  bondPercent: number;
  bondTier: number;
  energyPercent: number;
  todayDistanceKm: number;
  todaySteps: number;
  onBack: () => void;
}) {
  return (
    <>
      <SubHeader
        title="Companion Profile"
        onBack={onBack}
      />

      <View style={styles.profileHero}>
        <View style={styles.profileOrb}>
          <Image
            source={companionImage}
            resizeMode="contain"
            style={styles.profileImage}
          />
        </View>

        <Text style={styles.profileName}>
          {companionName}
        </Text>

        <Text style={styles.profileMeta}>
          {rarity ?? 'Companion'}
          {' • '}
          {capitalize(element)}
        </Text>

        {description ? (
          <Text style={styles.profileDescription}>
            {description}
          </Text>
        ) : null}
      </View>

      <View style={styles.profileStats}>
        <ProfileStat
          icon="star-outline"
          label="Explorer Level"
          value={String(playerLevel)}
          color="#F5CA61"
        />

        <ProfileStat
          icon="diamond-outline"
          label="Lifetime XP"
          value={totalXp.toLocaleString()}
          color="#C869FF"
        />

        <ProfileStat
          icon="heart"
          label="Bond"
          value={`${bondPercent}%`}
          color="#FF52CF"
        />

        <ProfileStat
          icon="ribbon-outline"
          label="Bond Tier"
          value={String(bondTier)}
          color="#B66BFF"
        />

        <ProfileStat
          icon="flash"
          label="Energy"
          value={`${energyPercent}%`}
          color="#53E8FF"
        />

        <ProfileStat
          icon="walk-outline"
          label="Today"
          value={`${todayDistanceKm.toFixed(2)} km`}
          color="#72F2C3"
        />

        <ProfileStat
          icon="footsteps"
          label="Steps Today"
          value={todaySteps.toLocaleString()}
          color="#FF9A58"
        />
      </View>
    </>
  );
}

function SkinsView({
  companionName,
  onBack,
}: {
  companionName: string;
  onBack: () => void;
}) {
  return (
    <>
      <SubHeader
        title="Companion Skins"
        onBack={onBack}
      />

      <Text style={styles.sectionDescription}>
        You currently only have one Companion visual asset, so
        Mission Trails will use that as the Default skin until
        you add real skin artwork.
      </Text>

      <View style={styles.skinGrid}>
        <View style={[styles.skinCard, styles.skinCardActive]}>
          <View style={styles.skinImageWrap}>
            <Image
              source={companionImage}
              resizeMode="contain"
              style={styles.skinImage}
            />
          </View>

          <Text style={styles.skinName}>
            Default
          </Text>

          <Text
            numberOfLines={1}
            style={styles.skinCompanionName}
          >
            {companionName}
          </Text>

          <View style={styles.equippedBadge}>
            <Ionicons
              name="checkmark"
              size={12}
              color="#05000B"
            />
            <Text style={styles.equippedText}>
              EQUIPPED
            </Text>
          </View>
        </View>

        {['Skin Slot 2', 'Skin Slot 3', 'Skin Slot 4', 'Skin Slot 5', 'Skin Slot 6'].map(
          (skin) => (
            <View
              key={skin}
              style={styles.skinCard}
            >
              <View style={styles.lockedSkinIcon}>
                <Ionicons
                  name="lock-closed"
                  size={25}
                  color="#776D7D"
                />
              </View>

              <Text style={styles.skinName}>
                {skin}
              </Text>

              <Text style={styles.skinLockedText}>
                No artwork yet
              </Text>
            </View>
          ),
        )}
      </View>
    </>
  );
}

function SubHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.subHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Companion home"
        onPress={onBack}
        style={styles.backButton}
      >
        <Ionicons
          name="chevron-back"
          size={23}
          color="#FFFFFF"
        />
      </Pressable>

      <Text
        numberOfLines={1}
        style={styles.subHeaderTitle}
      >
        {title}
      </Text>

      <View style={styles.headerSpacer} />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  accent,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.actionButton}
    >
      <View
        style={[
          styles.actionIcon,
          {
            borderColor: accent,
            shadowColor: accent,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={27}
          color={accent}
        />
      </View>

      <Text style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProfileStat({
  icon,
  label,
  value,
  color,
}: {
  icon: IoniconName;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.profileStat}>
      <Ionicons
        name={icon}
        size={21}
        color={color}
      />

      <View style={styles.profileStatCopy}>
        <Text style={styles.profileStatLabel}>
          {label}
        </Text>

        <Text style={styles.profileStatValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Meter({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const safeValue =
    Math.min(100, Math.max(0, value));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: safeValue,
      }}
      style={styles.meterTrack}
    >
      <View
        style={[
          styles.meterFill,
          {
            width: `${safeValue}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

function capitalize(
  value: string | null | undefined,
) {
  if (!value) return 'Unknown';

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030007',
  },

  backgroundGlowOne: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(127, 25, 213, 0.13)',
    top: 80,
    left: -130,
  },

  backgroundGlowTwo: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    top: 330,
    right: -150,
  },

  content: {
    paddingHorizontal: 15,
    gap: 14,
  },

  bottomNavigation: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerCopy: {
    flex: 1,
  },

  eyebrow: {
    color: '#FF56DE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  heroName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 3,
  },

  heroSubtitle: {
    color: '#AFA3BB',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },

  menuButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6B257D',
    backgroundColor: 'rgba(17, 4, 27, 0.94)',
  },

  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#67287C',
    backgroundColor: 'rgba(12, 3, 22, 0.98)',
    borderRadius: 17,
    overflow: 'hidden',
  },

  dropdownRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 11,
  },

  dropdownText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#31203A',
    marginHorizontal: 14,
  },

  speechBubble: {
    alignSelf: 'center',
    maxWidth: 290,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#67267D',
    backgroundColor: 'rgba(24, 5, 36, 0.9)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  speechText: {
    flexShrink: 1,
    color: '#E7DDEA',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },

  companionStage: {
    alignItems: 'center',
    paddingTop: 5,
    paddingBottom: 2,
  },

  orbOuter: {
    width: 235,
    height: 235,
    borderRadius: 118,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 74, 255, 0.22)',
    backgroundColor: 'rgba(103, 26, 151, 0.07)',
  },

  orbMiddle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(81, 223, 255, 0.38)',
    backgroundColor: 'rgba(12, 8, 34, 0.65)',
    shadowColor: '#9D3CFF',
    shadowOpacity: 0.65,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },

  orbInner: {
    width: 164,
    height: 164,
    borderRadius: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#BE4CFF',
    backgroundColor: 'rgba(28, 4, 47, 0.94)',
    shadowColor: '#49E9FF',
    shadowOpacity: 0.65,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },

  companionHeroImage: {
    width: 128,
    height: 128,
  },

  petMessage: {
    marginTop: -12,
    borderWidth: 1,
    borderColor: '#FF4ED8',
    backgroundColor: '#200928',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  petMessageText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  statusPills: {
    marginTop: 17,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#462151',
    backgroundColor: 'rgba(16, 5, 25, 0.92)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 5,
  },

  statusPillValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  statusPillLabel: {
    color: '#817689',
    fontSize: 9,
    fontWeight: '800',
  },

  twoColumnGrid: {
    flexDirection: 'row',
    gap: 10,
  },

  infoCard: {
    flex: 1,
    minHeight: 126,
    borderWidth: 1,
    borderColor: '#40204D',
    backgroundColor: 'rgba(11, 4, 20, 0.92)',
    borderRadius: 18,
    padding: 13,
  },

  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  infoEyebrow: {
    color: '#B8ACBF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  infoMain: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 13,
  },

  infoSub: {
    color: '#8F8497',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 3,
    minHeight: 25,
  },

  thinTrack: {
    marginTop: 9,
    height: 5,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: '#27172E',
  },

  thinFill: {
    height: '100%',
    borderRadius: 99,
  },

  todayCard: {
    minHeight: 108,
    borderWidth: 1,
    borderColor: '#542670',
    borderRadius: 19,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  todayEyebrow: {
    color: '#EEBDFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },

  todayDistance: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 3,
  },

  todayMessage: {
    color: '#B6A9C0',
    fontSize: 9,
    marginTop: 3,
    maxWidth: 205,
  },

  todaySteps: {
    marginLeft: 'auto',
    alignItems: 'center',
    minWidth: 74,
  },

  todayStepsValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },

  todayStepsLabel: {
    color: '#7DADBA',
    fontSize: 9,
    fontWeight: '800',
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  actionButton: {
    width: '48.5%',
    minHeight: 94,
    borderWidth: 1,
    borderColor: '#43204D',
    backgroundColor: 'rgba(11, 4, 19, 0.93)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#110719',
    shadowOpacity: 0.45,
    shadowRadius: 11,
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },

  actionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  syncMessage: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5E4728',
    backgroundColor: 'rgba(45, 30, 9, 0.75)',
    padding: 12,
  },

  syncMessageText: {
    flex: 1,
    color: '#F0DBB4',
    fontSize: 10,
    lineHeight: 15,
  },

  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 45,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#51215F',
    backgroundColor: '#100519',
    alignItems: 'center',
    justifyContent: 'center',
  },

  subHeaderTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  headerSpacer: {
    width: 42,
  },

  subHero: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4C205B',
    backgroundColor: 'rgba(12, 3, 22, 0.88)',
    borderRadius: 22,
    padding: 20,
  },

  smallOrb: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#A847D3',
    backgroundColor: '#160622',
    shadowColor: '#7735FF',
    shadowOpacity: 0.5,
    shadowRadius: 17,
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },

  subHeroImage: {
    width: 96,
    height: 96,
  },

  subHeroTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 13,
  },

  subHeroText: {
    color: '#9F94A7',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 4,
  },

  noticeCard: {
    flexDirection: 'row',
    gap: 9,
    borderWidth: 1,
    borderColor: '#235065',
    backgroundColor: 'rgba(3, 31, 44, 0.72)',
    borderRadius: 15,
    padding: 12,
  },

  noticeText: {
    flex: 1,
    color: '#C4E8EF',
    fontSize: 10,
    lineHeight: 15,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 4,
  },

  sectionDescription: {
    color: '#ACA0B3',
    fontSize: 11,
    lineHeight: 17,
  },

  foodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  foodCard: {
    width: '48.5%',
    minHeight: 172,
    borderWidth: 1,
    borderColor: '#452050',
    backgroundColor: 'rgba(11, 4, 20, 0.9)',
    borderRadius: 18,
    padding: 11,
    alignItems: 'center',
  },

  foodCardSelected: {
    borderColor: '#5BE9FF',
    backgroundColor: 'rgba(12, 43, 52, 0.85)',
  },

  foodImageWrap: {
    height: 91,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  foodImage: {
    width: 84,
    height: 84,
  },

  foodName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
  },

  foodCategory: {
    color: '#93879B',
    fontSize: 8,
    marginTop: 2,
  },

  selectedBadge: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#5BE9FF',
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  selectedBadgeText: {
    color: '#05000B',
    fontSize: 7,
    fontWeight: '900',
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: '#7B24D6',
    borderWidth: 1,
    borderColor: '#C75DFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  helperMessage: {
    color: '#BEB1C5',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },

  evolutionStage: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A1F59',
    backgroundColor: 'rgba(11, 3, 20, 0.9)',
    borderRadius: 22,
    padding: 20,
  },

  evolutionLabel: {
    color: '#8E8198',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  evolutionOrb: {
    width: 135,
    height: 135,
    borderRadius: 68,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#B34FE9',
    backgroundColor: '#160622',
    alignItems: 'center',
    justifyContent: 'center',
  },

  evolutionImage: {
    width: 100,
    height: 100,
  },

  evolutionName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 10,
  },

  evolutionMeta: {
    color: '#B58FC9',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },

  evolutionConnector: {
    height: 70,
    alignItems: 'center',
    marginVertical: 5,
  },

  connectorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C65CFF',
    marginTop: 8,
  },

  connectorLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#603274',
  },

  lockedEvolutionOrb: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginTop: 11,
    borderWidth: 1,
    borderColor: '#3B2B42',
    borderStyle: 'dashed',
    backgroundColor: '#0E0911',
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockedEvolutionText: {
    color: '#817587',
    fontSize: 10,
    marginTop: 10,
  },

  progressCard: {
    borderWidth: 1,
    borderColor: '#4A245A',
    backgroundColor: 'rgba(13, 4, 23, 0.9)',
    borderRadius: 18,
    padding: 15,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  progressTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  progressValue: {
    color: '#D871FF',
    fontSize: 12,
    fontWeight: '900',
  },

  progressDescription: {
    color: '#93869B',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 10,
  },

  meterTrack: {
    height: 8,
    backgroundColor: '#281631',
    borderRadius: 99,
    overflow: 'hidden',
    marginTop: 10,
  },

  meterFill: {
    height: '100%',
    borderRadius: 99,
  },

  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  gameCard: {
    width: '48.5%',
    minHeight: 155,
    borderWidth: 1,
    borderColor: '#4B2357',
    backgroundColor: 'rgba(12, 4, 21, 0.92)',
    borderRadius: 19,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  gameIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#4B1476',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C74DFF',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },

  gameTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 11,
  },

  gameSubtitle: {
    color: '#887E8F',
    fontSize: 8,
    marginTop: 2,
  },

  gamePlayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#61E9FF',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 9,
  },

  gamePlayText: {
    color: '#05000B',
    fontSize: 7,
    fontWeight: '900',
  },

  profileHero: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#51215F',
    backgroundColor: 'rgba(12, 3, 22, 0.9)',
    borderRadius: 22,
    padding: 20,
  },

  profileOrb: {
    width: 145,
    height: 145,
    borderRadius: 73,
    borderWidth: 2,
    borderColor: '#9F43D0',
    backgroundColor: '#14051F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileImage: {
    width: 110,
    height: 110,
  },

  profileName: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 12,
  },

  profileMeta: {
    color: '#60E6FF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },

  profileDescription: {
    color: '#A79CAC',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 11,
  },

  profileStats: {
    gap: 8,
  },

  profileStat: {
    minHeight: 59,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#3D1C47',
    backgroundColor: 'rgba(10, 4, 18, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 14,
  },

  profileStatCopy: {
    flex: 1,
  },

  profileStatLabel: {
    color: '#8C818F',
    fontSize: 9,
    fontWeight: '800',
  },

  profileStatValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },

  skinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  skinCard: {
    width: '48.5%',
    minHeight: 170,
    borderWidth: 1,
    borderColor: '#3C263F',
    backgroundColor: 'rgba(10, 6, 14, 0.9)',
    borderRadius: 18,
    padding: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  skinCardActive: {
    borderColor: '#5BE9FF',
    backgroundColor: 'rgba(8, 30, 39, 0.88)',
  },

  skinImageWrap: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: '#160622',
    borderWidth: 1,
    borderColor: '#A144C9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  skinImage: {
    width: 73,
    height: 73,
  },

  skinName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 8,
  },

  skinCompanionName: {
    color: '#93879A',
    fontSize: 8,
    marginTop: 2,
  },

  equippedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#5BE9FF',
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginTop: 7,
  },

  equippedText: {
    color: '#05000B',
    fontSize: 7,
    fontWeight: '900',
  },

  lockedSkinIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: '#332936',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  skinLockedText: {
    color: '#665D69',
    fontSize: 8,
    marginTop: 3,
  },
});
