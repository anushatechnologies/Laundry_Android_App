import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { AnimatedCartButton } from '@/components/AnimatedCartButton';
import type { ProductItem, ServicePriceOption } from '@/types/domain';

interface ProductDetailScreenProps {
  product: ProductItem;
  initialServiceId?: string;
  onBack: () => void;
  onViewCart: () => void;
}

function getServiceConfig(serviceCode: string, serviceName?: string) {
  const code = (serviceCode || '').toUpperCase();
  const name = (serviceName || '').toLowerCase();

  if (code === 'DRY_CLEAN' || name.includes('dry clean')) {
    return {
      bg: '#EEF2FF',
      color: '#4F46E5',
      border: '#C7D2FE',
      tag: 'Zero Shrinkage',
      icon: 'coat-rack',
      benefit: 'Gentle hydrocarbon dry cleaning, zero fabric shrinkage, delivered on wire hanger.',
    };
  }
  if (code === 'WASH_IRON' || name.includes('wash & iron') || name.includes('wash & steam')) {
    return {
      bg: '#CCFBF1',
      color: '#0F766E',
      border: '#99F6E4',
      tag: 'Most Popular',
      icon: 'washing-machine',
      benefit: 'Hygienic antiseptic wash + fabric conditioning + precision vacuum steam iron.',
    };
  }
  if (code === 'WASH_FOLD' || name.includes('wash & fold')) {
    return {
      bg: '#E0F2FE',
      color: '#0284C7',
      border: '#BAE6FD',
      tag: 'Daily Wear',
      icon: 'tshirt-crew-outline',
      benefit: 'Deep machine wash, tumble dry & neatly flat-folded, ready for wardrobe.',
    };
  }
  if (code === 'PRESS' || name.includes('press') || name.includes('iron')) {
    return {
      bg: '#DCFCE7',
      color: '#16A34A',
      border: '#BBF7D0',
      tag: 'Razor Sharp',
      icon: 'iron',
      benefit: 'High-pressure industrial vacuum steam press, sharp crisp creases guaranteed.',
    };
  }
  if (code === 'STARCH' || name.includes('starch')) {
    return {
      bg: '#FEF3C7',
      color: '#D97706',
      border: '#FDE68A',
      tag: 'Crisp Ethnic',
      icon: 'sparkles',
      benefit: 'Traditional natural starching treatment for stiff, crisp, pristine dhotis & ethnic wear.',
    };
  }
  if (code === 'SAREE_POLISH' || name.includes('polish') || name.includes('charak')) {
    return {
      bg: '#FCE7F3',
      color: '#DB2777',
      border: '#FBCFE8',
      tag: 'Silk & Zari',
      icon: 'crown-outline',
      benefit: 'Specialized roll polish & charak finishing to restore natural luster and drape.',
    };
  }
  if (code === 'SHOE_SPA' || name.includes('shoe') || name.includes('spa')) {
    return {
      bg: '#F3E8FF',
      color: '#7C3AED',
      border: '#E9D5FF',
      tag: 'Deep Detox',
      icon: 'shoe-sneaker',
      benefit: 'Comprehensive exterior detailing, sole cleaning & antimicrobial ozone sanitization.',
    };
  }
  if (code === 'EXPRESS' || name.includes('express')) {
    return {
      bg: '#FFEDD5',
      color: '#EA580C',
      border: '#FED7AA',
      tag: 'Priority 24h',
      icon: 'lightning-bolt',
      benefit: 'Priority fast-track processing and express doorstep delivery in 24 hours.',
    };
  }

  return {
    bg: '#F1F5F9',
    color: '#475569',
    border: '#E2E8F0',
    tag: 'Special Care',
    icon: 'star-four-points-outline',
    benefit: 'Custom fabric treatment handled by experienced laundry specialists.',
  };
}

export function ProductDetailScreen({
  product,
  initialServiceId,
  onBack,
  onViewCart,
}: ProductDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { cart, cartSummary, addCartItem, setCartQuantity, removeFromCart, wishlist, toggleWishlist } = useApp();

  const [imageFailed, setImageFailed] = useState(false);
  const [starchOption, setStarchOption] = useState<'NONE' | 'LIGHT' | 'CRISP'>('NONE');
  const [packingOption, setPackingOption] = useState<'FOLDED' | 'HANGER'>('HANGER');
  const [customNote, setCustomNote] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    initialServiceId || product.services[0]?.serviceId || ''
  );

  const isFavorite = wishlist.includes(product.id);

  const { minPrice, maxPrice } = useMemo(() => {
    const prices = product.services.map((s) => s.price).filter((p) => p > 0);
    return {
      minPrice: prices.length > 0 ? Math.min(...prices) : product.minPrice || 25,
      maxPrice: prices.length > 0 ? Math.max(...prices) : product.minPrice || 25,
    };
  }, [product]);

  const activeService = useMemo(
    () => product.services.find((s) => s.serviceId === selectedServiceId) || product.services[0],
    [product.services, selectedServiceId]
  );
  const isSelectedServiceStarch = activeService?.serviceCode === 'STARCH';

  // Photo resolution
  const photoUrl = useMemo(() => {
    if (imageFailed) return product.fallbackImageUrl || undefined;
    if (product.imageUrl) {
      return getGarmentImageUrl(product.id, product.imageUrl, product.categoryTag, product.name);
    }
    return product.fallbackImageUrl || undefined;
  }, [product, imageFailed]);

  // Per-service cart helpers
  const getCartItemForService = useCallback(
    (srv: ServicePriceOption) =>
      cart.find(
        (c) =>
          c &&
          (c.id === `${product.id}-${srv.serviceId}` ||
            (c.clothId === product.id && c.serviceId === srv.serviceId))
      ),
    [cart, product.id]
  );

  const starchExtra = starchOption === 'LIGHT' ? 10 : starchOption === 'CRISP' ? 15 : 0;

  // Notes summary
  const getNotes = useCallback((serviceCode?: string) => {
    const parts: string[] = [];
    if (serviceCode !== 'STARCH' && starchOption !== 'NONE') {
      parts.push(`${starchOption === 'LIGHT' ? 'Light' : 'Crisp'} Starch`);
    }
    if (packingOption === 'HANGER') parts.push('Hanger Pack');
    if (customNote.trim()) parts.push(customNote.trim());
    return parts.join(' • ');
  }, [starchOption, packingOption, customNote]);

  // Add a specific service to cart
  const handleAdd = useCallback(
    (srv: ServicePriceOption) => {
      const isStarchService = srv.serviceCode === 'STARCH';
      const effectiveStarchExtra = isStarchService ? 0 : starchExtra;
      const itemUnitPrice = srv.price + effectiveStarchExtra;
      const cartItemId = `${product.id}-${srv.serviceId}`;
      addCartItem({
        id: cartItemId,
        serviceId: srv.serviceId,
        clothId: product.id,
        clothName: product.name,
        serviceName: `${product.name} (${srv.displayName})`,
        categoryName: product.categoryLabel || product.categoryTag,
        pricingModel: srv.unit === 'KG' ? 'PER_KG' : 'PER_ITEM',
        unitPrice: itemUnitPrice,
        quantity: 1,
        unit: srv.unit === 'KG' ? 'KG' : 'Piece',
        subtotal: itemUnitPrice,
        specialInstructions: getNotes(srv.serviceCode) || undefined,
        turnaroundHours: srv.turnaroundHours,
        imageUrl: product.imageUrl || product.fallbackImageUrl,
      });
      setSelectedServiceId(srv.serviceId);
    },
    [product, addCartItem, starchExtra, getNotes]
  );

  const handleIncrement = useCallback(
    (srv: ServicePriceOption) => {
      const existing = getCartItemForService(srv);
      if (existing) setCartQuantity(existing.id, existing.quantity + 1);
    },
    [getCartItemForService, setCartQuantity]
  );

  const handleDecrement = useCallback(
    (srv: ServicePriceOption) => {
      const existing = getCartItemForService(srv);
      if (!existing) return;
      if (existing.quantity <= 1) {
        removeFromCart(existing.id);
      } else {
        setCartQuantity(existing.id, existing.quantity - 1);
      }
    },
    [getCartItemForService, removeFromCart, setCartQuantity]
  );

  const handleToggleWishlist = useCallback(() => {
    toggleWishlist(product.id);
  }, [product.id, toggleWishlist]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* 1. TOP APP BAR */}
      <View style={[styles.header, isDark && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable
          style={styles.headerBackBtn}
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={isDark ? colors.textHeading : '#0F172A'} />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && { color: colors.textHeading }]} numberOfLines={1}>
          {product.name}
        </Text>
        <View style={styles.headerRightActions}>
          <Pressable
            style={styles.headerFavoriteBtn}
            onPress={handleToggleWishlist}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from saved' : 'Save item'}
          >
            <MaterialCommunityIcons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? '#EF4444' : (isDark ? colors.textCaption : '#64748B')}
            />
          </Pressable>

          <Pressable
            style={styles.headerCartBtn}
            onPress={onViewCart}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Shopping bag, ${cartSummary.itemCount} items`}
          >
            <MaterialCommunityIcons name="shopping-outline" size={23} color={isDark ? colors.primaryLight : '#166534'} />
            {cartSummary.itemCount > 0 && (
              <View style={styles.headerCartBadge}>
                <Text style={styles.headerCartBadgeText}>
                  {cartSummary.itemCount > 99 ? '99+' : cartSummary.itemCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* 2. SCROLLABLE CONTENT */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (cartSummary.itemCount > 0 ? 100 : 28) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO IMAGE CONTAINER */}
        <View style={styles.heroImageWrap}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={[styles.heroImageFallback, isDark && { backgroundColor: colors.section }]}>
              <MaterialCommunityIcons name="tshirt-crew" size={72} color={isDark ? colors.textCaption : '#CBD5E1'} />
            </View>
          )}

          {/* Category Tag Badge */}
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>
              {product.categoryLabel || product.categoryTag.replace(/_/g, ' ')}
            </Text>
          </View>

          {/* Fast Delivery Badge */}
          <View style={styles.expressPill}>
            <MaterialCommunityIcons name="lightning-bolt" size={13} color="#FFFFFF" />
            <Text style={styles.expressPillText}>Express Available</Text>
          </View>
        </View>

        {/* GARMENT DETAILS CARD */}
        <View style={[styles.detailsCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.garmentTitle, isDark && { color: colors.textHeading }]}>{product.name}</Text>
          </View>

          <Text style={[styles.garmentSubcategory, isDark && { color: colors.textCaption }]}>
            {product.subcategory ? `${product.subcategory} • ` : ''}Professional Care & Steam Finishing
          </Text>

          {/* Quick summary badge */}
          <View style={styles.servicesSummaryRow}>
            <View style={[styles.servicesCountBadge, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4', borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#BBF7D0' }]}>
              <MaterialCommunityIcons name="layers-outline" size={13} color="#16A34A" />
              <Text style={[styles.servicesCountBadgeText, { color: isDark ? '#4ADE80' : '#166534' }]}>
                {product.services.length} Care Services Available
              </Text>
            </View>
            <Text style={[styles.priceRangeText, isDark && { color: colors.textCaption }]}>
              ₹{minPrice} - ₹{maxPrice}
            </Text>
          </View>

          {product.description ? (
            <Text style={[styles.garmentDesc, isDark && { color: colors.textBody }]}>{product.description}</Text>
          ) : (
            <Text style={[styles.garmentDesc, isDark && { color: colors.textBody }]}>
              Individually inspected, sanitized with hospital-grade ozone, and steam-pressed with industrial vacuum irons.
            </Text>
          )}
        </View>

        {/* SERVICE SELECTION — Interactive Care Tiers */}
        <View style={[styles.sectionWrap, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="tag-outline" size={18} color="#16A34A" />
            <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Select Treatment & Service</Text>
          </View>
          <Text style={[styles.sectionSubtitle, isDark && { color: colors.textCaption }]}>
            Tap any service to select. You can add multiple treatments for the same garment:
          </Text>

          <View style={styles.servicesList}>
            {product.services.map((srv) => {
              const cartItem = getCartItemForService(srv);
              const qty = cartItem ? cartItem.quantity : 0;
              const tat = srv.turnaroundHours ? `${srv.turnaroundHours}h TAT` : '24-48h Return';
              const cfg = getServiceConfig(srv.serviceCode, srv.displayName || srv.serviceName);
              const isSelected = selectedServiceId === srv.serviceId;
              const isStarchService = srv.serviceCode === 'STARCH';
              const effectiveStarchExtra = isStarchService ? 0 : starchExtra;
              const currentPrice = srv.price + effectiveStarchExtra;

              return (
                <Pressable
                  key={srv.serviceId}
                  onPress={() => setSelectedServiceId(srv.serviceId)}
                  style={[
                    styles.serviceCard,
                    isDark && { backgroundColor: colors.section, borderColor: colors.border },
                    isSelected && {
                      borderColor: '#16A34A',
                      borderWidth: 1.8,
                      backgroundColor: isDark ? 'rgba(22, 163, 74, 0.12)' : '#F0FDF4',
                    },
                    qty > 0 && !isSelected && (isDark
                      ? { backgroundColor: 'rgba(22, 163, 74, 0.08)', borderColor: 'rgba(22, 163, 74, 0.4)' }
                      : styles.serviceCardActive),
                  ]}
                >
                  {/* Service Top Row: Icon + Title + Tags */}
                  <View style={styles.serviceHeaderRow}>
                    <View style={[styles.serviceIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : cfg.bg }]}>
                      <MaterialCommunityIcons name={cfg.icon as any} size={20} color={cfg.color} />
                    </View>

                    <View style={styles.serviceTitleCol}>
                      <View style={styles.serviceNameRow}>
                        <Text style={[styles.serviceName, isDark && { color: colors.textHeading }]}>
                          {srv.displayName}
                        </Text>
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                            <Text style={styles.selectedBadgeText}>Selected</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.serviceBadgesRow}>
                        <View style={[styles.tatPill, isDark && { backgroundColor: 'rgba(37, 99, 235, 0.18)' }]}>
                          <MaterialCommunityIcons name="clock-outline" size={11} color="#2563EB" />
                          <Text style={styles.tatPillText}>{tat}</Text>
                        </View>
                        <View style={[styles.serviceTypePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : cfg.bg }]}>
                          <Text style={[styles.serviceTypePillText, { color: cfg.color }]}>{cfg.tag}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Benefit text */}
                  <Text style={[styles.serviceBenefit, isDark && { color: colors.textCaption }]}>
                    {cfg.benefit}
                  </Text>

                  {/* Bottom Row: Price + ADD / Stepper */}
                  <View style={styles.serviceCardBottomRow}>
                    <View style={styles.servicePriceRow}>
                      <Text style={[styles.servicePrice, isDark && { color: colors.textHeading }, (isSelected || qty > 0) && { color: '#16A34A' }]}>
                        ₹{currentPrice}
                      </Text>
                      <Text style={[styles.serviceUnit, isDark && { color: colors.textCaption }]}>
                        /{srv.unit.toLowerCase()}
                      </Text>
                      {effectiveStarchExtra > 0 && (
                        <Text style={styles.starchExtra}>+₹{effectiveStarchExtra} starch</Text>
                      )}
                      {isStarchService && (
                        <Text style={[styles.includedStarchPillText, { color: '#D97706' }]}>• Crisp starch included</Text>
                      )}
                    </View>

                    <AnimatedCartButton
                      quantity={qty}
                      onAdd={() => handleAdd(srv)}
                      onIncrement={() => handleIncrement(srv)}
                      onDecrement={() => handleDecrement(srv)}
                      isDark={isDark}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* SPECIAL CARE PREFERENCES */}
        <View style={[styles.sectionWrap, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="tune-variant" size={18} color="#16A34A" />
            <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Custom Finishing (Optional)</Text>
          </View>

          {/* Starch Options */}
          <Text style={[styles.subOptionTitle, isDark && { color: colors.textHeading }]}>Starch Level</Text>
          {isSelectedServiceStarch ? (
            <View style={[styles.includedStarchBanner, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7', borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : '#FDE68A' }]}>
              <MaterialCommunityIcons name={"star-four-points" as any} size={15} color="#D97706" />
              <Text style={[styles.includedStarchBannerText, { color: isDark ? '#FBBF24' : '#92400E' }]}>
                Crisp Starch treatment is already fully included in the Starch & Crisp service at no extra cost.
              </Text>
            </View>
          ) : (
            <View style={styles.optionPillsRow}>
              {(['NONE', 'LIGHT', 'CRISP'] as const).map((opt) => (
                <Pressable
                  key={opt}
                  style={[
                    styles.optionPill,
                    isDark && { backgroundColor: colors.section, borderColor: colors.border },
                    starchOption === opt && (isDark ? { backgroundColor: 'rgba(22, 163, 74, 0.15)', borderColor: '#16A34A' } : styles.optionPillActive),
                  ]}
                  onPress={() => setStarchOption(opt)}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      isDark && { color: colors.textBody },
                      starchOption === opt && (isDark ? { color: '#4ADE80' } : styles.optionPillTextActive),
                    ]}
                  >
                    {opt === 'NONE' ? 'No Starch' : opt === 'LIGHT' ? 'Light Starch (+₹10)' : 'Crisp Finish (+₹15)'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Packaging Option */}
          <Text style={[styles.subOptionTitle, isDark && { color: colors.textHeading }]}>Packaging Preference</Text>
          <View style={styles.optionPillsRow}>
            {(['HANGER', 'FOLDED'] as const).map((opt) => (
              <Pressable
                key={opt}
                style={[
                  styles.optionPill,
                  isDark && { backgroundColor: colors.section, borderColor: colors.border },
                  packingOption === opt && (isDark ? { backgroundColor: 'rgba(22, 163, 74, 0.15)', borderColor: '#16A34A' } : styles.optionPillActive),
                ]}
                onPress={() => setPackingOption(opt)}
              >
                <MaterialCommunityIcons
                  name={opt === 'HANGER' ? 'hanger' : 'package-variant-closed'}
                  size={14}
                  color={packingOption === opt ? '#16A34A' : (isDark ? colors.textCaption : '#64748B')}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.optionPillText,
                    isDark && { color: colors.textBody },
                    packingOption === opt && (isDark ? { color: '#4ADE80' } : styles.optionPillTextActive),
                  ]}
                >
                  {opt === 'HANGER' ? 'Delivered on Hanger' : 'Flat Folded in Polybag'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Special Notes Input */}
          <Text style={[styles.subOptionTitle, isDark && { color: colors.textHeading }]}>Special Instructions for Washer / Ironer</Text>
          <TextInput
            style={[styles.notesInput, isDark && { backgroundColor: colors.section, borderColor: colors.border, color: colors.textHeading }]}
            placeholder="e.g., Check cuff stain, handle delicate collar gently..."
            placeholderTextColor={isDark ? colors.textCaption : '#94A3B8'}
            value={customNote}
            onChangeText={setCustomNote}
            maxLength={140}
          />
        </View>

        {/* QUALITY & GUARANTEE PROMISE */}
        <View style={[styles.guaranteeCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.guaranteeRow}>
            <MaterialCommunityIcons name="shield-check" size={24} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.guaranteeTitle, isDark && { color: colors.textHeading }]}>The LaundryFresh Fabric Promise</Text>
              <Text style={[styles.guaranteeDesc, isDark && { color: colors.textCaption }]}>
                100% Zero Color Bleed • Free Re-wash Guarantee • Hospital-Grade Ozone Sanitization
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 3. STICKY BOTTOM DOCK — View Bag summary */}
      {cartSummary.itemCount > 0 && (
        <Pressable
          style={[
            styles.stickyBottomDock,
            isDark && { backgroundColor: colors.surface, borderTopColor: colors.border },
            { paddingBottom: Math.max(insets.bottom, 14) },
          ]}
          onPress={onViewCart}
          accessibilityRole="button"
          accessibilityLabel={`View bag with ${cartSummary.itemCount} items, total ₹${cartSummary.itemTotal}`}
        >
          <View style={styles.dockBagRow}>
            <View style={styles.dockBagLeft}>
              <View style={styles.dockBagIconBadge}>
                <MaterialCommunityIcons name="shopping" size={15} color="#FFFFFF" />
              </View>
              <View>
                <Text style={[styles.dockBagCount, isDark && { color: colors.textHeading }]}>
                  {cartSummary.itemCount} {cartSummary.itemCount === 1 ? 'item' : 'items'} in Bag
                </Text>
                <Text style={[styles.dockBagTotal, isDark && { color: colors.textCaption }]}>
                  ₹{cartSummary.itemTotal} total
                </Text>
              </View>
            </View>
            <View style={styles.dockViewBagBtn}>
              <Text style={styles.dockViewBagBtnText}>View Bag</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF5EF',
  },
  header: {
    height: 52,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerFavoriteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCartBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginLeft: 2,
  },
  headerCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EA580C',
    minWidth: 19,
    height: 19,
    borderRadius: 9.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  headerCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  heroImageWrap: {
    width: '100%',
    height: 250,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 14,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  categoryPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  categoryPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  expressPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F766E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  expressPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  garmentTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  garmentSubcategory: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  servicesSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  servicesCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  servicesCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  priceRangeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  garmentDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  sectionWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 16,
  },
  servicesList: {
    gap: 12,
  },
  serviceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  serviceCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serviceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 3,
  },
  serviceName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#16A34A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  serviceBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  tatPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  serviceTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  serviceTypePillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  serviceBenefit: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginVertical: 2,
  },
  serviceCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  servicePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    flexWrap: 'wrap',
  },
  servicePrice: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  serviceUnit: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  starchExtra: {
    fontSize: 11,
    color: '#EA580C',
    fontWeight: '700',
    marginLeft: 4,
  },
  includedStarchPillText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  includedStarchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  includedStarchBannerText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    lineHeight: 17,
  },
  subOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 8,
  },
  optionPillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionPillActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  optionPillTextActive: {
    color: '#166534',
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  guaranteeCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 20,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    marginBottom: 2,
  },
  guaranteeDesc: {
    fontSize: 11.5,
    color: '#166534',
    lineHeight: 16,
  },
  // Bottom dock — View Bag summary
  stickyBottomDock: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  dockBagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dockBagLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dockBagIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dockBagCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  dockBagTotal: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  dockViewBagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  dockViewBagBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
