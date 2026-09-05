import React, { useState, useMemo, useCallback } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { InAppNotification } from '@/types/domain';

interface NotificationsScreenProps {
  onOpenOrder: (orderId: string) => void;
  onOpenOffers: () => void;
}

type NotificationFilter = 'ALL' | 'ORDERS' | 'OFFERS' | 'SYSTEM';

interface NotificationItem {
  id: string;
  type: 'ORDER' | 'OFFER' | 'SYSTEM' | string;
  title: string;
  message: string;
  time: string;
  section: 'TODAY' | 'YESTERDAY' | 'EARLIER';
  read: boolean;
  orderId?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

function formatNotificationItem(n: InAppNotification): NotificationItem {
  const createdAt = n.createdAt ? new Date(n.createdAt) : new Date();
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let time = 'Just now';
  let section: 'TODAY' | 'YESTERDAY' | 'EARLIER' = 'TODAY';

  if (diffDays === 0) {
    section = 'TODAY';
    if (diffMins < 1) time = 'Just now';
    else if (diffMins < 60) time = `${diffMins}m ago`;
    else time = `${diffHours}h ago`;
  } else if (diffDays === 1) {
    section = 'YESTERDAY';
    time = 'Yesterday';
  } else {
    section = 'EARLIER';
    time = diffDays < 7 ? `${diffDays}d ago` : createdAt.toLocaleDateString();
  }

  let icon = 'bell-outline';
  let iconBg = '#FFF7ED';
  let iconColor = '#FF7A00';

  if (n.type === 'ORDER' || n.channel === 'orders') {
    icon = 'washing-machine';
    iconBg = '#EFF6FF';
    iconColor = '#2563EB';
  } else if (n.type === 'OFFER' || n.channel === 'promotions') {
    icon = 'tag-percent';
    iconBg = '#FEF3C7';
    iconColor = '#D97706';
  } else if (n.type === 'SYSTEM') {
    icon = 'shield-check';
    iconBg = '#F0FDF4';
    iconColor = '#16A34A';
  }

  return {
    id: n.id,
    type: n.type || (n.channel === 'promotions' ? 'OFFER' : 'ORDER'),
    title: n.title,
    message: n.body,
    time,
    section,
    read: n.isRead,
    orderId: n.data?.orderId,
    icon,
    iconBg,
    iconColor,
  };
}

export function NotificationsScreen({ onOpenOrder, onOpenOffers }: NotificationsScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    inAppNotifications,
    unreadNotificationCount,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotificationItem,
  } = useApp();

  const [filter, setFilter] = useState<NotificationFilter>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchNotifications();
    } catch (error) {
      console.warn('[NotificationsScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotifications]);

  const items = useMemo(() => {
    return inAppNotifications.map(formatNotificationItem);
  }, [inAppNotifications]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'ALL') return true;
      return item.type === filter;
    });
  }, [filter, items]);

  const handleNotificationPress = (item: NotificationItem) => {
    markNotificationRead(item.id);

    if (item.type === 'ORDER' && item.orderId) {
      onOpenOrder(item.orderId);
    } else if (item.type === 'OFFER') {
      onOpenOffers();
    }
  };

  // Group by Today, Yesterday, Earlier
  const todayItems = filtered.filter((n) => n.section === 'TODAY');
  const yesterdayItems = filtered.filter((n) => n.section === 'YESTERDAY');
  const earlierItems = filtered.filter((n) => n.section === 'EARLIER');

  const renderSection = (title: string, items: NotificationItem[]) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.groupSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderTitle}>{title}</Text>
          <Text style={styles.sectionHeaderCount}>{items.length}</Text>
        </View>

        <View style={styles.itemsStack}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.notifCard, !item.read && styles.notifCardUnread]}
              onPress={() => handleNotificationPress(item)}
            >
              {/* Unread Indicator Bar */}
              {!item.read && <View style={styles.unreadBar} />}

              {/* Icon Container */}
              <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                <MaterialCommunityIcons name={item.icon as any} size={22} color={item.iconColor} />
              </View>

              {/* Content Column */}
              <View style={styles.contentCol}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.notifTime}>{item.time}</Text>
                </View>

                <Text style={styles.notifMessage} numberOfLines={2}>
                  {item.message}
                </Text>

                {item.orderId && (
                  <View style={styles.orderPill}>
                    <Text style={styles.orderPillText}>Order #{item.orderId}</Text>
                    <MaterialCommunityIcons name="arrow-right" size={12} color="#2563EB" />
                  </View>
                )}
              </View>

              {/* Delete button */}
              <Pressable
                style={styles.deleteBtn}
                onPress={() => deleteNotificationItem(item.id)}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close" size={15} color="#94A3B8" />
              </Pressable>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadNotificationCount > 0 && (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>{unreadNotificationCount} New</Text>
            </View>
          )}
        </View>

        {unreadNotificationCount > 0 && (
          <Pressable onPress={markAllNotificationsRead} hitSlop={8}>
            <Text style={styles.markReadText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {[
          { key: 'ALL', label: 'All' },
          { key: 'ORDERS', label: 'Orders' },
          { key: 'OFFERS', label: 'Offers' },
          { key: 'SYSTEM', label: 'Updates' },
        ].map((tab) => {
          const isActive = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabChip, isActive && styles.tabChipActive]}
              onPress={() => setFilter(tab.key as NotificationFilter)}
            >
              <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Grouped Feed */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2563EB', '#F97316']}
            tintColor="#2563EB"
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="bell-sleep-outline" size={54} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>You are all caught up with your orders and offers!</Text>
          </View>
        ) : (
          <>
            {renderSection('Today', todayItems)}
            {renderSection('Yesterday', yesterdayItems)}
            {renderSection('Earlier', earlierItems)}
          </>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  unreadPill: {
    backgroundColor: '#FF7A00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unreadPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  markReadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  tabChipActive: {
    backgroundColor: '#111827',
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  groupSection: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  itemsStack: {
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
    gap: 12,
  },
  notifCardUnread: {
    borderColor: '#FFEDD5',
    backgroundColor: '#FFFFFF',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#FF7A00',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCol: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    flex: 1,
    marginRight: 6,
  },
  notifTitleUnread: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  notifTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  notifMessage: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  orderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
    gap: 4,
  },
  orderPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  deleteBtn: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
