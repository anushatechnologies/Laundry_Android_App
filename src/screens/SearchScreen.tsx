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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { COLORS, money } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { api } from '@/lib/api';
import type { ProductItem } from '@/types/domain';

interface SearchScreenProps {
  onBook: () => void;
  onBack?: () => void;
  onSelectProduct?: (product: ProductItem) => void;
}

const RECENT_SEARCHES_KEY = '@laundryfresh_recent_searches';

export function SearchScreen({ onBook, onBack, onSelectProduct }: SearchScreenProps) {
  const insets = useSafeAreaInsets();
  const { cart, cartSummary, addCartItem, setCartQuantity, removeFromCart, catalog } = useApp();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popularSearches, setPopularSearches] = useState<any[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<any[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              setRecentSearches(parsed.filter((item) => typeof item === 'string'));
            }
          } catch {
            // Fallback
          }
        }
      })
      .catch(() => undefined);
    
    // Load popular and trending searches
    loadPopularSearches();
    loadTrendingSearches();
  }, []);

  const loadPopularSearches = async () => {
    try {
      const response = await fetch(`${api.baseURL}/search/popular?limit=5`);
      const data = await response.json();
      if (data.success) {
        setPopularSearches(data.data.popularSearches || []);
      }
    } catch (error) {
      console.error('[Search] Failed to load popular searches:', error);
    }
  };

  const loadTrendingSearches = async () => {
    try {
      const response = await fetch(`${api.baseURL}/search/trending?limit=4`);
      const data = await response.json();
      if (data.success) {
        setTrendingSearches(data.data.trendingSearches || []);
      }
    } catch (error) {
      console.error('[Search] Failed to load trending searches:', error);
    }
  };

  const allItems = useMemo(() => {
    if (catalog?.clothTypes && Array.isArray(catalog.clothTypes) && catalog.clothTypes.length > 0) {
      return catalog.clothTypes.map((cloth) => {
        const prices = Array.isArray(catalog.priceMatrix)
          ? catalog.priceMatrix.filter((p) => p && p.clothTypeId === cloth.id && p.isActive)
          : [];
        const primaryPrice = prices[0];
        const clothName = String(cloth.name || 'Garment');
        const categoryTag = String(cloth.categoryTag || 'MENS');
        const srvName = String(primaryPrice?.serviceName || 'Standard Care');
        const tat = `${primaryPrice?.turnaroundHours || 24}H Care`;
        const price = Number(primaryPrice?.price || 0);

        return {
          id: String(cloth.id || `cloth-${Math.random()}`),
          name: clothName,
          serviceName: srvName,
          tat,
          price,
          unit: 'pc',
          imageUrl: getGarmentImageUrl(cloth.id, cloth.imageUrl || (cloth as any).image, categoryTag),
          category: categoryTag,
        };
      });
    }

    return [];
  }, [catalog]);

  // Fallback local search across loaded catalog
  const performLocalSearch = useCallback((searchQuery: string) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const results = allItems.filter((item) => {
      const name = String(item.name || '').toLowerCase();
      const srv = String(item.serviceName || '').toLowerCase();
      const cat = String(item.category || '').toLowerCase();
      return name.includes(q) || srv.includes(q) || cat.includes(q);
    });
    setSearchResults(results);
  }, [allItems]);

  // Perform search with backend API, fallback immediately to local catalog
  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setSuggestions([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `${api.baseURL}/search?q=${encodeURIComponent(trimmed)}&limit=50`
      );
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data?.results) && data.data.results.length > 0) {
        setSearchResults(data.data.results);
        setSuggestions(data.data.suggestions || []);
      } else {
        performLocalSearch(trimmed);
      }
    } catch (error) {
      console.warn('[Search] Remote search unavailable, using instant local catalog:', error);
      performLocalSearch(trimmed);
    } finally {
      setSearching(false);
    }
  }, [performLocalSearch]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        void performSearch(query);
      } else {
        setSearchResults([]);
        setSuggestions([]);
      }
    }, 250); // 250ms fast debounce

    return () => clearTimeout(timer);
  }, [query, performSearch]);

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

  // Guaranteed search results from API or catalog
  const displayResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    
    if (searchResults.length > 0) {
      return searchResults.map((item) => ({
        id: String(item.id),
        name: item.name,
        serviceName: item.serviceName || 'Standard Care',
        tat: item.tat || (item.turnaroundHours ? `${item.turnaroundHours}H Care` : '24H Care'),
        price: Number(item.price || 0),
        unit: item.unit || 'Piece',
        imageUrl: item.imageUrl || getGarmentImageUrl(item.id, '', item.categoryTag || item.category),
        category: item.categoryTag || item.category,
        relevance: item.relevance,
      }));
    }

    // Direct fallback from allItems if searchResults is empty
    return allItems
      .filter((item) => {
        const name = String(item.name || '').toLowerCase();
        const srv = String(item.serviceName || '').toLowerCase();
        const cat = String(item.category || '').toLowerCase();
        return name.includes(q) || srv.includes(q) || cat.includes(q);
      })
      .map((item) => ({
        id: String(item.id),
        name: item.name,
        serviceName: item.serviceName || 'Standard Care',
        tat: item.tat || '24H Care',
        price: Number(item.price || 0),
        unit: item.unit || 'Piece',
        imageUrl: item.imageUrl || getGarmentImageUrl(item.id, '', item.category),
        category: item.category,
        relevance: 1,
      }));
  }, [searchResults, query, allItems]);

  const handleOpenProductDetail = (item: any) => {
    if (!onSelectProduct) return;

    const cloth = catalog?.clothTypes?.find((c: any) => c.id === item.id);
    const matrix = Array.isArray(catalog?.priceMatrix)
      ? catalog.priceMatrix.filter((p: any) => p && (p.clothTypeId === item.id || p.clothId === item.id) && p.isActive !== false)
      : [];

    let services: any[] = [];
    if (matrix.length > 0) {
      services = matrix.map((pm: any) => {
        const sName = pm.serviceName || (pm.serviceCode === 'PRESS' ? 'Steam Press' : pm.serviceCode === 'DRY_CLEAN' ? 'Dry Cleaning' : 'Wash & Iron');
        const code = pm.serviceCode || (sName.toLowerCase().includes('dry') ? 'DRY_CLEAN' : sName.toLowerCase().includes('wash') ? 'WASH_IRON' : 'PRESS');
        return {
          serviceId: pm.serviceId || `srv-${item.id}`,
          serviceName: sName,
          displayName: sName,
          shortLabel: code === 'PRESS' ? 'Press' : code === 'DRY_CLEAN' ? 'Dry Clean' : 'Wash+Iron',
          serviceCode: code,
          price: Number(pm.price) || item.price,
          icon: code === 'PRESS' ? 'iron' : code === 'DRY_CLEAN' ? 'coat-rack' : 'washing-machine',
          unit: pm.unit || item.unit || 'Piece',
          turnaroundHours: Number(pm.turnaroundHours) || 24,
        };
      });
    }

    if (services.length === 0) {
      services = [
        {
          serviceId: `srv-${item.id}-press`,
          serviceName: 'Steam Press',
          displayName: 'Steam Press',
          shortLabel: 'Press',
          serviceCode: 'PRESS',
          price: item.price,
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
          price: Math.round(item.price * 1.5),
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
          price: Math.round(item.price * 2.2),
          icon: 'coat-rack',
          unit: item.unit || 'Piece',
          turnaroundHours: 48,
        },
      ];
    }

    const product: ProductItem = {
      id: item.id,
      name: item.name,
      categoryTag: item.category || cloth?.categoryTag || 'MENS',
      categoryLabel: item.category || cloth?.categoryLabel || "Men's Wear",
      subcategory: cloth?.subCategory || 'General',
      imageUrl: item.imageUrl || cloth?.imageUrl,
      fallbackImageUrl: getGarmentImageUrl(item.id, undefined, item.category || cloth?.categoryTag, item.name),
      description: cloth?.description,
      services,
      minPrice: Math.min(...services.map((s: any) => s.price)),
    };

    onSelectProduct(product);
  };

  const handleSelectKeyword = (term: string) => {
    const clean = String(term || '').trim();
    if (!clean) return;
    setQuery(clean);
    void saveSearchTerm(clean);
    void performSearch(clean);
  };

  return (
    <View style={styles.root}>
      {/* Top Search Input Bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.headerBackBtn} accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
          </Pressable>
        ) : null}
        <View style={[styles.searchBar, onBack ? { flex: 1 } : null]}>
          <MaterialCommunityIcons name="magnify" size={20} color="#0F766E" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search 70+ clothes, fabrics & services..."
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => {
              saveSearchTerm(query);
              performSearch(query);
            }}
            autoFocus
            clearButtonMode="always"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : (
            <View style={styles.searchRightIcons}>
              <Pressable onPress={() => handleSelectKeyword('Dry Cleaning')} hitSlop={8}>
                <MaterialCommunityIcons name="microphone-outline" size={18} color="#2563EB" />
              </Pressable>
              <View style={styles.searchBarDivider} />
              <Pressable onPress={() => handleSelectKeyword('Steam Press')} hitSlop={8}>
                <MaterialCommunityIcons name="qrcode-scan" size={16} color="#0F766E" />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.content, cartSummary.itemCount > 0 && { paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* If Query is Empty: Show Recent & Trending Searches */}
        {!query.trim() ? (
          <View style={styles.discoveryWrap}>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                  <Pressable onPress={() => void clearRecentSearches()} hitSlop={8}>
                    <Text style={styles.clearText}>Clear</Text>
                  </Pressable>
                </View>

                <View style={styles.chipsRow}>
                  {recentSearches.map((term, idx) => (
                    <Pressable
                      key={idx}
                      style={styles.recentChip}
                      onPress={() => handleSelectKeyword(term)}
                    >
                      <MaterialCommunityIcons name="history" size={14} color="#8A7A84" />
                      <Text style={styles.recentChipText}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Popular Services */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Services</Text>
              <View style={styles.chipsRow}>
                {[
                  { label: 'Steam Press', icon: 'iron', color: '#2563EB', bg: '#EFF6FF' },
                  { label: 'Dry Cleaning', icon: 'hanger', color: '#7C3AED', bg: '#FAF5FF' },
                  { label: 'Wash & Fold', icon: 'washing-machine', color: '#16A34A', bg: '#F0FDF4' },
                  { label: 'Saree Charak', icon: 'sparkles', color: '#D97706', bg: '#FEF3C7' },
                  { label: 'Shoe Spa', icon: 'shoe-sneaker', color: '#DB2777', bg: '#FDF2F8' },
                ].map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={[styles.trendingChip, { backgroundColor: item.bg, borderColor: item.bg }]}
                    onPress={() => handleSelectKeyword(item.label)}
                  >
                    <MaterialCommunityIcons name={item.icon as any} size={14} color={item.color} />
                    <Text style={[styles.trendingChipText, { color: item.color }]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Trending This Week */}
            {trendingSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>🔥 Trending This Week</Text>
                </View>
                <View style={styles.chipsRow}>
                  {trendingSearches.map((trend, idx) => (
                    <Pressable
                      key={idx}
                      style={styles.trendingBadge}
                      onPress={() => handleSelectKeyword(trend.text)}
                    >
                      <Text style={styles.trendingEmoji}>{trend.emoji}</Text>
                      <Text style={styles.trendingBadgeText}>{trend.text}</Text>
                      <Text style={styles.trendingGrowth}>{trend.growth}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Popular Searches */}
            {popularSearches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Most Searched</Text>
                <View style={styles.chipsRow}>
                  {popularSearches.map((popular, idx) => (
                    <Pressable
                      key={idx}
                      style={styles.popularChip}
                      onPress={() => handleSelectKeyword(popular.text)}
                    >
                      <MaterialCommunityIcons name="trending-up" size={12} color="#16A34A" />
                      <Text style={styles.popularChipText}>{popular.text}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Popular Fabrics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Fabrics</Text>
              <View style={styles.chipsRow}>
                {[
                  'Pure Silk', 'Cotton Handloom', 'Woolen & Pashmina', 'Denim', 'Linen', 'Chiffon & Georgette', 'Velvet'
                ].map((fabric, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.fabricChip}
                    onPress={() => handleSelectKeyword(fabric)}
                  >
                    <MaterialCommunityIcons name="tag-outline" size={13} color="#64748B" />
                    <Text style={styles.fabricChipText}>{fabric}</Text>
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
              <Text style={styles.resultsCount}>
                {searching ? 'Searching...' : `Found ${displayResults.length} service${displayResults.length === 1 ? '' : 's'}`}
              </Text>
              {query && !searching && displayResults.length > 0 && (
                <Text style={styles.resultsQuery}>for "{query}"</Text>
              )}
            </View>

            {searching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Searching laundry services...</Text>
              </View>
            ) : displayResults.length === 0 ? (
              <View style={styles.emptyResults}>
                <MaterialCommunityIcons name="magnify-close" size={54} color="#D6B36A" />
                <Text style={styles.emptyTitle}>No Matching Services Found</Text>
                <Text style={styles.emptySubtitle}>
                  Try searching for keywords like "Suit", "Saree", "Blanket", or "Kurti".
                </Text>
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsWrap}>
                    <Text style={styles.suggestionsTitle}>Try these instead:</Text>
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
                      style={styles.garmentCard}
                      onPress={() => handleOpenProductDetail(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`View details for ${item.name}`}
                    >
                      <View style={styles.garmentThumbWrap}>
                        <Image source={{ uri: item.imageUrl }} style={styles.garmentThumb} resizeMode="cover" />
                        <View style={styles.tatBadge}>
                          <MaterialCommunityIcons name="lightning-bolt" size={10} color="#FFFFFF" />
                          <Text style={styles.tatText}>{item.tat}</Text>
                        </View>
                      </View>

                      <View style={styles.garmentDetails}>
                        <Text style={styles.garmentName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.garmentService}>{item.serviceName}</Text>

                        <View style={styles.garmentBottomRow}>
                          <Text style={styles.garmentPrice}>₹{item.price}<Text style={styles.garmentUnit}>/{item.unit}</Text></Text>

                          {qty > 0 && foundInCart ? (
                            <View style={styles.stepperContainer}>
                              <Pressable
                                style={styles.stepperBtn}
                                onPress={() => {
                                  if (foundInCart.quantity <= 1) {
                                    removeFromCart(foundInCart.id);
                                  } else {
                                    setCartQuantity(foundInCart.id, foundInCart.quantity - 1);
                                  }
                                }}
                                hitSlop={8}
                              >
                                <MaterialCommunityIcons name="minus" size={13} color="#FFFFFF" />
                              </Pressable>
                              <Text style={styles.stepperQtyText}>{qty}</Text>
                              <Pressable
                                style={styles.stepperBtn}
                                onPress={() => setCartQuantity(foundInCart.id, foundInCart.quantity + 1)}
                                hitSlop={8}
                              >
                                <MaterialCommunityIcons name="plus" size={13} color="#FFFFFF" />
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              style={styles.addBtn}
                              onPress={() => {
                                addCartItem({
                                  id: `${item.id}-press`,
                                  serviceId: 'srv-m-steam-iron',
                                  clothId: item.id,
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
                            >
                              <MaterialCommunityIcons name="plus" size={13} color="#FFFFFF" />
                              <Text style={styles.addBtnText}>Add</Text>
                            </Pressable>
                          )}
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

      {/* Luxury Floating Bottom Bag Bar (Guaranteed above Android navigation bar) */}
      {cartSummary.itemCount > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.floatingBagBar,
            { bottom: Math.max(insets.bottom, 16) + 12 },
            pressed ? { opacity: 0.92, transform: [{ scale: 0.98 }] } : null,
          ]}
          onPress={onBook}
        >
          <View style={styles.bagInfo}>
            <Text style={styles.bagCountText}>
              🛍️ {cartSummary.itemCount} Item{cartSummary.itemCount === 1 ? '' : 's'} in Laundry Bag
            </Text>
            <Text style={styles.bagTotalText}>Total: {money(cartSummary.itemTotal)}</Text>
          </View>

          <View style={styles.bagReviewBtn}>
            <Text style={styles.bagReviewBtnText}>View Cart</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
          </View>
        </Pressable>
      )}
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
    paddingVertical: 10,
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
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
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
  searchRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,  // No top padding - header provides spacing
    paddingBottom: 40,
  },
  discoveryWrap: {
    paddingTop: 16,  // Add small top padding inside content
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
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
    gap: 5,
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
    fontWeight: '500',
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
    fontWeight: '500',
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
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  trendingEmoji: {
    fontSize: 15,
  },
  trendingBadgeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  trendingGrowth: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  popularChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#166534',
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
