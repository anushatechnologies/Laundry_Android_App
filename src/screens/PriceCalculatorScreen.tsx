import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { Card } from '@/ui/components';
import { COLORS, money } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';

interface PriceCalculatorScreenProps {
  onBook: () => void;
}

interface CalcItem {
  id: string;
  name: string;
  category: string;
  serviceName: string;
  unitPrice: number;
  unit: string;
  isBulk?: boolean;
  qty: number;
}

const INITIAL_CALC_ITEMS: CalcItem[] = [
  {
    id: 'cloth-shirt',
    name: 'Cotton & Formal Shirts',
    category: 'MENS',
    serviceName: 'Steam Press & Fold',
    unitPrice: 99,
    unit: 'Piece',
    qty: 3,
  },
  {
    id: 'cloth-trousers',
    name: 'Trousers & Chinos',
    category: 'MENS',
    serviceName: 'Steam Press & Fold',
    unitPrice: 99,
    unit: 'Piece',
    qty: 2,
  },
  {
    id: 'cloth-saree-silk',
    name: 'Kanchipuram Silk Saree',
    category: 'WOMENS',
    serviceName: 'Zero-Bleed Silk Spa',
    unitPrice: 189,
    unit: 'Piece',
    qty: 1,
  },
  {
    id: 'cloth-suit-3p',
    name: 'Suit 3-Piece (Jacket+Vest+Trouser)',
    category: 'MENS',
    serviceName: 'Executive Dry Clean',
    unitPrice: 349,
    unit: 'Set',
    qty: 1,
  },
  {
    id: 'cloth-blanket-d',
    name: 'Double Mink Blanket / Razai',
    category: 'HOME_TEXTILES',
    serviceName: 'Anti-Allergen Thermal Wash',
    unitPrice: 179,
    unit: 'Piece',
    qty: 0,
  },
  {
    id: 'bulk-wash-fold',
    name: 'Daily Wash & Steam Press (Per KG)',
    category: 'BULK',
    serviceName: 'Bulk Laundry Care',
    unitPrice: 79,
    unit: 'KG',
    isBulk: true,
    qty: 0,
  },
];

export function PriceCalculatorScreen({ onBook }: PriceCalculatorScreenProps) {
  const { addCartItem } = useApp();
  const [items, setItems] = useState<CalcItem[]>(INITIAL_CALC_ITEMS);

  const updateQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextQty = Math.max(0, item.qty + delta);
        return { ...item, qty: nextQty };
      })
    );
  };

  const totalItemsCount = items.reduce((acc, curr) => acc + curr.qty, 0);
  const estimatedSubtotal = items.reduce((acc, curr) => acc + curr.qty * curr.unitPrice, 0);
  const retailEstimate = Math.round(estimatedSubtotal * 1.38);
  const savings = Math.max(0, retailEstimate - estimatedSubtotal);

  const handleAddAllToBag = () => {
    const selectedItems = items.filter((i) => i.qty > 0);
    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least 1 item to calculate and book.');
      return;
    }

    selectedItems.forEach((item) => {
      addCartItem({
        id: `calc-${item.id}-${Date.now()}`,
        serviceId: item.id,
        serviceName: `${item.name} (${item.serviceName})`,
        categoryName: item.category,
        pricingModel: item.isBulk ? 'PER_KG' : 'PER_ITEM',
        unitPrice: item.unitPrice,
        quantity: item.qty,
        unit: item.unit,
        subtotal: item.qty * item.unitPrice,
      });
    });

    Alert.alert(
      'Added to Laundry Bag! 🛍️',
      `${totalItemsCount} items have been added with estimated subtotal of ${money(estimatedSubtotal)}.`,
      [{ text: 'Proceed to Schedule', onPress: onBook }]
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Hero Banner */}
        <View style={styles.heroBanner}>
          <MaterialCommunityIcons name="calculator-variant-outline" size={32} color="#D6B36A" />
          <Text style={styles.heroTitle}>Interactive Price Estimator</Text>
          <Text style={styles.heroSubtitle}>
            Select your weekly garments to calculate doorstep rates & see how much you save.
          </Text>
        </View>

        {/* Live Estimate Card */}
        <Card style={styles.estimateCard}>
          <View style={styles.estimateTopRow}>
            <View>
              <Text style={styles.estimateLabel}>ESTIMATED TOTAL ({totalItemsCount} ITEMS)</Text>
              <Text style={styles.estimateAmount}>{money(estimatedSubtotal)}</Text>
            </View>
            <View style={styles.savingsBadge}>
              <MaterialCommunityIcons name="tag-outline" size={14} color="#16A34A" />
              <Text style={styles.savingsBadgeText}>Save ₹{savings}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.estimateBottomRow}>
            <View style={styles.comparisonCol}>
              <Text style={styles.compLabel}>Traditional Dry Cleaners</Text>
              <Text style={styles.compOldPrice}>{money(retailEstimate)}</Text>
            </View>
            <View style={styles.comparisonCol}>
              <Text style={styles.compLabel}>Doorstep Delivery</Text>
              <Text style={styles.compFreeText}>FREE</Text>
            </View>
          </View>
        </Card>

        {/* Garments List with Steppers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Garments & Quantities</Text>

          <View style={styles.itemsStack}>
            {items.map((item) => {
              const imageUrl = getGarmentImageUrl(item.id);
              return (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.itemThumbWrap}>
                    {item.isBulk ? (
                      <MaterialCommunityIcons name="scale-bathroom" size={24} color="#F97316" />
                    ) : (
                      <Image source={{ uri: imageUrl }} style={styles.itemThumb} resizeMode="cover" />
                    )}
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemService}>{item.serviceName}</Text>
                    <Text style={styles.itemRate}>
                      ₹{item.unitPrice} / {item.unit}
                    </Text>
                  </View>

                  {/* Stepper */}
                  <View style={styles.stepperContainer}>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => updateQty(item.id, -1)}
                      hitSlop={8}
                    >
                      <MaterialCommunityIcons name="minus" size={14} color="#FFFFFF" />
                    </Pressable>

                    <Text style={styles.stepperCount}>{item.qty}</Text>

                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => updateQty(item.id, 1)}
                      hitSlop={8}
                    >
                      <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action */}
      <View style={styles.stickyFooter}>
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerPriceLabel}>Total Estimated</Text>
          <Text style={styles.footerPriceVal}>{money(estimatedSubtotal)}</Text>
        </View>

        <Pressable
          style={[styles.footerBtn, estimatedSubtotal === 0 && { opacity: 0.5 }]}
          onPress={handleAddAllToBag}
          disabled={estimatedSubtotal === 0}
        >
          <MaterialCommunityIcons name="basket-plus" size={18} color="#FFFFFF" />
          <Text style={styles.footerBtnText}>Add All & Schedule Pickup</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FCF9F7',
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 110,
    gap: 16,
  },
  heroBanner: {
    backgroundColor: '#1C0B18',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#D6B36A',
    textAlign: 'center',
    lineHeight: 19,
  },
  estimateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
  },
  estimateTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  estimateLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8A7A84',
    letterSpacing: 0.8,
  },
  estimateAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1C0B18',
    marginTop: 2,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  savingsBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#16A34A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3E8DF',
  },
  estimateBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  comparisonCol: {
    gap: 2,
  },
  compLabel: {
    fontSize: 10,
    color: '#8A7A84',
  },
  compOldPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
    textDecorationLine: 'line-through',
  },
  compFreeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#16A34A',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
    letterSpacing: -0.2,
  },
  itemsStack: {
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 12,
  },
  itemThumbWrap: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#FAF5EF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemThumb: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  itemService: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 1,
  },
  itemRate: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F97316',
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
  },
  stepperBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 16,
    textAlign: 'center',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F3E8DF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  footerPriceCol: {
    justifyContent: 'center',
  },
  footerPriceLabel: {
    fontSize: 10,
    color: '#8A7A84',
  },
  footerPriceVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F97316',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 6,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
