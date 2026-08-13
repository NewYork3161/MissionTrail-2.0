// ======================================================
// ONBOARDING USER INFO
// ======================================================
//
// FILE:
//
// src/app/onboarding_user_info.tsx
//
// PURPOSE:
//
// 1. Collect onboarding information.
// 2. Save onboarding information to Supabase.
// 3. Open Photo ID verification.
// 4. Pass identity information to Check ID.
// 5. Continue to questionnaire.
//
// ======================================================

import React, { useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { router } from 'expo-router';

import { supabase } from '../../lib/supabase';


// ======================================================
// SCREEN
// ======================================================

export default function OnboardingUserInfo() {

  // ====================================================
  // FORM STATE
  // ====================================================

  const [firstName, setFirstName] =
    useState('');

  const [lastName, setLastName] =
    useState('');

  const [displayName, setDisplayName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [birthday, setBirthday] =
    useState('');

  const [city, setCity] =
    useState('');

  const [state, setState] =
    useState('');

  const [country, setCountry] =
    useState('');


  // ====================================================
  // LOADING STATE
  // ====================================================

  const [saving, setSaving] =
    useState(false);

  const [
    openingIdVerification,
    setOpeningIdVerification,
  ] = useState(false);


  // ====================================================
  // SHOW MESSAGE
  // ====================================================
  //
  // Alert.alert can be unreliable / easy to miss when
  // testing React Native through Expo Web.
  //
  // On web we use window.alert().
  // On Android/iOS we use React Native Alert.
  //
  // ====================================================

  const showMessage = (
    title: string,
    message: string
  ) => {

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined'
    ) {
      window.alert(
        `${title}\n\n${message}`
      );

      return;
    }

    Alert.alert(
      title,
      message
    );
  };


  // ====================================================
  // VALIDATE ID INFORMATION
  // ====================================================

  const validateIdentityInformation =
    (): boolean => {

      if (!firstName.trim()) {

        showMessage(
          'First Name Required',
          'Please enter your first name before verifying your ID.'
        );

        return false;
      }


      if (!lastName.trim()) {

        showMessage(
          'Last Name Required',
          'Please enter your last name before verifying your ID.'
        );

        return false;
      }


      if (!birthday.trim()) {

        showMessage(
          'Birthday Required',
          'Please enter your date of birth before verifying your ID.'
        );

        return false;
      }


      return true;
    };


  // ====================================================
  // GET CURRENT USER
  // ====================================================

  const getCurrentUser =
    async () => {

      const {
        data: { user },
        error,
      } =
        await supabase.auth.getUser();


      if (error) {
        throw error;
      }


      if (!user) {

        throw new Error(
          'SIGNED_OUT'
        );
      }


      return user;
    };


  // ====================================================
  // SAVE ONBOARDING INFORMATION
  // ====================================================

  const saveOnboardingInformation =
    async () => {

      const user =
        await getCurrentUser();


      const {
        error: onboardingError,
      } =
        await supabase
          .from('user_onboarding')
          .upsert(
            {
              user_id:
                user.id,

              first_name:
                firstName.trim(),

              last_name:
                lastName.trim(),

              display_name:
                displayName.trim() || null,

              email:
                email.trim() || null,

              phone:
                phone.trim() || null,

              birthday:
                birthday.trim() || null,

              city:
                city.trim() || null,

              state:
                state.trim() || null,

              country:
                country.trim() || null,

              profile_complete:
                false,

              onboarding_complete:
                false,

              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                'user_id',
            }
          );


      if (onboardingError) {
        throw onboardingError;
      }


      return user;
    };


  // ====================================================
  // OPEN PHOTO ID VERIFICATION
  // ====================================================
  //
  // IMPORTANT:
  //
  // This button should OPEN the ID screen.
  //
  // It should NOT depend on a Supabase database write
  // completing before navigation.
  //
  // The Check ID screen contains:
  //
  //   - Upload ID Image
  //   - Take Photo
  //
  // ====================================================

  const openCheckId =
    () => {

      console.log(
        '[ONBOARDING] Verify Photo ID pressed.'
      );


      // --------------------------------------------------
      // PREVENT DOUBLE TAP
      // --------------------------------------------------

      if (
        openingIdVerification ||
        saving
      ) {

        console.log(
          '[ONBOARDING] Button ignored because screen is busy.'
        );

        return;
      }


      // --------------------------------------------------
      // VALIDATE REQUIRED INFORMATION
      // --------------------------------------------------

      if (
        !validateIdentityInformation()
      ) {

        console.log(
          '[ONBOARDING] ID validation failed.'
        );

        return;
      }


      // --------------------------------------------------
      // OPEN CHECK ID SCREEN
      // --------------------------------------------------

      try {

        setOpeningIdVerification(
          true
        );


        console.log(
          '[ONBOARDING] Opening onboarding_check_id...'
        );


        router.push({
          pathname:
            '/onboarding_check_id',

          params: {

            firstName:
              firstName.trim(),

            lastName:
              lastName.trim(),

            displayName:
              displayName.trim(),

            birthday:
              birthday.trim(),

            city:
              city.trim(),

            state:
              state.trim(),

            country:
              country.trim(),
          },
        });


        console.log(
          '[ONBOARDING] Navigation command sent.'
        );

      } catch (error) {

        console.error(
          '[ONBOARDING] Unable to open ID verification:',
          error
        );


        setOpeningIdVerification(
          false
        );


        showMessage(
          'Unable to Open ID Verification',
          'The ID verification screen could not be opened.'
        );
      }
    };


  // ====================================================
  // SAVE AND CONTINUE
  // ====================================================

  const saveAndContinue =
    async () => {

      if (
        saving ||
        openingIdVerification
      ) {
        return;
      }


      try {

        setSaving(true);


        // ------------------------------------------------
        // SAVE USER INFORMATION
        // ------------------------------------------------

        await saveOnboardingInformation();


        // ------------------------------------------------
        // CONTINUE TO QUESTIONNAIRE
        // ------------------------------------------------

        router.push(
          '/onboarding_questionnaire'
        );


      } catch (error: any) {

        console.error(
          'Error saving onboarding information:',
          error
        );


        if (
          error?.message ===
          'SIGNED_OUT'
        ) {

          showMessage(
            'Not Signed In',
            'We could not find your account. Please sign in again.'
          );

          return;
        }


        showMessage(
          'Unable to Save',
          'Something went wrong while saving your information. Please try again.'
        );


      } finally {

        setSaving(false);
      }
    };


  // ====================================================
  // SCREEN BUSY
  // ====================================================

  const busy =
    saving ||
    openingIdVerification;


  // ====================================================
  // SCREEN
  // ====================================================

  return (

    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
      keyboardShouldPersistTaps="handled"
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <Text style={styles.title}>
        Welcome to MissionTrail
      </Text>


      <Text style={styles.subtitle}>
        Let's build your profile.
      </Text>


      {/* ==================================================
          FIRST NAME
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="person-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="First Name"
          placeholderTextColor="#888"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          LAST NAME
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="person-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Last Name"
          placeholderTextColor="#888"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          DISPLAY NAME
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="at-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Display Name"
          placeholderTextColor="#888"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          EMAIL
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="mail-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#888"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          PHONE
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="call-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#888"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          BIRTHDAY
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="calendar-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Birthday (MM/DD/YYYY)"
          placeholderTextColor="#888"
          keyboardType="numbers-and-punctuation"
          value={birthday}
          onChangeText={setBirthday}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          CITY
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="location-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="City"
          placeholderTextColor="#888"
          value={city}
          onChangeText={setCity}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          STATE
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="map-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="State"
          placeholderTextColor="#888"
          value={state}
          onChangeText={setState}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          COUNTRY
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="earth-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Country"
          placeholderTextColor="#888"
          value={country}
          onChangeText={setCountry}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          VERIFY PHOTO ID
      ================================================== */}

      <TouchableOpacity
        style={[
          styles.photoButton,

          busy &&
            styles.buttonDisabled,
        ]}
        onPress={openCheckId}
        activeOpacity={0.8}
        disabled={busy}
      >

        {openingIdVerification ? (

          <ActivityIndicator
            size="small"
            color="#63D8FF"
          />

        ) : (

          <Ionicons
            name="id-card-outline"
            size={28}
            color="#63D8FF"
          />

        )}


        <Text
          style={
            styles.photoButtonText
          }
        >

          {openingIdVerification
            ? 'Opening ID Verification...'
            : 'Verify Photo ID'}

        </Text>

      </TouchableOpacity>


      {/* ==================================================
          CONTINUE
      ================================================== */}

      <TouchableOpacity
        style={[
          styles.button,

          busy &&
            styles.buttonDisabled,
        ]}
        onPress={saveAndContinue}
        activeOpacity={0.8}
        disabled={busy}
      >

        {saving ? (

          <View
            style={
              styles.loadingRow
            }
          >

            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />

            <Text
              style={
                styles.loadingButtonText
              }
            >
              SAVING...
            </Text>

          </View>

        ) : (

          <Text
            style={
              styles.buttonText
            }
          >
            CONTINUE
          </Text>

        )}

      </TouchableOpacity>

    </ScrollView>
  );
}


// ======================================================
// STYLES
// ======================================================

const styles =
  StyleSheet.create({

    container: {

      flex: 1,

      backgroundColor:
        '#05010B',
    },


    content: {

      flexGrow: 1,

      paddingHorizontal: 24,

      paddingTop: 60,

      paddingBottom: 60,

      alignItems: 'center',
    },


    title: {

      color: '#FFFFFF',

      fontSize: 34,

      fontWeight: 'bold',

      marginBottom: 8,

      textAlign: 'center',
    },


    subtitle: {

      color: '#B8A7FF',

      fontSize: 16,

      marginBottom: 35,

      textAlign: 'center',
    },


    inputBox: {

      width: '100%',

      maxWidth: 550,

      flexDirection: 'row',

      alignItems: 'center',

      backgroundColor:
        '#181028',

      borderWidth: 1,

      borderColor:
        '#7B42F6',

      borderRadius: 18,

      paddingHorizontal: 18,

      height: 62,

      marginBottom: 18,
    },


    input: {

      flex: 1,

      color: '#FFFFFF',

      marginLeft: 12,

      fontSize: 16,

      height: '100%',
    },


    // ====================================================
    // VERIFY PHOTO ID BUTTON
    // ====================================================

    photoButton: {

      width: '100%',

      maxWidth: 550,

      height: 70,

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        '#FFFFFF',

      backgroundColor:
        '#12091F',

      justifyContent:
        'center',

      alignItems:
        'center',

      flexDirection:
        'row',

      marginTop: 10,

      marginBottom: 30,
    },


    photoButtonText: {

      color: '#FFFFFF',

      fontSize: 17,

      fontWeight: '600',

      marginLeft: 12,
    },


    // ====================================================
    // CONTINUE BUTTON
    // ====================================================

    button: {

      width: '100%',

      maxWidth: 550,

      height: 65,

      borderRadius: 20,

      backgroundColor:
        '#7B42F6',

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


    buttonDisabled: {

      opacity: 0.6,
    },


    buttonText: {

      color: '#FFFFFF',

      fontSize: 18,

      fontWeight: 'bold',

      letterSpacing: 1,
    },


    loadingRow: {

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',
    },


    loadingButtonText: {

      color: '#FFFFFF',

      fontSize: 18,

      fontWeight: 'bold',

      letterSpacing: 1,

      marginLeft: 10,
    },
  });