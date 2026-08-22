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

import {
  router,
  useLocalSearchParams,
} from 'expo-router';


// ======================================================
// SCREEN
// ======================================================

// Purpose:
// Shows the correct completion message after ID verification
// or Kids Mode selection, then carries onboarding data into Signup.
export default function OnboardingSuccess() {

  // ====================================================
  // RECEIVE ONBOARDING ACCESS INFORMATION
  // ====================================================

  const params = useLocalSearchParams<{
    firstName?: string;
    lastName?: string;
    displayName?: string;
    birthday?: string;
    city?: string;
    state?: string;
    country?: string;
    accountAccessMode?: string;
    idVerificationStatus?: string;
  }>();


  // Purpose:
  // Determines whether this onboarding session is Kids Mode.
  // Any non-kids path is treated as verified because this screen
  // is reached only after ID success or the explicit Kids button.
  const isKidsMode =
    params.accountAccessMode === 'kids';


  // ====================================================
  // CONTINUE TO ACCOUNT CREATION
  // ====================================================

  // Purpose:
  // Sends the onboarding information and access mode into Signup
  // so Supabase Auth metadata can create the correct account record.
  const continueOnboarding = () => {

    console.log(
      isKidsMode
        ? '[ONBOARDING SUCCESS] Kids Mode selected. Opening Signup.'
        : '[ONBOARDING SUCCESS] Identity verified. Opening Signup.'
    );


    router.replace({
      pathname:
        '/Signup',

      params: {
        firstName:
          params.firstName ?? '',

        lastName:
          params.lastName ?? '',

        displayName:
          params.displayName ?? '',

        birthday:
          params.birthday ?? '',

        city:
          params.city ?? '',

        state:
          params.state ?? '',

        country:
          params.country ?? '',

        accountAccessMode:
          isKidsMode
            ? 'kids'
            : 'verified',

        idVerificationStatus:
          isKidsMode
            ? 'skipped_kids'
            : 'verified',
      },
    });
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
            ACCESS ICON
        ============================================== */}

        <View style={styles.iconOuter}>

          <View style={styles.iconInner}>

            <Ionicons
              name={
                isKidsMode
                  ? 'happy-outline'
                  : 'shield-checkmark-outline'
              }
              size={72}
              color="#63D8FF"
            />

          </View>

        </View>


        {/* ==============================================
            TITLE
        ============================================== */}

        <Text style={styles.title}>

          {isKidsMode
            ? 'Kids Mode'
            : 'Identity Verified'}

        </Text>


        {/* ==============================================
            SUBTITLE
        ============================================== */}

        <Text style={styles.subtitle}>

          {isKidsMode
            ? 'You can continue without ID verification.'
            : 'Your ID has been successfully verified.'}

        </Text>


        {/* ==============================================
            INFORMATION BOX
        ============================================== */}

        <View style={styles.successBox}>

          <View style={styles.successHeader}>

            <Ionicons
              name={
                isKidsMode
                  ? 'lock-closed'
                  : 'checkmark-circle'
              }
              size={27}
              color="#63D8FF"
            />

            <Text style={styles.successTitle}>

              {isKidsMode
                ? 'Kids Mode Restrictions'
                : 'Verification Complete'}

            </Text>

          </View>


          <Text style={styles.successText}>

            {isKidsMode
              ? 'Kids Mode can use Mission Trails features that do not require identity verification. Trails and Meetups will remain locked.'
              : 'The information on your Photo ID has been successfully checked against the information you provided during onboarding.'}

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

            {isKidsMode
              ? 'Your account will remember Kids Mode after account creation. Trails and Meetups will stay unavailable.'
              : 'Your verified account will be eligible for Trails and Meetups after account creation.'}

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
            CREATE ACCOUNT
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

          {isKidsMode
            ? 'Continue to create your Kids Mode account.'
            : 'Continue to create your verified account.'}

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
