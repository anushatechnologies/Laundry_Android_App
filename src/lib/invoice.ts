import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '@/lib/config';

export async function downloadInvoicePdf(orderId: string): Promise<void> {
  const invoiceUrl = `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/invoice?print=true`;
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

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is unavailable on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save LaundryFresh invoice',
    UTI: 'com.adobe.pdf',
  });
}
