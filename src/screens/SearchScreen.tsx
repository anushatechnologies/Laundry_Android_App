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

const SEARCH_CATEGORIES = [
  { key: 'ALL', label: 'All Items', icon: 'view-grid-outline' },
  { key: 'MENS', label: "Men's", icon: 'tshirt-crew-outline' },
  { key: 'WOMENS', label: "Women's", icon: 'hanger' },
  { key: 'KIDS', label: 'Kids & Baby', icon: 'baby-carriage' },
  { key: 'HOME_TEXTILES', label: 'Home Linen', icon: 'bed-double-outline' },
  { key: 'FOOTWEAR', label: 'Footwear', icon: 'shoe-sneaker' },
  { key: 'ACCESSORIES', label: 'Accessories', icon: 'bag-personal-outline' },
  { key: 'SPECIAL', label: 'Special Care', icon: 'sparkles' },
];

const GARMENT_SYNONYMS: Record<string, string[]> = {
  saree: ['saree', 'sari'],
  shirt: ['shirt', 'tshirt', 't-shirt', 'tee', 'polo'],
  tshirt: ['tshirt', 't-shirt', 'tee', 'polo', 'shirt'],
  pant: ['pant', 'trouser', 'chino', 'bottom'],
  trouser: ['trouser', 'pant', 'chino', 'bottom'],
  chino: ['chino', 'trouser', 'pant'],
  jeans: ['jeans', 'jean', 'denim'],
  suit: ['suit', 'blazer', 'tuxedo'],
  blazer: ['blazer', 'coat', 'suit'],
  jacket: ['jacket', 'windcheater', 'shrug'],
  coat: ['coat', 'overcoat', 'blazer'],
  kurta: ['kurta', 'kameez', 'kurti'],
  kurti: ['kurti', 'tunic', 'kurta'],
  lehenga: ['lehenga', 'ghagra', 'choli'],
  dress: ['dress', 'frock', 'gown', 'maxi', 'onepiece'],
  frock: ['frock', 'dress', 'gown'],
  gown: ['gown', 'maxi', 'dress'],
  bedsheet: ['bedsheet', 'bed sheet', 'sheet', 'bedcover'],
  sheet: ['sheet', 'bedsheet', 'bed sheet', 'bedcover'],
  pillow: ['pillow', 'cushion', 'bolster'],
  cushion: ['cushion', 'pillow'],
  blanket: ['blanket', 'quilt', 'razai', 'comforter', 'mink', 'fleece', 'duvet'],
  quilt: ['quilt', 'blanket', 'razai', 'comforter', 'duvet'],
  comforter: ['comforter', 'duvet', 'blanket', 'quilt'],
  razai: ['razai', 'quilt', 'blanket', 'comforter'],
  curtain: ['curtain', 'drape', 'sheer'],
  towel: ['towel', 'bathrobe'],
  sweater: ['sweater', 'cardigan', 'pullover', 'woolen'],
  cardigan: ['cardigan', 'sweater'],
  hoodie: ['hoodie', 'sweatshirt'],
  sweatshirt: ['sweatshirt', 'hoodie'],
  shoe: ['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'footwear'],
  sneaker: ['sneaker', 'shoes', 'shoe', 'footwear'],
  sherwani: ['sherwani', 'indo-western', 'achkan'],
  dhoti: ['dhoti', 'mundu', 'veshti'],
  top: ['top', 'blouse', 'tunic', 'tee'],
  blouse: ['blouse', 'top'],
  skirt: ['skirt', 'pinafore'],
  shorts: ['shorts', 'bermuda', 'half pant'],
  uniform: ['uniform', 'school uniform'],
  romper: ['romper', 'onesie', 'baby suit'],
};

const SERVICE_KEYWORDS: Record<string, string[]> = {
  'dry clean': ['dryclean', 'dry cleaning', 'dry-clean'],
  'steam press': ['iron', 'press', 'steam', 'ironing', 'pressing'],
  'wash & fold': ['wash and fold', 'wash fold', 'laundry'],
  'wash & iron': ['wash and iron', 'wash iron'],
  'saree polish': ['charak', 'polish', 'rolling'],
  'shoe spa': ['shoe clean', 'sneaker clean', 'shoe spa'],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  MENS: ['men', 'mens', 'male', 'gents'],
  WOMENS: ['women', 'womens', 'ladies', 'female', 'girls'],
  KIDS: ['kid', 'kids', 'child', 'children', 'baby', 'toddler', 'infant'],
  HOME_TEXTILES: ['home', 'household', 'bed', 'living', 'linen'],
  FOOTWEAR: ['shoe', 'shoes', 'sneaker', 'footwear'],
  ACCESSORIES: ['bag', 'accessory', 'purse', 'wallet'],
};

function stemWord(raw: string): string {
  const w = raw.toLowerCase().trim();
  if (w.length <= 3) return w;

  if (w === 'men' || w === 'mens') return 'man';
  if (w === 'women' || w === 'womens') return 'woman';
  if (w === 'children') return 'child';
  if (w === 'jeans') return 'jeans';
  if (w === 'chinos') return 'chino';
  if (w === 'trousers') return 'trouser';
  if (w === 'shoes') return 'shoe';
  if (w === 'sarees' || w === 'saris') return 'saree';

  if (w.endsWith('ies') && w.length > 4) {
    return w.slice(0, -3) + 'y';
  }
  if (w.endsWith('ses') || w.endsWith('xes') || w.endsWith('ches') || w.endsWith('shes')) {
    return w.slice(0, -2);
  }
  if (w.endsWith('ees') && w.length > 4) {
    return w.slice(0, -1);
  }
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) {
    return w.slice(0, -1);
  }
  return w;
}

const POPULAR_SEARCH_TAGS = [
  { label: 'Steam Press', icon: 'iron', color: '#059669' },
  { label: 'Dry Cleaning', icon: 'hanger', color: '#0D9488' },
  { label: 'Wash & Fold', icon: 'washing-machine', color: '#0284C7' },
  { label: 'Saree Charak', icon: 'sparkles', color: '#D97706' },
  { label: 'Suit & Blazer', icon: 'coat-rack', color: '#4F46E5' },
  { label: 'Blanket Care', icon: 'bed-double-outline', color: '#0284C7' },
  { label: 'Shoe Spa', icon: 'shoe-sneaker', color: '#9333EA' },
  { label: 'Curtain Care', icon: 'curtains', color: '#EA580C' },
];

export function SearchScreen({ onBook, onBack, onSelectProduct, initialQuery = '', onQueryChange }: SearchScreenProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { cart, cartSummary, addCartItem, setCartQuantity, removeFromCart, catalog } = useApp();
  
  const [query, setQueryState] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isSearching, setIsSearching] = useState(false);
  const [apiResults, setApiResults] = useState<any[] | null>(null);
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [autocompleteItems, setAutocompleteItems] = useState<any[]>([]);

  const setQuery = (newQuery: string) => {
    setQueryState(newQuery);
    onQueryChange?.(newQuery);
  };

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [localCachedCatalog, setLocalCachedCatalog] = useState<Catalog | null>(null);

  // Hardware back press on Android navigates back smoothly
  useEffect(() => {
    if (!onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // Hydrate local cache and recent searches immediately (<5ms)
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
  }, []);

  // Live End-to-End Backend Search with 220ms Debouncing
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setApiResults(null);
      setAutocompleteItems([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [searchRes, autoRes] = await Promise.allSettled([
          api.search({
            query: trimmed,
            category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
            limit: 40,
          }),
          api.getSearchAutocomplete(trimmed, 6),
        ]);

        if (searchRes.status === 'fulfilled' && searchRes.value && Array.isArray(searchRes.value.results)) {
          const mapped = searchRes.value.results.map((item) => {
            const tat = `${item.turnaroundHours || 24}H Care`;
            return {
              id: String(item.id),
              name: item.name,
              serviceName: item.serviceName || 'Steam Press',
              serviceId: item.serviceId || 'srv-m-steam-iron',
              tat,
              price: Number(item.price) || 25,
              unit: item.unit || 'Piece',
              imageUrl: item.imageUrl || getGarmentImageUrl(item.id, undefined, item.categoryTag, item.name),
              category: item.categoryTag || 'MENS',
              categoryLabel: item.categoryLabel || item.categoryTag,
              subcategory: item.subcategory || '',
              availableServices: item.availableServices || [],
              allPrices: item.allPrices || [],
              score: item.relevance || 100,
            };
          });
          setApiResults(mapped);
          setApiSuggestions(searchRes.value.suggestions || []);
        } else {
          // Gracefully fallback to local search
          setApiResults(null);
        }

        if (autoRes.status === 'fulfilled' && autoRes.value && Array.isArray(autoRes.value.suggestions)) {
          setAutocompleteItems(autoRes.value.suggestions);
        } else {
          setAutocompleteItems([]);
        }
      } catch {
        // Fallback gracefully on network interruptions
        setApiResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query, selectedCategory]);

  // Garment catalog preparation for instant local fallback
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
          allPrices: prices.map((p) => ({
            serviceId: p.serviceId,
            serviceName: p.serviceName,
            price: Number(p.price) || price,
            unit: 'Piece',
            turnaroundHours: p.turnaroundHours || 24,
          })),
        };
      });
    }

    return [];
  }, [catalog, localCachedCatalog]);

  // Local instant fallback search calculation
  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const cleanQ = q.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryWords = cleanQ.split(' ').filter((w) => w.length > 0);
    if (queryWords.length === 0) return [];

    // Filter by selected category first
    let pool = allItems;
    if (selectedCategory && selectedCategory !== 'ALL') {
      const cleanCat = selectedCategory.replace(/[^A-Z]/g, '');
      pool = pool.filter((item) => {
        const itemCat = String(item.category || '').toUpperCase().replace(/[^A-Z]/g, '');
        if (itemCat === cleanCat) return true;
        if ((cleanCat.includes('HOME') || cleanCat.includes('LINEN')) && (itemCat.includes('HOME') || itemCat.includes('LINEN'))) return true;
        if ((cleanCat.includes('KID') || cleanCat.includes('BABY')) && (itemCat.includes('KID') || itemCat.includes('BABY'))) return true;
        if ((cleanCat.includes('SHOE') || cleanCat.includes('FOOTWEAR')) && (itemCat.includes('SHOE') || itemCat.includes('FOOTWEAR'))) return true;
        return false;
      });
    }

    // Garment Intent
    const targetGarmentKeys = new Set<string>();
    queryWords.forEach((word) => {
      const stemmed = stemWord(word);
      if (GARMENT_SYNONYMS[word]) targetGarmentKeys.add(word);
      if (GARMENT_SYNONYMS[stemmed]) targetGarmentKeys.add(stemmed);
      Object.entries(GARMENT_SYNONYMS).forEach(([key, syns]) => {
        if (syns.includes(word) || syns.includes(stemmed)) {
          targetGarmentKeys.add(key);
        }
      });
    });

    const hasGarmentIntent = targetGarmentKeys.size > 0;
    const allowedGarmentTerms = new Set<string>();
    targetGarmentKeys.forEach((key) => {
      allowedGarmentTerms.add(key);
      (GARMENT_SYNONYMS[key] || []).forEach((syn) => {
        allowedGarmentTerms.add(syn);
        allowedGarmentTerms.add(stemWord(syn));
      });
    });

    // Service Intent
    const targetServiceTerms = new Set<string>();
    Object.entries(SERVICE_KEYWORDS).forEach(([srvKey, variants]) => {
      if (cleanQ.includes(srvKey) || queryWords.some((w) => srvKey.includes(w) && w.length > 3)) {
        targetServiceTerms.add(srvKey);
        variants.forEach((v) => targetServiceTerms.add(v));
      } else {
        variants.forEach((v) => {
          if (cleanQ.includes(v) || queryWords.some((w) => v.includes(w) && w.length > 3)) {
            targetServiceTerms.add(srvKey);
            targetServiceTerms.add(v);
          }
        });
      }
    });

    const scored = pool.map((item) => {
      const nameLower = item.name.toLowerCase();
      const nameWords = nameLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      const stemmedNameWords = nameWords.map(stemWord);
      const categoryTag = (item.category || '').toUpperCase();
      const subcategoryLower = (item.subcategory || '').toLowerCase();
      const services = (item.availableServices || []).map((s: string) => s.toLowerCase());

      if (hasGarmentIntent) {
        const itemMatchesGarment = Array.from(allowedGarmentTerms).some((term) => {
          const stemmedTerm = stemWord(term);
          return (
            nameWords.includes(term) ||
            nameWords.includes(stemmedTerm) ||
            stemmedNameWords.includes(term) ||
            stemmedNameWords.includes(stemmedTerm) ||
            nameLower.includes(term) ||
            nameLower.includes(stemmedTerm)
          );
        });

        if (!itemMatchesGarment) {
          return { ...item, score: 0 };
        }
      }

      let score = 0;
      if (nameLower === cleanQ) score += 500;
      else if (nameLower.startsWith(cleanQ)) score += 300;
      else if (nameLower.includes(cleanQ)) score += 200;

      let matchedWords = 0;
      queryWords.forEach((qWord) => {
        const sWord = stemWord(qWord);
        if (nameWords.includes(qWord) || nameWords.includes(sWord)) {
          score += 150;
          matchedWords++;
        } else if (stemmedNameWords.includes(sWord) || stemmedNameWords.includes(qWord)) {
          score += 120;
          matchedWords++;
        } else if (nameLower.includes(qWord) || nameLower.includes(sWord)) {
          score += 80;
          matchedWords++;
        }
      });

      if (queryWords.length > 1 && matchedWords === queryWords.length) {
        score += 200;
      }

      if (subcategoryLower && (subcategoryLower.includes(cleanQ) || queryWords.some((w) => subcategoryLower.includes(w)))) {
        score += 60;
      }

      if (targetServiceTerms.size > 0) {
        const matchesService = Array.from(targetServiceTerms).some((srvTerm) =>
          services.some((s: string) => s.includes(srvTerm)) || item.serviceName.toLowerCase().includes(srvTerm)
        );
        if (matchesService) {
          score += 70;
        }
      }

      return {
        ...item,
        score,
      };
    });

    const matched = scored.filter((item) => item.score >= 50);
    matched.sort((a, b) => b.score - a.score);
    return matched.slice(0, 30);
  }, [allItems, query, selectedCategory]);

  // Category-specific items for direct browsing when search query is empty
  const categoryBrowseItems = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'ALL') return [];
    const cleanCat = selectedCategory.replace(/[^A-Z]/g, '');
    return allItems.filter((item) => {
      const itemCat = String(item.category || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (itemCat === cleanCat) return true;
      if ((cleanCat.includes('HOME') || cleanCat.includes('LINEN')) && (itemCat.includes('HOME') || itemCat.includes('LINEN'))) return true;
      if ((cleanCat.includes('KID') || cleanCat.includes('BABY')) && (itemCat.includes('KID') || itemCat.includes('BABY'))) return true;
      if ((cleanCat.includes('SHOE') || cleanCat.includes('FOOTWEAR')) && (itemCat.includes('SHOE') || itemCat.includes('FOOTWEAR'))) return true;
      if (cleanCat.includes('SPECIAL') && (itemCat.includes('SPECIAL') || itemCat.includes('PREMIUM') || itemCat.includes('TRADITIONAL'))) return true;
      return false;
    });
  }, [allItems, selectedCategory]);

  // Primary display results:
  // 1. When user has entered text: use API results (or local instant fallback search)
  // 2. When query is empty and ALL is selected: show all items in the catalog
  // 3. When query is empty but a specific category pill is selected: show all catalog items in that category
  const displayResults = useMemo(() => {
    if (query.trim().length > 0) {
      return apiResults !== null ? apiResults : localResults;
    }
    if (selectedCategory === 'ALL') {
      return allItems;
    }
    return categoryBrowseItems;
  }, [query, apiResults, localResults, selectedCategory, allItems, categoryBrowseItems]);

  // Fallback suggestions for zero results
  const suggestions = useMemo(() => {
    if (apiSuggestions.length > 0) return apiSuggestions;
    if (displayResults.length > 0) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const cleanQ = q.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const matchedSuggestions = new Set<string>();

    Object.entries(GARMENT_SYNONYMS).forEach(([key, syns]) => {
      if (cleanQ.includes(key) || key.includes(cleanQ)) {
        matchedSuggestions.add(key.charAt(0).toUpperCase() + key.slice(1));
        syns.forEach((s) => matchedSuggestions.add(s.charAt(0).toUpperCase() + s.slice(1)));
      }
    });

    if (matchedSuggestions.size === 0) {
      ['Saree', 'Shirt', 'T-Shirt', 'Suit', 'Jeans', 'Bedsheet', 'Blanket', 'Kurta', 'Dry Cleaning', 'Steam Press'].forEach((s) =>
        matchedSuggestions.add(s)
      );
    }

    return Array.from(matchedSuggestions).slice(0, 6);
  }, [apiSuggestions, displayResults.length, query]);

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
    } else if (item.allPrices && Array.isArray(item.allPrices) && item.allPrices.length > 0) {
      services = item.allPrices.map((pm: any) => {
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
      subcategory: item.subcategory || cloth?.subCategory || (cloth as any)?.subcategory || 'General',
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
    setSelectedCategory('ALL');
    setQuery(clean);
    void saveSearchTerm(clean);
  };

  const handleCategoryPress = (catKey: string) => {
    Keyboard.dismiss();
    setSelectedCategory((prev) => (prev === catKey ? 'ALL' : catKey));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Search Input Bar with safe area status bar inset */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 16) + 8 },
          isDark && { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
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

          {isSearching && (
            <ActivityIndicator size="small" color="#059669" style={{ marginRight: 6 }} />
          )}

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

      {/* Category Filter Pills (Scrollable Horizontal Strip) */}
      <View style={[styles.categoryPillsWrap, isDark && { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillsScroll}
          keyboardShouldPersistTaps="always"
        >
          {SEARCH_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                style={[
                  styles.catPill,
                  isActive ? styles.catPillActive : (isDark ? styles.catPillDark : styles.catPillInactive),
                ]}
                onPress={() => handleCategoryPress(cat.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${cat.label}`}
              >
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={14}
                  color={isActive ? '#FFFFFF' : (isDark ? colors.textCaption : '#64748B')}
                />
                <Text
                  style={[
                    styles.catPillText,
                    isActive ? styles.catPillTextActive : (isDark ? { color: colors.textBody } : styles.catPillTextInactive),
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Live Autocomplete Suggestions Strip (shown when typing) */}
      {query.trim().length > 0 && autocompleteItems.length > 0 && (
        <View style={[styles.autocompleteWrap, isDark && { backgroundColor: colors.section, borderBottomColor: colors.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.autocompleteScroll}
          >
            {autocompleteItems.map((item, idx) => (
              <Pressable
                key={`auto-${idx}`}
                style={[styles.autocompleteChip, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  Keyboard.dismiss();
                  setQuery(item.text);
                  void saveSearchTerm(item.text);
                }}
              >
                <Text style={styles.autocompleteIcon}>{item.icon || '🔍'}</Text>
                <Text style={[styles.autocompleteText, isDark && { color: colors.textHeading }]} numberOfLines={1}>
                  {item.text}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 140 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* If Query is Empty and Category is ALL: Show Recent Searches & Popular Searches discovery section at top */}
        {!query.trim() && selectedCategory === 'ALL' && (
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

            {/* Popular Searches */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="fire" size={17} color="#EA580C" />
                <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Popular Searches</Text>
              </View>
              <View style={styles.chipsRow}>
                {POPULAR_SEARCH_TAGS.map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [
                      styles.serviceChip,
                      isDark && { backgroundColor: colors.section, borderColor: colors.border },
                      pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => handleSelectKeyword(item.label)}
                  >
                    <MaterialCommunityIcons name={item.icon as any} size={15} color={item.color} />
                    <Text style={[styles.serviceChipText, isDark && { color: colors.textHeading }]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Search Results Grid / Catalog Grid (Always rendered!) */}
        <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsHeaderTitleRow}>
                <Text style={[styles.resultsCount, isDark && { color: colors.textCaption }]}>
                  {query.trim()
                    ? `Found ${displayResults.length} service${displayResults.length === 1 ? '' : 's'}`
                    : `${SEARCH_CATEGORIES.find((c) => c.key === selectedCategory)?.label || selectedCategory} (${displayResults.length} item${displayResults.length === 1 ? '' : 's'})`}
                </Text>
                {isSearching ? (
                  <View style={styles.searchingBadge}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={styles.searchingBadgeText}>Searching…</Text>
                  </View>
                ) : null}
              </View>
              {query.trim().length > 0 && displayResults.length > 0 && (
                <Text style={[styles.resultsQuery, isDark && { color: colors.textHeading }]}>
                  for "{query}"
                  {selectedCategory !== 'ALL' ? (
                    <Text style={styles.categorySubQuery}>
                      {` in ${SEARCH_CATEGORIES.find((c) => c.key === selectedCategory)?.label || selectedCategory}`}
                    </Text>
                  ) : null}
                </Text>
              )}
            </View>

            {displayResults.length === 0 ? (
              <View style={styles.emptyResults}>
                <MaterialCommunityIcons name="magnify-close" size={54} color="#D6B36A" />
                <Text style={[styles.emptyTitle, isDark && { color: colors.textHeading }]}>
                  {selectedCategory !== 'ALL' ? 'No Items Found in this Category' : 'No Matching Services Found'}
                </Text>
                <Text style={[styles.emptySubtitle, isDark && { color: colors.textCaption }]}>
                  {selectedCategory !== 'ALL'
                    ? 'Explore other categories or try searching for specific items above.'
                    : 'Try searching for keywords like "Suit", "Saree", "Blanket", or "Kurti".'}
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
                        <Text style={[styles.garmentService, isDark && { color: colors.textCaption }]} numberOfLines={1}>
                          {item.categoryLabel ? `${item.categoryLabel} • ` : ''}
                          {item.subcategory ? `${item.subcategory} • ` : ''}
                          {item.serviceName}
                        </Text>

                        <View style={styles.garmentBottomRow}>
                          <Text style={[styles.garmentPrice, isDark && { color: colors.textHeading }]}>
                            ₹{item.price}<Text style={[styles.garmentUnit, isDark && { color: colors.textCaption }]}>/{item.unit}</Text>
                          </Text>

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
      </ScrollView>

      {/* Floating Bag Bar at bottom when items exist in bag */}
      {cart.length > 0 && (
        <View style={[styles.floatingBagBar, { bottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.bagInfo}>
            <Text style={styles.bagCountText}>
              {cartSummary.itemCount} {cartSummary.itemCount === 1 ? 'item' : 'items'} in bag
            </Text>
            <Text style={styles.bagTotalText}>
              Total {money(cartSummary.itemTotal)}
            </Text>
          </View>
          <Pressable
            style={styles.bagReviewBtn}
            onPress={onBook}
            accessibilityRole="button"
            accessibilityLabel="Review order"
          >
            <Text style={styles.bagReviewBtnText}>View Bag</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  categoryPillsWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  categoryPillsScroll: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  catPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  catPillInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  catPillDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  catPillTextInactive: {
    color: '#475569',
  },
  autocompleteWrap: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 6,
  },
  autocompleteScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  autocompleteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  autocompleteIcon: {
    fontSize: 12,
  },
  autocompleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  discoveryWrap: {
    paddingTop: 8,
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
  resultsSection: {
    gap: 12,
    paddingTop: 6,
  },
  resultsHeader: {
    gap: 4,
  },
  resultsHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  searchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  searchingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  resultsQuery: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  categorySubQuery: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#059669',
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
