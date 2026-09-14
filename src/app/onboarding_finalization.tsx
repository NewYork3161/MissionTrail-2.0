// src/app/onboarding_finalization.tsx

import { Ionicons } from "@expo/vector-icons";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";


// ============================================================
// TYPES
// ============================================================

type FinalizationStatus =
  | "checking"
  | "ready"
  | "error";


// ============================================================
// PARAMETER HELPER
// ============================================================

const getParam = (
  value:
    | string
    | string[]
    | undefined
): string => {

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};


// ============================================================
// SCREEN
// ============================================================

export default function OnboardingFinalization() {

  // ==========================================================
  // RECEIVE ONBOARDING INFORMATION
  // ==========================================================

  const params =
    useLocalSearchParams<{
      firstName?: string;
      lastName?: string;
      displayName?: string;

      email?: string;
      phoneNumber?: string;

      birthday?: string;

      city?: string;
      state?: string;
      country?: string;

      accountAccessMode?: string;
      idVerificationStatus?: string;

      privacyPolicyVersion?: string;
      safetyPolicyVersion?: string;

      privacyAcceptedAt?: string;
      safetyAcceptedAt?: string;

      questionnaireAnswers?: string;
    }>();


  // ==========================================================
  // NORMALIZED VALUES
  // ==========================================================

  const firstName =
    getParam(
      params.firstName
    );

  const lastName =
    getParam(
      params.lastName
    );

  const displayName =
    getParam(
      params.displayName
    );

  const email =
    getParam(
      params.email
    );

  const phoneNumber =
    getParam(
      params.phoneNumber
    );

  const birthday =
    getParam(
      params.birthday
    );

  const city =
    getParam(
      params.city
    );

  const state =
    getParam(
      params.state
    );

  const country =
    getParam(
      params.country
    );

  const accountAccessMode =
    getParam(
      params.accountAccessMode
    );

  const idVerificationStatus =
    getParam(
      params.idVerificationStatus
    );

  const privacyPolicyVersion =
    getParam(
      params.privacyPolicyVersion
    );

  const safetyPolicyVersion =
    getParam(
      params.safetyPolicyVersion
    );

  const privacyAcceptedAt =
    getParam(
      params.privacyAcceptedAt
    );

  const safetyAcceptedAt =
    getParam(
      params.safetyAcceptedAt
    );

  const questionnaireAnswers =
    getParam(
      params.questionnaireAnswers
    );


  // ==========================================================
  // STATE
  // ==========================================================

  const [
    status,
    setStatus,
  ] =
    useState<FinalizationStatus>(
      "checking"
    );


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );


  // ==========================================================
  // MODE
  // ==========================================================

  const isKidsMode =
    accountAccessMode ===
    "kids";


  // ==========================================================
  // MESSAGE
  // ==========================================================

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


  // ==========================================================
  // VALIDATE QUESTIONNAIRE
  // ==========================================================

  const validateQuestionnaire =
    (): boolean => {

      if (
        !questionnaireAnswers
      ) {

        setErrorMessage(
          "Your questionnaire information is missing."
        );

        return false;
      }


      try {

        const parsed =
          JSON.parse(
            questionnaireAnswers
          );


        if (
          !parsed ||
          typeof parsed !== "object"
        ) {

          throw new Error(
            "Invalid questionnaire."
          );
        }


        return true;

      } catch {

        setErrorMessage(
          "Your questionnaire information could not be read."
        );

        return false;
      }
    };


  // ==========================================================
  // VALIDATE ONBOARDING
  // ==========================================================

  const validateOnboarding =
    (): boolean => {

      // --------------------------------------------------------
      // REQUIRED PROFILE INFORMATION
      // --------------------------------------------------------

      if (
        !firstName.trim()
      ) {

        setErrorMessage(
          "Your first name is missing."
        );

        return false;
      }


      if (
        !lastName.trim()
      ) {

        setErrorMessage(
          "Your last name is missing."
        );

        return false;
      }


      if (
        !displayName.trim()
      ) {

        setErrorMessage(
          "Your display name is missing."
        );

        return false;
      }


      if (
        !email.trim()
      ) {

        setErrorMessage(
          "Your email address is missing."
        );

        return false;
      }


      if (
        !phoneNumber.trim()
      ) {

        setErrorMessage(
          "Your phone number is missing."
        );

        return false;
      }


      if (
        !birthday.trim()
      ) {

        setErrorMessage(
          "Your birthday is missing."
        );

        return false;
      }


      if (
        !city.trim() ||
        !state.trim() ||
        !country.trim()
      ) {

        setErrorMessage(
          "Your location information is incomplete."
        );

        return false;
      }


      // --------------------------------------------------------
      // POLICY ACCEPTANCE
      // --------------------------------------------------------

      if (
        !privacyPolicyVersion ||
        !privacyAcceptedAt
      ) {

        setErrorMessage(
          "Privacy Policy acceptance information is missing."
        );

        return false;
      }


      if (
        !safetyPolicyVersion ||
        !safetyAcceptedAt
      ) {

        setErrorMessage(
          "Community & Safety Rules acceptance information is missing."
        );

        return false;
      }


      // --------------------------------------------------------
      // ACCOUNT ACCESS / ID VERIFICATION
      // --------------------------------------------------------

      if (
        isKidsMode
      ) {

        if (
          idVerificationStatus !==
          "skipped_kids"
        ) {

          setErrorMessage(
            "Kids Mode verification information is incomplete."
          );

          return false;
        }

      } else {

        if (
          idVerificationStatus !==
          "verified"
        ) {

          setErrorMessage(
            "Photo ID verification must be completed before account setup can continue."
          );

          return false;
        }
      }


      // --------------------------------------------------------
      // QUESTIONNAIRE
      // --------------------------------------------------------

      if (
        !validateQuestionnaire()
      ) {

        return false;
      }


      return true;
    };


  // ==========================================================
  // CHECK DATA WHEN SCREEN OPENS
  // ==========================================================

  useEffect(
    () => {

      const valid =
        validateOnboarding();


      if (
        valid
      ) {

        setErrorMessage(
          ""
        );

        setStatus(
          "ready"
        );

      } else {

        setStatus(
          "error"
        );
      }

    },
    []
  );


  // ==========================================================
  // COMPLETE ONBOARDING
  // ==========================================================

  const completeOnboarding =
    async () => {

      if (
        status !==
        "ready"
      ) {

        return;
      }


      setStatus(
        "checking"
      );


      try {

        // ======================================================
        // DATABASE COMMIT POINT
        // ======================================================
        //
        // This is intentionally the ONE place where completed
        // onboarding should be committed.
        //
        // We are NOT inventing Supabase table/column names here.
        //
        // Once the actual signup/database implementation is
        // connected, this section should:
        //
        // 1. Create or obtain the authenticated Supabase user.
        //
        // 2. Associate this onboarding data with that exact UUID.
        //
        // 3. Save the profile information.
        //
        // 4. Save questionnaireAnswers.
        //
        // 5. Save:
        //
        //    privacyPolicyVersion
        //    privacyAcceptedAt
        //    safetyPolicyVersion
        //    safetyAcceptedAt
        //
        // 6. Save the verified account-access state.
        //
        // 7. Confirm every required write succeeded.
        //
        // ONLY THEN should onboarding_complete be opened.
        //
        // ======================================================


        console.log(
          "[ONBOARDING FINALIZATION] Final onboarding package:",
          {
            firstName,
            lastName,
            displayName,
            email,
            phoneNumber,
            birthday,
            city,
            state,
            country,
            accountAccessMode,
            idVerificationStatus,
            privacyPolicyVersion,
            safetyPolicyVersion,
            privacyAcceptedAt,
            safetyAcceptedAt,
            questionnaireAnswers,
          }
        );


        // ======================================================
        // MOVE TO COMPLETION SCREEN
        // ======================================================

        router.replace(
          "/onboarding_complete"
        );


      } catch (
        error: any
      ) {

        console.error(
          "[ONBOARDING FINALIZATION] Error:",
          error
        );


        const message =
          error?.message ||
          "Mission Trail could not finish setting up your account.";


        setErrorMessage(
          message
        );


        setStatus(
          "error"
        );


        showMessage(
          "Unable to Complete Signup",
          message
        );
      }
    };


  // ==========================================================
  // GO BACK
  // ==========================================================

  const goBack =
    () => {

      if (
        status ===
        "checking"
      ) {

        return;
      }


      router.back();
    };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <ScrollView

      style={
        styles.screen
      }

      contentContainerStyle={
        styles.content
      }

      showsVerticalScrollIndicator={
        false
      }

    >

      {/* ======================================================
          ICON
      ====================================================== */}

      <View
        style={
          styles.iconCircle
        }
      >

        <Ionicons

          name={
            status === "error"
              ? "alert-circle-outline"
              : "shield-checkmark-outline"
          }

          size={
            48
          }

          color={
            status === "error"
              ? "#FF7B8A"
              : "#63D8FF"
          }

        />

      </View>


      {/* ======================================================
          TITLE
      ====================================================== */}

      <Text
        style={
          styles.title
        }
      >

        {status === "checking"
          ? "Checking Your Information"
          : status === "error"
          ? "Setup Needs Attention"
          : "Ready to Complete"}

      </Text>


      {/* ======================================================
          SUBTITLE
      ====================================================== */}

      <Text
        style={
          styles.subtitle
        }
      >

        {status === "checking"
          ? "Mission Trail is checking your completed onboarding information."
          : status === "error"
          ? "We found something that needs to be corrected before your account setup can be completed."
          : "Your onboarding information is complete and ready for final account setup."}

      </Text>


      {/* ======================================================
          CHECKING
      ====================================================== */}

      {status ===
        "checking" && (

        <View
          style={
            styles.statusCard
          }
        >

          <ActivityIndicator

            size="large"

            color="#63D8FF"

          />


          <Text
            style={
              styles.statusText
            }
          >
            Finalizing your adventure profile...
          </Text>

        </View>

      )}


      {/* ======================================================
          READY
      ====================================================== */}

      {status ===
        "ready" && (

        <View
          style={
            styles.statusCard
          }
        >

          <Ionicons

            name="checkmark-circle-outline"

            size={
              42
            }

            color="#70E0A0"

          />


          <Text
            style={
              styles.statusTitle
            }
          >
            Onboarding Complete
          </Text>


          <Text
            style={
              styles.statusText
            }
          >
            Your profile information, policy
            acknowledgments, verification status,
            and adventure questionnaire are ready
            for final account setup.
          </Text>


          <View
            style={
              styles.summaryDivider
            }
          />


          <View
            style={
              styles.summaryRow
            }
          >

            <Text
              style={
                styles.summaryLabel
              }
            >
              Explorer
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {displayName}
            </Text>

          </View>


          <View
            style={
              styles.summaryRow
            }
          >

            <Text
              style={
                styles.summaryLabel
              }
            >
              Access
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {isKidsMode
                ? "Kids Mode"
                : "ID Verified"}
            </Text>

          </View>


          <View
            style={
              styles.summaryRow
            }
          >

            <Text
              style={
                styles.summaryLabel
              }
            >
              Questionnaire
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              Complete
            </Text>

          </View>

        </View>

      )}


      {/* ======================================================
          ERROR
      ====================================================== */}

      {status ===
        "error" && (

        <View

          style={[
            styles.statusCard,
            styles.errorCard,
          ]}

        >

          <Ionicons

            name="close-circle-outline"

            size={
              42
            }

            color="#FF7B8A"

          />


          <Text
            style={
              styles.statusTitle
            }
          >
            Unable to Continue
          </Text>


          <Text
            style={
              styles.errorText
            }
          >
            {errorMessage}
          </Text>


          <Text
            style={
              styles.statusText
            }
          >
            Go back and correct the missing
            onboarding information, then try again.
          </Text>

        </View>

      )}


      {/* ======================================================
          COMPLETE BUTTON
      ====================================================== */}

      {status ===
        "ready" && (

        <Pressable

          accessibilityRole="button"

          onPress={
            completeOnboarding
          }

          style={({
            pressed,
          }) => [

            styles.completeButton,

            pressed &&
              styles.buttonPressed,

          ]}

        >

          <Ionicons

            name="checkmark-circle"

            size={
              23
            }

            color="#FFFFFF"

          />


          <Text
            style={
              styles.completeButtonText
            }
          >
            COMPLETE SIGNUP
          </Text>


          <Ionicons

            name="arrow-forward"

            size={
              21
            }

            color="#FFFFFF"

          />

        </Pressable>

      )}


      {/* ======================================================
          BACK BUTTON
      ====================================================== */}

      {status !==
        "checking" && (

        <Pressable

          accessibilityRole="button"

          onPress={
            goBack
          }

          style={({
            pressed,
          }) => [

            styles.backButton,

            pressed &&
              styles.buttonPressed,

          ]}

        >

          <Ionicons

            name="arrow-back-outline"

            size={
              20
            }

            color="#B8A7FF"

          />


          <Text
            style={
              styles.backButtonText
            }
          >
            Back
          </Text>

        </Pressable>

      )}


      {/* ======================================================
          SECURITY NOTE
      ====================================================== */}

      <View
        style={
          styles.securityRow
        }
      >

        <Ionicons

          name="lock-closed-outline"

          size={
            16
          }

          color="#8C7AA8"

        />


        <Text
          style={
            styles.securityText
          }
        >
          Mission Trail checks required onboarding
          steps before completing account setup.
        </Text>

      </View>

    </ScrollView>

  );
}


// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

    screen: {

      flex:
        1,

      backgroundColor:
        "#05010B",

    },


    content: {

      flexGrow:
        1,

      alignItems:
        "center",

      paddingHorizontal:
        24,

      paddingTop:
        70,

      paddingBottom:
        60,

    },


    iconCircle: {

      width:
        92,

      height:
        92,

      borderRadius:
        46,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#181028",

      borderWidth:
        1,

      borderColor:
        "#7B42F6",

      marginBottom:
        24,

    },


    title: {

      width:
        "100%",

      maxWidth:
        560,

      color:
        "#FFFFFF",

      fontSize:
        31,

      lineHeight:
        38,

      fontWeight:
        "800",

      textAlign:
        "center",

    },


    subtitle: {

      width:
        "100%",

      maxWidth:
        530,

      color:
        "#B8A7FF",

      fontSize:
        15,

      lineHeight:
        23,

      textAlign:
        "center",

      marginTop:
        11,

      marginBottom:
        30,

    },


    statusCard: {

      width:
        "100%",

      maxWidth:
        550,

      alignItems:
        "center",

      backgroundColor:
        "#181028",

      borderWidth:
        1,

      borderColor:
        "#7B42F6",

      borderRadius:
        20,

      paddingHorizontal:
        24,

      paddingVertical:
        28,

      marginBottom:
        24,

    },


    errorCard: {

      borderColor:
        "#FF7B8A",

    },


    statusTitle: {

      color:
        "#FFFFFF",

      fontSize:
        20,

      fontWeight:
        "700",

      textAlign:
        "center",

      marginTop:
        13,

    },


    statusText: {

      color:
        "#C8BED7",

      fontSize:
        14,

      lineHeight:
        21,

      textAlign:
        "center",

      marginTop:
        12,

    },


    errorText: {

      color:
        "#FF9AA5",

      fontSize:
        14,

      lineHeight:
        21,

      fontWeight:
        "600",

      textAlign:
        "center",

      marginTop:
        12,

    },


    summaryDivider: {

      width:
        "100%",

      height:
        1,

      backgroundColor:
        "#35284D",

      marginVertical:
        22,

    },


    summaryRow: {

      width:
        "100%",

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      marginBottom:
        12,

    },


    summaryLabel: {

      color:
        "#9184B5",

      fontSize:
        14,

    },


    summaryValue: {

      color:
        "#FFFFFF",

      fontSize:
        14,

      fontWeight:
        "700",

    },


    completeButton: {

      width:
        "100%",

      maxWidth:
        550,

      minHeight:
        65,

      borderRadius:
        19,

      backgroundColor:
        "#7B42F6",

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        10,

      marginTop:
        4,

    },


    completeButtonText: {

      color:
        "#FFFFFF",

      fontSize:
        16,

      fontWeight:
        "800",

      letterSpacing:
        0.6,

    },


    buttonPressed: {

      opacity:
        0.8,

    },


    backButton: {

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        20,

      paddingVertical:
        14,

      marginTop:
        12,

    },


    backButtonText: {

      color:
        "#B8A7FF",

      fontSize:
        15,

      fontWeight:
        "600",

      marginLeft:
        7,

    },


    securityRow: {

      width:
        "100%",

      maxWidth:
        500,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "center",

      marginTop:
        20,

      paddingHorizontal:
        10,

    },


    securityText: {

      flex:
        1,

      color:
        "#8C7AA8",

      fontSize:
        12,

      lineHeight:
        18,

      marginLeft:
        7,

    },

  });