import RazorpayCheckout from 'react-native-razorpay';
import type { Customer, RazorpayPaymentOrder } from '@/types/domain';

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function payWithRazorpay(payment: RazorpayPaymentOrder, customer: Customer): Promise<RazorpayResult> {
  if (payment.isMock || payment.key.includes('mock') || payment.orderId.startsWith('order_sand_')) {
    return {
      razorpay_order_id: payment.orderId,
      razorpay_payment_id: `pay_sand_${Date.now()}`,
      // The backend keeps mock verification behind a server-created sandbox order.
      razorpay_signature: '0'.repeat(64),
    };
  }

  return RazorpayCheckout.open({
    key: payment.key || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_live_TO6q7NUVnPM6bA',
    amount: payment.amount,
    currency: payment.currency,
    name: 'LaundryFresh',
    description: `Laundry pickup #${payment.internalOrderId}`,
    order_id: payment.orderId,
    prefill: {
      name: customer.name,
      contact: customer.phone,
      email: customer.email,
    },
    theme: { color: '#5B214F' },
  });
}
