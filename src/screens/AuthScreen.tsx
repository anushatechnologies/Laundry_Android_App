import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import { validateEmail } from '@/lib/validation';

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
  const { colors, isDark } = useTheme();
  const { signIn, requestOtp, saveAddress } = useApp();

  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [autoDetectedReferral, setAutoDetectedReferral] = useState(false);
  const [detectedBonus, setDetectedBonus] = useState(25);
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Unregistered user 3-second redirect toast
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const cancelRedirect = useCallback(() => {
    if (redirectTimerRef.current) {
      clearInterval(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setRedirectCountdown(null);
    });
  }, [toastAnim]);

  const goToRegisterNow = useCallback(() => {
    if (redirectTimerRef.current) {
      clearInterval(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setRedirectCountdown(null);
      setErrorMessage(null);
      setMode('REGISTER');
    });
  }, [toastAnim]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
      }
    };
  }, []);

  // Resend OTP countdown timer
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Tab layout width for responsive slide animation
  const [switcherWidth, setSwitcherWidth] = useState(320);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Load remembered phone & auto-detect referral code on install
  useEffect(() => {
    let isMounted = true;
    const initAuthData = async () => {
      try {
        // Load remembered phone number
        const remembered = await AsyncStorage.getItem('@remembered_phone');
        if (remembered && isMounted) {
          setPhone(remembered);
        }

        // 1. Check local pending referral from deep link
        const localCode = await AsyncStorage.getItem('@pending_referral_code');
        if (localCode && localCode.trim().length > 0 && isMounted) {
          setReferralCode(localCode.trim().toUpperCase());
          setAutoDetectedReferral(true);
          return;
        }

        // 2. Query backend deferred deep link (IP matching from APK download click)
        const detection = await api.detectReferralInstall();
        if (detection.detected && detection.referralCode && isMounted) {
          const clean = detection.referralCode.trim().toUpperCase();
          setReferralCode(clean);
          if (detection.bonus) {
            setDetectedBonus(detection.bonus);
          }
          setAutoDetectedReferral(true);
          await AsyncStorage.setItem('@pending_referral_code', clean);
        }
      } catch {
        // Ignored
      }
    };

    initAuthData();
    return () => {
      isMounted = false;
    };
  }, []);

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
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: mode === 'LOGIN' ? 0 : 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  }, [mode]);

  // Button press animation
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
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

  // Login submission
  const handleLoginSubmit = async () => {
    const cleanPhone = normalisePhone(phone);
    if (cleanPhone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Remember me handling
      if (rememberMe) {
        await AsyncStorage.setItem('@remembered_phone', cleanPhone).catch(() => {});
      } else {
        await AsyncStorage.removeItem('@remembered_phone').catch(() => {});
      }

      // 1. Check if user is registered
      const check = await api.checkPhone(cleanPhone);

      if (!check.exists) {
        // User not registered: start 3s toast and auto-redirect to Register page
        setLoading(false);
        setPhone(cleanPhone);
        if (redirectTimerRef.current) {
          clearInterval(redirectTimerRef.current);
          redirectTimerRef.current = null;
        }

        let secondsLeft = 3;
        setRedirectCountdown(secondsLeft);
        toastAnim.setValue(0);
        Animated.spring(toastAnim, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }).start();

        redirectTimerRef.current = setInterval(() => {
          secondsLeft -= 1;
          if (secondsLeft <= 0) {
            if (redirectTimerRef.current) {
              clearInterval(redirectTimerRef.current);
              redirectTimerRef.current = null;
            }
            Animated.timing(toastAnim, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              setRedirectCountdown(null);
              setMode('REGISTER');
              setErrorMessage(null);
            });
          } else {
            setRedirectCountdown(secondsLeft);
          }
        }, 1000);

        return;
      }

      // 2. User exists: Firebase sends the verification code.
      await requestOtp(cleanPhone);

      setPhone(cleanPhone);
      setMode('OTP');
      setCountdown(30);
      setCanResend(false);
    } catch (err: any) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not send verification code via SMS. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Register submission
  const handleRegisterSubmit = async () => {
    const cleanPhone = normalisePhone(phone);
    if (cleanPhone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (name.trim().length < 2) {
      setErrorMessage('Please enter your full name (letters only).');
      return;
    }
    // Name validation - check if it contains only letters, spaces, dots, hyphens
    if (!/^[a-zA-Z\s.\-]+$/.test(name.trim())) {
      setErrorMessage('Name should only contain letters, spaces, dots, and hyphens.');
      return;
    }
    if (email.trim()) {
      const emailCheck = validateEmail(email.trim());
      if (!emailCheck.isValid) {
        setErrorMessage(emailCheck.error || 'Please enter a valid email address (e.g. yourname@gmail.com).');
        return;
      }
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Check if phone number already exists
      const check = await api.checkPhone(cleanPhone);

      if (check.exists) {
        setErrorMessage('This phone number is already registered. Please use Sign In instead.');
        setLoading(false);
        return;
      }

      // Save delivery address to pending storage if provided
      if (deliveryAddress.trim()) {
        await AsyncStorage.setItem('@pending_signup_address', deliveryAddress.trim()).catch(() => {});
      }

      // 2. Phone available - proceed with OTP
      await requestOtp(
        cleanPhone,
        name.trim(),
        email.trim() || undefined,
        referralCode.trim().toUpperCase() || undefined,
      );

      setPhone(cleanPhone);
      setMode('OTP');
      setCountdown(30);
      setCanResend(false);
    } catch (err: any) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not send verification code via SMS. Please try again.');
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
      await signIn(
        cleanOtp,
        name.trim() || undefined,
        email.trim() || undefined,
        referralCode.trim().toUpperCase() || undefined,
      );
      await AsyncStorage.removeItem('@pending_referral_code').catch(() => {});

      // If pending delivery address was provided during register, save it
      try {
        const pendingAddr = await AsyncStorage.getItem('@pending_signup_address');
        if (pendingAddr && pendingAddr.trim()) {
          await saveAddress({
            type: 'Home',
            street: pendingAddr.trim(),
            city: 'Hyderabad',
            pincode: '500001',
            isDefault: true,
          }).catch(() => {});
          await AsyncStorage.removeItem('@pending_signup_address').catch(() => {});
        }
      } catch {
        // Ignored
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Firebase resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      await requestOtp(phone);
      setCountdown(30);
      setCanResend(false);
      setOtp('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password?',
      'LaundryFresh uses high-security SMS OTP verification for passwordless instant sign in. Simply enter your mobile number and tap Login to verify.',
      [{ text: 'Got It', style: 'default' }]
    );
  };

  const handleGoogleSignIn = () => {
    Alert.alert(
      'Google Sign In',
      'For seamless order updates and delivery notifications, please enter your mobile number to sign in with secure SMS verification.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const navigateToRegister = () => {
    cancelRedirect();
    setErrorMessage(null);
    setMode('REGISTER');
  };

  const tabWidth = Math.max(120, (switcherWidth - 8) / 2);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Premium Fresh Green Ambient Header */}
      <LinearGradient
        colors={isDark ? ['#161F30', '#111827', '#0B0F17'] : ['#DCFCE7', '#E8F5E9', '#F0FDF4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* Top Navigation Bar */}
        <View style={styles.topNav}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={[styles.backBtn, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={isDark ? colors.textHeading : '#0F172A'} />
            </Pressable>
          ) : (
            <View style={{ width: 42 }} />
          )}

          {reason === 'CHECKOUT' ? (
            <View style={[styles.checkoutBadge, isDark && { backgroundColor: 'rgba(22, 163, 74, 0.15)', borderColor: 'rgba(22, 163, 74, 0.3)' }]}>
              <MaterialCommunityIcons name="shield-lock-outline" size={14} color="#16A34A" />
              <Text style={styles.checkoutBadgeText}>Secure Checkout</Text>
            </View>
          ) : (
            <View style={styles.headerRightPlaceholder} />
          )}
        </View>

        {/* Brand Identity with Mint Gradient Glow */}
        <View style={styles.brandSection}>
          <View style={[styles.glowOuterCircle, isDark && { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]}>
            <View style={[styles.logoCircle, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Image source={brandLogo} style={styles.logo} resizeMode="contain" />
            </View>
          </View>
          <Text style={[styles.brandTitle, isDark && { color: colors.textHeading }]}>LaundryFresh</Text>
          <View style={[styles.taglineBadge, isDark && { backgroundColor: colors.section }]}>
            <Text style={[styles.brandTagline, isDark && { color: '#4ADE80' }]}>PREMIUM FABRIC CARE</Text>
          </View>
        </View>

        {/* Tab Switcher (Only for LOGIN/REGISTER, hidden during OTP) */}
        {mode !== 'OTP' && (
          <View
            style={[styles.tabSwitcher, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}
            onLayout={(e) => {
              const { width } = e.nativeEvent.layout;
              if (width > 0) setSwitcherWidth(width);
            }}
          >
            <Animated.View
              style={[
                styles.tabIndicatorWrapper,
                {
                  width: tabWidth,
                  transform: [
                    {
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, tabWidth],
                      }),
                    },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={['#16A34A', '#10B981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tabIndicatorGradient}
              />
            </Animated.View>

            <Pressable
              style={styles.tabButton}
              onPress={() => {
                cancelRedirect();
                setMode('LOGIN');
                setErrorMessage(null);
              }}
              accessibilityRole="tab"
              accessibilityLabel="Login"
            >
              <Text style={[styles.tabText, isDark && { color: colors.textCaption }, mode === 'LOGIN' && styles.tabTextActive]}>
                Sign In
              </Text>
            </Pressable>

            <Pressable
              style={styles.tabButton}
              onPress={() => {
                cancelRedirect();
                setMode('REGISTER');
                setErrorMessage(null);
              }}
              accessibilityRole="tab"
              accessibilityLabel="Register"
            >
              <Text style={[styles.tabText, isDark && { color: colors.textCaption }, mode === 'REGISTER' && styles.tabTextActive]}>
                Register
              </Text>
            </Pressable>
          </View>
        )}
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main White Rounded Card */}
          <Animated.View
            style={[
              styles.floatingCard,
              isDark && { backgroundColor: colors.surface, borderColor: colors.border },
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* STAGE 1: LOGIN */}
            {mode === 'LOGIN' && (
              <View style={styles.formSection}>
                <View style={styles.headerTextRow}>
                  <Text style={[styles.formTitle, isDark && { color: colors.textHeading }]}>Welcome Back!</Text>
                </View>
                <Text style={[styles.formSubtitle, isDark && { color: colors.textCaption }]}>
                  Sign in to manage your orders and track your pickups.
                </Text>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Mobile Phone Input with +91 Selector */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark && { color: colors.textHeading }]}>Mobile Number *</Text>
                  <View style={[styles.phoneInputContainer, isDark && { backgroundColor: colors.section, borderColor: colors.border }]}>
                    <View style={[styles.countryPrefix, isDark && { backgroundColor: colors.background, borderRightColor: colors.border }]}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={[styles.countryCode, isDark && { color: colors.textHeading }]}>+91</Text>
                    </View>
                    <TextInput
                      style={[styles.phoneInput, isDark && { color: colors.textHeading }]}
                      placeholder="Enter 10-digit mobile"
                      placeholderTextColor={isDark ? colors.textCaption : '#94A3B8'}
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

                {/* Pure Firebase Phone OTP Notice */}
                <View style={[styles.otpNoticeRow, isDark && { backgroundColor: 'rgba(22, 163, 74, 0.12)', borderColor: 'rgba(22, 163, 74, 0.25)' }]}>
                  <MaterialCommunityIcons name="shield-check" size={18} color="#16A34A" />
                  <Text style={[styles.otpNoticeText, isDark && { color: '#86EFAC' }]}>
                    Instant sign in with Firebase SMS verification. No password needed!
                  </Text>
                </View>

                {/* Main CTA: Green Gradient #16A34A -> #10B981 */}
                <Animated.View style={{ transform: [{ scale: scaleAnim }], marginTop: 10 }}>
                  <Pressable
                    onPress={handleLoginSubmit}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Login with OTP"
                  >
                    <LinearGradient
                      colors={['#16A34A', '#10B981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.primaryGradientBtn, loading && styles.btnDisabled]}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Login with OTP →</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                {/* Bottom Switch Link */}
                <View style={styles.bottomSwitchRow}>
                  <Text style={[styles.bottomSwitchMuted, isDark && { color: colors.textCaption }]}>Don't have an account? </Text>
                  <Pressable
                    onPress={() => {
                      cancelRedirect();
                      setMode('REGISTER');
                      setErrorMessage(null);
                    }}
                  >
                    <Text style={styles.bottomSwitchAction}>Register</Text>
                  </Pressable>
                </View>

                {/* Quick Info Benefits */}
                <View style={styles.benefitsRow}>
                  <View style={[styles.benefitPill, isDark && { backgroundColor: colors.section, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="clock-fast" size={14} color="#16A34A" />
                    <Text style={[styles.benefitText, isDark && { color: '#86EFAC' }]}>2-Hour Express</Text>
                  </View>
                  <View style={[styles.benefitPill, isDark && { backgroundColor: colors.section, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="shield-check" size={14} color="#10B981" />
                    <Text style={[styles.benefitText, isDark && { color: '#86EFAC' }]}>100% Safe</Text>
                  </View>
                  <View style={[styles.benefitPill, isDark && { backgroundColor: colors.section, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="truck-fast" size={14} color="#16A34A" />
                    <Text style={[styles.benefitText, isDark && { color: '#86EFAC' }]}>Free Pickup</Text>
                  </View>
                </View>
              </View>
            )}

            {/* STAGE 2: REGISTER */}
            {mode === 'REGISTER' && (
              <View style={styles.formSection}>
                <View style={styles.headerTextRow}>
                  <Text style={[styles.formTitle, isDark && { color: colors.textHeading }]}>Create Your Account</Text>
                </View>
                <Text style={[styles.formSubtitle, isDark && { color: colors.textCaption }]}>
                  Join thousands of happy customers enjoying fresh, premium laundry care.
                </Text>

                {errorMessage && (
                  <View
                    style={[
                      styles.errorBox,
                      errorMessage.includes('already registered') && {
                        backgroundColor: '#FEF3C7',
                        borderLeftColor: '#F59E0B',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={errorMessage.includes('already registered') ? 'information' : 'alert-circle'}
                      size={18}
                      color={errorMessage.includes('already registered') ? '#F59E0B' : '#EF4444'}
                    />
                    <Text
                      style={[
                        styles.errorText,
                        errorMessage.includes('already registered') && { color: '#92400E' },
                      ]}
                    >
                      {errorMessage}
                    </Text>
                  </View>
                )}

                {errorMessage?.includes('already registered') && (
                  <Pressable
                    onPress={() => {
                      setMode('LOGIN');
                      setErrorMessage(null);
                    }}
                    style={styles.switchToSignInBtn}
                  >
                    <MaterialCommunityIcons name="login" size={18} color="#16A34A" />
                    <Text style={styles.switchToSignInText}>Switch to Sign In</Text>
                  </Pressable>
                )}

                {/* 1. Full Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark && { color: colors.textHeading }]}>Full Name *</Text>
                  <View style={[styles.textInputContainer, isDark && { backgroundColor: colors.section, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="account-outline" size={20} color={isDark ? colors.textCaption : "#64748B"} />
                    <TextInput
                      style={[styles.textInput, isDark && { color: colors.textHeading }]}
                      placeholder="Enter your full name"
                      placeholderTextColor={isDark ? colors.textCaption : "#94A3B8"}
                      value={name}
                      onChangeText={(val) => {
                        const filtered = val.replace(/[^a-zA-Z\s.\-]/g, '');
                        setName(filtered);
                        setErrorMessage(null);
                      }}
                      accessibilityLabel="Full name input"
                    />
                  </View>
                </View>

                {/* 2. Mobile Phone */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark && { color: colors.textHeading }]}>Mobile Number *</Text>
                  <View style={[styles.phoneInputContainer, isDark && { backgroundColor: colors.section, borderColor: colors.border }]}>
                    <View style={[styles.countryPrefix, isDark && { backgroundColor: colors.background, borderRightColor: colors.border }]}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={[styles.countryCode, isDark && { color: colors.textHeading }]}>+91</Text>
                    </View>
                    <TextInput
                      style={[styles.phoneInput, isDark && { color: colors.textHeading }]}
                      placeholder="Enter 10-digit mobile"
                      placeholderTextColor={isDark ? colors.textCaption : "#94A3B8"}
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

                {/* 3. Email Address */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark && { color: colors.textHeading }]}>
                    Email Address{' '}
                    <Text style={{ color: '#16A34A', fontSize: 11 }}>(for order confirmations)</Text>
                  </Text>
                  <View style={[styles.textInputContainer, isDark && { backgroundColor: colors.section, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="email-outline" size={20} color={isDark ? colors.textCaption : "#64748B"} />
                    <TextInput
                      style={[styles.textInput, isDark && { color: colors.textHeading }]}
                      placeholder="yourname@gmail.com"
                      placeholderTextColor={isDark ? colors.textCaption : "#94A3B8"}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={email}
                      onChangeText={(val) => {
                        setEmail(val);
                        setErrorMessage(null);
                      }}
                      accessibilityLabel="Email address input"
                    />
                    {email.length > 0 && (
                      <Pressable onPress={() => setEmail('')} hitSlop={8}>
                        <MaterialCommunityIcons name="close-circle" size={18} color={isDark ? colors.textCaption : "#94A3B8"} />
                      </Pressable>
                    )}
                  </View>
                  {email.trim().length > 0 && !email.includes('@') && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      <Text style={{ fontSize: 11, color: isDark ? colors.textCaption : '#64748B' }}>Quick add:</Text>
                      {['@gmail.com', '@yahoo.com', '@outlook.com'].map((domain) => (
                        <Pressable
                          key={domain}
                          style={{
                            backgroundColor: isDark ? colors.section : '#F0FDF4',
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : '#BBF7D0',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                          }}
                          onPress={() => setEmail((prev) => prev.trim() + domain)}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>{domain}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* 6. Referral Code (Optional) with Gold Accent Badge */}
                <View style={styles.inputGroup}>
                  <View style={styles.referralHeaderRow}>
                    <Text style={[styles.inputLabel, isDark && { color: colors.textHeading }]}>
                      🎁 Referral Code{' '}
                      <Text style={{ color: isDark ? colors.textCaption : '#64748B', fontSize: 11 }}>(Optional)</Text>
                    </Text>
                    <View style={styles.goldBadge}>
                      <MaterialCommunityIcons name="gift-outline" size={12} color="#B45309" />
                      <Text style={styles.goldBadgeText}>Get ₹50 Free</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.textInputContainer,
                      isDark && { backgroundColor: colors.section, borderColor: colors.border },
                      autoDetectedReferral && referralCode.length > 0 && styles.textInputContainerDetected,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="ticket-percent-outline"
                      size={20}
                      color={autoDetectedReferral && referralCode.length > 0 ? '#16A34A' : '#F59E0B'}
                    />
                    <TextInput
                      style={[
                        styles.textInput,
                        isDark && { color: colors.textHeading },
                        { textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700' },
                      ]}
                      placeholder="e.g. LAUND-AB12"
                      placeholderTextColor={isDark ? colors.textCaption : "#94A3B8"}
                      autoCapitalize="characters"
                      maxLength={12}
                      value={referralCode}
                      onChangeText={(val) => {
                        setReferralCode(val.toUpperCase());
                        setAutoDetectedReferral(false);
                        setErrorMessage(null);
                      }}
                      accessibilityLabel="Referral code input"
                    />
                    {referralCode.length > 0 && (
                      <Pressable
                        onPress={() => {
                          setReferralCode('');
                          setAutoDetectedReferral(false);
                        }}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons name="close-circle" size={18} color={isDark ? colors.textCaption : "#94A3B8"} />
                      </Pressable>
                    )}
                  </View>
                  {autoDetectedReferral && referralCode.length > 0 && (
                    <View style={[styles.detectedBadge, isDark && { backgroundColor: 'rgba(22, 163, 74, 0.15)', borderColor: 'rgba(22, 163, 74, 0.3)' }]}>
                      <MaterialCommunityIcons name="check-circle" size={14} color="#16A34A" />
                      <Text style={[styles.detectedBadgeText, isDark && { color: '#86EFAC' }]}>
                        Invite code {referralCode} auto-detected! ₹{detectedBonus} bonus will be credited.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Main CTA: Green Gradient #16A34A -> #10B981 */}
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Pressable
                    onPress={handleRegisterSubmit}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Create Account"
                  >
                    <LinearGradient
                      colors={['#16A34A', '#10B981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.primaryGradientBtn, loading && styles.btnDisabled]}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Register with OTP →</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                {/* Bottom Switch Link */}
                <View style={styles.bottomSwitchRow}>
                  <Text style={[styles.bottomSwitchMuted, isDark && { color: colors.textCaption }]}>Already have an account? </Text>
                  <Pressable
                    onPress={() => {
                      setMode('LOGIN');
                      setErrorMessage(null);
                    }}
                  >
                    <Text style={styles.bottomSwitchAction}>Login</Text>
                  </Pressable>
                </View>

                {/* Privacy Note */}
                <Text style={[styles.privacyNote, isDark && { color: colors.textCaption }]}>
                  By continuing, you agree to our Terms of Service & Privacy Policy.
                </Text>
              </View>
            )}

            {/* STAGE 3: OTP VERIFICATION */}
            {mode === 'OTP' && (
              <View style={styles.formSection}>
                <View style={styles.otpHeader}>
                  <View style={[styles.otpIconCircle, isDark && { backgroundColor: 'rgba(22, 163, 74, 0.15)', borderColor: 'rgba(22, 163, 74, 0.3)' }]}>
                    <MaterialCommunityIcons name="message-text-lock" size={34} color="#16A34A" />
                  </View>
                  <Text style={[styles.formTitle, isDark && { color: colors.textHeading }]}>Verify Your Number</Text>
                  <Text style={[styles.formSubtitle, isDark && { color: colors.textCaption }]}>
                    Enter the 6-digit verification code sent to{'\n'}
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
                    style={[styles.otpInput, isDark && { backgroundColor: colors.section, color: colors.textHeading }]}
                    placeholder="000000"
                    placeholderTextColor={isDark ? colors.textCaption : "#CBD5E1"}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={(val) => {
                      setOtp(val);
                      setErrorMessage(null);
                    }}
                    autoFocus
                    accessibilityLabel="Enter 6-digit OTP code"
                  />
                </View>

                {/* Verify Button */}
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Pressable
                    onPress={handleVerifyOtp}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Verify OTP"
                  >
                    <LinearGradient
                      colors={['#16A34A', '#10B981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.primaryGradientBtn, loading && styles.btnDisabled]}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Text style={styles.primaryBtnText}>Verify & Continue →</Text>
                          <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFFFFF" />
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                {/* Resend & Change Number Actions */}
                <View style={styles.otpActions}>
                  {canResend ? (
                    <Pressable
                      onPress={handleResendOtp}
                      disabled={loading}
                      style={styles.resendBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Resend verification code"
                    >
                      <MaterialCommunityIcons name="refresh" size={18} color="#16A34A" />
                      <Text style={styles.resendText}>Resend Code</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.timerRow}>
                      <MaterialCommunityIcons name="timer-sand" size={16} color={isDark ? colors.textCaption : "#64748B"} />
                      <Text style={[styles.timerText, isDark && { color: colors.textCaption }]}>
                        Resend code in <Text style={[styles.timerBold, isDark && { color: colors.textHeading }]}>{countdown}s</Text>
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
                    <MaterialCommunityIcons name="pencil" size={14} color={isDark ? colors.textCaption : "#64748B"} />
                    <Text style={[styles.changeNumberText, isDark && { color: colors.textCaption }]}>Change Number</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Security & Trust Badges */}
          <View style={styles.trustBadge}>
            <MaterialCommunityIcons name="shield-check" size={18} color="#16A34A" />
            <Text style={styles.trustText}>
              256-bit Encrypted · Privacy Protected
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- 3-SECOND ACCOUNT NOT FOUND TOAST (Auto-redirects to Register) --- */}
      {redirectCountdown !== null && (
        <Animated.View style={[styles.redirectToastWrap, { opacity: toastAnim }]}>
          <View style={[styles.redirectToastCard, isDark && styles.redirectToastCardDark]}>
            <View style={styles.redirectToastIconWrap}>
              <MaterialCommunityIcons name="account-search-outline" size={24} color="#16A34A" />
            </View>

            <View style={styles.redirectToastTextCol}>
              <View style={styles.redirectToastHeaderRow}>
                <Text style={[styles.redirectToastTitle, isDark && { color: '#FFFFFF' }]}>
                  Account Not Found
                </Text>
                <View style={styles.redirectBadge}>
                  <Text style={styles.redirectBadgeText}>{redirectCountdown}s</Text>
                </View>
              </View>

              <Text style={[styles.redirectToastSub, isDark && { color: '#CBD5E1' }]} numberOfLines={2}>
                No account for +91 {phone}. Going to registration in{' '}
                <Text style={{ fontWeight: '800', color: isDark ? '#86EFAC' : '#15803D' }}>{redirectCountdown}s</Text>...
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.redirectToastActionBtn, pressed && { opacity: 0.85 }]}
              onPress={goToRegisterNow}
              accessibilityRole="button"
              accessibilityLabel="Register Now"
            >
              <Text style={styles.redirectToastActionBtnText}>Register →</Text>
            </Pressable>

            <Pressable
              style={styles.redirectToastCloseBtn}
              onPress={cancelRedirect}
              hitSlop={8}
              accessibilityLabel="Cancel redirect"
            >
              <MaterialCommunityIcons name="close" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0FDF4', // Soft mint/white background
  },

  // ==================== AMBIENT HEADER ====================
  gradientHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  checkoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  checkoutBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  headerRightPlaceholder: {
    width: 42,
  },

  // Brand Section with Green Gradient Glow Behind Logo
  brandSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  glowOuterCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  logo: {
    width: 52,
    height: 52,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A', // Deep Navy
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  taglineBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A', // Fresh Green
    letterSpacing: 2,
  },

  // Tab Switcher
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#DCFCE7',
    borderRadius: 16,
    padding: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  tabIndicatorWrapper: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  tabIndicatorGradient: {
    flex: 1,
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
    color: '#475569',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // ==================== CONTENT AREA ====================
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Large White Rounded Login Card with Soft Shadow
  floatingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
    marginBottom: 18,
  },

  // Form Section
  formSection: {
    width: '100%',
  },
  headerTextRow: {
    marginBottom: 6,
  },
  formTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#0F172A', // Deep Navy
    letterSpacing: -0.3,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#475569', // Body Text
    lineHeight: 19,
    marginBottom: 22,
  },

  // Error Box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 18,
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
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A', // Deep Navy
    marginBottom: 8,
  },

  // Phone Input Container with India +91 Selector
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    overflow: 'hidden',
  },
  countryPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 15,
    backgroundColor: '#F1F5F9',
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    gap: 6,
  },
  flagEmoji: {
    fontSize: 18,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 1.2,
  },

  // General Text Input Container
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  textInputContainerDetected: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },

  // Remember Me & Forgot Password Row
  rememberForgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rememberMeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A', // Fresh Green
  },

  // Referral Row & Gold Accent Badge
  referralHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  goldBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309', // Gold accent
  },
  detectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  detectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },

  // ==================== BUTTONS ====================
  primaryGradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // OR Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    paddingHorizontal: 14,
  },

  // White Outlined "Continue with Google" Button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingVertical: 15,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Bottom Switch Text
  bottomSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  bottomSwitchMuted: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  bottomSwitchAction: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '800',
  },

  // Benefits Row
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    gap: 8,
  },
  benefitPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  benefitText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },

  // Privacy Note
  privacyNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },

  // Switch to sign in banner button in register mode
  switchToSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#16A34A',
  },
  switchToSignInText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
  },

  // ==================== OTP VERIFICATION ====================
  otpHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  otpIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  phoneHighlight: {
    fontWeight: '900',
    color: '#16A34A',
  },
  otpInputWrapper: {
    marginBottom: 22,
  },
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#16A34A',
    borderRadius: 20,
    paddingVertical: 18,
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 12,
  },
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
    color: '#16A34A',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 13,
    color: '#64748B',
  },
  timerBold: {
    fontWeight: '800',
    color: '#0F172A',
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
    color: '#64748B',
  },

  // ==================== TRUST BADGE ====================
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  trustText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },

  // ==================== 3-SECOND REDIRECT TOAST ====================
  redirectToastWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 24,
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  redirectToastCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  redirectToastCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#15803D',
    shadowColor: '#000000',
  },
  redirectToastIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  redirectToastTextCol: {
    flex: 1,
    minWidth: 0,
  },
  redirectToastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redirectToastTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  redirectBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  redirectBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803D',
  },
  redirectToastSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  redirectToastActionBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  redirectToastActionBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  redirectToastCloseBtn: {
    padding: 4,
    flexShrink: 0,
  },

  // ==================== MODAL (Account Not Found) ====================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalPhone: {
    fontWeight: '800',
    color: '#16A34A',
  },
  modalNote: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
    lineHeight: 18,
  },
  modalButtons: {
    width: '100%',
    gap: 12,
  },
  modalPrimaryBtnWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalPrimaryBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
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
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  modalSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  otpNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  otpNoticeText: {
    fontSize: 12,
    color: '#166534',
    flex: 1,
    lineHeight: 16,
    fontWeight: '600',
  },
});
