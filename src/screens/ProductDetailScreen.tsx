import React, { useState, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  Image,
  Platform,
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
import { getGarmentImageUrl } from '@/lib/garment-photos';
import type { ProductItem, ServicePriceOption } from '@/types/domain';

interface ProductDetailScreenProps {
  product: ProductItem;
  initialServiceId?: string;
  onBack: () => void;
  onViewCart: () => void;
}

export function ProductDetailScreen({
  product,
  initialServiceId,
  onBack,
  onViewCart,
}: ProductDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { cart, cartSummary, addCartItem, setCartQuantity, removeFromCart, wishlist, toggleWishlist } = useApp();

  // Find initial service or default to first
  const defaultService = useMemo(() => {
    if (initialServiceId) {
      const match = product.services.find((s) => s.serviceId === initialServiceId);
      if (match) return match;
    }
    return product.services[0] || null;
  }, [product.services, initialServiceId]);

  const [selectedService, setSelectedService] = useState<ServicePriceOption | null>(defaultService);
  const [starchOption, setStarchOption] = useState<'NONE' | 'LIGHT' | 'CRISP'>('NONE');
  const [packingOption, setPackingOption] = useState<'FOLDED' | 'HANGER'>('HANGER');
  const [customNote, setCustomNote] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  // Check if this cloth + selected service is already in cart
  const cartItemId = useMemo(() => {
    if (!selectedService) return '';
    return `${product.id}-${selectedService.serviceId}`;
  }, [product.id, selectedService]);

  const existingCartItem = useMemo(() => {
    return cart.find((c) => c && (c.id === cartItemId || (c.clothId === product.id && c.serviceId === selectedService?.serviceId)));
  }, [cart, cartItemId, product.id, selectedService]);

  const [quantity, setQuantity] = useState(existingCartItem ? existingCartItem.quantity : 1);

  // Sync quantity when selectedService changes
  const handleServiceSelect = (srv: ServicePriceOption) => {
    setSelectedService(srv);
    const existing = cart.find(
      (c) => c && (c.id === `${product.id}-${srv.serviceId}` || (c.clothId === product.id && c.serviceId === srv.serviceId))
    );
    setQuantity(existing ? existing.quantity : 1);
  };

  const isFavorite = wishlist.includes(product.id);

  // Photo resolution
  const photoUrl = useMemo(() => {
    if (imageFailed) return product.fallbackImageUrl || undefined;
    if (product.imageUrl) {
      return getGarmentImageUrl(product.id, product.imageUrl, product.categoryTag, product.name);
    }
    return product.fallbackImageUrl || undefined;
  }, [product, imageFailed]);

  // Price calculations
  const unitPrice = selectedService ? selectedService.price : product.minPrice;
  const starchExtra = starchOption === 'LIGHT' ? 10 : starchOption === 'CRISP' ? 15 : 0;
  const totalPrice = (unitPrice + starchExtra) * quantity;

  // Add / Update Bag handler
  const btnScaleAnim = useRef(new Animated.Value(1)).current;

  const handleAddOrUpdate = () => {
    if (!selectedService) {
      Alert.alert('Select a Service', 'Please choose a laundry treatment for this garment.');
      return;
    }

    Animated.sequence([
      Animated.timing(btnScaleAnim, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.spring(btnScaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();

    const cleanServiceCode = selectedService.serviceCode.replace(/-/g, '_').toUpperCase();

    // Notes summary
    const notesParts: string[] = [];
    if (starchOption !== 'NONE') notesParts.push(`${starchOption === 'LIGHT' ? 'Light' : 'Crisp'} Starch`);
    if (packingOption === 'HANGER') notesParts.push('Hanger Pack');
    if (customNote.trim()) notesParts.push(customNote.trim());
    const finalNotes = notesParts.join(' • ');

    if (existingCartItem) {
      // Update quantity
      setCartQuantity(existingCartItem.id, quantity);
    } else {
      // Add new cart item
      const itemUnitPrice = unitPrice + starchExtra;
      addCartItem({
        id: cartItemId,
        serviceId: selectedService.serviceId,
        clothId: product.id,
        clothName: product.name,
        serviceName: `${product.name} (${selectedService.displayName})`,
        categoryName: product.categoryLabel || product.categoryTag,
        pricingModel: selectedService.unit === 'KG' ? 'PER_KG' : 'PER_ITEM',
        unitPrice: itemUnitPrice,
        quantity,
        unit: selectedService.unit === 'KG' ? 'KG' : 'Piece',
        subtotal: itemUnitPrice * quantity,
        specialInstructions: finalNotes || undefined,
        turnaroundHours: selectedService.turnaroundHours,
        imageUrl: product.imageUrl || product.fallbackImageUrl,
      });
    }
  };

  return (
    <View style={styles.root}>
      {/* 1. TOP APP BAR */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBackBtn}
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {product.name}
        </Text>
        <Pressable
          style={styles.headerFavoriteBtn}
          onPress={() => toggleWishlist(product.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Remove from saved' : 'Save item'}
        >
          <MaterialCommunityIcons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={22}
            color={isFavorite ? '#EF4444' : '#64748B'}
          />
        </Pressable>
      </View>

      {/* 2. SCROLLABLE CONTENT */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
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
            <View style={styles.heroImageFallback}>
              <MaterialCommunityIcons name="tshirt-crew" size={72} color="#CBD5E1" />
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
        <View style={styles.detailsCard}>
          <View style={styles.titleRow}>
            <Text style={styles.garmentTitle}>{product.name}</Text>
          </View>

          <Text style={styles.garmentSubcategory}>
            {product.subcategory ? `${product.subcategory} • ` : ''}Professional Care & Steam Finishing
          </Text>

          {product.description ? (
            <Text style={styles.garmentDesc}>{product.description}</Text>
          ) : (
            <Text style={styles.garmentDesc}>
              Individually inspected, sanitized with hospital-grade ozone, and steam-pressed with industrial vacuum irons.
            </Text>
          )}
        </View>

        {/* SERVICE SELECTION SECTION */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="tag-outline" size={18} color="#16A34A" />
            <Text style={styles.sectionTitle}>Select Treatment & Service</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Choose the care type suited for this garment:
          </Text>

          <View style={styles.servicesList}>
            {product.services.map((srv) => {
              const isSelected = selectedService?.serviceId === srv.serviceId;
              const tat = srv.turnaroundHours ? `${srv.turnaroundHours}h TAT` : '24-48h Return';

              return (
                <Pressable
                  key={srv.serviceId}
                  style={[
                    styles.serviceCard,
                    isSelected && styles.serviceCardSelected,
                  ]}
                  onPress={() => handleServiceSelect(srv)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.serviceCardLeft}>
                    <View
                      style={[
                        styles.radioIndicator,
                        isSelected && styles.radioIndicatorSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>

                    <View style={styles.serviceInfoCol}>
                      <View style={styles.serviceNameRow}>
                        <Text style={[styles.serviceName, isSelected && styles.serviceNameSelected]}>
                          {srv.displayName}
                        </Text>
                        <View style={styles.tatPill}>
                          <MaterialCommunityIcons name="clock-outline" size={11} color="#2563EB" />
                          <Text style={styles.tatPillText}>{tat}</Text>
                        </View>
                      </View>
                      <Text style={styles.serviceBenefit}>
                        {srv.serviceCode.includes('DRY')
                          ? 'Zero-solvent hydrocarbon cleaning, odor-free, delivered on wire hanger'
                          : srv.serviceCode.includes('WASH')
                          ? 'Gentle organic wash, fabric softening & crease-free steam iron'
                          : 'Industrial vacuum high-pressure steam press, zero wrinkles guaranteed'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.servicePriceCol}>
                    <Text style={[styles.servicePrice, isSelected && styles.servicePriceSelected]}>
                      ₹{srv.price}
                    </Text>
                    <Text style={styles.serviceUnit}>/{srv.unit.toLowerCase()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* SPECIAL CARE PREFERENCES */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="tune-variant" size={18} color="#16A34A" />
            <Text style={styles.sectionTitle}>Custom Finishing (Optional)</Text>
          </View>

          {/* Starch Options */}
          <Text style={styles.subOptionTitle}>Starch Level</Text>
          <View style={styles.optionPillsRow}>
            {(['NONE', 'LIGHT', 'CRISP'] as const).map((opt) => (
              <Pressable
                key={opt}
                style={[
                  styles.optionPill,
                  starchOption === opt && styles.optionPillActive,
                ]}
                onPress={() => setStarchOption(opt)}
              >
                <Text
                  style={[
                    styles.optionPillText,
                    starchOption === opt && styles.optionPillTextActive,
                  ]}
                >
                  {opt === 'NONE' ? 'No Starch' : opt === 'LIGHT' ? 'Light Starch (+₹10)' : 'Crisp Finish (+₹15)'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Packaging Option */}
          <Text style={styles.subOptionTitle}>Packaging Preference</Text>
          <View style={styles.optionPillsRow}>
            {(['HANGER', 'FOLDED'] as const).map((opt) => (
              <Pressable
                key={opt}
                style={[
                  styles.optionPill,
                  packingOption === opt && styles.optionPillActive,
                ]}
                onPress={() => setPackingOption(opt)}
              >
                <MaterialCommunityIcons
                  name={opt === 'HANGER' ? 'hanger' : 'package-variant-closed'}
                  size={14}
                  color={packingOption === opt ? '#16A34A' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.optionPillText,
                    packingOption === opt && styles.optionPillTextActive,
                  ]}
                >
                  {opt === 'HANGER' ? 'Delivered on Hanger' : 'Flat Folded in Polybag'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Special Notes Input */}
          <Text style={styles.subOptionTitle}>Special Instructions for Washer / Ironer</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="e.g., Check cuff stain, handle delicate collar gently..."
            placeholderTextColor="#94A3B8"
            value={customNote}
            onChangeText={setCustomNote}
            maxLength={140}
          />
        </View>

        {/* QUALITY & GUARANTEE PROMISE */}
        <View style={styles.guaranteeCard}>
          <View style={styles.guaranteeRow}>
            <MaterialCommunityIcons name="shield-check" size={24} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.guaranteeTitle}>The LaundryFresh Fabric Promise</Text>
              <Text style={styles.guaranteeDesc}>
                100% Zero Color Bleed • Free Re-wash Guarantee • Hospital-Grade Ozone Sanitization
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 3. STICKY BOTTOM CHECKOUT DOCK */}
      <View
        style={[
          styles.stickyBottomDock,
          { paddingBottom: Math.max(insets.bottom, 14) },
        ]}
      >
        <View style={styles.dockMainRow}>
          {/* Quantity Stepper */}
          <View style={styles.dockStepper}>
            <Pressable
              style={styles.dockStepperBtn}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
            >
              <MaterialCommunityIcons name="minus" size={16} color="#0F172A" />
            </Pressable>
            <Text style={styles.dockStepperQty}>{quantity}</Text>
            <Pressable
              style={styles.dockStepperBtn}
              onPress={() => setQuantity((q) => q + 1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
            >
              <MaterialCommunityIcons name="plus" size={16} color="#0F172A" />
            </Pressable>
          </View>

          {/* Total & Action Button */}
          <View style={styles.dockActionGroup}>
            <View style={styles.dockPriceCol}>
              <Text style={styles.dockPriceTotal}>₹{totalPrice}</Text>
              <Text style={styles.dockPriceSub} numberOfLines={1}>
                {selectedService?.shortLabel || 'Care'} · {quantity} {quantity === 1 ? 'pc' : 'pcs'}
              </Text>
            </View>

            <Animated.View style={{ transform: [{ scale: btnScaleAnim }], flex: 1 }}>
              <Pressable
                style={[
                  styles.dockPrimaryBtn,
                  existingCartItem ? styles.dockPrimaryBtnUpdate : null,
                ]}
                onPress={handleAddOrUpdate}
                accessibilityRole="button"
                accessibilityLabel={existingCartItem ? 'Update laundry bag' : 'Add garment to laundry bag'}
              >
                <MaterialCommunityIcons
                  name={existingCartItem ? 'check' : 'shopping'}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.dockPrimaryBtnText}>
                  {existingCartItem ? 'Update Bag' : 'Add to Bag'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </View>

        {/* Shortcut to Cart if items exist */}
        {cartSummary.itemCount > 0 && (
          <Pressable
            style={styles.viewCartShortcut}
            onPress={onViewCart}
            hitSlop={6}
            accessibilityRole="button"
          >
            <Text style={styles.viewCartShortcutText}>
              🛍️ {cartSummary.itemCount} items in Bag (₹{cartSummary.itemTotal}) • View Bag ➔
            </Text>
          </Pressable>
        )}
      </View>
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
  headerFavoriteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 8,
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
  },
  servicesList: {
    gap: 10,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  serviceCardSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  serviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIndicatorSelected: {
    borderColor: '#16A34A',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  serviceInfoCol: {
    flex: 1,
  },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  serviceNameSelected: {
    color: '#C2410C',
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
  serviceBenefit: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  servicePriceCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  servicePriceSelected: {
    color: '#16A34A',
  },
  serviceUnit: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
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
  dockMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dockStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 4,
    height: 48,
  },
  dockStepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dockStepperQty: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 12,
  },
  dockActionGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dockPriceCol: {
    justifyContent: 'center',
  },
  dockPriceTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  dockPriceSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  dockPrimaryBtn: {
    height: 48,
    backgroundColor: '#059669',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dockPrimaryBtnUpdate: {
    backgroundColor: '#0D9488',
    shadowColor: '#0D9488',
  },
  dockPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  viewCartShortcut: {
    alignItems: 'center',
    paddingTop: 8,
  },
  viewCartShortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
});
