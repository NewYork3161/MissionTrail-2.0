// context/auth.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { Session } from '@supabase/supabase-js';

import {
  useRouter,
  useSegments,
} from 'expo-router';

import { supabase } from '../lib/supabase';


const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
}>({
  session: null,
  loading: true,
});


// ======================================================
// PUBLIC PRE-ACCOUNT ROUTES
// ======================================================

// Purpose:
// Determines which screens are allowed before a Mission
// Trails account is authenticated.
//
// Onboarding MUST remain available while signed out because
// ID verification and Kids Mode happen before account signup.
function isPublicPreAccountRoute(
  firstSegment: string | undefined,
): boolean {

  if (!firstSegment) {
    return true;
  }


  if (
    firstSegment === 'index' ||
    firstSegment === 'splash' ||
    firstSegment === 'login' ||
    firstSegment === 'Signup' ||
    firstSegment === 'welcome_mat' ||
    firstSegment === 'forgot-password' ||
    firstSegment === 'auth'
  ) {
    return true;
  }


  // Purpose:
  // Allows every onboarding screen such as:
  //
  // onboarding_user_info
  // onboarding_check_id
  // onboarding_success
  // onboarding_questionnaire
  // onboarding_finalization
  //
  // without requiring an existing login session.
  if (
    firstSegment.startsWith(
      'onboarding_'
    )
  ) {
    return true;
  }


  return false;
}


// ======================================================
// AUTH PROVIDER
// ======================================================

// Purpose:
// Loads and tracks the Supabase login session while
// protecting only screens that actually require login.
export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {

  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const segments =
    useSegments();

  const router =
    useRouter();


  // ====================================================
  // LOAD + WATCH SESSION
  // ====================================================

  useEffect(() => {

    // Purpose:
    // Restores an existing Supabase session when the
    // application starts.
    supabase.auth
      .getSession()
      .then(
        ({
          data: {
            session,
          },
        }) => {

          setSession(
            session
          );

          setLoading(
            false
          );
        }
      );


    // Purpose:
    // Keeps React state synchronized with sign-in,
    // sign-out, and refreshed Supabase sessions.
    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            nextSession
          ) => {

            setSession(
              nextSession
            );

            setLoading(
              false
            );
          }
        );


    return () => {

      subscription.unsubscribe();
    };

  }, []);


  // ====================================================
  // PROTECT PRIVATE APP SCREENS
  // ====================================================

  useEffect(() => {

    if (loading) {
      return;
    }


    const firstSegment =
      segments[0];


    const publicRoute =
      isPublicPreAccountRoute(
        firstSegment
      );


    // Purpose:
    // Signed-out users may use Login, Signup, Splash,
    // and the complete onboarding flow.
    //
    // Only actual private application screens require
    // an authenticated session.
    if (
      !session &&
      !publicRoute
    ) {

      router.replace(
        '/login'
      );

      return;
    }


    // IMPORTANT:
    //
    // Do NOT automatically redirect a signed-in user
    // away from Login or onboarding here.
    //
    // Doing that caused persisted Preview-build sessions
    // to skip the onboarding / ID / Kids screens entirely.

  }, [
    session,
    loading,
    segments,
    router,
  ]);


  return (

    <AuthContext.Provider
      value={{
        session,
        loading,
      }}
    >

      {children}

    </AuthContext.Provider>
  );
}


// Purpose:
// Gives screens access to the current Supabase session
// and authentication loading state.
export const useAuth =
  () =>
    useContext(
      AuthContext
    );
