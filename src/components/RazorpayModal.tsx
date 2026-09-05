import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Customer, RazorpayPaymentOrder } from '@/types/domain';
import type { RazorpayResult } from '@/lib/payments';

interface RazorpayModalProps {
  visible: boolean;
  payment?: RazorpayPaymentOrder | null;
  paymentOrder?: RazorpayPaymentOrder | null;
  customer?: Customer | null;
  onSuccess: (result: RazorpayResult) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

export function RazorpayModal({
  visible,
  payment,
  paymentOrder,
  customer,
  onSuccess,
  onCancel,
  onError,
}: RazorpayModalProps) {
  const [loading, setLoading] = useState(true);

  const activePayment = payment || paymentOrder;
  if (!visible || !activePayment) return null;

  const key = activePayment.key || 'rzp_live_TO6q7NUVnPM6bA';
  const amount = activePayment.amount;
  const currency = activePayment.currency || 'INR';
  const orderId = activePayment.orderId;
  const custName = customer?.name || 'Customer';
  const custPhone = customer?.phone || '';
  const custEmail = customer?.email || '';
  const displayAmount = (amount / 100).toFixed(0);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>LaundryFresh Payment</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0F172A;
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top-color: #F97316;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #FFFFFF; }
    p { font-size: 13px; color: #94A3B8; }
    .badge {
      display: inline-block;
      margin-top: 14px;
      padding: 6px 14px;
      background: rgba(249, 115, 22, 0.15);
      border: 1px solid rgba(249, 115, 22, 0.4);
      color: #FB923C;
      border-radius: 20px;
      font-weight: 700;
      font-size: 14px;
    }
  </style>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <div class="spinner"></div>
  <h2>Opening Secure Payment Window...</h2>
  <p>Connecting with Razorpay 256-bit encrypted gateway</p>
  <div class="badge">Payable: ₹${displayAmount}</div>

  <script>
    var options = {
      key: "${key}",
      amount: ${amount},
      currency: "${currency}",
      name: "LaundryFresh",
      description: "Order #${activePayment.internalOrderId}",
      order_id: "${orderId}",
      prefill: {
        name: ${JSON.stringify(custName)},
        contact: ${JSON.stringify(custPhone)},
        email: ${JSON.stringify(custEmail)}
      },
      theme: { color: "#F97316" },
      modal: {
        ondismiss: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CANCELLED' }));
        }
      },
      handler: function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SUCCESS',
          payload: {
            razorpay_order_id: response.razorpay_order_id || "${orderId}",
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          }
        }));
      }
    };

    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'FAILED',
        error: (response.error && response.error.description) ? response.error.description : 'Payment incomplete or failed.'
      }));
    });

    window.onload = function() {
      setTimeout(function() {
        rzp.open();
      }, 400);
    };
  </script>
</body>
</html>
`;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SUCCESS') {
        onSuccess(data.payload);
      } else if (data.type === 'CANCELLED') {
        onCancel();
      } else if (data.type === 'FAILED') {
        onError(data.error || 'Online payment failed.');
      }
    } catch {
      // Non-JSON message
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={onCancel} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Secure Online Payment</Text>
            <Text style={styles.headerSubtitle}>LaundryFresh • 256-Bit Encrypted</Text>
          </View>
          <View style={styles.amountBadge}>
            <Text style={styles.amountBadgeText}>₹{displayAmount}</Text>
          </View>
        </View>

        <View style={styles.webViewWrap}>
          <WebView
            originWhitelist={['*']}
            source={{ html: htmlContent, baseUrl: 'https://checkout.razorpay.com' }}
            onMessage={handleMessage}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={styles.webView}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={styles.loaderText}>Loading Payment Gateway...</Text>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  amountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F97316',
    borderRadius: 12,
  },
  amountBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  webViewWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webView: {
    flex: 1,
  },
  loaderWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
