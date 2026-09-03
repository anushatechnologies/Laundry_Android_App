import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { requestFirebasePhoneOtp } from '@/lib/firebase-phone-auth';
import { COLORS } from '@/ui/theme';

const brandLogo = require('../../assets/brand-logo.png');

interface AuthScreenProps {
  reason?: 'ACCOUNT' | 'CHECKOUT';
  onBack?: () => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'OTP';

function normalisePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.slice(-10);
}

export function AuthScreen({ reason = 'ACCOUNT', onBack }: AuthScreenProps) {
  const { signIn } = useApp();

  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Unregistered user popup modal
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);

  // Resend OTP countdown timer
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (mode === 'OTP' && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [mode, countdown]);

  // Tab switch animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: mode === 'LOGIN' ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [mode]);

  // Button press animation
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  // Handle Login Submit (100% Pure Firebase Phone Auth)
  const handleLoginSubmit = async () => {
    const cleanPhone = normalisePhone(phone);
    if (cleanPhone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Check if user is registered
      const check = await api.checkPhone(cleanPhone);

      if (!check.exists) {
        // User not registered: Open Register prompt modal
        setShowNotFoundModal(true);
        setLoading(false);
        return;
      }

      // 2. User exists: Dispatch Phone OTP SMS (Firebase with automatic Backend fallback)
      try {
        await requestFirebasePhoneOtp(cleanPhone);
      } catch (fbErr: any) {
        console.warn('[Auth] Firebase phone auth error, falling back to backend direct SMS OTP:', fbErr?.message);
        await api.sendOtp(cleanPhone);
      }
      setPhone(cleanPhone);
      setMode('OTP');
      setCountdown(30);
      setCanResend(false);
    } catch (err: any) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to send Firebase OTP SMS. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register Submit (100% Pure Firebase Phone Auth)
  const handleRegisterSubmit = async () => {
    const cleanPhone = normalisePhone(phone);
    if (cleanPhone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (name.trim().length < 2) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (email.trim() && !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      try {
        await requestFirebasePhoneOtp(cleanPhone);
      } catch (fbErr: any) {
        console.warn('[Auth] Firebase phone auth error, falling back to backend direct SMS OTP:', fbErr?.message);
        await api.sendOtp(cleanPhone, name.trim() || undefined, email.trim() || undefined);
      }
      setPhone(cleanPhone);
      setMode('OTP');
      setCountdown(30);
      setCanResend(false);
    } catch (err: any) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to send Firebase OTP SMS.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verification
  const handleVerifyOtp = async () => {
    const cleanOtp = otp.replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await signIn(phone, cleanOtp, name.trim() || undefined, email.trim() || undefined);
      // Successful sign in automatically triggers navigation back in App.tsx!
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      try {
        await requestFirebasePhoneOtp(phone);
      } catch (fbErr: any) {
        console.warn('[Auth] Firebase SMS fallback to backend:', fbErr?.message);
        await api.sendOtp(phone, name.trim() || undefined, email.trim() || undefined);
      }
      setCountdown(30);
      setCanResend(false);
      setOtp('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const navigateToRegister = () => {
    setShowNotFoundModal(false);
    setErrorMessage(null);
    setMode('REGISTER');
  };

  return (
    <View style={styles.root}>
      {/* Premium Gradient Header */}
      <LinearGradient
        colors={['#1C0B18', '#3D2134', '#1C0B18']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* Top Navigation Bar */}
        <View style={styles.topNav}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}

          {reason === 'CHECKOUT' && (
            <View style={styles.checkoutBadge}>
              <MaterialCommunityIcons name="shield-lock-outline" size={12} color="#D6B36A" />
              <Text style={styles.checkoutBadgeText}>Secure Checkout</Text>
            </View>
          )}
        </View>

        {/* Brand Identity */}
        <View style={styles.brandSection}>
          <View style={styles.logoCircle}>
            <Image source={brandLogo} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.brandTitle}>LaundryFresh</Text>
          <Text style={styles.brandTagline}>PREMIUM FABRIC CARE</Text>
        </View>

        {/* Tab Switcher (Only for LOGIN/REGISTER, hidden during OTP) */}
        {mode !== 'OTP' && (
          <View style={styles.tabSwitcher}>
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  transform: [{
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 160],
                    }),
                  }],
                },
              ]}
            />
            <Pressable
              style={styles.tabButton}
              onPress={() => { setMode('LOGIN'); setErrorMessage(null); }}
              accessibilityRole="tab"
              accessibilityLabel="Sign In"
            >
              <Text style={[styles.tabText, mode === 'LOGIN' && styles.tabTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={styles.tabButton}
              onPress={() => { setMode('REGISTER'); setErrorMessage(null); }}
              accessibilityRole="tab"
              accessibilityLabel="Register"
            >
              <Text style={[styles.tabText, mode === 'REGISTER' && styles.tabTextActive]}>
                Register
              </Text>
            </Pressable>
          </View>
        )}
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Floating Card Container */}
          <Animated.View
            style={[
              styles.floatingCard,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* STAGE 1: LOGIN */}
            {mode === 'LOGIN' && (
              <View style={styles.formSection}>
                <View style={styles.welcomeHeader}>
                  <MaterialCommunityIcons name="hand-wave" size={28} color="#F97316" />
                  <Text style={styles.formTitle}>Welcome Back</Text>
                </View>
                <Text style={styles.formSubtitle}>
                  Sign in to manage your orders and track pickups
                </Text>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Mobile Phone Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View style={styles.phoneInputContainer}>
                    <View style={styles.countryPrefix}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCode}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="Enter 10-digit mobile"
                      placeholderTextColor="#A3A3A3"
                      keyboardType="number-pad"
                      maxLength={10}
                      value={phone}
                      onChangeText={(val) => {
                        setPhone(val);
                        setErrorMessage(null);
                      }}
                      accessibilityLabel="Mobile number input"
                    />
                  </View>
                </View>

                {/* Continue Button */}
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Pressable
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={handleLoginSubmit}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Send verification code"
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                        <MaterialCommunityIcons name="arrow-right-circle" size={20} color="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                </Animated.View>

                {/* Quick Info Pills */}
                <View style={styles.benefitsRow}>
                  <View style={styles.benefitPill}>
                    <MaterialCommunityIcons name="clock-fast" size={14} color="#10B981" />
                    <Text style={styles.benefitText}>2-Hour Express</Text>
                  </View>
                  <View style={styles.benefitPill}>
                    <MaterialCommunityIcons name="shield-check" size={14} color="#3B82F6" />
                    <Text style={styles.benefitText}>100% Safe</Text>
                  </View>
                  <View style={styles.benefitPill}>
                    <MaterialCommunityIcons name="truck-fast" size={14} color="#F97316" />
                    <Text style={styles.benefitText}>Free Pickup</Text>
                  </View>
                </View>
              </View>
            )}

            {/* STAGE 2: REGISTER */}
            {mode === 'REGISTER' && (
              <View style={styles.formSection}>
                <View style={styles.welcomeHeader}>
                  <MaterialCommunityIcons name="account-plus" size={28} color="#10B981" />
                  <Text style={styles.formTitle}>Create Account</Text>
                </View>
                <Text style={styles.formSubtitle}>
                  Join thousands of happy customers enjoying premium laundry care
                </Text>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Full Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name *</Text>
                  <View style={styles.textInputContainer}>
                    <MaterialCommunityIcons name="account-outline" size={20} color="#8A7A84" />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter your full name"
                      placeholderTextColor="#A3A3A3"
                      value={name}
                      onChangeText={(val) => { setName(val); setErrorMessage(null); }}
                      accessibilityLabel="Full name input"
                    />
                  </View>
                </View>

                {/* Email Address */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>📧 Email Address <Text style={{ color: '#F97316', fontSize: 10 }}>(for order confirmations)</Text></Text>
                  <View style={styles.textInputContainer}>
                    <MaterialCommunityIcons name="email-outline" size={20} color="#8A7A84" />
                    <TextInput
                      style={styles.textInput}
                      placeholder="yourname@gmail.com — receive order emails here"
                      placeholderTextColor="#A3A3A3"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={(val) => { setEmail(val); setErrorMessage(null); }}
                      accessibilityLabel="Email address input"
                    />
                  </View>
                </View>

                {/* Mobile Phone */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Number *</Text>
                  <View style={styles.phoneInputContainer}>
                    <View style={styles.countryPrefix}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCode}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="Enter 10-digit mobile"
                      placeholderTextColor="#A3A3A3"
                      keyboardType="number-pad"
                      maxLength={10}
                      value={phone}
                      onChangeText={(val) => { setPhone(val); setErrorMessage(null); }}
                      accessibilityLabel="Mobile number input"
                    />
                  </View>
                </View>

                {/* Submit Register */}
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Pressable
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={handleRegisterSubmit}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Create account"
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Create Account</Text>
                        <MaterialCommunityIcons name="arrow-right-circle" size={20} color="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                </Animated.View>

                {/* Privacy Note */}
                <Text style={styles.privacyNote}>
                  By continuing, you agree to our Terms of Service and Privacy Policy
                </Text>
              </View>
            )}

            {/* STAGE 3: OTP VERIFICATION */}
            {mode === 'OTP' && (
              <View style={styles.formSection}>
                <View style={styles.otpHeader}>
                  <View style={styles.otpIconCircle}>
                    <MaterialCommunityIcons name="message-text-lock" size={32} color="#F97316" />
                  </View>
                  <Text style={styles.formTitle}>Verify Your Number</Text>
                  <Text style={styles.formSubtitle}>
                    Enter the 6-digit code sent to{'\n'}
                    <Text style={styles.phoneHighlight}>+91 {phone}</Text>
                  </Text>
                </View>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* 6-Digit OTP Input */}
                <View style={styles.otpInputWrapper}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="000000"
                    placeholderTextColor="#C7C7C7"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={(val) => {
                      setOtp(val);
                      setErrorMessage(null);
                    }}
                    autoFocus
                    accessibilityLabel="Enter OTP code"
                  />
                </View>

                {/* Verify Button */}
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Pressable
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={handleVerifyOtp}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Verify OTP"
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Verify & Continue</Text>
                        <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                </Animated.View>

                {/* Resend & Change Actions */}
                <View style={styles.otpActions}>
                  {canResend ? (
                    <Pressable
                      onPress={handleResendOtp}
                      disabled={loading}
                      style={styles.resendBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Resend verification code"
                    >
                      <MaterialCommunityIcons name="refresh" size={16} color="#F97316" />
                      <Text style={styles.resendText}>Resend Code</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.timerRow}>
                      <MaterialCommunityIcons name="timer-sand" size={16} color="#8A7A84" />
                      <Text style={styles.timerText}>
                        Resend in <Text style={styles.timerBold}>{countdown}s</Text>
                      </Text>
                    </View>
                  )}

                  <Pressable
                    onPress={() => {
                      setMode(name ? 'REGISTER' : 'LOGIN');
                      setOtp('');
                      setErrorMessage(null);
                    }}
                    style={styles.changeNumberBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Change phone number"
                  >
                    <MaterialCommunityIcons name="pencil" size={14} color="#8A7A84" />
                    <Text style={styles.changeNumberText}>Change Number</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Trust Badge */}
          <View style={styles.trustBadge}>
            <MaterialCommunityIcons name="shield-lock" size={16} color="#10B981" />
            <Text style={styles.trustText}>
              256-bit Encrypted · Privacy Protected
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- NOT FOUND MODAL: Prompt to Register --- */}
      <Modal visible={showNotFoundModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="account-question-outline" size={36} color="#F97316" />
            </View>

            <Text style={styles.modalTitle}>Account Not Found</Text>
            <Text style={styles.modalSubtitle}>
              We couldn't find an existing account for{' '}
              <Text style={styles.modalPhone}>+91 {phone}</Text>.
            </Text>
            <Text style={styles.modalNote}>
              Would you like to register as a new customer? It takes less than 30 seconds.
            </Text>

            <View style={styles.modalButtons}>
              <Pressable style={styles.modalPrimaryBtn} onPress={navigateToRegister}>
                <Text style={styles.modalPrimaryText}>Create New Account</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
              </Pressable>

              <Pressable
                style={styles.modalSecondaryBtn}
                onPress={() => setShowNotFoundModal(false)}
              >
                <Text style={styles.modalSecondaryText}>Check Mobile Number</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },

  // ==================== GRADIENT HEADER ====================
  gradientHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  checkoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(214, 179, 106, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(214, 179, 106, 0.3)',
  },
  checkoutBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D6B36A',
  },

  // Brand Section
  brandSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(214, 179, 106, 0.3)',
  },
  logo: {
    width: 50,
    height: 50,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D6B36A',
    letterSpacing: 2,
  },

  // Tab Switcher
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    width: 156,
    backgroundColor: '#F97316',
    borderRadius: 12,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // ==================== CONTENT AREA ====================
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Floating Card
  floatingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 20,
  },

  // ==================== FORM SECTIONS ====================
  formSection: {
    width: '100%',
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C0B18',
  },
  formSubtitle: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 19,
    marginBottom: 24,
  },

  // Error Box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    lineHeight: 17,
  },

  // ==================== INPUTS ====================
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C0B18',
    marginBottom: 8,
  },

  // Phone Input
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
  },
  countryPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: '#F3F4F6',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    gap: 6,
  },
  flagEmoji: {
    fontSize: 18,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C0B18',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#1C0B18',
    letterSpacing: 1.5,
  },

  // Text Input
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C0B18',
  },

  // OTP Input
  otpHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  otpIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFEDD5',
  },
  phoneHighlight: {
    fontWeight: '900',
    color: '#F97316',
  },
  otpInputWrapper: {
    marginBottom: 20,
  },
  otpInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#F97316',
    borderRadius: 20,
    paddingVertical: 18,
    fontSize: 28,
    fontWeight: '900',
    color: '#1C0B18',
    textAlign: 'center',
    letterSpacing: 12,
  },

  // ==================== BUTTONS ====================
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Benefits Pills (Login Only)
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 8,
  },
  benefitPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  benefitText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },

  // Privacy Note (Register Only)
  privacyNote: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },

  // OTP Actions
  otpActions: {
    marginTop: 20,
    alignItems: 'center',
    gap: 14,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F97316',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 13,
    color: '#6B7280',
  },
  timerBold: {
    fontWeight: '800',
    color: '#1C0B18',
  },
  changeNumberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
  },
  changeNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  // ==================== TRUST BADGE ====================
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  trustText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },

  // ==================== MODAL (Not Found) ====================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#FFEDD5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1C0B18',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalPhone: {
    fontWeight: '800',
    color: '#F97316',
  },
  modalNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
    lineHeight: 17,
  },
  modalButtons: {
    width: '100%',
    gap: 12,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSecondaryBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  modalSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
});
