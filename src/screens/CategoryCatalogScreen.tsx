import React, { useState, useEffect, useMemo } from 'react';
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
  onOpenBulkLaundry?: () => void;
}

type CatalogServiceCode = 'PRESS' | 'WASH_FOLD' | 'WASH_IRON' | 'DRY_CLEAN' | 'OTHER';
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
const SERVICE_FILTERS: Array<{ key: CatalogServiceFilter; label: string; icon: string }> = [
  { key: 'ALL', label: 'All Services', icon: 'check-all' },
  { key: 'PRESS', label: 'Steam Press', icon: 'iron' },
  { key: 'WASH_FOLD', label: 'Wash & Fold', icon: 'tshirt-crew-outline' },
  { key: 'WASH_IRON', label: 'Wash & Iron', icon: 'washing-machine' },
  { key: 'DRY_CLEAN', label: 'Dry Clean', icon: 'coat-rack' },
];

function normalizeCategoryTag(tag?: string): string {
  const normalized = (tag || 'MENS').toUpperCase().trim().replace(/_/g, '-');
  if (['MENS', 'MEN', 'MENS-WEAR'].includes(normalized)) return 'MENS';
  if (['WOMENS', 'WOMEN', 'WOMENS-WEAR'].includes(normalized)) return 'WOMENS';
  if (['HOME', 'HOME-TEXTILES'].includes(normalized)) return 'HOME_TEXTILES';
  if (['SHOES', 'FOOTWEAR'].includes(normalized)) return 'FOOTWEAR';
  if (['BAGS', 'ACCESSORIES'].includes(normalized)) return 'ACCESSORIES';
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

export function CategoryCatalogScreen({
  categoryTag = 'MENS',
  categoryTitle = "Men's Wear",
  initialServiceFilter = 'ALL',
  onBack,
  onViewCart,
  onOpenCart,
  onOpenBulkLaundry,
}: CategoryCatalogScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { catalog, cart, cartSummary, addCartItem, setCartQuantity, removeFromCart, wishlist, toggleWishlist } = useApp();
  const initialCategoryTag = normalizeCategoryTag(categoryTag);

  // Active Category State
  const [activeCategoryTag, setActiveCategoryTag] = useState<string>(
    categoryTag === 'ALL' ? 'MENS' : initialCategoryTag
  );
  const [activeCategoryTitle, setActiveCategoryTitle] = useState<string>(
    categoryTitle || "Men's Wear"
  );

  // Filters State
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('ALL');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<CatalogServiceFilter>(
    initialServiceFilter || 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<'POPULAR' | 'PRICE_LOW' | 'PRICE_HIGH'>('POPULAR');

  // Track chosen service per cloth ID
  const [selectedClothServiceMap, setSelectedClothServiceMap] = useState<Record<string, string>>({});

  // Image error tracker
  const [imageFailures, setImageFailures] = useState<Record<string, 'primary' | 'fallback'>>({});
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [subcategoryImageErrors, setSubcategoryImageErrors] = useState<Record<string, boolean>>({});

  // Dynamic Catalog State
  const [dynamicCatalog, setDynamicCatalog] = useState<Catalog | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync categoryTag & service filter changes
  useEffect(() => {
    if (categoryTag && categoryTag !== 'ALL') {
      const norm = normalizeCategoryTag(categoryTag);
      setActiveCategoryTag(norm);
    }
    if (categoryTitle) {
      setActiveCategoryTitle(categoryTitle);
    }
    setSelectedServiceFilter(initialServiceFilter || 'ALL');
  }, [categoryTag, categoryTitle, initialServiceFilter]);

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
      if (c?.isActive === false) return false;
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

  const activeServiceMasters = useMemo(() => {
    return (dynamicCatalog?.serviceMasters || catalog?.serviceMasters || []).filter((service: any) => service?.isActive !== false);
  }, [dynamicCatalog, catalog]);

  const serviceMastersById = useMemo(
    () => new Map(activeServiceMasters.map((service: any) => [service.id, service])),
    [activeServiceMasters]
  );

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
    const knownSubcategories = fallbackList.filter((fallback) =>
      Array.from(rawSet).some((sub) => sub.toLowerCase() === fallback.toLowerCase())
    );
    const remainingSubcategories = Array.from(rawSet)
      .filter((sub) => !knownSubcategories.some((known) => known.toLowerCase() === sub.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));

    const orderedSubcategories = rawSet.size > 0
      ? [...knownSubcategories, ...remainingSubcategories]
      : fallbackList;

    return ['ALL', ...orderedSubcategories];
  }, [activeClothTypes, activeCategoryTag]);

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
      const servicesForCloth: ServicePriceOption[] = (matrixLookup[cloth.id] || [])
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
        })
        .sort((a, b) => {
          const aOrder = SERVICE_FILTERS.findIndex((filter) => filter.key === a.serviceCode);
          const bOrder = SERVICE_FILTERS.findIndex((filter) => filter.key === b.serviceCode);
          return (aOrder < 0 ? SERVICE_FILTERS.length : aOrder) - (bOrder < 0 ? SERVICE_FILTERS.length : bOrder);
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

    if (selectedServiceFilter !== 'ALL') {
      list = list.filter((p) =>
        p.services.some((s) => s.serviceCode === selectedServiceFilter)
      );
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q) ||
          p.services.some((s) => s.displayName.toLowerCase().includes(q))
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

  const getSelectedServiceForCloth = (cloth: ProductItem): ServicePriceOption => {
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
  };

  const handleSelectServiceForCloth = (clothId: string, serviceId: string) => {
    setSelectedClothServiceMap((prev) => ({
      ...prev,
      [clothId]: serviceId,
    }));
    // A card-level choice supersedes the broad filter. This keeps the highlighted
    // service and the price customers add to their bag in sync.
    setSelectedServiceFilter('ALL');
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
      imageUrl: getGarmentImageUrl(cloth.id, cloth.imageUrl, cloth.categoryTag, cloth.name),
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

  const handleCartClick = onOpenCart || onViewCart || (() => {});

  // Clean Header Title (Issue 2: No duplicate text, clear title)
  const displayTitle = MAIN_CATEGORIES.find((cat) => cat.tag === activeCategoryTag)?.label || activeCategoryTitle || 'Catalog';

  // Responsive Grid Widths
  const screenPadding = 12;
  const gridGap = 10;
  const useSingleColumn = windowWidth < 340;
  const cardWidth = useSingleColumn
    ? Math.floor(windowWidth - screenPadding * 2)
    : Math.floor((windowWidth - screenPadding * 2 - gridGap) / 2);

  return (
    <View style={styles.root}>
      {/* 1. TOP APP BAR (Compact 54px height, clean title, proper cart badge without overlap) */}
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressedBtn]}
          onPress={onBack}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
        </Pressable>

        <View style={styles.titleColumn}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {displayTitle}
          </Text>
          <Text style={styles.topBarSubtitle}>
            {selectedServiceFilter !== 'ALL'
              ? `${availableServiceFilters.find((filter) => filter.key === selectedServiceFilter)?.label || 'Selected service'} · ${filteredProducts.length} items`
              : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'item' : 'items'} available`}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.cartBtn, pressed && styles.pressedBtn]}
          onPress={handleCartClick}
          hitSlop={8}
          accessibilityLabel={`Shopping bag, ${cartSummary.itemCount} items`}
        >
          <MaterialCommunityIcons name="shopping-outline" size={22} color="#0F172A" />
          {cartSummary.itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cartSummary.itemCount > 99 ? '99+' : cartSummary.itemCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* 2. MAIN CATEGORY TABS (Compact 36px height, solid orange active state, full horizontal padding) */}
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
                style={[
                  styles.categoryPill,
                  isSelected ? styles.categoryPillSelected : styles.categoryPillUnselected,
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
                  color={isSelected ? '#FFFFFF' : '#64748B'}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected ? styles.categoryPillTextSelected : styles.categoryPillTextUnselected,
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. SEARCH BAR (Compact 40px height, rounded-full pill design) */}
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
            accessibilityLabel="Search garments"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear garment search">
              <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      </View>

      {/* 4. HORIZONTAL GARMENT SUBCATEGORY CAROUSEL (Never blank: verified photo + icon layer) */}
      <View style={styles.subcatCarouselContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subcatCarouselScroll}
        >
          {subcategoriesList.map((sub) => {
            const isSelected = selectedSubcategory === sub;
            const isAll = sub === 'ALL';
            const subcategoryKey = `${activeCategoryTag}-${sub}`;
            const subPhotoUrl = isAll
              ? getCategoryImageUrl(activeCategoryTag)
              : getSubcategoryImageUrl(sub, activeCategoryTag);
            const displayName = isAll ? 'All' : sub;
            const hasImgError = subcategoryImageErrors[subcategoryKey];

            return (
              <Pressable
                key={sub}
                style={styles.subcatCircleItem}
                onPress={() => setSelectedSubcategory(sub)}
                hitSlop={4}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Show ${displayName} garments`}
              >
                <View
                  style={[
                    styles.subcatCircleWrap,
                    isSelected && styles.subcatCircleWrapSelected,
                  ]}
                >
                  {/* Layered fallback icon: guaranteed visible */}
                  <View style={styles.subcatIconLayer}>
                    <MaterialCommunityIcons
                      name={getSubcategoryFallbackIcon(sub, activeCategoryTag) as any}
                      size={20}
                      color={isSelected ? '#FF6B0B' : '#94A3B8'}
                    />
                  </View>
                  {subPhotoUrl && !hasImgError && (
                    <Image
                      source={{ uri: subPhotoUrl }}
                      style={styles.subcatCircleImg}
                      resizeMode="cover"
                      onError={() => setSubcategoryImageErrors((curr) => ({ ...curr, [subcategoryKey]: true }))}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.subcatCircleText,
                    isSelected && styles.subcatCircleTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. INTEGRATED SERVICE FILTERS & SORT ROW (Compact 34px, no vertical stacking) */}
      <View style={styles.filterSortBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.serviceFilterScroll}
        >
          {availableServiceFilters.map((item) => {
            const isSelected = selectedServiceFilter === item.key;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.serviceChipCompact,
                  isSelected ? styles.serviceChipCompactSelected : styles.serviceChipCompactUnselected,
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
                  color={isSelected ? '#FF6B0B' : '#64748B'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.serviceChipTextCompact,
                    isSelected ? styles.serviceChipTextCompactSelected : styles.serviceChipTextCompactUnselected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          style={styles.sortButtonPill}
          onPress={() => {
            setSelectedSort((prev) =>
              prev === 'POPULAR' ? 'PRICE_LOW' : prev === 'PRICE_LOW' ? 'PRICE_HIGH' : 'POPULAR'
            );
          }}
          hitSlop={6}
        >
          <MaterialCommunityIcons name="swap-vertical" size={13} color="#FF6B0B" />
          <Text style={styles.sortButtonPillText}>
            {selectedSort === 'POPULAR' ? 'Recommended' : selectedSort === 'PRICE_LOW' ? 'Price: Low' : 'Price: High'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={13} color="#64748B" />
        </Pressable>
      </View>

      {/* 6. PRODUCT GRID (Compact, fast to scan, 4-6 products visible, safe bottom padding) */}
      {isLoading && filteredProducts.length === 0 ? (
        <View style={styles.loadingGridContainer}>
          <ActivityIndicator size="small" color="#FF6B0B" />
          <Text style={styles.loadingText}>Loading live garments...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
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
      ) : (
        <ScrollView
          style={styles.productsScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.productsScrollContent,
            {
              paddingBottom: 24,
            },
          ]}
        >
          <View style={styles.productsGrid2Col}>
            {filteredProducts.map((cloth) => {
              const chosenService = getSelectedServiceForCloth(cloth);
              const cartQty = getCartQuantityForProduct(cloth, chosenService.serviceId);
              const imageFailure = imageFailures[cloth.id];
              const primaryPhotoUrl = cloth.imageUrl
                ? getGarmentImageUrl(cloth.id, cloth.imageUrl, cloth.categoryTag, cloth.name)
                : cloth.fallbackImageUrl;
              const photoUrl = imageFailure === 'fallback'
                ? undefined
                : imageFailure === 'primary'
                ? cloth.fallbackImageUrl
                : primaryPhotoUrl;
              const isImageLoading = imageLoading[cloth.id];
              const isFavorite = wishlist.includes(cloth.id);
              const turnaround = formatTurnaround(chosenService.turnaroundHours);

              return (
                <View
                  key={cloth.id}
                  style={[styles.productCard, { width: cardWidth }]}
                >
                  {/* PRODUCT IMAGE (Compact 110px height, clean cover crop) */}
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
                            setImageFailures((current) => ({
                              ...current,
                              [cloth.id]: !current[cloth.id] && primaryPhotoUrl !== cloth.fallbackImageUrl
                                ? 'primary'
                                : 'fallback',
                            }));
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
                        <MaterialCommunityIcons name="tshirt-crew" size={32} color="#CBD5E1" />
                      </View>
                    )}

                    {/* Favorite Heart Button */}
                    <Pressable
                      style={styles.favoriteCircleBtn}
                      onPress={() => toggleWishlist(cloth.id)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={isFavorite ? `Remove ${cloth.name} from saved items` : `Save ${cloth.name}`}
                    >
                      <MaterialCommunityIcons
                        name={isFavorite ? 'heart' : 'heart-outline'}
                        size={15}
                        color={isFavorite ? '#EF4444' : '#64748B'}
                      />
                    </Pressable>

                    {turnaround ? (
                      <View style={styles.turnaroundBadge}>
                        <MaterialCommunityIcons name="clock-outline" size={10} color="#2563EB" />
                        <Text style={styles.turnaroundBadgeText}>{turnaround} TAT</Text>
                      </View>
                    ) : null}

                  </View>

                  {/* PRODUCT CARD BODY (Compact ~95px, clear price & service selection) */}
                  <View style={styles.cardBody}>
                    {/* Title */}
                    <Text style={styles.productCardTitle} numberOfLines={1}>
                      {cloth.name}
                    </Text>

                    {/* Service Selector Mini-Pills (Press, Wash+Iron, Dry Clean) */}
                    <View style={styles.serviceMiniRow}>
                      {cloth.services.map((srv) => {
                        const isChosen = chosenService.serviceId === srv.serviceId;
                        const label =
                          srv.serviceCode === 'PRESS'
                            ? 'Press'
                            : srv.serviceCode === 'WASH_IRON'
                            ? 'Wash+Iron'
                            : srv.serviceCode === 'DRY_CLEAN'
                            ? 'Dry Clean'
                            : srv.shortLabel;

                        return (
                          <Pressable
                            key={srv.serviceId}
                            style={[
                              styles.serviceMiniPill,
                              isChosen && styles.serviceMiniPillActive,
                            ]}
                            onPress={() => handleSelectServiceForCloth(cloth.id, srv.serviceId)}
                            hitSlop={4}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isChosen }}
                            accessibilityLabel={`Choose ${srv.displayName} for ${cloth.name}, ${String.fromCharCode(0x20B9)}${srv.price} per ${srv.unit.toLowerCase()}`}
                          >
                            <Text
                              style={[
                                styles.serviceMiniText,
                                isChosen && styles.serviceMiniTextActive,
                              ]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Price & Action Row */}
                    <View style={styles.priceAndActionRow}>
                      <View style={styles.priceCol}>
                        <Text style={styles.priceText}>₹{chosenService.price}</Text>
                        <Text style={styles.priceUnitText} numberOfLines={1}>
                          {chosenService.shortLabel} · /{chosenService.unit === 'KG' ? 'kg' : 'pc'}
                        </Text>
                      </View>

                      {cartQty > 0 ? (
                        <View style={styles.stepperCompact}>
                          <Pressable
                            style={styles.stepperActionBtnCompact}
                            onPress={() => handleDecrement(cloth, chosenService)}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove one ${cloth.name}`}
                          >
                            <MaterialCommunityIcons name="minus" size={13} color="#FFFFFF" />
                          </Pressable>
                          <Text style={styles.stepperQtyCompact}>{cartQty}</Text>
                          <Pressable
                            style={styles.stepperActionBtnCompact}
                            onPress={() => handleIncrement(cloth, chosenService)}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`Add one ${cloth.name}`}
                          >
                            <MaterialCommunityIcons name="plus" size={13} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.addBtnCompact}
                          onPress={() => handleAddToCart(cloth, chosenService)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${cloth.name}, ${chosenService.displayName}, ${String.fromCharCode(0x20B9)}${chosenService.price}, to bag`}
                        >
                          <MaterialCommunityIcons name="plus" size={13} color="#FF6B0B" />
                          <Text style={styles.addBtnTextCompact}>ADD</Text>
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

      {/* The bag is a real footer rather than an overlay, so the grid can never
          scroll beneath it. */}
      {cartSummary.itemCount > 0 && (
        <View style={[styles.stickyCartBarWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={({ pressed }) => [styles.stickyCartBar, pressed && styles.pressedBtn]}
            onPress={handleCartClick}
            accessibilityRole="button"
            accessibilityLabel={`View bag with ${cartSummary.itemCount} items, total ${String.fromCharCode(0x20B9)}${cartSummary.itemTotal}`}
          >
            <View style={styles.cartBarLeft}>
              <View style={styles.cartBarIconBadge}>
                <MaterialCommunityIcons name="shopping" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.cartBarTotalText}>
                {cartSummary.itemCount} {cartSummary.itemCount === 1 ? 'item' : 'items'} • ₹{cartSummary.itemTotal}
              </Text>
            </View>

            <View style={styles.cartBarRight}>
              <Text style={styles.cartBarActionText}>View Bag</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
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

  /* 1. Top App Bar (54px) */
  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
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
  topBarSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  cartBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF6B0B',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  /* 2. Main Category Tabs (36px) */
  categoryTabsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingRight: 24,
  },
  categoryPill: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  categoryPillSelected: {
    backgroundColor: '#FF6B0B',
    shadowColor: '#FF6B0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryPillUnselected: {
    backgroundColor: '#F8FAFC',
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

  /* 3. Search Bar (40px) */
  searchBarWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  searchBar: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 19,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    paddingVertical: 8,
  },
  subcatCarouselScroll: {
    paddingHorizontal: 16,
    gap: 12,
    paddingRight: 24,
  },
  subcatCircleItem: {
    width: 58,
    alignItems: 'center',
  },
  subcatCircleWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  subcatCircleWrapSelected: {
    borderColor: '#FF6B0B',
    borderWidth: 2,
    backgroundColor: '#FFF7ED',
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
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  subcatCircleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
  },
  subcatCircleTextSelected: {
    color: '#FF6B0B',
    fontWeight: '800',
  },

  /* 5. Filter & Sort Bar (34px) */
  filterSortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  serviceFilterScroll: {
    gap: 6,
    alignItems: 'center',
  },
  serviceChipCompact: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  serviceChipCompactSelected: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FF6B0B',
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
    color: '#FF6B0B',
    fontWeight: '800',
  },
  serviceChipTextCompactUnselected: {
    color: '#64748B',
  },
  sortButtonPill: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
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
    justifyContent: 'space-between',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  /* Card Image */
  cardImageContainer: {
    height: 110,
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
  favoriteCircleBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  turnaroundBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
  },
  turnaroundBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#2563EB',
  },

  /* Card Body */
  cardBody: {
    padding: 8,
  },
  productCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  serviceMiniRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  serviceMiniPill: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  serviceMiniPillActive: {
    backgroundColor: '#FF6B0B',
  },
  serviceMiniText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  serviceMiniTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  priceAndActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    minWidth: 0,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  priceUnitText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  addBtnCompact: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FF6B0B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  addBtnTextCompact: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6B0B',
  },
  stepperCompact: {
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FF6B0B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  stepperActionBtnCompact: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyCompact: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    minWidth: 18,
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
    backgroundColor: '#FF6B0B',
    borderRadius: 8,
  },
  resetFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* 7. Sticky Cart Footer */
  stickyCartBarWrap: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  stickyCartBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cartBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartBarIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarTotalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cartBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cartBarActionText: {
    color: '#FF6B0B',
    fontSize: 13,
    fontWeight: '800',
  },
  pressedBtn: {
    opacity: 0.8,
  },
});
