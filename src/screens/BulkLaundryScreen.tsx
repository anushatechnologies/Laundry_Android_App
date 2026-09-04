import React, { useState, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';

interface BulkLaundryScreenProps {
  onBack: () => void;
  onViewCart: () => void;
  onBook?: () => void;
}

interface BulkServiceSlab {
  id: string;
  laundryType?: string;
  serviceId: string;
  serviceName: string;
  weightKg: number;
  regularPrice: number;
  expressPrice?: number;
  regularTatHours?: number;
  expressTatHours?: number;
  isActive?: boolean;
}

interface BulkServiceOption {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  baseKgPrice: number;
  tat: string;
}

const DEFAULT_SERVICES: BulkServiceOption[] = [
  {
    id: 'srv-m-wash-fold',
    name: 'Wash & Fold',
    icon: 'washing-machine',
    subtitle: 'Daily wear, t-shirts, pyjamas & bedsheets',
    baseKgPrice: 60,
    tat: '24h Express',
  },
  {
    id: 'srv-m-wash-iron',
    name: 'Wash & Steam Iron',
    icon: 'iron',
    subtitle: 'Crisp pressed shirts, trousers & office wear',
    baseKgPrice: 85,
    tat: '36h Standard',
  },
];

const PRESET_WEIGHTS = [
  { kg: 5, label: 'Standard Bag', approx: '15-20 clothes (Daily wear for 1-2 people)', clothes: '15-20 clothes', tag: 'STARTER' },
  { kg: 7, label: 'Family Pack', approx: '22-28 clothes (Weekly laundry for 3-4 members)', clothes: '22-28 clothes', tag: 'MOST POPULAR' },
  { kg: 10, label: 'Super Saver', approx: '35-45 clothes (Large household / heavy loads)', clothes: '35-45 clothes', tag: 'BEST VALUE' },
  { kg: 15, label: 'Jumbo Load', approx: '55-65 clothes (Bedding, blankets & bulk clothes)', clothes: '55-65 clothes', tag: 'MAX SAVINGS' },
];

export function BulkLaundryScreen({
  onBack,
  onViewCart,
  onBook,
}: BulkLaundryScreenProps) {
  const insets = useSafeAreaInsets();
  const { cart, cartSummary, addCartItem } = useApp();

  const [selectedServiceId, setSelectedServiceId] = useState<string>('srv-m-wash-fold');
  const [weightKg, setWeightKg] = useState<number>(7);
  const [slabs, setSlabs] = useState<BulkServiceSlab[]>([]);
  const [servicesList, setServicesList] = useState<BulkServiceOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [justAddedToast, setJustAddedToast] = useState<string | null>(null);
  const [heroImgError, setHeroImgError] = useState<boolean>(false);

  // Fetch dynamic services and slabs from live backend API
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch('https://laundry.anushatechnologies.com/api/bulk-pricing')
      .then((r) => r.json())
      .then((res) => {
        if (!isMounted) return;
        if (res.allSlabs && Array.isArray(res.allSlabs) && res.allSlabs.length > 0) {
          setSlabs(res.allSlabs);
        }

        if (res.services && Array.isArray(res.services)) {
          const activeBackendServices = res.services
            .filter((s: any) => s.pricing && s.pricing.length > 0)
            .map((s: any) => {
              const rates = s.pricing.map((p: any) => Math.round(p.regularPrice / p.weightKg));
              const minRate = rates.length > 0 ? Math.min(...rates) : 55;
              const firstSlab = s.pricing[0];
              const tat = firstSlab?.regularTatHours ? `${firstSlab.regularTatHours} Hrs` : '24-48 Hrs';

              let icon = 'washing-machine';
              let subtitle = 'Everyday laundry washed & dried';
              if (s.serviceId.includes('iron')) {
                icon = 'iron';
                subtitle = 'Crisp pressed shirts, trousers & office wear';
              } else if (s.serviceId.includes('express')) {
                icon = 'lightning-bolt';
                subtitle = 'Urgent turnaround delivered in 24 hours';
              } else if (s.serviceId.includes('premium')) {
                icon = 'sparkles';
                subtitle = 'Special care for delicates & sensitive fabrics';
              } else {
                subtitle = 'Daily wear, t-shirts, pyjamas & bedsheets';
              }

              return {
                id: s.serviceId,
                name: s.serviceName,
                icon,
                subtitle,
                baseKgPrice: minRate,
                tat,
              };
            });

          if (activeBackendServices.length > 0) {
            setServicesList(activeBackendServices);
            setSelectedServiceId((prev) =>
              activeBackendServices.some((s: any) => s.id === prev) ? prev : activeBackendServices[0].id
            );
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const currentService: BulkServiceOption = useMemo(() => {
    if (servicesList.length === 0) return DEFAULT_SERVICES[0]!;
    const found = servicesList.find((s) => s.id === selectedServiceId);
    return (found || servicesList[0] || DEFAULT_SERVICES[0])!;
  }, [servicesList, selectedServiceId]);

  // Helper to calculate price for any given weight
  const calculatePriceForWeight = (kg: number) => {
    if (!currentService) return { totalPrice: 0, effectiveRate: 0 };
    
    const serviceSlabs = slabs.filter((s) => s.serviceId === selectedServiceId);
    let totalPrice = 0;

    if (serviceSlabs.length > 0) {
      const exact = serviceSlabs.find((s) => s.weightKg === kg);
      if (exact) {
        totalPrice = exact.regularPrice;
      } else {
        const sorted = [...serviceSlabs].sort((a, b) => a.weightKg - b.weightKg);
        const lower = sorted.filter((s) => s.weightKg <= kg).pop();
        if (lower) {
          const ratePerKg = Math.round(lower.regularPrice / lower.weightKg);
          totalPrice = ratePerKg * kg;
        } else {
          totalPrice = currentService.baseKgPrice * kg;
        }
      }
    } else {
      totalPrice = currentService.baseKgPrice * kg;
    }

    const effectiveRate = Math.round(totalPrice / kg);
    return { totalPrice, effectiveRate };
  };

  const pricingInfo = useMemo(() => {
    const { totalPrice, effectiveRate } = calculatePriceForWeight(weightKg);
    const standardSingleItemEstimate = weightKg * 4 * 40;
    const estimatedSavings = Math.max(0, standardSingleItemEstimate - totalPrice);

    return {
      totalPrice,
      effectiveRate,
      estimatedSavings,
    };
  }, [weightKg, selectedServiceId, slabs, currentService]);

  const handleAddWeightToCart = (kg: number) => {
    if (!currentService) return;
    
    const { totalPrice, effectiveRate } = calculatePriceForWeight(kg);
    const cartItemId = `bulk-${currentService.id}-${kg}kg`;

    addCartItem({
      id: cartItemId,
      serviceId: currentService.id,
      serviceName: `Bulk ${currentService.name} (${kg} KG)`,
      categoryName: 'Bulk Laundry',
      pricingModel: 'PER_KG',
      unitPrice: effectiveRate,
      quantity: kg,
      unit: 'KG',
      subtotal: totalPrice,
      clothId: 'bulk',
      imageUrl: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/banners/banner-4.jpg',
    });

    setJustAddedToast(`Added ${kg} KG ${currentService.name} (₹${totalPrice}) to your Bag!`);
    setTimeout(() => {
      setJustAddedToast(null);
    }, 3000);
  };

  return (
    <View style={styles.root}>
      {/* 1. TOP HEADER BAR */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressedBtn]}
          onPress={onBack}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
        </Pressable>

        <View style={styles.titleColumn}>
          <Text style={styles.topBarTitle}>Bulk Laundry (Pay by KG)</Text>
          <Text style={styles.topBarSubtitle}>
            Starting @ ₹{currentService.baseKgPrice || 55}/KG • Free Doorstep Pickup
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.cartBtn, pressed && styles.pressedBtn]}
          onPress={onViewCart}
          hitSlop={8}
          accessibilityLabel="Cart"
        >
          <MaterialCommunityIcons name="shopping-outline" size={22} color="#0F172A" />
          {cartSummary.itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartSummary.itemCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollFlex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 90 + Math.max(insets.bottom, 12) },
        ]}
      >
        {/* 2. CLEAN HERO BANNER (Removed cluttered text overlay as requested) */}
        <View style={styles.cleanHeroCard}>
          <Image
            source={{
              uri: heroImgError
                ? 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80'
                : 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/banners/banner-bulk.jpg',
            }}
            style={styles.cleanHeroImage}
            resizeMode="cover"
            onError={() => setHeroImgError(true)}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.65)']}
            style={styles.cleanHeroGradient}
          />
          <View style={styles.cleanHeroPill}>
            <MaterialCommunityIcons name="scale-bathroom" size={14} color="#FFFFFF" />
            <Text style={styles.cleanHeroPillText}>Premium Weight-Based Care</Text>
          </View>
        </View>

        {/* 3. SELECT LAUNDRY TREATMENT TYPE */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>1. Select Laundry Treatment</Text>

          <View style={styles.servicesGrid}>
            {servicesList.map((srv) => {
              const isSelected = srv.id === selectedServiceId;
              return (
                <Pressable
                  key={srv.id}
                  style={[
                    styles.serviceOptionCard,
                    isSelected && styles.serviceOptionCardSelected,
                  ]}
                  onPress={() => setSelectedServiceId(srv.id)}
                >
                  <View style={styles.serviceTopRow}>
                    <View
                      style={[
                        styles.serviceIconWrap,
                        isSelected && styles.serviceIconWrapSelected,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={srv.icon as any}
                        size={20}
                        color={isSelected ? '#FFFFFF' : '#FF6B0B'}
                      />
                    </View>
                    <View style={[styles.ratePill, isSelected && styles.ratePillSelected]}>
                      <Text style={[styles.ratePillText, isSelected && styles.ratePillTextSelected]}>
                        ₹{srv.baseKgPrice}/KG
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.serviceOptionTitle,
                      isSelected && styles.serviceOptionTitleSelected,
                    ]}
                  >
                    {srv.name}
                  </Text>
                  <Text style={styles.serviceOptionSubtitle} numberOfLines={2}>
                    {srv.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 4. CHOOSE WEIGHT BUNDLE */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderBetween}>
            <Text style={styles.sectionTitle}>2. Choose Weight Bundle</Text>
            <View style={styles.activeWeightBadge}>
              <Text style={styles.activeWeightBadgeText}>{weightKg} KG Selected</Text>
            </View>
          </View>

          {/* Preset Packs */}
          <View style={styles.presetsColumn}>
            {PRESET_WEIGHTS.map((item) => {
              const isChosen = weightKg === item.kg;
              const { totalPrice, effectiveRate } = calculatePriceForWeight(item.kg);

              return (
                <Pressable
                  key={item.kg}
                  style={[
                    styles.presetCardRow,
                    isChosen && styles.presetCardRowChosen,
                  ]}
                  onPress={() => setWeightKg(item.kg)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.presetTitleRow}>
                      <Text
                        style={[
                          styles.presetKgText,
                          isChosen && styles.presetKgTextChosen,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.tag && (
                        <View style={[styles.presetTagBadge, isChosen ? { backgroundColor: '#FFF7ED' } : {}]}>
                          <Text style={[styles.presetTagBadgeText, isChosen ? { color: '#FF6B0B' } : {}]}>
                            {item.tag}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.presetClothesText}>
                      {item.clothes}
                    </Text>

                    <View style={styles.presetPriceRow}>
                      <Text style={[styles.presetPriceTotal, isChosen && styles.presetPriceTotalChosen]}>
                        ₹{totalPrice}
                      </Text>
                      <Text style={styles.presetPricePerKg}>
                        (₹{effectiveRate}/KG)
                      </Text>
                    </View>
                  </View>

                  {/* Radio Selection Checkmark (Clean UI, not competing Add to Cart) */}
                  <View style={[styles.presetRadioWrap, isChosen && styles.presetRadioWrapChosen]}>
                    {isChosen ? (
                      <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                    ) : (
                      <View style={styles.presetRadioDot} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Custom Weight Stepper */}
          <View style={styles.customWeightBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.customWeightLabel}>Custom Load</Text>
              <Text style={styles.customWeightSub}>Minimum 1 KG • Digital scale at doorstep</Text>
            </View>

            <View style={styles.stepperWrap}>
              <Pressable
                style={[
                  styles.stepperButton,
                  weightKg <= 1 && styles.stepperButtonDisabled,
                ]}
                disabled={weightKg <= 1}
                onPress={() => setWeightKg((prev) => Math.max(1, prev - 1))}
              >
                <MaterialCommunityIcons
                  name="minus"
                  size={18}
                  color={weightKg <= 1 ? '#CBD5E1' : '#0F172A'}
                />
              </Pressable>

              <View style={styles.weightValueContainer}>
                <Text style={styles.weightValueText}>{weightKg}</Text>
                <Text style={styles.weightUnitText}>KG</Text>
              </View>

              <Pressable
                style={[
                  styles.stepperButton,
                  weightKg >= 40 && styles.stepperButtonDisabled,
                ]}
                disabled={weightKg >= 40}
                onPress={() => setWeightKg((prev) => Math.min(40, prev + 1))}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={18}
                  color={weightKg >= 40 ? '#CBD5E1' : '#0F172A'}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* 5. PACKAGE CALCULATION (Clean Breakdown, Removed Confusing Redundant In-Card Button) */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={styles.summaryHeading}>Package Calculation</Text>
              <Text style={styles.summarySub}>
                {currentService.name} • {weightKg} KG
              </Text>
            </View>
            <View style={styles.summaryPriceBox}>
              <Text style={styles.summaryPriceValue}>₹{pricingInfo.totalPrice}</Text>
              <Text style={styles.summaryPriceRate}>
                (₹{pricingInfo.effectiveRate}/KG)
              </Text>
            </View>
          </View>

          {pricingInfo.estimatedSavings > 0 && (
            <View style={styles.savingsBanner}>
              <MaterialCommunityIcons name="tag-heart-outline" size={16} color="#15803D" />
              <Text style={styles.savingsBannerText}>
                You save approx ₹{pricingInfo.estimatedSavings} compared to per-piece dry cleaning!
              </Text>
            </View>
          )}

          {/* Checklist */}
          <View style={styles.checklist}>
            <View style={styles.checkItem}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
              <Text style={styles.checkText}>Hygienic individual wash (zero mixing with other orders)</Text>
            </View>
            <View style={styles.checkItem}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
              <Text style={styles.checkText}>Anti-bacterial ozone disinfection & premium fabric softener</Text>
            </View>
            <View style={styles.checkItem}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
              <Text style={styles.checkText}>Warm tumble dry & crisp wrinkle-free folding</Text>
            </View>
            <View style={styles.checkItem}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
              <Text style={styles.checkText}>Sealed luxury protective garment bag packaging</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 6. TOAST NOTIFICATION */}
      {justAddedToast && (
        <View style={styles.toastWrap}>
          <View style={styles.toast}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
            <Text style={styles.toastText} numberOfLines={2}>
              {justAddedToast}
            </Text>
          </View>
        </View>
      )}

      {/* 7. SINGLE CLEAR STICKY ACTION BAR AT BOTTOM */}
      <View
        style={[
          styles.bottomFixedBar,
          { paddingBottom: Math.max(insets.bottom, 10) + 8 },
        ]}
      >
        <View style={styles.bottomPriceWrap}>
          <View style={styles.bottomTotalRow}>
            <Text style={styles.bottomPriceTitle}>₹{pricingInfo.totalPrice}</Text>
            <Text style={styles.bottomRateTag}>₹{pricingInfo.effectiveRate}/KG</Text>
          </View>
          <Text style={styles.bottomPriceSub} numberOfLines={1}>
            {weightKg} KG • {currentService.name}
          </Text>
        </View>

        <View style={styles.bottomButtonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.bottomAddBtnWrap,
              pressed && styles.pressedBtn,
            ]}
            onPress={() => handleAddWeightToCart(weightKg)}
          >
            <LinearGradient
              colors={['#FF7A00', '#FF5A00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bottomAddBtnGradient}
            >
              <MaterialCommunityIcons name="cart-plus" size={18} color="#FFFFFF" />
              <Text style={styles.addToCartText}>Add to Cart</Text>
            </LinearGradient>
          </Pressable>

          {cartSummary.itemCount > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.viewBagBtn,
                pressed && styles.pressedBtn,
              ]}
              onPress={onViewCart}
            >
              <Text style={styles.viewBagBtnText}>View Bag ({cartSummary.itemCount})</Text>
              <MaterialCommunityIcons name="arrow-right" size={15} color="#0F172A" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollFlex: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 18,
  },

  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cartBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: '#FF6B0B',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  pressedBtn: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  titleColumn: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  topBarSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },

  /* Clean Hero Card (No Text Clutter) */
  cleanHeroCard: {
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cleanHeroImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  cleanHeroGradient: {
    ...StyleSheet.absoluteFill,
  },
  cleanHeroPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  cleanHeroPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Sections */
  sectionWrap: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeWeightBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  activeWeightBadgeText: {
    color: '#FF6B0B',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Services Grid */
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceOptionCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  serviceOptionCardSelected: {
    borderColor: '#FF6B0B',
    backgroundColor: '#FFFBF8',
    shadowColor: '#FF6B0B',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  serviceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  serviceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconWrapSelected: {
    backgroundColor: '#FF6B0B',
  },
  ratePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratePillSelected: {
    backgroundColor: '#FFF7ED',
  },
  ratePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  ratePillTextSelected: {
    color: '#FF6B0B',
    fontWeight: '800',
  },
  serviceOptionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  serviceOptionTitleSelected: {
    color: '#FF6B0B',
  },
  serviceOptionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },

  /* Presets Column */
  presetsColumn: {
    gap: 10,
  },
  presetCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  presetCardRowChosen: {
    borderColor: '#FF6B0B',
    backgroundColor: '#FFFBF8',
    shadowColor: '#FF6B0B',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  presetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  presetKgText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  presetKgTextChosen: {
    color: '#0F172A',
    fontWeight: '800',
  },
  presetTagBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  presetTagBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
  },
  presetClothesText: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 6,
  },
  presetPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  presetPriceTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  presetPriceTotalChosen: {
    color: '#FF6B0B',
  },
  presetPricePerKg: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  presetRadioWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  presetRadioWrapChosen: {
    borderColor: '#FF6B0B',
    backgroundColor: '#FF6B0B',
  },
  presetRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },

  /* Custom Weight Box */
  customWeightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customWeightLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  customWeightSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    gap: 6,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  weightValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    minWidth: 44,
    justifyContent: 'center',
  },
  weightValueText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  weightUnitText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },

  /* Package Calculation Summary Card */
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  summaryHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  summarySub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  summaryPriceBox: {
    alignItems: 'flex-end',
  },
  summaryPriceValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FF6B0B',
  },
  summaryPriceRate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  savingsBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: '#15803D',
    fontWeight: '600',
    lineHeight: 16,
  },
  checklist: {
    gap: 8,
    paddingTop: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    flex: 1,
    fontSize: 11.5,
    color: '#334155',
    lineHeight: 16,
  },

  /* Toast */
  toastWrap: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  toast: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* Fixed Bottom Sticky Action Bar */
  bottomFixedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  bottomPriceWrap: {
    flex: 1,
    marginRight: 12,
  },
  bottomTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  bottomPriceTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  bottomRateTag: {
    fontSize: 11.5,
    color: '#FF6B0B',
    fontWeight: '700',
  },
  bottomPriceSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomAddBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF6B0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  bottomAddBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  viewBagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 4,
  },
  viewBagBtnText: {
    color: '#0F172A',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
