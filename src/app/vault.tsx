import { useAccountAccess } from "@/hooks/use-account-access";
import { supabase } from "../../lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Companion = {
  id: string;
  companion_key: string;
  name: string;
  description: string | null;
  rarity: string | null;
  model_path: string | null;
  thumbnail_path: string | null;
  base_health: number | null;
  base_energy: number | null;
};

type UserCompanion = {
  companion_id: string;
  level: number;
  xp: number;
  bond: number;
  energy: number;
  hunger: number;
  happiness: number;
  health: number;
  discovered_at: string;
};

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

const bottomTabs = [
  { key: "home", label: "Home", image: tabImages.home, route: "/home-backup" },
  { key: "mission", label: "Mission", image: tabImages.mission, route: "/mission" },
  { key: "trails", label: "Trails", image: tabImages.trails, route: "/trails" },
  { key: "vault", label: "Vault", image: tabImages.vault, route: "/vault" },
  { key: "profile", label: "Profile", image: tabImages.profile, route: "/profile" },
  { key: "companion", label: "Compan...", image: tabImages.companion, route: "/companion" },
] as const;

function getRarityColor(rarity?: string | null) {
  switch ((rarity ?? "").toLowerCase()) {
    case "legendary": return "#ffd700";
    case "epic": return "#f000ff";
    case "rare": return "#00d9ff";
    case "uncommon": return "#22c55e";
    default: return "#b9a3c9";
  }
}

function getStorageUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from("companion-models").getPublicUrl(path).data.publicUrl;
}

export default function VaultScreen() {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();
  const { access, loading: accessLoading } = useAccountAccess();
  const canUseTrails = access?.canUseTrails === true;

  const [companions, setCompanions] = useState<Companion[]>([]);
  const [owned, setOwned] = useState<UserCompanion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openBottomTab = (tab: (typeof bottomTabs)[number]) => {
    if (tab.key === "trails") {
      if (accessLoading) {
        Alert.alert("Checking Access", "Mission Trails is checking your trail access.");
        return;
      }
      if (!canUseTrails) {
        Alert.alert(
          "Trails Locked",
          "Trails and Meetups require ID verification. Kids Mode can continue using the rest of Mission Trails.",
        );
        return;
      }
    }
    router.push(tab.route);
  };

  const loadCompanionVault = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        setCompanions([]);
        setOwned([]);
        setLoadError("Sign in to view your Companion collection.");
        return;
      }

      const [catalogResult, ownedResult] = await Promise.all([
        supabase
          .from("companions")
          .select("id, companion_key, name, description, rarity, model_path, thumbnail_path, base_health, base_energy")
          .order("name", { ascending: true }),
        supabase
          .from("user_companions")
          .select("companion_id, level, xp, bond, energy, hunger, happiness, health, discovered_at")
          .eq("user_id", user.id)
          .order("discovered_at", { ascending: false }),
      ]);

      if (catalogResult.error) throw catalogResult.error;
      if (ownedResult.error) throw ownedResult.error;

      setCompanions((catalogResult.data ?? []) as Companion[]);
      setOwned((ownedResult.data ?? []) as UserCompanion[]);
    } catch (error) {
      console.error("Could not load Companion Vault:", error);
      setLoadError("Could not load your Companion collection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCompanionVault();
    }, [loadCompanionVault]),
  );

  const ownedByCompanionId = useMemo(
    () => new Map(owned.map((entry) => [entry.companion_id, entry])),
    [owned],
  );

  const rarityCount = useCallback(
    (rarity: string) =>
      companions.filter(
        (companion) =>
          companion.rarity?.toLowerCase() === rarity.toLowerCase() &&
          ownedByCompanionId.has(companion.id),
      ).length,
    [companions, ownedByCompanionId],
  );

  const openCompanion = (companion: Companion) => {
    const ownership = ownedByCompanionId.get(companion.id);
    if (!ownership) return;

    router.push({
      pathname: "/companion",
      params: { companionId: companion.id },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: safeArea.bottom + tabBarHeight + 40 },
        ]}
      >
        <Image
          source={require("../../assets/images/tabIcons/vault.png")}
          style={styles.vaultIcon}
        />

        <View style={styles.statsBox}>
          <Text style={styles.statTitle}>LEGENDARY VAULT</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{rarityCount("Legendary")}</Text>
              <Text style={styles.statText}>Legendary</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{owned.length}/{companions.length}</Text>
              <Text style={styles.statText}>Companions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: "#f000ff" }]}>{rarityCount("Epic")}</Text>
              <Text style={styles.statText}>Epic</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: "#00d9ff" }]}>{rarityCount("Rare")}</Text>
              <Text style={styles.statText}>Rare</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading Companion Vault...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.loadingBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadCompanionVault()}>
              <Text style={styles.retryButtonText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : companions.length === 0 ? (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>No Companions have been added to the catalog yet.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {companions.map((item) => {
              const ownership = ownedByCompanionId.get(item.id);
              const isCollected = Boolean(ownership);
              const displayColor = isCollected ? getRarityColor(item.rarity) : "#4b345f";
              const thumbnailUrl = isCollected ? getStorageUrl(item.thumbnail_path) : null;

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={isCollected ? `View ${item.name}` : "Undiscovered Companion"}
                  disabled={!isCollected}
                  onPress={() => openCompanion(item)}
                  style={[
                    styles.card,
                    {
                      borderColor: displayColor,
                      backgroundColor: isCollected
                        ? "rgba(237,16,149,0.15)"
                        : "rgba(80,45,70,0.25)",
                    },
                  ]}
                >
                  <View style={[styles.iconBox, { borderColor: displayColor }]}>
                    <Image
                      source={thumbnailUrl ? { uri: thumbnailUrl } : tabImages.companion}
                      style={[styles.itemIcon, !isCollected && styles.lockedIcon]}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={[styles.cardTitle, { color: displayColor }]}>
                    {isCollected ? item.name : "Undiscovered"}
                  </Text>
                  <Text style={styles.cardRarity}>
                    {isCollected ? item.rarity ?? "Companion" : "Unknown"}
                  </Text>
                  {isCollected && ownership ? (
                    <Text style={styles.levelText}>Level {ownership.level}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.rankBox}>
          <View>
            <Text style={styles.rankTitle}>Companion Collection</Text>
            <Text style={styles.rankText}>{owned.length} discovered</Text>
          </View>
          <View>
            <Text style={styles.rankNumber}>{companions.length}</Text>
            <Text style={styles.rankText}>Available</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomOverlay, { bottom: safeArea.bottom + 10 }]}>
        <View style={styles.tabBar}>
          {bottomTabs.map((tab) => {
            const isActiveTab = tab.key === "vault";
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${tab.label}`}
                style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
                onPress={() => openBottomTab(tab)}
              >
                <View style={[styles.tabIconWrap, isActiveTab && styles.activeTabIconWrap]}>
                  <Image source={tab.image} style={styles.tabIcon} resizeMode="contain" />
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: "#070011",

  },



  scroll: {

    padding: 24,

    paddingTop: 55,

    paddingBottom: 40,

  },



  vaultIcon: {

    width: 84,

    height: 84,

    resizeMode: "contain",

    alignSelf: "center",

    marginTop: -10,

    marginBottom: 8,

  },



  statsBox: {

    borderWidth: 1,

    borderColor: "#4b345f",

    borderRadius: 28,

    backgroundColor: "rgba(255,255,255,0.05)",

    marginBottom: 20,

    padding: 18,

  },



  statTitle: {

    color: "#f000ff",

    fontSize: 30,

    fontWeight: "bold",

    textAlign: "center",

    marginBottom: 10,

    letterSpacing: 2,

  },



  statsRow: {

    flexDirection: "row",

    justifyContent: "space-around",

  },



  statItem: {

    alignItems: "center",

    flex: 1,

  },



  statNumber: {

    color: "#ffd700",

    fontSize: 18,

    fontWeight: "bold",

  },



  statText: {

    color: "#aaa",

    fontSize: 13,

    marginTop: 6,

  },



  grid: {

    flexDirection: "row",

    flexWrap: "wrap",

    justifyContent: "space-between",

  },



  card: {

    width: "48%",

    height: 210,

    borderRadius: 24,

    borderWidth: 1.5,

    marginBottom: 18,

    alignItems: "center",

    justifyContent: "center",

    padding: 16,

  },



  iconBox: {

    width: 60,

    height: 60,

    borderRadius: 18,

    borderWidth: 1.5,

    alignItems: "center",

    justifyContent: "center",

    marginBottom: 16,

  },



  icon: {

    fontSize: 28,

    textAlign: "center",

  },



  cardTitle: {

    fontSize: 16,

    textAlign: "center",

    fontWeight: "bold",

    marginBottom: 8,

  },



  cardRarity: {

    color: "#aaa",

    fontSize: 13,

    textAlign: "center",

  },



  rankBox: {

    padding: 22,

    borderRadius: 24,

    borderWidth: 1,

    borderColor: "#4b345f",

    backgroundColor: "rgba(255,255,255,0.05)",

    marginTop: 70,

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

  },

  itemIcon: {

    width: 52,

    height: 52,

    resizeMode: "contain",

  },



  rankTitle: {

    color: "#fff",

    fontSize: 16,

    marginBottom: 6,

  },



  rankNumber: {

    color: "#ffd700",

    fontSize: 24,

    textAlign: "right",

  },



  rankText: {

    color: "#aaa",

    fontSize: 13,

  },



  bottomOverlay: {

    position: "absolute",

    left: sidePadding,

    right: sidePadding,

  },



  tabBar: {

    minHeight: tabBarHeight,

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

    shadowColor: "#a855f7",

    shadowOpacity: 0.45,

    shadowRadius: 10,

    elevation: 9,

  },



  tabButton: {

    flex: 1,

    minWidth: 0,

    height: tabBarHeight - 6,

    alignItems: "center",

    justifyContent: "center",

    gap: 4,

  },



  tabIconWrap: {

    width: isSmallPhone ? 38 : 44,

    height: isSmallPhone ? 38 : 44,

    borderRadius: isSmallPhone ? 19 : 22,

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



  pressed: {

    opacity: 0.72,

    transform: [{ scale: 0.97 }],

  },



  loadingBox: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },

  loadingText: {
    color: "#cbb8d8",
    fontSize: 15,
    textAlign: "center",
  },

  errorText: {
    color: "#ff8fa3",
    fontSize: 15,
    textAlign: "center",
  },

  retryButton: {
    borderWidth: 1,
    borderColor: "#00e5ff",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  retryButtonText: {
    color: "#00e5ff",
    fontWeight: "900",
  },

  lockedIcon: {
    opacity: 0.28,
  },

  levelText: {
    color: "#d8c9e6",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "700",
  },

});
