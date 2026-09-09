import React, { useState, useCallback, useMemo } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '@/context/AppContext';
import { getGarmentImageUrl } from '@/lib/garment-photos';

interface WishlistScreenProps {
  onBook: () => void;
  onExploreServices: () => void;
}

export function WishlistScreen({ onBook, onExploreServices }: WishlistScreenProps) {
  const {
    wishlist,
    toggleWishlist,
    addCartItem,
    cart,
    setCartQuantity,
    removeFromCart,
    catalog,
    refreshCatalog,
  } = useApp();

  const [notification, setNotification] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof refreshCatalog === 'function') {
        await refreshCatalog();
      }
    } catch (error) {
      console.error('[WishlistScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshCatalog]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  // 1. Safely normalize wishlist into clean string IDs
  const safeWishlist: string[] = useMemo(() => {
    if (!Array.isArray(wishlist)) return [];
    return wishlist
      .map((item: any) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return String(item.id || item.clothId || '').trim();
        }
        return '';
      })
      .filter((id): id is string => Boolean(id && id.length > 0));
  }, [wishlist]);

  // 2. Safe mapping of wishlist items against catalog
  const wishlistItems = useMemo(() => {
    try {
      return safeWishlist
        .map((id) => {
          if (!id || typeof id !== 'string') return null;

          const cloth = catalog?.clothTypes?.find((c) => c && String(c.id) === String(id));
          if (cloth) {
            const prices = Array.isArray(catalog?.priceMatrix)
              ? catalog.priceMatrix.filter(
                  (p) => p && String(p.clothTypeId) === String(cloth.id) && p.isActive
                )
              : [];

            const primaryPrice =
              prices.find(
                (p) =>
                  p?.serviceName &&
                  typeof p.serviceName === 'string' &&
                  p.serviceName.toLowerCase().includes('dry clean')
              ) || prices[0];

            const clothImg =
              cloth.imageUrl ||
              getGarmentImageUrl(cloth.id, undefined, cloth.categoryTag);

            return {
              id: String(cloth.id),
              name: String(cloth.name || 'Garment Item'),
              category: String(cloth.categoryLabel || cloth.categoryTag || 'Fabric Care'),
              serviceType: String(primaryPrice?.serviceName || 'Standard Care'),
              serviceId: String(primaryPrice?.serviceId || ''),
              tat: `${primaryPrice?.turnaroundHours || 24}H`,
              price: Number(primaryPrice?.price || 0),
              unit: 'pc',
              imageUrl: clothImg,
            };
          }

          // Fallback if cloth not in current catalog
          const cleanName = id.replace('cloth-', '').replace(/-/g, ' ').toUpperCase();
          return {
            id: String(id),
            name: cleanName || 'Garment Item',
            category: 'Fabric Care',
            serviceType: 'Standard Care',
            serviceId: '',
            tat: '24H',
            price: 0,
            unit: 'pc',
            imageUrl: getGarmentImageUrl(id),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } catch (err) {
      console.error('[WishlistScreen] Error mapping wishlist items:', err);
      return [];
    }
  }, [safeWishlist, catalog?.clothTypes, catalog?.priceMatrix]);

  const handleRemoveFromWishlist = (id: string, name: string) => {
    if (typeof toggleWishlist === 'function') {
      toggleWishlist(id);
    }
    showToast(`Removed "${name}" from Wishlist`);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Wishlist',
      'Are you sure you want to remove all saved items from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            if (typeof toggleWishlist === 'function') {
              [...safeWishlist].forEach((id) => toggleWishlist(id));
            }
            showToast('Wishlist cleared');
          },
        },
      ]
    );
  };

  const handleAddToCart = (item: any) => {
    const cartItemId = `${item.id}-${item.serviceId || 'default'}`;
    if (typeof addCartItem === 'function') {
      addCartItem({
        id: cartItemId,
        serviceId: item.serviceId || '',
        serviceName: `${item.name} (${item.serviceType})`,
        categoryName: item.category,
        pricingModel: item.unit === 'kg' ? 'PER_KG' : 'PER_ITEM',
        unitPrice: item.price,
        quantity: 1,
        unit: item.unit === 'kg' ? 'KG' : 'Piece',
        subtotal: item.price,
        clothId: item.id,
        imageUrl: item.imageUrl,
      });
      showToast(`Added ${item.name} to Bag! 🛍️`);
    }
  };

  const handleAddAllToCart = () => {
    if (wishlistItems.length === 0) return;
    if (typeof addCartItem === 'function') {
      wishlistItems.forEach((item) => {
        const cartItemId = `${item.id}-${item.serviceId || 'default'}`;
        addCartItem({
          id: cartItemId,
          serviceId: item.serviceId || '',
          serviceName: `${item.name} (${item.serviceType})`,
          categoryName: item.category,
          pricingModel: item.unit === 'kg' ? 'PER_KG' : 'PER_ITEM',
          unitPrice: item.price,
          quantity: 1,
          unit: item.unit === 'kg' ? 'KG' : 'Piece',
          subtotal: item.price,
          clothId: item.id,
          imageUrl: item.imageUrl,
        });
      });
    }
    if (typeof onBook === 'function') {
      onBook();
    }
  };

  if (wishlistItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <MaterialCommunityIcons name="heart-outline" size={56} color="#16A34A" />
        </View>
        <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Save garments, ethnic wear, and household linen you plan to wash or dry clean. Tap the heart icon on any item to save it here!
        </Text>
        <Pressable
          style={styles.exploreBtn}
          onPress={() => {
            if (typeof onExploreServices === 'function') {
              onExploreServices();
            }
          }}
        >
          <LinearGradient
            colors={['#16A34A', '#10B981']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.exploreBtnGradient}
          >
            <MaterialCommunityIcons name="hanger" size={18} color="#FFFFFF" />
            <Text style={styles.exploreBtnText}>Explore Garment Catalog</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Dynamic Toast Feedback */}
      {notification && (
        <View style={styles.toastBanner}>
          <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
          <Text style={styles.toastText} numberOfLines={1}>{notification}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#0F766E', '#16A34A']}
            tintColor="#0F766E"
          />
        }
      >
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>My Wishlist</Text>
            <Text style={styles.headerSubtitle}>
              {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved for care
            </Text>
          </View>
          <Pressable style={styles.clearAllBtn} onPress={handleClearAll} hitSlop={8}>
            <MaterialCommunityIcons name="trash-can-outline" size={15} color="#EF4444" />
            <Text style={styles.clearAllText}>Clear All</Text>
          </Pressable>
        </View>

        {/* Wishlist Cards Stack */}
        <View style={styles.list}>
          {wishlistItems.map((item) => {
            const directId = `${item.id}-${item.serviceId || 'default'}`;
            const foundInCart = Array.isArray(cart)
              ? cart.find(
                  (c) =>
                    c &&
                    (c.id === directId ||
                      c.clothId === item.id ||
                      (typeof c.id === 'string' &&
                        typeof item.id === 'string' &&
                        item.id.length > 0 &&
                        c.id.includes(item.id)))
                )
              : undefined;
            const cartQty = foundInCart ? foundInCart.quantity : 0;
            const isImageFailed = failedImages[item.id];

            return (
              <View key={item.id} style={styles.card}>
                {/* Left Photo */}
                <View style={styles.imageContainer}>
                  {item.imageUrl && !isImageFailed ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                      onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
                    />
                  ) : (
                    <View style={styles.imageFallback}>
                      <MaterialCommunityIcons name="hanger" size={32} color="#CBD5E1" />
                    </View>
                  )}
                  <View style={styles.tatBadge}>
                    <MaterialCommunityIcons name="clock-fast" size={10} color="#FFFFFF" />
                    <Text style={styles.tatBadgeText}>{item.tat}</Text>
                  </View>
                </View>

                {/* Right Details */}
                <View style={styles.details}>
                  <View>
                    <View style={styles.catRow}>
                      <Text style={styles.category} numberOfLines={1}>
                        {item.category}
                      </Text>
                    </View>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.serviceType} numberOfLines={1}>
                      {item.serviceType}
                    </Text>
                  </View>

                  {/* Price and Actions */}
                  <View style={styles.bottomRow}>
                    <View style={styles.priceWrap}>
                      <Text style={styles.price}>₹{item.price}</Text>
                      <Text style={styles.unit}>/{item.unit}</Text>
                    </View>

                    <View style={styles.actions}>
                      {/* Explicit REMOVE Button */}
                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => handleRemoveFromWishlist(item.id, item.name)}
                        hitSlop={8}
                        accessibilityLabel="Remove from Wishlist"
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={15} color="#EF4444" />
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </Pressable>

                      {/* Add to Bag OR Stepper */}
                      {cartQty > 0 && foundInCart ? (
                        <View style={styles.stepperContainer}>
                          <Pressable
                            style={styles.stepperBtn}
                            onPress={() => {
                              if (foundInCart.quantity <= 1) {
                                if (typeof removeFromCart === 'function') {
                                  removeFromCart(foundInCart.id);
                                }
                                showToast(`Removed "${item.name}" from Bag`);
                              } else {
                                if (typeof setCartQuantity === 'function') {
                                  setCartQuantity(foundInCart.id, foundInCart.quantity - 1);
                                }
                              }
                            }}
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons name="minus" size={13} color="#FFFFFF" />
                          </Pressable>
                          <Text style={styles.stepperCountText}>{cartQty}</Text>
                          <Pressable
                            style={styles.stepperBtn}
                            onPress={() => {
                              if (typeof setCartQuantity === 'function') {
                                setCartQuantity(foundInCart.id, foundInCart.quantity + 1);
                              }
                            }}
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons name="plus" size={13} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable style={styles.addBtn} onPress={() => handleAddToCart(item)}>
                          <LinearGradient
                            colors={['#10B981', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.addBtnGradient}
                          >
                            <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
                            <Text style={styles.addBtnText}>Add</Text>
                          </LinearGradient>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarInfo}>
          <Text style={styles.bottomBarCount}>{wishlistItems.length} Saved {wishlistItems.length === 1 ? 'Item' : 'Items'}</Text>
          <Text style={styles.bottomBarNote}>Doorstep pickup & expert fabric care</Text>
        </View>
        <View style={styles.bottomBarButtons}>
          <Pressable style={styles.addAllBtn} onPress={handleAddAllToCart}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addAllBtnGradient}
            >
              <MaterialCommunityIcons name="basket-plus" size={16} color="#FFFFFF" />
              <Text style={styles.addAllBtnText}>Add All to Bag</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FCF9F7',
  },
  toastBanner: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 99,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,  // No top padding - header provides spacing
    paddingBottom: 120,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#FCF9F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C0B18',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8A7A84',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: 24,
  },
  exploreBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  exploreBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 8,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C0B18',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8A7A84',
    marginTop: 2,
    fontWeight: '600',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3E8DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  imageContainer: {
    width: 115,
    height: 125,
    position: 'relative',
    backgroundColor: '#F3E8DF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tatBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 11, 24, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 3,
  },
  tatBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  details: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  category: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  name: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C0B18',
    marginTop: 2,
  },
  serviceType: {
    fontSize: 12,
    color: '#8A7A84',
    marginTop: 1,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1C0B18',
  },
  unit: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A7A84',
    marginLeft: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    gap: 4,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  addBtn: {
    borderRadius: 9,
    overflow: 'hidden',
  },
  addBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 3,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 9,
    paddingHorizontal: 3,
    paddingVertical: 2,
    height: 30,
    gap: 6,
  },
  stepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCountText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 16,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3E8DF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  bottomBarInfo: {
    flex: 1,
  },
  bottomBarCount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C0B18',
  },
  bottomBarNote: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 1,
    fontWeight: '600',
  },
  bottomBarButtons: {
    marginLeft: 12,
  },
  addAllBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addAllBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    gap: 6,
  },
  addAllBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
