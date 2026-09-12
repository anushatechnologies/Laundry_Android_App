import React, { useState, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { money } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { CATEGORY_DEFAULT_PHOTOS, getCategoryImageUrl } from '@/lib/category-photos';
import type { ClothType, ServicePriceItem } from '@/types/domain';

interface ServicesScreenProps {
  onBook: () => void;
  onOpenBulkLaundry?: () => void;
}

interface DynamicCategory {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  tagline: string;
  bannerImage: string;
  startPrice: number;
  itemCount: number;
  items: DynamicProduct[];
  subcategories: string[];
}

interface DynamicProduct {
  id: string;
  clothId: string;
  name: string;
  categoryTag: string;
  categoryId: string;
  subCategory: string;
  serviceId: string;
  serviceName: string;
  tat: string;
  price: number;
  unit: string;
  imageUrl: string;
}

const CATEGORY_META: Record<string, {
  name: string;
  shortName: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  tagline: string;
  bannerImage: string;
}> = {
  'MENS': {
    name: "Men's Executive Wear",
    shortName: "Men's",
    icon: 'tshirt-crew',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    tagline: 'Formal Shirts, Suits, Trousers & Kurtas',
    bannerImage: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments/cloth-shirt.jpg',
  },
  'WOMENS': {
    name: "Women's Designer Wear",
    shortName: "Women's",
    icon: 'hanger',
    iconBg: '#FFF1F2',
    iconColor: '#DB2777',
    tagline: 'Silk Sarees, Kurtis, Dresses & Tops',
    bannerImage: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments/cloth-saree-silk.jpg',
  },
  'KIDS': {
    name: 'Kids & Infants Care',
    shortName: 'Kids',
    icon: 'baby-carriage',
    iconBg: '#F5F3FF',
    iconColor: '#7C3AED',
    tagline: 'Gentle Hypoallergenic Sanitized Wash',
    bannerImage: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/cat-school-uniforms.jpg',
  },
  'HOME_TEXTILES': {
    name: 'Home, Living & Linen',
    shortName: 'Home',
    icon: 'curtains',
    iconBg: '#F0FDF4',
    iconColor: '#16A34A',
    tagline: 'Blankets, Quilts, Bedsheets & Curtains',
    bannerImage: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments/cloth-bedsheet-king.jpg',
  },
  'FOOTWEAR': {
    name: 'Shoe & Sneaker Spa',
    shortName: 'Shoes',
    icon: 'shoe-sneaker',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    tagline: 'Sneakers, Formal & Suede Shoes',
    bannerImage: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_shoe_clean.jpg',
  },
  'ACCESSORIES': {
    name: 'Bags & Accessories',
    shortName: 'Bags',
    icon: 'bag-personal',
    iconBg: '#FDF2F8',
    iconColor: '#E11D48',
    tagline: 'Backpacks, Handbags & Leather Goods',
    bannerImage: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/accessories.jpg',
  },
  'BULK': {
    name: 'Daily Wash & Steam Press (KG)',
    shortName: 'Bulk KG',
    icon: 'scale',
    iconBg: '#F0FDF4',
    iconColor: '#16A34A',
    tagline: 'Bulk Everyday Laundry by Weight',
    bannerImage: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/banners/banner-bulk.jpg',
  },
};

const ALL_CARE_SERVICES = [
  {
    id: 'srv-m-wash-fold',
    title: 'Wash & Fold',
    shortTitle: 'Wash & Fold',
    tat: '24h TAT',
    tatBg: '#E0F2FE',
    tatColor: '#0891B2',
    accent: '#0891B2',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_fold.jpg',
    priceText: 'From ₹60/kg',
    serviceCode: 'WASH_FOLD',
  },
  {
    id: 'srv-m-wash-iron',
    title: 'Wash & Steam Iron',
    shortTitle: 'Wash & Iron',
    tat: '24h TAT',
    tatBg: '#F3E8FF',
    tatColor: '#7C3AED',
    accent: '#7C3AED',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_wash_iron.jpg',
    priceText: 'From ₹85/kg',
    serviceCode: 'WASH_IRON',
  },
  {
    id: 'srv-m-steam-iron',
    title: 'Steam Press',
    shortTitle: 'Steam Press',
    tat: '12h Express',
    tatBg: '#FEF3C7',
    tatColor: '#D97706',
    accent: '#D97706',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_steam_press.jpg',
    priceText: 'From ₹120/kg',
    serviceCode: 'PRESS',
  },
  {
    id: 'srv-m-dry-clean',
    title: 'Dry Cleaning',
    shortTitle: 'Dry Clean',
    tat: '48h TAT',
    tatBg: '#EFF6FF',
    tatColor: '#2563EB',
    accent: '#2563EB',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_dry_cleaning.jpg',
    priceText: 'From ₹35',
    serviceCode: 'DRY_CLEAN',
  },
  {
    id: 'srv-m-spa',
    title: 'Shoe & Sneaker Spa',
    shortTitle: 'Shoe Spa',
    tat: '48h TAT',
    tatBg: '#DCFCE7',
    tatColor: '#16A34A',
    accent: '#16A34A',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/service_shoe_clean.jpg',
    priceText: 'From ₹90',
    serviceCode: 'SHOE_SPA',
  },
  {
    id: 'srv-m-charak',
    title: 'Saree Rolling & Charak Polish',
    shortTitle: 'Saree Charak',
    tat: '48h TAT',
    tatBg: '#FDF4FF',
    tatColor: '#C026D3',
    accent: '#C026D3',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/cat-wedding-silk.jpg',
    priceText: 'From ₹120',
    serviceCode: 'SAREE_POLISH',
  },
  {
    id: 'srv-m-starch',
    title: 'Starch & Crisp Finish',
    shortTitle: 'Starch & Crisp',
    tat: '24h TAT',
    tatBg: '#ECFEFF',
    tatColor: '#0D9488',
    accent: '#0D9488',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments/cloth-shirt.jpg',
    priceText: 'From ₹20',
    serviceCode: 'STARCH',
  },
  {
    id: 'srv-m-express',
    title: 'Express 24h Emergency',
    shortTitle: 'Express 24h',
    tat: '12-24h Rapid',
    tatBg: '#DCFCE7',
    tatColor: '#166534',
    accent: '#16A34A',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/services/delivery_van_driver.jpg',
    priceText: 'From ₹120/kg',
    serviceCode: 'EXPRESS',
  },
];

export function ServicesScreen({ onBook, onOpenBulkLaundry }: ServicesScreenProps) {
  const { colors, isDark } = useTheme();
  const {
    catalog,
    cart,
    addCartItem,
    addGarmentToCart,
    addBulkToCart,
    setCartQuantity,
    removeFromCart,
    wishlist,
    toggleWishlist,
    isInWishlist,
    refreshCatalog,
    catalogError,
  } = useApp();

  // Mode: 'ALL_CATEGORIES' | 'SPLIT_VIEW'
  const [viewMode, setViewMode] = useState<'ALL_CATEGORIES' | 'SPLIT_VIEW'>('ALL_CATEGORIES');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('MENS');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCatalog();
    } catch (error) {
      console.error('[ServicesScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshCatalog]);

  // 1. DYNAMICALLY MAP BACKEND DATA
  const { categoriesList, allProductsList } = useMemo(() => {
    if (!catalog || !catalog.clothTypes || catalog.clothTypes.length === 0) {
      return { categoriesList: [], allProductsList: [] };
    }

    const priceMap = new Map<string, ServicePriceItem[]>();
    (catalog.priceMatrix || []).forEach((pm) => {
      if (!pm.isActive) return;
      const list = priceMap.get(pm.clothTypeId) || [];
      list.push(pm);
      priceMap.set(pm.clothTypeId, list);
    });

    const categoryBuckets: Record<string, { meta: any; items: DynamicProduct[] }> = {};
    Object.entries(CATEGORY_META).forEach(([k, v]) => {
      categoryBuckets[k] = { meta: { id: k, ...(v as object) }, items: [] };
    });

    const allProducts: DynamicProduct[] = [];

    (catalog.clothTypes || []).forEach((cloth: ClothType) => {
      const pmList = priceMap.get(cloth.id) || [];
      const primaryPrice = pmList[0] || {
        serviceId: 'serv-dry-clean',
        serviceName: 'Steam Clean',
        price: 99,
        turnaroundHours: 24,
      };

      const imageUrl = getGarmentImageUrl(cloth.id, (cloth as any).imageUrl, cloth.categoryTag);
      const isKg = cloth.categoryTag === 'BULK';

      // Match strictly against backend categoryTag
      let rawTag = String(cloth.categoryTag || 'MENS').toUpperCase().replace(/-/g, '_');
      if (rawTag === 'HOME' || rawTag === 'HOMETEXTILES') rawTag = 'HOME_TEXTILES';
      if (rawTag === 'SHOES') rawTag = 'FOOTWEAR';
      if (rawTag === 'BAGS') rawTag = 'ACCESSORIES';

      let targetCatKey = CATEGORY_META[rawTag] ? rawTag : 'MENS';
      let subCat = cloth.name;

      const productItem: DynamicProduct = {
        id: `cloth-${cloth.id}`,
        clothId: cloth.id,
        name: cloth.name,
        categoryTag: targetCatKey,
        categoryId: targetCatKey,
        subCategory: subCat,
        serviceId: primaryPrice.serviceId,
        serviceName: primaryPrice.serviceName,
        tat: `${primaryPrice.turnaroundHours || 24}H Express`,
        price: primaryPrice.price || 99,
        unit: isKg ? 'KG' : 'pc',
        imageUrl,
      };

      allProducts.push(productItem);

      if (categoryBuckets[targetCatKey]) {
        categoryBuckets[targetCatKey]!.items.push(productItem);
      } else {
        categoryBuckets['MENS']!.items.push(productItem);
      }
    });

    // Add per-kg services from backend
    (catalog.perKgServices || []).forEach((pkg) => {
      const productItem: DynamicProduct = {
        id: `pkg-${pkg.id}`,
        clothId: pkg.id,
        name: pkg.name,
        categoryTag: 'BULK',
        categoryId: 'bulk-kg',
        subCategory: 'Per KG Wash',
        serviceId: pkg.id,
        serviceName: pkg.name,
        tat: `${(pkg as any).turnaroundHours || 24}H Express`,
        price: pkg.baseKgPrice || 49,
        unit: 'KG',
        imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/banners/banner-bulk.jpg',
      };
      allProducts.push(productItem);
      if (categoryBuckets['BULK']) { categoryBuckets['BULK']!.items.push(productItem); }
    });

    // Build final Category list with computed counts & start prices
    const categories: DynamicCategory[] = Object.values(categoryBuckets)
      .filter((bucket) => bucket.items.length > 0)
      .map((bucket) => {
        const meta = bucket.meta;
        const prices = bucket.items.map((i) => i.price);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 49;
        const subSet = new Set<string>(['All']);
        bucket.items.forEach((i) => subSet.add(i.subCategory));

        const matchingBackendCat = (catalog?.categories || []).find((c: any) => {
          const cSlug = (c.slug || '').toLowerCase();
          const metaId = (meta.id || '').toLowerCase();
          return (
            cSlug === metaId ||
            c.id === meta.id ||
            (metaId === 'mens' && cSlug.includes('men') && !cSlug.includes('women')) ||
            (metaId === 'womens' && cSlug.includes('women')) ||
            (metaId === 'kids' && (cSlug.includes('kid') || cSlug.includes('baby'))) ||
            (metaId === 'home_textiles' && (cSlug.includes('home') || cSlug.includes('textile'))) ||
            (metaId === 'bulk' && cSlug.includes('bulk'))
          );
        });
        const dynamicImage = matchingBackendCat?.imageUrl || matchingBackendCat?.image || meta.bannerImage;

        return {
          id: meta.id || 'MENS',
          name: meta.name || "Men's Wear",
          shortName: meta.shortName || 'Men',
          icon: meta.icon || 'hanger',
          iconBg: meta.iconBg || '#EFF6FF',
          iconColor: meta.iconColor || '#2563EB',
          tagline: meta.tagline || 'Executive Care',
          bannerImage: dynamicImage || 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/categories/mens-wear.jpg',
          startPrice: minPrice,
          itemCount: bucket.items.length,
          items: bucket.items,
          subcategories: Array.from(subSet),
        };
      });

    return { categoriesList: categories, allProductsList: allProducts };
  }, [catalog]);

  const activeCategory =
    categoriesList.find((c) => c.id === selectedCategoryId) ||
    categoriesList[0] || {
      id: 'MENS',
      name: "Men's Wear",
      shortName: 'Men',
      icon: 'hanger',
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
      tagline: 'Executive Care',
      bannerImage: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/banners/banner-bulk.jpg',
      startPrice: 99,
      itemCount: 0,
      items: [],
      subcategories: ['All'],
    };

  const handleOpenCategory = (catId: string) => {
    if (catId === 'BULK' || catId === 'bulk-kg') {
      if (onOpenBulkLaundry) {
        onOpenBulkLaundry();
        return;
      }
    }
    setSelectedCategoryId(catId);
    setSelectedSubCategory('All');
    setViewMode('SPLIT_VIEW');
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (searchQuery && searchQuery.trim()) {
      const q = String(searchQuery).toLowerCase().trim();
      return allProductsList.filter(
        (p) =>
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.serviceName || '').toLowerCase().includes(q) ||
          String(p.subCategory || '').toLowerCase().includes(q)
      );
    }

    return activeCategory.items.filter((p) => {
      if (selectedSubCategory !== 'All' && p.subCategory !== selectedSubCategory) return false;
      return true;
    });
  }, [activeCategory, selectedSubCategory, searchQuery, allProductsList]);

  // Loading state
  if (!catalog && !catalogError) {
    return (
      <View style={[styles.centerBox, isDark && { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={[styles.loadingText, isDark && { color: colors.textCaption }]}>Fetching live catalog from backend...</Text>
      </View>
    );
  }

  // Error state with retry
  if (catalogError && categoriesList.length === 0) {
    return (
      <View style={[styles.centerBox, isDark && { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={[styles.errorTitle, isDark && { color: colors.textHeading }]}>Could not load catalog</Text>
        <Text style={[styles.errorSub, isDark && { color: colors.textCaption }]}>{catalogError}</Text>
        <Pressable style={styles.retryBtn} onPress={() => refreshCatalog()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* 🔝 1. TOP STICKY HEADER WITH SEARCH */}
      <View style={[styles.header, isDark && { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          {viewMode === 'SPLIT_VIEW' ? (
            <Pressable style={styles.backBtn} onPress={() => setViewMode('ALL_CATEGORIES')}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={isDark ? colors.textHeading : '#0F172A'} />
              <Text style={[styles.backBtnText, isDark && { color: colors.textHeading }]}>All Categories</Text>
            </Pressable>
          ) : (
            <View>
              <Text style={[styles.headerTitle, isDark && { color: colors.textHeading }]}>All Categories & Care</Text>
              <Text style={[styles.headerSub, isDark && { color: colors.textCaption }]}>
                {allProductsList.length} Garments • Live Backend Rates
              </Text>
            </View>
          )}

          {viewMode === 'ALL_CATEGORIES' && (
            <Pressable style={styles.splitToggleBtn} onPress={() => setViewMode('SPLIT_VIEW')}>
              <MaterialCommunityIcons name="view-split-vertical" size={16} color="#0F766E" />
              <Text style={styles.splitToggleText}>Browse Rail</Text>
            </Pressable>
          )}
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBar, isDark && { backgroundColor: colors.section }]}>
          <MaterialCommunityIcons name="magnify" size={18} color="#64748B" />
          <TextInput
            style={[styles.searchInput, isDark && { color: colors.textHeading }]}
            placeholder="Search across all 54 garments & services..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text.trim() && viewMode !== 'SPLIT_VIEW') {
                setViewMode('SPLIT_VIEW');
              }
            }}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        {/* Horizontal Quick-Filter Category Pills */}
        <View style={styles.quickPillsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPillsContent}>
            {categoriesList.map((cat) => {
              const isSelected = viewMode === 'SPLIT_VIEW' && selectedCategoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.quickPill, isDark && !isSelected && { backgroundColor: colors.section, borderColor: colors.border }, isSelected && styles.quickPillActive]}
                  onPress={() => handleOpenCategory(cat.id)}
                >
                  <MaterialCommunityIcons
                    name={cat.icon as any}
                    size={14}
                    color={isSelected ? '#FFFFFF' : cat.iconColor}
                  />
                  <Text style={[styles.quickPillText, isDark && !isSelected && { color: colors.textCaption }, isSelected && styles.quickPillTextActive]}>
                    {cat.shortName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* 📱 2. MAIN BODY */}
      {viewMode === 'ALL_CATEGORIES' ? (
        /* ===== TIER 1: MODERN 2-COLUMN LUXURY VISUAL CATEGORY GRID ===== */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.overviewScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0F766E', '#16A34A']}
              tintColor="#0F766E"
            />
          }
        >
          {/* 1. BROWSE CATEGORIES (4 items per row, full rounded circle avatars) */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.overviewHeading, isDark && { color: colors.textHeading }]}>Browse Categories ({categoriesList.length})</Text>
            <Text style={[styles.overviewSub, isDark && { color: colors.textCaption }]}>Tap category to view specialized garments</Text>
          </View>

          {/* Row 1: 4 Categories */}
          <View style={styles.circleGridRow4}>
            {categoriesList.slice(0, 4).map((cat) => (
              <Pressable
                key={cat.id}
                style={({ pressed }) => [styles.circleCatCol, pressed && styles.circleCatPressed]}
                onPress={() => handleOpenCategory(cat.id)}
              >
                <View style={[styles.circleAvatarWrapper, { borderColor: cat.iconColor || '#0F766E' }, isDark && { backgroundColor: colors.surface }]}>
                  <Image
                    source={{
                      uri: imgErrors[cat.id]
                        ? getCategoryImageUrl(cat.id)
                        : cat.bannerImage
                    }}
                    style={styles.circleAvatarImg}
                    resizeMode="cover"
                    onError={() => setImgErrors((prev) => ({ ...prev, [cat.id]: true }))}
                  />
                  <View style={[styles.circlePillBadge, { backgroundColor: cat.iconColor || '#0F766E' }]}>
                    <Text style={styles.circlePillText}>{cat.itemCount} Items</Text>
                  </View>
                </View>
                <Text style={[styles.circleCatTitle, isDark && { color: colors.textHeading }]} numberOfLines={2}>
                  {cat.shortName || cat.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Row 2: 4 Categories */}
          <View style={styles.circleGridRow4}>
            {categoriesList.slice(4, 8).map((cat) => (
              <Pressable
                key={cat.id}
                style={({ pressed }) => [styles.circleCatCol, pressed && styles.circleCatPressed]}
                onPress={() => handleOpenCategory(cat.id)}
              >
                <View style={[styles.circleAvatarWrapper, { borderColor: cat.iconColor || '#0F766E' }, isDark && { backgroundColor: colors.surface }]}>
                  <Image
                    source={{
                      uri: imgErrors[cat.id]
                        ? getCategoryImageUrl(cat.id)
                        : cat.bannerImage
                    }}
                    style={styles.circleAvatarImg}
                    resizeMode="cover"
                    onError={() => setImgErrors((prev) => ({ ...prev, [cat.id]: true }))}
                  />
                  <View style={[styles.circlePillBadge, { backgroundColor: cat.iconColor || '#0F766E' }]}>
                    <Text style={styles.circlePillText}>{cat.itemCount} Items</Text>
                  </View>
                </View>
                <Text style={[styles.circleCatTitle, isDark && { color: colors.textHeading }]} numberOfLines={2}>
                  {cat.shortName || cat.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 2. ALL SERVICES & CARE (4 items per row, full rounded circle avatars) */}
          <View style={[styles.sectionHeaderRow, { marginTop: 22 }]}>
            <Text style={[styles.overviewHeading, isDark && { color: colors.textHeading }]}>All Services & Care (8)</Text>
            <Text style={[styles.overviewSub, isDark && { color: colors.textCaption }]}>8 specialized treatments for every fabric</Text>
          </View>

          {/* Row 1: 4 Services */}
          <View style={styles.circleGridRow4}>
            {ALL_CARE_SERVICES.slice(0, 4).map((svc) => (
              <Pressable
                key={svc.id}
                style={({ pressed }) => [styles.circleCatCol, pressed && styles.circleCatPressed]}
                onPress={() => {
                  if (svc.serviceCode === 'BULK_LAUNDRY' || svc.id === 'bulk-laundry') {
                    if (onOpenBulkLaundry) onOpenBulkLaundry();
                    return;
                  }
                  setSearchQuery(svc.shortTitle || svc.title);
                  setViewMode('SPLIT_VIEW');
                }}
              >
                <View style={[styles.serviceTopTatBadge, { backgroundColor: svc.tatBg || '#F0FDFA' }]}>
                  <Text style={[styles.serviceTopTatText, { color: svc.tatColor || svc.accent || '#0F766E' }]}>
                    {svc.tat}
                  </Text>
                </View>
                <View style={[styles.serviceCircleWrap, { borderColor: svc.accent || '#0F766E' }, isDark && { backgroundColor: colors.surface }]}>
                  <Image
                    source={{ uri: svc.imageUrl }}
                    style={styles.serviceCircleImg}
                    resizeMode="cover"
                  />
                </View>
                <Text style={[styles.serviceTitleText, isDark && { color: colors.textHeading }]} numberOfLines={1}>
                  {svc.shortTitle || svc.title}
                </Text>
                <Text style={[styles.servicePriceText, { color: svc.accent || '#059669' }]}>
                  {svc.priceText}
                </Text>
                <View style={[styles.serviceBottomBar, { backgroundColor: svc.accent || '#0F766E' }]} />
              </Pressable>
            ))}
          </View>

          {/* Row 2: 4 Services */}
          <View style={styles.circleGridRow4}>
            {ALL_CARE_SERVICES.slice(4, 8).map((svc) => (
              <Pressable
                key={svc.id}
                style={({ pressed }) => [styles.circleCatCol, pressed && styles.circleCatPressed]}
                onPress={() => {
                  if (svc.serviceCode === 'BULK_LAUNDRY' || svc.id === 'bulk-laundry') {
                    if (onOpenBulkLaundry) onOpenBulkLaundry();
                    return;
                  }
                  setSearchQuery(svc.shortTitle || svc.title);
                  setViewMode('SPLIT_VIEW');
                }}
              >
                <View style={[styles.serviceTopTatBadge, { backgroundColor: svc.tatBg || '#F0FDFA' }]}>
                  <Text style={[styles.serviceTopTatText, { color: svc.tatColor || svc.accent || '#0F766E' }]}>
                    {svc.tat}
                  </Text>
                </View>
                <View style={[styles.serviceCircleWrap, { borderColor: svc.accent || '#0F766E' }, isDark && { backgroundColor: colors.surface }]}>
                  <Image
                    source={{ uri: svc.imageUrl }}
                    style={styles.serviceCircleImg}
                    resizeMode="cover"
                  />
                </View>
                <Text style={[styles.serviceTitleText, isDark && { color: colors.textHeading }]} numberOfLines={1}>
                  {svc.shortTitle || svc.title}
                </Text>
                <Text style={[styles.servicePriceText, { color: svc.accent || '#059669' }]}>
                  {svc.priceText}
                </Text>
                <View style={[styles.serviceBottomBar, { backgroundColor: svc.accent || '#0F766E' }]} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* ===== TIER 2: DUAL-PANE SPLIT VIEW (LEFT RAIL ~24% + RIGHT PRODUCTS ~76%) ===== */
        <View style={styles.splitContainer}>
          {/* LEFT SIDEBAR CATEGORY RAIL */}
          <View style={[styles.leftRail, isDark && { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.railContent}>
              {categoriesList.map((cat) => {
                const isActive = cat.id === selectedCategoryId && !searchQuery;
                return (
                  <Pressable
                    key={cat.id}
                    style={[styles.railItem, isActive && (isDark ? { backgroundColor: colors.section } : styles.railItemActive)]}
                    onPress={() => {
                      setSelectedCategoryId(cat.id);
                      setSelectedSubCategory('All');
                      setSearchQuery('');
                    }}
                  >
                    {isActive && <View style={styles.activeIndicatorBar} />}

                    <View style={[styles.railIconBox, isDark && { backgroundColor: colors.section, borderColor: colors.border }, isActive && { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF', borderColor: '#2563EB' }]}>
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={20}
                        color={isActive ? '#2563EB' : (isDark ? colors.textCaption : '#64748B')}
                      />
                    </View>
                    <Text
                      style={[styles.railText, isDark && { color: colors.textCaption }, isActive && styles.railTextActive]}
                      numberOfLines={2}
                    >
                      {cat.shortName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* RIGHT PRODUCTS MAIN SECTION */}
          <View style={[styles.rightMain, isDark && { backgroundColor: colors.background }]}>
            {/* Subcategories Horizontal Filter Bar */}
            {!searchQuery && activeCategory.subcategories.length > 1 && (
              <View style={[styles.subCatBar, isDark && { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.subCatScroll}
                >
                  {activeCategory.subcategories.map((sub) => {
                    const isSubActive = selectedSubCategory === sub;
                    return (
                      <Pressable
                        key={sub}
                        style={[styles.subPill, isDark && { backgroundColor: colors.section }, isSubActive && styles.subPillActive]}
                        onPress={() => setSelectedSubCategory(sub)}
                      >
                        <Text style={[styles.subPillText, isDark && { color: colors.textCaption }, isSubActive && styles.subPillTextActive]}>
                          {sub}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Products List */}
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.productsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <MaterialCommunityIcons name="basket-off-outline" size={40} color={isDark ? colors.border : '#94A3B8'} />
                  <Text style={[styles.emptyTitle, isDark && { color: colors.textHeading }]}>No garments found</Text>
                  <Text style={[styles.emptySub, isDark && { color: colors.textCaption }]}>Try searching a different garment name</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isFav = isInWishlist(item.clothId);
                const inCartItem = cart.find(
                  (c) =>
                    (c.clothId && c.clothId === item.clothId && (c.serviceId === item.serviceId || c.serviceId === item.id)) ||
                    c.id === `${item.clothId}-${item.serviceId}` ||
                    c.id === `garment-${item.clothId}-${item.serviceId}` ||
                    (c.clothId && c.clothId === item.clothId)
                );
                const qty = inCartItem ? inCartItem.quantity : 0;

                return (
                  <View style={[styles.productCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {/* Garment Image */}
                    <View style={styles.productImageWrapper}>
                      <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="cover" />
                      <Pressable
                        style={styles.favBadge}
                        onPress={() => toggleWishlist(item.clothId)}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons
                          name={isFav ? 'heart' : 'heart-outline'}
                          size={16}
                          color={isFav ? '#E11D48' : '#64748B'}
                        />
                      </Pressable>
                    </View>

                    {/* Garment Details */}
                    <View style={styles.productInfo}>
                      <Text style={[styles.productName, isDark && { color: colors.textHeading }]} numberOfLines={2}>
                        {item.name}
                      </Text>

                      <View style={styles.servicePill}>
                        <MaterialCommunityIcons name="clock-fast" size={11} color="#2563EB" />
                        <Text style={styles.servicePillText}>{item.tat}</Text>
                      </View>

                      {/* Price & Action Stepper */}
                      <View style={styles.productBottomRow}>
                        <View>
                          <Text style={[styles.productRate, isDark && { color: colors.textHeading }]}>
                            ₹{item.price}
                            <Text style={[styles.productUnit, isDark && { color: colors.textCaption }]}>/{item.unit}</Text>
                          </Text>
                        </View>

                        {/* Interactive Stepper or ADD Button */}
                        {qty > 0 ? (
                          <View style={[styles.stepperBox, isDark && styles.stepperBoxDark]}>
                            <Pressable
                              style={styles.stepperBtn}
                              onPress={() => {
                                if (qty <= 1) {
                                  removeFromCart(inCartItem!.id);
                                } else {
                                  setCartQuantity(inCartItem!.id, qty - 1);
                                }
                              }}
                            >
                              <MaterialCommunityIcons name="minus" size={14} color="#FFFFFF" />
                            </Pressable>
                            <Text style={styles.stepperQty}>{qty}</Text>
                            <Pressable
                              style={styles.stepperBtn}
                              onPress={() => setCartQuantity(inCartItem!.id, qty + 1)}
                            >
                              <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            style={[styles.addBtn, isDark && styles.addBtnDark]}
                            onPress={() => {
                              if (item.unit === 'KG') {
                                addBulkToCart(item.serviceId, 1);
                              } else {
                                addGarmentToCart(item.clothId, item.serviceId);
                              }
                            }}
                          >
                            <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
                            <Text style={styles.addBtnText}>ADD</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circleGridRow4: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 16,
    width: '100%',
  },
  circleGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    marginTop: 10,
    width: '100%',
  },
  circleCatCol: {
    width: '23.5%',
    alignItems: 'center',
  },
  circleCatPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.88,
  },
  circleAvatarWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,  // 100% FULL ROUNDED CIRCLE
    borderWidth: 2.5,
    borderColor: '#0F766E',
    padding: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  circleAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
  },
  circlePillBadge: {
    position: 'absolute',
    bottom: -5,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  circlePillText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  circleCatTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 2,
  },
  serviceTopTatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTopTatText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  serviceCircleWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,  // 100% FULL ROUNDED CIRCLE
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 4,
  },
  serviceCircleImg: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
  },
  serviceTitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 2,
  },
  servicePriceText: {
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 1,
  },
  serviceBottomBar: {
    width: 20,
    height: 2.5,
    borderRadius: 2,
    marginTop: 3,
    alignSelf: 'center',
  },

  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  errorSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // 1. TOP HEADER & SEARCH
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  splitToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  splitToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  quickPillsWrap: {
    marginTop: 8,
    marginBottom: 2,
  },
  quickPillsContent: {
    gap: 8,
    paddingRight: 16,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  quickPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // 2. TIER 1: 2-COLUMN LUXURY VISUAL CATEGORY GRID
  overviewScroll: {
    padding: 14,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  overviewHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  overviewSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  catCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  catCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  catBannerWrapper: {
    height: 105,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  catBannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  catBannerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  catCardBadgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  catIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  itemCountBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemCountText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  priceTagOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceTagLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  priceTagValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2563EB',
  },
  catCardInfo: {
    padding: 10,
  },
  catCardName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 17,
  },
  catCardTagline: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
    minHeight: 28,
  },
  catCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  catCardActionText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#2563EB',
  },
  catArrowCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 3. TIER 2: DUAL-PANE SPLIT VIEW
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftRail: {
    width: '25%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  railContent: {
    paddingVertical: 6,
  },
  railItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    position: 'relative',
  },
  railItemActive: {
    backgroundColor: '#F8FAFC',
  },
  activeIndicatorBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3.5,
    backgroundColor: '#2563EB',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  railIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  railText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 13,
  },
  railTextActive: {
    color: '#0F766E',
    fontWeight: '900',
  },

  // RIGHT MAIN PRODUCTS
  rightMain: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  subCatBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subCatScroll: {
    paddingHorizontal: 10,
    gap: 6,
  },
  subPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  subPillActive: {
    backgroundColor: '#0F766E',
  },
  subPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  subPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  productsList: {
    padding: 10,
    paddingBottom: 40,
    gap: 8,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  productImageWrapper: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  favBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 8,
    padding: 2,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 17,
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    marginBottom: 4,
  },
  servicePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
  },
  productBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productRate: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  productUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#22C55E',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  addBtnDark: {
    backgroundColor: '#059669',
    borderColor: '#34D399',
    shadowColor: '#000000',
  },
  addBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 17,
    height: 34,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#22C55E',
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  stepperBoxDark: {
    backgroundColor: '#059669',
    borderColor: '#34D399',
    shadowColor: '#000000',
  },
  stepperBtn: {
    width: 30,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 18,
    textAlign: 'center',
  },
});
