import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/context/ThemeContext';
import { getInvoiceUrl, downloadInvoicePdf, shareInvoicePdf } from '@/lib/invoice';
import type { Order } from '@/types/domain';

interface InvoiceViewerModalProps {
  visible: boolean;
  orderId: string | null;
  onClose: () => void;
}

export function InvoiceViewerModal({ visible, orderId, onClose }: InvoiceViewerModalProps) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!orderId) return null;

  const invoiceUrl = getInvoiceUrl(orderId, false);

  const handleOpenBrowser = async () => {
    try {
      await Linking.openURL(invoiceUrl);
    } catch {
      Alert.alert('Unable to open browser', 'Please check your internet connection and try again.');
    }
  };

  const handleDownload = async () => {
    try {
      await downloadInvoicePdf(orderId);
    } catch {
      Alert.alert('Download failed', 'Unable to generate invoice PDF. Please try again.');
    }
  };

  const handleShare = async () => {
    try {
      await shareInvoicePdf(orderId);
    } catch {
      Alert.alert('Share failed', 'Unable to share invoice. Please try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]} edges={['top', 'bottom']}>
        {/* Header Bar */}
        <View style={[styles.headerBar, { borderBottomColor: isDark ? '#334155' : '#E2E8F0' }]}>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close invoice viewer"
          >
            <MaterialCommunityIcons name="close" size={22} color={colors.textHeading} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.textHeading }]} numberOfLines={1}>
              Tax Invoice
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textCaption }]} numberOfLines={1}>
              Order #{orderId}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.headerActionBtn, pressed && { opacity: 0.7 }]}
              onPress={handleOpenBrowser}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Open invoice in web browser"
            >
              <MaterialCommunityIcons name="open-in-new" size={20} color={isDark ? colors.primary : '#16A34A'} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.headerActionBtn, pressed && { opacity: 0.7 }]}
              onPress={handleShare}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Share invoice via apps"
            >
              <MaterialCommunityIcons name="share-variant-outline" size={20} color={isDark ? colors.primary : '#16A34A'} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.headerDownloadBtn, pressed && { opacity: 0.85 }]}
              onPress={handleDownload}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Download invoice PDF"
            >
              <MaterialCommunityIcons name="download" size={16} color="#FFFFFF" />
              <Text style={styles.headerDownloadText}>PDF</Text>
            </Pressable>
          </View>
        </View>

        {/* WebView Invoice Content */}
        <View style={styles.webContainer}>
          {hasError ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={[styles.errorTitle, { color: colors.textHeading }]}>Unable to display invoice preview</Text>
              <Text style={[styles.errorSub, { color: colors.textCaption }]}>
                You can still view the full invoice directly in your web browser.
              </Text>
              <Pressable style={styles.errorActionBtn} onPress={handleOpenBrowser}>
                <MaterialCommunityIcons name="open-in-new" size={16} color="#FFFFFF" />
                <Text style={styles.errorActionText}>Open in Browser</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              source={{ uri: invoiceUrl }}
              style={styles.webView}
              startInLoadingState
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#16A34A" />
                  <Text style={[styles.loadingText, { color: colors.textCaption }]}>
                    Rendering official tax invoice...
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface InvoiceActionModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onView: (orderId: string) => void;
  onDownload: (orderId: string) => void;
  onShare: (orderId: string) => void;
}

export function InvoiceActionModal({
  visible,
  order,
  onClose,
  onView,
  onDownload,
  onShare,
}: InvoiceActionModalProps) {
  const { colors, isDark } = useTheme();

  if (!order) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.actionSheetOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.actionSheetCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
          onPress={(e) => e.stopPropagation?.()}
        >
          {/* Header */}
          <View style={[styles.actionSheetHeader, { borderBottomColor: isDark ? '#334155' : '#F1F5F9' }]}>
            <View style={styles.actionSheetIconCircle}>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionSheetTitle, { color: colors.textHeading }]}>
                Tax Invoice Options
              </Text>
              <Text style={[styles.actionSheetSubtitle, { color: colors.textCaption }]}>
                Order #{order.id}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textCaption} />
            </Pressable>
          </View>

          {/* Options */}
          <View style={styles.actionSheetOptions}>
            {/* 1. View Invoice */}
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
              onPress={() => {
                onClose();
                onView(order.id);
              }}
              accessibilityRole="button"
              accessibilityLabel="View Tax Invoice"
            >
              <View
                style={[
                  styles.actionItem,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#16A34A',
                  },
                ]}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <MaterialCommunityIcons name="eye-outline" size={22} color="#15803D" />
                </View>
                <View style={styles.actionItemText}>
                  <Text style={[styles.actionItemTitle, { color: isDark ? colors.textHeading : '#15803D' }]}>
                    View Invoice
                  </Text>
                  <Text style={[styles.actionItemSub, { color: colors.textCaption }]}>
                    View itemized breakdown, taxes & GST receipt
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={isDark ? colors.textCaption : '#16A34A'} />
              </View>
            </Pressable>

            {/* 2. Download / Save PDF */}
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
              onPress={() => {
                onClose();
                onDownload(order.id);
              }}
              accessibilityRole="button"
              accessibilityLabel="Download Invoice PDF"
            >
              <View
                style={[
                  styles.actionItem,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#4338CA',
                  },
                ]}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: '#E0E7FF' }]}>
                  <MaterialCommunityIcons name="download" size={22} color="#4338CA" />
                </View>
                <View style={styles.actionItemText}>
                  <Text style={[styles.actionItemTitle, { color: isDark ? colors.textHeading : '#4338CA' }]}>
                    Download PDF
                  </Text>
                  <Text style={[styles.actionItemSub, { color: colors.textCaption }]}>
                    Save official invoice PDF to your device
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={isDark ? colors.textCaption : '#4338CA'} />
              </View>
            </Pressable>

            {/* 3. Share Invoice */}
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
              onPress={() => {
                onClose();
                onShare(order.id);
              }}
              accessibilityRole="button"
              accessibilityLabel="Share Invoice"
            >
              <View
                style={[
                  styles.actionItem,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#B45309',
                  },
                ]}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialCommunityIcons name="share-variant-outline" size={22} color="#B45309" />
                </View>
                <View style={styles.actionItemText}>
                  <Text style={[styles.actionItemTitle, { color: isDark ? colors.textHeading : '#B45309' }]}>
                    Share Invoice
                  </Text>
                  <Text style={[styles.actionItemSub, { color: colors.textCaption }]}>
                    Send via WhatsApp, Email, or messages
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={isDark ? colors.textCaption : '#B45309'} />
              </View>
            </Pressable>
          </View>

          {/* Close Button */}
          <Pressable
            style={[styles.actionCloseBtn, { backgroundColor: isDark ? '#334155' : '#E8F5E9' }]}
            onPress={onClose}
          >
            <Text style={[styles.actionCloseText, { color: isDark ? colors.textHeading : '#15803D' }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  headerDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  headerDownloadText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  webContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  errorActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Action Modal Sheet Styles
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
    gap: 16,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  actionSheetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  actionSheetSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  actionSheetOptions: {
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    width: '100%',
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: 12,
  },
  actionItemText: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  actionItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  actionItemSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  actionCloseBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  actionCloseText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
});
