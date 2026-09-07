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
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type AddressSearchResult } from '@/lib/api';
import { openLocationSettings } from '@/services/location/locationService';
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
          'Could not retrieve current GPS position. Please check your device location settings or choose on map.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void openLocationSettings() },
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
        {/* Top Modern Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close location selector"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Select Delivery Location</Text>
            <Text style={styles.headerSubtitle}>Choose doorstep address or pinpoint on map</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* Modern Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={22} color="#EA580C" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search area, apartment, street name or PIN..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
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
              <ActivityIndicator size="small" color="#EA580C" />
              <Text style={styles.searchLoadingText}>Searching areas & landmarks...</Text>
            </View>
          )}

          {searchResults.length > 0 ? (
            <View style={styles.resultsSection}>
              <Text style={styles.sectionLabel}>SEARCH RESULTS</Text>
              {searchResults.map((item, idx) => (
                <TouchableOpacity
                  key={`res-${idx}`}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectSearchResult(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.searchResultIconBox}>
                    <MaterialCommunityIcons name="map-marker-outline" size={20} color="#EA580C" />
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
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* PRIMARY QUICK ACTIONS: USE CURRENT GPS & MAP PICKER */}
          <View style={styles.quickActionsCard}>
            {/* 1. Use Current Location (GPS) */}
            <TouchableOpacity
              style={styles.quickActionRow}
              onPress={handleUseGps}
              disabled={locatingGps}
              activeOpacity={0.7}
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
                    <View style={styles.gpsPulseDot} />
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
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            {/* 2. Select Location on Map */}
            <TouchableOpacity
              style={styles.quickActionRow}
              onPress={() => {
                onClose();
                onOpenMapPicker();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FFF7ED' }]}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color="#EA580C" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Select location on map</Text>
                <Text style={styles.actionSubtitle}>Drag and adjust pin on interactive map</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FED7AA" />
            </TouchableOpacity>
          </View>

          {/* SAVED ADDRESSES SECTION */}
          <View style={styles.savedSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
                {savedAddresses.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{savedAddresses.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.addNewAddressBtn}
                onPress={() => {
                  onClose();
                  onOpenMapPicker();
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus-circle" size={16} color="#EA580C" />
                <Text style={styles.addNewAddressText}>Add New</Text>
              </TouchableOpacity>
            </View>

            {loadingAddresses ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#EA580C" />
                <Text style={styles.loadingText}>Loading saved addresses...</Text>
              </View>
            ) : savedAddresses.length > 0 ? (
              <View style={styles.savedList}>
                {savedAddresses.map((addr) => {
                  const isSelected = deliveryLocation?.id === addr.id || (deliveryLocation?.pincode === addr.pincode && deliveryLocation?.street === addr.street);
                  const isHome = (addr.type || '').toLowerCase().includes('home');
                  const isWork = (addr.type || '').toLowerCase().includes('work') || (addr.type || '').toLowerCase().includes('office');
                  const tagBg = isHome ? '#FFF7ED' : isWork ? '#EFF6FF' : '#F1F5F9';
                  const tagColor = isHome ? '#EA580C' : isWork ? '#2563EB' : '#475569';
                  const tagIcon = isHome ? 'home' : isWork ? 'briefcase' : 'map-marker';

                  const primaryLine = [addr.houseNo, addr.street].filter(Boolean).join(', ') || addr.street;
                  const secondaryLine = [addr.area, addr.landmark].filter(Boolean).join(', ');
                  const cityPinLine = [addr.city, addr.pincode].filter(Boolean).join(' - ');

                  return (
                    <TouchableOpacity
                      key={addr.id}
                      activeOpacity={0.88}
                      style={[
                        styles.savedAddressCard,
                        isSelected && styles.savedAddressSelected,
                      ]}
                      onPress={() => handleSelectSavedAddress(addr)}
                    >
                      <View style={styles.savedAddressTop}>
                        <View style={styles.savedTagCluster}>
                          <View style={[styles.tagBadge, { backgroundColor: tagBg }]}>
                            <MaterialCommunityIcons
                              name={tagIcon as any}
                              size={15}
                              color={tagColor}
                            />
                            <Text style={[styles.savedTagText, { color: tagColor }]}>
                              {(addr.type || 'HOME').toUpperCase()}
                            </Text>
                          </View>
                          {isSelected && (
                            <View style={styles.selectedPill}>
                              <MaterialCommunityIcons name="check-circle" size={12} color="#16A34A" />
                              <Text style={styles.selectedPillText}>CURRENTLY SELECTED</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDeleteSavedAddress(addr.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Delete address"
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={17} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>

                      {/* Primary Street / Building Line */}
                      <Text style={styles.savedAddressPrimary} numberOfLines={1}>
                        {primaryLine}
                      </Text>

                      {/* Secondary Landmark / Area */}
                      {secondaryLine ? (
                        <Text style={styles.savedAddressSecondary} numberOfLines={2}>
                          {secondaryLine}
                        </Text>
                      ) : null}

                      {/* City & PIN */}
                      <Text style={styles.savedAddressCity}>
                        {cityPinLine}
                      </Text>

                      {/* Bottom Action Button */}
                      <View style={styles.deliverHereRow}>
                        <View style={[
                          styles.deliverActionBtn,
                          isSelected ? styles.deliverActionBtnActive : styles.deliverActionBtnDefault
                        ]}>
                          <MaterialCommunityIcons
                            name={isSelected ? "check-circle" : "truck-delivery-outline"}
                            size={16}
                            color={isSelected ? "#16A34A" : "#EA580C"}
                          />
                          <Text style={[
                            styles.deliverHereText,
                            isSelected ? styles.deliverHereTextActive : styles.deliverHereTextDefault
                          ]}>
                            {isSelected ? 'Delivering to this address' : 'Deliver to this address'}
                          </Text>
                          {!isSelected && (
                            <MaterialCommunityIcons name="arrow-right" size={14} color="#EA580C" />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptySavedBox}>
                <MaterialCommunityIcons name="map-marker-plus-outline" size={40} color="#CBD5E1" />
                <Text style={styles.emptySavedTitle}>No saved addresses yet</Text>
                <Text style={styles.emptySavedDesc}>
                  Save your home, apartment, or office addresses for fast 1-tap checkout.
                </Text>
                <TouchableOpacity
                  style={styles.addFirstAddressBtn}
                  onPress={() => {
                    onClose();
                    onOpenMapPicker();
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                  <Text style={styles.addFirstAddressText}>Add New Address</Text>
                </TouchableOpacity>
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF7ED',
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
    fontWeight: '800',
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
    color: '#EA580C',
    marginTop: 2,
  },
  quickActionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  gpsPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  gpsBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  savedSection: {
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addNewAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  addNewAddressText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EA580C',
  },
  savedList: {
    gap: 12,
  },
  savedAddressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  savedAddressSelected: {
    borderColor: '#16A34A',
    borderLeftWidth: 5,
    borderLeftColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  savedAddressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  savedTagCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  savedTagText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  selectedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  selectedPillText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedAddressPrimary: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  savedAddressSecondary: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 3,
  },
  savedAddressCity: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
  },
  deliverHereRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  deliverActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  deliverActionBtnActive: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  deliverActionBtnDefault: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  deliverHereText: {
    fontSize: 13,
  },
  deliverHereTextActive: {
    fontWeight: '900',
    color: '#15803D',
  },
  deliverHereTextDefault: {
    fontWeight: '800',
    color: '#EA580C',
  },
  emptySavedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptySavedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySavedDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  addFirstAddressBtn: {
    backgroundColor: '#EA580C',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addFirstAddressText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
});
