// src/app/onboarding_questionnaire.tsx
import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useLocalSearchParams,
} from "expo-router";
import React, {
  useState,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
// ============================================================
// TYPES
// ============================================================
type AnswerKey =
  | "missionGoal"
  | "adventureLength"
  | "movementStyle"
  | "explorationStyle"
  | "discoveryFocus"
  | "challengePreference";
type Answers =
  Partial<Record<AnswerKey, string>>;
type Question = {
  key: AnswerKey;
  title: string;
  subtitle: string;
  icon:
    React.ComponentProps<
      typeof Ionicons
    >["name"];
  options: string[];
};
// ============================================================
// QUESTIONNAIRE VERSION
// ============================================================
const QUESTIONNAIRE_VERSION = 2;
// ============================================================
// QUESTIONS
// ============================================================
const QUESTIONS: Question[] = [
  // ==========================================================
  // QUESTION 1
  // ==========================================================
  {
    key: "missionGoal",
    title:
      "What brings you to Mission Trail?",
    subtitle:
      "We will use this to shape your exploration experience.",
    icon:
      "compass-outline",
    options: [
      "Explore new places",
      "Get more active",
      "Hunt hidden relics",
      "Complete missions",
      "Explore with friends",
    ],
  },
  // ==========================================================
  // QUESTION 2
  // ==========================================================
  {
    key:
      "adventureLength",
    title:
      "How far do you usually want to explore?",
    subtitle:
      "You can always choose different missions later.",
    icon:
      "walk-outline",
    options: [
      "Under 1 mile",
      "1–3 miles",
      "3–5 miles",
      "5+ miles",
    ],
  },
  // ==========================================================
  // QUESTION 3
  // ==========================================================
  {
    key:
      "movementStyle",
    title:
      "How do you like to move?",
    subtitle:
      "Mission Trail supports different adventure speeds.",
    icon:
      "fitness-outline",
    options: [
      "Easy walking",
      "Steady walking",
      "Brisk walking",
      "Running",
      "A mix of walking and running",
    ],
  },
  // ==========================================================
  // QUESTION 4
  // ==========================================================
  {
    key:
      "explorationStyle",
    title:
      "How do you like to explore?",
    subtitle:
      "Pick the style that sounds most like you.",
    icon:
      "map-outline",
    options: [
      "Solo adventures",
      "With friends",
      "Mission-guided exploring",
      "Surprise me",
    ],
  },
  // ==========================================================
  // QUESTION 5
  // ==========================================================
  {
    key:
      "discoveryFocus",
    title:
      "What are you most excited to discover?",
    subtitle:
      "This helps us understand what part of Mission Trail interests you most.",
    icon:
      "sparkles-outline",
    options: [
      "Hidden relics",
      "Trails",
      "Companions",
      "Explorer ranks and rewards",
      "Meetups and community",
    ],
  },
  // ==========================================================
  // QUESTION 6
  // ==========================================================
  {
    key:
      "challengePreference",
    title:
      "How challenging should missions feel?",
    subtitle:
      "This does not lock you into one difficulty.",
    icon:
      "flame-outline",
    options: [
      "Relaxed",
      "Balanced",
      "Challenging",
      "Push me",
    ],
  },
];
// ============================================================
// ONBOARDING QUESTIONNAIRE
// ============================================================
export default function OnboardingQuestionnaire() {
  // ==========================================================
  // ONBOARDING PARAMETERS
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
      idVerificationTicket?: string;
      privacyPolicyVersion?: string;
      safetyPolicyVersion?: string;
      privacyAcceptedAt?: string;
      safetyAcceptedAt?: string;
    }>();
  // ==========================================================
  // STATE
  // ==========================================================
  const [
    currentIndex,
    setCurrentIndex,
  ] =
    useState(0);
  const [
    answers,
    setAnswers,
  ] =
    useState<Answers>({});
  // ==========================================================
  // ACCOUNT MODE
  // ==========================================================
  const isKidsMode =
    params.accountAccessMode ===
    "kids";
  // ==========================================================
  // CURRENT QUESTION
  // ==========================================================
  const question =
    QUESTIONS[currentIndex];
  const selectedAnswer =
    answers[question.key] ??
    null;
  const isLastQuestion =
    currentIndex ===
    QUESTIONS.length - 1;
  // ==========================================================
  // CHOOSE ANSWER
  // ==========================================================
  const chooseAnswer = (
    answer: string
  ) => {
    setAnswers(
      (current) => ({
        ...current,
        [question.key]:
          answer,
      })
    );
  };
  // ==========================================================
  // GO BACK
  // ==========================================================
  const goBack = () => {
    /*
      If the user is on the first questionnaire
      question, return to the previous onboarding
      screen.
      Under the new architecture:
      Adult:
      ID Verification -> Questionnaire
      Kids:
      Previous permitted onboarding step ->
      Questionnaire
    */
    if (
      currentIndex === 0
    ) {
      router.back();
      return;
    }
    setCurrentIndex(
      (current) =>
        current - 1
    );
  };
  // ==========================================================
  // NORMALIZE PARAMETER
  // ==========================================================
  const getParam = (
    value:
      | string
      | undefined
  ) => {
    return typeof value ===
      "string"
      ? value
      : "";
  };
  // ==========================================================
  // GO NEXT
  // ==========================================================
  const goNext = () => {
    // --------------------------------------------------------
    // Require an answer before continuing.
    // --------------------------------------------------------
    if (
      !selectedAnswer
    ) {
      return;
    }
    // --------------------------------------------------------
    // Move to the next questionnaire question.
    // --------------------------------------------------------
    if (
      !isLastQuestion
    ) {
      setCurrentIndex(
        (current) =>
          current + 1
      );
      return;
    }
    // ========================================================
    // QUESTIONNAIRE COMPLETE
    // ========================================================
    /*
      Build one questionnaire object.
      This will later be stored in Supabase and associated
      with the exact authenticated Mission Trail user.
      IMPORTANT:
      The questionnaire should NOT send an adult back to
      ID verification.
      Under the new architecture, ID verification happens
      BEFORE the questionnaire.
    */
    const questionnaireAnswers =
      JSON.stringify({
        version:
          QUESTIONNAIRE_VERSION,
        completedAt:
          new Date()
            .toISOString(),
        ...answers,
      });
    // ========================================================
    // PASS ALL ONBOARDING DATA FORWARD
    // ========================================================
    const nextParams = {
      firstName:
        getParam(
          params.firstName
        ),
      lastName:
        getParam(
          params.lastName
        ),
      displayName:
        getParam(
          params.displayName
        ),
      email:
        getParam(
          params.email
        ),
      phoneNumber:
        getParam(
          params.phoneNumber
        ),
      birthday:
        getParam(
          params.birthday
        ),
      city:
        getParam(
          params.city
        ),
      state:
        getParam(
          params.state
        ),
      country:
        getParam(
          params.country
        ),
      accountAccessMode:
        getParam(
          params.accountAccessMode
        ),
      idVerificationStatus:
        getParam(
          params.idVerificationStatus
        ),
      idVerificationTicket:
        getParam(
          params.idVerificationTicket
        ),
      privacyPolicyVersion:
        getParam(
          params.privacyPolicyVersion
        ),
      safetyPolicyVersion:
        getParam(
          params.safetyPolicyVersion
        ),
      privacyAcceptedAt:
        getParam(
          params.privacyAcceptedAt
        ),
      safetyAcceptedAt:
        getParam(
          params.safetyAcceptedAt
        ),
      questionnaireAnswers,
    };
    // ========================================================
    // KIDS MODE
    // ========================================================
    /*
      Kids Mode does not use adult Photo ID verification.
      We still send the questionnaire and onboarding
      information to finalization.
      Finalization can handle the separate Kids Mode
      account rules.
    */
    if (
      isKidsMode
    ) {
      router.push({
        pathname:
          "/onboarding_finalization",
        params: {
          ...nextParams,
          accountAccessMode:
            "kids",
          idVerificationStatus:
            "skipped_kids",
        },
      });
      return;
    }
    // ========================================================
    // ADULT MODE
    // ========================================================
    /*
      IMPORTANT:
      Adult ID verification has already happened BEFORE
      reaching this questionnaire.
      Therefore the questionnaire now continues to:
      onboarding_finalization.tsx
      NOT:
      onboarding_check_id.tsx
    */
    router.push({
      pathname:
        "/onboarding_finalization",
      params:
        nextParams,
    });
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
          HEADER
      ====================================================== */}
      <View
        style={
          styles.header
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={
            goBack
          }
          style={
            styles.backButton
          }
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color="#FFFFFF"
          />
        </Pressable>
        <View
          style={
            styles.headerText
          }
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            ADVENTURE PROFILE
          </Text>
          <Text
            style={
              styles.progressText
            }
          >
            {currentIndex + 1}
            {" "}
            OF
            {" "}
            {QUESTIONS.length}
          </Text>
        </View>
      </View>
      {/* ======================================================
          PROGRESS BAR
      ====================================================== */}
      <View
        style={
          styles.progressRow
        }
      >
        {QUESTIONS.map(
          (
            item,
            index
          ) => (
            <View
              key={
                item.key
              }
              style={[
                styles.progressSegment,
                index <=
                  currentIndex &&
                  styles.progressSegmentActive,
              ]}
            />
          )
        )}
      </View>
      {/* ======================================================
          QUESTION ICON
      ====================================================== */}
      <View
        style={
          styles.iconCircle
        }
      >
        <Ionicons
          name={
            question.icon
          }
          size={38}
          color="#63D8FF"
        />
      </View>
      {/* ======================================================
          QUESTION TITLE
      ====================================================== */}
      <Text
        style={
          styles.title
        }
      >
        {question.title}
      </Text>
      {/* ======================================================
          QUESTION SUBTITLE
      ====================================================== */}
      <Text
        style={
          styles.subtitle
        }
      >
        {question.subtitle}
      </Text>
      {/* ======================================================
          ANSWER OPTIONS
      ====================================================== */}
      <View
        style={
          styles.options
        }
      >
        {question.options.map(
          (
            option
          ) => {
            const selected =
              selectedAnswer ===
              option;
            return (
              <Pressable
                key={
                  option
                }
                accessibilityRole="button"
                accessibilityState={{
                  selected,
                }}
                onPress={() =>
                  chooseAnswer(
                    option
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.option,
                  selected &&
                    styles.optionSelected,
                  pressed &&
                    styles.optionPressed,
                ]}
              >
                {/* ============================================
                    RADIO BUTTON
                ============================================ */}
                <View
                  style={[
                    styles.radioOuter,
                    selected &&
                      styles.radioOuterSelected,
                  ]}
                >
                  {selected ? (
                    <View
                      style={
                        styles.radioInner
                      }
                    />
                  ) : null}
                </View>
                {/* ============================================
                    OPTION TEXT
                ============================================ */}
                <Text
                  style={[
                    styles.optionText,
                    selected &&
                      styles.optionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          }
        )}
      </View>
      {/* ======================================================
          CONTINUE BUTTON
      ====================================================== */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          disabled:
            !selectedAnswer,
        }}
        disabled={
          !selectedAnswer
        }
        onPress={
          goNext
        }
        style={({
          pressed,
        }) => [
          styles.continueButton,
          !selectedAnswer &&
            styles.continueButtonDisabled,
          pressed &&
            selectedAnswer &&
            styles.continueButtonPressed,
        ]}
      >
        <Text
          style={
            styles.continueText
          }
        >
          {isLastQuestion
            ? "COMPLETE QUESTIONNAIRE"
            : "CONTINUE"}
        </Text>
        <Ionicons
          name="arrow-forward"
          size={21}
          color="#FFFFFF"
        />
      </Pressable>
      {/* ======================================================
          BOTTOM NOTE
      ====================================================== */}
      <Text
        style={
          styles.bottomNote
        }
      >
        You can change your exploration
        preferences later in Settings.
      </Text>
    </ScrollView>
  );
}
// ============================================================
// STYLES
// ============================================================
const styles =
  StyleSheet.create({
    // ========================================================
    // SCREEN
    // ========================================================
    screen: {
      flex: 1,
      backgroundColor:
        "#05010B",
    },
    // ========================================================
    // CONTENT
    // ========================================================
    content: {
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingTop: 58,
      paddingBottom: 46,
      alignItems:
        "center",
    },
    // ========================================================
    // HEADER
    // ========================================================
    header: {
      width:
        "100%",
      maxWidth:
        560,
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom:
        18,
    },
    backButton: {
      width: 46,
      height: 46,
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
    headerText: {
      flex: 1,
      marginLeft:
        14,
    },
    eyebrow: {
      color:
        "#63D8FF",
      fontSize:
        13,
      fontWeight:
        "800",
      letterSpacing:
        1.4,
    },
    progressText: {
      color:
        "#9184B5",
      fontSize:
        12,
      marginTop:
        2,
    },
    // ========================================================
    // PROGRESS BAR
    // ========================================================
    progressRow: {
      width:
        "100%",
      maxWidth:
        560,
      flexDirection:
        "row",
      gap:
        6,
      marginBottom:
        34,
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius:
        999,
      backgroundColor:
        "#2A203B",
    },
    progressSegmentActive: {
      backgroundColor:
        "#7B42F6",
    },
    // ========================================================
    // ICON
    // ========================================================
    iconCircle: {
      width: 78,
      height: 78,
      borderRadius:
        39,
      justifyContent:
        "center",
      alignItems:
        "center",
      backgroundColor:
        "#171026",
      borderWidth:
        1,
      borderColor:
        "#63D8FF",
      marginBottom:
        22,
    },
    // ========================================================
    // TITLE
    // ========================================================
    title: {
      width:
        "100%",
      maxWidth:
        560,
      color:
        "#FFFFFF",
      fontSize:
        28,
      lineHeight:
        35,
      fontWeight:
        "800",
      textAlign:
        "center",
    },
    // ========================================================
    // SUBTITLE
    // ========================================================
    subtitle: {
      width:
        "100%",
      maxWidth:
        520,
      color:
        "#A999D6",
      fontSize:
        15,
      lineHeight:
        22,
      textAlign:
        "center",
      marginTop:
        10,
      marginBottom:
        28,
    },
    // ========================================================
    // OPTIONS
    // ========================================================
    options: {
      width:
        "100%",
      maxWidth:
        560,
      gap:
        11,
    },
    option: {
      minHeight:
        58,
      borderRadius:
        17,
      borderWidth:
        1,
      borderColor:
        "#35284D",
      backgroundColor:
        "#110A1C",
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal:
        17,
      paddingVertical:
        13,
    },
    optionSelected: {
      borderColor:
        "#7B42F6",
      backgroundColor:
        "#1B0E30",
    },
    optionPressed: {
      opacity:
        0.8,
    },
    // ========================================================
    // RADIO BUTTON
    // ========================================================
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius:
        11,
      borderWidth:
        2,
      borderColor:
        "#65597A",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight:
        13,
    },
    radioOuterSelected: {
      borderColor:
        "#63D8FF",
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius:
        5,
      backgroundColor:
        "#63D8FF",
    },
    // ========================================================
    // OPTION TEXT
    // ========================================================
    optionText: {
      flex: 1,
      color:
        "#D8D0E9",
      fontSize:
        16,
      fontWeight:
        "600",
    },
    optionTextSelected: {
      color:
        "#FFFFFF",
    },
    // ========================================================
    // CONTINUE BUTTON
    // ========================================================
    continueButton: {
      width:
        "100%",
      maxWidth:
        560,
      minHeight:
        62,
      marginTop:
        28,
      borderRadius:
        18,
      backgroundColor:
        "#7B42F6",
      flexDirection:
        "row",
      justifyContent:
        "center",
      alignItems:
        "center",
      gap:
        9,
    },
    continueButtonDisabled: {
      opacity:
        0.35,
    },
    continueButtonPressed: {
      opacity:
        0.82,
    },
    continueText: {
      color:
        "#FFFFFF",
      fontSize:
        15,
      fontWeight:
        "800",
      letterSpacing:
        0.5,
      textAlign:
        "center",
    },
    // ========================================================
    // BOTTOM NOTE
    // ========================================================
    bottomNote: {
      color:
        "#776C90",
      fontSize:
        12,
      lineHeight:
        18,
      textAlign:
        "center",
      marginTop:
        18,
    },
  });