import RazorpayCheckout from 'react-native-razorpay';
import type { Customer, RazorpayPaymentOrder } from '@/types/domain';

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface ParsedPaymentError {
  isCancelled: boolean;
  title: string;
  message: string;
  technicalDetails?: string;
}

/**
 * Universal parser for payment errors (especially native Razorpay SDK on Android/iOS).
 * Automatically detects user back-button / dismissals and normalizes error messages so
 * raw JSON strings (like {"error":{"code":"BAD_REQUEST_ERROR"...}}) are NEVER exposed.
 */
export function parsePaymentError(error: unknown): ParsedPaymentError {
  let rawStr = '';
  let parsedObj: any = null;

  if (typeof error === 'string') {
    rawStr = error;
  } else if (error instanceof Error) {
    rawStr = error.message;
    if ((error as any).parsedPayment) {
      return (error as any).parsedPayment;
    }
    if ((error as any).code !== undefined || (error as any).description !== undefined) {
      parsedObj = error;
    }
  } else if (error && typeof error === 'object') {
    parsedObj = error;
    rawStr = (error as any).message || (error as any).description || '';
  }

  // Attempt to parse stringified JSON from native bridge
  if (typeof rawStr === 'string' && (rawStr.trim().startsWith('{') || rawStr.includes('"error":'))) {
    try {
      parsedObj = JSON.parse(rawStr);
    } catch {
      // ignore
    }
  }

  const root = parsedObj || {};
  const nestedError = root.error || {};

  const code = String(root.code ?? nestedError.code ?? '');
  const description = String(root.description ?? nestedError.description ?? '');
  const source = String(root.source ?? nestedError.source ?? '');
  const step = String(root.step ?? nestedError.step ?? '');
  const reason = String(root.reason ?? nestedError.reason ?? '');

  const combined = `${rawStr} ${code} ${description} ${source} ${step} ${reason}`.toLowerCase();

  // User pressed back button or cancelled in gateway
  // Native Razorpay Android produces:
  // source: "customer", step: "payment_authentication", reason: "payment_error", code: 0 or 2, description: "undefined"
  const isCustomerAction =
    source.toLowerCase() === 'customer' ||
    combined.includes('payment_cancelled') ||
    combined.includes('cancel') ||
    combined.includes('dismiss') ||
    combined.includes('back') ||
    (reason.toLowerCase() === 'payment_error' && source.toLowerCase() === 'customer') ||
    (combined.includes('bad_request_error') && source.toLowerCase() === 'customer') ||
    code === '0' ||
    code === '2';

  if (isCustomerAction) {
    return {
      isCancelled: true,
      title: 'Payment Not Completed',
      message:
        'You went back before completing the online payment.\n\nDon\'t worry, your bag is safe and no money was deducted. You can retry online payment or switch to Cash on Delivery (COD).',
      technicalDetails: 'User dismissed or backed out of payment gateway',
    };
  }

  // Network / Connection errors
  if (
    combined.includes('network') ||
    combined.includes('timeout') ||
    combined.includes('internet') ||
    combined.includes('econnrefused')
  ) {
    return {
      isCancelled: false,
      title: 'Connection Issue',
      message:
        'Unable to connect to the payment gateway. Please check your internet connection and try again or choose Cash on Delivery.',
      technicalDetails: 'Network connectivity timeout',
    };
  }

  // Real bank / card / UPI decline
  let cleanDesc = description;
  if (!cleanDesc || cleanDesc === 'undefined' || cleanDesc === 'null' || cleanDesc.trim().startsWith('{')) {
    cleanDesc = 'Your bank or UPI app was unable to process the payment.';
  }

  return {
    isCancelled: false,
    title: 'Payment Failed',
    message: `${cleanDesc}\n\nAny money deducted by your bank will be auto-refunded in 2-4 business days. You can retry or switch to Cash on Delivery.`,
    technicalDetails: `${code || 'ERR'} - ${reason || 'GATEWAY_ERROR'}`,
  };
}

export async function payWithRazorpay(payment: RazorpayPaymentOrder, customer: Customer): Promise<RazorpayResult> {
  if (payment.isMock || !payment.key || payment.key.includes('mock') || payment.orderId.startsWith('order_sand_')) {
    throw new Error('Online payment is unavailable. Please try again later.');
  }

  try {
    return await RazorpayCheckout.open({
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
  } catch (error: any) {
    const parsed = parsePaymentError(error);
    const err = new Error(parsed.message);
    (err as any).isCancelled = parsed.isCancelled;
    (err as any).paymentTitle = parsed.title;
    (err as any).parsedPayment = parsed;
    throw err;
  }
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
  try {
    return await RazorpayCheckout.open({
      key: options.key,
      amount: options.amount,
      currency: options.currency || 'INR',
      name: 'LaundryFresh',
      description: options.description,
      order_id: options.orderId,
      prefill: options.prefill || {},
      theme: { color: '#F97316' },
    });
  } catch (error: any) {
    const parsed = parsePaymentError(error);
    const err = new Error(parsed.message);
    (err as any).isCancelled = parsed.isCancelled;
    (err as any).paymentTitle = parsed.title;
    (err as any).parsedPayment = parsed;
    throw err;
  }
}
