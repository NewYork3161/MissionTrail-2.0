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
// 2. Validate the required information.
// 3. Let the user choose the standard Photo ID path
//    or Kids Mode.
// 4. Pass the collected information to the Privacy
//    Policy screen.
// 5. Privacy Policy continues the onboarding flow.
//
// STANDARD FLOW:
//
// login
//   ↓
// onboarding_user_info
//   ↓
// login_private_policy
//   ↓
// onboarding_check_id
//   ↓
// onboarding_questionnaire
//   ↓
// onboarding_finalization
//   ↓
// onboarding_complete
//   ↓
// login
//
// ======================================================


import React, {
  useState,
} from "react";


import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";


import {
  Ionicons,
} from "@expo/vector-icons";


import {
  router,
} from "expo-router";


// ======================================================
// SCREEN
// ======================================================

export default function OnboardingUserInfo() {

  // ====================================================
  // FORM STATE
  // ====================================================

  const [
    firstName,
    setFirstName,
  ] =
    useState("");


  const [
    lastName,
    setLastName,
  ] =
    useState("");


  const [
    displayName,
    setDisplayName,
  ] =
    useState("");


  const [
    email,
    setEmail,
  ] =
    useState("");


  const [
    phone,
    setPhone,
  ] =
    useState("");


  const [
    birthday,
    setBirthday,
  ] =
    useState("");


  const [
    city,
    setCity,
  ] =
    useState("");


  const [
    state,
    setState,
  ] =
    useState("");


  const [
    country,
    setCountry,
  ] =
    useState("");


  // ====================================================
  // NAVIGATION STATE
  // ====================================================

  const [
    navigating,
    setNavigating,
  ] =
    useState(false);


  // ====================================================
  // SHOW MESSAGE
  // ====================================================

  const showMessage = (
    title: string,
    message: string
  ) => {

    if (
      Platform.OS === "web" &&
      typeof window !== "undefined"
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
  // NORMALIZE EMAIL
  // ====================================================

  const normalizedEmail =
    email
      .trim()
      .toLowerCase();


  // ====================================================
  // VALIDATE EMAIL
  // ====================================================

  const isValidEmail = (
    value: string
  ) => {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value
    );
  };


  // ====================================================
  // VALIDATE REQUIRED INFORMATION
  // ====================================================

  const validateInformation =
    (): boolean => {

      if (
        !firstName.trim()
      ) {

        showMessage(
          "First Name Required",
          "Please enter your first name before continuing."
        );

        return false;
      }


      if (
        !lastName.trim()
      ) {

        showMessage(
          "Last Name Required",
          "Please enter your last name before continuing."
        );

        return false;
      }


      if (
        !displayName.trim()
      ) {

        showMessage(
          "Display Name Required",
          "Please choose a display name before continuing."
        );

        return false;
      }


      if (
        !normalizedEmail
      ) {

        showMessage(
          "Email Required",
          "Please enter your email address before continuing."
        );

        return false;
      }


      if (
        !isValidEmail(
          normalizedEmail
        )
      ) {

        showMessage(
          "Invalid Email",
          "Please enter a valid email address."
        );

        return false;
      }


      if (
        !phone.trim()
      ) {

        showMessage(
          "Phone Number Required",
          "Please enter your phone number before continuing."
        );

        return false;
      }


      if (
        !birthday.trim()
      ) {

        showMessage(
          "Birthday Required",
          "Please enter your date of birth before continuing."
        );

        return false;
      }


      if (
        !city.trim()
      ) {

        showMessage(
          "City Required",
          "Please enter your city before continuing."
        );

        return false;
      }


      if (
        !state.trim()
      ) {

        showMessage(
          "State Required",
          "Please enter your state before continuing."
        );

        return false;
      }


      if (
        !country.trim()
      ) {

        showMessage(
          "Country Required",
          "Please enter your country before continuing."
        );

        return false;
      }


      return true;
    };


  // ====================================================
  // BUILD ONBOARDING PARAMETERS
  // ====================================================

  const buildOnboardingParams = (
    accountAccessMode: "id_required" | "kids"
  ) => {

    return {

      firstName:
        firstName.trim(),

      lastName:
        lastName.trim(),

      displayName:
        displayName.trim(),

      email:
        normalizedEmail,

      phoneNumber:
        phone.trim(),

      birthday:
        birthday.trim(),

      city:
        city.trim(),

      state:
        state.trim(),

      country:
        country.trim(),

      accountAccessMode,

      idVerificationStatus:
        accountAccessMode === "kids"
          ? "skipped_kids"
          : "not_started",

    };
  };


  // ====================================================
  // STANDARD SIGNUP
  // ====================================================
  //
  // IMPORTANT:
  //
  // This used to send the user directly to the
  // questionnaire.
  //
  // That was the incorrect architecture.
  //
  // The user must first read and accept the Privacy &
  // Safety Policy BEFORE Mission Trail asks for Photo ID.
  //
  // ====================================================

  const continueWithPhotoId =
    () => {

      if (
        navigating
      ) {

        return;
      }


      if (
        !validateInformation()
      ) {

        return;
      }


      try {

        setNavigating(
          true
        );


        console.log(
          "[ONBOARDING] Opening Privacy Policy."
        );


        router.push({

          pathname:
            "/login_private_policy",

          params:
            buildOnboardingParams(
              "id_required"
            ),

        });


      } catch (
        error
      ) {

        console.error(
          "[ONBOARDING] Unable to open Privacy Policy:",
          error
        );


        setNavigating(
          false
        );


        showMessage(
          "Unable to Continue",
          "The Privacy Policy screen could not be opened."
        );
      }
    };


  // ====================================================
  // KIDS MODE
  // ====================================================
  //
  // Kids Mode is kept as a separate access mode.
  //
  // It still goes through the Privacy & Safety Policy
  // before continuing.
  //
  // The policy screen can later decide which onboarding
  // screen comes next based on accountAccessMode.
  //
  // ====================================================

  const continueAsKid =
    () => {

      if (
        navigating
      ) {

        return;
      }


      if (
        !validateInformation()
      ) {

        return;
      }


      try {

        setNavigating(
          true
        );


        console.log(
          "[ONBOARDING] Kids Mode selected. Opening Privacy Policy."
        );


        router.push({

          pathname:
            "/login_private_policy",

          params:
            buildOnboardingParams(
              "kids"
            ),

        });


      } catch (
        error
      ) {

        console.error(
          "[ONBOARDING] Unable to open Privacy Policy:",
          error
        );


        setNavigating(
          false
        );


        showMessage(
          "Unable to Continue",
          "The Privacy Policy screen could not be opened."
        );
      }
    };


  // ====================================================
  // GO BACK
  // ====================================================

  const goBack =
    () => {

      if (
        navigating
      ) {

        return;
      }


      router.back();
    };


  // ====================================================
  // SCREEN
  // ====================================================

  return (

    <ScrollView

      style={
        styles.container
      }

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

      <View
        style={
          styles.header
        }
      >

        <TouchableOpacity

          style={
            styles.backButton
          }

          onPress={
            goBack
          }

          activeOpacity={
            0.8
          }

          disabled={
            navigating
          }

        >

          <Ionicons

            name="chevron-back"

            size={
              24
            }

            color="#FFFFFF"

          />

        </TouchableOpacity>


        <View
          style={
            styles.headerTextContainer
          }
        >

          <Text
            style={
              styles.headerEyebrow
            }
          >
            CREATE ACCOUNT
          </Text>


          <Text
            style={
              styles.headerStep
            }
          >
            PROFILE INFORMATION
          </Text>

        </View>

      </View>


      {/* ==================================================
          PROGRESS
      ================================================== */}

      <View
        style={
          styles.progressRow
        }
      >

        <View
          style={[
            styles.progressSegment,
            styles.progressSegmentActive,
          ]}
        />

        <View
          style={
            styles.progressSegment
          }
        />

        <View
          style={
            styles.progressSegment
          }
        />

        <View
          style={
            styles.progressSegment
          }
        />

        <View
          style={
            styles.progressSegment
          }
        />

      </View>


      {/* ==================================================
          TITLE
      ================================================== */}

      <Text
        style={
          styles.title
        }
      >
        Welcome to Mission Trail
      </Text>


      <Text
        style={
          styles.subtitle
        }
      >
        Let's build your profile.
      </Text>


      {/* ==================================================
          FIRST NAME
      ================================================== */}

      <View
        style={
          styles.inputBox
        }
      >

        <Ionicons

          name="person-outline"

          size={
            22
          }

          color="#63D8FF"

        />


        <TextInput

          style={
            styles.input
          }

          placeholder="First Name"

          placeholderTextColor="#888"

          value={
            firstName
          }

          onChangeText={
            setFirstName
          }

          autoCapitalize="words"

          autoCorrect={
            false
          }

          editable={
            !navigating
          }

        />

      </View>


      {/* ==================================================
          LAST NAME
      ================================================== */}

      <View
        style={
          styles.inputBox
        }
      >

        <Ionicons

          name="person-outline"

          size={
            22
          }

          color="#63D8FF"

        />


        <TextInput

          style={
            styles.input
          }

          placeholder="Last Name"

          placeholderTextColor="#888"

          value={
            lastName
          }

          onChangeText={
            setLastName
          }

          autoCapitalize="words"

          autoCorrect={
            false
          }

          editable={
            !navigating
          }

        />

      </View>


      {/* ==================================================
          DISPLAY NAME
      ================================================== */}

      <View
        style={
          styles.inputBox
        }
      >

        <Ionicons

          name="at-outline"

          size={
            22
          }

          color="#63D8FF"

        />


        <TextInput

          style={
            styles.input
          }

          placeholder="Display Name"

          placeholderTextColor="#888"

          value={
            displayName
          }

          onChangeText={
            setDisplayName
          }

          autoCapitalize="none"

          autoCorrect={
            false
          }

          editable={
            !navigating
          }

        />

      </View>


      {/* ==================================================
          EMAIL
      ================================================== */}

      <View
        style={
          styles.inputBox
        }
      >

        <Ionicons

          name="mail-outline"

          size={
            22
          }

          color="#63D8FF"

        />


        <TextInput

          style={
            styles.input
          }

          placeholder="Email Address"

          placeholderTextColor="#888"

          keyboardType="email-address"

          autoCapitalize="none"

          autoCorrect={
            false
          }

          value={
            email
          }

          onChangeText={
            setEmail
          }

          editable={
            !navigating
          }

        />

      </View>


      {/* ==================================================
          PHONE
      ================================================== */}

      <View
        style={
          styles.inputBox
        }
      >

        <Ionicons

          name="call-outline"

          size={
            22
          }

          color="#63D8FF"

        />


        <TextInput

          style={
            styles.input
          }

          placeholder="Phone Number"

          placeholderTextColor="#888"

          keyboardType="phone-pad"

          value={
            phone
          }

          onChangeText={
            setPhone
          }

          editable={
            !navigating
          }

        />

      </View>


      {/* ==================================================
          BIRTHDAY
      ================================================== */}

      <View
        style={
          styles.inputBox
        }
      >

        <Ionicons

          name="calendar-outline"

          size={
            22
          }

          color="#63D8FF"

        />


        <TextInput

          style={
            styles.input
          }

          placeholder="Birthday (MM/DD/YYYY)"

          placeholderTextColor="#888"

          keyboardType="numbers-and-punctuation"

          value={
            birthday
          }

          onChangeText={
            setBirthday
          }

          editable={
            !navigating
          }

        />

      </View>


      {/* ==================================================
          CITY
      ================================================== */}

      <View
        style={
          styles.inputBox
        }
      >

        <Ionicons

          name="location-outline"

          size={
            22
          }

          color="#63D8FF"

        />


        <TextInput

          style={
            styles.input
          }

          placeholder="City"

          placeholderTextColor="#888"

          value={
            city
          }

          onChangeText={
            setCity
          }

          autoCapitalize="words"

          autoCorrect={
            false
          }

          editable={
            !navigating
          }

        />

      </View>


      {/* ==================================================
          STATE
      ================================================== */}

      <View
        style={
          styles.inputBox
        }
      >

        <Ionicons

          name="map-outline"

          size={
            22
          }

          color="#63D8FF"

        />


        <TextInput

          style={
            styles.input
          }

          placeholder="State"

          placeholderTextColor="#888"

          value={
            state
          }

          onChangeText={
            setState
          }

          autoCapitalize="words"

          autoCorrect={
            false
          }

          editable={
            !navigating
          }

        />

      </View>


      {/* ==================================================
          COUNTRY
      ================================================== */}

      <View
        style={
          styles.inputBox
        }
      >

        <Ionicons

          name="earth-outline"

          size={
            22
          }

          color="#63D8FF"

        />


        <TextInput

          style={
            styles.input
          }

          placeholder="Country"

          placeholderTextColor="#888"

          value={
            country
          }

          onChangeText={
            setCountry
          }

          autoCapitalize="words"

          autoCorrect={
            false
          }

          editable={
            !navigating
          }

        />

      </View>


      {/* ==================================================
          INFORMATION NOTICE
      ================================================== */}

      <View
        style={
          styles.noticeCard
        }
      >

        <Ionicons

          name="shield-checkmark-outline"

          size={
            24
          }

          color="#63D8FF"

        />


        <Text
          style={
            styles.noticeText
          }
        >
          Before identity verification, you will
          review Mission Trail's Privacy and Safety
          Policy.
        </Text>

      </View>


      {/* ==================================================
          ACCESS CHOICES
      ================================================== */}

      <View
        style={
          styles.accessChoiceRow
        }
      >

        {/* ================================================
            STANDARD / PHOTO ID
        ================================================ */}

        <TouchableOpacity

          style={[
            styles.accessChoiceButton,

            navigating &&
              styles.accessChoiceButtonDisabled,
          ]}

          onPress={
            continueWithPhotoId
          }

          activeOpacity={
            0.8
          }

          disabled={
            navigating
          }

        >

          <Ionicons

            name="id-card-outline"

            size={
              25
            }

            color="#63D8FF"

          />


          <Text
            style={
              styles.accessChoiceText
            }
            numberOfLines={
              1
            }
          >
            Verify Photo ID
          </Text>

        </TouchableOpacity>


        {/* ================================================
            KIDS MODE
        ================================================ */}

        <TouchableOpacity

          style={[
            styles.accessChoiceButton,

            navigating &&
              styles.accessChoiceButtonDisabled,
          ]}

          onPress={
            continueAsKid
          }

          activeOpacity={
            0.8
          }

          disabled={
            navigating
          }

        >

          <Ionicons

            name="happy-outline"

            size={
              25
            }

            color="#63D8FF"

          />


          <Text
            style={
              styles.accessChoiceText
            }
            numberOfLines={
              1
            }
          >
            For Kids
          </Text>

        </TouchableOpacity>

      </View>

    </ScrollView>

  );
}


// ======================================================
// STYLES
// ======================================================

const styles =
  StyleSheet.create({

    // ====================================================
    // SCREEN
    // ====================================================

    container: {

      flex:
        1,

      backgroundColor:
        "#05010B",

    },


    content: {

      flexGrow:
        1,

      paddingHorizontal:
        24,

      paddingTop:
        55,

      paddingBottom:
        60,

      alignItems:
        "center",

    },


    // ====================================================
    // HEADER
    // ====================================================

    header: {

      width:
        "100%",

      maxWidth:
        550,

      flexDirection:
        "row",

      alignItems:
        "center",

      marginBottom:
        18,

    },


    backButton: {

      width:
        46,

      height:
        46,

      borderRadius:
        23,

      backgroundColor:
        "#181028",

      borderWidth:
        1,

      borderColor:
        "#47346F",

      justifyContent:
        "center",

      alignItems:
        "center",

    },


    headerTextContainer: {

      marginLeft:
        14,

    },


    headerEyebrow: {

      color:
        "#63D8FF",

      fontSize:
        13,

      fontWeight:
        "800",

      letterSpacing:
        1.4,

    },


    headerStep: {

      color:
        "#9184B5",

      fontSize:
        12,

      marginTop:
        2,

    },


    // ====================================================
    // PROGRESS
    // ====================================================

    progressRow: {

      width:
        "100%",

      maxWidth:
        550,

      flexDirection:
        "row",

      gap:
        6,

      marginBottom:
        32,

    },


    progressSegment: {

      flex:
        1,

      height:
        4,

      borderRadius:
        999,

      backgroundColor:
        "#2A203B",

    },


    progressSegmentActive: {

      backgroundColor:
        "#7B42F6",

    },


    // ====================================================
    // TITLE
    // ====================================================

    title: {

      color:
        "#FFFFFF",

      fontSize:
        34,

      fontWeight:
        "bold",

      marginBottom:
        8,

      textAlign:
        "center",

    },


    subtitle: {

      color:
        "#B8A7FF",

      fontSize:
        16,

      marginBottom:
        35,

      textAlign:
        "center",

    },


    // ====================================================
    // INPUT
    // ====================================================

    inputBox: {

      width:
        "100%",

      maxWidth:
        550,

      flexDirection:
        "row",

      alignItems:
        "center",

      backgroundColor:
        "#181028",

      borderWidth:
        1,

      borderColor:
        "#7B42F6",

      borderRadius:
        18,

      paddingHorizontal:
        18,

      height:
        62,

      marginBottom:
        18,

    },


    input: {

      flex:
        1,

      color:
        "#FFFFFF",

      marginLeft:
        12,

      fontSize:
        16,

      height:
        "100%",

    },


    // ====================================================
    // NOTICE
    // ====================================================

    noticeCard: {

      width:
        "100%",

      maxWidth:
        550,

      flexDirection:
        "row",

      alignItems:
        "center",

      backgroundColor:
        "#0C1220",

      borderWidth:
        1,

      borderColor:
        "#20364B",

      borderRadius:
        16,

      paddingHorizontal:
        17,

      paddingVertical:
        15,

      marginTop:
        4,

      marginBottom:
        18,

    },


    noticeText: {

      flex:
        1,

      color:
        "#AAA0BB",

      fontSize:
        13,

      lineHeight:
        19,

      marginLeft:
        12,

    },


    // ====================================================
    // ACCESS CHOICES
    // ====================================================

    accessChoiceRow: {

      width:
        "100%",

      maxWidth:
        550,

      flexDirection:
        "row",

      alignItems:
        "center",

      gap:
        12,

      marginTop:
        4,

    },


    accessChoiceButton: {

      flex:
        1,

      minWidth:
        0,

      height:
        64,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#181028",

      borderWidth:
        1.5,

      borderColor:
        "#7B42F6",

      borderRadius:
        18,

      paddingHorizontal:
        10,

    },


    accessChoiceButtonDisabled: {

      opacity:
        0.5,

    },


    accessChoiceText: {

      flexShrink:
        1,

      color:
        "#FFFFFF",

      fontSize:
        15,

      fontWeight:
        "700",

      marginLeft:
        8,

      textAlign:
        "center",

    },

  });