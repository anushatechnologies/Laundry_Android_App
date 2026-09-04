import { getAuth, signInWithPhoneNumber, signOut, type ConfirmationResult } from '@react-native-firebase/auth';

let pendingConfirmation: ConfirmationResult | null = null;

function normaliseIndianPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.slice(-10);
}

function friendlyFirebaseError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const msg = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  console.error('[Firebase Phone Auth Error]', code, msg, error);

  if (code.includes('invalid-phone-number')) return 'Enter a valid 10-digit Indian mobile number.';
  if (code.includes('too-many-requests')) return 'Too many OTP attempts. Please wait a few minutes and try again.';
  if (code.includes('quota-exceeded')) return 'Firebase SMS quota is currently exhausted. Please try again later.';
  if (code.includes('invalid-verification-code')) return 'That 6-digit verification code is incorrect. Please check and try again.';
  if (code.includes('session-expired')) return 'This verification code has expired. Please tap Resend Code.';
  if (code.includes('app-not-authorized')) return 'This app is not authorized for Firebase Phone Auth. Check the Firebase Android package and SHA-1 certificate settings.';
  if (code.includes('missing-client-identifier')) return 'Firebase app verification failed. Confirm Phone sign-in is enabled in Firebase Console.';
  if (code.includes('network-request-failed')) return 'Network error. Please check your internet connection and try again.';
  if (msg) return msg;
  return 'Firebase could not complete phone verification. Please try again.';
}

/** Sends Firebase's native Android Phone Auth SMS. This requires a development or production build. */
export async function requestFirebasePhoneOtp(phone: string) {
  const normalized = normaliseIndianPhone(phone);
  if (normalized.length !== 10) throw new Error('Enter a valid 10-digit Indian mobile number.');

  // A new request invalidates any previous in-memory challenge. Never let an
  // old challenge be verified after a failed or repeated resend attempt.
  pendingConfirmation = null;

  try {
    const auth = getAuth();
    console.log('[Firebase Phone Auth] Requesting native SMS verification for +91' + normalized);
    pendingConfirmation = await signInWithPhoneNumber(auth, `+91${normalized}`);
    console.log('[Firebase Phone Auth] SMS verification code sent via Google Firebase SMS Gateway!');
  } catch (error) {
    pendingConfirmation = null;
    throw new Error(friendlyFirebaseError(error));
  }
}

/** Confirms the native Firebase challenge and returns a Firebase ID token for the backend to verify. */
export async function confirmFirebasePhoneOtp(otp: string) {
  if (!pendingConfirmation) throw new Error('No pending Firebase verification. Please request a new code.');
  const code = otp.replace(/\D/g, '');
  if (code.length !== 6) throw new Error('Enter the complete 6-digit Firebase verification code.');

  try {
    const credential = await pendingConfirmation.confirm(code);
    pendingConfirmation = null;
    const idToken = await credential.user.getIdToken();
    const phone = normaliseIndianPhone(credential.user.phoneNumber || '');
    console.log('[Firebase Phone Auth] Successfully verified OTP code with Firebase! ID Token obtained.');
    return { idToken, phone };
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
