import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { money } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { CATEGORY_DEFAULT_PHOTOS } from '@/lib/category-photos';
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

const CATEGORY_METAS: Record<string, {
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
    bannerImage: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/garments/cloth-shirt.jpg',
  },
  'WOMENS': {
    name: "Women's Designer Wear",
    shortName: "Women's",
    icon: 'hanger',
    iconBg: '#FFF1F2',
    iconColor: '#DB2777',
    tagline: 'Silk Sarees, Kurtis, Dresses & Tops',
    bannerImage: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/garments/cloth-saree-silk.jpg',
  },
  'KIDS': {
    name: 'Kids & Infants Care',
    shortName: 'Kids',
    icon: 'baby-carriage',
    iconBg: '#F5F3FF',
    iconColor: '#7C3AED',
    tagline: 'Gentle Hypoallergenic Sanitized Wash',
    bannerImage: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/garments/cloth-baby_toy.jpg',
  },
  'HOME_TEXTILES': {
    name: 'Home, Living & Linen',
    shortName: 'Home',
    icon: 'curtains',
    iconBg: '#F0FDF4',
    iconColor: '#16A34A',
    tagline: 'Blankets, Quilts, Bedsheets & Curtains',
    bannerImage: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/garments/cloth-bedsheet-s.jpg',
  },
  'FOOTWEAR': {
    name: 'Shoe & Sneaker Spa',
    shortName: 'Shoes',
    icon: 'shoe-sneaker',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    tagline: 'Sneakers, Formal & Suede Shoes',
    bannerImage: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/garments/cloth-shoes-sneaker.jpg',
  },
  'ACCESSORIES': {
    name: 'Bags & Accessories',
    shortName: 'Bags',
    icon: 'bag-personal',
    iconBg: '#FDF2F8',
    iconColor: '#E11D48',
    tagline: 'Backpacks, Handbags & Leather Goods',
    bannerImage: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/garments/cloth-handbag.jpg',
  },
  'BULK': {
    name: 'Daily Wash & Steam Press (KG)',
    shortName: 'Bulk KG',
    icon: 'scale',
    iconBg: '#FFF7ED',
    iconColor: '#EA580C',
    tagline: 'Bulk Everyday Laundry by Weight',
    bannerImage: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/banners/banner-bulk.jpg',
  },
};

export function ServicesScreen({ onBook, onOpenBulkLaundry }: ServicesScreenProps) {
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
    Object.entries(CATEGORY_METAS).forEach(([k, v]) => {
      categoryBuckets[k] = { meta: { id: k, ...v }, items: [] };
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

      let targetCatKey = CATEGORY_METAS[rawTag] ? rawTag : 'MENS';
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
        imageUrl: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/banners/banner-4.jpg',
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
          bannerImage: dynamicImage || 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/categories/mens-wear.jpg',
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
      bannerImage: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/banners/banner-1.jpg',
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return allProductsList.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.serviceName.toLowerCase().includes(q) ||
          p.subCategory.toLowerCase().includes(q)
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
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Fetching live catalog from backend...</Text>
      </View>
    );
  }

  // Error state with retry
  if (catalogError && categoriesList.length === 0) {
    return (
      <View style={styles.centerBox}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Could not load catalog</Text>
        <Text style={styles.errorSub}>{catalogError}</Text>
        <Pressable style={styles.retryBtn} onPress={() => refreshCatalog()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* 🔝 1. TOP STICKY HEADER WITH SEARCH */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {viewMode === 'SPLIT_VIEW' ? (
            <Pressable style={styles.backBtn} onPress={() => setViewMode('ALL_CATEGORIES')}>
              <MaterialCommunityIcons name="arrow-left" size={20} color="#0F172A" />
              <Text style={styles.backBtnText}>All Categories</Text>
            </Pressable>
          ) : (
            <View>
              <Text style={styles.headerTitle}>All Categories & Care</Text>
              <Text style={styles.headerSub}>
                {allProductsList.length} Garments • Live Backend Rates
              </Text>
            </View>
          )}

          {viewMode === 'ALL_CATEGORIES' && (
            <Pressable style={styles.splitToggleBtn} onPress={() => setViewMode('SPLIT_VIEW')}>
              <MaterialCommunityIcons name="view-split-vertical" size={16} color="#2563EB" />
              <Text style={styles.splitToggleText}>Browse Rail</Text>
            </Pressable>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
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
                  style={[styles.quickPill, isSelected && styles.quickPillActive]}
                  onPress={() => handleOpenCategory(cat.id)}
                >
                  <MaterialCommunityIcons
                    name={cat.icon as any}
                    size={14}
                    color={isSelected ? '#FFFFFF' : cat.iconColor}
                  />
                  <Text style={[styles.quickPillText, isSelected && styles.quickPillTextActive]}>
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
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.overviewHeading}>Explore by Category ({categoriesList.length})</Text>
            <Text style={styles.overviewSub}>Tap to view all garments</Text>
          </View>

          <View style={styles.circleGridContainer}>
            {categoriesList.map((cat) => (
              <Pressable
                key={cat.id}
                style={({ pressed }) => [styles.circleCatCol, pressed && styles.circleCatPressed]}
                onPress={() => handleOpenCategory(cat.id)}
              >
                {/* Circular Image with Gold/Orange Accent Ring */}
                <View style={styles.circleAvatarWrapper}>
                  <Image
                    source={{
                      uri: imgErrors[cat.id]
                        ? (CATEGORY_DEFAULT_PHOTOS[cat.id] || 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80')
                        : cat.bannerImage
                    }}
                    style={styles.circleAvatarImg}
                    resizeMode="cover"
                    onError={() => setImgErrors((prev) => ({ ...prev, [cat.id]: true }))}
                  />
                  {/* Subtle item count pill */}
                  <View style={styles.circlePillBadge}>
                    <Text style={styles.circlePillText}>{cat.itemCount} items</Text>
                  </View>
                </View>

                {/* Category Name */}
                <Text style={styles.circleCatTitle} numberOfLines={2}>
                  {cat.shortName || cat.name}
                </Text>

                {/* Starting Price */}
                <Text style={styles.circleCatPrice}>
                  From ₹{cat.startPrice}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* ===== TIER 2: DUAL-PANE SPLIT VIEW (LEFT RAIL ~24% + RIGHT PRODUCTS ~76%) ===== */
        <View style={styles.splitContainer}>
          {/* LEFT SIDEBAR CATEGORY RAIL */}
          <View style={styles.leftRail}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.railContent}>
              {categoriesList.map((cat) => {
                const isActive = cat.id === selectedCategoryId && !searchQuery;
                return (
                  <Pressable
                    key={cat.id}
                    style={[styles.railItem, isActive && styles.railItemActive]}
                    onPress={() => {
                      setSelectedCategoryId(cat.id);
                      setSelectedSubCategory('All');
                      setSearchQuery('');
                    }}
                  >
                    {isActive && <View style={styles.activeIndicatorBar} />}

                    <View style={[styles.railIconBox, isActive && { backgroundColor: '#EFF6FF', borderColor: '#2563EB' }]}>
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={20}
                        color={isActive ? '#2563EB' : '#64748B'}
                      />
                    </View>
                    <Text
                      style={[styles.railText, isActive && styles.railTextActive]}
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
          <View style={styles.rightMain}>
            {/* Subcategories Horizontal Filter Bar */}
            {!searchQuery && activeCategory.subcategories.length > 1 && (
              <View style={styles.subCatBar}>
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
                        style={[styles.subPill, isSubActive && styles.subPillActive]}
                        onPress={() => setSelectedSubCategory(sub)}
                      >
                        <Text style={[styles.subPillText, isSubActive && styles.subPillTextActive]}>
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
                  <MaterialCommunityIcons name="basket-off-outline" size={40} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No garments found</Text>
                  <Text style={styles.emptySub}>Try searching a different garment name</Text>
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
                  <View style={styles.productCard}>
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
                      <Text style={styles.productName} numberOfLines={2}>
                        {item.name}
                      </Text>

                      <View style={styles.servicePill}>
                        <MaterialCommunityIcons name="clock-fast" size={11} color="#2563EB" />
                        <Text style={styles.servicePillText}>{item.tat}</Text>
                      </View>

                      {/* Price & Action Stepper */}
                      <View style={styles.productBottomRow}>
                        <View>
                          <Text style={styles.productRate}>
                            ₹{item.price}
                            <Text style={styles.productUnit}>/{item.unit}</Text>
                          </Text>
                        </View>

                        {/* Interactive Stepper or ADD Button */}
                        {qty > 0 ? (
                          <View style={styles.stepperBox}>
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
                            style={styles.addBtn}
                            onPress={() => {
                              if (item.unit === 'KG') {
                                addBulkToCart(item.serviceId, 1);
                              } else {
                                addGarmentToCart(item.clothId, item.serviceId);
                              }
                            }}
                          >
                            <MaterialCommunityIcons name="plus" size={14} color="#2563EB" />
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
  circleGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 6,
    marginTop: 8,
  },
  circleCatCol: {
    width: '33.333%',
    alignItems: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  circleCatPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.88,
  },
  circleAvatarWrapper: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2.5,
    borderColor: '#FF7A00',
    padding: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  circlePillBadge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  circlePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  circleCatTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  circleCatPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
    textAlign: 'center',
    marginTop: 2,
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
    color: '#2563EB',
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
    backgroundColor: '#2563EB',
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
    color: '#2563EB',
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
    gap: 3,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: 0.3,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    height: 30,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 26,
    height: 30,
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
