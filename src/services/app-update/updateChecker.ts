import AsyncStorage from '@react-native-async-storage/async-storage';
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

export const CURRENT_APP_VERSION = Constants.nativeAppVersion || Constants.expoConfig?.version || '1.0.52';
export const CURRENT_APP_CODE = Number(Constants.nativeBuildVersion || Constants.expoConfig?.android?.versionCode || 52);
const DISMISSED_UPDATE_KEY = '@laundryfresh_dismissed_update_v2';

function parseSemver(v?: string): number[] {
  if (!v) return [0, 0, 0];
  const cleaned = v.replace(/^v/i, '').trim();
  return cleaned.split('.').map((part) => parseInt(part, 10) || 0);
}

export function isRemoteVersionNewer(remoteVersion?: string, remoteCode?: number): boolean {
  const currentVerStr = (CURRENT_APP_VERSION || '1.0.52').replace(/^v/i, '').trim();
  const remoteVerStr = (remoteVersion || '').replace(/^v/i, '').trim();

  // If version string matches exactly (e.g., 1.0.52 === 1.0.52), it is definitely NOT newer
  if (remoteVerStr && currentVerStr && remoteVerStr === currentVerStr) {
    return false;
  }

  // Compare semver [major, minor, patch]
  if (remoteVerStr && currentVerStr) {
    const rParts = parseSemver(remoteVerStr);
    const cParts = parseSemver(currentVerStr);
    for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
      const r = rParts[i] ?? 0;
      const c = cParts[i] ?? 0;
      if (r > c) return true;
      if (r < c) return false;
    }
  }

  // Fallback to versionCode comparison only if version string wasn't explicitly equal
  const remoteCodeNum = Number(remoteCode) || 0;
  return remoteCodeNum > CURRENT_APP_CODE;
}

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
      const hasNewer = isRemoteVersionNewer(release.versionName, latestCode);

      // If silent on launch, check if user already dismissed this specific release
      if (silent && hasNewer) {
        const dismissed = await AsyncStorage.getItem(DISMISSED_UPDATE_KEY).catch(() => null);
        if (dismissed && (dismissed === release.versionName || dismissed === String(release.versionCode))) {
          return { hasUpdate: false, release };
        }
      }

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
                void AsyncStorage.setItem(DISMISSED_UPDATE_KEY, release.versionName || String(release.versionCode)).catch(() => {});
                void Linking.openURL(downloadUrl);
              },
            },
          ]);
        } else {
          Alert.alert(title, message, [
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => {
                void AsyncStorage.setItem(DISMISSED_UPDATE_KEY, release.versionName || String(release.versionCode)).catch(() => {});
              },
            },
            {
              text: 'Download & Install',
              onPress: () => {
                void AsyncStorage.setItem(DISMISSED_UPDATE_KEY, release.versionName || String(release.versionCode)).catch(() => {});
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
