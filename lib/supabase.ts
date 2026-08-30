import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createClient } from '@supabase/supabase-js';


// ======================================================
// MAIN SUPABASE PROJECT
// ======================================================
//
// This remains your normal Mission Trail database,
// authentication, storage, etc.
//
// ======================================================

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;


// ======================================================
// ID VERIFICATION SUPABASE PROJECT
// ======================================================
//
// This second Supabase project contains:
//
// verify-onboarding-id
//
// It is intentionally separate from the main database.
//
// ======================================================

const idVerifySupabaseUrl =
  process.env.EXPO_PUBLIC_ID_VERIFY_SUPABASE_URL;

const idVerifySupabaseAnonKey =
  process.env.EXPO_PUBLIC_ID_VERIFY_SUPABASE_ANON_KEY;


// ======================================================
// VALIDATE MAIN SUPABASE ENVIRONMENT
// ======================================================

if (
  !supabaseUrl ||
  !supabaseAnonKey
) {
  throw new Error(
    'Missing main Supabase environment variables'
  );
}


// ======================================================
// VALIDATE ID VERIFICATION ENVIRONMENT
// ======================================================

if (
  !idVerifySupabaseUrl ||
  !idVerifySupabaseAnonKey
) {
  console.warn(
    'ID verification Supabase is not configured. ID verification will be unavailable.'
  );
}


// ======================================================
// MAIN SUPABASE CLIENT
// ======================================================
//
// KEEP USING THIS:
//
// import { supabase } from '../../lib/supabase';
//
// for your normal database, authentication, storage,
// and other Mission Trail functionality.
//
// ======================================================

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {

      // ==================================================
      // FIX FOR EXPO WEB + MOBILE
      // ==================================================

      storage:
        typeof window !== 'undefined'
          ? AsyncStorage
          : undefined,

      // ==================================================
      // AUTO REFRESH LOGIN TOKEN
      // ==================================================

      autoRefreshToken: true,

      // ==================================================
      // SAVE LOGIN SESSION
      // ==================================================

      persistSession: true,

      // ==================================================
      // REQUIRED FOR EXPO
      // ==================================================

      detectSessionInUrl: false,
    },
  }
);


// ======================================================
// ID VERIFICATION SUPABASE CLIENT
// ======================================================
//
// IMPORTANT:
//
// This client ONLY talks to the Supabase project that
// contains the verify-onboarding-id Edge Function.
//
// This does NOT replace the main Supabase client.
//
// ID verification happens BEFORE account creation,
// so this client does not need to persist a user session.
//
// ======================================================

export const idVerifySupabase =
  idVerifySupabaseUrl && idVerifySupabaseAnonKey
    ? createClient(
        idVerifySupabaseUrl,
        idVerifySupabaseAnonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      )
    : null;