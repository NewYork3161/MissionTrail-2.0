// ======================================================
// MISSION TRAILS ACCOUNT ACCESS SERVICE
// ======================================================
//
// Purpose:
// Loads the signed-in user's Mission Trails access mode
// from Supabase and converts it into simple permissions
// the app can safely use.
//
// Protected features:
// - Trails
// - Meetups
//
// Only ID-verified accounts unlock protected features.
//
// ======================================================

import { supabase } from '../../lib/supabase';


// ======================================================
// TYPES
// ======================================================

export type AccountAccessMode =
  | 'pending'
  | 'verified'
  | 'kids';

export type IdVerificationStatus =
  | 'pending'
  | 'verified'
  | 'skipped_kids';


export type AccountAccessState = {
  mode: AccountAccessMode;

  idVerificationStatus:
    IdVerificationStatus;

  idVerifiedAt:
    string | null;

  isVerified:
    boolean;

  isKidsMode:
    boolean;

  canUseTrails:
    boolean;

  canUseMeetups:
    boolean;
};


// ======================================================
// NORMALIZE ACCESS MODE
// ======================================================

// Purpose:
// Converts an unknown database value into a safe
// Mission Trails account access mode.
function normalizeAccountAccessMode(
  value: unknown
): AccountAccessMode {

  if (value === 'verified') {
    return 'verified';
  }

  if (value === 'kids') {
    return 'kids';
  }

  return 'pending';
}


// ======================================================
// NORMALIZE ID STATUS
// ======================================================

// Purpose:
// Converts an unknown database value into a safe
// ID verification status used by Mission Trails.
function normalizeIdVerificationStatus(
  value: unknown
): IdVerificationStatus {

  if (value === 'verified') {
    return 'verified';
  }

  if (value === 'skipped_kids') {
    return 'skipped_kids';
  }

  return 'pending';
}


// ======================================================
// BUILD ACCESS STATE
// ======================================================

// Purpose:
// Turns the stored access mode into simple feature
// permissions used throughout the app.
function buildAccountAccessState(
  mode: AccountAccessMode,
  idVerificationStatus:
    IdVerificationStatus,
  idVerifiedAt:
    string | null
): AccountAccessState {

  const isVerified =
    mode === 'verified' &&
    idVerificationStatus ===
      'verified';

  const isKidsMode =
    mode === 'kids';

  return {
    mode,

    idVerificationStatus,

    idVerifiedAt,

    isVerified,

    isKidsMode,

    canUseTrails:
      isVerified,

    canUseMeetups:
      isVerified,
  };
}


// ======================================================
// LOAD ACCOUNT ACCESS
// ======================================================

// Purpose:
// Loads the current signed-in user's account access
// record from user_onboarding.
//
// Existing accounts without an onboarding row are treated
// as pending so protected features remain locked safely.
export async function getAccountAccessState():
Promise<AccountAccessState> {

  // Purpose:
  // Gets the authenticated user whose permissions
  // should be checked.
  const {
    data: {
      user,
    },
    error: userError,
  } =
    await supabase.auth.getUser();


  if (userError) {
    throw userError;
  }


  if (!user) {
    throw new Error(
      'SIGNED_OUT'
    );
  }


  // Purpose:
  // Reads only the access fields needed to decide
  // whether protected features should be available.
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'user_onboarding'
      )
      // Purpose:
      // Uses a literal Supabase select string so TypeScript
      // can understand the exact columns returned.
      .select(
        'account_access_mode, id_verification_status, id_verified_at'
      )
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle();


  if (error) {
    throw error;
  }


  // Purpose:
  // Safely defaults older accounts without an
  // onboarding record to pending access.
  if (!data) {

    return buildAccountAccessState(
      'pending',
      'pending',
      null
    );
  }


  const mode =
    normalizeAccountAccessMode(
      data.account_access_mode
    );


  const idVerificationStatus =
    normalizeIdVerificationStatus(
      data.id_verification_status
    );


  const idVerifiedAt =
    typeof data.id_verified_at ===
      'string'
      ? data.id_verified_at
      : null;


  return buildAccountAccessState(
    mode,
    idVerificationStatus,
    idVerifiedAt
  );
}
