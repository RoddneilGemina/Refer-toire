import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { NetworkService } from '@/services/networkService';
import {
  AppRelease,
  UpdateCheckResult,
  UpdateProgressState,
} from '@/types/update';

// Try to dynamically load expo-updates if present
let ExpoUpdates: any = null;
try {
  ExpoUpdates = require('expo-updates');
} catch {
  // expo-updates is optional in direct standalone APK/dev environments
}

class UpdateServiceManager {
  private _currentVersion: string = '1.0.0';
  private _currentBuildNumber: number = 1;
  private _activeDownload: any = null;
  private _simulatedRelease: AppRelease | null = null;
  private _updateListeners: Set<(update: AppRelease) => void> = new Set();
  private _scannerInterval: any = null;
  private _hasCheckedOnLaunch: boolean = false;

  constructor() {
    this.initVersionInfo();
  }

  private initVersionInfo() {
    try {
      if (Constants.expoConfig?.version) {
        this._currentVersion = Constants.expoConfig.version;
      }
      if (Platform.OS === 'android' && Constants.expoConfig?.android?.versionCode) {
        this._currentBuildNumber = Constants.expoConfig.android.versionCode;
      } else if (Platform.OS === 'ios' && Constants.expoConfig?.ios?.buildNumber) {
        this._currentBuildNumber = parseInt(Constants.expoConfig.ios.buildNumber, 10) || 1;
      }
    } catch {
      // Default to 1.0.0 (Build 1)
    }
  }

  public get currentVersion(): string {
    return this._currentVersion;
  }

  public get currentBuildNumber(): number {
    return this._currentBuildNumber;
  }

  /**
   * Semantic and build number version comparator.
   * Returns true if remote is strictly newer than current.
   */
  public isNewer(
    currentVer: string,
    currentBuild: number,
    remoteVer: string,
    remoteBuild: number
  ): boolean {
    // 1. If remote build number is strictly greater, it's newer
    if (remoteBuild > currentBuild) return true;
    if (remoteBuild < currentBuild) return false;

    // 2. Otherwise, compare semantic version parts [major, minor, patch]
    const curParts = currentVer.split('.').map(p => parseInt(p, 10) || 0);
    const remParts = remoteVer.split('.').map(p => parseInt(p, 10) || 0);

    const maxLen = Math.max(curParts.length, remParts.length);
    for (let i = 0; i < maxLen; i++) {
      const c = curParts[i] || 0;
      const r = remParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }

    return false;
  }

  /**
   * Check for updates across Supabase cloud database, remote manifest, and OTA
   */
  public async checkForUpdates(manual: boolean = false): Promise<UpdateCheckResult> {
    const currentVersion = this._currentVersion;
    const currentBuildNumber = this._currentBuildNumber;

    // Return simulated release immediately if set for testing
    if (this._simulatedRelease) {
      return {
        available: true,
        currentVersion,
        currentBuildNumber,
        latestVersion: this._simulatedRelease.version,
        latestBuildNumber: this._simulatedRelease.buildNumber,
        release: this._simulatedRelease,
      };
    }

    // If device is offline, cannot query remote updates
    if (!NetworkService.isOnline()) {
      return {
        available: false,
        currentVersion,
        currentBuildNumber,
        error: 'Device is offline',
      };
    }

    try {
      // 1. Query Supabase `app_releases` table for published builds
      const { data, error } = await supabase
        .from('app_releases')
        .select('*')
        .order('build_number', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        const release: AppRelease = {
          id: row.id,
          version: row.version || '1.0.0',
          buildNumber: row.build_number || 1,
          releaseNotes: row.release_notes || '• Performance enhancements and bug fixes.',
          apkUrl: row.apk_url || '',
          fileSize: row.file_size || 0,
          isMandatory: Boolean(row.is_mandatory),
          minSupportedVersion: row.min_supported_version,
          publishedAt: row.published_at,
          updateType: 'native_build',
        };

        const isUpdateAvailable = this.isNewer(
          currentVersion,
          currentBuildNumber,
          release.version,
          release.buildNumber
        );

        if (isUpdateAvailable) {
          return {
            available: true,
            currentVersion,
            currentBuildNumber,
            latestVersion: release.version,
            latestBuildNumber: release.buildNumber,
            release,
          };
        }
      }

      // 2. Query GitHub repository manifest as automatic fallback for git-based updates
      try {
        const ghResp = await fetch(
          `https://raw.githubusercontent.com/refertoire/refertoire.github.io/main/app.json?t=${Date.now()}`,
          { headers: { 'Cache-Control': 'no-cache' } }
        );
        if (ghResp.ok) {
          const ghJson = await ghResp.json();
          const ghVersion = ghJson?.expo?.version || '1.0.0';
          const ghBuild = ghJson?.expo?.android?.versionCode || 1;

          if (this.isNewer(currentVersion, currentBuildNumber, ghVersion, ghBuild)) {
            const ghRelease: AppRelease = {
              id: `github-v${ghVersion}-b${ghBuild}`,
              version: ghVersion,
              buildNumber: ghBuild,
              releaseNotes: '• Performance updates, PDF reader enhancements, and bug fixes.',
              apkUrl: 'https://refertoire.github.io/demoapk/Refertoire.apk',
              updateType: 'native_build',
            };

            return {
              available: true,
              currentVersion,
              currentBuildNumber,
              latestVersion: ghRelease.version,
              latestBuildNumber: ghRelease.buildNumber,
              release: ghRelease,
            };
          }
        }
      } catch (ghErr) {
        // Fallback silently if offline or GitHub unreachable
      }

      // 3. Check Over-The-Air (OTA) updates via expo-updates if active
      if (ExpoUpdates && ExpoUpdates.isEnabled) {
        try {
          const update = await ExpoUpdates.checkForUpdateAsync();
          if (update.isAvailable) {
            const otaRelease: AppRelease = {
              version: `${currentVersion}-ota`,
              buildNumber: currentBuildNumber,
              releaseNotes: '• Over-The-Air JavaScript & Asset update available.',
              isMandatory: false,
              updateType: 'ota_bundle',
            };
            return {
              available: true,
              currentVersion,
              currentBuildNumber,
              latestVersion: otaRelease.version,
              latestBuildNumber: otaRelease.buildNumber,
              release: otaRelease,
            };
          }
        } catch (otaErr) {
          console.warn('expo-updates check notice:', otaErr);
        }
      }

      return {
        available: false,
        currentVersion,
        currentBuildNumber,
        latestVersion: currentVersion,
        latestBuildNumber: currentBuildNumber,
      };
    } catch (err: any) {
      console.warn('Error checking for updates:', err?.message || err);
      return {
        available: false,
        currentVersion,
        currentBuildNumber,
        error: err?.message || 'Failed to check for updates',
      };
    }
  }

  /**
   * Downloads and installs the specified release with real-time progress callbacks
   */
  public async downloadAndInstallUpdate(
    release: AppRelease,
    onProgress: (state: UpdateProgressState) => void
  ): Promise<void> {
    onProgress({
      status: 'checking',
      percentage: 0,
      bytesWritten: 0,
      totalBytesExpected: release.fileSize || 0,
    });

    // 1. Handle OTA update reload
    if (release.updateType === 'ota_bundle' && ExpoUpdates && ExpoUpdates.isEnabled) {
      try {
        onProgress({
          status: 'downloading',
          percentage: 35,
          bytesWritten: 0,
          totalBytesExpected: 100,
        });
        await ExpoUpdates.fetchUpdateAsync();
        onProgress({
          status: 'ready_to_install',
          percentage: 100,
          bytesWritten: 100,
          totalBytesExpected: 100,
        });
        await ExpoUpdates.reloadAsync();
        return;
      } catch (otaErr: any) {
        onProgress({
          status: 'error',
          percentage: 0,
          bytesWritten: 0,
          totalBytesExpected: 0,
          errorMessage: otaErr?.message || 'Failed to download OTA update',
        });
        throw otaErr;
      }
    }

    // 2. Handle Web Platform (refresh window)
    if (Platform.OS === 'web') {
      onProgress({
        status: 'downloading',
        percentage: 50,
        bytesWritten: 50,
        totalBytesExpected: 100,
      });
      await new Promise(r => setTimeout(r, 600));
      onProgress({
        status: 'ready_to_install',
        percentage: 100,
        bytesWritten: 100,
        totalBytesExpected: 100,
      });
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      return;
    }

    // 3. Handle Standalone Android APK Download & Installation
    const downloadUrl =
      release.apkUrl ||
      'https://refertoire.github.io/demoapk/Refertoire.apk';

    try {
      const filename = `Refertoire-v${release.version}-b${release.buildNumber || 1}.apk`;
      const targetUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${filename}`;

      onProgress({
        status: 'downloading',
        percentage: 0,
        bytesWritten: 0,
        totalBytesExpected: release.fileSize || 48000000,
      });

      this._activeDownload = FileSystem.createDownloadResumable(
        downloadUrl,
        targetUri,
        {},
        downloadProgress => {
          const expected = downloadProgress.totalBytesExpectedToWrite || release.fileSize || 48000000;
          const written = downloadProgress.totalBytesWritten;
          const pct = expected > 0 ? Math.floor((written / expected) * 100) : 50;

          onProgress({
            status: 'downloading',
            percentage: Math.min(Math.max(pct, 1), 99),
            bytesWritten: written,
            totalBytesExpected: expected,
          });
        }
      );

      const downloadResult = await this._activeDownload.downloadAsync();
      this._activeDownload = null;

      const fileUri = downloadResult?.uri || targetUri;

      onProgress({
        status: 'ready_to_install',
        percentage: 100,
        bytesWritten: release.fileSize || 48000000,
        totalBytesExpected: release.fileSize || 48000000,
      });

      // Prompt installation immediately upon download completion
      await this.installDownloadedApk(fileUri, release);
    } catch (err: any) {
      this._activeDownload = null;
      console.warn('Update download error:', err);
      onProgress({
        status: 'error',
        percentage: 0,
        bytesWritten: 0,
        totalBytesExpected: 0,
        errorMessage: err?.message || 'Failed to download update package',
      });
      throw err;
    }
  }

  /**
   * Directly triggers the Android system package installer for a downloaded APK
   */
  public async installDownloadedApk(fileUri: string, release?: AppRelease): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.android.package-archive',
            dialogTitle: `Install Refertoire Update`,
            UTI: 'com.android.package-archive',
          });
          return;
        }
      } catch (shareErr) {
        console.warn('Sharing install fallback to Linking:', shareErr);
      }

      if (release?.apkUrl) {
        try {
          await Linking.openURL(release.apkUrl);
          return;
        } catch {
          // Fallback to local URI
        }
      }

      try {
        await Linking.openURL(fileUri);
      } catch (linkErr) {
        console.warn('Linking openURL notice:', linkErr);
      }
    } else if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } else if (release?.apkUrl) {
      await Linking.openURL(release.apkUrl);
    }
  }

  /**
   * Start the update scanner for app relaunch.
   * Only checks once upon relaunching the app, bundled with launch sync.
   */
  public startAutoScanner(
    onUpdateDetected: (release: AppRelease) => void
  ): () => void {
    this._updateListeners.add(onUpdateDetected);

    const triggerCheck = async () => {
      try {
        const result = await this.checkForUpdates();
        if (result.available && result.release) {
          this._updateListeners.forEach(listener => listener(result.release!));
        }
      } catch (err) {
        console.warn('Auto-scan notice:', err);
      }
    };

    // Check once upon relaunching the app (debounced 3s so it never blocks UI startup)
    if (!this._hasCheckedOnLaunch) {
      this._hasCheckedOnLaunch = true;
      setTimeout(triggerCheck, 3000);
    }

    return () => {
      this._updateListeners.delete(onUpdateDetected);
    };
  }

  /**
   * Simulate an update for testing and interactive verification
   */
  public simulateUpdate(release: AppRelease | null) {
    this._simulatedRelease = release;
    if (release) {
      this._updateListeners.forEach(l => l(release));
    }
  }
}

export const UpdateService = new UpdateServiceManager();
