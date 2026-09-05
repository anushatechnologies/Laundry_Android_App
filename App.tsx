import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Image, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useCustomerLocation } from '@/services/location/useCustomerLocation';
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
  WISHLIST: 'HOME',
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

  return (
    <View style={styles.loadingRoot}>
      <StatusBar style="light" />
      <View style={styles.loadingMark}>
        <Image source={brandLogo} style={styles.loadingLogo} resizeMode="contain" accessibilityLabel="LaundryFresh logo" />
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.loadingTitle}>{displayText}</Text>
        <Text style={styles.cursor}>|</Text>
      </View>
      <Text style={styles.loadingTagline}>LUXURY FABRIC CARE & DOORSTEP LAUNDRY</Text>
      <View style={styles.loadingBadge}>
        <MaterialCommunityIcons name="shield-check-outline" size={16} color={COLORS.gold} />
        <Text style={styles.badgeText}>100% Pure Ozone Hygiene</Text>
      </View>
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
    })();

    return () => {
      isMounted = false;
    };
  }, []);
  const { route, history } = navigation;
  // First launch opens the real map flow directly; Back still reveals the brand landing page.
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>('LOCATION');
  const {
    state: locationState,
    hydrated: hasLoadedUserLocation,
    saveDeliveryLocation,
    refreshCurrentLocation,
  } = useCustomerLocation({
    ownerId: session?.user.id ?? null,
    refreshOnForeground: hasCompletedOnboarding,
  });
  
  // Auto-detect location AFTER onboarding completes, only once
  const hasTriedAutoLocation = useRef(false);
  useEffect(() => {
    if (
      hasCompletedOnboarding && 
      hasLoadedUserLocation && 
      !locationState.deliveryLocation && 
      !hasTriedAutoLocation.current &&
      ready
    ) {
      hasTriedAutoLocation.current = true;
      // Delay slightly to avoid blocking UI
      const timer = setTimeout(() => {
        refreshCurrentLocation('if-undetermined').catch(() => {
          // Silent fail - user can set manually
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding, hasLoadedUserLocation, locationState.deliveryLocation, ready]);
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

  if (!ready || !hasLoadedUserLocation || !permissionsState.completed) return <LoadingScreen />;

  if (!hasCompletedOnboarding) {
    if (onboardingStage === 'LANDING') return <WelcomeScreen onContinue={openOnboardingLocationPicker} />;

    return (
      <MapLocationPickerScreen
        initialLocation={locationState.deliveryLocation}
        initialGpsCoords={permissionsState.gpsCoords}
        initialPermissionStatus={
          permissionsState.locationGranted
            ? 'granted'
            : permissionsState.locationBlocked
              ? 'blocked'
              : 'denied'
        }
        autoPermissionPrompt="if-undetermined"
        onLocationConfirmed={async (loc) => {
          await applyUserLocation(loc);
          await completeOnboarding();
          resetRoute('HOME');
        }}
        onBack={() => setOnboardingStage('LANDING')}
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
        onChangeLocation={() => navigateTo('LOCATION')}
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
        autoPermissionPrompt="if-undetermined"
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
        <ReferralScreen onUseReward={startBooking} onSignIn={() => openLogin('ACCOUNT')} />
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
      <DetailShell title={detailTitles.LIVE_CHAT} onBack={() => goBack(detailBackRoute.LIVE_CHAT)}>
        <LiveChatSupportScreen />
      </DetailShell>
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
        {screen}
      </View>
      {!showingDetail ? (
        <View style={styles.customTabBarContainer}>
          <View style={styles.customTabBar}>
            {tabs.map((tab) => {
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
  loadingMark: { width: 82, height: 82, borderRadius: 27, overflow: 'hidden', backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.gold, marginBottom: 18 },
  loadingLogo: { width: 76, height: 76, transform: [{ scale: 1.25 }] },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { color: COLORS.white, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  cursor: { color: COLORS.gold, fontSize: 32, fontWeight: '900', marginLeft: 3 },
  loadingTagline: { color: COLORS.gold, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 8, textAlign: 'center' },
  loadingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  badgeText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  detailRoot: { flex: 1, backgroundColor: COLORS.cream },
  appbar: { backgroundColor: COLORS.white },
  appbarTitle: { color: COLORS.plumDark, fontWeight: '900' },
  detailContent: { flex: 1 },
});
