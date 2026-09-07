import { ExpandableFAB } from '@/components/ExpandableFAB';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, Image, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, PaperProvider } from 'react-native-paper';
import { AppProvider, useApp } from '@/context/AppContext';
import { AddressesScreen } from '@/screens/AddressesScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { BookScreen } from '@/screens/BookScreen';
import { BulkLaundryScreen } from '@/screens/BulkLaundryScreen';
import { CategoryCatalogScreen } from '@/screens/CategoryCatalogScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { MapLocationPickerScreen } from '@/screens/MapLocationPickerScreen';
import { OffersScreen } from '@/screens/OffersScreen';
import { OrderDetailScreen } from '@/screens/OrderDetailScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { HelpScreen } from '@/screens/HelpScreen';
import { ReferralScreen } from '@/screens/ReferralScreen';
import { WalletScreen } from '@/screens/WalletScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { RatingScreen } from '@/screens/RatingScreen';
import { LiveChatSupportScreen } from '@/screens/LiveChatSupportScreen';
import { OrdersScreen } from '@/screens/OrdersScreen';
import { PricingScreen } from '@/screens/PricingScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { ServicesScreen } from '@/screens/ServicesScreen';
import { SubscriptionsScreen } from '@/screens/SubscriptionsScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { runFirstLaunchPermissions } from '@/services/permissions/permissionCoordinator';
import { WishlistScreen } from '@/screens/WishlistScreen';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { useCustomerLocation } from '@/services/location/useCustomerLocation';
import { resolveCustomerLocationCoordinates } from '@/services/location/locationService';
import { LocationSelectorModal } from '@/components/location/LocationSelectorModal';
import type { CustomerLocation } from '@/services/location/types';
import { APP_THEME, COLORS } from '@/ui/theme';
import './global.css';

type MainTab = 'HOME' | 'SERVICES' | 'CART' | 'ORDERS' | 'PROFILE';
type DetailRoute = 'BOOK' | 'WISHLIST' | 'OFFERS' | 'PRICING' | 'ADDRESSES' | 'LOCATION' | 'ORDER_DETAIL' | 'SEARCH' | 'NOTIFICATIONS' | 'HELP' | 'PAYMENT_METHODS' | 'REFERRAL' | 'WALLET' | 'SETTINGS' | 'RATING' | 'STATS' | 'LIVE_CHAT' | 'CATEGORY_CATALOG' | 'BULK_LAUNDRY' | 'SUBSCRIPTIONS';
type LoginReason = 'ACCOUNT' | 'CHECKOUT';
type AppRoute = MainTab | DetailRoute | 'AUTH';
type NavigationState = { route: AppRoute; history: AppRoute[] };
type OnboardingStage = 'LANDING' | 'LOCATION';

const brandLogo = require('./assets/brand-logo.png');
const IOS_BACK_SWIPE_EDGE_WIDTH = 20;
const IOS_BACK_SWIPE_START_DISTANCE = 8;
const IOS_BACK_SWIPE_COMPLETION_DISTANCE = 72;

const tabs: Array<{ key: MainTab; title: string; focusedIcon: string; unfocusedIcon: string }> = [
  { key: 'HOME', title: 'Home', focusedIcon: 'home-variant', unfocusedIcon: 'home-outline' },
  { key: 'SERVICES', title: 'Categories', focusedIcon: 'hanger', unfocusedIcon: 'hanger' },
  { key: 'CART', title: 'Bag', focusedIcon: 'shopping', unfocusedIcon: 'shopping-outline' },
  { key: 'ORDERS', title: 'Orders', focusedIcon: 'text-box-check', unfocusedIcon: 'text-box-outline' },
  { key: 'PROFILE', title: 'Profile', focusedIcon: 'account-circle', unfocusedIcon: 'account-circle-outline' },
];

const detailTitles: Record<DetailRoute, string> = {
  BOOK: 'Checkout & Bag',
  WISHLIST: 'My Saved Wishlist',
  OFFERS: 'Offers & Coupons',
  PRICING: 'Pricing Slabs',
  ADDRESSES: 'Saved Addresses',
  LOCATION: 'Choose Location',
  ORDER_DETAIL: 'Order Details & Tracking',
  SEARCH: 'Search Garments & Care',
  NOTIFICATIONS: 'Notification Center',
  HELP: 'Help & Customer Care',
  PAYMENT_METHODS: 'Saved Payment Methods',
  REFERRAL: 'Refer & Earn',
  WALLET: 'LaundryFresh Wallet',
  SETTINGS: 'Settings & Preferences',
  RATING: 'Rate Order & Service',
  STATS: 'Eco & Fabric Care Stats',
  LIVE_CHAT: 'Concierge Care Chat',
  CATEGORY_CATALOG: 'Garment Collection',
  BULK_LAUNDRY: 'Bulk Laundry (Pay by KG)',
  SUBSCRIPTIONS: 'My Subscriptions',
};

const detailBackRoute: Record<DetailRoute, MainTab> = {
  CATEGORY_CATALOG: 'HOME',
  BULK_LAUNDRY: 'HOME',
  BOOK: 'CART',
  WISHLIST: 'PROFILE',
  OFFERS: 'HOME',
  PRICING: 'HOME',
  ADDRESSES: 'PROFILE',
  LOCATION: 'HOME',
  ORDER_DETAIL: 'ORDERS',
  SEARCH: 'HOME',
  NOTIFICATIONS: 'HOME',
  HELP: 'PROFILE',
  PAYMENT_METHODS: 'PROFILE',
  REFERRAL: 'PROFILE',
  WALLET: 'PROFILE',
  SETTINGS: 'PROFILE',
  RATING: 'ORDERS',
  STATS: 'PROFILE',
  LIVE_CHAT: 'PROFILE',
  SUBSCRIPTIONS: 'PROFILE',
};

function LoadingScreen() {
  const [displayText, setDisplayText] = useState('');
  const appName = 'LaundryFresh';

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinnerRotate = useRef(new Animated.Value(0)).current;

  // Logo entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Spinner rotation
    Animated.loop(
      Animated.timing(spinnerRotate, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Typewriter effect
  useEffect(() => {
    let charIndex = 0;
    const interval = setInterval(() => {
      if (charIndex < appName.length) {
        setDisplayText(appName.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(interval);
      }
    }, 60);
    return () => clearInterval(interval);
  }, []);

  const spin = spinnerRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.loadingRoot}>
      <StatusBar style="light" />

      {/* Animated Logo */}
      <Animated.View
        style={[
          styles.loadingMark,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={brandLogo}
          style={styles.loadingLogo}
          resizeMode="contain"
          accessibilityLabel="LaundryFresh logo"
        />
      </Animated.View>

      {/* Animated Title */}
      <Animated.View style={[styles.titleRow, { opacity: fadeAnim }]}>
        <Text style={styles.loadingTitle}>{displayText}</Text>
        <Text style={styles.cursor}>|</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.loadingTagline, { opacity: fadeAnim }]}>
        LUXURY FABRIC CARE & DOORSTEP LAUNDRY
      </Animated.Text>

      {/* Badge */}
      <Animated.View
        style={[
          styles.loadingBadge,
          {
            opacity: fadeAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <MaterialCommunityIcons name="shield-check-outline" size={16} color={COLORS.gold} />
        <Text style={styles.badgeText}>100% Pure Ozone Hygiene</Text>
      </Animated.View>

      {/* Modern Ring Spinner */}
      <View style={styles.spinnerContainer}>
        <Animated.View
          style={[
            styles.spinnerRing,
            {
              opacity: fadeAnim,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <View style={styles.spinnerRingInner} />
        </Animated.View>
        
        {/* Pulsing Center Dot */}
        <Animated.View
          style={[
            styles.spinnerCenter,
            {
              opacity: fadeAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      </View>

      {/* Loading Text */}
      <Animated.Text style={[styles.loadingText, { opacity: fadeAnim }]}>
        Loading your premium laundry experience...
      </Animated.Text>
    </View>
  );
}

function DetailShell({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <View style={styles.detailRoot}>
      <Appbar.Header mode="small" style={styles.appbar} elevated>
        <Appbar.BackAction onPress={onBack} color={COLORS.plum} />
        <Appbar.Content title={title} titleStyle={styles.appbarTitle} />
      </Appbar.Header>
      <View style={styles.detailContent}>{children}</View>
    </View>
  );
}

function AuthenticatedApp() {
  const { ready, session, hasCompletedOnboarding, completeOnboarding, cartSummary, orders } = useApp();
  const [navigation, setNavigation] = useState<NavigationState>({ route: 'HOME', history: [] });
  const [permissionsState, setPermissionsState] = useState<{
    completed: boolean;
    locationGranted: boolean;
    locationBlocked: boolean;
    gpsCoords: { latitude: number; longitude: number } | null;
  }>({
    completed: false,
    locationGranted: false,
    locationBlocked: false,
    gpsCoords: null,
  });
  const permissionsRunRef = useRef(false);

  const {
    state: locationState,
    hydrated: hasLoadedUserLocation,
    saveDeliveryLocation,
    refreshCurrentLocation,
    switchToGpsLocation,
  } = useCustomerLocation({
    ownerId: session?.user.id ?? null,
    refreshOnForeground: true,
  });

  useEffect(() => {
    if (permissionsRunRef.current) return;
    permissionsRunRef.current = true;
    let isMounted = true;

    (async () => {
      // 200ms delay to allow native Activity window to attach completely
      await new Promise((resolve) => setTimeout(resolve, 200));
      const res = await runFirstLaunchPermissions();
      if (!isMounted) return;

      setPermissionsState({
        completed: true,
        locationGranted: res.locationGranted,
        locationBlocked: res.locationBlocked,
        gpsCoords: res.gpsCoords,
      });

      // Swiggy / Zomato instant location auto-population on launch
      if (res.locationGranted && res.gpsCoords) {
        try {
          const loc = await resolveCustomerLocationCoordinates(
            res.gpsCoords.latitude,
            res.gpsCoords.longitude,
            'gps'
          );
          if (isMounted) {
            await saveDeliveryLocation(loc);
          }
        } catch (err) {
          console.warn('[App] Auto-location startup resolution error:', err);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [saveDeliveryLocation]);

  const { route, history } = navigation;
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>('LANDING');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [selectedCategoryInfo, setSelectedCategoryInfo] = useState<{
    tag: string;
    title: string;
    serviceCode?: string;
    serviceName?: string;
  }>({ tag: 'MENS', title: "Men's Wear", serviceCode: 'ALL', serviceName: 'All Services' });
  const [loginReason, setLoginReason] = useState<LoginReason>('ACCOUNT');
  const [resumeCheckout, setResumeCheckout] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const iosEdgeSwipeStartX = useRef<number | null>(null);
  const handledNotificationResponseIds = useRef(new Set<string>());

  const navigateTo = useCallback((nextRoute: AppRoute) => {
    setNavigation((current) => {
      if (current.route === nextRoute) return current;
      return { route: nextRoute, history: [...current.history, current.route] };
    });
  }, []);

  const goBack = useCallback((fallbackRoute: AppRoute = 'HOME') => {
    setNavigation((current) => {
      const previousRoute = current.history[current.history.length - 1] ?? fallbackRoute;
      return { route: previousRoute, history: current.history.slice(0, -1) };
    });
  }, []);

  const resetRoute = useCallback((nextRoute: AppRoute) => {
    setNavigation({ route: nextRoute, history: [] });
  }, []);

  const openOnboardingLocationPicker = useCallback(() => {
    setOnboardingStage('LOCATION');
  }, []);

  const applyUserLocation = useCallback(async (location: CustomerLocation) => {
    await saveDeliveryLocation(location);
  }, [saveDeliveryLocation]);

  const openOrderDetail = useCallback((id: string) => {
    setSelectedOrderId(id);
    navigateTo('ORDER_DETAIL');
  }, [navigateTo]);

  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    const requestId = response.notification.request.identifier;
    if (handledNotificationResponseIds.current.has(requestId)) return;
    handledNotificationResponseIds.current.add(requestId);

    const data = response.notification.request.content.data as Record<string, any> | undefined;
    if (data?.orderId) {
      openOrderDetail(String(data.orderId));
    } else if (data?.screen === 'OFFERS') {
      navigateTo('OFFERS');
    } else if (data?.screen === 'CHAT') {
      navigateTo('LIVE_CHAT');
    } else if (data?.screen === 'NOTIFICATIONS') {
      navigateTo('NOTIFICATIONS');
    } else if (data?.screen === 'HOME') {
      resetRoute('HOME');
    } else {
      navigateTo('ORDERS');
    }
  }, [navigateTo, openOrderDetail, resetRoute]);

  useEffect(() => {
    // Handles a tap both while the app is running and when a Firebase push
    // launched it from a closed state.
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) handleNotificationResponse(lastResponse);

    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => subscription.remove();
  }, [handleNotificationResponse]);

  const startBooking = (code?: string) => {
    if (code) setCouponCode(code);
    navigateTo('CART');
  };
  const openLogin = useCallback((reason: LoginReason = 'ACCOUNT') => {
    setLoginReason(reason);
    navigateTo('AUTH');
  }, [navigateTo]);
  const startCheckout = useCallback(() => {
    setResumeCheckout(true);
    if (!session) {
      openLogin('CHECKOUT');
      return;
    }
    navigateTo('BOOK');
  }, [navigateTo, openLogin, session]);
  const cancelLogin = useCallback(() => {
    const returnTo = resumeCheckout ? 'BOOK' : 'HOME';
    setResumeCheckout(false);
    goBack(returnTo);
  }, [goBack, resumeCheckout]);
  const useCoupon = (code: string) => {
    setCouponCode(code);
    navigateTo('BOOK');
  };

  useEffect(() => {
    if (session && route === 'AUTH') {
      if (resumeCheckout) {
        goBack('BOOK');
      } else {
        resetRoute('HOME');
      }
    }
  }, [goBack, resetRoute, resumeCheckout, route, session]);

  useEffect(() => {
    if (!session && route === 'ADDRESSES') {
      resetRoute('HOME');
    }
  }, [resetRoute, route, session]);

  const requestBack = useCallback(() => {
    if (!ready) return false;

    if (!hasCompletedOnboarding) {
      if (onboardingStage === 'LOCATION') {
        setOnboardingStage('LANDING');
        return true;
      }
      return false;
    }

    if (route === 'HOME' && history.length === 0) return false;

    if (route === 'AUTH') {
      cancelLogin();
      return true;
    }

    const fallbackRoute = route in detailBackRoute ? detailBackRoute[route as DetailRoute] : 'HOME';
    goBack(fallbackRoute);
    return true;
  }, [cancelLogin, goBack, hasCompletedOnboarding, history.length, onboardingStage, ready, route]);

  const canUseIosBackSwipe = ready && hasCompletedOnboarding && !(route === 'HOME' && history.length === 0);

  const iosBackSwipe = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (event) => {
          if (Platform.OS === 'ios') {
            iosEdgeSwipeStartX.current = event.nativeEvent.pageX;
          }
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          const startedAtEdge =
            iosEdgeSwipeStartX.current !== null && iosEdgeSwipeStartX.current <= IOS_BACK_SWIPE_EDGE_WIDTH;

          return (
            Platform.OS === 'ios' &&
            canUseIosBackSwipe &&
            startedAtEdge &&
            gestureState.numberActiveTouches === 1 &&
            gestureState.dx > IOS_BACK_SWIPE_START_DISTANCE &&
            gestureState.dx > Math.abs(gestureState.dy) * 1.2
          );
        },
        onPanResponderRelease: (_event, gestureState) => {
          const startX = iosEdgeSwipeStartX.current;
          const swipeDistance = startX === null ? 0 : gestureState.moveX - startX;
          iosEdgeSwipeStartX.current = null;

          if (
            swipeDistance >= IOS_BACK_SWIPE_COMPLETION_DISTANCE ||
            (swipeDistance >= 28 && gestureState.vx >= 0.4)
          ) {
            requestBack();
          }
        },
        onPanResponderTerminate: () => {
          iosEdgeSwipeStartX.current = null;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [canUseIosBackSwipe, requestBack],
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', requestBack);

    return () => subscription.remove();
  }, [requestBack]);

  const [splashTimeoutPassed, setSplashTimeoutPassed] = useState(false);

  useEffect(() => {
    // Failsafe: Never keep the user on the loading screen longer than 600ms
    const timer = setTimeout(() => {
      setSplashTimeoutPassed(true);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Instant launch: Dismiss splash screen as soon as storage is read (<50ms).
  // Location & permissions run smoothly in background without blocking launch.
  if (!ready && !splashTimeoutPassed) return <LoadingScreen />;

  if (!hasCompletedOnboarding) {
    return (
      <WelcomeScreen
        onContinue={async () => {
          await completeOnboarding();
          resetRoute('HOME');
        }}
      />
    );
  }

  // After onboarding: if user chose Sign In from WelcomeScreen route them to auth
  if (route === 'AUTH' && !session) {
    // fall through to screen rendering below which handles AUTH route
  }

  let screen: ReactNode;
  if (route === 'HOME') {
    screen = (
      <HomeScreen
        onViewSubscriptions={() => navigateTo('SUBSCRIPTIONS')}
        onBook={startBooking}
        onViewOrders={() => navigateTo('ORDERS')}
        onViewServices={() => navigateTo('SERVICES')}
        onViewOffers={() => navigateTo('OFFERS')}
        onViewPricing={() => navigateTo('PRICING')}
        onSignIn={() => openLogin('ACCOUNT')}
        userLocation={locationState.deliveryLocation}
        locationStatus={locationState.loading && !locationState.deliveryLocation ? 'detecting' : locationState.error && !locationState.deliveryLocation ? 'unavailable' : 'ready'}
        onChangeLocation={() => setShowLocationModal(true)}
        onOpenWishlist={() => navigateTo('WISHLIST')}
        onOpenSearch={() => navigateTo('SEARCH')}
        onOpenNotifications={() => navigateTo('NOTIFICATIONS')}
        onOpenOrderDetail={openOrderDetail}
        onSelectCategory={(tag, title) => {
          if (tag === 'BULK') {
            navigateTo('BULK_LAUNDRY');
            return;
          }
          setSelectedCategoryInfo({ tag, title, serviceCode: 'ALL', serviceName: 'All Services' });
          navigateTo('CATEGORY_CATALOG');
        }}
        onSelectService={(serviceCode, serviceName, tag, title) => {
          setSelectedCategoryInfo({
            tag: tag || 'ALL',
            title: title || serviceName,
            serviceCode,
            serviceName,
          });
          navigateTo('CATEGORY_CATALOG');
        }}
        onOpenBulkLaundry={() => navigateTo('BULK_LAUNDRY')}
      />
    );
  } else if (route === 'SUBSCRIPTIONS') {
    screen = (
      <DetailShell title={detailTitles.SUBSCRIPTIONS} onBack={() => goBack(detailBackRoute.SUBSCRIPTIONS)}>
        <SubscriptionsScreen
          onBook={startBooking}
          onSignIn={() => openLogin('ACCOUNT')}
        />
      </DetailShell>
    );
  } else if (route === 'BULK_LAUNDRY') {
    screen = (
      <BulkLaundryScreen
        onBack={() => goBack('HOME')}
        onViewCart={() => navigateTo('CART')}
        onBook={startBooking}
      />
    );
  } else if (route === 'CATEGORY_CATALOG') {
    screen = (
      <CategoryCatalogScreen
        categoryTag={selectedCategoryInfo.tag}
        categoryTitle={selectedCategoryInfo.title}
        initialServiceFilter={selectedCategoryInfo.serviceCode}
        initialServiceName={selectedCategoryInfo.serviceName}
        onBack={() => goBack('HOME')}
        onOpenCart={() => navigateTo('CART')}
        onOpenBulkLaundry={() => navigateTo('BULK_LAUNDRY')}
      />
    );
  } else if (route === 'LOCATION') {
    screen = (
      <MapLocationPickerScreen
        initialLocation={locationState.deliveryLocation}
        customerId={session?.user.id ?? null}
        onLocationConfirmed={async (loc) => {
          await applyUserLocation(loc);
          goBack('HOME');
        }}
        onBack={() => goBack('HOME')}
      />
    );
  } else if (route === 'SERVICES') {
    screen = <ServicesScreen onBook={startBooking} onOpenBulkLaundry={() => navigateTo('BULK_LAUNDRY')} />;
  } else if (route === 'CART') {
    screen = (
      <BookScreen
        initialCouponCode={couponCode}
        onClearInitialCoupon={() => setCouponCode('')}
        deliveryLocation={locationState.deliveryLocation}
        onViewOrders={() => navigateTo('ORDERS')}
        onRequireSignIn={startCheckout}
        onBrowseServices={() => navigateTo('SERVICES')}
        resumeCheckout={resumeCheckout}
        onCheckoutResumed={() => setResumeCheckout(false)}
      />
    );
  } else if (route === 'ORDERS') {
    screen = <OrdersScreen onBook={startBooking} onSignIn={() => openLogin('ACCOUNT')} onBrowseServices={() => navigateTo('SERVICES')} onOpenOrderDetail={openOrderDetail} />;
  } else if (route === 'PROFILE') {
    screen = (
      <ProfileScreen
        onViewAddresses={() => navigateTo('ADDRESSES')}
        onViewOffers={() => navigateTo('OFFERS')}
        onViewOrders={() => navigateTo('ORDERS')}
        onViewWishlist={() => navigateTo('WISHLIST')}
        onSignIn={() => openLogin('ACCOUNT')}
        onViewHelp={() => navigateTo('HELP')}
        onViewReferral={() => navigateTo('REFERRAL')}
        onViewWallet={() => navigateTo('WALLET')}
        onViewSettings={() => navigateTo('SETTINGS')}
        onViewStats={() => navigateTo('STATS')}
        onViewLiveChat={() => navigateTo('LIVE_CHAT')}
        onViewSubscriptions={() => navigateTo('SUBSCRIPTIONS')}
      />
    );
  } else if (route === 'WISHLIST') {
    screen = (
      <DetailShell title={detailTitles.WISHLIST} onBack={() => goBack(detailBackRoute.WISHLIST)}>
        <WishlistScreen
          onBook={startBooking}
          onExploreServices={() => navigateTo('SERVICES')}
        />
      </DetailShell>
    );
  } else if (route === 'BOOK') {
    screen = (
      <DetailShell title={detailTitles.BOOK} onBack={() => goBack(detailBackRoute.BOOK)}>
        <BookScreen
          initialCouponCode={couponCode}
          onClearInitialCoupon={() => setCouponCode('')}
          onViewOrders={() => navigateTo('ORDERS')}
          onRequireSignIn={startCheckout}
          onBrowseServices={() => navigateTo('SERVICES')}
          resumeCheckout={resumeCheckout}
          onCheckoutResumed={() => setResumeCheckout(false)}
        />
      </DetailShell>
    );
  } else if (route === 'OFFERS') {
    screen = (
      <DetailShell title={detailTitles.OFFERS} onBack={() => goBack(detailBackRoute.OFFERS)}>
        <OffersScreen onUseCoupon={useCoupon} />
      </DetailShell>
    );
  } else if (route === 'PRICING') {
    screen = (
      <DetailShell title={detailTitles.PRICING} onBack={() => goBack(detailBackRoute.PRICING)}>
        <PricingScreen onBook={startBooking} />
      </DetailShell>
    );
  } else if (route === 'ORDER_DETAIL') {
    screen = (
      <DetailShell title={detailTitles.ORDER_DETAIL} onBack={() => goBack(detailBackRoute.ORDER_DETAIL)}>
        <OrderDetailScreen
          orderId={selectedOrderId}
          onBack={() => goBack('ORDERS')}
          onBook={startBooking}
          onHelp={() => navigateTo('HELP')}
        />
      </DetailShell>
    );
  } else if (route === 'SEARCH') {
    screen = (
      <DetailShell title={detailTitles.SEARCH} onBack={() => goBack(detailBackRoute.SEARCH)}>
        <SearchScreen onBook={startBooking} />
      </DetailShell>
    );
  } else if (route === 'NOTIFICATIONS') {
    screen = (
      <DetailShell title={detailTitles.NOTIFICATIONS} onBack={() => goBack(detailBackRoute.NOTIFICATIONS)}>
        <NotificationsScreen
          onOpenOrder={openOrderDetail}
          onOpenOffers={() => navigateTo('OFFERS')}
        />
      </DetailShell>
    );
  } else if (route === 'HELP') {
    screen = (
      <DetailShell title={detailTitles.HELP} onBack={() => goBack(detailBackRoute.HELP)}>
        <HelpScreen />
      </DetailShell>
    );
  } else if (route === 'REFERRAL') {
    screen = (
      <DetailShell title={detailTitles.REFERRAL} onBack={() => goBack(detailBackRoute.REFERRAL)}>
        <ReferralScreen
          onUseReward={startBooking}
          onSignIn={() => openLogin('ACCOUNT')}
          onNavigateWallet={() => navigateTo('WALLET')}
          onBack={() => goBack(detailBackRoute.REFERRAL)}
        />
      </DetailShell>
    );
  } else if (route === 'WALLET') {
    screen = (
      <DetailShell title={detailTitles.WALLET} onBack={() => goBack(detailBackRoute.WALLET)}>
        <WalletScreen
          onBack={() => goBack(detailBackRoute.WALLET)}
          onNavigateReferral={() => navigateTo('REFERRAL')}
          onSignIn={() => openLogin('ACCOUNT')}
        />
      </DetailShell>
    );
  } else if (route === 'SETTINGS') {
    screen = (
      <DetailShell title={detailTitles.SETTINGS} onBack={() => goBack(detailBackRoute.SETTINGS)}>
        <SettingsScreen onSignIn={() => openLogin('ACCOUNT')} />
      </DetailShell>
    );
  } else if (route === 'RATING') {
    screen = (
      <DetailShell title={detailTitles.RATING} onBack={() => goBack(detailBackRoute.RATING)}>
        <RatingScreen orderId={selectedOrderId || 'ORD-1042'} onComplete={() => goBack('ORDERS')} />
      </DetailShell>
    );
  } else if (route === 'LIVE_CHAT') {
    screen = (
      <LiveChatSupportScreen onBack={() => goBack(detailBackRoute.LIVE_CHAT)} />
    );
  } else if (route === 'AUTH') {
    screen = <AuthScreen reason={loginReason} onBack={cancelLogin} />;
  } else {
    screen = (
      <DetailShell title={detailTitles.ADDRESSES} onBack={() => goBack(detailBackRoute.ADDRESSES)}>
        <AddressesScreen onBook={startBooking} onSignIn={() => openLogin('ACCOUNT')} />
      </DetailShell>
    );
  }

  const showingDetail = !tabs.some((tab) => tab.key === route);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screen} {...iosBackSwipe.panHandlers}>
        <AppErrorBoundary fallbackRoute={() => resetRoute('HOME')}>
          {screen}
        </AppErrorBoundary>
      </View>
      {!showingDetail ? (
        <View style={styles.customTabBarContainer}>
          <View style={styles.customTabBar}>
            {tabs.slice(0, 2).map((tab) => {
              const isActive = route === tab.key;
              const hasCartBadge = tab.key === 'CART' && cartSummary.itemCount > 0;
              const hasOrdersBadge = tab.key === 'ORDERS' && orders.some((o) => !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(o.currentStatus));

              return (
                <Pressable
                  key={tab.key}
                  style={[styles.tabItem, isActive && styles.tabItemActive]}
                  onPress={() => {
                    navigateTo(tab.key);
                  }}
                >
                  <View style={styles.tabIconWrap}>
                    <MaterialCommunityIcons
                      name={(isActive ? tab.focusedIcon : tab.unfocusedIcon) as any}
                      size={22}
                      color={isActive ? '#FF7A00' : '#94A3B8'}
                    />
                    {hasCartBadge && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{cartSummary.itemCount}</Text>
                      </View>
                    )}
                    {hasOrdersBadge && <View style={styles.tabDotBadge} />}
                  </View>
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.title}
                  </Text>
                </Pressable>
              );
            })}

            {/* CENTER EXPANDABLE FAB */}
            <ExpandableFAB
              mainIcon="shopping"
              mainAction={() => navigateTo('CART')}
              badge={cartSummary.itemCount}
              actions={[
                {
                  icon: 'shopping',
                  label: 'View Cart',
                  onPress: () => navigateTo('CART'),
                  color: '#FF7A00',
                },
                {
                  icon: 'tag-multiple',
                  label: 'Offers',
                  onPress: () => navigateTo('OFFERS'),
                  color: '#8B5CF6',
                },
                {
                  icon: 'heart-outline',
                  label: 'Wishlist',
                  onPress: () => navigateTo('WISHLIST'),
                  color: '#EC4899',
                },
              ]}
            />

            {tabs.slice(3, 5).map((tab) => {
              const isActive = route === tab.key;
              const hasCartBadge = tab.key === 'CART' && cartSummary.itemCount > 0;
              const hasOrdersBadge = tab.key === 'ORDERS' && orders.some((o) => !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(o.currentStatus));

              return (
                <Pressable
                  key={tab.key}
                  style={[styles.tabItem, isActive && styles.tabItemActive]}
                  onPress={() => {
                    navigateTo(tab.key);
                  }}
                >
                  <View style={styles.tabIconWrap}>
                    <MaterialCommunityIcons
                      name={(isActive ? tab.focusedIcon : tab.unfocusedIcon) as any}
                      size={22}
                      color={isActive ? '#FF7A00' : '#94A3B8'}
                    />
                    {hasCartBadge && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{cartSummary.itemCount}</Text>
                      </View>
                    )}
                    {hasOrdersBadge && <View style={styles.tabDotBadge} />}
                  </View>
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* SWIGGY-STYLE LOCATION SELECTOR BOTTOM SHEET / DRAWER */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        currentLocation={locationState.currentLocation}
        deliveryLocation={locationState.deliveryLocation}
        customerId={session?.user.id ?? null}
        onSelectLocation={applyUserLocation}
        onUseCurrentGps={switchToGpsLocation}
        onOpenMapPicker={() => {
          setShowLocationModal(false);
          navigateTo('LOCATION');
        }}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={APP_THEME}>
        <AppProvider>
          <StatusBar style="dark" />
          <AuthenticatedApp />
        </AppProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cream },
  screen: { flex: 1 },
  customTabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingBottom: 12,
    paddingTop: 4,
  },
  customTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    marginHorizontal: 16,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
    position: 'relative',
  },
  fabContainer: {
    position: 'absolute',
    top: -28,
    left: '50%',
    marginLeft: -30,
    zIndex: 10,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fabBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 16,
  },
  tabItemActive: {
    backgroundColor: '#FFF7ED',
  },
  tabIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 3,
  },
  tabLabelActive: {
    color: '#111827',
    fontWeight: '700',
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -12,
    backgroundColor: '#FF7A00',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  tabDotBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF7A00',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  loadingRoot: { flex: 1, backgroundColor: COLORS.plumDark, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingMark: { width: 120, height: 120, borderRadius: 30, overflow: 'visible', backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.gold, marginBottom: 18 },
  loadingLogo: { width: 110, height: 110 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { color: COLORS.white, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  cursor: { color: COLORS.gold, fontSize: 32, fontWeight: '900', marginLeft: 3 },
  loadingTagline: { color: COLORS.gold, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 8, textAlign: 'center' },
  loadingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  badgeText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  spinnerContainer: { marginTop: 40, width: 80, height: 80, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  spinnerRing: { 
    width: 80, 
    height: 80, 
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: COLORS.gold,
    borderRightColor: COLORS.gold,
  },
  spinnerRingInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'transparent',
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    borderLeftColor: 'rgba(255, 255, 255, 0.3)',
    margin: 4,
  },
  spinnerCenter: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginTop: 24, textAlign: 'center', paddingHorizontal: 40 },
  detailRoot: { flex: 1, backgroundColor: COLORS.cream },
  appbar: { backgroundColor: COLORS.white },
  appbarTitle: { color: COLORS.plumDark, fontWeight: '900' },
  detailContent: { flex: 1 },
});
