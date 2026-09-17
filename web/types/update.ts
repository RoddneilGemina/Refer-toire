export interface AppRelease {
  id?: string;
  version: string;             // e.g. "1.0.1"
  buildNumber: number;         // e.g. 2
  releaseNotes?: string;       // e.g. "• Offline PDF Engine\n• Preload sheet music\n• Bug fixes"
  apkUrl?: string;             // Remote URL to the new APK or update package
  fileSize?: number;           // Size in bytes
  isMandatory?: boolean;       // If true, user cannot dismiss the update
  minSupportedVersion?: string;
  publishedAt?: string;
  updateType?: 'native_build' | 'ota_bundle';
}

export interface UpdateCheckResult {
  available: boolean;
  currentVersion: string;
  currentBuildNumber: number;
  latestVersion?: string;
  latestBuildNumber?: number;
  release?: AppRelease;
  error?: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready_to_install'
  | 'installing'
  | 'up_to_date'
  | 'error';

export interface UpdateProgressState {
  status: UpdateStatus;
  percentage: number;          // 0 to 100
  bytesWritten: number;
  totalBytesExpected: number;
  errorMessage?: string;
}
