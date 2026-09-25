import React, { useEffect, useRef, useState } from "react";

import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import { useAudioPlayer } from "expo-audio";


// ============================================================
// COMPANION CARD CAPTURE
// ============================================================
//
// Demo capture sequence:
//
// 1. Screen opens.
// 2. Card spins into view.
// 3. Card grows toward the player.
// 4. Card stops facing forward.
// 5. Bright flash fires.
// 6. Congratulations message appears.
// 7. Screen returns to /home-backup.
//
// For the demo we always use:
// assets/images/blue_emerald_dragon.png
//
// ============================================================


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");


// ============================================================
// TIMING
// ============================================================

const CARD_SPIN_DURATION = 1500;
const CARD_EXPAND_DURATION = 650;
const FLASH_DURATION = 450;
const MESSAGE_DELAY = 250;
const RETURN_DELAY = 3000;


// ============================================================
// CAPTURE AUDIO
// ============================================================

const CAPTURE_AUDIO_SOURCE =
  require("../../assets/audio/relics/new_companion.mp3");


// ============================================================
// SCREEN
// ============================================================

export default function CompanionCardCapture() {
  const params = useLocalSearchParams<{
    companionName?: string;
  }>();


  const companionName =
    typeof params.companionName === "string" &&
    params.companionName.trim()
      ? params.companionName
      : "Crystal Drake";


  // expo-audio manages the player's lifecycle automatically.
  const captureAudioPlayer =
    useAudioPlayer(
      CAPTURE_AUDIO_SOURCE,
      {
        downloadFirst: true,
      }
    );


  // ==========================================================
  // ANIMATION VALUES
  // ==========================================================

  const entranceProgress =
    useRef(new Animated.Value(0)).current;

  const expansionProgress =
    useRef(new Animated.Value(0)).current;

  const flashOpacity =
    useRef(new Animated.Value(0)).current;

  const messageOpacity =
    useRef(new Animated.Value(0)).current;

  const messageScale =
    useRef(new Animated.Value(0.7)).current;


  const [captureComplete, setCaptureComplete] =
    useState(false);


  // ==========================================================
  // RETURN TO MAP
  // ==========================================================

  const returnToMap = () => {
    router.replace("/home-backup");
  };


  // ==========================================================
  // CAPTURE ANIMATION
  // ==========================================================

  useEffect(() => {
    let returnTimer:
      ReturnType<typeof setTimeout> | null = null;


    // Reset everything.
    entranceProgress.setValue(0);
    expansionProgress.setValue(0);
    flashOpacity.setValue(0);
    messageOpacity.setValue(0);
    messageScale.setValue(0.7);


    // --------------------------------------------------------
    // CAPTURE SOUND
    // Play the new Companion sound as the card enters.
    // --------------------------------------------------------

    captureAudioPlayer.volume = 1;

    void captureAudioPlayer
      .seekTo(0)
      .then(() => {
        captureAudioPlayer.play();
      })
      .catch((error) => {
        console.warn(
          "[COMPANION CAPTURE] Unable to play capture sound:",
          error
        );
      });


    // --------------------------------------------------------
    // STAGE 1
    // Spin the card into the center of the screen.
    // --------------------------------------------------------

    Animated.timing(
      entranceProgress,
      {
        toValue: 1,
        duration: CARD_SPIN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }
    ).start(() => {


      // ------------------------------------------------------
      // STAGE 2
      // Push / expand the card toward the player.
      // ------------------------------------------------------

      Animated.timing(
        expansionProgress,
        {
          toValue: 1,
          duration: CARD_EXPAND_DURATION,
          easing: Easing.out(Easing.back(1.15)),
          useNativeDriver: true,
        }
      ).start(() => {


        // ----------------------------------------------------
        // STAGE 3
        // FLASH
        // ----------------------------------------------------

        Animated.sequence([
          Animated.timing(
            flashOpacity,
            {
              toValue: 1,
              duration: 90,
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            flashOpacity,
            {
              toValue: 0,
              duration: FLASH_DURATION,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }
          ),
        ]).start();


        // ----------------------------------------------------
        // STAGE 4
        // CONGRATULATIONS
        // ----------------------------------------------------

        setTimeout(() => {
          setCaptureComplete(true);

          Animated.parallel([
            Animated.timing(
              messageOpacity,
              {
                toValue: 1,
                duration: 450,
                useNativeDriver: true,
              }
            ),

            Animated.spring(
              messageScale,
              {
                toValue: 1,
                friction: 5,
                tension: 80,
                useNativeDriver: true,
              }
            ),
          ]).start();

        }, MESSAGE_DELAY);


        // ----------------------------------------------------
        // STAGE 5
        // RETURN TO HOME BACKUP
        // ----------------------------------------------------

        returnTimer = setTimeout(
          returnToMap,
          RETURN_DELAY
        );
      });
    });


    return () => {
      if (returnTimer) {
        clearTimeout(returnTimer);
      }

      entranceProgress.stopAnimation();
      expansionProgress.stopAnimation();
      flashOpacity.stopAnimation();
      messageOpacity.stopAnimation();
      messageScale.stopAnimation();

      captureAudioPlayer.pause();
    };
  }, []);


  // ==========================================================
  // CARD TRANSFORMS
  // ==========================================================

  // Start slightly below the center and rise into place.
  const translateY =
    entranceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [
        Math.min(SCREEN_HEIGHT * 0.3, 260),
        0,
      ],
    });


  // Multiple full rotations.
  const rotateY =
    entranceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [
        "0deg",
        "1080deg",
      ],
    });


  // Start tiny, become normal-sized.
  const entranceScale =
    entranceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0.15,
        0.72,
      ],
    });


  // Then expand toward the screen.
  const expansionScale =
    expansionProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [
        1,
        1.32,
      ],
    });


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <View style={styles.container}>

      {/* Background */}
      <View style={styles.background} />


      {/* Capture heading */}
      <Animated.View
        style={[
          styles.captureHeading,
          {
            opacity:
              entranceProgress,
          },
        ]}
      >
        <Text style={styles.captureHeadingText}>
          COMPANION CAPTURE
        </Text>
      </Animated.View>


      {/* Card */}
      <View style={styles.cardStage}>
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              transform: [
                {
                  perspective: 1200,
                },

                {
                  translateY,
                },

                {
                  rotateY,
                },

                {
                  scale:
                    Animated.multiply(
                      entranceScale,
                      expansionScale
                    ),
                },
              ],
            },
          ]}
        >
          <Image
               source={require("../../assets/images/blue_emerald_dragon.png")}
               style={styles.cardImage}
                 resizeMode="contain"
/>
        </Animated.View>
      </View>


      {/* Congratulations */}
      {captureComplete && (
        <Animated.View
          style={[
            styles.congratulationsContainer,
            {
              opacity:
                messageOpacity,

              transform: [
                {
                  scale:
                    messageScale,
                },
              ],
            },
          ]}
        >
          <Text style={styles.congratulationsTitle}>
            CONGRATULATIONS!
          </Text>

          <Text style={styles.congratulationsText}>
            YOU CAPTURED
          </Text>

          <Text style={styles.companionName}>
            {companionName.toUpperCase()}
          </Text>
        </Animated.View>
      )}


      {/* Skip / Continue */}
      <Pressable
        style={styles.continueButton}
        onPress={returnToMap}
      >
        <Text style={styles.continueButtonText}>
          CONTINUE
        </Text>
      </Pressable>


      {/* White flash - keep this LAST */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flash,
          {
            opacity:
              flashOpacity,
          },
        ]}
      />

    </View>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,

    backgroundColor:
      "#05000D",

    alignItems:
      "center",

    justifyContent:
      "center",

    overflow:
      "hidden",
  },


  background: {
    ...StyleSheet.absoluteFillObject,

    backgroundColor:
      "#080014",
  },


  captureHeading: {
    position:
      "absolute",

    top:
      Platform.OS === "web"
        ? 35
        : 65,

    zIndex:
      10,

    paddingHorizontal:
      26,

    paddingVertical:
      10,

    borderRadius:
      18,

    borderWidth:
      1,

    borderColor:
      "#FF01E2",

    backgroundColor:
      "rgba(10, 0, 24, 0.88)",
  },


  captureHeadingText: {
    color:
      "#FFFFFF",

    fontSize:
      20,

    fontWeight:
      "900",

    letterSpacing:
      3,

    textAlign:
      "center",
  },


  cardStage: {
    flex: 1,

    width:
      "100%",

    alignItems:
      "center",

    justifyContent:
      "center",
  },


  cardWrapper: {
    width:
      Math.min(
        SCREEN_WIDTH * 0.44,
        520
      ),

    aspectRatio:
      1024 / 1536,

    alignItems:
      "center",

    justifyContent:
      "center",
  },


  cardImage: {
    width:
      "100%",

    height:
      "100%",
  },


  congratulationsContainer: {
    position:
      "absolute",

    bottom:
      Platform.OS === "web"
        ? 90
        : 125,

    alignItems:
      "center",

    justifyContent:
      "center",

    paddingHorizontal:
      30,

    paddingVertical:
      16,

    borderRadius:
      20,

    backgroundColor:
      "rgba(5, 0, 15, 0.92)",

    borderWidth:
      2,

    borderColor:
      "#FF01E2",

    zIndex:
      30,
  },


  congratulationsTitle: {
    color:
      "#FFFFFF",

    fontSize:
      30,

    fontWeight:
      "900",

    letterSpacing:
      2,

    textAlign:
      "center",
  },


  congratulationsText: {
    marginTop:
      5,

    color:
      "#D78BFF",

    fontSize:
      16,

    fontWeight:
      "700",

    letterSpacing:
      3,

    textAlign:
      "center",
  },


  companionName: {
    marginTop:
      5,

    color:
      "#FF55EE",

    fontSize:
      26,

    fontWeight:
      "900",

    letterSpacing:
      2,

    textAlign:
      "center",
  },


  continueButton: {
    position:
      "absolute",

    right:
      25,

    bottom:
      25,

    zIndex:
      40,

    paddingHorizontal:
      22,

    paddingVertical:
      12,

    borderRadius:
      18,

    borderWidth:
      1,

    borderColor:
      "#FF01E2",

    backgroundColor:
      "rgba(14, 0, 30, 0.92)",
  },


  continueButtonText: {
    color:
      "#FFFFFF",

    fontSize:
      13,

    fontWeight:
      "900",

    letterSpacing:
      2,
  },


  flash: {
    ...StyleSheet.absoluteFillObject,

    backgroundColor:
      "#FFFFFF",

    zIndex:
      100,
  },

});