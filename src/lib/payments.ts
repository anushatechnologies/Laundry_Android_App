import RazorpayCheckout from 'react-native-razorpay';
import type { Customer, RazorpayPaymentOrder } from '@/types/domain';

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function payWithRazorpay(payment: RazorpayPaymentOrder, customer: Customer): Promise<RazorpayResult> {
  if (payment.isMock || !payment.key || payment.key.includes('mock') || payment.orderId.startsWith('order_sand_')) {
    throw new Error('Online payment is unavailable. Please try again later.');
  }

  return RazorpayCheckout.open({
    key: payment.key,
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

export async function payRazorpayCustom(options: {
  key: string;
  orderId: string;
  amount: number;
  currency?: string;
  description: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
}): Promise<RazorpayResult> {
  return RazorpayCheckout.open({
    key: options.key,
    amount: options.amount,
    currency: options.currency || 'INR',
    name: 'LaundryFresh',
    description: options.description,
    order_id: options.orderId,
    prefill: options.prefill || {},
    theme: { color: '#F97316' },
  });
}
