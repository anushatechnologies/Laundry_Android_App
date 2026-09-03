import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { COLORS, money } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MiniBagDrawerProps {
  visible: boolean;
  onClose: () => void;
  onProceed: () => void;
}

export function MiniBagDrawer({ visible, onClose, onProceed }: MiniBagDrawerProps) {
  const { cart, cartSummary, setCartQuantity, removeFromCart } = useApp();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[
            styles.drawerContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Top Drag Indicator */}
          <View style={styles.dragPillWrap}>
            <View style={styles.dragPill} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.bagIconWrap}>
                <MaterialCommunityIcons name="shopping" size={20} color="#F97316" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Your Laundry Bag</Text>
                <Text style={styles.headerSubtitle}>
                  {cartSummary.itemCount} item{cartSummary.itemCount === 1 ? '' : 's'} selected for care
                </Text>
              </View>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={20} color="#1C0B18" />
            </Pressable>
          </View>

          {/* Promise Banner */}
          <View style={styles.promiseBanner}>
            <View style={styles.promiseItem}>
              <MaterialCommunityIcons name="lightning-bolt" size={14} color="#EA580C" />
              <Text style={styles.promiseText}>24H-48H Turnaround</Text>
            </View>
            <View style={styles.promiseDivider} />
            <View style={styles.promiseItem}>
              <MaterialCommunityIcons name="shield-check" size={14} color="#16A34A" />
              <Text style={styles.promiseText}>100% Free Re-wash</Text>
            </View>
            <View style={styles.promiseDivider} />
            <View style={styles.promiseItem}>
              <MaterialCommunityIcons name="truck-check" size={14} color="#3B82F6" />
              <Text style={styles.promiseText}>Free Doorstep Pickup</Text>
            </View>
          </View>

          {/* Items List */}
          <ScrollView
            style={styles.itemsScroll}
            contentContainerStyle={styles.itemsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <MaterialCommunityIcons name="bag-personal-outline" size={48} color="#D6B36A" />
                <Text style={styles.emptyCartText}>Your bag is empty</Text>
                <Text style={styles.emptyCartSub}>Add garments or bulk laundry packs to get started.</Text>
              </View>
            ) : (
              cart.map((item) => {
                const isBulk = item.pricingModel === 'PER_KG' || item.clothId === 'bulk' || item.id.startsWith('bulk');
                let rawClothId = item.clothId;
                if (!rawClothId) {
                  if (item.id.includes('-srv-')) {
                    rawClothId = item.id.split('-srv-')[0];
                  } else if (item.id.startsWith('cloth-')) {
                    const parts = item.id.split('-');
                    rawClothId = `${parts[0]}-${parts[1]}`;
                  } else {
                    rawClothId = item.id;
                  }
                }
                const imageUrl = item.imageUrl || (isBulk ? 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/services/service_wash_fold.jpg' : getGarmentImageUrl(rawClothId || 'cloth-shirt'));

                return (
                  <View key={item.id} style={styles.itemRow}>
                    {/* Image / Icon */}
                    <View style={styles.itemThumbWrap}>
                      <Image source={{ uri: imageUrl }} style={styles.itemImage} resizeMode="cover" />
                    </View>

                    {/* Details */}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.serviceName}
                      </Text>
                      <Text style={styles.itemMeta}>
                        ₹{item.unitPrice}/{item.unit || (isBulk ? 'KG' : 'Piece')}
                      </Text>
                    </View>

                    {/* Stepper */}
                    <View style={styles.stepperContainer}>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => {
                          if (isBulk && item.quantity <= 3) {
                            removeFromCart(item.id);
                          } else if (item.quantity <= 1) {
                            removeFromCart(item.id);
                          } else {
                            setCartQuantity(item.id, item.quantity - 1);
                          }
                        }}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons name="minus" size={14} color="#FFFFFF" />
                      </Pressable>

                      <Text style={styles.stepperQtyText}>
                        {item.quantity}{isBulk ? 'kg' : ''}
                      </Text>

                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => setCartQuantity(item.id, item.quantity + 1)}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>

                    {/* Subtotal */}
                    <Text style={styles.itemSubtotal}>{money(item.subtotal)}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer Bill & CTA */}
          {cartSummary.itemCount > 0 && (
            <View style={styles.footer}>
              {/* Bill Summary */}
              <View style={styles.billBox}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Bag Subtotal</Text>
                  <Text style={styles.billVal}>{money(cartSummary.itemTotal)}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Doorstep Pickup & Delivery</Text>
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>FREE</Text>
                  </View>
                </View>
                <View style={styles.billDivider} />
                <View style={styles.billRow}>
                  <Text style={styles.billTotalLabel}>Estimated Total</Text>
                  <Text style={styles.billTotalVal}>{money(cartSummary.itemTotal)}</Text>
                </View>
              </View>

              {/* Checkout Button */}
              <Pressable
                style={styles.proceedBtn}
                onPress={() => {
                  onClose();
                  onProceed();
                }}
              >
                <Text style={styles.proceedBtnText}>Proceed to Schedule Pickup</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.82,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  dragPillWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragPill: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5DCD5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F3E8DF',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bagIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1C0B18',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8A7A84',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7F2EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promiseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FAF5EF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#F3E8DF',
  },
  promiseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promiseText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4A3B45',
  },
  promiseDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#E5DCD5',
  },
  itemsScroll: {
    maxHeight: 280,
  },
  itemsScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyCartText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C0B18',
    marginTop: 4,
  },
  emptyCartSub: {
    fontSize: 12,
    color: '#8A7A84',
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCF9F7',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
  },
  itemThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FAF5EF',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  bulkThumb: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  itemMeta: {
    fontSize: 11,
    color: '#8A7A84',
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
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 16,
    textAlign: 'center',
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1C0B18',
    minWidth: 50,
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#F3E8DF',
    gap: 12,
  },
  billBox: {
    backgroundColor: '#FAF5EF',
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 12,
    color: '#8A7A84',
  },
  billVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
  },
  freeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#16A34A',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#E5DCD5',
    marginVertical: 2,
  },
  billTotalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
  },
  billTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F97316',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  proceedBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
