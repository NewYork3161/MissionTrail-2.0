// ======================================================
// ONBOARDING VERIFICATION TICKET SERVICE
// ======================================================
//
// Purpose:
// Temporarily stores the one-time ticket issued after
// successful ID information matching.
//
// Native devices use Expo SecureStore.
// Web keeps the ticket in memory only.
//
// The ticket is never placed in Expo Router parameters.
//
// ======================================================

import { Platform } from 'react-native';


const VERIFICATION_TICKET_KEY =
  'missiontrails.onboardingVerificationTicket';


// Purpose:
// Uses a slightly shorter lifetime than the server's
// 15-minute verification ticket expiration.
const CLIENT_TICKET_MAX_AGE_MS =
  14 * 60 * 1000;


type StoredVerificationTicket = {
  ticket: string;
  savedAt: number;
};


// Purpose:
// Temporarily holds the ticket on web.
// Refreshing the browser intentionally clears it.
let webVerificationTicket:
  StoredVerificationTicket | null =
  null;


// Purpose:
// Saves a freshly-issued verification ticket until
// account creation consumes it.
export async function saveOnboardingVerificationTicket(
  ticket: string,
): Promise<void> {

  const cleanedTicket =
    ticket.trim();

  if (!cleanedTicket) {
    throw new Error(
      'Verification ticket is missing.',
    );
  }

  const value: StoredVerificationTicket = {
    ticket: cleanedTicket,
    savedAt: Date.now(),
  };

  if (Platform.OS === 'web') {
    webVerificationTicket = value;
    return;
  }

  const SecureStore =
    await import('expo-secure-store');

  await SecureStore.setItemAsync(
    VERIFICATION_TICKET_KEY,
    JSON.stringify(value),
  );
}


// Purpose:
// Removes a verification ticket after successful signup,
// Kids Mode selection, expiration, or abandonment.
export async function clearOnboardingVerificationTicket():
Promise<void> {

  if (Platform.OS === 'web') {
    webVerificationTicket = null;
    return;
  }

  const SecureStore =
    await import('expo-secure-store');

  await SecureStore.deleteItemAsync(
    VERIFICATION_TICKET_KEY,
  );
}


// Purpose:
// Returns the temporary ticket only while it is still
// inside the allowed client-side lifetime.
export async function getOnboardingVerificationTicket():
Promise<string | null> {

  let value:
    StoredVerificationTicket | null =
    null;

  if (Platform.OS === 'web') {

    value =
      webVerificationTicket;

  } else {

    const SecureStore =
      await import('expo-secure-store');

    const raw =
      await SecureStore.getItemAsync(
        VERIFICATION_TICKET_KEY,
      );

    if (raw) {
      try {
        value =
          JSON.parse(raw) as StoredVerificationTicket;
      } catch {
        await clearOnboardingVerificationTicket();
        return null;
      }
    }
  }

  if (
    !value ||
    typeof value.ticket !== 'string' ||
    typeof value.savedAt !== 'number'
  ) {
    return null;
  }

  const age =
    Date.now() - value.savedAt;

  if (
    age < 0 ||
    age > CLIENT_TICKET_MAX_AGE_MS
  ) {
    await clearOnboardingVerificationTicket();
    return null;
  }

  return value.ticket;
}
