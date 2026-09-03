import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { getCategoryImageUrl, getSubcategoryImageUrl } from '@/lib/category-photos';
import type { Catalog } from '@/types/domain';

interface CategoryCatalogScreenProps {
  categoryTag?: string; // 'MENS' | 'WOMENS' | 'KIDS' | 'HOME_TEXTILES' | 'ACCESSORIES' | 'ALL'
  categoryTitle?: string;
  initialServiceFilter?: 'ALL' | 'PRESS' | 'WASH_IRON' | 'DRY_CLEAN';
  initialServiceName?: string;
  onBack: () => void;
  onViewCart?: () => void;
  onOpenCart?: () => void;
}

interface ServicePriceOption {
  serviceId: string;
  serviceName: string;
  serviceCode: 'PRESS' | 'WASH_IRON' | 'DRY_CLEAN' | 'OTHER';
  price: number;
  icon: string;
  unit: string;
}

interface ProductItem {
  id: string;
  name: string;
  categoryTag: string;
  categoryLabel: string;
  subcategory: string;
  imageUrl?: string;
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
  BULK: ['Daily Wash & Fold', 'Bed Linen Bulk', 'Express KG Wash'],
};

// Available Main Categories
const MAIN_CATEGORIES = [
  { tag: 'MENS', label: "Men's", icon: 'tshirt-crew' },
  { tag: 'WOMENS', label: "Women's", icon: 'hanger' },
  { tag: 'KIDS', label: 'Kids', icon: 'baby-carriage' },
  { tag: 'HOME_TEXTILES', label: 'Home Linen', icon: 'bed-outline' },
  { tag: 'FOOTWEAR', label: 'Footwear', icon: 'shoe-sneaker' },
  { tag: 'ACCESSORIES', label: 'Accessories', icon: 'bag-personal-outline' },
  { tag: 'BULK', label: 'Bulk KG', icon: 'scale' },
];

// Service filter options
const SERVICE_FILTERS = [
  { key: 'ALL', label: 'All Services', icon: 'check-all' },
  { key: 'PRESS', label: 'Steam Press', icon: 'iron' },
  { key: 'WASH_IRON', label: 'Wash & Iron', icon: 'washing-machine' },
  { key: 'DRY_CLEAN', label: 'Dry Clean', icon: 'coat-rack' },
];


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

export function CategoryCatalogScreen({
  categoryTag = 'MENS',
  categoryTitle = "Men's Wear",
  initialServiceFilter = 'ALL',
  initialServiceName,
  onBack,
  onViewCart,
  onOpenCart,
}: CategoryCatalogScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { catalog, cart, addCartItem, setCartQuantity, removeFromCart, wishlist, toggleWishlist } = useApp();

  // Active Category State
  const [activeCategoryTag, setActiveCategoryTag] = useState<string>(
    categoryTag === 'ALL' ? 'MENS' : categoryTag
  );
  const [activeCategoryTitle, setActiveCategoryTitle] = useState<string>(
    categoryTitle || "Men's Wear"
  );

  // Filters State
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('ALL');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<'ALL' | 'PRESS' | 'WASH_IRON' | 'DRY_CLEAN'>(
    initialServiceFilter || 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<'POPULAR' | 'PRICE_LOW' | 'PRICE_HIGH'>('POPULAR');

  // Track chosen service per cloth ID
  const [selectedClothServiceMap, setSelectedClothServiceMap] = useState<Record<string, string>>({});

  // Image error tracker
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});

  // Dynamic Catalog from backend
  const [dynamicCatalog, setDynamicCatalog] = useState<Catalog | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync state if prop changes
  useEffect(() => {
    if (categoryTag && categoryTag !== 'ALL') {
      setActiveCategoryTag(categoryTag);
    }
    if (categoryTitle) {
      setActiveCategoryTitle(categoryTitle);
    }
  }, [categoryTag, categoryTitle]);

  // Fetch full live catalog on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

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

        if (rawCatalog) {
          setDynamicCatalog(rawCatalog);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter cloths matching activeCategoryTag
  const activeClothTypes = useMemo(() => {
    const list = dynamicCatalog?.clothTypes || catalog?.clothTypes || [];
    if (!activeCategoryTag || activeCategoryTag === 'ALL') return list;
    const cleanTag = activeCategoryTag.toUpperCase().replace(/_/g, '-');
    return list.filter((c: any) => {
      const cTag = (c.categoryTag || '').toUpperCase().replace(/_/g, '-');
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

  // Subcategories List extracted dynamically
  const subcategoriesList = useMemo(() => {
    const rawSet = new Set<string>();
    activeClothTypes.forEach((c: any) => {
      const sub = c.subcategory || c.subCategory;
      if (sub && typeof sub === 'string' && sub.trim().length > 0) {
        rawSet.add(sub.trim());
      }
    });

    const fallbackList =
      SUBCATEGORY_MAP[activeCategoryTag.toUpperCase()] ||
      SUBCATEGORY_MAP[activeCategoryTag.toUpperCase().replace(/_/g, '-')] ||
      [];
    fallbackList.forEach((f: string) => rawSet.add(f));

    return ['ALL', ...Array.from(rawSet)];
  }, [activeClothTypes, activeCategoryTag]);

  // Build product items with real multi-service backend rates
  const products: ProductItem[] = useMemo(() => {
    const matrixLookup: Record<string, Record<string, number>> = {};
    activePriceMatrix.forEach((pm: any) => {
      if (!pm) return;
      const clothId = pm.clothTypeId || pm.clothId;
      if (!clothId || !pm.serviceId) return;
      if (!matrixLookup[clothId]) matrixLookup[clothId] = {};
      if (pm.price && pm.price > 0) {
        matrixLookup[clothId][pm.serviceId] = pm.price;
      }
    });

    return activeClothTypes.map((cloth: any) => {
      const clothPrices = matrixLookup[cloth.id] || {};

      const servicesForCloth: ServicePriceOption[] = [
        {
          serviceId: 'srv-m-steam-iron',
          serviceName: 'Steam Press',
          serviceCode: 'PRESS',
          price: clothPrices['srv-m-steam-iron'] || 20,
          icon: 'iron',
          unit: 'Piece',
        },
        {
          serviceId: 'srv-m-wash-iron',
          serviceName: 'Wash & Iron',
          serviceCode: 'WASH_IRON',
          price: clothPrices['srv-m-wash-iron'] || 50,
          icon: 'washing-machine',
          unit: 'Piece',
        },
        {
          serviceId: 'srv-m-dry-clean',
          serviceName: 'Dry Clean',
          serviceCode: 'DRY_CLEAN',
          price: clothPrices['srv-m-dry-clean'] || 90,
          icon: 'coat-rack',
          unit: 'Piece',
        },
      ];

      const validPrices = servicesForCloth.map((s) => s.price).filter((p) => p > 0);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 20;

      return {
        id: cloth.id,
        name: cloth.name,
        categoryTag: cloth.categoryTag || activeCategoryTag,
        categoryLabel: cloth.categoryLabel || activeCategoryTitle,
        subcategory: cloth.subcategory || cloth.subCategory || 'General',
        imageUrl: getGarmentImageUrl(cloth.id, cloth.imageUrl || cloth.image, cloth.categoryTag, cloth.name),
        description: cloth.description,
        services: servicesForCloth,
        minPrice,
      };
    });
  }, [activeClothTypes, activePriceMatrix, activeCategoryTag, activeCategoryTitle]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedSubcategory !== 'ALL') {
      const targetSub = selectedSubcategory.toLowerCase().trim();
      list = list.filter((p) => {
        const itemSub = (p.subcategory || '').toLowerCase().trim();
        const itemName = (p.name || '').toLowerCase().trim();
        return (
          itemSub === targetSub ||
          itemSub.includes(targetSub) ||
          targetSub.includes(itemSub) ||
          matchesSubcategoryKeyword(itemName, targetSub)
        );
      });
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (selectedServiceFilter !== 'ALL') {
      list = list.filter((p) =>
        p.services.some((s) => s.serviceCode === selectedServiceFilter)
      );
    }

    if (selectedSort === 'PRICE_LOW') {
      list = [...list].sort((a, b) => a.minPrice - b.minPrice);
    } else if (selectedSort === 'PRICE_HIGH') {
      list = [...list].sort((a, b) => b.minPrice - a.minPrice);
    }

    return list;
  }, [products, selectedSubcategory, searchQuery, selectedServiceFilter, selectedSort]);

  // Selected Service per Product - FIX: Ensure displayed price matches selected service filter
  const getSelectedServiceForCloth = (cloth: ProductItem): ServicePriceOption => {
    // Priority 1: If user manually selected a service for this cloth, use that
    const selectedId = selectedClothServiceMap[cloth.id];
    if (selectedId) {
      const found = cloth.services.find((s) => s.serviceId === selectedId);
      if (found) return found;
    }
    
    // Priority 2: If a service filter is active (not 'ALL'), MUST show that service's price
    if (selectedServiceFilter !== 'ALL') {
      const matchedFilter = cloth.services.find((s) => s.serviceCode === selectedServiceFilter);
      if (matchedFilter) return matchedFilter;
      // If the filtered service doesn't exist for this cloth, show first available with warning
      console.warn(`Service filter ${selectedServiceFilter} not available for cloth ${cloth.name}`);
    }
    
    // Priority 3: Default to Wash & Iron as it's most common
    return (
      cloth.services.find((s) => s.serviceCode === 'WASH_IRON') ||
      cloth.services[0] || {
        serviceId: 'srv-m-wash-iron',
        serviceName: 'Wash & Iron',
        serviceCode: 'WASH_IRON',
        price: 50,
        icon: 'washing-machine',
        unit: 'Piece',
      }
    );
  };

  const handleSelectServiceForCloth = (clothId: string, serviceId: string) => {
    setSelectedClothServiceMap((prev) => ({
      ...prev,
      [clothId]: serviceId,
    }));
  };

  // Cart Operations
  const handleAddToCart = (cloth: ProductItem, service: ServicePriceOption) => {
    const cartItemId = `${cloth.id}-${service.serviceId}`;
    const cleanSvcName = service?.serviceName && service.serviceName !== 'null' && service.serviceName !== 'undefined'
      ? service.serviceName
      : (service?.serviceCode === 'PRESS' ? 'Steam Press' : service?.serviceCode === 'DRY_CLEAN' ? 'Dry Clean' : 'Wash & Iron');
    const displayName = `${cloth.name} (${cleanSvcName})`;
    
    addCartItem({
      id: cartItemId,
      serviceId: service.serviceId,
      serviceName: displayName,
      categoryName: activeCategoryTitle,
      pricingModel: service.unit === 'KG' ? 'PER_KG' : 'PER_ITEM',
      unitPrice: service.price,
      quantity: 1,
      unit: service.unit,
      subtotal: service.price,
      clothId: cloth.id,
      imageUrl: cloth.imageUrl || getGarmentImageUrl(cloth.id, undefined, cloth.categoryTag),
    });
  };

  const getCartItemForProduct = (cloth: ProductItem, serviceId: string) => {
    const directId = `${cloth.id}-${serviceId}`;
    return cart.find(
      (c) =>
        c.id === directId ||
        c.id === `cat-${directId}` ||
        c.id === `garment-${directId}` ||
        (c.clothId === cloth.id && c.serviceId === serviceId)
    );
  };

  const getCartQuantityForProduct = (cloth: ProductItem, serviceId: string): number => {
    const item = getCartItemForProduct(cloth, serviceId);
    return item ? item.quantity : 0;
  };

  const handleIncrement = (cloth: ProductItem, service: ServicePriceOption) => {
    const item = getCartItemForProduct(cloth, service.serviceId);
    if (item) {
      setCartQuantity(item.id, item.quantity + 1);
    } else {
      handleAddToCart(cloth, service);
    }
  };

  const handleDecrement = (cloth: ProductItem, service: ServicePriceOption) => {
    const item = getCartItemForProduct(cloth, service.serviceId);
    if (!item) return;
    if (item.quantity <= 1) {
      removeFromCart(item.id);
    } else {
      setCartQuantity(item.id, item.quantity - 1);
    }
  };

  // Cart summary
  const cartSummary = useMemo(() => {
    const count = cart.reduce((acc, item) => acc + item.quantity, 0);
    const total = cart.reduce((acc, item) => acc + (item.subtotal || item.unitPrice * item.quantity), 0);
    return { itemCount: count, itemTotal: total };
  }, [cart]);

  const handleCartClick = onOpenCart || onViewCart || (() => {});

  // Responsive 2-column card calculation
  const screenPadding = 16;
  const gridGap = 12;
  const cardWidth = Math.floor((windowWidth - screenPadding * 2 - gridGap) / 2);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 1. TOP APP BAR (72-80px, 44x44 touch targets, clean title & badge) */}
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressedBtn]}
          onPress={onBack}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>

        <View style={styles.titleColumn}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {initialServiceName && initialServiceName !== activeCategoryTitle
              ? `${initialServiceName} • ${activeCategoryTitle}`
              : activeCategoryTitle}
          </Text>
          <Text style={styles.topBarSubtitle}>
            {filteredProducts.length} items available
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.cartBtn, pressed && styles.pressedBtn]}
          onPress={handleCartClick}
          hitSlop={8}
          accessibilityLabel="Shopping bag"
        >
          <MaterialCommunityIcons name="shopping-outline" size={24} color="#111827" />
          {cartSummary.itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartSummary.itemCount > 99 ? '99+' : cartSummary.itemCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* 2. MAIN CATEGORY TABS (44px height, horizontal scrollable pills, smooth scroll) */}
      <View style={styles.categoryTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabsScroll}
        >
          {MAIN_CATEGORIES.map((c) => {
            const isSelected = activeCategoryTag === c.tag;
            return (
              <Pressable
                key={c.tag}
                style={({ pressed }) => [
                  styles.categoryPill,
                  isSelected ? styles.categoryPillSelected : styles.categoryPillUnselected,
                  pressed && styles.pressedBtn,
                ]}
                onPress={() => {
                  setActiveCategoryTag(c.tag);
                  setActiveCategoryTitle(c.label);
                  setSelectedSubcategory('ALL');
                }}
              >
                <MaterialCommunityIcons
                  name={c.icon as any}
                  size={16}
                  color={isSelected ? '#FFFFFF' : '#475569'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.categoryPillText, isSelected ? styles.categoryPillTextSelected : styles.categoryPillTextUnselected]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. SEARCH BAR (50-52px height, 14-16px radius, background #F1F5F9, no heavy border) */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search all garments..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      </View>

      {/* 4. SERVICE FILTERS (38-40px height, horizontal scrollable chips, orange active) */}
      <View style={styles.serviceFiltersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.serviceFiltersScroll}
        >
          {SERVICE_FILTERS.map((item) => {
            const isSelected = selectedServiceFilter === item.key;
            return (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.serviceChip,
                  isSelected ? styles.serviceChipSelected : styles.serviceChipUnselected,
                  pressed && styles.pressedBtn,
                ]}
                onPress={() => setSelectedServiceFilter(item.key as any)}
              >
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={15}
                  color={isSelected ? '#FFFFFF' : '#475569'}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.serviceChipText, isSelected ? styles.serviceChipTextSelected : styles.serviceChipTextUnselected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. HORIZONTAL GARMENT SUBCATEGORY CAROUSEL (56-64px circles, orange ring, NO SIDEBAR) */}
      <View style={styles.subcatCarouselContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subcatCarouselScroll}
        >
          {subcategoriesList.map((sub) => {
            const isSelected = selectedSubcategory === sub;
            const isAll = sub === 'ALL';
            const displayName = isAll ? 'All' : sub;
            const subPhotoUrl = isAll
              ? getCategoryImageUrl(activeCategoryTag)
              : getSubcategoryImageUrl(sub, activeCategoryTag);

            return (
              <Pressable
                key={sub}
                style={({ pressed }) => [
                  styles.subcatCircleItem,
                  pressed && styles.pressedBtn,
                ]}
                onPress={() => setSelectedSubcategory(sub)}
              >
                {/* Circular image with 2px orange ring when active */}
                <View style={[styles.subcatCircleWrap, isSelected && styles.subcatCircleWrapSelected]}>
                  <Image
                    source={{ uri: subPhotoUrl }}
                    style={styles.subcatCircleImg}
                    resizeMode="cover"
                  />
                </View>
                <Text
                  style={[styles.subcatCircleText, isSelected && styles.subcatCircleTextSelected]}
                  numberOfLines={2}
                >
                  {displayName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 7. BREADCRUMB NAVIGATION - Show active filters clearly */}
      {(selectedServiceFilter !== 'ALL' || selectedSubcategory !== 'ALL' || searchQuery.trim().length > 0) && (
        <View style={styles.breadcrumbContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumbScroll}>
            <View style={styles.breadcrumbChip}>
              <Text style={styles.breadcrumbText}>{activeCategoryTitle}</Text>
            </View>
            {selectedServiceFilter !== 'ALL' && (
              <>
                <MaterialCommunityIcons name="chevron-right" size={14} color="#94A3B8" />
                <View style={[styles.breadcrumbChip, styles.breadcrumbChipActive]}>
                  <Text style={styles.breadcrumbTextActive}>
                    {SERVICE_FILTERS.find(f => f.key === selectedServiceFilter)?.label || selectedServiceFilter}
                  </Text>
                  <Pressable onPress={() => setSelectedServiceFilter('ALL')} hitSlop={6}>
                    <MaterialCommunityIcons name="close-circle" size={14} color="#FF6B0B" />
                  </Pressable>
                </View>
              </>
            )}
            {selectedSubcategory !== 'ALL' && (
              <>
                <MaterialCommunityIcons name="chevron-right" size={14} color="#94A3B8" />
                <View style={[styles.breadcrumbChip, styles.breadcrumbChipActive]}>
                  <Text style={styles.breadcrumbTextActive}>{selectedSubcategory}</Text>
                  <Pressable onPress={() => setSelectedSubcategory('ALL')} hitSlop={6}>
                    <MaterialCommunityIcons name="close-circle" size={14} color="#FF6B0B" />
                  </Pressable>
                </View>
              </>
            )}
            {searchQuery.trim().length > 0 && (
              <>
                <MaterialCommunityIcons name="chevron-right" size={14} color="#94A3B8" />
                <View style={[styles.breadcrumbChip, styles.breadcrumbChipActive]}>
                  <Text style={styles.breadcrumbTextActive}>"{searchQuery}"</Text>
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                    <MaterialCommunityIcons name="close-circle" size={14} color="#FF6B0B" />
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* 8. RESULT INFORMATION & SORT ROW */}
      <View style={styles.resultRow}>
        <Text style={styles.resultCountText}>
          {filteredProducts.length} item{filteredProducts.length !== 1 ? 's' : ''} found
        </Text>
        <Pressable
          style={({ pressed }) => [styles.sortBtn, pressed && styles.pressedBtn]}
          onPress={() => {
            setSelectedSort((prev) =>
              prev === 'POPULAR' ? 'PRICE_LOW' : prev === 'PRICE_LOW' ? 'PRICE_HIGH' : 'POPULAR'
            );
          }}
          hitSlop={6}
        >
          <MaterialCommunityIcons name="swap-vertical" size={16} color="#475569" />
          <Text style={styles.sortBtnText}>
            {selectedSort === 'POPULAR' ? 'Popular' : selectedSort === 'PRICE_LOW' ? 'Price: Low' : 'Price: High'}
          </Text>
        </Pressable>
      </View>

      {/* 9. PRODUCT GRID (FULL SCREEN WIDTH 2-COLUMN GRID, ZERO SIDEBAR!) */}
      {isLoading && filteredProducts.length === 0 ? (
        <View style={styles.loadingGridContainer}>
          <ActivityIndicator size="large" color="#FF6B0B" />
          <Text style={styles.loadingText}>Loading live garments from catalog...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="hanger" size={52} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No garments found</Text>
          <Text style={styles.emptySubtitle}>
            Try clearing filters or search to view all {activeCategoryTitle} items.
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
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.productsScrollContent,
            {
              // Generous bottom padding: Cart bar height (60) + safe area + 30px
              paddingBottom: 64 + Math.max(insets.bottom, 12) + 28,
            },
          ]}
        >
          <View style={styles.productsGrid2Col}>
            {filteredProducts.map((cloth) => {
              const chosenService = getSelectedServiceForCloth(cloth);
              const cartQty = getCartQuantityForProduct(cloth, chosenService.serviceId);
              const isImgBroken = imageErrors[cloth.id];
              const isImageLoading = imageLoading[cloth.id];
              const photoUrl =
                !isImgBroken && (cloth.imageUrl || getGarmentImageUrl(cloth.id, undefined, cloth.categoryTag));
              const isFavorite = wishlist.includes(cloth.id);

              return (
                <View
                  key={cloth.id}
                  style={[styles.productCard, { width: cardWidth }]}
                >
                  {/* 10. PRODUCT IMAGE (1:1 Aspect Ratio, Rounded Top, Favorite & Badges) */}
                  <View style={styles.cardImageContainer}>
                    {photoUrl ? (
                      <>
                        <Image
                          source={{ uri: photoUrl }}
                          style={styles.cardImage}
                          resizeMode="cover"
                          onLoadStart={() => setImageLoading((prev) => ({ ...prev, [cloth.id]: true }))}
                          onLoadEnd={() => setImageLoading((prev) => ({ ...prev, [cloth.id]: false }))}
                          onError={() => {
                            setImageErrors((prev) => ({ ...prev, [cloth.id]: true }));
                            setImageLoading((prev) => ({ ...prev, [cloth.id]: false }));
                          }}
                        />
                        {isImageLoading && (
                          <View style={styles.imageLoadingOverlay}>
                            <ActivityIndicator size="small" color="#FF6B0B" />
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.cardImageFallback}>
                        <MaterialCommunityIcons name="tshirt-crew" size={40} color="#94A3B8" />
                        <Text style={styles.fallbackText}>No Image</Text>
                      </View>
                    )}

                    {/* 14. Favorite Button (36x36 white translucent circle top-right) */}
                    <Pressable
                      style={({ pressed }) => [styles.favoriteCircleBtn, pressed && styles.pressedBtn]}
                      onPress={() => toggleWishlist(cloth.id)}
                      hitSlop={8}
                    >
                      <MaterialCommunityIcons
                        name={isFavorite ? 'heart' : 'heart-outline'}
                        size={18}
                        color={isFavorite ? '#EF4444' : '#334155'}
                      />
                    </Pressable>

                    {/* 12. ⚡ 24h Express Badge (Small blue pill bottom-left) */}
                    <View style={styles.expressBadge}>
                      <Text style={styles.expressBadgeText}>⚡ 24h</Text>
                    </View>

                    {/* 13. ⭐ 4.9 Rating Badge (Compact pill bottom-right) */}
                    <View style={styles.ratingBadge}>
                      <MaterialCommunityIcons name="star" size={11} color="#F59E0B" />
                      <Text style={styles.ratingBadgeText}>4.9</Text>
                    </View>
                  </View>

                  {/* PRODUCT CARD BODY (Fixed Heights for Perfect Equal Alignment Across Cards) */}
                  <View style={styles.cardBody}>
                    {/* 15. Product Title (2-lines fixed height: 40px) */}
                    <View style={styles.titleContainer}>
                      <Text style={styles.productCardTitle} numberOfLines={2}>
                        {cloth.name}
                      </Text>
                    </View>

                    {/* 16. ALL SERVICE PRICES DISPLAY - Show all prices at once for easy comparison */}
                    <View style={styles.allPricesContainer}>
                      {cloth.services.map((srv) => {
                        const isChosen = chosenService.serviceId === srv.serviceId;
                        const label =
                          srv.serviceCode === 'PRESS'
                            ? 'Press'
                            : srv.serviceCode === 'WASH_IRON'
                            ? 'Wash+Iron'
                            : 'Dry Clean';

                        return (
                          <Pressable
                            key={srv.serviceId}
                            style={[
                              styles.priceOptionRow,
                              isChosen && styles.priceOptionRowActive,
                            ]}
                            onPress={() => handleSelectServiceForCloth(cloth.id, srv.serviceId)}
                            hitSlop={4}
                          >
                            <View style={styles.priceOptionLeft}>
                              <MaterialCommunityIcons 
                                name={srv.icon as any} 
                                size={14} 
                                color={isChosen ? '#FF6B0B' : '#64748B'} 
                              />
                              <Text
                                style={[
                                  styles.priceOptionLabel,
                                  isChosen && styles.priceOptionLabelActive,
                                ]}
                                numberOfLines={1}
                              >
                                {label}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.priceOptionPrice,
                                isChosen && styles.priceOptionPriceActive,
                              ]}
                            >
                              ₹{srv.price}
                            </Text>
                            {isChosen && (
                              <View style={styles.priceOptionCheck}>
                                <MaterialCommunityIcons name="check-circle" size={16} color="#FF6B0B" />
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* 18. ADD TO CART BUTTON - Large, Prominent, Always Visible */}
                    <View style={styles.ctaContainer}>
                      {cartQty > 0 ? (
                        <View style={styles.stepperWrap}>
                          <Pressable
                            style={({ pressed }) => [styles.stepperActionBtn, pressed && styles.pressedBtn]}
                            onPress={() => handleDecrement(cloth, chosenService)}
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons name="minus" size={18} color="#FFFFFF" />
                          </Pressable>
                          <Text style={styles.stepperQtyText}>{cartQty}</Text>
                          <Pressable
                            style={({ pressed }) => [styles.stepperActionBtn, pressed && styles.pressedBtn]}
                            onPress={() => handleIncrement(cloth, chosenService)}
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [styles.addBtn, pressed && styles.pressedBtn]}
                          onPress={() => handleAddToCart(cloth, chosenService)}
                          hitSlop={8}
                        >
                          <MaterialCommunityIcons name="cart-plus" size={18} color="#FFFFFF" />
                          <Text style={styles.addBtnText}>ADD TO CART</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* 20. VIEW BAG BAR — CRITICAL STICKY BAR ABOVE SAFE AREA (NEVER OVERLAPPING PRODUCTS) */}
      {cartSummary.itemCount > 0 && (
        <View style={[styles.stickyCartBarWrap, { bottom: Math.max(insets.bottom, 8) + 8 }]}>
          <Pressable
            style={({ pressed }) => [styles.stickyCartBar, pressed && styles.pressedBtn]}
            onPress={handleCartClick}
          >
            <View style={styles.cartBarLeft}>
              <View style={styles.cartBarIconBadge}>
                <MaterialCommunityIcons name="shopping" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.cartBarTotalText}>
                {cartSummary.itemCount} {cartSummary.itemCount === 1 ? 'item' : 'items'} • ₹{cartSummary.itemTotal}
              </Text>
            </View>

            <View style={styles.cartBarRight}>
              <Text style={styles.cartBarActionText}>View Bag</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* 1. Top App Bar */
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  topBarSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF6B0B',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  /* 2. Main Category Tabs */
  categoryTabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  categoryTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  categoryPillSelected: {
    backgroundColor: '#1F4B99',
  },
  categoryPillUnselected: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillText: {
    fontSize: 14,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 15,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    paddingVertical: 0,
  },

  /* 4. Service Filters */
  serviceFiltersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  serviceFiltersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  serviceChip: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 19,
  },
  serviceChipSelected: {
    backgroundColor: '#FF6B0B',
    borderColor: '#FF6B0B',
  },
  serviceChipUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  serviceChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  serviceChipTextUnselected: {
    color: '#334155',
  },

  /* 5. Horizontal Subcategory Carousel (Replaces vertical sidebar) */
  subcatCarouselContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
  },
  subcatCarouselScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  subcatCircleItem: {
    width: 72,
    alignItems: 'center',
  },
  subcatCircleWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  subcatCircleWrapSelected: {
    borderColor: '#FF6B0B',
    backgroundColor: '#FFF7ED',
  },
  subcatCircleImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  subcatCircleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  subcatCircleTextSelected: {
    color: '#FF6B0B',
    fontWeight: '700',
  },

  /* 6. Breadcrumb Navigation */
  breadcrumbContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
  },
  breadcrumbScroll: {
    paddingHorizontal: 16,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbChipActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  breadcrumbTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B0B',
  },

  /* 7. Result Information Row */
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  /* 8. Full-Width 2-Column Product Grid */
  productsScrollContent: {
    paddingHorizontal: 16,
  },
  productsGrid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },

  /* 9. Product Card (Equal Heights, Identical Aspect Ratio, Clean Border & Soft Elevation) */
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  /* 10. Product Image (1:1 Ratio) */
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  cardImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    gap: 6,
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  favoriteCircleBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  expressBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  expressBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
  },

  /* Product Card Body */
  cardBody: {
    padding: 12,
  },
  titleContainer: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
  },
  productCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 19,
  },

  /* All Service Prices Display - Show all prices for easy comparison */
  allPricesContainer: {
    gap: 6,
    marginBottom: 8,
  },
  priceOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceOptionRowActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FF6B0B',
    borderWidth: 2,
  },
  priceOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  priceOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  priceOptionLabelActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B0B',
  },
  priceOptionPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginRight: 4,
  },
  priceOptionPriceActive: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FF6B0B',
  },
  priceOptionCheck: {
    marginLeft: 4,
  },

  /* 18. ADD Button & Stepper (Exactly 48px height for better visibility) */
  /* 18. ADD Button & Stepper (Exactly 48px height for better visibility) */
  ctaContainer: {
    height: 48,
  },
  addBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B0B',
    borderRadius: 12,
    gap: 6,
    shadowColor: '#FF6B0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  stepperWrap: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF6B0B',
    borderRadius: 12,
    paddingHorizontal: 10,
    shadowColor: '#FF6B0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  stepperActionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepperQtyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },

  /* 20. Sticky Cart Bar (Above Android Safe Area) */
  stickyCartBarWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99,
  },
  stickyCartBar: {
    height: 60,
    backgroundColor: '#FF6B0B',
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#FF6B0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cartBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartBarIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarTotalText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cartBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartBarActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Empty & Loading States */
  loadingGridContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1F4B99',
    borderRadius: 10,
  },
  resetFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  pressedBtn: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
