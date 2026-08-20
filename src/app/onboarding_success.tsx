// ======================================================
// MISSIONTRAIL
// ONBOARDING SUCCESS
// ======================================================
//
// FILE:
//
// src/app/onboarding_success.tsx
//
// PURPOSE:
//
// Displayed after the user's Photo ID has been
// successfully verified.
//
// FLOW:
//
// onboarding_check_id
//        ↓
// onboarding_success
//        ↓
// login
//
// ======================================================

import React from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { router } from 'expo-router';


// ======================================================
// SCREEN
// ======================================================

export default function OnboardingSuccess() {


  // ==================================================== 
  // CONTINUE TO LOGIN
  // ====================================================

  const continueOnboarding = () => {

    console.log(
      '[ONBOARDING SUCCESS] Identity verification complete. Going to login.'
    );

    router.replace(
      '/login'
    );
  };


  // ====================================================
  // SCREEN
  // ====================================================

  return (

    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >

      <View style={styles.card}>


        {/* ==============================================
            SUCCESS ICON
        ============================================== */}

        <View style={styles.iconOuter}>

          <View style={styles.iconInner}>

            <Ionicons
              name="shield-checkmark-outline"
              size={72}
              color="#63D8FF"
            />

          </View>

        </View>


        {/* ==============================================
            TITLE
        ============================================== */}

        <Text style={styles.title}>
          Identity Verified
        </Text>


        {/* ==============================================
            SUBTITLE
        ============================================== */}

        <Text style={styles.subtitle}>
          Your ID has been successfully verified.
        </Text>


        {/* ==============================================
            INFORMATION BOX
        ============================================== */}

        <View style={styles.successBox}>

          <View style={styles.successHeader}>

            <Ionicons
              name="checkmark-circle"
              size={27}
              color="#63D8FF"
            />

            <Text style={styles.successTitle}>
              Verification Complete
            </Text>

          </View>


          <Text style={styles.successText}>
            The information on your Photo ID has been
            successfully checked against the information
            you provided during onboarding.
          </Text>

        </View>


        {/* ==============================================
            SECURITY MESSAGE
        ============================================== */}

        <View style={styles.securityRow}>

          <Ionicons
            name="lock-closed-outline"
            size={18}
            color="#B8A7FF"
          />

          <Text style={styles.securityText}>
            Your identity verification is complete.
            You can now continue to the MissionTrail
            login page.
          </Text>

        </View>


        {/* ==============================================
            CONTINUE BUTTON
        ============================================== */}

        <TouchableOpacity
          style={styles.continueButton}
          onPress={continueOnboarding}
          activeOpacity={0.8}
        >

          <Text style={styles.continueButtonText}>
            CONTINUE
          </Text>

          <Ionicons
            name="arrow-forward"
            size={22}
            color="#FFFFFF"
          />

        </TouchableOpacity>


        {/* ==============================================
            BOTTOM MESSAGE
        ============================================== */}

        <Text style={styles.bottomText}>
          Identity verification complete. Continue to sign in.
        </Text>


      </View>

    </ScrollView>
  );
}


// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({


  // ====================================================
  // PAGE
  // ====================================================

  container: {

    flex: 1,

    backgroundColor:
      '#05010B',
  },


  content: {

    flexGrow: 1,

    justifyContent:
      'center',

    alignItems:
      'center',

    paddingHorizontal: 24,

    paddingVertical: 60,
  },


  // ====================================================
  // MAIN CARD
  // ====================================================

  card: {

    width: '100%',

    maxWidth: 610,

    alignItems:
      'center',

    backgroundColor:
      '#0D0716',

    borderWidth: 1,

    borderColor:
      '#7B42F6',

    borderRadius: 28,

    paddingHorizontal: 32,

    paddingVertical: 48,

    shadowColor:
      '#7B42F6',

    shadowOpacity: 0.22,

    shadowRadius: 30,

    elevation: 12,
  },


  // ====================================================
  // SUCCESS ICON
  // ====================================================

  iconOuter: {

    width: 140,

    height: 140,

    borderRadius: 70,

    justifyContent:
      'center',

    alignItems:
      'center',

    backgroundColor:
      'rgba(123, 66, 246, 0.12)',

    borderWidth: 1,

    borderColor:
      '#7B42F6',

    marginBottom: 28,
  },


  iconInner: {

    width: 110,

    height: 110,

    borderRadius: 55,

    justifyContent:
      'center',

    alignItems:
      'center',

    backgroundColor:
      '#181028',

    borderWidth: 1,

    borderColor:
      '#63D8FF',

    shadowColor:
      '#63D8FF',

    shadowOpacity: 0.35,

    shadowRadius: 20,

    elevation: 8,
  },


  // ====================================================
  // TEXT
  // ====================================================

  title: {

    color:
      '#FFFFFF',

    fontSize: 34,

    fontWeight:
      'bold',

    textAlign:
      'center',

    marginBottom: 12,
  },


  subtitle: {

    color:
      '#B8A7FF',

    fontSize: 18,

    lineHeight: 27,

    textAlign:
      'center',

    marginBottom: 34,
  },


  // ====================================================
  // SUCCESS INFORMATION
  // ====================================================

  successBox: {

    width:
      '100%',

    backgroundColor:
      '#181028',

    borderWidth: 1,

    borderColor:
      '#7B42F6',

    borderRadius: 20,

    paddingHorizontal: 22,

    paddingVertical: 22,

    marginBottom: 28,
  },


  successHeader: {

    flexDirection:
      'row',

    alignItems:
      'center',

    marginBottom: 13,
  },


  successTitle: {

    color:
      '#FFFFFF',

    fontSize: 18,

    fontWeight:
      '700',

    marginLeft: 10,
  },


  successText: {

    color:
      '#D8CCFF',

    fontSize: 15,

    lineHeight: 23,
  },


  // ====================================================
  // SECURITY MESSAGE
  // ====================================================

  securityRow: {

    width:
      '100%',

    flexDirection:
      'row',

    alignItems:
      'flex-start',

    marginBottom: 32,

    paddingHorizontal: 6,
  },


  securityText: {

    flex: 1,

    color:
      '#A999D6',

    fontSize: 14,

    lineHeight: 21,

    marginLeft: 10,
  },


  // ====================================================
  // CONTINUE BUTTON
  // ====================================================

  continueButton: {

    width:
      '100%',

    height: 70,

    borderRadius: 20,

    backgroundColor:
      '#7B42F6',

    flexDirection:
      'row',

    justifyContent:
      'center',

    alignItems:
      'center',

    shadowColor:
      '#7B42F6',

    shadowOpacity: 0.6,

    shadowRadius: 18,

    elevation: 12,
  },


  continueButtonText: {

    color:
      '#FFFFFF',

    fontSize: 18,

    fontWeight:
      'bold',

    letterSpacing: 1,

    marginRight: 10,
  },


  // ====================================================
  // BOTTOM TEXT
  // ====================================================

  bottomText: {

    color:
      '#8878B5',

    fontSize: 13,

    textAlign:
      'center',

    marginTop: 22,
  },

});