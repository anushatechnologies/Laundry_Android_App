import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { API_BASE_URL } from '@/lib/config';

export function getInvoiceUrl(orderId: string, print = false): string {
  const query = print ? '?print=true' : '';
  return `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/invoice${query}`;
}

export async function viewInvoiceOnline(orderId: string): Promise<void> {
  const invoiceUrl = getInvoiceUrl(orderId, false);
  const canOpen = await Linking.canOpenURL(invoiceUrl).catch(() => true);
  if (canOpen) {
    await Linking.openURL(invoiceUrl);
  } else {
    throw new Error('Unable to open invoice viewer.');
  }
}

export async function generateInvoicePdfUri(orderId: string): Promise<string> {
  const invoiceUrl = getInvoiceUrl(orderId, true);
  const response = await fetch(invoiceUrl, {
    headers: { Accept: 'text/html' },
  });

  if (!response.ok) {
    throw new Error(`Invoice request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error('The invoice endpoint returned an unexpected file type.');
  }

  const html = await response.text();
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

export async function shareInvoicePdf(orderId: string): Promise<void> {
  const uri = await generateInvoicePdfUri(orderId);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is unavailable on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share LaundryFresh Invoice',
    UTI: 'com.adobe.pdf',
  });
}

export async function downloadInvoicePdf(orderId: string): Promise<void> {
  const uri = await generateInvoicePdfUri(orderId);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save LaundryFresh Invoice PDF',
      UTI: 'com.adobe.pdf',
    });
  } else {
    await viewInvoiceOnline(orderId);
  }
}
