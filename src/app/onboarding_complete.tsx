// src/app/onboarding_complete.tsx

import React from "react";

import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";


// ============================================================
// ONBOARDING COMPLETE
// ============================================================

export default function OnboardingComplete() {

  // ==========================================================
  // RETURN TO LOGIN
  // ==========================================================

  const handleReturnToLogin = () => {
    /*
      replace() is intentional.

      Once onboarding has been completed, we do not want
      the user pressing Back and returning to the completed
      onboarding process.
    */

    router.replace("/login");
  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <SafeAreaView style={styles.safeArea}>

      <View style={styles.container}>

        {/* ====================================================
            BACKGROUND DECORATION
        ==================================================== */}

        <View style={styles.glowLarge} />

        <View style={styles.glowSmall} />


        {/* ====================================================
            BRAND
        ==================================================== */}

        <View style={styles.brandContainer}>

          <Text style={styles.brandText}>
            MISSION TRAIL
          </Text>

          <Text style={styles.brandSubText}>
            ADVENTURE AWAITS
          </Text>

        </View>


        {/* ====================================================
            SUCCESS ICON
        ==================================================== */}

        <View style={styles.successOuterCircle}>

          <View style={styles.successMiddleCircle}>

            <View style={styles.successInnerCircle}>

              <Ionicons
                name="checkmark"
                size={58}
                color="#FFFFFF"
              />

            </View>

          </View>

        </View>


        {/* ====================================================
            WELCOME MESSAGE
        ==================================================== */}

        <Text style={styles.title}>
          Welcome to Mission Trail!
        </Text>

        <Text style={styles.subtitle}>
          Your account setup is complete.
        </Text>


        {/* ====================================================
            COMPLETE CARD
        ==================================================== */}

        <View style={styles.completeCard}>

          <View style={styles.cardIconContainer}>

            <Ionicons
              name="compass-outline"
              size={31}
              color="#65D5FF"
            />

          </View>


          <View style={styles.cardTextContainer}>

            <Text style={styles.cardTitle}>
              Your adventure starts here
            </Text>

            <Text style={styles.cardText}>
              You've completed the Mission Trail
              signup process. Your profile is ready,
              and you can now return to the login
              page and sign in to begin exploring.
            </Text>

          </View>

        </View>


        {/* ====================================================
            ACCOUNT STATUS
        ==================================================== */}

        <View style={styles.statusContainer}>

          <View style={styles.statusIconContainer}>

            <Ionicons
              name="shield-checkmark-outline"
              size={23}
              color="#65D5FF"
            />

          </View>

          <View style={styles.statusTextContainer}>

            <Text style={styles.statusTitle}>
              Signup Complete
            </Text>

            <Text style={styles.statusText}>
              Your Mission Trail account setup
              has been completed.
            </Text>

          </View>

        </View>


        {/* ====================================================
            BACK TO LOGIN
        ==================================================== */}

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleReturnToLogin}
          activeOpacity={0.85}
        >

          <Text style={styles.loginButtonText}>
            BACK TO LOGIN
          </Text>

          <Ionicons
            name="arrow-forward"
            size={22}
            color="#FFFFFF"
          />

        </TouchableOpacity>


        {/* ====================================================
            FOOTER
        ==================================================== */}

        <Text style={styles.footerText}>
          Chart your journey. Explore your world.
        </Text>

      </View>

    </SafeAreaView>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  // ==========================================================
  // PAGE
  // ==========================================================

  safeArea: {
    flex: 1,
    backgroundColor: "#03020A",
  },


  container: {
    flex: 1,

    width: "100%",
    maxWidth: 620,

    alignSelf: "center",

    justifyContent: "center",
    alignItems: "center",

    paddingHorizontal: 26,
    paddingVertical: 45,

    overflow: "hidden",
  },


  // ==========================================================
  // BACKGROUND GLOW
  // ==========================================================

  glowLarge: {
    position: "absolute",

    width: 430,
    height: 430,

    borderRadius: 215,

    backgroundColor: "#24104A",

    opacity: 0.22,

    top: "12%",
  },


  glowSmall: {
    position: "absolute",

    width: 260,
    height: 260,

    borderRadius: 130,

    backgroundColor: "#35136E",

    opacity: 0.17,

    bottom: "7%",
  },


  // ==========================================================
  // BRAND
  // ==========================================================

  brandContainer: {
    alignItems: "center",
    marginBottom: 38,
  },


  brandText: {
    color: "#65D5FF",

    fontSize: 15,
    fontWeight: "900",

    letterSpacing: 3,
  },


  brandSubText: {
    color: "#806CA5",

    fontSize: 10,
    fontWeight: "700",

    letterSpacing: 2.2,

    marginTop: 5,
  },


  // ==========================================================
  // SUCCESS ICON
  // ==========================================================

  successOuterCircle: {
    width: 138,
    height: 138,

    borderRadius: 69,

    borderWidth: 1,
    borderColor: "#65D5FF",

    backgroundColor: "#0E0A1A",

    justifyContent: "center",
    alignItems: "center",

    marginBottom: 32,

    shadowColor: "#713DFF",

    shadowOffset: {
      width: 0,
      height: 0,
    },

    shadowOpacity: 0.55,
    shadowRadius: 25,

    elevation: 12,
  },


  successMiddleCircle: {
    width: 108,
    height: 108,

    borderRadius: 54,

    backgroundColor: "#1D1237",

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,
    borderColor: "#56309B",
  },


  successInnerCircle: {
    width: 76,
    height: 76,

    borderRadius: 38,

    backgroundColor: "#6436D9",

    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#7D4DFF",

    shadowOffset: {
      width: 0,
      height: 0,
    },

    shadowOpacity: 0.8,
    shadowRadius: 16,

    elevation: 10,
  },


  // ==========================================================
  // TITLE
  // ==========================================================

  title: {
    color: "#FFFFFF",

    fontSize: 31,
    fontWeight: "900",

    textAlign: "center",

    marginBottom: 10,
  },


  subtitle: {
    color: "#B39AD8",

    fontSize: 16,

    textAlign: "center",

    marginBottom: 30,
  },


  // ==========================================================
  // COMPLETE CARD
  // ==========================================================

  completeCard: {
    width: "100%",

    flexDirection: "row",

    backgroundColor: "#120B1F",

    borderWidth: 1,
    borderColor: "#3D2857",

    borderRadius: 18,

    padding: 20,

    marginBottom: 18,
  },


  cardIconContainer: {
    width: 54,
    height: 54,

    borderRadius: 27,

    backgroundColor: "#171126",

    borderWidth: 1,
    borderColor: "#31516A",

    justifyContent: "center",
    alignItems: "center",

    marginRight: 16,
  },


  cardTextContainer: {
    flex: 1,
  },


  cardTitle: {
    color: "#FFFFFF",

    fontSize: 17,
    fontWeight: "800",

    marginBottom: 7,
  },


  cardText: {
    color: "#AAA0BB",

    fontSize: 13,
    lineHeight: 20,
  },


  // ==========================================================
  // STATUS
  // ==========================================================

  statusContainer: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#0C1220",

    borderWidth: 1,
    borderColor: "#20364B",

    borderRadius: 15,

    padding: 16,

    marginBottom: 24,
  },


  statusIconContainer: {
    width: 43,
    height: 43,

    borderRadius: 22,

    backgroundColor: "#111A29",

    justifyContent: "center",
    alignItems: "center",

    marginRight: 13,
  },


  statusTextContainer: {
    flex: 1,
  },


  statusTitle: {
    color: "#FFFFFF",

    fontSize: 14,
    fontWeight: "800",

    marginBottom: 3,
  },


  statusText: {
    color: "#8F849F",

    fontSize: 12,
    lineHeight: 17,
  },


  // ==========================================================
  // LOGIN BUTTON
  // ==========================================================

  loginButton: {
    width: "100%",

    height: 66,

    borderRadius: 15,

    backgroundColor: "#4A2694",

    flexDirection: "row",

    justifyContent: "center",
    alignItems: "center",

    gap: 10,

    shadowColor: "#6E3DFF",

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.35,
    shadowRadius: 15,

    elevation: 8,
  },


  loginButtonText: {
    color: "#FFFFFF",

    fontSize: 16,
    fontWeight: "900",

    letterSpacing: 0.6,
  },


  // ==========================================================
  // FOOTER
  // ==========================================================

  footerText: {
    color: "#685B79",

    fontSize: 12,

    textAlign: "center",

    marginTop: 20,

    letterSpacing: 0.4,
  },

});