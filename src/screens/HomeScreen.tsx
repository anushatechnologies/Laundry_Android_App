import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { BannerCarousel } from '@/components/BannerCarousel';
import { PromotionsSection } from '@/components/PromotionsSection';
import { AppButton, Card, StatusPill } from '@/ui/components';
import { money, shortDate } from '@/ui/theme';
import { api } from '@/lib/api';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { getCategoryImageUrl } from '@/lib/category-photos';
import { Banner, SubscriptionPlan, ServiceMaster } from '@/types/domain';

interface HomeScreenProps {
  locationStatus?: 'detecting' | 'unavailable' | 'ready';
  onBook: () => void;
  onViewOrders: () => void;
  onViewServices: () => void;
  onViewOffers: () => void;
  onViewPricing: () => void;
  onSignIn: () => void;
  userLocation?: { city?: string; pincode?: string; areaName?: string; hubName?: string } | null;
  onChangeLocation?: () => void;
  onOpenWishlist?: () => void;
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  onOpenOrderDetail?: (orderId: string) => void;
  onSelectCategory?: (tag: string, title: string) => void;
  onOpenBulkLaundry?: () => void;
  onSelectService?: (serviceCode: string, serviceName: string, tag?: string, title?: string) => void;
  onViewSubscriptions?: () => void;
}

export function HomeScreen({
  onBook,
  onViewOrders,
  onViewServices,
  onViewOffers,
  onViewPricing,
  onSignIn,
  userLocation,
  locationStatus = 'ready',
  onChangeLocation,
  onOpenWishlist,
  onOpenSearch,
  onOpenNotifications,
  onOpenOrderDetail,
  onSelectCategory,
  onOpenBulkLaundry,
  onSelectService,
  onViewSubscriptions,
}: HomeScreenProps) {
  const {
    session,
    orders,
    cartSummary,
    cart,
    catalog,
    addCartItem,
    addBulkToCart,
    addGarmentToCart,
    setCartQuantity,
    removeFromCart,
    wishlist,
    toggleWishlist,
    isInWishlist,
  } = useApp();

  const locationLabel = userLocation?.areaName 
    ? `${userLocation.areaName}${userLocation.pincode ? ` - ${userLocation.pincode}` : ''}` 
    : userLocation?.city 
    ? `${userLocation.city}${userLocation.pincode ? ` - ${userLocation.pincode}` : ''}` 
    : (locationStatus === 'detecting' ? 'Detecting location…' : 'Tap to set location');

  const [banners, setBanners] = useState<Banner[]>([]);
  const [liveSubPlans, setLiveSubPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('mens-wear');
  const [serviceMasters, setServiceMasters] = useState<ServiceMaster[]>([]);
  const [serviceImgErrors, setServiceImgErrors] = useState<Record<string, boolean>>({});
  const [catImgErrors, setCatImgErrors] = useState<Record<string, boolean>>({});
  const [servicesLoading, setServicesLoading] = useState(true);

  const activeOrder = orders.find(
    (order) => !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(order.currentStatus)
  );

  const [minBulkKgPrice, setMinBulkKgPrice] = useState<number | null>(null);
  const [showAllServicesModal, setShowAllServicesModal] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const fetchedBanners = await api.getBanners();
        console.log('[HomeScreen] Raw API response banners:', JSON.stringify(fetchedBanners, null, 2));
        if (fetchedBanners && Array.isArray(fetchedBanners) && fetchedBanners.length > 0) {
          // Only filter for valid image URLs - backend already filters isActive
          const validBanners = fetchedBanners.filter(
            (b) => b.imageUrl && b.imageUrl.trim().length > 0
          );
          console.log('[HomeScreen] Valid banners after filter:', validBanners.length);
          setBanners(validBanners.length > 0 ? validBanners : fetchedBanners);
        } else {
          console.log('[HomeScreen] No banners received from API');
        }
      } catch (err) {
        console.error('[HomeScreen] Failed to fetch banners:', err);
      }

      try {
        const plans = await api.getSubscriptionPlans();
        if (plans && Array.isArray(plans) && plans.length > 0) {
          const active = plans.filter((p) => p.isActive);
          if (active.length > 0) {
            setLiveSubPlans(active);
          }
        }
      } catch {
        // Fallback plans remain
      }

      // Fetch service masters from backend
      try {
        setServicesLoading(true);
        const services = await api.getServiceMasters();
        if (services && Array.isArray(services) && services.length > 0) {
          const activeServices = services.filter((s) => s.isActive);
          setServiceMasters(activeServices);
        }
      } catch (err) {
        console.error('Failed to fetch service masters:', err);
      } finally {
        setServicesLoading(false);
      }
    })();

    // Fetch dynamic minimum bulk rate per KG directly from backend API
    fetch('https://laundry.anushatechnologies.com/api/bulk-pricing')
      .then((r) => r.json())
      .then((res) => {
        if (res.allSlabs && Array.isArray(res.allSlabs) && res.allSlabs.length > 0) {
          const activeRates = res.allSlabs
            .filter((s: any) => s.isActive !== false)
            .map((s: any) => Math.round(s.regularPrice / s.weightKg));
          if (activeRates.length > 0) {
            setMinBulkKgPrice(Math.min(...activeRates));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectBanner = (banner: Banner) => {
    if (banner.actionType === 'CATEGORY' && banner.actionTarget) {
      let target = banner.actionTarget.toLowerCase();
      if (target.includes('bridal') || target.includes('silk') || target.includes('wedding')) {
        target = 'wedding-silk';
      } else if (target.includes('men')) {
        target = 'mens-wear';
      } else if (target.includes('women')) {
        target = 'womens-wear';
      } else if (target.includes('kid') || target.includes('baby')) {
        target = 'kids-baby';
      } else if (target.includes('home') || target.includes('linen') || target.includes('textile')) {
        target = 'home-textiles';
      } else if (target.includes('winter')) {
        target = 'winter-wear';
      }

      if (onSelectCategory) {
        const catObj = categories.find((cat) => cat.slug === target);
        if (catObj) {
          onSelectCategory(catObj.tag, catObj.label);
          return;
        }
      }
      setSelectedCategorySlug(target);
    } else if (banner.actionType === 'OFFER') {
      onViewOffers();
    } else if (banner.actionType === 'BOOK') {
      onBook();
    } else {
      onViewServices();
    }
  };

  // Helper: Map categoryTag to category slug
  const getCategorySlug = (categoryTag: string): string => {
    const normalized = categoryTag.toUpperCase().replace(/_/g, '-');
    if (normalized === 'MENS') return 'mens-wear';
    if (normalized === 'WOMENS') return 'womens-wear';
    if (normalized === 'KIDS') return 'kids-baby';
    if (normalized === 'HOME-TEXTILES') return 'home-textiles';
    if (normalized === 'BULK') return 'bulk-laundry';
    if (normalized === 'WEDDING') return 'wedding-silk';
    return normalized.toLowerCase();
  };

  const dynamicItemsByCategory = useMemo<Record<string, any[]>>(() => {
    if (catalog && catalog.clothTypes && catalog.clothTypes.length > 0) {
      // Build category map dynamically from API data
      const map: Record<string, any[]> = {};

      catalog.clothTypes.forEach((cloth) => {
        const prices = catalog.priceMatrix.filter((p) => p.clothTypeId === cloth.id && p.isActive);
        const primaryPrice = prices[0];
        const svcId = primaryPrice?.serviceId || '';
        const itemObj = {
          id: cloth.id,
          name: cloth.name,
          service: primaryPrice ? primaryPrice.serviceName : 'Standard Service',
          serviceId: svcId,
          tatHours: primaryPrice?.turnaroundHours || 24,
          price: primaryPrice ? primaryPrice.price : 0,
          unit: 'pc',
          imageUrl: getGarmentImageUrl(cloth.id, cloth.imageUrl || cloth.image, cloth.categoryTag),
        };

        // Map to category dynamically based on API categoryTag
        const categorySlug = getCategorySlug(cloth.categoryTag || 'MENS');
        if (!map[categorySlug]) map[categorySlug] = [];
        map[categorySlug].push(itemObj);
        
        // Also add to special categories
        if (cloth.categoryTag === 'WOMENS' && (cloth.id.includes('saree') || cloth.id.includes('lehenga') || cloth.id.includes('sherwani'))) {
          if (!map['wedding-silk']) map['wedding-silk'] = [];
          map['wedding-silk'].push(itemObj);
        }
        if (cloth.id.includes('jacket') || cloth.id.includes('sweater') || cloth.id.includes('blanket') || cloth.id.includes('shawl')) {
          if (!map['winter-wear']) map['winter-wear'] = [];
          map['winter-wear'].push(itemObj);
        }
      });

      // Limit to 4 items per category for home screen showcase
      const limitedMap: Record<string, any[]> = {};
      Object.keys(map).forEach(key => {
        limitedMap[key] = (map[key] || []).slice(0, 4);
      });
      
      return limitedMap;
    }

    // No fallback to static data - return empty object
    return {};
  }, [catalog]);

  const currentCategoryItems =
    dynamicItemsByCategory[selectedCategorySlug] || [];


  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);
  const customerFirstName = session?.user?.name ? session.user.name.split(' ')[0] : 'Guest';

  // Helper: Map backend service icon/emoji to MaterialCommunityIcons
  const getServiceIcon = (service: ServiceMaster): string => {
    const iconStr = service.icon?.toLowerCase() || '';
    const slug = service.slug?.toLowerCase() || '';
    const name = service.name?.toLowerCase() || '';

    // Check if icon field contains emoji
    if (service.icon) {
      if (service.icon.includes('👔') || iconStr.includes('iron')) return 'iron';
      if (service.icon.includes('🧺') || iconStr.includes('wash')) return 'washing-machine';
      if (service.icon.includes('✨') || iconStr.includes('sparkles')) return 'sparkles';
    }

    // Map by slug or name
    if (slug.includes('iron') || slug.includes('press')) return 'iron';
    if (slug.includes('wash-fold')) return 'washing-machine';
    if (slug.includes('wash-iron')) return 'tshirt-crew';
    if (slug.includes('dry-clean')) return 'coat-rack';
    if (slug.includes('charak') || slug.includes('saree') || slug.includes('silk')) return 'crown-outline';
    if (slug.includes('starch')) return 'sparkles';
    if (slug.includes('spa') || slug.includes('shoe')) return 'shoe-sneaker';
    if (slug.includes('express') || slug.includes('emergency')) return 'lightning-bolt';

    // Fallback
    return 'hanger';
  };

  // Helper: Generate accent color based on service
  const getServiceAccent = (service: ServiceMaster): string => {
    const slug = service.slug?.toLowerCase() || '';
    if (slug.includes('iron') || slug.includes('press')) return '#D97706';
    if (slug.includes('wash-fold')) return '#0891B2';
    if (slug.includes('wash-iron')) return '#7C3AED';
    if (slug.includes('dry-clean')) return '#2563EB';
    if (slug.includes('charak') || slug.includes('silk')) return '#9333EA';
    if (slug.includes('starch')) return '#06B6D4';
    if (slug.includes('spa') || slug.includes('shoe')) return '#059669';
    if (slug.includes('express')) return '#EA580C';
    return '#64748B';
  };

  // Helper: Generate badge text
  const getServiceBadge = (service: ServiceMaster): string => {
    const slug = service.slug?.toLowerCase() || '';
    if (slug.includes('iron') || slug.includes('press')) return 'Zero Wrinkles';
    if (slug.includes('wash-fold')) return 'Daily Fresh';
    if (slug.includes('wash-iron')) return 'Crease-Free';
    if (slug.includes('dry-clean')) return 'Ozone Sanitized';
    if (slug.includes('charak')) return 'Zero Bleed Safe';
    if (slug.includes('starch')) return 'Crisp Finish';
    if (slug.includes('spa')) return 'Deep Restored';
    if (slug.includes('express')) return 'Emergency';
    return 'Premium Care';
  };

  // Helper: Format turnaround time
  const formatTAT = (hours: number): string => {
    if (hours <= 12) return `${hours}h Express`;
    if (hours <= 24) return `${hours}h TAT`;
    const days = Math.floor(hours / 24);
    return `${days}-${days + 1}d TAT`;
  };

  // Helper: Format pricing text
  const formatPricing = (service: ServiceMaster): string => {
    if (service.pricingType === 'PER_KG') {
      if (service.baseKgPrice) {
        return `From ₹${service.baseKgPrice}/kg`;
      }
      return 'From ₹60/kg';
    }
    
    // For PER_ITEM, fetch min price from price_matrix
    if (catalog?.priceMatrix && catalog.priceMatrix.length > 0) {
      const servicePrices = catalog.priceMatrix
        .filter(item => item.serviceId === service.id && item.isActive && item.price > 0)
        .map(item => item.price);
      
      if (servicePrices.length > 0) {
        const minPrice = Math.min(...servicePrices);
        return `From ₹${minPrice}`;
      }
    }
    
    return 'From ₹49';
  };

  // Helper: Get service image URL
  const getServiceImageUrl = (service: ServiceMaster): string => {
    if (service.imageUrl && service.imageUrl.length > 10 && !service.imageUrl.includes('placeholder')) {
      return service.imageUrl;
    }
    if (service.image && service.image.length > 10 && !service.image.includes('placeholder')) {
      return service.image;
    }
    // Fallback images based on slug & serviceCode
    const slug = service.slug?.toLowerCase() || '';
    const code = (service.serviceCode || '').toUpperCase();
    if (slug.includes('dry-clean') || code === 'DRY_CLEAN') return 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/service_dry_cleaning.jpg';
    if (slug.includes('wash-fold') || slug.includes('wash-and-fold') || code === 'WASH_FOLD') return 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/service_wash_fold.jpg';
    if (slug.includes('wash-iron') || slug.includes('wash-and-iron') || code === 'WASH_IRON') return 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/service_wash_iron.jpg';
    if (slug.includes('iron') || slug.includes('press') || code === 'PRESS') return 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/service_steam_press.jpg';
    if (slug.includes('spa') || slug.includes('shoe') || code === 'SHOE_SPA') return 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/service_shoe_clean.jpg';
    if (slug.includes('express') || slug.includes('emergency') || code === 'EXPRESS') return 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/delivery_van_driver.jpg';
    return 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/service_wash_iron.jpg';
  };

  // Helper: Clean, elegant, readable category names that fit neatly in 4-column layout
  const getCleanCategoryName = (name: string, slug?: string): string => {
    const s = (slug || '').toLowerCase();
    const n = (name || '').toLowerCase();
    if (s.includes('men') && !s.includes('women')) return "Men's Wear";
    if (s.includes('women')) return "Women's Wear";
    if (s.includes('kid') || s.includes('baby')) return 'Kids & Baby';
    if (s.includes('home') || s.includes('textile') || s.includes('linen')) return 'Home Linen';
    if (s.includes('footwear') || s.includes('shoe')) return 'Footwear & Shoes';
    if (s.includes('bag') || s.includes('accessories')) return 'Bags & Accessories';
    if (s.includes('wedding') || s.includes('bridal') || s.includes('silk')) return 'Wedding & Silk';
    if (s.includes('bulk')) return 'Bulk Laundry';
    return name.replace(/\s*\([^)]*\)/g, '').trim();
  };

  // The 4 core services formatted cleanly for 1 row of 4
  const coreServices = useMemo(() => {
    const findMaster = (keywords: string[]) => {
      return serviceMasters.find((s) => {
        const sName = (s.name || '').toLowerCase();
        const sSlug = (s.slug || '').toLowerCase();
        const sCode = (s.serviceCode || '').toLowerCase();
        return keywords.some((k) => sName.includes(k) || sSlug.includes(k) || sCode.includes(k));
      });
    };

    const washFoldMaster = findMaster(['wash & fold', 'wash-and-fold', 'wash_fold']);
    const washIronMaster = findMaster(['wash & steam iron', 'wash-and-iron', 'wash_iron']);
    const pressMaster = findMaster(['iron only', 'steam-iron', 'press']);
    const dryCleanMaster = findMaster(['dry clean', 'dry-cleaning', 'dry_clean']);

    return [
      {
        id: washFoldMaster?.id || 'srv-m-wash-fold',
        serviceId: washFoldMaster?.id || 'srv-m-wash-fold',
        title: 'Wash & Fold',
        tat: '24h TAT',
        badge: 'Daily Fresh',
        accent: '#0891B2',
        imageUrl: washFoldMaster?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_fold.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_fold.jpg',
        priceText: washFoldMaster ? formatPricing(washFoldMaster) : 'From ₹60/kg',
        pricingType: 'PER_ITEM',
        serviceCode: 'WASH_FOLD',
        slug: 'wash-and-fold',
      },
      {
        id: washIronMaster?.id || 'srv-m-wash-iron',
        serviceId: washIronMaster?.id || 'srv-m-wash-iron',
        title: 'Wash & Iron',
        tat: '24h TAT',
        badge: 'Crease-Free',
        accent: '#7C3AED',
        imageUrl: washIronMaster?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_iron.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_iron.jpg',
        priceText: washIronMaster ? formatPricing(washIronMaster) : 'From ₹85/kg',
        pricingType: 'PER_ITEM',
        serviceCode: 'WASH_IRON',
        slug: 'wash-and-iron',
      },
      {
        id: pressMaster?.id || 'srv-m-steam-iron',
        serviceId: pressMaster?.id || 'srv-m-steam-iron',
        title: 'Steam Press',
        tat: '12h Express',
        badge: 'Zero Wrinkles',
        accent: '#D97706',
        imageUrl: pressMaster?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_steam_press.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_steam_press.jpg',
        priceText: pressMaster ? formatPricing(pressMaster) : 'From ₹18',
        pricingType: 'PER_ITEM',
        serviceCode: 'PRESS',
        slug: 'steam-iron',
      },
      {
        id: dryCleanMaster?.id || 'srv-m-dry-clean',
        serviceId: dryCleanMaster?.id || 'srv-m-dry-clean',
        title: 'Dry Clean',
        tat: '48h TAT',
        badge: 'Ozone Sanitized',
        accent: '#2563EB',
        imageUrl: dryCleanMaster?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_dry_cleaning.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_dry_cleaning.jpg',
        priceText: dryCleanMaster ? formatPricing(dryCleanMaster) : 'From ₹70',
        pricingType: 'PER_ITEM',
        serviceCode: 'DRY_CLEAN',
        slug: 'dry-cleaning',
      },
    ];
  }, [serviceMasters, catalog]);

  // Full list of all 8 services for the All Services modal
  const allServicesList = useMemo(() => {
    const findMaster = (keywords: string[]) => {
      return serviceMasters.find((s) => {
        const sName = (s.name || '').toLowerCase();
        const sSlug = (s.slug || '').toLowerCase();
        const sCode = (s.serviceCode || '').toLowerCase();
        return keywords.some((k) => sName.includes(k) || sSlug.includes(k) || sCode.includes(k));
      });
    };

    const sWashFold = findMaster(['wash & fold', 'wash-and-fold', 'wash_fold']);
    const sWashIron = findMaster(['wash & steam iron', 'wash-and-iron', 'wash_iron']);
    const sPress = findMaster(['iron only', 'steam-iron', 'press', 'steam iron']);
    const sDryClean = findMaster(['dry clean', 'dry-cleaning', 'dry_clean']);
    const sSpa = findMaster(['shoe', 'spa', 'footwear']);
    const sCharak = findMaster(['charak', 'saree', 'polish', 'silk care']);
    const sStarch = findMaster(['starch', 'crisp']);
    const sExpress = findMaster(['express', 'emergency', 'fast']);

    return [
      {
        id: sWashFold?.id || 'srv-m-wash-fold',
        title: 'Wash & Fold',
        tat: '24h TAT',
        badge: 'Daily Fresh',
        accent: '#0891B2',
        imageUrl: sWashFold?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_fold.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_fold.jpg',
        priceText: sWashFold ? formatPricing(sWashFold) : 'From ₹60/kg',
        pricingType: 'PER_KG',
        serviceCode: 'WASH_FOLD',
        slug: 'wash-and-fold',
        description: 'Machine washed with eco detergent, tumble dried and neatly folded for daily clothes.',
        icon: 'washing-machine',
      },
      {
        id: sWashIron?.id || 'srv-m-wash-iron',
        title: 'Wash & Steam Iron',
        tat: '24h TAT',
        badge: 'Crease-Free',
        accent: '#7C3AED',
        imageUrl: sWashIron?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_iron.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_iron.jpg',
        priceText: sWashIron ? formatPricing(sWashIron) : 'From ₹85/kg',
        pricingType: 'PER_KG',
        serviceCode: 'WASH_IRON',
        slug: 'wash-and-iron',
        description: 'Complete hygienic wash followed by temperature-controlled steam ironing on hangers.',
        icon: 'tshirt-crew',
      },
      {
        id: sPress?.id || 'srv-m-steam-iron',
        title: 'Steam Press',
        tat: '12h Express',
        badge: 'Zero Wrinkles',
        accent: '#D97706',
        imageUrl: sPress?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_steam_press.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_steam_press.jpg',
        priceText: sPress ? formatPricing(sPress) : 'From ₹18',
        pricingType: 'PER_ITEM',
        serviceCode: 'PRESS',
        slug: 'steam-iron',
        description: 'High-pressure vacuum steam ironing that removes deep wrinkles without scorching delicate fabric.',
        icon: 'iron',
      },
      {
        id: sDryClean?.id || 'srv-m-dry-clean',
        title: 'Dry Cleaning',
        tat: '48h TAT',
        badge: 'Ozone Sanitized',
        accent: '#2563EB',
        imageUrl: sDryClean?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_dry_cleaning.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_dry_cleaning.jpg',
        priceText: sDryClean ? formatPricing(sDryClean) : 'From ₹70',
        pricingType: 'PER_ITEM',
        serviceCode: 'DRY_CLEAN',
        slug: 'dry-cleaning',
        description: 'Eco hydrocarbon dry cleaning for suits, designer lehengas, silk sarees and delicate couture.',
        icon: 'coat-rack',
      },
      {
        id: sSpa?.id || 'srv-m-spa',
        title: 'Shoe & Sneaker Spa',
        tat: '48h TAT',
        badge: 'Deep Restored',
        accent: '#059669',
        imageUrl: sSpa?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_shoe_clean.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_shoe_clean.jpg',
        priceText: sSpa ? formatPricing(sSpa) : 'From ₹199',
        pricingType: 'PER_ITEM',
        serviceCode: 'SHOE_SPA',
        slug: 'shoe-spa',
        description: 'Multi-step cleaning, deodorizing, mid-sole brightening and suede protection for all footwear.',
        icon: 'shoe-sneaker',
      },
      {
        id: sCharak?.id || 'srv-m-charak',
        title: 'Saree Rolling & Charak Polish',
        tat: '48h TAT',
        badge: 'Zero Bleed Safe',
        accent: '#9333EA',
        imageUrl: sCharak?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/wedding-wear.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/wedding-wear.jpg',
        priceText: sCharak ? formatPricing(sCharak) : 'From ₹149',
        pricingType: 'PER_ITEM',
        serviceCode: 'SAREE_POLISH',
        slug: 'saree-polish-charak',
        description: 'Traditional steam calendering and starch polishing to restore luster and fall of pure silk sarees.',
        icon: 'crown-outline',
      },
      {
        id: sStarch?.id || 'srv-m-starch',
        title: 'Starch & Crisp Finish',
        tat: '24h TAT',
        badge: 'Crisp Finish',
        accent: '#06B6D4',
        imageUrl: sStarch?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments/cloth-shirt.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments/cloth-shirt.jpg',
        priceText: sStarch ? formatPricing(sStarch) : 'From ₹49',
        pricingType: 'PER_ITEM',
        serviceCode: 'STARCH',
        slug: 'starch-crisp',
        description: 'Rice or chemical starch treatment for cotton kurtas, dhotis, shirts and table linens.',
        icon: 'sparkles',
      },
      {
        id: sExpress?.id || 'srv-m-express',
        title: 'Express 24h Emergency',
        tat: '12-24h Rapid',
        badge: 'Emergency Care',
        accent: '#EA580C',
        imageUrl: sExpress?.imageUrl || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/delivery_van_driver.jpg',
        fallbackUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/delivery_van_driver.jpg',
        priceText: sExpress ? formatPricing(sExpress) : 'From ₹120/kg',
        pricingType: 'PER_KG',
        serviceCode: 'EXPRESS',
        slug: 'express-delivery',
        description: 'Priority queue processing with expedited doorstep pickup and lightning delivery in 24 hours.',
        icon: 'lightning-bolt',
      },
    ];
  }, [serviceMasters, catalog]);

  const categories = useMemo(() => {
    const cloths = catalog?.clothTypes || [];

    const getCount = (tag: string, slug: string) => {
      const cleanTag = tag.toUpperCase().replace(/_/g, '-');
      const filtered = cloths.filter((item: any) => {
        const cTag = (item.categoryTag || '').toUpperCase().replace(/_/g, '-');
        const cId = (item.id || '').toLowerCase();
        const cName = (item.name || '').toLowerCase();
        if (cleanTag === 'MENS') return cTag === 'MENS';
        if (cleanTag === 'WOMENS') return cTag === 'WOMENS';
        if (cleanTag === 'KIDS') return cTag === 'KIDS';
        if (cleanTag === 'HOME-TEXTILES' || cleanTag === 'HOME') return cTag === 'HOME-TEXTILES' || cTag === 'HOME';
        if (cleanTag === 'FOOTWEAR' || cleanTag === 'SHOES') return cTag === 'FOOTWEAR' || cTag === 'SHOES';
        if (cleanTag === 'ACCESSORIES' || cleanTag === 'BAGS') return cTag === 'ACCESSORIES' || cTag === 'BAGS';
        if (cleanTag === 'WEDDING') {
          return cTag === 'WEDDING' || cId.includes('saree') || cId.includes('lehenga') || cId.includes('sherwani') || cName.includes('silk') || cName.includes('bridal');
        }
        return cTag === cleanTag;
      });
      return filtered.length > 0 ? `${filtered.length} Items` : 'Explore';
    };

    const getAccent = (color?: string, slug?: string): string => {
      if (color) {
        const c = color.toLowerCase();
        if (c.includes('blue')) return '#2563EB';
        if (c.includes('pink')) return '#DB2777';
        if (c.includes('purple')) return '#7C3AED';
        if (c.includes('amber') || c.includes('yellow')) return '#D97706';
        if (c.includes('teal')) return '#0D9488';
        if (c.includes('green') || c.includes('emerald')) return '#16A34A';
        if (c.includes('indigo')) return '#4F46E5';
        if (c.includes('cyan')) return '#0891B2';
        if (c.includes('rose')) return '#E11D48';
        if (c.includes('orange') || c.includes('red')) return '#EA580C';
      }
      const s = (slug || '').toLowerCase();
      if (s.includes('men')) return '#2563EB';
      if (s.includes('women')) return '#DB2777';
      if (s.includes('kid') || s.includes('baby')) return '#D97706';
      if (s.includes('home') || s.includes('textile') || s.includes('linen')) return '#0D9488';
      if (s.includes('footwear') || s.includes('shoe')) return '#0891B2';
      if (s.includes('bag') || s.includes('accessories')) return '#7C3AED';
      if (s.includes('wedding') || s.includes('bridal') || s.includes('silk')) return '#E11D48';
      if (s.includes('bulk')) return '#059669';
      return '#2563EB';
    };

    const getTag = (slug: string): string => {
      const s = slug.toLowerCase();
      if (s.includes('men') && !s.includes('women')) return 'MENS';
      if (s.includes('women')) return 'WOMENS';
      if (s.includes('kid') || s.includes('baby')) return 'KIDS';
      if (s.includes('home') || s.includes('textile') || s.includes('linen')) return 'HOME_TEXTILES';
      if (s.includes('footwear') || s.includes('shoe')) return 'FOOTWEAR';
      if (s.includes('bag') || s.includes('accessories')) return 'ACCESSORIES';
      if (s.includes('wedding') || s.includes('bridal') || s.includes('silk')) return 'WEDDING';
      if (s.includes('bulk')) return 'BULK';
      return slug.toUpperCase().replace(/-/g, '_');
    };

    if (catalog?.categories && Array.isArray(catalog.categories) && catalog.categories.length > 0) {
      return catalog.categories.map((cat) => {
        const tag = getTag(cat.slug);
        const isBulk = tag === 'BULK' || cat.slug.includes('bulk');
        const countText = isBulk
          ? (minBulkKgPrice ? `₹${minBulkKgPrice}/KG` : 'Pay by KG')
          : getCount(tag, cat.slug);

        return {
          id: cat.id,
          slug: cat.slug,
          tag,
          label: getCleanCategoryName(cat.name, cat.slug),
          fullTitle: cat.name,
          icon: cat.icon || 'hanger',
          imageUrl: cat.imageUrl || cat.image || getCategoryImageUrl(tag),
          count: countText,
          accent: getAccent(cat.color, cat.slug),
          subtitle: cat.description || 'Premium fabric care',
        };
      });
    }

    // Fallback if catalog is still loading
    return [
      { id: 'cat-1', slug: 'mens-wear', tag: 'MENS', label: "Men's Wear", imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/mens-wear.jpg', count: getCount('MENS', 'mens-wear'), accent: '#2563EB', subtitle: 'Shirts, Suits, Kurta & Denim' },
      { id: 'cat-2', slug: 'womens-wear', tag: 'WOMENS', label: "Women's Wear", imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/womens-wear.jpg', count: getCount('WOMENS', 'womens-wear'), accent: '#DB2777', subtitle: 'Kurtis, Sarees & Dresses' },
      { id: 'cat-3', slug: 'kids-wear', tag: 'KIDS', label: 'Kids & Baby', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/kids-baby.jpg', count: getCount('KIDS', 'kids-wear'), accent: '#D97706', subtitle: 'Uniforms & Baby wear' },
      { id: 'cat-4', slug: 'home-textiles', tag: 'HOME_TEXTILES', label: 'Home Linen', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/home-textiles.jpg', count: getCount('HOME-TEXTILES', 'home-textiles'), accent: '#0D9488', subtitle: 'Bedsheets, Curtains & Covers' },
      { id: 'cat-5', slug: 'footwear', tag: 'FOOTWEAR', label: 'Footwear & Shoes', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/footwear.jpg', count: getCount('FOOTWEAR', 'footwear'), accent: '#0891B2', subtitle: 'Sneakers, Formal & Suede' },
      { id: 'cat-6', slug: 'bags-accessories', tag: 'ACCESSORIES', label: 'Bags & Accessories', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/bags-accessories.jpg', count: getCount('ACCESSORIES', 'bags-accessories'), accent: '#7C3AED', subtitle: 'Luxury bags & backpacks' },
      { id: 'cat-7', slug: 'wedding-wear', tag: 'WEDDING', label: 'Wedding & Silk', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/wedding-wear.jpg', count: getCount('WEDDING', 'wedding-wear'), accent: '#E11D48', subtitle: 'Silk Sarees & Sherwanis' },
      { id: 'cat-8', slug: 'bulk-laundry', tag: 'BULK', label: 'Bulk Laundry', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/bulk-laundry.jpg', count: minBulkKgPrice ? `₹${minBulkKgPrice}/KG` : 'Pay by KG', accent: '#059669', subtitle: 'Everyday wash charged by weight' },
    ];
  }, [catalog?.categories, catalog?.clothTypes, minBulkKgPrice]);

  // Subscription Purchase with Razorpay Payment
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const handleSubscriptionPurchase = async (plan: any) => {
    if (!session || !session.user || !session.user.id) {
      Alert.alert('Sign In Required', 'Please sign in to purchase a subscription plan', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: onSignIn },
      ]);
      return;
    }

    try {
      setPurchaseLoading(true);

      // Create subscription purchase order
      const orderResponse = await api.purchaseSubscription(session.user.id, plan.subscriptionId);

      if (!orderResponse || !orderResponse.orderId) {
        throw new Error('Failed to create subscription order');
      }

      // Initialize Razorpay Checkout
      const options = {
        description: `${orderResponse.planName} - ${orderResponse.includedKg} KG, ${orderResponse.validityDays} Days`,
        image: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/brand/logo.png',
        currency: orderResponse.currency,
        key: orderResponse.key || orderResponse.keyId,
        amount: Math.round(orderResponse.amount * 100),
        order_id: orderResponse.orderId,
        name: 'LaundryFresh Subscription',
        prefill: {
          email: session.user.email || '',
          contact: session.user.phone || '',
          name: session.user.name || '',
        },
        theme: { color: '#2563EB' },
      };

      const RazorpayCheckout = require('react-native-razorpay').default;
      
      RazorpayCheckout.open(options)
        .then(async (data: any) => {
          // Payment success
          try {
            const verifyResponse = await api.verifySubscriptionPayment({
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
              customerId: session.user.id,
              subscriptionId: plan.subscriptionId,
            });

            setPurchaseLoading(false);

            if (verifyResponse?.payment_status === 'PAID') {
              Alert.alert(
                '🎉 Subscription Activated!',
                `Your ${plan.name} has been successfully activated. Enjoy ${plan.kg} of laundry allowance!`,
                [
                  { text: 'View My Subscriptions', onPress: () => onViewSubscriptions?.() },
                  { text: 'OK' },
                ]
              );
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (verifyError: any) {
            setPurchaseLoading(false);
            Alert.alert('Verification Failed', verifyError.message || 'Payment verification failed. Please contact support.');
          }
        })
        .catch((error: any) => {
          setPurchaseLoading(false);
          if (error.code !== RazorpayCheckout.PAYMENT_CANCELLED) {
            Alert.alert('Payment Failed', error.description || 'Payment could not be completed. Please try again.');
          }
        });
    } catch (error: any) {
      setPurchaseLoading(false);
      Alert.alert('Purchase Error', error.message || 'Failed to initiate subscription purchase. Please try again.');
    }
  };

  return (
    <View style={styles.outerWrap}>
      {/* TOP NAVIGATION BAR */}
      <View style={styles.stickyHeader}>
        <View style={styles.navMainRow}>
          {/* Left: Logo + Brand */}
          <View style={styles.navLeftCluster}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/brand-logo.png')}
                style={styles.brandLogoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.brandTextContainer}>
              <Text style={styles.greetingHeader} numberOfLines={1}>
                {greeting}, {customerFirstName} 👋
              </Text>
              <Text style={styles.deliveryLabel}>Delivering to</Text>
              <Pressable
                style={styles.locationChip}
                onPress={onChangeLocation}
                accessibilityRole="button"
                accessibilityLabel="Change pickup location"
              >
                <MaterialCommunityIcons name="map-marker" size={12} color="#FCD34D" />
                <Text style={styles.locationChipText} numberOfLines={1}>
                  {locationLabel}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={11} color="#E5E7EB" />
              </Pressable>
            </View>
          </View>

          {/* Right: Action Icons */}
          <View style={styles.navRightActions}>
            {/* Search Icon */}
            <Pressable
              style={styles.actionBtn}
              onPress={onOpenSearch}
              accessibilityLabel="Search Services"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="magnify" size={20} color="#FFFFFF" />
            </Pressable>

            {/* Wishlist Icon with Badge */}
            <Pressable
              style={styles.actionBtn}
              onPress={onOpenWishlist}
              accessibilityLabel="Open Wishlist"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name={wishlist.length > 0 ? 'heart' : 'heart-outline'}
                size={20}
                color={wishlist.length > 0 ? '#FCD34D' : '#FFFFFF'}
              />
              {wishlist.length > 0 && (
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeText}>{wishlist.length}</Text>
                </View>
              )}
            </Pressable>

            {/* Notification Icon with Dot */}
            <Pressable
              style={styles.actionBtn}
              onPress={onOpenNotifications}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="bell-outline" size={20} color="#FFFFFF" />
              {activeOrder && <View style={styles.notifDot} />}
            </Pressable>
          </View>
        </View>
      </View>

{/* 2. SCROLLABLE PAGE BODY */}
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* PROMOTIONAL HERO BANNER CAROUSEL */}
        {banners.length > 0 ? (
          <BannerCarousel banners={banners} onSelectBanner={handleSelectBanner} showHomeHero={false} />
        ) : null}

        {/* ACTIVE ORDER TRACKER */}
        {activeOrder ? (
          <Card style={styles.tracker}>
            <View style={styles.trackerTop}>
              <View>
                <Text style={styles.trackerLabel}>ACTIVE ORDER</Text>
                <Text style={styles.trackerId}>#{activeOrder.id}</Text>
              </View>
              <StatusPill status={activeOrder.currentStatus} />
            </View>
            <Text style={styles.trackerDetail}>
              Pickup: {shortDate(activeOrder.pickupSlot.date)} • {activeOrder.pickupSlot.slot}
            </Text>
            <AppButton
              title="Track Live Order"
              onPress={() => onOpenOrderDetail ? onOpenOrderDetail(activeOrder.id) : onViewOrders()}
              variant="primary"
              compact
              style={styles.trackerButton}
            />
          </Card>
        ) : null}

        {/* 1. OUR SERVICES SECTION (ONE ROW OF 4 CARDS) */}
        <View style={styles.servicesSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Our Services</Text>
              <Text style={styles.sectionSubheading}>Select a service to view garment rates & care options</Text>
            </View>
            <Pressable onPress={() => setShowAllServicesModal(true)} style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>All Services</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#2563EB" />
            </Pressable>
          </View>

          <View style={styles.services4Row}>
            {coreServices.map((svc) => {
              const hasImgErr = serviceImgErrors[svc.id];
              return (
                <Pressable
                  key={svc.id}
                  style={({ pressed }) => [
                    styles.service4Tile,
                    pressed && styles.tileCardPressed,
                  ]}
                  onPress={() => {
                    // Only open Bulk Laundry for the actual bulk-laundry KG service, not for Wash & Fold / Wash & Iron
                    const isBulkService = svc.slug === 'bulk-laundry' || (svc.pricingType === 'PER_KG' && svc.slug === 'bulk-laundry');
                    if (isBulkService) {
                      if (onOpenBulkLaundry) {
                        onOpenBulkLaundry();
                        return;
                      }
                    }
                    if (onSelectService) {
                      const serviceCode = svc.serviceCode || 'ALL';
                      const category = svc.serviceCode === 'SHOE_SPA'
                        ? { tag: 'FOOTWEAR', title: 'Footwear & Shoes' }
                        : svc.serviceCode === 'SAREE_POLISH'
                        ? { tag: 'WOMENS', title: "Women's Wear" }
                        : { tag: 'ALL', title: 'All Garments' };
                      onSelectService(serviceCode, svc.title, category.tag, category.title);
                    } else {
                      onViewServices();
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${svc.title} service`}
                >
                  {/* Top TAT Badge */}
                  <View style={styles.service4TatPill}>
                    <Text style={styles.service4TatText}>{svc.tat}</Text>
                  </View>

                  {/* Circular Image with Accent Ring */}
                  <View style={[styles.service4ImgWrap, { borderColor: svc.accent || '#FED7AA' }]}>
                    <Image
                      source={{ uri: hasImgErr ? svc.fallbackUrl : svc.imageUrl }}
                      style={styles.service4Img}
                      resizeMode="cover"
                      onError={() => setServiceImgErrors((prev) => ({ ...prev, [svc.id]: true }))}
                    />
                  </View>

                  {/* Service Title */}
                  <Text style={styles.service4Title} numberOfLines={1}>
                    {svc.title}
                  </Text>

                  {/* Starting Price */}
                  <Text style={styles.service4PriceText} numberOfLines={1}>
                    {svc.priceText}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 2. BROWSE BY CATEGORY (4 PER ROW) */}
        <View style={styles.categoriesSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Browse Categories</Text>
              <Text style={styles.sectionSubheading}>Expert fabric care organized by garment type</Text>
            </View>
          </View>

          <View style={styles.homeCategory4Grid}>
            {categories.map((cat) => {
              const photoUrl = catImgErrors[cat.slug]
                ? getCategoryImageUrl(cat.tag)
                : (cat.imageUrl || getCategoryImageUrl(cat.tag));
              return (
                <Pressable
                  key={cat.slug}
                  style={({ pressed }) => [
                    styles.homeCategory4Col,
                    pressed && styles.categoryItemPressed,
                  ]}
                  onPress={() => {
                    if (cat.tag === 'BULK' || cat.slug === 'bulk-laundry' || cat.slug === 'express-services') {
                      if (onOpenBulkLaundry) onOpenBulkLaundry();
                      return;
                    }
                    if (onSelectCategory) {
                      onSelectCategory(cat.tag, cat.label);
                    }
                  }}
                >
                  <View style={[styles.homeCatCircleWrap, { borderColor: cat.accent }]}>
                    <Image
                      source={{ uri: photoUrl }}
                      style={styles.homeCatCircleImg}
                      resizeMode="cover"
                      onError={() => setCatImgErrors((prev) => ({ ...prev, [cat.slug]: true }))}
                    />
                    <View style={styles.homeCatCountBadge}>
                      <Text style={styles.homeCatCountText}>{cat.count}</Text>
                    </View>
                  </View>
                  <Text style={styles.homeCatTitle} numberOfLines={1}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 3. WHY CHOOSE LAUNDRYFRESH VALUE PROPOSITIONS */}
        <View style={styles.whyUsSection}>
          <Text style={styles.whyUsTitle}>Why Choose LaundryFresh?</Text>
          <View style={styles.whyUsGrid}>
            <View style={styles.whyUsItem}>
              <View style={[styles.whyUsIconBox, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="shield-check" size={22} color="#2563EB" />
              </View>
              <Text style={styles.whyUsItemHeading}>100% Ozone Sanitation</Text>
              <Text style={styles.whyUsItemDesc}>Hospital-grade sterilization eliminates 99.9% bacteria & allergens</Text>
            </View>

            <View style={styles.whyUsItem}>
              <View style={[styles.whyUsIconBox, { backgroundColor: '#F0FDF4' }]}>
                <MaterialCommunityIcons name="truck-fast" size={22} color="#16A34A" />
              </View>
              <Text style={styles.whyUsItemHeading}>30-Min Doorstep Pickup</Text>
              <Text style={styles.whyUsItemDesc}>Prompt rider dispatch with digital calibrated weighing scales</Text>
            </View>

            <View style={styles.whyUsItem}>
              <View style={[styles.whyUsIconBox, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons name="palette-swatch-outline" size={22} color="#D97706" />
              </View>
              <Text style={styles.whyUsItemHeading}>Zero Colour-Bleed Safe</Text>
              <Text style={styles.whyUsItemDesc}>German eco-friendly solvents that protect fabric texture and vibrancy</Text>
            </View>

            <View style={styles.whyUsItem}>
              <View style={[styles.whyUsIconBox, { backgroundColor: '#FAF5FF' }]}>
                <MaterialCommunityIcons name="lightning-bolt" size={22} color="#7C3AED" />
              </View>
              <Text style={styles.whyUsItemHeading}>Express 24h Delivery</Text>
              <Text style={styles.whyUsItemDesc}>Urgent laundry turnaround returned crisp and ready to wear</Text>
            </View>
          </View>
        </View>

        {/* 4. GUARANTEE FOOTER CARD */}
        <View style={styles.guaranteeBanner}>
          <View style={styles.guaranteeIconBox}>
            <MaterialCommunityIcons name="shield-crown-outline" size={26} color="#2563EB" />
          </View>
          <View style={styles.guaranteeTextWrap}>
            <Text style={styles.guaranteeTitle}>The LaundryFresh Promise</Text>
            <Text style={styles.guaranteeSubtitle}>
              100% Free Re-wash Guarantee • Zero Color Bleed Assurance • Digital Calibrated Scales
            </Text>
          </View>
        </View>

        {/* ACTIVE OFFERS & PROMOTIONS - Moved to Bottom */}
        <PromotionsSection
          onPressPromotion={(couponCode) => {
            if (couponCode) {
              onViewOffers();
            }
          }}
        />

      </ScrollView>

      {/* Payment Processing Overlay */}
      {purchaseLoading && (
        <View style={styles.paymentLoadingOverlay}>
          <View style={styles.paymentLoadingCard}>
            <MaterialCommunityIcons name="loading" size={48} color="#2563EB" style={{ transform: [{ rotate: '360deg' }] }} />
            <Text style={styles.paymentLoadingTitle}>Processing Payment...</Text>
            <Text style={styles.paymentLoadingText}>Please wait while we secure your subscription</Text>
          </View>
        </View>
      )}

      {/* ALL SERVICES BOTTOM SHEET / MODAL */}
      <Modal
        visible={showAllServicesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllServicesModal(false)}
      >
        <View style={styles.allServicesModalOverlay}>
          <Pressable
            style={styles.allServicesModalBackdrop}
            onPress={() => setShowAllServicesModal(false)}
          />
          <View style={styles.allServicesModalContent}>
            {/* Handle bar */}
            <View style={styles.modalDragHandle} />

            {/* Header */}
            <View style={styles.allServicesModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.allServicesModalTitle}>All Services & Care</Text>
                <Text style={styles.allServicesModalSubtitle}>
                  Choose from our 8 specialized garment care treatments
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowAllServicesModal(false)}
                hitSlop={8}
                accessibilityLabel="Close modal"
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Services List */}
            <ScrollView
              style={styles.allServicesListScroll}
              contentContainerStyle={styles.allServicesListContainer}
              showsVerticalScrollIndicator={false}
            >
              {allServicesList.map((svc) => (
                <Pressable
                  key={svc.id}
                  style={({ pressed }) => [
                    styles.allServiceItemCard,
                    pressed && styles.tileCardPressed,
                  ]}
                  onPress={() => {
                    setShowAllServicesModal(false);
                    if (svc.slug === 'bulk-laundry' || (svc.pricingType === 'PER_KG' && svc.serviceCode === 'EXPRESS')) {
                      if (onOpenBulkLaundry) {
                        onOpenBulkLaundry();
                        return;
                      }
                    }
                    if (onSelectService) {
                      const category = svc.serviceCode === 'SHOE_SPA'
                        ? { tag: 'FOOTWEAR', title: 'Footwear & Shoes' }
                        : svc.serviceCode === 'SAREE_POLISH'
                        ? { tag: 'WOMENS', title: "Women's Wear" }
                        : { tag: 'ALL', title: 'All Garments' };
                      onSelectService(svc.serviceCode, svc.title, category.tag, category.title);
                    } else {
                      onViewServices();
                    }
                  }}
                >
                  <View style={[styles.allServiceItemImgWrap, { borderColor: svc.accent || '#2563EB' }]}>
                    <Image
                      source={{ uri: svc.imageUrl }}
                      style={styles.allServiceItemImg}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={styles.allServiceItemInfo}>
                    <View style={styles.allServiceItemTopRow}>
                      <Text style={styles.allServiceItemTitle} numberOfLines={1}>
                        {svc.title}
                      </Text>
                      <View style={[styles.allServiceItemBadge, { backgroundColor: `${svc.accent}15` }]}>
                        <Text style={[styles.allServiceItemBadgeText, { color: svc.accent }]}>
                          {svc.badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.allServiceItemDesc} numberOfLines={2}>
                      {svc.description}
                    </Text>
                    <View style={styles.allServiceItemBottomRow}>
                      <Text style={styles.allServiceItemPrice}>{svc.priceText}</Text>
                      <View style={styles.allServiceItemTatPill}>
                        <MaterialCommunityIcons name="clock-outline" size={11} color="#64748B" />
                        <Text style={styles.allServiceItemTatText}>{svc.tat}</Text>
                      </View>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  // Our Services: 1 row of 4
  services4Row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 4,
    gap: 6,
  },
  service4Tile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  service4TatPill: {
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    marginBottom: 4,
  },
  service4TatText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#64748B',
  },
  service4ImgWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  service4Img: {
    width: '100%',
    height: '100%',
  },
  service4Title: {
    width: '100%',
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 2,
  },
  service4PriceText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FF7A00',
    textAlign: 'center',
  },

  // Browse Categories: 4 per row
  homeCategory4Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  homeCategory4Col: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  homeCatCircleWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    padding: 2,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  homeCatCircleImg: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  homeCatCountBadge: {
    position: 'absolute',
    bottom: -3,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  homeCatCountText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  homeCatTitle: {
    width: '100%',
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
  },

  greetingHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  deliveryLabel: {
    color: 'rgba(229,231,235,0.72)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  homeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  homeSearchPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    marginLeft: 10,
    fontWeight: '500',
  },
  homeSearchIconRight: {
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  servicesSection: {
    marginTop: 16,
  },
  servicesGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  serviceTileCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  tileCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  serviceTileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceBadgeWrap: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  serviceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  serviceTileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  serviceTileSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    minHeight: 30,
    marginBottom: 8,
  },
  serviceTileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  serviceTileTat: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  categoriesSection: {
    marginTop: 20,
  },
  whyUsSection: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  whyUsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  whyUsGrid: {
    gap: 14,
  },
  whyUsItem: {
    flexDirection: 'column',
  },
  whyUsIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  whyUsItemHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  whyUsItemDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  outerWrap: {
    flex: 1,
    backgroundColor: '#F0F4FF',
  },
  stickyHeader: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E40AF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  navMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  brandLogoImage: {
    width: 24,
    height: 24,
  },
  brandTextContainer: {
    flex: 1,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E5E7EB',
    maxWidth: 150,
  },
  navRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FCD34D',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#1E3A8A',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1E3A8A',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FCD34D',
    borderWidth: 2,
    borderColor: '#1E3A8A',
  },
  root: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 30,
  },
  tracker: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trackerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  trackerId: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  trackerDetail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  trackerButton: {
    marginTop: 10,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  featureBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  featureText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  showcaseSection: {
    marginTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionSubheading: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  
  categoryGridContainer: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  category3x2Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  categoryCircleCard: {
    width: '31%',
    alignItems: 'center',
  },
  categoryCircleWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#F1F5F9',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryCircleImage: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  categoryCircleRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 39,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  categoryCircleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 15,
  },
  categoryCircleCount: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  categoryRowOne: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryCategoryCard: {
    flex: 1,
    height: 148,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryCatBgImage: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    width: '100%',
    height: '100%',
  },
  primaryCatGradientOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  catCardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  categoryCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  catCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  catIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  catCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  catCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  catCardSubtitle: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
    fontWeight: '500',
  },
  catCardExploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  catCardExploreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  categoryRowTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryCategoryCard: {
    flex: 1,
    minWidth: '46%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  secCatThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  secCatTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  secCatCount: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },

  categoryChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 10,
  },
  itemCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  itemImageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemTatBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  itemTatText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    padding: 10,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  itemService: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 1,
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  itemUnit: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 2,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 2,
    gap: 4,
  },
  stepperBtn: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCountText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 14,
    textAlign: 'center',
  },
  guaranteeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  guaranteeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guaranteeTextWrap: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  guaranteeSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    marginTop: 2,
  },
  floatingBagBar: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 99,
  },
  bagInfo: {
    flex: 1,
  },
  bagCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bagIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagCountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bagTotalText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
    marginTop: 1,
  },
  bagReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F97316',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 4,
  },
  bagReviewBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Circular Category Grid (3 per row)
  circularCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  circularCategoryItem: {
    width: '31%',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryItemPressed: {
    opacity: 0.7,
  },
  circularImageWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    padding: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 10,
  },
  circularCategoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  circularCategoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C0B18',
    textAlign: 'center',
    marginBottom: 3,
    lineHeight: 16,
  },
  circularCategoryCount: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },

  // Modern Large Category Cards & Quick Order (20px Radius & Soft Shadow)
  largeCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  largeCategoryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 4,
  },
  largeCategoryTop: {
    position: 'relative',
    height: 110,
    width: '100%',
    backgroundColor: '#F8FAFC',
  },
  largeCategoryImgWrap: {
    width: '100%',
    height: '100%',
  },
  largeCategoryImg: {
    width: '100%',
    height: '100%',
  },
  largeCategoryTatBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  largeCategoryTatText: {
    fontSize: 10,
    fontWeight: '700',
  },
  largeCategoryInfo: {
    padding: 12,
  },
  largeCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  largeCategorySubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  largeCategoryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  largeCategoryCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  exploreLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  exploreLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Quick Order Section
  quickOrderSection: {
    marginBottom: 20,
  },
  quickOrderScroll: {
    paddingRight: 16,
    gap: 12,
  },
  quickOrderCard: {
    width: 175,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
    justifyContent: 'space-between',
  },
  quickOrderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickOrderIcon: {
    fontSize: 22,
  },
  quickOrderTatBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  quickOrderTatText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  quickOrderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    minHeight: 36,
    lineHeight: 18,
  },
  quickOrderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickOrderPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  quickAddBtn: {
    backgroundColor: '#FF7A00',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  quickAddBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  
  // Payment Loading Overlay
  paymentLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  paymentLoadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
    minWidth: 280,
  },
  paymentLoadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  paymentLoadingText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  luxuryServicesScroll: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    paddingVertical: 6,
  },
  luxuryServicesGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  luxuryServiceTile: {
    width: 142,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    alignItems: 'center',
  },
  luxuryServiceTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  luxuryServiceBadge: {
    backgroundColor: '#FFF7ED',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  luxuryServiceBadgeText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 0.2,
  },
  luxuryServiceTatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  luxuryServiceTatText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#64748B',
  },
  luxuryServiceImgWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  luxuryServiceImg: {
    width: '100%',
    height: '100%',
  },
  luxuryServiceTitle: {
    width: '100%',
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  luxuryServiceDesc: {
    width: '100%',
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
    marginBottom: 8,
  },
  luxuryServicePriceRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  luxuryServicePriceText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#FF7A00',
  },
  luxuryServiceArrowBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicesLoadingState: {
    width: '100%',
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  servicesEmptyState: {
    width: '100%',
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // All Services Modal Styles
  allServicesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  allServicesModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  allServicesModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  allServicesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  allServicesModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  allServicesModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allServicesListScroll: {
    paddingHorizontal: 16,
  },
  allServicesListContainer: {
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
  },
  allServiceItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  allServiceItemImgWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 2,
    marginRight: 12,
  },
  allServiceItemImg: {
    width: '100%',
    height: '100%',
  },
  allServiceItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  allServiceItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  allServiceItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },
  allServiceItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  allServiceItemBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  allServiceItemDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    marginBottom: 4,
  },
  allServiceItemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  allServiceItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF7A00',
  },
  allServiceItemTatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  allServiceItemTatText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
});
