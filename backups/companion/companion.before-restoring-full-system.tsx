import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MissionBottomTabBar } from '@/components/mission-bottom-tab-bar';

// Purpose: Renders the main Companion Home screen.
export default function CompanionScreen() {
  const safeArea = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const compact = width < 760;

  return (
    <LinearGradient
      colors={['#020107', '#080011', '#030008']}
      style={[
        styles.screen,
        Platform.OS === 'web'
          ? ({ minHeight: '100vh' } as any)
          : undefined,
      ]}
    >
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: safeArea.top + 18,
            paddingBottom: safeArea.bottom + 130,
          },
        ]}
      >
        {/* TOP PROFILE CARD */}
        <View style={styles.profileRow}>
          <View style={styles.profileCard}>
            <View style={styles.profileCopy}>
              <Text style={styles.companionName}>
                YOUR COMPANION
              </Text>

              <Text style={styles.companionSubtitle}>
                Hatch your first egg to begin
              </Text>
            </View>

            <View style={styles.bondBox}>
              <Ionicons
                name="heart"
                size={27}
                color="#FF3AA6"
              />

              <Text style={styles.bondPercent}>--</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Companion menu"
            style={({ pressed }) => [
              styles.menuButton,
              pressed ? styles.buttonPressed : undefined,
            ]}
          >
            <Ionicons
              name="menu"
              size={31}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        {/* SPEECH BUBBLE */}
        <View
          style={[
            styles.speechBubble,
            compact ? styles.speechBubbleCompact : undefined,
          ]}
        >
          <Ionicons
            name="sparkles"
            size={20}
            color="#D948FF"
          />

          <Text style={styles.speechText}>
            Your companion will speak to you here...
          </Text>
        </View>

        {/* MAIN HERO AREA */}
        <View
          style={[
            styles.heroRow,
            compact ? styles.heroRowCompact : undefined,
          ]}
        >
          {/* COMPANION ORB */}
          <View
            style={[
              styles.orbColumn,
              compact ? styles.orbColumnCompact : undefined,
            ]}
          >
            <LinearGradient
              colors={[
                '#C83BFF',
                '#753BFF',
                '#10D9FF',
                '#FF35C8',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.orbBorder}
            >
              <View style={styles.orbInner}>
                <View style={styles.orbGlow}>
                  <Ionicons
                    name="egg-outline"
                    size={112}
                    color="#B58CC7"
                  />

                  <Text style={styles.orbTitle}>
                    NO COMPANION YET
                  </Text>

                  <Text style={styles.orbSubtitle}>
                    Hatch an egg to awaken one
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* XP + EVOLUTION */}
          <View
            style={[
              styles.sideColumn,
              compact ? styles.sideColumnCompact : undefined,
            ]}
          >
            <View style={styles.infoCard}>
              <Text style={styles.infoEyebrow}>
                XP & LEVEL
              </Text>

              <Text style={styles.infoMain}>
                Level --
              </Text>

              <Text style={styles.infoDetail}>
                0 / 100 XP
              </Text>

              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={['#9B2CFF', '#E738FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: '0%' }]}
                />
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoEyebrow}>
                EVOLUTION
              </Text>

              <Text style={styles.infoMain}>
                Locked
              </Text>

              <Text style={styles.evolutionPercent}>
                --%
              </Text>

              <Text style={styles.infoDetail}>
                to next evolution
              </Text>

              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={['#9B2CFF', '#E738FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: '0%' }]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* TODAY'S PROGRESS */}
        <View style={styles.todayCard}>
          <View style={styles.todayIconWrap}>
            <Ionicons
              name="footsteps"
              size={34}
              color="#C64DFF"
            />
          </View>

          <View style={styles.todayCopy}>
            <Text style={styles.infoEyebrow}>
              TODAY&apos;S PROGRESS
            </Text>

            <Text style={styles.todayDistance}>
              0.0 km
            </Text>

            <Text style={styles.todayDetail}>
              Walk together to earn XP!
            </Text>
          </View>

          <View style={styles.arrowButton}>
            <Ionicons
              name="chevron-forward"
              size={22}
              color="#FFFFFF"
            />
          </View>
        </View>

        {/* ACTION BUTTONS */}
        <View
          style={[
            styles.actionPanel,
            compact ? styles.actionPanelCompact : undefined,
          ]}
        >
          <CompanionActionButton
            icon="restaurant-outline"
            label="Feed"
            accent="#FF39D4"
            onPress={() => router.push('/companion-feed' as Href)}
          />

          <CompanionActionButton
            icon="hand-left-outline"
            label="Pet"
            accent="#F15AFF"
            onPress={() => router.push('/companion-pet' as Href)}
          />

          <CompanionActionButton
            icon="egg-outline"
            label="Evolve"
            accent="#25B9FF"
            onPress={() => router.push('/companion-evolve' as Href)}
          />

          <CompanionActionButton
            icon="game-controller-outline"
            label="Play"
            accent="#FFB51A"
            onPress={() => router.push('/companion-play' as Href)}
          />
        </View>

        <Text style={styles.helperText}>
          Companion actions will unlock after your first companion hatches.
        </Text>
      </ScrollView>

      <View
        style={[
          styles.bottomNavigation,
          { bottom: safeArea.bottom + 10 },
        ]}
      >
        <MissionBottomTabBar activeTab="companion" />
      </View>
    </LinearGradient>
  );
}

function CompanionActionButton({
  icon,
  label,
  accent,
  onPress,
}: {
  icon:
    | 'restaurant-outline'
    | 'hand-left-outline'
    | 'egg-outline'
    | 'game-controller-outline';
  label: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          borderColor: accent,
        },
        pressed ? styles.buttonPressed : undefined,
      ]}
    >
      <Ionicons
        name={icon}
        size={42}
        color={accent}
      />

      <Text style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    width: '100%',
    maxWidth: 940,
    alignSelf: 'center',
    paddingHorizontal: 20,
    gap: 18,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },

  profileCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#493352',
    backgroundColor: 'rgba(8, 5, 17, 0.96)',
    paddingHorizontal: 23,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  profileCopy: {
    flex: 1,
  },

  companionName: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  companionSubtitle: {
    color: '#00E5FF',
    fontSize: 13,
    marginTop: 8,
  },

  bondBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  bondPercent: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '600',
  },

  menuButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    borderColor: '#D43BFF',
    backgroundColor: 'rgba(18, 5, 28, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  speechBubble: {
    alignSelf: 'flex-start',
    marginLeft: 76,
    width: 360,
    minHeight: 82,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#D147FF',
    backgroundColor: 'rgba(31, 5, 48, 0.96)',
    paddingHorizontal: 22,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  speechBubbleCompact: {
    marginLeft: 0,
    width: '100%',
  },

  speechText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
  },

  heroRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },

  orbColumn: {
    width: '58%',
    alignItems: 'center',
  },

  orbColumnCompact: {
    width: '100%',
  },

  orbBorder: {
    width: '100%',
    maxWidth: 470,
    aspectRatio: 1,
    borderRadius: 999,
    padding: 3,
  },

  orbInner: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#05020B',
    padding: 8,
  },

  orbGlow: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(64, 217, 255, 0.55)',
    backgroundColor: 'rgba(8, 2, 15, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
  },

  orbTitle: {
    color: '#E4D8EA',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },

  orbSubtitle: {
    color: '#807389',
    fontSize: 12,
  },

  sideColumn: {
    flex: 1,
    gap: 16,
  },

  sideColumnCompact: {
    width: '100%',
    flexDirection: 'row',
  },

  infoCard: {
    flex: 1,
    minHeight: 150,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#35263F',
    backgroundColor: 'rgba(10, 7, 20, 0.96)',
    padding: 18,
  },

  infoEyebrow: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  infoMain: {
    color: '#FFFFFF',
    fontSize: 20,
    marginTop: 12,
  },

  infoDetail: {
    color: '#B1A4BA',
    fontSize: 12,
    marginTop: 8,
  },

  evolutionPercent: {
    color: '#FF32AC',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 7,
  },

  progressTrack: {
    height: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#30203B',
    backgroundColor: '#130D19',
    overflow: 'hidden',
    marginTop: 15,
  },

  progressFill: {
    height: '100%',
    borderRadius: 99,
  },

  todayCard: {
    width: '72%',
    alignSelf: 'center',
    minHeight: 110,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#33273C',
    backgroundColor: 'rgba(9, 6, 18, 0.96)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  todayIconWrap: {
    width: 64,
    alignItems: 'center',
  },

  todayCopy: {
    flex: 1,
  },

  todayDistance: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '800',
    marginTop: 4,
  },

  todayDetail: {
    color: '#9B8FA3',
    fontSize: 11,
    marginTop: 3,
  },

  arrowButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#685674',
    backgroundColor: '#191022',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionPanel: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#17101F',
    backgroundColor: 'rgba(8, 5, 14, 0.97)',
    padding: 16,
    flexDirection: 'row',
    gap: 15,
  },

  actionPanelCompact: {
    flexWrap: 'wrap',
  },

  actionButton: {
    flex: 1,
    minWidth: 120,
    minHeight: 145,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(18, 7, 29, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },

  actionLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },

  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },

  helperText: {
    color: '#807487',
    fontSize: 11,
    textAlign: 'center',
  },

  bottomNavigation: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
  },
});
