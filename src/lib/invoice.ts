import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Linking, Platform } from 'react-native';
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

export async function downloadInvoicePdf(orderId: string): Promise<{ success: boolean; uri?: string }> {
  const tempUri = await generateInvoicePdfUri(orderId);
  const cleanId = orderId.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `LaundryFresh_Invoice_${cleanId}.pdf`;

  if (Platform.OS === 'android') {
    try {
      // Use Android StorageAccessFramework to save directly to user's chosen folder (Downloads / Documents)
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const base64 = await FileSystem.readAsStringAsync(tempUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const createdUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/pdf'
        );

        await FileSystem.writeAsStringAsync(createdUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        Alert.alert(
          'Invoice Downloaded! 📄',
          `Tax invoice for Order #${cleanId} has been saved successfully to your device.\n\nFile: ${fileName}`,
          [{ text: 'OK' }]
        );
        return { success: true, uri: createdUri };
      }
    } catch (safError: any) {
      console.warn('[Invoice] StorageAccessFramework error, using document fallback:', safError);
    }
  }

  // Fallback for iOS or if permission was cancelled: copy to local documents directory
  try {
    const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    const targetFile = `${docDir}${fileName}`;
    await FileSystem.copyAsync({ from: tempUri, to: targetFile }).catch(() => {});

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetFile || tempUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save Invoice PDF to Device',
        UTI: 'com.adobe.pdf',
      });
    } else {
      await viewInvoiceOnline(orderId);
    }

    return { success: true, uri: targetFile || tempUri };
  } catch (err: any) {
    console.error('[Invoice] Download error:', err);
    throw err;
  }
}

