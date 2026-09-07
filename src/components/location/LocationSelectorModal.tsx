import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { api, type AddressSearchResult } from '@/lib/api';
import type { CustomerAddress } from '@/types/domain';
import type { CustomerLocation } from '@/services/location/types';

interface LocationSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  currentLocation: CustomerLocation | null;
  deliveryLocation: CustomerLocation | null;
  customerId?: string | null;
  onSelectLocation: (location: CustomerLocation) => void | Promise<void>;
  onUseCurrentGps: () => Promise<CustomerLocation | null>;
  onOpenMapPicker: () => void;
}

export function LocationSelectorModal({
  visible,
  onClose,
  currentLocation,
  deliveryLocation,
  customerId,
  onSelectLocation,
  onUseCurrentGps,
  onOpenMapPicker,
}: LocationSelectorModalProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AddressSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved addresses when modal opens
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    if (customerId) {
      setLoadingAddresses(true);
      api
        .getAddresses(customerId)
        .then((res) => {
          if (Array.isArray(res)) {
            setSavedAddresses(res);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingAddresses(false));
    }
  }, [visible, customerId]);

  // Debounced search handler
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const query = text.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await api.searchAddressSuggestions(query);
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const handleUseGps = async () => {
    try {
      setLocatingGps(true);
      const loc = await onUseCurrentGps();
      if (loc) {
        onClose();
      } else {
        Alert.alert(
          'Location Unavailable',
          'Could not retrieve current GPS position. Please check your location settings or choose on map.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Choose on Map', onPress: () => { onClose(); onOpenMapPicker(); } },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Unable to fetch current location.');
    } finally {
      setLocatingGps(false);
    }
  };

  const handleSelectSearchResult = (result: AddressSearchResult) => {
    const loc: CustomerLocation = {
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address || result.areaName || result.city,
      formattedAddress: result.formattedAddress || result.address,
      street: result.address,
      areaName: result.areaName,
      locality: result.areaName,
      city: result.city || 'Hyderabad',
      pincode: result.pincode,
      source: 'manual',
      isServiceable: result.isServiceable,
      serviceabilityMessage: result.message,
      updatedAt: new Date().toISOString(),
    };
    onSelectLocation(loc);
    onClose();
  };

  const handleSelectSavedAddress = (addr: CustomerAddress) => {
    const loc: CustomerLocation = {
      id: addr.id,
      tag: addr.type || 'Home',
      houseNo: addr.houseNo,
      landmark: addr.landmark,
      latitude: addr.latitude || 17.385,
      longitude: addr.longitude || 78.4867,
      address: [addr.houseNo, addr.street, addr.area].filter(Boolean).join(', ') || addr.street,
      formattedAddress: [addr.houseNo, addr.street, addr.area, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(', '),
      street: addr.street,
      areaName: addr.area || addr.city,
      locality: addr.area,
      city: addr.city || 'Hyderabad',
      pincode: addr.pincode,
      source: 'manual',
      isServiceable: true,
      updatedAt: new Date().toISOString(),
    };
    onSelectLocation(loc);
    onClose();
  };

  const handleDeleteSavedAddress = (addressId: string) => {
    if (!customerId) return;
    Alert.alert('Delete Address', 'Are you sure you want to remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAddress(customerId, addressId);
            setSavedAddresses((prev) => prev.filter((a) => a.id !== addressId));
          } catch {
            Alert.alert('Error', 'Could not delete address.');
          }
        },
      },
    ]);
  };

  const getTagIcon = (tag?: string) => {
    const t = (tag || '').toLowerCase();
    if (t.includes('home')) return 'home-outline';
    if (t.includes('work') || t.includes('office')) return 'briefcase-outline';
    return 'map-marker-outline';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close location selector"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
          </Pressable>
          <Text style={styles.headerTitle}>Select Delivery Location</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={22} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for area, street name, pincode..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => handleSearchChange('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* SEARCH RESULTS (IF ACTIVE QUERY) */}
          {searching && (
            <View style={styles.searchLoadingBox}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.searchLoadingText}>Searching areas & landmarks...</Text>
            </View>
          )}

          {searchResults.length > 0 ? (
            <View style={styles.resultsSection}>
              <Text style={styles.sectionLabel}>SEARCH RESULTS</Text>
              {searchResults.map((item, idx) => (
                <Pressable
                  key={`res-${idx}`}
                  style={({ pressed }) => [styles.searchResultItem, pressed && styles.itemPressed]}
                  onPress={() => handleSelectSearchResult(item)}
                >
                  <View style={styles.searchResultIconBox}>
                    <MaterialCommunityIcons name="map-marker-outline" size={20} color="#2563EB" />
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultTitle} numberOfLines={1}>
                      {item.areaName || item.address || item.city}
                    </Text>
                    <Text style={styles.searchResultSubtitle} numberOfLines={2}>
                      {item.formattedAddress || item.address}
                    </Text>
                    {item.pincode && (
                      <Text style={styles.pincodeBadge}>PIN: {item.pincode}</Text>
                    )}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* PRIMARY QUICK ACTIONS: USE CURRENT GPS & MAP PICKER */}
          <View style={styles.quickActionsCard}>
            {/* 1. Use Current Location (GPS) */}
            <Pressable
              style={({ pressed }) => [styles.quickActionRow, pressed && styles.itemPressed]}
              onPress={handleUseGps}
              disabled={locatingGps}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
                {locatingGps ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#2563EB" />
                )}
              </View>
              <View style={styles.actionInfo}>
                <View style={styles.actionTitleRow}>
                  <Text style={[styles.actionTitle, { color: '#2563EB' }]}>Use current location</Text>
                  <View style={styles.gpsBadge}>
                    <Text style={styles.gpsBadgeText}>Using GPS</Text>
                  </View>
                </View>
                <Text style={styles.actionSubtitle} numberOfLines={1}>
                  {locatingGps
                    ? 'Detecting your GPS position...'
                    : currentLocation?.areaName
                    ? `${currentLocation.areaName}${currentLocation.pincode ? ` - ${currentLocation.pincode}` : ''}`
                    : 'Tap to fetch high accuracy location'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#93C5FD" />
            </Pressable>

            <View style={styles.actionDivider} />

            {/* 2. Select Location on Map */}
            <Pressable
              style={({ pressed }) => [styles.quickActionRow, pressed && styles.itemPressed]}
              onPress={() => {
                onClose();
                onOpenMapPicker();
              }}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FFF7ED' }]}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color="#EA580C" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Select location on map</Text>
                <Text style={styles.actionSubtitle}>Drag and adjust pin on interactive map</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FED7AA" />
            </Pressable>
          </View>

          {/* SAVED ADDRESSES SECTION */}
          <View style={styles.savedSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
              <Pressable
                style={styles.addNewAddressBtn}
                onPress={() => {
                  onClose();
                  onOpenMapPicker();
                }}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#2563EB" />
                <Text style={styles.addNewAddressText}>Add New</Text>
              </Pressable>
            </View>

            {loadingAddresses ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loadingText}>Loading saved addresses...</Text>
              </View>
            ) : savedAddresses.length > 0 ? (
              <View style={styles.savedList}>
                {savedAddresses.map((addr) => {
                  const isSelected = deliveryLocation?.id === addr.id || (deliveryLocation?.pincode === addr.pincode && deliveryLocation?.street === addr.street);
                  return (
                    <Pressable
                      key={addr.id}
                      style={({ pressed }) => [
                        styles.savedAddressCard,
                        isSelected && styles.savedAddressSelected,
                        pressed && styles.itemPressed,
                      ]}
                      onPress={() => handleSelectSavedAddress(addr)}
                    >
                      <View style={styles.savedAddressTop}>
                        <View style={styles.savedTagCluster}>
                          <MaterialCommunityIcons
                            name={getTagIcon(addr.type) as any}
                            size={18}
                            color={isSelected ? '#2563EB' : '#475569'}
                          />
                          <Text style={[styles.savedTagText, isSelected && { color: '#2563EB' }]}>
                            {addr.type || 'Address'}
                          </Text>
                          {isSelected && (
                            <View style={styles.selectedPill}>
                              <Text style={styles.selectedPillText}>ACTIVE</Text>
                            </View>
                          )}
                        </View>
                        <Pressable
                          onPress={() => handleDeleteSavedAddress(addr.id)}
                          hitSlop={8}
                          accessibilityLabel="Delete address"
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color="#94A3B8" />
                        </Pressable>
                      </View>

                      <Text style={styles.savedAddressLine} numberOfLines={2}>
                        {[addr.houseNo, addr.street, addr.area, addr.landmark].filter(Boolean).join(', ')}
                      </Text>
                      <Text style={styles.savedAddressCity}>
                        {[addr.city, addr.pincode].filter(Boolean).join(' - ')}
                      </Text>

                      <View style={styles.deliverHereRow}>
                        <Text style={[styles.deliverHereText, isSelected && { color: '#2563EB', fontWeight: '800' }]}>
                          {isSelected ? '✓ Delivering here' : 'Deliver to this address →'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptySavedBox}>
                <MaterialCommunityIcons name="map-marker-plus-outline" size={36} color="#CBD5E1" />
                <Text style={styles.emptySavedTitle}>No saved addresses yet</Text>
                <Text style={styles.emptySavedDesc}>
                  Save your home, office, or frequently used addresses for 1-tap checkout.
                </Text>
                <Pressable
                  style={styles.addFirstAddressBtn}
                  onPress={() => {
                    onClose();
                    onOpenMapPicker();
                  }}
                >
                  <Text style={styles.addFirstAddressText}>+ Add an Address</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    paddingBottom: 40,
  },
  searchLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  searchLoadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  resultsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  searchResultInfo: {
    flex: 1,
    marginRight: 8,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  searchResultSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  pincodeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 2,
  },
  itemPressed: {
    opacity: 0.7,
  },
  quickActionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  gpsBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  gpsBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563EB',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  savedSection: {
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addNewAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  addNewAddressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  savedList: {
    gap: 12,
  },
  savedAddressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  savedAddressSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFF',
    borderWidth: 1.5,
  },
  savedAddressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  savedTagCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedTagText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  selectedPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
  },
  savedAddressLine: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 2,
  },
  savedAddressCity: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  deliverHereRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  deliverHereText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  emptySavedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptySavedTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 4,
  },
  emptySavedDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
  },
  addFirstAddressBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addFirstAddressText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
});
