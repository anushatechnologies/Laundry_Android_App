import { getAuth, signInWithPhoneNumber, signOut, type ConfirmationResult } from '@react-native-firebase/auth';

let pendingConfirmation: ConfirmationResult | null = null;

function normaliseIndianPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.slice(-10);
}

function friendlyFirebaseError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('invalid-phone-number')) return 'Enter a valid Indian mobile number.';
  if (code.includes('too-many-requests')) return 'Too many OTP attempts. Please wait a little and try again.';
  if (code.includes('quota-exceeded')) return 'Firebase SMS quota is currently unavailable. Please try again later.';
  if (code.includes('invalid-verification-code')) return 'That verification code is incorrect. Please try again.';
  if (code.includes('session-expired')) return 'This verification code has expired. Request a new one.';
  if (code.includes('app-not-authorized')) return 'This app is not authorized for Firebase Phone Auth. Check the Firebase Android package and SHA certificate settings.';
  if (code.includes('missing-client-identifier')) return 'Firebase app verification failed. Confirm Phone sign-in is enabled, use the refreshed Firebase configuration, and check the API key app-verification settings.';
  return 'Firebase could not complete phone verification. Please try again.';
}

/** Sends Firebase's native Android Phone Auth SMS. This requires a development or production build. */
export async function requestFirebasePhoneOtp(phone: string) {
  const normalized = normaliseIndianPhone(phone);
  if (normalized.length !== 10) throw new Error('Enter a valid 10-digit Indian mobile number.');

  try {
    pendingConfirmation = await signInWithPhoneNumber(getAuth(), `+91${normalized}`);
  } catch (error) {
    throw new Error(friendlyFirebaseError(error));
  }
}

/** Confirms the native Firebase challenge and returns a Firebase ID token for the backend to verify. */
export async function confirmFirebasePhoneOtp(otp: string) {
  if (!pendingConfirmation) throw new Error('Request a Firebase verification code before continuing.');
  const code = otp.replace(/\D/g, '');
  if (code.length !== 6) throw new Error('Enter the six-digit Firebase verification code.');

  try {
    const credential = await pendingConfirmation.confirm(code);
    pendingConfirmation = null;
    return {
      idToken: await credential.user.getIdToken(),
      phone: normaliseIndianPhone(credential.user.phoneNumber || ''),
    };
  } catch (error) {
    throw new Error(friendlyFirebaseError(error));
  }
}

export async function signOutFirebasePhoneAuth() {
  pendingConfirmation = null;
  try {
    await signOut(getAuth());
  } catch {
    // This can happen on a clean install before Firebase has a signed-in user.
  }
}
