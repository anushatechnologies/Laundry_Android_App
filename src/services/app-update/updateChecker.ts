import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE_URL } from '@/lib/config';

export interface AppReleaseInfo {
  id: string;
  versionName: string;
  versionCode: number;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  releaseNotes?: string;
  isForceUpdate?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export const CURRENT_APP_VERSION = Constants.expoConfig?.version || '1.0.42';
export const CURRENT_APP_CODE = Constants.expoConfig?.android?.versionCode || 42;

/**
 * Checks backend/AWS for the latest published APK release.
 * If a newer version exists, shows the update prompt.
 * @param silentIfUpToDate If true, doesn't show an alert when the app is already up to date.
 */
export async function checkForAppUpdate(options?: { silentIfUpToDate?: boolean }): Promise<{
  hasUpdate: boolean;
  release: AppReleaseInfo | null;
}> {
  const silent = options?.silentIfUpToDate ?? true;

  try {
    const res = await fetch(`${API_BASE_URL}/app-release/latest`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    const json = await res.json();

    if (json?.success && json?.data) {
      const release: AppReleaseInfo = json.data;
      const downloadUrl = release.fileUrl && release.fileUrl.startsWith('http')
        ? release.fileUrl
        : `${API_BASE_URL}/app-release/download`;

      const latestCode = Number(release.versionCode) || 0;
      const hasNewer = latestCode > CURRENT_APP_CODE;

      if (hasNewer) {
        const sizeMb = release.fileSizeBytes
          ? `${(release.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
          : 'Full APK';

        const title = `🚀 New Update Available! (${release.versionName || 'Latest'})`;
        const message = `${release.releaseNotes || 'A new version with performance improvements and new features is ready.'}\n\nSize: ${sizeMb}`;

        if (release.isForceUpdate) {
          Alert.alert(title, message, [
            {
              text: 'Download & Install Now',
              onPress: () => {
                void Linking.openURL(downloadUrl);
              },
            },
          ]);
        } else {
          Alert.alert(title, message, [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Download & Install',
              onPress: () => {
                void Linking.openURL(downloadUrl);
              },
            },
          ]);
        }

        return { hasUpdate: true, release };
      }

      if (!silent) {
        Alert.alert(
          'You Are Up to Date! 🎉',
          `You are using LaundryFresh v${CURRENT_APP_VERSION} (Build ${CURRENT_APP_CODE}) which is the latest version available.`,
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Re-download APK',
              onPress: () => {
                void Linking.openURL(downloadUrl);
              },
            },
          ]
        );
      }

      return { hasUpdate: false, release };
    }

    if (!silent) {
      Alert.alert(
        'Download Latest Release',
        'Download the official LaundryFresh APK package directly from our cloud server.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download APK',
            onPress: () => {
              void Linking.openURL('https://anjanilaundry.s3.ap-south-2.amazonaws.com/releases/LaundryFresh.apk');
            },
          },
        ]
      );
    }

    return { hasUpdate: false, release: null };
  } catch (error) {
    if (!silent) {
      Alert.alert(
        'Latest Release APK',
        'Download the official LaundryFresh APK installer directly from AWS cloud storage.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download APK',
            onPress: () => {
              void Linking.openURL('https://anjanilaundry.s3.ap-south-2.amazonaws.com/releases/LaundryFresh.apk');
            },
          },
        ]
      );
    }
    return { hasUpdate: false, release: null };
  }
}
