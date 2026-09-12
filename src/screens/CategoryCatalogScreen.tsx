import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import { getGarmentImageUrl, FALLBACK_PHOTO } from '@/lib/garment-photos';
import { getCategoryImageUrl, getSubcategoryImageUrl } from '@/lib/category-photos';
import { AnimatedCartButton } from '@/components/AnimatedCartButton';
import type { Catalog } from '@/types/domain';

interface CategoryCatalogScreenProps {
  categoryTag?: string; // 'MENS' | 'WOMENS' | 'KIDS' | 'HOME_TEXTILES' | 'ACCESSORIES' | 'ALL'
  categoryTitle?: string;
  initialServiceFilter?: string;
  initialServiceName?: string;
  onBack: () => void;
  onViewCart?: () => void;
  onOpenCart?: () => void;
  onOpenBulkLaundry?: () => void;
  onOpenWishlist?: () => void;
  onSelectProduct?: (product: any, serviceId?: any) => void;
  hasBottomTabBar?: boolean;
}

export type CatalogSortOption = 'POPULAR' | 'PRICE_LOW' | 'PRICE_HIGH' | 'FASTEST' | 'NAME_AZ';
export type PriceRangeFilter = 'ALL' | 'UNDER_50' | '50_TO_150' | 'ABOVE_150';

type CatalogServiceCode = 'PRESS' | 'WASH_FOLD' | 'WASH_IRON' | 'DRY_CLEAN' | 'SHOE_SPA' | 'SAREE_POLISH' | 'STARCH' | 'EXPRESS' | 'OTHER';
type CatalogServiceFilter = 'ALL' | CatalogServiceCode;

interface ServicePriceOption {
  serviceId: string;
  serviceName: string;
  displayName: string;
  shortLabel: string;
  serviceCode: CatalogServiceCode;
  price: number;
  icon: string;
  unit: string;
  turnaroundHours?: number;
}

interface ProductItem {
  id: string;
  name: string;
  categoryTag: string;
  categoryLabel: string;
  subcategory: string;
  imageUrl?: string;
  fallbackImageUrl?: string;
  description?: string;
  services: ServicePriceOption[];
  minPrice: number;
}

// Subcategories and Categories are loaded dynamically from the backend API (catalog.categories, catalog.subcategories, and clothTypes)

// Available Main Categories
const MAIN_CATEGORIES: Array<{ tag: string; label: string; icon: string; imageUrl?: string; slug?: string }> = [
  { tag: 'ALL', label: 'All Items', icon: 'view-grid-outline', slug: 'all' },
  { tag: 'MENS', label: "Men's", icon: 'tshirt-crew', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/mens-wear.jpg', slug: 'mens-wear' },
  { tag: 'WOMENS', label: "Women's", icon: 'hanger', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/womens-wear.jpg', slug: 'womens-wear' },
  { tag: 'KIDS', label: 'Kids', icon: 'baby-carriage', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/kids-baby.jpg', slug: 'kids-wear' },
  { tag: 'HOME_TEXTILES', label: 'Home Linen', icon: 'bed-outline', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/home-textiles.jpg', slug: 'home-textiles' },
  { tag: 'FOOTWEAR', label: 'Footwear', icon: 'shoe-sneaker', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/footwear.jpg', slug: 'footwear' },
  { tag: 'ACCESSORIES', label: 'Accessories', icon: 'bag-personal-outline', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/bags-accessories.jpg', slug: 'bags-accessories' },
  { tag: 'WEDDING', label: 'Wedding & Silk', icon: 'crown-outline', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/wedding-wear.jpg', slug: 'wedding-wear' },
  { tag: 'BULK', label: 'Bulk KG', icon: 'scale', imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/bulk-laundry.jpg', slug: 'bulk-laundry' },
];

// Service filter options
const SERVICE_FILTERS: Array<{ key: CatalogServiceFilter; label: string; icon: string }> = [
  { key: 'ALL', label: 'All Services', icon: 'check-all' },
  { key: 'PRESS', label: 'Steam Press', icon: 'iron' },
  { key: 'WASH_FOLD', label: 'Wash & Fold', icon: 'tshirt-crew-outline' },
  { key: 'WASH_IRON', label: 'Wash & Iron', icon: 'washing-machine' },
  { key: 'DRY_CLEAN', label: 'Dry Clean', icon: 'coat-rack' },
  { key: 'SHOE_SPA', label: 'Shoe Spa', icon: 'shoe-sneaker' },
  { key: 'SAREE_POLISH', label: 'Saree Polish', icon: 'crown-outline' },
  { key: 'STARCH', label: 'Starch & Crisp', icon: 'sparkles' },
  { key: 'EXPRESS', label: 'Express 24h', icon: 'lightning-bolt' },
];

const SERVICE_FILTER_ORDER_MAP: Record<string, number> = {};
SERVICE_FILTERS.forEach((filter, idx) => {
  SERVICE_FILTER_ORDER_MAP[filter.key] = idx;
});

function normalizeCategoryTag(tag?: string): string {
  const normalized = (tag || 'MENS').toUpperCase().trim().replace(/_/g, '-');
  if (normalized === 'ALL') return 'ALL';
  if (['MENS', 'MEN', 'MENS-WEAR'].includes(normalized)) return 'MENS';
  if (['WOMENS', 'WOMEN', 'WOMENS-WEAR'].includes(normalized)) return 'WOMENS';
  if (['KIDS', 'KID', 'KIDS-WEAR', 'KIDS-BABY', 'BABY-KIDS'].includes(normalized)) return 'KIDS';
  if (['HOME', 'HOME-TEXTILES', 'HOME-LINEN'].includes(normalized)) return 'HOME_TEXTILES';
  if (['SHOES', 'FOOTWEAR'].includes(normalized)) return 'FOOTWEAR';
  if (['BAGS', 'ACCESSORIES', 'BAGS-ACCESSORIES'].includes(normalized)) return 'ACCESSORIES';
  if (['WEDDING', 'WEDDING-WEAR', 'BRIDAL', 'SILK'].includes(normalized)) return 'WEDDING';
  if (['BULK', 'BULK-LAUNDRY'].includes(normalized)) return 'BULK';
  return normalized.replace(/-/g, '_');
}

function getServiceDetails(serviceId: string, serviceName?: string, serviceCode?: string) {
  const source = `${serviceId || ''} ${serviceName || ''} ${serviceCode || ''}`.toLowerCase();

  if (source.includes('wash-fold') || source.includes('wash & fold')) {
    return { serviceCode: 'WASH_FOLD' as const, displayName: 'Wash & Fold', shortLabel: 'Wash+Fold', icon: 'tshirt-crew-outline' };
  }
  if (source.includes('wash-iron') || source.includes('wash & steam') || source.includes('wash & iron')) {
    return { serviceCode: 'WASH_IRON' as const, displayName: 'Wash & Iron', shortLabel: 'Wash+Iron', icon: 'washing-machine' };
  }
  if (source.includes('dry-clean') || source.includes('dry clean')) {
    return { serviceCode: 'DRY_CLEAN' as const, displayName: 'Dry Clean', shortLabel: 'Dry Clean', icon: 'coat-rack' };
  }
  if (source.includes('steam-iron') || source.includes('steam press') || source.includes('iron only') || source.includes('press')) {
    return { serviceCode: 'PRESS' as const, displayName: 'Steam Press', shortLabel: 'Press', icon: 'iron' };
  }
  if (source.includes('spa') || source.includes('shoe')) {
    return { serviceCode: 'SHOE_SPA' as const, displayName: 'Shoe Spa', shortLabel: 'Spa', icon: 'shoe-sneaker' };
  }
  if (source.includes('charak') || source.includes('saree') || source.includes('polish')) {
    return { serviceCode: 'SAREE_POLISH' as const, displayName: 'Saree Polish & Charak', shortLabel: 'Polish', icon: 'crown-outline' };
  }
  if (source.includes('starch')) {
    return { serviceCode: 'STARCH' as const, displayName: 'Starch & Crisp', shortLabel: 'Starch', icon: 'sparkles' };
  }
  if (source.includes('express')) {
    return { serviceCode: 'EXPRESS' as const, displayName: 'Express 24h', shortLabel: 'Express', icon: 'lightning-bolt' };
  }

  const displayName = (serviceName || 'Special care').trim();
  return { serviceCode: 'OTHER' as const, displayName, shortLabel: displayName, icon: 'star-four-points-outline' };
}

function formatTurnaround(hours?: number): string | null {
  if (!hours || hours <= 0) return null;
  return hours <= 24 ? `${hours}h` : `${Math.ceil(hours / 24)}d`;
}

function getSubcategoryFallbackIcon(subcategory: string, categoryTag: string): string {
  const source = `${subcategory} ${categoryTag}`.toLowerCase();
  if (source.includes('shoe') || source.includes('footwear')) return 'shoe-sneaker';
  if (source.includes('bag') || source.includes('belt') || source.includes('cap')) return 'bag-personal-outline';
  if (source.includes('bed') || source.includes('blanket') || source.includes('curtain') || source.includes('towel')) return 'bed-outline';
  if (source.includes('kid') || source.includes('baby')) return 'baby-carriage';
  if (source.includes('women') || source.includes('saree') || source.includes('kurti') || source.includes('dress')) return 'hanger';
  if (source.includes('jean') || source.includes('denim') || source.includes('pant') || source.includes('trouser')) return 'hanger';
  return 'tshirt-crew';
}

function matchesSubcategoryKeyword(name: string, sub: string): boolean {
  const n = (name || '').toLowerCase();
  const s = (sub || '').toLowerCase();
  if (s.includes('shirt') && !s.includes('t-shirt') && !s.includes('tshirt')) {
    return n.includes('shirt') && !n.includes('t-shirt') && !n.includes('tshirt') && !n.includes('polo');
  }
  if (s.includes('t-shirt') || s.includes('tshirt')) {
    return n.includes('t-shirt') || n.includes('tshirt') || n.includes('polo') || n.includes('tee');
  }
  if (s.includes('trouser') || s.includes('pant')) {
    return n.includes('trouser') || n.includes('pant') || n.includes('chino') || n.includes('cargo') || n.includes('bottom');
  }
  if (s.includes('denim') || s.includes('jean')) {
    return n.includes('jean') || n.includes('denim') || n.includes('jeggings');
  }
  if (s.includes('short') || s.includes('bermuda')) {
    return n.includes('short') || n.includes('bermuda');
  }
  if (s.includes('saree')) {
    return n.includes('saree');
  }
  if (s.includes('kurti') || s.includes('kurta')) {
    return n.includes('kurti') || n.includes('kurta');
  }
  if (s.includes('salwar') || (s.includes('suit') && !s.includes('blazer'))) {
    return n.includes('salwar') || n.includes('suit') || n.includes('sharara') || n.includes('gharara') || n.includes('churidar') || n.includes('kurti') || n.includes('kurta');
  }
  if (s.includes('suit') && s.includes('blazer')) {
    return n.includes('blazer') || n.includes('suit') || n.includes('tuxedo') || n.includes('coat');
  }
  if (s.includes('dress') || s.includes('gown')) {
    return n.includes('dress') || n.includes('gown') || n.includes('maxi') || n.includes('skirt') || n.includes('frock');
  }
  if (s.includes('lehenga') || s.includes('ghagra')) {
    return n.includes('lehenga') || n.includes('ghagra') || n.includes('choli') || n.includes('bridal');
  }
  if (s.includes('gown')) {
    return n.includes('gown') || n.includes('maxi');
  }
  if (s.includes('jacket') || s.includes('blazer') || s.includes('coat')) {
    return (n.includes('jacket') || n.includes('blazer') || n.includes('coat') || n.includes('shrug') || n.includes('bomber') || n.includes('windcheater')) && !n.includes('shawl') && !n.includes('sweater');
  }
  if (s.includes('winter') || s.includes('sweater') || s.includes('cardigan') || s.includes('pullover')) {
    return (n.includes('winter') || n.includes('sweater') || n.includes('cardigan') || n.includes('pullover') || n.includes('hoodie') || n.includes('shawl') || n.includes('pashmina') || n.includes('muffler')) && !n.includes('jacket');
  }
  if (s.includes('shawl') || s.includes('stole') || s.includes('dupatta')) {
    return n.includes('shawl') || n.includes('stole') || n.includes('pashmina') || n.includes('dupatta');
  }
  if (s.includes('ethnic')) {
    return n.includes('ethnic') || n.includes('kurta') || n.includes('sherwani') || n.includes('dhoti') || n.includes('lungi') || n.includes('pyjama') || n.includes('indo-western');
  }
  if (s.includes('sport') || s.includes('gym')) {
    return n.includes('short') || n.includes('bermuda') || n.includes('track') || n.includes('gym') || n.includes('sport') || n.includes('jogger');
  }
  if (s.includes('bedsheet') || s.includes('bed sheet')) {
    return n.includes('bedsheet') || n.includes('bed sheet') || n.includes('bed cover') || n.includes('linen');
  }
  if (s.includes('blanket') || s.includes('quilt') || s.includes('comforter')) {
    return n.includes('blanket') || n.includes('quilt') || n.includes('comforter') || n.includes('duvet') || n.includes('razai');
  }
  if (s.includes('curtain')) {
    return n.includes('curtain');
  }
  if (s.includes('sneaker') || s.includes('sports shoe')) {
    return n.includes('sneaker') || n.includes('sports shoe') || n.includes('casual');
  }
  if (s.includes('formal shoe') || s.includes('leather')) {
    return n.includes('formal') || n.includes('leather') || n.includes('oxford') || n.includes('derby');
  }
  if (s.includes('backpack') || s.includes('school bag')) {
    return n.includes('backpack') || n.includes('school bag');
  }
  if (s.includes('handbag') || s.includes('purse')) {
    return n.includes('handbag') || n.includes('purse') || n.includes('luxury hand');
  }
  if (s.includes('trolley') || s.includes('suitcase') || s.includes('luggage')) {
    return n.includes('trolley') || n.includes('suitcase') || n.includes('luggage') || n.includes('cabin');
  }
  if (s.includes('baby') || s.includes('romper')) {
    return n.includes('baby') || n.includes('romper') || n.includes('infant') || n.includes('onesie');
  }
  if (s.includes('uniform')) {
    return n.includes('uniform') || n.includes('school');
  }
  return false;
}

function resolveGarmentSubcategory(name: string, catTag?: string, currentSub?: string): string {
  const n = (name || '').toLowerCase();
  const cat = (catTag || '').toUpperCase().replace(/_/g, '-');

  if (currentSub && typeof currentSub === 'string' && currentSub.trim().length > 0 && currentSub !== 'General' && currentSub !== 'NONE') {
    const cleanSub = currentSub.trim();
    if (cleanSub.toLowerCase() === 'occasion wear' || cleanSub.toLowerCase() === 'party wear') {
      if (n.includes('lehenga') || n.includes('ghagra') || n.includes('choli')) return 'Lehengas';
      if (n.includes('gown')) return 'Gowns';
      if (n.includes('dress') || n.includes('maxi')) return 'Western Dresses';
    }
    return cleanSub;
  }

  if (cat.includes('MEN') && !cat.includes('WOMEN')) {
    if (n.includes('shirt') && !n.includes('t-shirt')) return 'Shirts';
    if (n.includes('t-shirt') || n.includes('polo')) return 'T-Shirts';
    if (n.includes('jeans') || n.includes('denim') || n.includes('trouser') || n.includes('chino')) return 'Jeans & Trousers';
    if (n.includes('kurta') || n.includes('dhoti') || n.includes('sherwani') || n.includes('nehru') || n.includes('waistcoat')) return 'Ethnic Wear';
    if (n.includes('suit') || n.includes('blazer') || n.includes('coat')) return 'Suits & Blazers';
    if (n.includes('jacket') || n.includes('windcheater') || n.includes('bomber')) return 'Jackets';
    if (n.includes('sweater') || n.includes('pullover') || n.includes('winter') || n.includes('cardigan') || n.includes('hoodie')) return 'Winter Wear';
    if (n.includes('short') || n.includes('bermuda')) return 'Shorts';
    if (n.includes('track') || n.includes('gym')) return 'Activewear';
    if (n.includes('tie') || n.includes('pocket square')) return 'Formal Accessories';
  }
  if (cat.includes('WOMEN')) {
    if (n.includes('saree')) return 'Sarees';
    if (n.includes('blouse')) return 'Blouses';
    if (n.includes('kurti') || n.includes('kurta')) return 'Kurtis & Kurtas';
    if (n.includes('salwar') || n.includes('suit') || n.includes('sharara') || n.includes('gharara') || n.includes('churidar')) return 'Salwar Suits';
    if (n.includes('lehenga') || n.includes('ghagra') || n.includes('choli')) return 'Lehengas';
    if (n.includes('gown')) return 'Gowns';
    if (n.includes('dress') || n.includes('maxi')) return 'Western Dresses';
    if (n.includes('top')) return 'Tops & Shirts';
    if (n.includes('jeans') || n.includes('legging') || n.includes('plazo') || n.includes('jeggings')) return 'Bottoms';
    if (n.includes('jacket') || n.includes('shrug') || n.includes('coat') || n.includes('blazer')) return 'Jackets';
    if (n.includes('winter') || n.includes('sweater') || n.includes('shawl') || n.includes('pashmina') || n.includes('cardigan')) return 'Winter Wear';
    if (n.includes('dupatta') || n.includes('stole')) return 'Dupattas';
    if (n.includes('nighty') || n.includes('loungewear')) return 'Loungewear';
  }
  if (cat.includes('KID')) {
    if (n.includes('shirt') || n.includes('top') || n.includes('t-shirt')) return 'Tops & Shirts';
    if (n.includes('pant') || n.includes('short') || n.includes('trouser') || n.includes('jogger')) return 'Bottoms';
    if (n.includes('uniform')) return 'School Uniforms';
    if (n.includes('sweater') || n.includes('cardigan') || n.includes('hoodie')) return 'Winter Wear';
    if (n.includes('frock') || n.includes('kurta') || n.includes('dhoti') || n.includes('lehenga') || n.includes('sherwani') || n.includes('dress')) return 'Ethnic & Dresses';
    if (n.includes('romper') || n.includes('onesie') || n.includes('pajama') || n.includes('baby')) return 'Baby Care';
    if (n.includes('toy') || n.includes('teddy')) return 'Toys & Soft Care';
  }
  if (cat.includes('HOME')) {
    if (n.includes('bedsheet') || n.includes('bed sheet') || n.includes('bed cover')) return 'Bedsheets & Covers';
    if (n.includes('blanket') || n.includes('quilt') || n.includes('comforter') || n.includes('duvet')) return 'Blankets & Quilts';
    if (n.includes('curtain')) return 'Curtains & Drapes';
    if (n.includes('towel')) return 'Bath Linen';
    if (n.includes('cushion') || n.includes('sofa') || n.includes('pillow')) return 'Cushions & Covers';
  }
  if (cat.includes('FOOTWEAR')) {
    if (n.includes('sneaker') || n.includes('sports')) return 'Sneakers & Sports';
    if (n.includes('formal') || n.includes('leather')) return 'Formal Shoes';
    if (n.includes('suede') || n.includes('nubuck') || n.includes('boot')) return 'Boots & Suede';
  }
  if (cat.includes('ACCESSORIES')) {
    if (n.includes('backpack') || n.includes('school bag')) return 'Backpacks';
    if (n.includes('handbag') || n.includes('luxury')) return 'Handbags';
    if (n.includes('trolley') || n.includes('suitcase')) return 'Luggage & Travel';
    if (n.includes('helmet')) return 'Riding Helmets';
  }
  return currentSub || 'Garments';
}

// In-memory catalog cache for INSTANT screen transitions (<16ms)
let cachedDynamicCatalog: Catalog | null = null;
let lastCatalogFetchTime = 0;
const CATALOG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHED_CATALOG_STORAGE_KEY = '@laundryfresh_cached_catalog_v2';

// Immediately hydrate from local storage on module initialization (<5ms)
void (async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHED_CATALOG_STORAGE_KEY);
    if (raw && !cachedDynamicCatalog) {
      cachedDynamicCatalog = JSON.parse(raw);
    }
  } catch {}
})();

// Global prefetch utility to pre-warm catalog in background on app launch
export async function prefetchCatalog(): Promise<void> {
  const now = Date.now();
  if (cachedDynamicCatalog && now - lastCatalogFetchTime < CATALOG_CACHE_TTL) {
    return;
  }
  try {
    const res = await api.getCatalog();
    let rawCatalog: Catalog | null = null;
    if (res && typeof res === 'object') {
      if ('data' in res && (res as any).data) {
        rawCatalog = (res as any).data as Catalog;
      } else if ('clothTypes' in res) {
        rawCatalog = res as Catalog;
      }
    }

    if (rawCatalog && Array.isArray(rawCatalog.clothTypes)) {
      let cloths = rawCatalog.clothTypes;
      const [hiddenSet, clothOverrides] = await Promise.all([
        (api as any).getHiddenGarmentIds ? (api as any).getHiddenGarmentIds().catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
        (api as any).getClothOverrides ? (api as any).getClothOverrides().catch(() => ({})) : Promise.resolve({}),
      ]);
      if (hiddenSet && hiddenSet.size > 0) {
        cloths = cloths.filter((item: any) => !hiddenSet.has(item.id));
      }
      if (clothOverrides && typeof clothOverrides === 'object') {
        cloths = cloths.map((item: any) =>
          clothOverrides[item.id] ? { ...item, ...clothOverrides[item.id] } : item
        );
      }
      rawCatalog = { ...rawCatalog, clothTypes: cloths };
    }

    if (rawCatalog) {
      cachedDynamicCatalog = rawCatalog;
      lastCatalogFetchTime = Date.now();
      void AsyncStorage.setItem(CACHED_CATALOG_STORAGE_KEY, JSON.stringify(rawCatalog)).catch(() => {});
    }
  } catch (err) {
    console.warn('[prefetchCatalog] error:', err);
  }
}

interface ProductCardProps {
  cloth: ProductItem;
  cardWidth: number;
  chosenService: ServicePriceOption;
  cartQty: number;
  cartQtyMap: Record<string, number>;
  isFavorite: boolean;
  colors: any;
  isDark: boolean;
  onSelectProduct?: (product: ProductItem, serviceId?: string) => void;
  onToggleWishlist: (clothId: string, clothName?: string) => void;
  onSelectService: (clothId: string, serviceId: string) => void;
  onAddToCart: (cloth: ProductItem, service: ServicePriceOption) => void;
  onIncrement: (cloth: ProductItem, service: ServicePriceOption) => void;
  onDecrement: (cloth: ProductItem, service: ServicePriceOption) => void;
}

const ProductCard = React.memo(function ProductCard({
  cloth,
  cardWidth,
  chosenService,
  cartQty,
  cartQtyMap,
  isFavorite,
  colors,
  isDark,
  onSelectProduct,
  onToggleWishlist,
  onSelectService,
  onAddToCart,
  onIncrement,
  onDecrement,
}: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageErrorLevel, setImageErrorLevel] = useState<'none' | 'primary' | 'fallback' | 'failed'>('none');

  const reliableGarmentPhoto = getGarmentImageUrl(cloth.id, undefined, cloth.categoryTag, cloth.name);
  const primaryPhotoUrl = cloth.imageUrl
    ? getGarmentImageUrl(cloth.id, cloth.imageUrl, cloth.categoryTag, cloth.name)
    : reliableGarmentPhoto;

  const photoUrl =
    imageErrorLevel === 'failed'
      ? undefined
      : imageErrorLevel === 'fallback'
      ? FALLBACK_PHOTO
      : imageErrorLevel === 'primary'
      ? reliableGarmentPhoto
      : primaryPhotoUrl;

  const turnaround = formatTurnaround(chosenService.turnaroundHours);

  return (
    <View
      style={[
        styles.productCard,
        {
          width: cardWidth,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* PRODUCT IMAGE (Elevated 136px height, clean cover crop) */}
      <Pressable
        style={[styles.cardImageContainer, { backgroundColor: colors.section }]}
        onPress={() => onSelectProduct?.(cloth, chosenService.serviceId)}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${cloth.name}`}
      >
        {photoUrl ? (
          <>
            <Image
              source={{ uri: photoUrl, cache: 'force-cache' }}
              style={styles.cardImage}
              resizeMode="cover"
              onLoadEnd={() => setImageLoaded(true)}
              onError={() => {
                setImageErrorLevel((prev) => {
                  if (prev === 'none' && primaryPhotoUrl !== reliableGarmentPhoto) {
                    return 'primary';
                  }
                  if (prev !== 'fallback' && photoUrl !== FALLBACK_PHOTO) {
                    return 'fallback';
                  }
                  return 'failed';
                });
                setImageLoaded(true);
              }}
            />
            {!imageLoaded && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="small" color="#16A34A" />
              </View>
            )}
          </>
        ) : (
          <View style={[styles.cardImageFallback, { backgroundColor: colors.section }]}>
            <MaterialCommunityIcons
              name={getSubcategoryFallbackIcon(cloth.subcategory || '', cloth.categoryTag) as any}
              size={36}
              color={colors.border}
            />
          </View>
        )}

        {/* Subcategory Pill Tag */}
        {(cloth.subcategory || cloth.categoryLabel) && (
          <View
            style={[
              styles.cardSubcatBadge,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.cardSubcatBadgeText, { color: colors.textBody }]} numberOfLines={1}>
              {cloth.subcategory || cloth.categoryLabel}
            </Text>
          </View>
        )}

        {/* Favorite Heart Button */}
        <Pressable
          style={[styles.favoriteCircleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onToggleWishlist(cloth.id, cloth.name)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? `Remove ${cloth.name} from saved items` : `Save ${cloth.name}`}
        >
          <MaterialCommunityIcons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={15}
            color={isFavorite ? '#EF4444' : colors.textCaption}
          />
        </Pressable>

        {turnaround ? (
          <View style={styles.turnaroundBadge}>
            <MaterialCommunityIcons name="lightning-bolt" size={10} color="#16A34A" />
            <Text style={styles.turnaroundBadgeText}>{turnaround} TAT</Text>
          </View>
        ) : null}
      </Pressable>

      {/* PRODUCT CARD BODY */}
      <View style={styles.cardBody}>
        {/* Title & Services Count Pill */}
        <Pressable
          onPress={() => onSelectProduct?.(cloth, chosenService.serviceId)}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${cloth.name}`}
          style={styles.titleWrap}
        >
          <View style={styles.titleWithBadgeRow}>
            <Text style={[styles.productCardTitle, { color: colors.textHeading }]} numberOfLines={1}>
              {cloth.name}
            </Text>
            {cloth.services.length > 0 && (
              <View
                style={[
                  styles.servicesCountBadge,
                  { backgroundColor: isDark ? 'rgba(22, 163, 74, 0.15)' : '#DCFCE7' },
                ]}
              >
                <Text style={[styles.servicesCountBadgeText, { color: isDark ? '#4ADE80' : '#15803D' }]}>
                  {cloth.services.length} {cloth.services.length === 1 ? 'service' : 'services'}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.productCardSubtitle, { color: colors.textCaption }]} numberOfLines={1}>
            {cloth.subcategory || cloth.categoryLabel || 'Fabric care'}
          </Text>
        </Pressable>

        {/* Vertical Services List with Direct Add on each service */}
        <View style={styles.verticalServicesList}>
          {cloth.services.map((srv) => {
            const srvQty =
              cartQtyMap[`${cloth.id}-${srv.serviceId}`] ??
              cartQtyMap[`cat-${cloth.id}-${srv.serviceId}`] ??
              cartQtyMap[`garment-${cloth.id}-${srv.serviceId}`] ??
              0;
            const isChosen = chosenService.serviceId === srv.serviceId;

            return (
              <View
                key={srv.serviceId}
                style={[
                  styles.verticalServiceRow,
                  {
                    backgroundColor: srvQty > 0
                      ? (isDark ? 'rgba(22, 163, 74, 0.14)' : '#F0FDF4')
                      : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC'),
                    borderColor: srvQty > 0
                      ? '#16A34A'
                      : isChosen
                      ? (isDark ? 'rgba(22, 163, 74, 0.4)' : '#86EFAC')
                      : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0'),
                  },
                ]}
              >
                {/* Service Name & Price Column */}
                <Pressable
                  style={styles.verticalServiceInfo}
                  onPress={() => onSelectService(cloth.id, srv.serviceId)}
                  hitSlop={3}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${srv.displayName}`}
                >
                  <View style={styles.verticalServiceNameRow}>
                    <MaterialCommunityIcons
                      name={srv.icon as any}
                      size={11.5}
                      color={srvQty > 0 ? '#16A34A' : colors.textCaption}
                      style={{ marginRight: 3.5 }}
                    />
                    <Text
                      style={[
                        styles.verticalServiceNameText,
                        { color: srvQty > 0 ? (isDark ? '#4ADE80' : '#15803D') : colors.textHeading },
                      ]}
                      numberOfLines={1}
                    >
                      {srv.displayName}
                    </Text>
                  </View>

                  <View style={styles.verticalServicePriceRow}>
                    <Text style={[styles.verticalServicePriceText, { color: colors.textHeading }]}>
                      ₹{srv.price}
                    </Text>
                    <Text style={[styles.verticalServiceUnitText, { color: colors.textCaption }]}>
                      /{srv.unit === 'KG' ? 'kg' : 'pc'}
                    </Text>
                  </View>
                </Pressable>

                {/* Direct Action: + ADD or [-] {qty} [+] */}
                <View style={styles.verticalServiceAction}>
                  {srvQty > 0 ? (
                    <View style={styles.verticalQtyCounter}>
                      <Pressable
                        onPress={() => onDecrement(cloth, srv)}
                        style={styles.verticalQtyBtn}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease ${srv.displayName}`}
                      >
                        <MaterialCommunityIcons name="minus" size={11} color="#FFFFFF" />
                      </Pressable>
                      <Text style={styles.verticalQtyNumber}>{srvQty}</Text>
                      <Pressable
                        onPress={() => onIncrement(cloth, srv)}
                        style={styles.verticalQtyBtn}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase ${srv.displayName}`}
                      >
                        <MaterialCommunityIcons name="plus" size={11} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        onSelectService(cloth.id, srv.serviceId);
                        onAddToCart(cloth, srv);
                      }}
                      style={styles.verticalAddBtn}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${srv.displayName} for ₹${srv.price}`}
                    >
                      <MaterialCommunityIcons name="plus" size={11} color="#15803D" />
                      <Text style={styles.verticalAddBtnText}>ADD</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* View Details Link */}
        <Pressable
          onPress={() => onSelectProduct?.(cloth, chosenService.serviceId)}
          style={styles.viewDetailFooter}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`View full details for ${cloth.name}`}
        >
          <Text style={[styles.viewDetailFooterText, { color: isDark ? '#4ADE80' : '#16A34A' }]}>
            View all {cloth.services.length} services →
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const SubcategoryCircleItem = React.memo(function SubcategoryCircleItem({
  sub,
  displayName,
  subPhotoUrl,
  fallbackIcon,
  isSelected,
  colors,
  onPress,
}: {
  sub: string;
  displayName: string;
  subPhotoUrl?: string;
  fallbackIcon: string;
  isSelected: boolean;
  colors: any;
  onPress: (sub: string) => void;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <Pressable
      style={styles.subcatCircleItem}
      onPress={() => onPress(sub)}
      hitSlop={4}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Show ${displayName} garments`}
    >
      <View
        style={[
          styles.subcatCircleWrap,
          { backgroundColor: colors.section, borderColor: colors.border },
          isSelected && styles.subcatCircleWrapSelected,
        ]}
      >
        <View style={styles.subcatIconLayer}>
          <MaterialCommunityIcons
            name={fallbackIcon as any}
            size={20}
            color={isSelected ? '#16A34A' : colors.textCaption}
          />
        </View>
        {subPhotoUrl && !hasError && (
          <Image
            source={{ uri: subPhotoUrl }}
            style={styles.subcatCircleImg}
            resizeMode="cover"
            onError={() => setHasError(true)}
          />
        )}
      </View>
      <Text
        style={[
          styles.subcatCircleText,
          { color: colors.textCaption },
          isSelected && styles.subcatCircleTextSelected,
        ]}
        numberOfLines={1}
      >
        {displayName}
      </Text>
    </Pressable>
  );
});

export function CategoryCatalogScreen({
  categoryTag = 'MENS',
  categoryTitle = "Men's Wear",
  initialServiceFilter = 'ALL',
  initialServiceName,
  onBack,
  onViewCart,
  onOpenCart,
  onOpenBulkLaundry,
  onSelectProduct,
  hasBottomTabBar = false,
}: CategoryCatalogScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { catalog, cart, cartSummary, addCartItem, setCartQuantity, removeFromCart, wishlist, toggleWishlist } = useApp();
  const initialCategoryTag = normalizeCategoryTag(categoryTag);

  // Active Category State
  const [activeCategoryTag, setActiveCategoryTag] = useState<string>(initialCategoryTag);
  const [activeCategoryTitle, setActiveCategoryTitle] = useState<string>(
    categoryTitle || (categoryTag === 'ALL' ? 'All Garments' : "Men's Wear")
  );

  // Filters State
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('ALL');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<CatalogServiceFilter>(
    (initialServiceFilter as any) || 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [activeSorts, setActiveSorts] = useState<CatalogSortOption[]>(['POPULAR']);
  const [selectedLetterFilter, setSelectedLetterFilter] = useState<string>('ALL');
  const [filterTat24h, setFilterTat24h] = useState<boolean>(false);
  const [priceRangeFilter, setPriceRangeFilter] = useState<PriceRangeFilter>('ALL');
  const [isSortFilterModalOpen, setIsSortFilterModalOpen] = useState<boolean>(false);

  // Toggle multi-sort options (supports simultaneous Price + Alphabetical sort)
  const toggleSortOption = useCallback((sortKey: CatalogSortOption) => {
    setActiveSorts((prev) => {
      if (sortKey === 'POPULAR') {
        return ['POPULAR'];
      }
      let next = prev.filter((s) => s !== 'POPULAR');
      if (sortKey === 'PRICE_LOW') {
        if (next.includes('PRICE_LOW')) {
          next = next.filter((s) => s !== 'PRICE_LOW');
        } else {
          next = next.filter((s) => s !== 'PRICE_HIGH').concat('PRICE_LOW');
        }
      } else if (sortKey === 'PRICE_HIGH') {
        if (next.includes('PRICE_HIGH')) {
          next = next.filter((s) => s !== 'PRICE_HIGH');
        } else {
          next = next.filter((s) => s !== 'PRICE_LOW').concat('PRICE_HIGH');
        }
      } else if (sortKey === 'NAME_AZ') {
        if (next.includes('NAME_AZ')) {
          next = next.filter((s) => s !== 'NAME_AZ');
        } else {
          next = [...next, 'NAME_AZ'];
        }
      } else if (sortKey === 'FASTEST') {
        if (next.includes('FASTEST')) {
          next = next.filter((s) => s !== 'FASTEST');
        } else {
          next = [...next, 'FASTEST'];
        }
      }
      return next.length === 0 ? ['POPULAR'] : next;
    });
  }, []);

  // Track chosen service per cloth ID
  const [selectedClothServiceMap, setSelectedClothServiceMap] = useState<Record<string, string>>({});

  // Dynamic Catalog State initialized instantly from memory cache
  const [dynamicCatalog, setDynamicCatalog] = useState<Catalog | null>(() => cachedDynamicCatalog);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedDynamicCatalog && !catalog);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Sync if cachedDynamicCatalog was hydrated from AsyncStorage
  useEffect(() => {
    if (!dynamicCatalog && cachedDynamicCatalog) {
      setDynamicCatalog(cachedDynamicCatalog);
      setIsLoading(false);
    }
  }, [dynamicCatalog]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const freshCatalog = await api.getCatalog();
      if (freshCatalog && Array.isArray(freshCatalog.clothTypes)) {
        let cloths = freshCatalog.clothTypes;
        const [hiddenSet, clothOverrides] = await Promise.all([
          (api as any).getHiddenGarmentIds ? (api as any).getHiddenGarmentIds().catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
          (api as any).getClothOverrides ? (api as any).getClothOverrides().catch(() => ({})) : Promise.resolve({}),
        ]);
        if (hiddenSet && hiddenSet.size > 0) {
          cloths = cloths.filter((item: any) => !hiddenSet.has(item.id));
        }
        if (clothOverrides && typeof clothOverrides === 'object') {
          cloths = cloths.map((item: any) =>
            clothOverrides[item.id] ? { ...item, ...clothOverrides[item.id] } : item
          );
        }
        const updated = { ...freshCatalog, clothTypes: cloths };
        cachedDynamicCatalog = updated;
        lastCatalogFetchTime = Date.now();
        void AsyncStorage.setItem(CACHED_CATALOG_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
        setDynamicCatalog(updated);
      }
    } catch (error) {
      console.error('[CategoryCatalogScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Sync categoryTag & service filter changes only when actually changed (prevents redundant re-render on mount)
  const prevTagRef = useRef(categoryTag);
  const prevTitleRef = useRef(categoryTitle);
  const prevFilterRef = useRef(initialServiceFilter);

  useEffect(() => {
    if (categoryTag && categoryTag !== prevTagRef.current) {
      prevTagRef.current = categoryTag;
      const norm = normalizeCategoryTag(categoryTag);
      setActiveCategoryTag(norm);
    }
    if (categoryTitle && categoryTitle !== prevTitleRef.current) {
      prevTitleRef.current = categoryTitle;
      setActiveCategoryTitle(categoryTitle);
    }
    if (initialServiceFilter && initialServiceFilter !== prevFilterRef.current) {
      prevFilterRef.current = initialServiceFilter;
      setSelectedServiceFilter((initialServiceFilter as any) || 'ALL');
    }
  }, [categoryTag, categoryTitle, initialServiceFilter]);

  // Fetch full live catalog in background with caching (Stale-While-Revalidate)
  useEffect(() => {
    let isMounted = true;
    const now = Date.now();
    const isCacheExpired = !cachedDynamicCatalog || (now - lastCatalogFetchTime > CATALOG_CACHE_TTL);

    if (!cachedDynamicCatalog && !catalog) {
      setIsLoading(true);
    }

    if (isCacheExpired) {
      api
        .getCatalog()
        .then(async (res) => {
          if (!isMounted) return;
          let rawCatalog: Catalog | null = null;
          if (res && typeof res === 'object') {
            if ('data' in res && (res as any).data) {
              rawCatalog = (res as any).data as Catalog;
            } else if ('clothTypes' in res) {
              rawCatalog = res as Catalog;
            }
          }

          if (rawCatalog && Array.isArray(rawCatalog.clothTypes)) {
            let cloths = rawCatalog.clothTypes;
            const [hiddenSet, clothOverrides] = await Promise.all([
              (api as any).getHiddenGarmentIds ? (api as any).getHiddenGarmentIds().catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
              (api as any).getClothOverrides ? (api as any).getClothOverrides().catch(() => ({})) : Promise.resolve({}),
            ]);
            if (hiddenSet && hiddenSet.size > 0) {
              cloths = cloths.filter((item: any) => !hiddenSet.has(item.id));
            }
            if (clothOverrides && typeof clothOverrides === 'object') {
              cloths = cloths.map((item: any) =>
                clothOverrides[item.id] ? { ...item, ...clothOverrides[item.id] } : item
              );
            }
            rawCatalog = { ...rawCatalog, clothTypes: cloths };
          }

          if (rawCatalog && isMounted) {
            cachedDynamicCatalog = rawCatalog;
            lastCatalogFetchTime = Date.now();
            void AsyncStorage.setItem(CACHED_CATALOG_STORAGE_KEY, JSON.stringify(rawCatalog)).catch(() => {});
            setDynamicCatalog(rawCatalog);
          }
        })
        .catch((err) => {
          console.warn('[CategoryCatalogScreen] Fetch catalog error:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [catalog]);

  // Filter cloths matching activeCategoryTag
  const activeClothTypes = useMemo(() => {
    const list = dynamicCatalog?.clothTypes || catalog?.clothTypes || [];
    if (!activeCategoryTag || activeCategoryTag === 'ALL') return list;
    const cleanTag = activeCategoryTag.toUpperCase().replace(/_/g, '-');
    return list.filter((c: any) => {
      if (c?.isActive === false) return false;
      const cTag = (c.categoryTag || '').toUpperCase().replace(/_/g, '-');
      const cId = (c.id || '').toLowerCase();
      const cName = (c.name || '').toLowerCase();
      if (cleanTag === 'WEDDING') {
        return cTag === 'WEDDING' || cId.includes('saree') || cId.includes('lehenga') || cId.includes('sherwani') || cName.includes('silk') || cName.includes('bridal');
      }
      return (
        cTag === cleanTag ||
        (cleanTag === 'HOME-TEXTILES' && (cTag === 'HOME' || cTag === 'HOME-TEXTILES')) ||
        (cleanTag === 'HOME' && (cTag === 'HOME' || cTag === 'HOME-TEXTILES')) ||
        (cleanTag === 'FOOTWEAR' && (cTag === 'FOOTWEAR' || cTag === 'SHOES')) ||
        (cleanTag === 'ACCESSORIES' && (cTag === 'ACCESSORIES' || cTag === 'BAGS'))
      );
    });
  }, [dynamicCatalog, catalog, activeCategoryTag]);

  const activePriceMatrix = useMemo(() => {
    return dynamicCatalog?.priceMatrix || catalog?.priceMatrix || [];
  }, [dynamicCatalog, catalog]);

  const activeServiceMasters = useMemo(() => {
    return (dynamicCatalog?.serviceMasters || catalog?.serviceMasters || []).filter((service: any) => service?.isActive !== false);
  }, [dynamicCatalog, catalog]);

  const serviceMastersById = useMemo(
    () => new Map(activeServiceMasters.map((service: any) => [service.id, service])),
    [activeServiceMasters]
  );

  // Dynamic Categories List from backend catalog
  const categoriesList = useMemo(() => {
    const rawCategories = dynamicCatalog?.categories || catalog?.categories;
    let list: Array<{ tag: string; label: string; icon: string; imageUrl?: string; slug?: string }> = [];

    if (rawCategories && Array.isArray(rawCategories) && rawCategories.length > 0) {
      list = rawCategories.map((rc) => {
        let tag = rc.slug.toUpperCase().replace(/-/g, '_');
        if (rc.slug.includes('men') && !rc.slug.includes('women')) tag = 'MENS';
        else if (rc.slug.includes('women')) tag = 'WOMENS';
        else if (rc.slug.includes('kid') || rc.slug.includes('baby')) tag = 'KIDS';
        else if (rc.slug.includes('home') || rc.slug.includes('textile') || rc.slug.includes('linen')) tag = 'HOME_TEXTILES';
        else if (rc.slug.includes('bulk')) tag = 'BULK';
        else if (rc.slug.includes('shoe') || rc.slug.includes('footwear')) tag = 'FOOTWEAR';
        else if (rc.slug.includes('bag') || rc.slug.includes('accessories')) tag = 'ACCESSORIES';
        else if (rc.slug.includes('bridal') || rc.slug.includes('wedding') || rc.slug.includes('silk')) tag = 'WEDDING';
        else if (rc.slug.includes('special')) tag = 'SPECIAL';

        let icon = 'tshirt-crew';
        if (tag === 'WOMENS') icon = 'hanger';
        else if (tag === 'KIDS') icon = 'baby-carriage';
        else if (tag === 'HOME_TEXTILES') icon = 'bed-outline';
        else if (tag === 'FOOTWEAR') icon = 'shoe-sneaker';
        else if (tag === 'ACCESSORIES') icon = 'bag-personal-outline';
        else if (tag === 'BULK') icon = 'scale';
        else if (tag === 'WEDDING') icon = 'crown-outline';
        else if (tag === 'SPECIAL') icon = 'sparkles';

        return {
          tag,
          label: rc.name,
          icon,
          imageUrl: rc.imageUrl || rc.image,
          slug: rc.slug,
        };
      });
    } else {
      list = MAIN_CATEGORIES.filter((c) => c.tag !== 'ALL');
    }

    return [
      { tag: 'ALL', label: 'All Items', icon: 'view-grid-outline', slug: 'all' },
      ...list,
    ];
  }, [dynamicCatalog?.categories, catalog?.categories]);

  // Build product items with price options first so subcategories can be filtered by product presence
  const products: ProductItem[] = useMemo(() => {
    const matrixLookup: Record<string, any[]> = {};
    activePriceMatrix.forEach((pm: any) => {
      if (!pm || pm.isActive === false || pm.isAvailable === false) return;
      const clothId = pm.clothTypeId || pm.clothId;
      const price = Number(pm.price);
      if (!clothId || !pm.serviceId || !Number.isFinite(price) || price <= 0) return;
      const master = serviceMastersById.get(pm.serviceId);
      if (master?.isActive === false) return;
      if (!matrixLookup[clothId]) matrixLookup[clothId] = [];
      matrixLookup[clothId].push(pm);
    });

    return activeClothTypes.map((cloth: any) => {
      const rawServices: ServicePriceOption[] = (matrixLookup[cloth.id] || [])
        .map((priceItem: any) => {
          const master = serviceMastersById.get(priceItem.serviceId);
          const details = getServiceDetails(
            priceItem.serviceId,
            priceItem.serviceName || master?.name,
            (master as any)?.serviceCode
          );

          return {
            serviceId: priceItem.serviceId,
            serviceName: priceItem.serviceName || master?.name || details.displayName,
            displayName: details.displayName,
            shortLabel: details.shortLabel,
            serviceCode: details.serviceCode,
            price: Number(priceItem.price),
            icon: details.icon,
            unit: priceItem.unit || 'Piece',
            turnaroundHours: Number(priceItem.turnaroundHours || master?.turnaroundHours) || undefined,
          };
        });

      // Deduplicate by serviceCode so each service appears at most once per garment
      const uniqueServicesMap = new Map<CatalogServiceCode, ServicePriceOption>();
      rawServices.forEach((srv) => {
        const existing = uniqueServicesMap.get(srv.serviceCode);
        if (!existing || srv.price < existing.price) {
          uniqueServicesMap.set(srv.serviceCode, srv);
        }
      });

      const servicesForCloth: ServicePriceOption[] = Array.from(uniqueServicesMap.values())
        .sort((a, b) => {
          const aOrder = SERVICE_FILTER_ORDER_MAP[a.serviceCode] ?? 999;
          const bOrder = SERVICE_FILTER_ORDER_MAP[b.serviceCode] ?? 999;
          return aOrder - bOrder;
        });

      const validPrices = servicesForCloth.map((s) => s.price).filter((p) => p > 0);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 20;

      const resolvedSub = resolveGarmentSubcategory(
        cloth.name,
        cloth.categoryTag || activeCategoryTag,
        cloth.subcategory || cloth.subCategory
      );

      return {
        id: cloth.id,
        name: cloth.name,
        categoryTag: cloth.categoryTag || activeCategoryTag,
        categoryLabel: cloth.categoryLabel || activeCategoryTitle,
        subcategory: resolvedSub,
        imageUrl: cloth.imageUrl || cloth.image,
        fallbackImageUrl: getGarmentImageUrl(cloth.id, undefined, cloth.categoryTag, cloth.name),
        description: cloth.description,
        services: servicesForCloth,
        minPrice,
      };
    }).filter((product) => product.services.length > 0);
  }, [activeClothTypes, activePriceMatrix, activeCategoryTag, activeCategoryTitle, serviceMastersById]);

  // Subcategory matching helper
  const productMatchesSubcategory = useCallback((p: ProductItem, targetSub: string): boolean => {
    if (!targetSub || targetSub === 'ALL') return true;
    const t = targetSub.toLowerCase().trim();
    const s = String(p.subcategory || '').toLowerCase().trim();
    const n = String(p.name || '').toLowerCase().trim();

    // 1. Exact match
    if (s === t) return true;

    // 2. Substring match on subcategory (e.g. 'T-Shirts' matching 'T-Shirts & Polos')
    if (s && (s.includes(t) || t.includes(s))) {
      // Guard: do not cross-match between 'Jackets' and 'Winter Wear'
      if (t === 'jackets' && s.includes('winter wear')) return false;
      if (t.includes('winter') && s === 'jackets') return false;
      return true;
    }

    // 3. If product has an explicit distinct subcategory that is not a generic fallback,
    // NEVER allow loose keyword matching across subcategory boundaries!
    if (s && s !== 'garments' && s !== 'general' && s !== 'all' && s !== 'none') {
      return false;
    }

    // 4. Keyword match for products with missing or generic subcategory
    return matchesSubcategoryKeyword(n, t);
  }, []);

  // Subcategories List: Extracted directly from API subcategories and active products
  const subcategoriesList = useMemo(() => {
    const apiSubcats = (dynamicCatalog?.subcategories || catalog?.subcategories || []).filter((s: any) => {
      if (s?.isActive === false) return false;
      const sTag = (s.categoryTag || '').toUpperCase().replace(/-/g, '_');
      const activeTag = (activeCategoryTag || '').toUpperCase().replace(/-/g, '_');
      return (
        activeCategoryTag === 'ALL' ||
        sTag === activeTag ||
        (activeTag === 'MENS' && (sTag === 'MENS' || sTag === 'MEN' || sTag === 'MENS_WEAR')) ||
        (activeTag === 'WOMENS' && (sTag === 'WOMENS' || sTag === 'WOMEN' || sTag === 'WOMENS_WEAR'))
      );
    }).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const productSubSet = new Set<string>();
    products.forEach((p) => {
      const sub = p.subcategory;
      if (sub && typeof sub === 'string' && sub.trim().length > 0 && sub.trim() !== 'General' && sub.trim() !== 'NONE') {
        productSubSet.add(sub.trim());
      }
    });

    const orderedSubcategories: string[] = [];
    apiSubcats.forEach((s: any) => {
      const match = Array.from(productSubSet).find((sub) => sub.toLowerCase() === s.name.toLowerCase());
      if (match && !orderedSubcategories.includes(match)) {
        orderedSubcategories.push(match);
      } else if (!orderedSubcategories.includes(s.name) && (activeCategoryTag === 'ALL' || productSubSet.size === 0)) {
        orderedSubcategories.push(s.name);
      }
    });

    // Add any subcategories from products not explicitly listed in API subcategories
    Array.from(productSubSet).forEach((sub) => {
      if (!orderedSubcategories.some((existing) => existing.toLowerCase() === sub.toLowerCase())) {
        orderedSubcategories.push(sub);
      }
    });

    return ['ALL', ...orderedSubcategories];
  }, [dynamicCatalog?.subcategories, catalog?.subcategories, products, activeCategoryTag]);

  // Guard: If currently selected subcategory has no products or is not in list, auto-reset to ALL
  useEffect(() => {
    if (selectedSubcategory !== 'ALL' && !subcategoriesList.includes(selectedSubcategory)) {
      setSelectedSubcategory('ALL');
    }
  }, [subcategoriesList, selectedSubcategory]);

  // Precomputed subcategory carousel render data (100% AWS S3 & API driven)
  const subcategoryRenderData = useMemo(() => {
    const currentCatObj = categoriesList.find((c) => c.tag === activeCategoryTag);
    const subObjMap = new Map<string, any>();
    (dynamicCatalog?.subcategories || catalog?.subcategories || []).forEach((s: any) => {
      const sTag = (s.categoryTag || '').toUpperCase().replace(/-/g, '_');
      const activeTag = (activeCategoryTag || '').toUpperCase().replace(/-/g, '_');
      const isTagMatch =
        activeCategoryTag === 'ALL' ||
        sTag === activeTag ||
        (activeTag === 'MENS' && (sTag === 'MENS' || sTag === 'MEN' || sTag === 'MENS_WEAR')) ||
        (activeTag === 'WOMENS' && (sTag === 'WOMENS' || sTag === 'WOMEN' || sTag === 'WOMENS_WEAR'));
      if (s && isTagMatch && s.name) {
        subObjMap.set(String(s.name).toLowerCase(), s);
      }
    });

    return subcategoriesList.map((sub) => {
      const isAll = sub === 'ALL';
      const matchedSubObj = subObjMap.get(String(sub).toLowerCase());
      
      // Match a product in this subcategory to use its authentic S3 product image
      const matchingProduct = products.find((p) => productMatchesSubcategory(p, sub));
      const productPhotoUrl = matchingProduct?.imageUrl || matchingProduct?.fallbackImageUrl;

      const subPhotoUrl = isAll
        ? (currentCatObj?.imageUrl || getCategoryImageUrl(activeCategoryTag))
        : (matchedSubObj?.imageUrl && !matchedSubObj.imageUrl.includes('unsplash')
            ? matchedSubObj.imageUrl
            : (productPhotoUrl || getSubcategoryImageUrl(sub, matchedSubObj?.categoryTag || activeCategoryTag)));
      const fallbackIcon = getSubcategoryFallbackIcon(sub, activeCategoryTag);

      return {
        sub,
        displayName: isAll ? 'All' : sub,
        subPhotoUrl,
        fallbackIcon,
      };
    });
  }, [subcategoriesList, activeCategoryTag, categoriesList, dynamicCatalog?.subcategories, catalog?.subcategories, products, productMatchesSubcategory]);

  const availableServiceFilters = useMemo(
    () => SERVICE_FILTERS.filter((filter) =>
      filter.key === 'ALL' || products.some((product) => product.services.some((service) => service.serviceCode === filter.key))
    ),
    [products]
  );

  // Fast Cart Quantity Map for O(1) lookups
  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cart) {
      if (c.id) map[c.id] = c.quantity;
      if (c.clothId && c.serviceId) {
        map[`${c.clothId}-${c.serviceId}`] = c.quantity;
      }
    }
    return map;
  }, [cart]);

  // Fast Wishlist Set for O(1) lookups
  const wishlistSet = useMemo(() => new Set(wishlist), [wishlist]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedSubcategory && selectedSubcategory !== 'ALL') {
      list = list.filter((p) => productMatchesSubcategory(p, selectedSubcategory));
    }

    if (selectedServiceFilter && selectedServiceFilter !== 'ALL') {
      list = list.filter((p) =>
        (p.services || []).some((s) => s.serviceCode === selectedServiceFilter)
      );
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = String(searchQuery).toLowerCase().trim();
      list = list.filter(
        (p) =>
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.subcategory || '').toLowerCase().includes(q) ||
          (p.services || []).some((s) => String(s.displayName || '').toLowerCase().includes(q))
      );
    }

    if (filterTat24h) {
      list = list.filter((p) =>
        (p.services || []).some(
          (s) =>
            s.serviceCode === 'EXPRESS' ||
            (s.turnaroundHours && s.turnaroundHours <= 24) ||
            s.displayName?.toLowerCase().includes('24h') ||
            s.displayName?.toLowerCase().includes('express') ||
            s.serviceName?.toLowerCase().includes('24h')
        )
      );
    }

    if (priceRangeFilter === 'UNDER_50') {
      list = list.filter((p) => p.minPrice < 50);
    } else if (priceRangeFilter === '50_TO_150') {
      list = list.filter((p) => p.minPrice >= 50 && p.minPrice <= 150);
    } else if (priceRangeFilter === 'ABOVE_150') {
      list = list.filter((p) => p.minPrice > 150);
    }

    if (selectedLetterFilter && selectedLetterFilter !== 'ALL') {
      const targetLetter = selectedLetterFilter.toUpperCase().trim();
      list = list.filter((p) => (p.name || '').trim().toUpperCase().startsWith(targetLetter));
    }

    const priceForSort = (product: ProductItem) => {
      const filterMatch = selectedServiceFilter === 'ALL'
        ? undefined
        : product.services.find((service) => service.serviceCode === selectedServiceFilter);
      const manualMatch = product.services.find((service) => service.serviceId === selectedClothServiceMap[product.id]);
      return manualMatch?.price ?? filterMatch?.price ?? product.minPrice;
    };

    const hasPriceLow = activeSorts.includes('PRICE_LOW');
    const hasPriceHigh = activeSorts.includes('PRICE_HIGH');
    const hasNameAz = activeSorts.includes('NAME_AZ');
    const hasFastest = activeSorts.includes('FASTEST');

    if (hasPriceLow && hasNameAz) {
      // Both Price: Low-to-High AND Alphabetical (A-Z) applied simultaneously!
      list = [...list].sort((a, b) => {
        const pDiff = priceForSort(a) - priceForSort(b);
        if (pDiff !== 0) return pDiff;
        return (a.name || '').localeCompare(b.name || '');
      });
    } else if (hasPriceHigh && hasNameAz) {
      // Both Price: High-to-Low AND Alphabetical (A-Z) applied simultaneously!
      list = [...list].sort((a, b) => {
        const pDiff = priceForSort(b) - priceForSort(a);
        if (pDiff !== 0) return pDiff;
        return (a.name || '').localeCompare(b.name || '');
      });
    } else if (hasPriceLow) {
      list = [...list].sort((a, b) => priceForSort(a) - priceForSort(b));
    } else if (hasPriceHigh) {
      list = [...list].sort((a, b) => priceForSort(b) - priceForSort(a));
    } else if (hasFastest) {
      list = [...list].sort((a, b) => {
        const aTat = Math.min(...(a.services.map((s) => s.turnaroundHours || 48)));
        const bTat = Math.min(...(b.services.map((s) => s.turnaroundHours || 48)));
        return aTat - bTat;
      });
    } else if (hasNameAz) {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [products, selectedSubcategory, selectedServiceFilter, searchQuery, activeSorts, selectedLetterFilter, filterTat24h, priceRangeFilter, selectedClothServiceMap, productMatchesSubcategory]);

  // Prefetch first batch of visible garment images into disk/memory cache for seamless rendering
  useEffect(() => {
    if (products && products.length > 0) {
      const topItems = products.slice(0, 30);
      topItems.forEach((p) => {
        const url = p.imageUrl || p.fallbackImageUrl;
        if (url && typeof url === 'string' && url.startsWith('http')) {
          Image.prefetch(url).catch(() => {});
        }
      });
    }
  }, [products]);

  const getSelectedServiceForCloth = useCallback(
    (cloth: ProductItem): ServicePriceOption => {
      if (selectedServiceFilter !== 'ALL') {
        const matchedFilter = cloth.services.find((s) => s.serviceCode === selectedServiceFilter);
        if (matchedFilter) return matchedFilter;
      }

      const selectedId = selectedClothServiceMap[cloth.id];
      if (selectedId) {
        const found = cloth.services.find((s) => s.serviceId === selectedId);
        if (found) return found;
      }

      return cloth.services[0]!;
    },
    [selectedServiceFilter, selectedClothServiceMap]
  );

  const handleSelectServiceForCloth = useCallback((clothId: string, serviceId: string) => {
    setSelectedClothServiceMap((prev) => ({
      ...prev,
      [clothId]: serviceId,
    }));
    setSelectedServiceFilter('ALL');
  }, []);

  const handleCartClick = onOpenCart || onViewCart || (() => {});

  // Cart Operations
  const handleAddToCart = useCallback(
    (cloth: ProductItem, service: ServicePriceOption) => {
      const cartItemId = `${cloth.id}-${service.serviceId}`;
      const cleanSvcName = service?.displayName || service?.serviceName || 'Standard Care';
      const displayName = `${cloth.name} (${cleanSvcName})`;
      const imgUrl = getGarmentImageUrl(cloth.id, cloth.imageUrl, cloth.categoryTag, cloth.name);

      addCartItem({
        id: cartItemId,
        serviceId: service.serviceId,
        serviceName: displayName,
        clothId: cloth.id,
        clothName: cloth.name,
        categoryName: activeCategoryTitle,
        pricingModel: service.unit === 'KG' ? 'PER_KG' : 'PER_ITEM',
        unitPrice: service.price,
        quantity: 1,
        unit: service.unit,
        subtotal: service.price,
        imageUrl: imgUrl,
      });
    },
    [activeCategoryTitle, addCartItem]
  );

  const getCartItemForProduct = useCallback(
    (cloth: ProductItem, serviceId: string) => {
      const directId = `${cloth.id}-${serviceId}`;
      return cart.find(
        (c) =>
          c.id === directId ||
          c.id === `cat-${directId}` ||
          c.id === `garment-${directId}` ||
          (c.clothId === cloth.id && c.serviceId === serviceId)
      );
    },
    [cart]
  );

  const handleIncrement = useCallback(
    (cloth: ProductItem, service: ServicePriceOption) => {
      const item = getCartItemForProduct(cloth, service.serviceId);
      if (item) {
        setCartQuantity(item.id, item.quantity + 1);
      } else {
        handleAddToCart(cloth, service);
      }
    },
    [getCartItemForProduct, setCartQuantity, handleAddToCart]
  );

  const handleDecrement = useCallback(
    (cloth: ProductItem, service: ServicePriceOption) => {
      const item = getCartItemForProduct(cloth, service.serviceId);
      if (!item) return;
      if (item.quantity <= 1) {
        removeFromCart(item.id);
      } else {
        setCartQuantity(item.id, item.quantity - 1);
      }
    },
    [getCartItemForProduct, removeFromCart, setCartQuantity]
  );

  const handleToggleWishlist = useCallback(
    (clothId: string) => {
      toggleWishlist(clothId);
    },
    [toggleWishlist]
  );

  // Clean Header Title
  const displayTitle = activeCategoryTag === 'ALL'
    ? (initialServiceName ? `${initialServiceName} Collection` : 'All Garments')
    : (categoriesList.find((cat) => cat.tag === activeCategoryTag)?.label || activeCategoryTitle || 'Catalog');

  // Responsive Grid Widths
  const SCREEN_PADDING = 12;
  const GRID_GAP = 10;
  const useSingleColumn = windowWidth < 340;
  const cardWidth = useSingleColumn
    ? Math.floor(windowWidth - SCREEN_PADDING * 2)
    : Math.floor((windowWidth - SCREEN_PADDING * 2 - GRID_GAP) / 2);
  const numColumns = useSingleColumn ? 1 : 2;

  const keyExtractor = useCallback((item: ProductItem) => item.id, []);

  const renderProductCard = useCallback(
    ({ item: cloth }: { item: ProductItem }) => {
      const chosenService = getSelectedServiceForCloth(cloth);
      const cartQty =
        cartQtyMap[`${cloth.id}-${chosenService.serviceId}`] ??
        cartQtyMap[`cat-${cloth.id}-${chosenService.serviceId}`] ??
        cartQtyMap[`garment-${cloth.id}-${chosenService.serviceId}`] ??
        0;
      const isFavorite = wishlistSet.has(cloth.id);

      return (
        <ProductCard
          cloth={cloth}
          cardWidth={cardWidth}
          chosenService={chosenService}
          cartQty={cartQty}
          cartQtyMap={cartQtyMap}
          isFavorite={isFavorite}
          colors={colors}
          isDark={isDark}
          onSelectProduct={onSelectProduct}
          onToggleWishlist={handleToggleWishlist}
          onSelectService={handleSelectServiceForCloth}
          onAddToCart={handleAddToCart}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
        />
      );
    },
    [
      getSelectedServiceForCloth,
      cartQtyMap,
      wishlistSet,
      cardWidth,
      colors,
      isDark,
      onSelectProduct,
      handleToggleWishlist,
      handleSelectServiceForCloth,
      handleAddToCart,
      handleIncrement,
      handleDecrement,
    ]
  );

  const bottomPadding = Math.max(insets.bottom, 16) + (hasBottomTabBar ? 104 : 24);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* 1. TOP APP BAR (Compact height, count badge, search toggle and cart shortcut with safe area inset) */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 16) + 4,
            height: 52 + Math.max(insets.top, 16) + 4,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.section, borderColor: colors.border },
            pressed && styles.pressedBtn,
          ]}
          onPress={onBack}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textHeading} />
        </Pressable>

        <View style={styles.titleColumn}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.topBarTitle, { color: colors.textHeading }]} numberOfLines={1}>
              {displayTitle}
            </Text>
            <View style={styles.countBadgePill}>
              <Text style={styles.countBadgePillText}>{filteredProducts.length}</Text>
            </View>
          </View>
          <Text style={[styles.topBarSubtitle, { color: colors.textCaption }]}>
            {selectedServiceFilter !== 'ALL'
              ? `${availableServiceFilters.find((filter) => filter.key === selectedServiceFilter)?.label || 'Selected service'}`
              : 'Tap garment for custom fabric care'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            style={[
              styles.headerActionBtn,
              { backgroundColor: colors.section, borderColor: colors.border },
              (isSearchOpen || searchQuery.length > 0) && styles.headerActionBtnActive,
            ]}
            onPress={() => setIsSearchOpen((prev) => !prev)}
            hitSlop={8}
            accessibilityLabel="Search"
          >
            <MaterialCommunityIcons
              name={isSearchOpen || searchQuery.length > 0 ? 'close' : 'magnify'}
              size={22}
              color={isSearchOpen || searchQuery.length > 0 ? '#16A34A' : colors.textHeading}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.cartBtn,
              { backgroundColor: isDark ? colors.section : '#F0FDF4', borderColor: isDark ? colors.border : '#BBF7D0' },
              pressed && styles.pressedBtn,
            ]}
            onPress={handleCartClick}
            hitSlop={8}
            accessibilityLabel={`Shopping bag, ${cartSummary.itemCount} items`}
          >
            <MaterialCommunityIcons name="shopping-outline" size={23} color={isDark ? '#34D399' : '#166534'} />
            {cartSummary.itemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartSummary.itemCount > 99 ? '99+' : cartSummary.itemCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* 2. MAIN CATEGORY TABS (Luxury pills, solid active glow) */}
      <View style={[styles.categoryTabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabsScroll}
        >
          {categoriesList.map((c) => {
            const isSelected = activeCategoryTag === c.tag;
            return (
              <Pressable
                key={c.tag}
                style={[
                  styles.categoryPill,
                  isSelected
                    ? styles.categoryPillSelected
                    : [styles.categoryPillUnselected, { backgroundColor: colors.section, borderColor: colors.border }],
                ]}
                onPress={() => {
                  if (c.tag === 'BULK' && onOpenBulkLaundry) {
                    onOpenBulkLaundry();
                    return;
                  }
                  setActiveCategoryTag(c.tag);
                  setActiveCategoryTitle(c.label);
                  setSelectedSubcategory('ALL');
                }}
                hitSlop={4}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Show ${c.label} garments`}
              >
                <MaterialCommunityIcons
                  name={c.icon as any}
                  size={14}
                  color={isSelected ? '#FFFFFF' : colors.textCaption}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected ? styles.categoryPillTextSelected : [styles.categoryPillTextUnselected, { color: colors.textBody }],
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. CONDITIONAL COMPACT SEARCH BAR */}
      {(isSearchOpen || searchQuery.length > 0) && (
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search in ${displayTitle}...`}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoFocus={isSearchOpen && searchQuery.length === 0}
              accessibilityLabel="Search garments"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear garment search">
                <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* 4. HORIZONTAL GARMENT SUBCATEGORY CAROUSEL (Never blank: verified photo + icon layer) */}
      <View style={[styles.subcatCarouselContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subcatCarouselScroll}
        >
          {subcategoryRenderData.map((item) => (
            <SubcategoryCircleItem
              key={item.sub}
              sub={item.sub}
              displayName={item.displayName}
              subPhotoUrl={item.subPhotoUrl}
              fallbackIcon={item.fallbackIcon}
              isSelected={selectedSubcategory === item.sub}
              colors={colors}
              onPress={setSelectedSubcategory}
            />
          ))}
        </ScrollView>
      </View>

      {/* 5. INTEGRATED SERVICE FILTERS & SORT ROW (Left pinned Sort & Filter + Quick Sort Pills + Full-width natural scroll) */}
      <View style={[styles.filterSortBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(() => {
          const nonPopularSortCount = activeSorts.filter((s) => s !== 'POPULAR').length;
          const isLetterFilterActive = selectedLetterFilter !== 'ALL';
          const isFilterActive =
            nonPopularSortCount > 0 ||
            isLetterFilterActive ||
            filterTat24h ||
            priceRangeFilter !== 'ALL' ||
            (selectedServiceFilter && selectedServiceFilter !== 'ALL');

          const activeFilterCount =
            nonPopularSortCount +
            (isLetterFilterActive ? 1 : 0) +
            (filterTat24h ? 1 : 0) +
            (priceRangeFilter !== 'ALL' ? 1 : 0) +
            (selectedServiceFilter && selectedServiceFilter !== 'ALL' ? 1 : 0);

          return (
            <Pressable
              style={[
                styles.sortButtonPill,
                {
                  backgroundColor: isFilterActive ? (isDark ? '#064E3B' : '#DCFCE7') : colors.section,
                  borderColor: isFilterActive ? '#16A34A' : colors.border,
                },
              ]}
              onPress={() => setIsSortFilterModalOpen(true)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Open sort and filter options"
            >
              <MaterialCommunityIcons name="filter-variant" size={13} color={isFilterActive ? (isDark ? '#4ADE80' : '#16A34A') : '#16A34A'} />
              <Text style={[styles.sortButtonPillText, { color: isFilterActive ? (isDark ? '#4ADE80' : '#15803D') : colors.textBody, fontWeight: isFilterActive ? '800' : '600' }]}>
                {isFilterActive ? `Filters (${activeFilterCount})` : 'Sort & Filter'}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={12} color={isFilterActive ? (isDark ? '#4ADE80' : '#15803D') : colors.textCaption} />
            </Pressable>
          );
        })()}

        <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.serviceFilterScrollView}
          contentContainerStyle={styles.serviceFilterScroll}
        >
          {/* Quick Filter Pill: Price Low to High */}
          {(() => {
            const isPriceLowActive = activeSorts.includes('PRICE_LOW');
            return (
              <Pressable
                style={[
                  styles.serviceChipCompact,
                  isPriceLowActive
                    ? styles.serviceChipCompactSelected
                    : [styles.serviceChipCompactUnselected, { backgroundColor: colors.section, borderColor: colors.border }],
                ]}
                onPress={() => toggleSortOption('PRICE_LOW')}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Filter by lowest price first"
              >
                <MaterialCommunityIcons
                  name={isPriceLowActive ? 'check-bold' : 'arrow-up-thin'}
                  size={12}
                  color={isPriceLowActive ? '#16A34A' : colors.textCaption}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.serviceChipTextCompact,
                    isPriceLowActive ? styles.serviceChipTextCompactSelected : [styles.serviceChipTextCompactUnselected, { color: colors.textBody }],
                  ]}
                >
                  ₹ Low-High
                </Text>
              </Pressable>
            );
          })()}

          {/* Quick Filter Pill: Alphabetical A-Z */}
          {(() => {
            const isNameAzActive = activeSorts.includes('NAME_AZ');
            return (
              <Pressable
                style={[
                  styles.serviceChipCompact,
                  isNameAzActive
                    ? styles.serviceChipCompactSelected
                    : [styles.serviceChipCompactUnselected, { backgroundColor: colors.section, borderColor: colors.border }],
                ]}
                onPress={() => toggleSortOption('NAME_AZ')}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Sort garments alphabetically A to Z"
              >
                <MaterialCommunityIcons
                  name={isNameAzActive ? 'check-bold' : 'sort-alphabetical-ascending'}
                  size={12}
                  color={isNameAzActive ? '#16A34A' : colors.textCaption}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.serviceChipTextCompact,
                    isNameAzActive ? styles.serviceChipTextCompactSelected : [styles.serviceChipTextCompactUnselected, { color: colors.textBody }],
                  ]}
                >
                  A-Z Name
                </Text>
              </Pressable>
            );
          })()}

          {/* Active Letter Pill (if filtered by letter) */}
          {selectedLetterFilter !== 'ALL' && (
            <Pressable
              style={[styles.serviceChipCompact, styles.serviceChipCompactSelected]}
              onPress={() => setSelectedLetterFilter('ALL')}
              hitSlop={4}
            >
              <MaterialCommunityIcons name="close-circle" size={12} color="#16A34A" style={{ marginRight: 3 }} />
              <Text style={styles.serviceChipTextCompactSelected}>
                Letter: {selectedLetterFilter}
              </Text>
            </Pressable>
          )}

          {availableServiceFilters.map((item) => {
            const isSelected = selectedServiceFilter === item.key;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.serviceChipCompact,
                  isSelected
                    ? styles.serviceChipCompactSelected
                    : [styles.serviceChipCompactUnselected, { backgroundColor: colors.section, borderColor: colors.border }],
                ]}
                onPress={() => setSelectedServiceFilter(item.key)}
                hitSlop={4}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Filter by ${item.label}`}
              >
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={12}
                  color={isSelected ? '#16A34A' : colors.textCaption}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.serviceChipTextCompact,
                    isSelected ? styles.serviceChipTextCompactSelected : [styles.serviceChipTextCompactUnselected, { color: colors.textBody }],
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 6. VIRTUALIZED PRODUCT GRID (Super-fast FlatList: only renders visible cards on screen) */}
      <FlatList
        key={`catalog-grid-${numColumns}`}
        data={filteredProducts}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        columnWrapperStyle={useSingleColumn ? undefined : styles.columnWrapper}
        renderItem={renderProductCard}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={3}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.productsScrollContent,
          {
            paddingBottom: Math.max(insets.bottom, 16) + (hasBottomTabBar ? 195 : 100),
            flexGrow: filteredProducts.length === 0 ? 1 : undefined,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#16A34A', '#2563EB']}
            tintColor="#16A34A"
          />
        }
        ListEmptyComponent={
          isLoading && filteredProducts.length === 0 ? (
            <View style={styles.loadingGridContainer}>
              <ActivityIndicator size="small" color="#16A34A" />
              <Text style={styles.loadingText}>Loading live garments...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="hanger" size={44} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No garments found</Text>
              <Text style={styles.emptySubtitle}>
                Try clearing filters or search to view all {displayTitle} items.
              </Text>
              <Pressable
                style={styles.resetFilterBtn}
                onPress={() => {
                  setSelectedSubcategory('ALL');
                  setSelectedServiceFilter('ALL');
                  setActiveSorts(['POPULAR']);
                  setSelectedLetterFilter('ALL');
                  setFilterTat24h(false);
                  setPriceRangeFilter('ALL');
                  setSearchQuery('');
                }}
              >
                <Text style={styles.resetFilterBtnText}>View All Garments</Text>
              </Pressable>
            </View>
          )
        }
      />

      {/* 7. DEDICATED SORT & FILTER MODAL */}
      <Modal
        visible={isSortFilterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSortFilterModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTapArea} onPress={() => setIsSortFilterModalOpen(false)} />
          <View style={[styles.sortFilterSheet, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.textHeading }]}>Sort & Filter</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textCaption }]}>
                  {filteredProducts.length} items available
                </Text>
              </View>
              {(activeSorts.some((s) => s !== 'POPULAR') || selectedLetterFilter !== 'ALL' || filterTat24h || priceRangeFilter !== 'ALL' || selectedServiceFilter !== 'ALL') && (
                <Pressable
                  style={styles.sheetResetBtn}
                  onPress={() => {
                    setActiveSorts(['POPULAR']);
                    setSelectedLetterFilter('ALL');
                    setFilterTat24h(false);
                    setPriceRangeFilter('ALL');
                    setSelectedServiceFilter('ALL');
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.sheetResetBtnText}>Reset All</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.sheetCloseBtn, { backgroundColor: colors.section }]}
                onPress={() => setIsSortFilterModalOpen(false)}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.textHeading} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScrollContent}>
              {/* 1. Sort Section */}
              <View style={styles.sheetSectionHeaderRow}>
                <Text style={[styles.sheetSectionTitle, { color: colors.textHeading }]}>SORT & ORDER</Text>
                <Text style={[styles.sheetMultiSelectHint, { color: '#16A34A' }]}>
                  Select multiple to combine
                </Text>
              </View>
              <View style={styles.sheetSortList}>
                {[
                  { key: 'POPULAR' as const, label: 'Recommended & Popular', icon: 'star-outline', desc: 'Curated standard order' },
                  { key: 'PRICE_LOW' as const, label: 'Price: Low to High', icon: 'arrow-up-thin', desc: 'Budget friendly first' },
                  { key: 'PRICE_HIGH' as const, label: 'Price: High to Low', icon: 'arrow-down-thin', desc: 'Premium garments first' },
                  { key: 'NAME_AZ' as const, label: 'Alphabetical (A - Z)', icon: 'sort-alphabetical-ascending', desc: 'Alphabetical order' },
                  { key: 'FASTEST' as const, label: 'Fastest Delivery', icon: 'lightning-bolt', desc: '24H Express available first' },
                ].map((opt) => {
                  const isSelected = activeSorts.includes(opt.key);
                  return (
                    <Pressable
                      key={opt.key}
                      style={[
                        styles.sortOptionRow,
                        {
                          borderColor: isSelected ? '#16A34A' : colors.border,
                          backgroundColor: isSelected ? (isDark ? '#064E3B' : '#F0FDF4') : colors.surface,
                        },
                      ]}
                      onPress={() => toggleSortOption(opt.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <MaterialCommunityIcons
                        name={opt.icon as any}
                        size={18}
                        color={isSelected ? '#16A34A' : colors.textCaption}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sortOptionLabel, { color: isSelected ? (isDark ? '#4ADE80' : '#15803D') : colors.textHeading, fontWeight: isSelected ? '800' : '600' }]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.sortOptionDesc, { color: colors.textCaption }]}>
                          {opt.desc}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkboxSquare,
                          {
                            borderColor: isSelected ? '#16A34A' : colors.border,
                            backgroundColor: isSelected ? '#16A34A' : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* 2. Alphabetical Initial Letter Filter */}
              <View style={[styles.sheetSectionHeaderRow, { marginTop: 18 }]}>
                <Text style={[styles.sheetSectionTitle, { color: colors.textHeading }]}>ALPHABETICAL LETTER FILTER</Text>
                {selectedLetterFilter !== 'ALL' && (
                  <Pressable onPress={() => setSelectedLetterFilter('ALL')} hitSlop={6}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#16A34A' }}>Clear Letter</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map((letter) => {
                  const isSelected = selectedLetterFilter === letter;
                  return (
                    <Pressable
                      key={letter}
                      style={[
                        styles.letterFilterChip,
                        {
                          borderColor: isSelected ? '#16A34A' : colors.border,
                          backgroundColor: isSelected ? '#16A34A' : (isDark ? colors.surface : colors.section),
                        },
                      ]}
                      onPress={() => setSelectedLetterFilter(letter)}
                      hitSlop={4}
                    >
                      <Text
                        style={[
                          styles.letterFilterChipText,
                          {
                            color: isSelected ? '#FFFFFF' : colors.textHeading,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {letter === 'ALL' ? 'All Letters' : letter}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* 2. Delivery Speed Filter */}
              <Text style={[styles.sheetSectionTitle, { color: colors.textHeading, marginTop: 18 }]}>DELIVERY SPEED</Text>
              <Pressable
                style={[
                  styles.filterToggleRow,
                  {
                    borderColor: filterTat24h ? '#16A34A' : colors.border,
                    backgroundColor: filterTat24h ? (isDark ? '#064E3B' : '#F0FDF4') : colors.surface,
                  },
                ]}
                onPress={() => setFilterTat24h((prev) => !prev)}
              >
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#EA580C" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.filterToggleLabel, { color: colors.textHeading }]}>24H Express Available Only</Text>
                  <Text style={[styles.filterToggleSub, { color: colors.textCaption }]}>Show garments ready for rapid pickup & delivery</Text>
                </View>
                <MaterialCommunityIcons
                  name={filterTat24h ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={filterTat24h ? '#16A34A' : colors.textCaption}
                />
              </Pressable>

              {/* 3. Price Range Filter */}
              <Text style={[styles.sheetSectionTitle, { color: colors.textHeading, marginTop: 18 }]}>PRICE RANGE</Text>
              <View style={styles.pillGroupRow}>
                {[
                  { key: 'ALL' as const, label: 'All Prices' },
                  { key: 'UNDER_50' as const, label: 'Under ₹50' },
                  { key: '50_TO_150' as const, label: '₹50 - ₹150' },
                  { key: 'ABOVE_150' as const, label: 'Above ₹150' },
                ].map((range) => {
                  const isSelected = priceRangeFilter === range.key;
                  return (
                    <Pressable
                      key={range.key}
                      style={[
                        styles.filterChip,
                        {
                          borderColor: isSelected ? '#16A34A' : colors.border,
                          backgroundColor: isSelected ? '#16A34A' : colors.section,
                        },
                      ]}
                      onPress={() => setPriceRangeFilter(range.key)}
                    >
                      <Text style={[styles.filterChipText, { color: isSelected ? '#FFFFFF' : colors.textBody, fontWeight: isSelected ? '700' : '500' }]}>
                        {range.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 4. Service Type Filter */}
              <Text style={[styles.sheetSectionTitle, { color: colors.textHeading, marginTop: 18 }]}>SERVICE TYPE</Text>
              <View style={styles.pillGroupRow}>
                {SERVICE_FILTERS.map((s) => {
                  const isSelected = selectedServiceFilter === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      style={[
                        styles.filterChip,
                        {
                          borderColor: isSelected ? '#16A34A' : colors.border,
                          backgroundColor: isSelected ? '#16A34A' : colors.section,
                        },
                      ]}
                      onPress={() => setSelectedServiceFilter(s.key)}
                    >
                      <MaterialCommunityIcons
                        name={s.icon as any}
                        size={13}
                        color={isSelected ? '#FFFFFF' : colors.textCaption}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.filterChipText, { color: isSelected ? '#FFFFFF' : colors.textBody, fontWeight: isSelected ? '700' : '500' }]}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Footer Apply */}
            <View style={[styles.sheetFooter, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
              <Pressable
                style={styles.sheetApplyBtn}
                onPress={() => setIsSortFilterModalOpen(false)}
              >
                <Text style={styles.sheetApplyBtnText}>
                  Apply Filters • {filteredProducts.length} Items
                </Text>
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
    backgroundColor: '#F8FAFC',
  },

  /* 1. Top App Bar (52px) */
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  countBadgePill: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgePillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#EA580C',
  },
  topBarSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  headerActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EA580C',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },

  /* 2. Main Category Tabs (36px) */
  categoryTabsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryTabsScroll: {
    paddingHorizontal: 14,
    gap: 8,
    paddingRight: 24,
  },
  categoryPill: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 17,
  },
  categoryPillSelected: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  categoryPillUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryPillTextSelected: {
    color: '#FFFFFF',
  },
  categoryPillTextUnselected: {
    color: '#475569',
  },

  /* 3. Search Bar */
  searchBarWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchBar: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
  },

  /* 4. Subcategory Carousel (66px) */
  subcatCarouselContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  subcatCarouselScroll: {
    paddingHorizontal: 14,
    gap: 12,
    paddingRight: 24,
  },
  subcatCircleItem: {
    width: 60,
    alignItems: 'center',
  },
  subcatCircleWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  subcatCircleWrapSelected: {
    borderColor: '#16A34A',
    borderWidth: 2.5,
    backgroundColor: '#DCFCE7',
  },
  subcatIconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcatCircleImg: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  subcatCircleText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 13,
  },
  subcatCircleTextSelected: {
    color: '#16A34A',
    fontWeight: '800',
  },

  /* 5. Filter & Sort Bar (34px) */
  filterSortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  serviceFilterScrollView: {
    flex: 1,
  },
  serviceFilterScroll: {
    gap: 6,
    alignItems: 'center',
    paddingRight: 16,
  },
  serviceChipCompact: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  serviceChipCompactSelected: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#16A34A',
  },
  serviceChipCompactUnselected: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceChipTextCompact: {
    fontSize: 11,
    fontWeight: '600',
  },
  serviceChipTextCompactSelected: {
    color: '#166534',
    fontWeight: '800',
  },
  serviceChipTextCompactUnselected: {
    color: '#64748B',
  },
  sortButtonPill: {
    flexShrink: 0,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sortButtonPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  /* 6. Product Grid */
  productsScroll: {
    flex: 1,
  },
  productsScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  productsGrid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: 10,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 10,
  },

  /* Card Image */
  cardImageContainer: {
    height: 136,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  imageLoadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(241, 245, 249, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSubcatBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSubcatBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.2,
  },
  favoriteCircleBtn: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  turnaroundBadge: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  turnaroundBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },

  /* Card Body */
  cardBody: {
    padding: 10,
    justifyContent: 'space-between',
    minHeight: 110,
  },
  titleWrap: {
    marginBottom: 4,
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  productCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    flex: 1,
  },
  servicesCountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    flexShrink: 0,
  },
  servicesCountBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  productCardSubtitle: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },

  /* Vertical Services Stack */
  verticalServicesList: {
    marginTop: 6,
    gap: 4.5,
  },
  verticalServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4.5,
    paddingHorizontal: 6.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  verticalServiceInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  verticalServiceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verticalServiceNameText: {
    fontSize: 9.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  verticalServicePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 0.5,
  },
  verticalServicePriceText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  verticalServiceUnitText: {
    fontSize: 8.5,
    fontWeight: '600',
    marginLeft: 1,
  },
  verticalServiceAction: {
    flexShrink: 0,
  },
  verticalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6.5,
  },
  verticalAddBtnText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803D',
  },
  verticalQtyCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 6,
    paddingHorizontal: 2,
    paddingVertical: 1.5,
    gap: 2,
  },
  verticalQtyBtn: {
    width: 17,
    height: 17,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalQtyNumber: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 13,
    textAlign: 'center',
  },
  viewDetailFooter: {
    marginTop: 5,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    alignItems: 'center',
  },
  viewDetailFooterText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  stepperCompact: {
    height: 30,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  stepperActionBtnCompact: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyCompact: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
    minWidth: 20,
    textAlign: 'center',
  },

  /* Empty & Loading */
  loadingGridContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  resetFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#059669',
    borderRadius: 8,
  },
  resetFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* 7. Sticky Cart Footer */
  stickyCartBarWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  stickyCartBarWrapAboveTabs: {
    paddingBottom: 88,
  },
  cartBarPressable: {
    width: '100%',
  },
  stickyCartBar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 10,
  },
  cartBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cartBarIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarInfo: {
    justifyContent: 'center',
  },
  cartBarTotalText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartBarCountText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  cartBarDotText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  cartBarPriceText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  cartBarSubText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  cartBarRightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  cartBarActionText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pressedBtn: {
    opacity: 0.88,
  },

  /* 7. Sort & Filter Sheet Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalBackdropTapArea: {
    flex: 1,
  },
  sortFilterSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sheetResetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  sheetResetBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sheetSortList: {
    gap: 8,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sortOptionLabel: {
    fontSize: 14,
  },
  sortOptionDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  sheetSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetMultiSelectHint: {
    fontSize: 11,
    fontWeight: '700',
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterFilterChipText: {
    fontSize: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterToggleLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  filterToggleSub: {
    fontSize: 11,
    marginTop: 2,
  },
  pillGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 12,
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  sheetApplyBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
