import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { getGarmentImageUrl } from '@/lib/garment-photos';
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
  onSelectProduct?: (product: ProductItem) => void;
  hasBottomTabBar?: boolean;
}

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

const SUBCATEGORY_MAP: Record<string, string[]> = {
  MENS: ['Shirts', 'T-Shirts', 'Trousers & Pants', 'Denim', 'Ethnic Wear', 'Suits & Blazers', 'Winter Wear', 'Sports & Gym Wear'],
  WOMENS: ['Sarees', 'Kurtis & Kurtas', 'Salwar Suits', 'Western Dresses', 'Tops & Shirts', 'Lehengas', 'Gowns', 'Dupattas'],
  KIDS: ['Baby Clothing', 'Boys Clothing', 'Girls Clothing', 'School Uniforms', 'Party Wear'],
  HOME_TEXTILES: ['Bedsheets', 'Bed Covers', 'Blankets', 'Comforters & Quilts', 'Curtains', 'Sofa & Cushion Covers', 'Towels'],
  HOME: ['Bedsheets', 'Bed Covers', 'Blankets', 'Comforters & Quilts', 'Curtains', 'Sofa & Cushion Covers', 'Towels'],
  FOOTWEAR: ['Sneakers', 'Formal Shoes', 'Leather & Suede', 'Sports Shoes'],
  ACCESSORIES: ['Backpacks', 'Handbags', 'Belts & Wallets', 'Caps & Hats'],
  WEDDING: ['Silk Sarees', 'Lehengas', 'Sherwanis', 'Bridal Gowns', 'Designer Dupattas'],
  BULK: ['Daily Wash & Fold', 'Bed Linen Bulk', 'Express KG Wash'],
};

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
  if (s.includes('saree')) {
    return n.includes('saree');
  }
  if (s.includes('kurti') || s.includes('kurta')) {
    return n.includes('kurti') || n.includes('kurta');
  }
  if (s.includes('salwar') || s.includes('suit')) {
    return n.includes('salwar') || n.includes('suit') || n.includes('churidar') || n.includes('dupatta');
  }
  if (s.includes('dress') || s.includes('gown')) {
    return n.includes('dress') || n.includes('gown') || n.includes('maxi') || n.includes('skirt') || n.includes('top');
  }
  if (s.includes('winter') || s.includes('jacket') || s.includes('sweater')) {
    return n.includes('winter') || n.includes('jacket') || n.includes('sweater') || n.includes('pullover') || n.includes('coat') || n.includes('hoodie') || n.includes('shawl');
  }
  if (s.includes('ethnic')) {
    return n.includes('ethnic') || n.includes('kurta') || n.includes('sherwani') || n.includes('dhoti') || n.includes('pyjama');
  }
  if (s.includes('sport') || s.includes('gym')) {
    return n.includes('short') || n.includes('bermuda') || n.includes('track') || n.includes('gym') || n.includes('sport');
  }
  if (s.includes('bedsheet')) {
    return n.includes('bedsheet') || n.includes('bed sheet') || n.includes('linen');
  }
  if (s.includes('blanket') || s.includes('quilt') || s.includes('comforter')) {
    return n.includes('blanket') || n.includes('quilt') || n.includes('comforter') || n.includes('duvet') || n.includes('razai');
  }
  if (s.includes('curtain')) {
    return n.includes('curtain');
  }
  return false;
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
  isFavorite: boolean;
  colors: any;
  isDark: boolean;
  onSelectProduct?: (product: ProductItem) => void;
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
  const [imageErrorLevel, setImageErrorLevel] = useState<'none' | 'primary' | 'all'>('none');

  const primaryPhotoUrl = cloth.imageUrl
    ? getGarmentImageUrl(cloth.id, cloth.imageUrl, cloth.categoryTag, cloth.name)
    : cloth.fallbackImageUrl;

  const photoUrl =
    imageErrorLevel === 'all'
      ? undefined
      : imageErrorLevel === 'primary'
      ? cloth.fallbackImageUrl
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
        onPress={() => onSelectProduct?.(cloth)}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${cloth.name}`}
      >
        {photoUrl ? (
          <>
            <Image
              source={{ uri: photoUrl }}
              style={styles.cardImage}
              resizeMode="cover"
              onLoadEnd={() => setImageLoaded(true)}
              onError={() => {
                setImageErrorLevel((prev) =>
                  prev === 'none' && primaryPhotoUrl !== cloth.fallbackImageUrl ? 'primary' : 'all'
                );
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
            <MaterialCommunityIcons name="tshirt-crew" size={34} color={colors.border} />
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
        {/* Title */}
        <Pressable
          onPress={() => onSelectProduct?.(cloth)}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${cloth.name}`}
        >
          <View style={styles.titleRow}>
            <Text style={[styles.productCardTitle, { color: colors.textHeading }]} numberOfLines={1}>
              {cloth.name}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={14} color={colors.textCaption} />
          </View>
        </Pressable>

        {/* Service Selector Mini-Pills */}
        <View style={styles.serviceChipsWrap}>
          {cloth.services.map((srv) => {
            const isChosen = chosenService.serviceId === srv.serviceId;
            const label =
              srv.serviceCode === 'PRESS'
                ? 'Press'
                : srv.serviceCode === 'WASH_FOLD'
                ? 'W+Fold'
                : srv.serviceCode === 'WASH_IRON'
                ? 'W+Iron'
                : srv.serviceCode === 'DRY_CLEAN'
                ? 'DryClean'
                : srv.serviceCode === 'STARCH'
                ? 'Starch'
                : srv.serviceCode === 'SAREE_POLISH'
                ? 'Polish'
                : srv.serviceCode === 'SHOE_SPA'
                ? 'Spa'
                : srv.serviceCode === 'EXPRESS'
                ? 'Express'
                : srv.shortLabel || 'Care';

            return (
              <Pressable
                key={srv.serviceId}
                style={[
                  styles.serviceMiniPill,
                  { backgroundColor: colors.section, borderColor: colors.border },
                  isChosen && styles.serviceMiniPillActive,
                ]}
                onPress={() => onSelectService(cloth.id, srv.serviceId)}
                hitSlop={4}
                accessibilityRole="radio"
                accessibilityState={{ selected: isChosen }}
                accessibilityLabel={`Choose ${srv.displayName} for ${cloth.name}, ₹${srv.price} per ${String(
                  srv.unit || 'pc'
                ).toLowerCase()}`}
              >
                <Text
                  style={[
                    styles.serviceMiniText,
                    { color: colors.textBody },
                    isChosen && styles.serviceMiniTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Selected Service Name & Confirmation */}
        <View style={styles.selectedServiceIndicator}>
          <Text style={[styles.selectedServiceNameText, { color: colors.textCaption }]} numberOfLines={1}>
            {chosenService.displayName}
          </Text>
        </View>

        {/* Price & Action Row */}
        <View style={styles.priceAndActionRow}>
          <View style={styles.priceCol}>
            <Text style={[styles.priceText, { color: colors.textHeading }]}>₹{chosenService.price}</Text>
            <Text style={[styles.priceUnitText, { color: colors.textCaption }]} numberOfLines={1}>
              /{chosenService.unit === 'KG' ? 'kg' : 'pc'}
            </Text>
          </View>

          <AnimatedCartButton
            quantity={cartQty}
            onAdd={() => onAddToCart(cloth, chosenService)}
            onIncrement={() => onIncrement(cloth, chosenService)}
            onDecrement={() => onDecrement(cloth, chosenService)}
            isDark={isDark}
          />
        </View>

        {/* Quick Link to Custom Care Options */}
        <Pressable
          style={styles.customCareLink}
          onPress={() => onSelectProduct?.(cloth)}
          hitSlop={4}
        >
          <Text style={styles.customCareLinkText}>Options & care</Text>
          <MaterialCommunityIcons name="arrow-right" size={11} color="#16A34A" />
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
  const [selectedSort, setSelectedSort] = useState<'POPULAR' | 'PRICE_LOW' | 'PRICE_HIGH'>('POPULAR');

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

  // Subcategories List extracted dynamically
  const subcategoriesList = useMemo(() => {
    const rawSet = new Set<string>();
    activeClothTypes.forEach((c: any) => {
      const sub = c.subcategory || c.subCategory;
      if (sub && typeof sub === 'string' && sub.trim().length > 0) {
        rawSet.add(sub.trim());
      }
    });

    const activeSubs = (dynamicCatalog?.subcategories || catalog?.subcategories || []).filter(
      (s: any) => s && (activeCategoryTag === 'ALL' || s.categoryTag === activeCategoryTag) && s.isActive !== false
    );
    activeSubs.forEach((s: any) => {
      if (s && s.name && typeof s.name === 'string' && s.name.trim()) {
        rawSet.add(s.name.trim());
      }
    });

    const fallbackList =
      SUBCATEGORY_MAP[activeCategoryTag.toUpperCase()] ||
      SUBCATEGORY_MAP[activeCategoryTag.toUpperCase().replace(/_/g, '-')] ||
      [];
    const knownSubcategories = fallbackList.filter((fallback) =>
      Boolean(fallback) && Array.from(rawSet).some((sub) => Boolean(sub) && String(sub).toLowerCase() === String(fallback).toLowerCase())
    );
    const remainingSubcategories = Array.from(rawSet)
      .filter((sub) => Boolean(sub) && !knownSubcategories.some((known) => String(known).toLowerCase() === String(sub).toLowerCase()))
      .sort((a, b) => String(a || '').localeCompare(String(b || '')));

    const orderedSubcategories = rawSet.size > 0
      ? [...knownSubcategories, ...remainingSubcategories]
      : fallbackList;

    return ['ALL', ...orderedSubcategories];
  }, [activeClothTypes, activeCategoryTag, dynamicCatalog?.subcategories, catalog?.subcategories]);

  // Precomputed subcategory carousel render data
  const subcategoryRenderData = useMemo(() => {
    const currentCatObj = categoriesList.find((c) => c.tag === activeCategoryTag);
    const subObjMap = new Map<string, any>();
    (dynamicCatalog?.subcategories || catalog?.subcategories || []).forEach((s: any) => {
      if (s && (activeCategoryTag === 'ALL' || s.categoryTag === activeCategoryTag) && s.name) {
        subObjMap.set(String(s.name).toLowerCase(), s);
      }
    });

    return subcategoriesList.map((sub) => {
      const isAll = sub === 'ALL';
      const matchedSubObj = subObjMap.get(String(sub).toLowerCase());
      const subPhotoUrl = isAll
        ? getCategoryImageUrl(activeCategoryTag, currentCatObj?.imageUrl)
        : getSubcategoryImageUrl(sub, matchedSubObj?.categoryTag || activeCategoryTag, matchedSubObj?.imageUrl);
      const fallbackIcon = getSubcategoryFallbackIcon(sub, activeCategoryTag);

      return {
        sub,
        displayName: isAll ? 'All' : sub,
        subPhotoUrl,
        fallbackIcon,
      };
    });
  }, [subcategoriesList, activeCategoryTag, categoriesList, dynamicCatalog?.subcategories, catalog?.subcategories]);

  // Build product items with price options
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

      return {
        id: cloth.id,
        name: cloth.name,
        categoryTag: cloth.categoryTag || activeCategoryTag,
        categoryLabel: cloth.categoryLabel || activeCategoryTitle,
        subcategory: cloth.subcategory || cloth.subCategory || 'General',
        imageUrl: cloth.imageUrl || cloth.image,
        fallbackImageUrl: getGarmentImageUrl(cloth.id, undefined, cloth.categoryTag, cloth.name),
        description: cloth.description,
        services: servicesForCloth,
        minPrice,
      };
    }).filter((product) => product.services.length > 0);
  }, [activeClothTypes, activePriceMatrix, activeCategoryTag, activeCategoryTitle, serviceMastersById]);

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
      const targetSub = String(selectedSubcategory || '').toLowerCase().trim();
      list = list.filter((p) => {
        const itemSub = String(p.subcategory || '').toLowerCase().trim();
        const itemName = String(p.name || '').toLowerCase().trim();
        return (
          itemSub === targetSub ||
          itemSub.includes(targetSub) ||
          targetSub.includes(itemSub) ||
          matchesSubcategoryKeyword(itemName, targetSub)
        );
      });
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

    const priceForSort = (product: ProductItem) => {
      const filterMatch = selectedServiceFilter === 'ALL'
        ? undefined
        : product.services.find((service) => service.serviceCode === selectedServiceFilter);
      const manualMatch = product.services.find((service) => service.serviceId === selectedClothServiceMap[product.id]);
      return manualMatch?.price ?? filterMatch?.price ?? product.minPrice;
    };

    if (selectedSort === 'PRICE_LOW') {
      list = [...list].sort((a, b) => priceForSort(a) - priceForSort(b));
    } else if (selectedSort === 'PRICE_HIGH') {
      list = [...list].sort((a, b) => priceForSort(b) - priceForSort(a));
    }

    return list;
  }, [products, selectedSubcategory, selectedServiceFilter, searchQuery, selectedSort, selectedClothServiceMap]);

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
      {/* 1. TOP APP BAR (Compact 52px height, count badge, search toggle and cart shortcut) */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
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

      {/* 5. INTEGRATED SERVICE FILTERS & SORT ROW (Left pinned Sort + Full-width natural scroll) */}
      <View style={[styles.filterSortBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable
          style={[styles.sortButtonPill, { backgroundColor: colors.section, borderColor: colors.border }]}
          onPress={() => {
            setSelectedSort((prev) =>
              prev === 'POPULAR' ? 'PRICE_LOW' : prev === 'PRICE_LOW' ? 'PRICE_HIGH' : 'POPULAR'
            );
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Change sort order"
        >
          <MaterialCommunityIcons name="swap-vertical" size={13} color="#16A34A" />
          <Text style={[styles.sortButtonPillText, { color: colors.textBody }]}>
            {selectedSort === 'POPULAR' ? 'Sort' : selectedSort === 'PRICE_LOW' ? 'Price ↑' : 'Price ↓'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={12} color={colors.textCaption} />
        </Pressable>

        <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.serviceFilterScrollView}
          contentContainerStyle={styles.serviceFilterScroll}
        >
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
                  setSearchQuery('');
                }}
              >
                <Text style={styles.resetFilterBtnText}>View All Garments</Text>
              </Pressable>
            </View>
          )
        }
      />
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
    minHeight: 126,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  productCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    flex: 1,
  },
  serviceChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 4,
    minHeight: 24,
  },
  serviceMiniPill: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceMiniPillActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  serviceMiniText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  serviceMiniTextActive: {
    color: '#166534',
    fontWeight: '800',
  },
  selectedServiceIndicator: {
    marginVertical: 2,
  },
  selectedServiceNameText: {
    fontSize: 10,
    fontWeight: '600',
  },
  priceAndActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  priceCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  priceText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  priceUnitText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  addBtnCompact: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  addBtnTextCompact: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 0.3,
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
  customCareLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  customCareLinkText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
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
});
