import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  BackHandler,
  Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { COLORS, money } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { api } from '@/lib/api';
import { AnimatedCartButton } from '@/components/AnimatedCartButton';
import type { ProductItem, Catalog } from '@/types/domain';

interface SearchScreenProps {
  onBook: () => void;
  onBack?: () => void;
  onSelectProduct?: (product: ProductItem, serviceId?: string) => void;
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
}

const RECENT_SEARCHES_KEY = '@laundryfresh_recent_searches';

const SEARCH_SYNONYMS: Record<string, string[]> = {
  'wash': ['washing', 'laundry', 'clean', 'cleaning'],
  'iron': ['press', 'steam', 'ironing', 'pressing'],
  'dry clean': ['dryclean', 'dry cleaning', 'drycleaning', 'suit', 'blazer', 'coat', 'saree', 'sherwani', 'lehenga', 'sweater'],
  'dryclean': ['dry clean', 'dry cleaning'],
  'dry cleaning': ['dry clean', 'dryclean', 'suit', 'blazer', 'coat', 'saree', 'sherwani', 'lehenga', 'sweater'],
  'steam press': ['iron', 'press', 'steam'],
  'press': ['steam press', 'iron'],
  'winter': ['sweater', 'jacket', 'quilt', 'blanket', 'comforter', 'woolen', 'cardigan', 'hoodie', 'razai', 'shrug'],
  'winter blanket cleaning': ['blanket', 'quilt', 'comforter', 'razai', 'duvet', 'fleece', 'mink'],
  'blanket': ['blanket', 'comforter', 'quilt', 'razai', 'duvet', 'fleece', 'mink'],
  'bedsheet': ['bedsheet', 'bed sheet', 'sheets', 'linen', 'bedcover', 'mattress', 'pillow', 'cushion'],
  'curtain': ['curtains', 'drapes', 'sheer', 'blackout'],
  'suit': ['blazer', 'coat', 'formal', 'tuxedo'],
  'saree': ['sari', 'silk', 'cotton', 'handloom'],
  'kid': ['kids', 'baby', 'child', 'children', 'romper', 'onesie', 'frock', 'uniform'],
  'kids': ['kid', 'baby', 'child', 'children', 'romper', 'onesie', 'frock', 'uniform'],
  'baby': ['romper', 'onesie', 'infant', 'kid'],
};

const DEFAULT_TRENDING_SEARCHES = [
  { text: 'Winter Blanket Cleaning', emoji: '❄️', growth: '+45%' },
  { text: 'Silk Saree Care', emoji: '🧣', growth: '+38%' },
  { text: 'Express Dry Clean', emoji: '⚡', growth: '+32%' },
  { text: 'Woolen Garments', emoji: '🧥', growth: '+28%' },
];

const DEFAULT_POPULAR_SEARCHES = [
  { text: 'Shirt', count: 1240 },
  { text: 'Dry Cleaning', count: 980 },
  { text: 'Saree', count: 860 },
  { text: 'Steam Press', count: 740 },
  { text: 'Pants', count: 620 },
];

export function SearchScreen({ onBook, onBack, onSelectProduct, initialQuery = '', onQueryChange }: SearchScreenProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { cart, cartSummary, addCartItem, setCartQuantity, removeFromCart, catalog } = useApp();
  const [query, setQueryState] = useState(initialQuery);

  const setQuery = (newQuery: string) => {
    setQueryState(newQuery);
    onQueryChange?.(newQuery);
  };
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches, setPopularSearches] = useState<any[]>(DEFAULT_POPULAR_SEARCHES);
  const [trendingSearches, setTrendingSearches] = useState<any[]>(DEFAULT_TRENDING_SEARCHES);
  const [localCachedCatalog, setLocalCachedCatalog] = useState<Catalog | null>(null);

  // Hardware back press on Android always navigates back smoothly
  useEffect(() => {
    if (!onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // Immediately hydrate recent searches and cached catalog from local disk (<5ms)
  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              setRecentSearches(parsed.filter((item) => typeof item === 'string'));
            }
          } catch {}
        }
      })
      .catch(() => undefined);

    AsyncStorage.getItem('@laundryfresh_cached_catalog_v2')
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.clothTypes?.length) {
              setLocalCachedCatalog(parsed);
            }
          } catch {}
        }
      })
      .catch(() => undefined);

    // Silent background freshness sync
    loadPopularSearches();
    loadTrendingSearches();
  }, []);

  const loadPopularSearches = async () => {
    try {
      const response = await fetch(`${api.baseURL}/search/popular?limit=5`);
      const data = await response.json();
      if (data.success && Array.isArray(data.data?.popularSearches) && data.data.popularSearches.length > 0) {
        setPopularSearches(data.data.popularSearches);
      }
    } catch {
      // Keep instant defaults
    }
  };

  const loadTrendingSearches = async () => {
    try {
      const response = await fetch(`${api.baseURL}/search/trending?limit=4`);
      const data = await response.json();
      if (data.success && Array.isArray(data.data?.trendingSearches) && data.data.trendingSearches.length > 0) {
        setTrendingSearches(data.data.trendingSearches);
      }
    } catch {
      // Keep instant defaults
    }
  };

  // Garment catalog with dual-matched pricing & guaranteed non-zero prices
  const allItems = useMemo(() => {
    const activeCatalog = (catalog?.clothTypes && Array.isArray(catalog.clothTypes) && catalog.clothTypes.length > 0)
      ? catalog
      : localCachedCatalog;

    if (activeCatalog?.clothTypes && Array.isArray(activeCatalog.clothTypes) && activeCatalog.clothTypes.length > 0) {
      return activeCatalog.clothTypes.map((cloth) => {
        const clothName = String(cloth.name || 'Garment');
        const clothNameLower = clothName.trim().toLowerCase();
        const categoryTag = String(cloth.categoryTag || 'MENS');

        const prices = Array.isArray(activeCatalog.priceMatrix)
          ? activeCatalog.priceMatrix.filter(
              (p) =>
                p &&
                (p.clothTypeId === cloth.id ||
                  (p.clothName && p.clothName.trim().toLowerCase() === clothNameLower)) &&
                p.isActive !== false
            )
          : [];

        prices.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        const primaryPrice = prices.find((p) => Number(p.price) > 0) || prices[0];
        const srvName = String(primaryPrice?.serviceName || 'Steam Press');
        const srvId = String(primaryPrice?.serviceId || 'srv-m-steam-iron');
        const tat = `${primaryPrice?.turnaroundHours || 24}H Care`;

        const catUpper = categoryTag.toUpperCase();
        const defaultFallbackPrice = catUpper.includes('KID')
          ? 15
          : catUpper.includes('HOME')
          ? 40
          : catUpper.includes('PREMIUM') || catUpper.includes('TRADITIONAL')
          ? 50
          : 20;

        const price =
          primaryPrice?.price && Number(primaryPrice.price) > 0
            ? Number(primaryPrice.price)
            : defaultFallbackPrice;

        return {
          id: String(cloth.id || `cloth-${Math.random()}`),
          name: clothName,
          serviceName: srvName,
          serviceId: srvId,
          tat,
          price,
          unit: 'Piece',
          imageUrl: getGarmentImageUrl(cloth.id, cloth.imageUrl || (cloth as any).image, categoryTag, clothName),
          category: categoryTag,
          categoryLabel: cloth.categoryLabel || categoryTag,
          subcategory: cloth.subCategory || (cloth as any).subcategory || '',
          availableServices: prices.map((p) => String(p.serviceName || '').toLowerCase()),
        };
      });
    }

    return [];
  }, [catalog, localCachedCatalog]);

  // Zepto-style INSTANT 0ms local search computation capped to top 30 for smooth 60fps
  const displayResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const cleanQ = q.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryWords = cleanQ.split(' ').filter((w) => w.length > 0);

    const expansionTerms = new Set<string>();
    expansionTerms.add(cleanQ);
    queryWords.forEach((w) => expansionTerms.add(w));

    Object.entries(SEARCH_SYNONYMS).forEach(([key, syns]) => {
      if (cleanQ.includes(key) || key.includes(cleanQ) || queryWords.some((w) => key.includes(w))) {
        syns.forEach((s) => expansionTerms.add(s));
      }
    });

    const expansionArr = Array.from(expansionTerms);

    const scored = allItems.map((item) => {
      const name = item.name.toLowerCase();
      const srv = item.serviceName.toLowerCase();
      const cat = item.category.toLowerCase();
      const sub = (item.subcategory || '').toLowerCase();
      const srvs = (item.availableServices || []).join(' ');

      let score = 0;

      if (name === cleanQ) score += 200;
      else if (name.startsWith(cleanQ)) score += 100;
      else if (name.includes(cleanQ)) score += 60;

      queryWords.forEach((word) => {
        if (word.length < 2) return;
        if (name.includes(word)) score += 30;
        if (srv.includes(word) || srvs.includes(word)) score += 25;
        if (cat.includes(word) || sub.includes(word)) score += 20;
      });

      expansionArr.forEach((term) => {
        if (name.includes(term)) score += 20;
        if (srv.includes(term) || srvs.includes(term)) score += 15;
        if (cat.includes(term) || sub.includes(term)) score += 10;
      });

      return {
        ...item,
        score,
      };
    });

    const matched = scored.filter((item) => item.score > 0);
    matched.sort((a, b) => b.score - a.score);

    return matched.slice(0, 30);
  }, [allItems, query]);

  // Pure local instant zero-latency suggestions for empty searches (0ms)
  const suggestions = useMemo(() => {
    if (displayResults.length > 0) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matchedSuggestions = new Set<string>();
    Object.entries(SEARCH_SYNONYMS).forEach(([key, syns]) => {
      if (q.includes(key) || key.includes(q)) {
        syns.forEach((s) => matchedSuggestions.add(s));
      }
    });

    if (matchedSuggestions.size === 0) {
      ['Steam Press', 'Dry Cleaning', 'Saree', 'Shirt', 'Blanket', 'Suit', 'Kurta'].forEach((s) =>
        matchedSuggestions.add(s)
      );
    }

    return Array.from(matchedSuggestions).slice(0, 6);
  }, [displayResults.length, query]);

  const saveSearchTerm = async (term: string) => {
    try {
      const clean = String(term || '').trim();
      if (!clean) return;
      const updated = [
        clean,
        ...recentSearches.filter((s) => typeof s === 'string' && s.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 6);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)).catch(() => undefined);
    } catch {
      // Ignore
    }
  };

  const clearRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => undefined);
    } catch {
      // Ignore
    }
  };

  const handleOpenProductDetail = (item: any) => {
    if (!onSelectProduct) return;

    const clothNameLower = String(item.name || '').trim().toLowerCase();
    const cloth = catalog?.clothTypes?.find(
      (c: any) => c.id === item.id || (c.name && c.name.trim().toLowerCase() === clothNameLower)
    );
    const matrix = Array.isArray(catalog?.priceMatrix)
      ? catalog.priceMatrix.filter(
          (p: any) =>
            p &&
            (p.clothTypeId === item.id ||
              p.clothId === item.id ||
              (p.clothName && p.clothName.trim().toLowerCase() === clothNameLower)) &&
            p.isActive !== false
        )
      : [];

    let services: any[] = [];
    if (matrix.length > 0) {
      services = matrix.map((pm: any) => {
        const sName = pm.serviceName || 'Standard Care';
        const sLower = sName.toLowerCase();
        let code = pm.serviceCode || '';
        if (!code) {
          if (sLower.includes('dry')) code = 'DRY_CLEAN';
          else if (sLower.includes('fold') || (sLower.includes('wash') && sLower.includes('fold'))) code = 'WASH_FOLD';
          else if (sLower.includes('wash')) code = 'WASH_IRON';
          else if (sLower.includes('press') || sLower.includes('steam') || sLower.includes('iron')) code = 'PRESS';
          else if (sLower.includes('starch')) code = 'STARCH';
          else if (sLower.includes('saree') || sLower.includes('charak') || sLower.includes('polish')) code = 'SAREE_POLISH';
          else if (sLower.includes('shoe') || sLower.includes('spa')) code = 'SHOE_SPA';
          else if (sLower.includes('express')) code = 'EXPRESS';
          else code = 'PRESS';
        }

        const rawPrice = Number(pm.price);
        const price = rawPrice > 0 ? rawPrice : Math.max(Number(item.price) || 20, 20);

        let shortLabel = 'Care';
        if (code === 'PRESS') shortLabel = 'Press';
        else if (code === 'DRY_CLEAN') shortLabel = 'Dry Clean';
        else if (code === 'WASH_FOLD') shortLabel = 'Wash+Fold';
        else if (code === 'WASH_IRON') shortLabel = 'Wash+Iron';
        else if (code === 'STARCH') shortLabel = 'Starch';
        else if (code === 'SAREE_POLISH') shortLabel = 'Polish';
        else if (code === 'SHOE_SPA') shortLabel = 'Spa';
        else if (code === 'EXPRESS') shortLabel = 'Express';

        return {
          serviceId: pm.serviceId || `srv-${item.id}-${code.toLowerCase()}`,
          serviceName: sName,
          displayName: sName,
          shortLabel,
          serviceCode: code,
          price,
          icon: code === 'PRESS' ? 'iron' : code === 'DRY_CLEAN' ? 'coat-rack' : code === 'SHOE_SPA' ? 'shoe-sneaker' : code === 'STARCH' ? 'sparkles' : 'washing-machine',
          unit: pm.unit || item.unit || 'Piece',
          turnaroundHours: Number(pm.turnaroundHours) || 24,
        };
      });
    }

    if (services.length === 0) {
      const basePrice = Math.max(Number(item.price) || 0, 25);
      services = [
        {
          serviceId: `srv-${item.id}-press`,
          serviceName: 'Steam Press',
          displayName: 'Steam Press',
          shortLabel: 'Press',
          serviceCode: 'PRESS',
          price: basePrice,
          icon: 'iron',
          unit: item.unit || 'Piece',
          turnaroundHours: 24,
        },
        {
          serviceId: `srv-${item.id}-wash-iron`,
          serviceName: 'Wash & Iron',
          displayName: 'Wash & Iron',
          shortLabel: 'Wash+Iron',
          serviceCode: 'WASH_IRON',
          price: Math.round(basePrice * 1.5),
          icon: 'washing-machine',
          unit: item.unit || 'Piece',
          turnaroundHours: 48,
        },
        {
          serviceId: `srv-${item.id}-dry-clean`,
          serviceName: 'Dry Cleaning',
          displayName: 'Dry Cleaning',
          shortLabel: 'Dry Clean',
          serviceCode: 'DRY_CLEAN',
          price: Math.round(basePrice * 2.2),
          icon: 'coat-rack',
          unit: item.unit || 'Piece',
          turnaroundHours: 48,
        },
      ];
    }

    const minPrice = Math.min(...services.map((s: any) => s.price));

    const product: ProductItem = {
      id: item.id,
      name: item.name,
      categoryTag: item.category || cloth?.categoryTag || 'MENS',
      categoryLabel: item.categoryLabel || cloth?.categoryLabel || "Men's Wear",
      subcategory: cloth?.subCategory || (cloth as any)?.subcategory || 'General',
      imageUrl: item.imageUrl || cloth?.imageUrl,
      fallbackImageUrl: getGarmentImageUrl(item.id, undefined, item.category || cloth?.categoryTag, item.name),
      description: cloth?.description || `Gentle care & finishing for ${item.name}.`,
      services,
      minPrice: minPrice > 0 ? minPrice : 20,
    };

    onSelectProduct(product, item.serviceId || services[0]?.serviceId);
  };

  const handleSelectKeyword = (term: string) => {
    const clean = String(term || '').trim();
    if (!clean) return;
    Keyboard.dismiss();
    setQuery(clean);
    void saveSearchTerm(clean);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Search Input Bar - sitting cleanly below status bar with no double gap */}
      <View style={[styles.header, isDark && { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={styles.headerBackBtn}
            accessibilityLabel="Back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={isDark ? colors.textHeading : '#0F172A'} />
          </Pressable>
        ) : null}
        <View style={[styles.searchBar, onBack ? { flex: 1 } : null, isDark && { backgroundColor: colors.section, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={22} color="#059669" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, isDark && { color: colors.textHeading }]}
            placeholder="Search clothes, fabrics & services..."
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => {
              Keyboard.dismiss();
              saveSearchTerm(query);
            }}
            autoFocus={!initialQuery}
            clearButtonMode="never"
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              onPress={() => {
                setQuery('');
                Keyboard.dismiss();
              }}
              hitSlop={10}
              accessibilityLabel="Clear search text"
            >
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 130 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* If Query is Empty: Show Recent & Trending Searches */}
        {!query.trim() ? (
          <View style={styles.discoveryWrap}>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleRow}>
                    <MaterialCommunityIcons name="history" size={16} color={isDark ? colors.textCaption : '#64748B'} />
                    <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Recent Searches</Text>
                  </View>
                  <Pressable onPress={() => void clearRecentSearches()} hitSlop={8}>
                    <Text style={styles.clearText}>Clear All</Text>
                  </Pressable>
                </View>

                <View style={styles.chipsRow}>
                  {recentSearches.map((term, idx) => (
                    <Pressable
                      key={idx}
                      style={({ pressed }) => [
                        styles.recentChip,
                        isDark && { backgroundColor: colors.section, borderColor: colors.border },
                        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                      ]}
                      onPress={() => handleSelectKeyword(term)}
                    >
                      <MaterialCommunityIcons name="clock-outline" size={13} color={isDark ? colors.textCaption : '#94A3B8'} />
                      <Text style={[styles.recentChipText, isDark && { color: colors.textBody }]}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Popular Services */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="star-shooting-outline" size={16} color="#059669" />
                <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Popular Services</Text>
              </View>
              <View style={styles.chipsRow}>
                {[
                  { label: 'Steam Press', icon: 'iron', iconColor: '#059669' },
                  { label: 'Dry Cleaning', icon: 'hanger', iconColor: '#0D9488' },
                  { label: 'Wash & Fold', icon: 'washing-machine', iconColor: '#0284C7' },
                  { label: 'Saree Charak', icon: 'sparkles', iconColor: '#D97706' },
                  { label: 'Shoe Spa', icon: 'shoe-sneaker', iconColor: '#9333EA' },
                ].map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [
                      styles.serviceChip,
                      isDark && { backgroundColor: colors.section, borderColor: colors.border },
                      pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => handleSelectKeyword(item.label)}
                  >
                    <MaterialCommunityIcons name={item.icon as any} size={15} color={item.iconColor} />
                    <Text style={[styles.serviceChipText, isDark && { color: colors.textHeading }]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Trending This Week */}
            {trendingSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <MaterialCommunityIcons name="fire" size={17} color="#EA580C" />
                  <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Trending Searches</Text>
                </View>
                <View style={styles.chipsRow}>
                  {trendingSearches.map((trend, idx) => (
                    <Pressable
                      key={idx}
                      style={({ pressed }) => [
                        styles.trendingBadge,
                        isDark && { backgroundColor: colors.section, borderColor: colors.border },
                        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                      ]}
                      onPress={() => handleSelectKeyword(trend.text)}
                    >
                      <Text style={styles.trendingEmoji}>{trend.emoji}</Text>
                      <Text style={[styles.trendingBadgeText, isDark && { color: colors.textHeading }]}>{trend.text}</Text>
                      <Text style={styles.trendingGrowth}>{trend.growth}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Popular Searches */}
            {popularSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <MaterialCommunityIcons name="trending-up" size={16} color="#059669" />
                  <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Most Searched Items</Text>
                </View>
                <View style={styles.chipsRow}>
                  {popularSearches.map((popular, idx) => (
                    <Pressable
                      key={idx}
                      style={({ pressed }) => [
                        styles.popularChip,
                        isDark && { backgroundColor: colors.section, borderColor: colors.border },
                        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                      ]}
                      onPress={() => handleSelectKeyword(popular.text)}
                    >
                      <MaterialCommunityIcons name="trending-up" size={13} color="#059669" />
                      <Text style={[styles.popularChipText, isDark && { color: colors.textHeading }]}>{popular.text}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Popular Fabrics */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="tag-multiple-outline" size={15} color="#64748B" />
                <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Popular Fabrics & Textures</Text>
              </View>
              <View style={styles.chipsRow}>
                {[
                  'Pure Silk', 'Cotton Handloom', 'Woolen & Pashmina', 'Denim', 'Linen', 'Chiffon & Georgette', 'Velvet'
                ].map((fabric, idx) => (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [
                      styles.fabricChip,
                      isDark && { backgroundColor: colors.section, borderColor: colors.border },
                      pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => handleSelectKeyword(fabric)}
                  >
                    <MaterialCommunityIcons name="tag-outline" size={13} color={isDark ? '#10B981' : '#059669'} />
                    <Text style={[styles.fabricChipText, isDark && { color: colors.textBody }]}>{fabric}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Quality Promise Banner */}
            <View style={styles.promiseCard}>
              <MaterialCommunityIcons name="shield-check" size={24} color="#16A34A" />
              <View style={{ flex: 1 }}>
                <Text style={styles.promiseTitle}>Zero Color-Bleed Guarantee</Text>
                <Text style={styles.promiseSub}>All delicate fabrics are tested with organic non-solvent solutions.</Text>
              </View>
            </View>
          </View>
        ) : (
          /* Search Results Grid */
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsCount, isDark && { color: colors.textCaption }]}>
                {`Found ${displayResults.length} service${displayResults.length === 1 ? '' : 's'}`}
              </Text>
              {query.trim().length > 0 && displayResults.length > 0 && (
                <Text style={[styles.resultsQuery, isDark && { color: colors.textHeading }]}>for "{query}"</Text>
              )}
            </View>

            {displayResults.length === 0 ? (
              <View style={styles.emptyResults}>
                <MaterialCommunityIcons name="magnify-close" size={54} color="#D6B36A" />
                <Text style={[styles.emptyTitle, isDark && { color: colors.textHeading }]}>No Matching Services Found</Text>
                <Text style={[styles.emptySubtitle, isDark && { color: colors.textCaption }]}>
                  Try searching for keywords like "Suit", "Saree", "Blanket", or "Kurti".
                </Text>
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsWrap}>
                    <Text style={[styles.suggestionsTitle, isDark && { color: colors.textHeading }]}>Try these instead:</Text>
                    <View style={styles.suggestionsChips}>
                      {suggestions.map((suggestion, idx) => (
                        <Pressable
                          key={idx}
                          style={styles.suggestionChip}
                          onPress={() => handleSelectKeyword(suggestion)}
                        >
                          <Text style={styles.suggestionChipText}>{suggestion}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.resultsGrid}>
                {displayResults.map((item) => {
                  const foundInCart = cart.find(
                    (c) =>
                      c &&
                      ((c.clothId && c.clothId === item.id) ||
                        c.id === item.id ||
                        c.id === `home-${item.id}` ||
                        (typeof c.id === 'string' && c.id.includes(item.id)))
                  );
                  const qty = foundInCart ? foundInCart.quantity : 0;

                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.garmentCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => handleOpenProductDetail(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`View details for ${item.name}`}
                    >
                      <View style={[styles.garmentThumbWrap, isDark && { backgroundColor: colors.section }]}>
                        <Image source={{ uri: item.imageUrl }} style={styles.garmentThumb} resizeMode="cover" />
                        <View style={styles.tatBadge}>
                          <MaterialCommunityIcons name="lightning-bolt" size={10} color="#FFFFFF" />
                          <Text style={styles.tatText}>{item.tat}</Text>
                        </View>
                      </View>

                      <View style={styles.garmentDetails}>
                        <Text style={[styles.garmentName, isDark && { color: colors.textHeading }]} numberOfLines={1}>{item.name}</Text>
                        <Text style={[styles.garmentService, isDark && { color: colors.textCaption }]}>{item.serviceName}</Text>

                        <View style={styles.garmentBottomRow}>
                          <Text style={[styles.garmentPrice, isDark && { color: colors.textHeading }]}>₹{item.price}<Text style={[styles.garmentUnit, isDark && { color: colors.textCaption }]}>/{item.unit}</Text></Text>

                          <AnimatedCartButton
                            quantity={qty}
                            onAdd={() => {
                              const srvId = item.serviceId || 'srv-m-steam-iron';
                              addCartItem({
                                id: `${item.id}-${srvId}`,
                                serviceId: srvId,
                                clothId: item.id,
                                clothName: item.name,
                                serviceName: `${item.name} (${item.serviceName})`,
                                categoryName: item.category,
                                pricingModel: 'PER_ITEM',
                                unitPrice: item.price,
                                quantity: 1,
                                unit: item.unit === 'kg' ? 'KG' : 'Piece',
                                subtotal: item.price,
                                imageUrl: item.imageUrl,
                              });
                            }}
                            onIncrement={() => {
                              if (foundInCart) {
                                setCartQuantity(foundInCart.id, foundInCart.quantity + 1);
                              }
                            }}
                            onDecrement={() => {
                              if (foundInCart) {
                                if (foundInCart.quantity <= 1) {
                                  removeFromCart(foundInCart.id);
                                } else {
                                  setCartQuantity(foundInCart.id, foundInCart.quantity - 1);
                                }
                              }
                            }}
                            isDark={isDark}
                          />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 40,
  },
  discoveryWrap: {
    paddingTop: 12,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.1,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  recentChipText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600',
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  serviceChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  trendingChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  fabricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  fabricChipText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
  },
  promiseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  promiseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  promiseSub: {
    fontSize: 11.5,
    color: '#15803D',
    lineHeight: 16,
  },
  resultsSection: {
    gap: 12,
  },
  resultsHeader: {
    gap: 4,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  resultsQuery: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  suggestionsWrap: {
    marginTop: 20,
    width: '100%',
    gap: 10,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  suggestionsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  suggestionChip: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  suggestionChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F766E',
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  trendingEmoji: {
    fontSize: 14,
  },
  trendingBadgeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  trendingGrowth: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  popularChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#15803D',
  },
  resultsGrid: {
    gap: 10,
  },
  garmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  garmentThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
  },
  garmentThumb: {
    width: '100%',
    height: '100%',
  },
  tatBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  tatText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '700',
  },
  garmentDetails: {
    flex: 1,
  },
  garmentName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  garmentService: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 6,
  },
  garmentBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  garmentPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  garmentUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 8,
    height: 28,
  },
  stepperBtn: {
    width: 26,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },
  floatingBagBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  bagInfo: {
    gap: 2,
  },
  bagCountText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bagTotalText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '500',
  },
  bagReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bagReviewBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
