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
  if (code.includes('missing-client-identifier') || code.includes('app-not-authorized')) {
    return 'Firebase app verification failed. Please add this number under Firebase Console > Authentication > Phone numbers for testing (optional).';
  }
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

  const auth = getAuth();
  // Ensure app verification is active for real SMS delivery
  auth.settings.appVerificationDisabledForTesting = false;

  try {
    console.log('[Firebase Phone Auth] Requesting native SMS verification for +91' + normalized);
    pendingConfirmation = await signInWithPhoneNumber(auth, `+91${normalized}`);
    console.log('[Firebase Phone Auth] SMS verification code sent via Google Firebase SMS Gateway!');
  } catch (error: any) {
    const code = String(error?.code || '');
    console.warn('[Firebase Phone Auth] Initial dispatch error code:', code, error);

    // If Play Integrity verification failed on this sideloaded APK, check if it's a test number
    if (code.includes('missing-client-identifier') || code.includes('app-not-authorized')) {
      try {
        console.log('[Firebase Phone Auth] Testing fallback with appVerificationDisabledForTesting = true...');
        auth.settings.appVerificationDisabledForTesting = true;
        pendingConfirmation = await signInWithPhoneNumber(auth, `+91${normalized}`);
        console.log('[Firebase Phone Auth] Verification code sent in testing mode!');
        return;
      } catch (retryErr: any) {
        console.error('[Firebase Phone Auth] Testing retry error:', retryErr);
        pendingConfirmation = null;
        // Reset flag
        auth.settings.appVerificationDisabledForTesting = false;
        throw new Error(
          'Firebase SMS verification failed for real mobile numbers.\n\n' +
          'MAIN ISSUE:\n' +
          'Google requires your Android app SHA-256 fingerprint in Firebase Console to allow real SMS.\n\n' +
          'QUICK FIX (1 MINUTE):\n' +
          '1. Open Firebase Console -> Project Settings -> General\n' +
          '2. Under "Your apps", select com.anusha.laundry\n' +
          '3. Click "Add fingerprint" and paste SHA-256:\n' +
          '   FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C\n' +
          '4. Enable "Play Integrity API" in Google Cloud Console.\n\n' +
          'For instant testing, enter your Firebase Console test phone number.'
        );
      }
    }

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
