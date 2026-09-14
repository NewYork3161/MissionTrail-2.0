// ============================================================
// LOGIN PRIVATE POLICY
// ============================================================
//
// FILE:
//
// src/app/login_private_policy.tsx
//
// PURPOSE:
//
// 1. Receive onboarding information from onboarding_user_info.
// 2. Display the Mission Trail Privacy Policy.
// 3. Display the Mission Trail Community & Safety Rules.
// 4. Require acceptance of both policies.
// 5. Record the policy versions and acceptance timestamps.
// 6. Route standard accounts to Photo ID verification.
// 7. Route Kids Mode accounts to the questionnaire.
//
// STANDARD FLOW:
//
// onboarding_user_info
//        ↓
// login_private_policy
//        ↓
// onboarding_check_id
//
// KIDS FLOW:
//
// onboarding_user_info
//        ↓
// login_private_policy
//        ↓
// onboarding_questionnaire
//
// ============================================================


import React, {
  useState,
} from "react";


import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";


import {
  Ionicons,
} from "@expo/vector-icons";


import {
  router,
  useLocalSearchParams,
} from "expo-router";


// ============================================================
// TYPES
// ============================================================

type YesNoAnswer =
  | "yes"
  | "no"
  | null;


type AccountAccessMode =
  | "id_required"
  | "kids";


// ============================================================
// POLICY VERSIONS
// ============================================================

const PRIVACY_POLICY_VERSION =
  "1.0";


const SAFETY_POLICY_VERSION =
  "1.0";


// ============================================================
// PARAMETER HELPER
// ============================================================

const getParam = (
  value:
    | string
    | string[]
    | undefined
): string => {

  if (
    Array.isArray(value)
  ) {

    return (
      value[0] ??
      ""
    );
  }


  return (
    value ??
    ""
  );
};


// ============================================================
// SCREEN
// ============================================================

export default function LoginPrivatePolicy() {

  // ==========================================================
  // ROUTE PARAMETERS
  // ==========================================================

  const params =
    useLocalSearchParams();


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


  const rawAccountAccessMode =
    getParam(
      params.accountAccessMode
    );


  const accountAccessMode:
    AccountAccessMode =
      rawAccountAccessMode ===
      "kids"
        ? "kids"
        : "id_required";


  const incomingIdVerificationStatus =
    getParam(
      params.idVerificationStatus
    );


  // ==========================================================
  // POLICY ANSWERS
  // ==========================================================

  const [
    privacyAnswer,
    setPrivacyAnswer,
  ] =
    useState<YesNoAnswer>(
      null
    );


  const [
    safetyAnswer,
    setSafetyAnswer,
  ] =
    useState<YesNoAnswer>(
      null
    );


  // ==========================================================
  // NAVIGATION STATE
  // ==========================================================

  const [
    continuing,
    setContinuing,
  ] =
    useState(
      false
    );


  // ==========================================================
  // CAN CONTINUE
  // ==========================================================

  const canContinue =
    privacyAnswer ===
      "yes" &&
    safetyAnswer ===
      "yes" &&
    !continuing;


  // ==========================================================
  // BUILD COMMON PARAMETERS
  // ==========================================================

  const buildCommonParams =
    () => {

      const acceptedAt =
        new Date()
          .toISOString();


      return {

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

        privacyPolicyVersion:
          PRIVACY_POLICY_VERSION,

        safetyPolicyVersion:
          SAFETY_POLICY_VERSION,

        privacyAcceptedAt:
          acceptedAt,

        safetyAcceptedAt:
          acceptedAt,

      };
    };


  // ==========================================================
  // CONTINUE
  // ==========================================================

  const handleContinue =
    () => {

      if (
        !canContinue
      ) {

        return;
      }


      setContinuing(
        true
      );


      try {

        const commonParams =
          buildCommonParams();


        // ====================================================
        // KIDS MODE
        // ====================================================
        //
        // Kids Mode does not enter the standard Photo ID
        // verification flow.
        //
        // It continues to the questionnaire with restricted
        // account access.
        //
        // ====================================================

        if (
          accountAccessMode ===
          "kids"
        ) {

          console.log(
            "[ONBOARDING] Policies accepted. Continuing in Kids Mode."
          );


          router.push({

            pathname:
              "/onboarding_questionnaire",

            params: {

              ...commonParams,

              idVerificationStatus:
                "skipped_kids",

            },

          });


          return;
        }


        // ====================================================
        // STANDARD ACCOUNT
        // ====================================================
        //
        // Privacy and safety have now been accepted.
        //
        // The next required stage is Photo ID verification.
        //
        // DO NOT route to the questionnaire here.
        //
        // ====================================================

        console.log(
          "[ONBOARDING] Policies accepted. Opening Photo ID verification."
        );


        router.push({

          pathname:
            "/onboarding_check_id",

          params: {

            ...commonParams,

            idVerificationStatus:
              incomingIdVerificationStatus ||
              "not_started",

          },

        });


      } catch (
        error
      ) {

        console.error(
          "[ONBOARDING] Unable to continue from policy screen:",
          error
        );


        setContinuing(
          false
        );
      }
    };


  // ==========================================================
  // BACK
  // ==========================================================

  const handleBack =
    () => {

      if (
        continuing
      ) {

        return;
      }


      router.back();
    };


  // ==========================================================
  // YES / NO OPTION
  // ==========================================================

  const renderOption = (

    label: string,

    value:
      | "yes"
      | "no",

    selectedValue:
      YesNoAnswer,

    onSelect:
      (
        value:
          | "yes"
          | "no"
      ) => void

  ) => {

    const selected =
      selectedValue ===
      value;


    return (

      <TouchableOpacity

        style={[

          styles.optionButton,

          selected &&
            styles.optionButtonSelected,

        ]}

        onPress={
          () =>
            onSelect(
              value
            )
        }

        activeOpacity={
          0.8
        }

        disabled={
          continuing
        }

      >

        <View

          style={[

            styles.radioOuter,

            selected &&
              styles.radioOuterSelected,

          ]}

        >

          {selected && (

            <View
              style={
                styles.radioInner
              }
            />

          )}

        </View>


        <Text

          style={[

            styles.optionText,

            selected &&
              styles.optionTextSelected,

          ]}

        >

          {label}

        </Text>

      </TouchableOpacity>

    );
  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <SafeAreaView
      style={
        styles.safeArea
      }
    >

      <ScrollView

        contentContainerStyle={
          styles.scrollContent
        }

        showsVerticalScrollIndicator={
          false
        }

      >

        <View
          style={
            styles.container
          }
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
                handleBack
              }

              activeOpacity={
                0.8
              }

              disabled={
                continuing
              }

            >

              <Ionicons

                name="chevron-back"

                size={
                  27
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
                  styles.headerTitle
                }
              >
                ADVENTURE PROFILE
              </Text>


              <Text
                style={
                  styles.headerStep
                }
              >
                PRIVACY & SAFETY
              </Text>

            </View>

          </View>


          {/* ==================================================
              PROGRESS BAR
          ================================================== */}

          <View
            style={
              styles.progressContainer
            }
          >

            <View

              style={[
                styles.progressSegment,
                styles.progressSegmentActive,
              ]}

            />


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
              ICON
          ================================================== */}

          <View
            style={
              styles.iconContainer
            }
          >

            <Ionicons

              name="shield-checkmark-outline"

              size={
                42
              }

              color="#65D5FF"

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
            Privacy & Safety
          </Text>


          <Text
            style={
              styles.subtitle
            }
          >
            Before continuing, please review how
            Mission Trail handles your information
            and the rules that help keep our
            community safe.
          </Text>


          {/* ==================================================
              PRIVACY POLICY
          ================================================== */}

          <View
            style={
              styles.policyCard
            }
          >

            <View
              style={
                styles.policyHeader
              }
            >

              <Ionicons

                name="lock-closed-outline"

                size={
                  23
                }

                color="#65D5FF"

              />


              <Text
                style={
                  styles.policyTitle
                }
              >
                Privacy Policy
              </Text>

            </View>


            <Text
              style={
                styles.policyText
              }
            >
              Mission Trail collects information
              you provide during account creation,
              including profile information needed
              to create and maintain your account.
            </Text>


            <Text
              style={
                styles.policyText
              }
            >
              As part of the onboarding process,
              Mission Trail may request information
              needed to verify your identity and
              confirm that information submitted
              during registration is consistent.
            </Text>


            <Text
              style={
                styles.policyText
              }
            >
              Information collected during
              onboarding is used for account
              creation, identity verification,
              safety, security, fraud prevention,
              and operation of Mission Trail
              features.
            </Text>


            <Text
              style={
                styles.policyText
              }
            >
              Mission Trail will not sell your
              personal information for advertising
              purposes. Access to sensitive
              information should be limited to
              authorized systems and services that
              require it to operate Mission Trail.
            </Text>


            <Text
              style={
                styles.policyText
              }
            >
              We aim to collect and retain only the
              information reasonably necessary for
              the operation, security, and safety
              of the service.
            </Text>


            <Text
              style={
                styles.versionText
              }
            >
              Privacy Policy Version{" "}
              {PRIVACY_POLICY_VERSION}
            </Text>

          </View>


          {/* ==================================================
              PRIVACY QUESTION
          ================================================== */}

          <View
            style={
              styles.questionSection
            }
          >

            <Text
              style={
                styles.questionTitle
              }
            >
              Do you acknowledge the Mission Trail
              Privacy Policy and agree to continue?
            </Text>


            <View
              style={
                styles.answerRow
              }
            >

              {renderOption(
                "Yes",
                "yes",
                privacyAnswer,
                setPrivacyAnswer
              )}


              {renderOption(
                "No",
                "no",
                privacyAnswer,
                setPrivacyAnswer
              )}

            </View>

          </View>


          {/* ==================================================
              SAFETY POLICY
          ================================================== */}

          <View
            style={
              styles.policyCard
            }
          >

            <View
              style={
                styles.policyHeader
              }
            >

              <Ionicons

                name="people-outline"

                size={
                  23
                }

                color="#65D5FF"

              />


              <Text
                style={
                  styles.policyTitle
                }
              >
                Community & Safety Rules
              </Text>

            </View>


            <Text
              style={
                styles.policyText
              }
            >
              Mission Trail is designed to help
              people explore, participate in
              activities, complete missions, and
              interact with other members of the
              community.
            </Text>


            <Text
              style={
                styles.policyText
              }
            >
              Members must treat other users with
              respect. Harassment, threats,
              stalking, impersonation, bullying,
              exploitation, or intentionally
              unsafe behavior is not permitted.
            </Text>


            <Text
              style={
                styles.policyText
              }
            >
              Members must not attempt to bypass
              identity, age, account, or safety
              protections provided by Mission
              Trail.
            </Text>


            <Text
              style={
                styles.policyText
              }
            >
              Users should use appropriate caution
              when participating in activities
              involving other people and should
              follow Mission Trail&apos;s safety
              requirements and applicable laws.
            </Text>


            <Text
              style={
                styles.policyText
              }
            >
              Accounts or activity that require
              additional safety review may be
              restricted while that review is
              completed.
            </Text>


            <Text
              style={
                styles.versionText
              }
            >
              Safety Policy Version{" "}
              {SAFETY_POLICY_VERSION}
            </Text>

          </View>


          {/* ==================================================
              SAFETY QUESTION
          ================================================== */}

          <View
            style={
              styles.questionSection
            }
          >

            <Text
              style={
                styles.questionTitle
              }
            >
              Do you agree to follow the Mission
              Trail Community & Safety Rules?
            </Text>


            <View
              style={
                styles.answerRow
              }
            >

              {renderOption(
                "Yes",
                "yes",
                safetyAnswer,
                setSafetyAnswer
              )}


              {renderOption(
                "No",
                "no",
                safetyAnswer,
                setSafetyAnswer
              )}

            </View>

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

              name="information-circle-outline"

              size={
                23
              }

              color="#65D5FF"

            />


            <Text
              style={
                styles.noticeText
              }
            >

              {accountAccessMode ===
              "kids"
                ? "You must accept both policies before continuing with Kids Mode."
                : "You must accept both policies before continuing to identity verification."}

            </Text>

          </View>


          {/* ==================================================
              CONTINUE BUTTON
          ================================================== */}

          <TouchableOpacity

            style={[

              styles.continueButton,

              !canContinue &&
                styles.continueButtonDisabled,

            ]}

            onPress={
              handleContinue
            }

            disabled={
              !canContinue
            }

            activeOpacity={
              0.85
            }

          >

            <Text

              style={[

                styles.continueButtonText,

                !canContinue &&
                  styles.continueButtonTextDisabled,

              ]}

            >

              {continuing
                ? "CONTINUING..."
                : "AGREE & CONTINUE"}

            </Text>


            {!continuing && (

              <Ionicons

                name="arrow-forward"

                size={
                  22
                }

                color={
                  canContinue
                    ? "#FFFFFF"
                    : "#77728A"
                }

              />

            )}

          </TouchableOpacity>


          {/* ==================================================
              FOOTER
          ================================================== */}

          <Text
            style={
              styles.footerText
            }
          >
            Your privacy and safety matter to
            Mission Trail.
          </Text>

        </View>

      </ScrollView>

    </SafeAreaView>

  );
}


// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

    safeArea: {

      flex:
        1,

      backgroundColor:
        "#03020A",

    },


    scrollContent: {

      flexGrow:
        1,

      alignItems:
        "center",

      paddingBottom:
        70,

    },


    container: {

      width:
        "100%",

      maxWidth:
        620,

      paddingHorizontal:
        24,

      paddingTop:
        55,

    },


    // ==========================================================
    // HEADER
    // ==========================================================

    header: {

      flexDirection:
        "row",

      alignItems:
        "center",

    },


    backButton: {

      width:
        50,

      height:
        50,

      borderRadius:
        25,

      borderWidth:
        1,

      borderColor:
        "#493170",

      backgroundColor:
        "#171025",

      justifyContent:
        "center",

      alignItems:
        "center",

    },


    headerTextContainer: {

      marginLeft:
        14,

    },


    headerTitle: {

      color:
        "#65D5FF",

      fontSize:
        14,

      fontWeight:
        "800",

      letterSpacing:
        1.5,

    },


    headerStep: {

      color:
        "#9C87C7",

      fontSize:
        12,

      marginTop:
        3,

    },


    // ==========================================================
    // PROGRESS
    // ==========================================================

    progressContainer: {

      flexDirection:
        "row",

      gap:
        7,

      marginTop:
        20,

      marginBottom:
        36,

    },


    progressSegment: {

      flex:
        1,

      height:
        4,

      borderRadius:
        4,

      backgroundColor:
        "#261C39",

    },


    progressSegmentActive: {

      backgroundColor:
        "#7C3CFF",

    },


    // ==========================================================
    // ICON
    // ==========================================================

    iconContainer: {

      width:
        78,

      height:
        78,

      borderRadius:
        39,

      borderWidth:
        1,

      borderColor:
        "#65D5FF",

      backgroundColor:
        "#151025",

      alignSelf:
        "center",

      justifyContent:
        "center",

      alignItems:
        "center",

      marginBottom:
        24,

    },


    // ==========================================================
    // TITLE
    // ==========================================================

    title: {

      color:
        "#FFFFFF",

      fontSize:
        30,

      fontWeight:
        "800",

      textAlign:
        "center",

    },


    subtitle: {

      color:
        "#A58CCF",

      fontSize:
        15,

      lineHeight:
        23,

      textAlign:
        "center",

      marginTop:
        10,

      marginBottom:
        30,

      paddingHorizontal:
        10,

    },


    // ==========================================================
    // POLICY CARD
    // ==========================================================

    policyCard: {

      width:
        "100%",

      backgroundColor:
        "#120B1F",

      borderWidth:
        1,

      borderColor:
        "#392650",

      borderRadius:
        18,

      padding:
        22,

      marginBottom:
        18,

    },


    policyHeader: {

      flexDirection:
        "row",

      alignItems:
        "center",

      marginBottom:
        16,

    },


    policyTitle: {

      color:
        "#FFFFFF",

      fontSize:
        19,

      fontWeight:
        "700",

      marginLeft:
        10,

    },


    policyText: {

      color:
        "#C7BDD9",

      fontSize:
        14,

      lineHeight:
        22,

      marginBottom:
        14,

    },


    versionText: {

      color:
        "#716486",

      fontSize:
        11,

      marginTop:
        4,

    },


    // ==========================================================
    // QUESTION
    // ==========================================================

    questionSection: {

      marginBottom:
        30,

    },


    questionTitle: {

      color:
        "#FFFFFF",

      fontSize:
        15,

      fontWeight:
        "600",

      lineHeight:
        22,

      marginBottom:
        14,

    },


    answerRow: {

      flexDirection:
        "row",

      gap:
        12,

    },


    optionButton: {

      flex:
        1,

      minHeight:
        58,

      borderWidth:
        1,

      borderColor:
        "#49345E",

      backgroundColor:
        "#120B1F",

      borderRadius:
        14,

      flexDirection:
        "row",

      alignItems:
        "center",

      paddingHorizontal:
        18,

    },


    optionButtonSelected: {

      borderColor:
        "#844BFF",

      backgroundColor:
        "#241342",

    },


    radioOuter: {

      width:
        22,

      height:
        22,

      borderRadius:
        11,

      borderWidth:
        2,

      borderColor:
        "#766888",

      justifyContent:
        "center",

      alignItems:
        "center",

    },


    radioOuterSelected: {

      borderColor:
        "#65D5FF",

    },


    radioInner: {

      width:
        10,

      height:
        10,

      borderRadius:
        5,

      backgroundColor:
        "#65D5FF",

    },


    optionText: {

      color:
        "#CFC6DD",

      fontSize:
        15,

      fontWeight:
        "600",

      marginLeft:
        11,

    },


    optionTextSelected: {

      color:
        "#FFFFFF",

    },


    // ==========================================================
    // NOTICE
    // ==========================================================

    noticeCard: {

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
        14,

      padding:
        16,

      marginBottom:
        22,

    },


    noticeText: {

      flex:
        1,

      color:
        "#A9A0BB",

      fontSize:
        13,

      lineHeight:
        19,

      marginLeft:
        11,

    },


    // ==========================================================
    // CONTINUE
    // ==========================================================

    continueButton: {

      width:
        "100%",

      height:
        66,

      borderRadius:
        15,

      backgroundColor:
        "#3B2179",

      flexDirection:
        "row",

      justifyContent:
        "center",

      alignItems:
        "center",

      gap:
        10,

    },


    continueButtonDisabled: {

      backgroundColor:
        "#28194E",

      opacity:
        0.65,

    },


    continueButtonText: {

      color:
        "#FFFFFF",

      fontSize:
        16,

      fontWeight:
        "800",

      letterSpacing:
        0.5,

    },


    continueButtonTextDisabled: {

      color:
        "#77728A",

    },


    // ==========================================================
    // FOOTER
    // ==========================================================

    footerText: {

      color:
        "#706280",

      fontSize:
        12,

      textAlign:
        "center",

      marginTop:
        18,

    },

  });