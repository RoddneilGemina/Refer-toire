import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { AppRelease, UpdateProgressState } from '@/types/update';
import { UpdateService } from '@/services/updateService';

interface UpdateAvailableModalProps {
  visible: boolean;
  release: AppRelease | null;
  onDismiss: () => void;
}

export default function UpdateAvailableModal({
  visible,
  release,
  onDismiss,
}: UpdateAvailableModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [progressState, setProgressState] = useState<UpdateProgressState>({
    status: 'idle',
    percentage: 0,
    bytesWritten: 0,
    totalBytesExpected: 0,
  });

  if (!visible || !release) {
    return null;
  }

  const currentVersion = UpdateService.currentVersion;
  const isMandatory = Boolean(release.isMandatory);
  const isDownloading = progressState.status === 'downloading';
  const isReadyToInstall = progressState.status === 'ready_to_install';
  const isError = progressState.status === 'error';

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleStartUpdate = async () => {
    try {
      await UpdateService.downloadAndInstallUpdate(release, state => {
        setProgressState(state);
      });
    } catch (err) {
      // Error state already set via callback
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isMandatory && !isDownloading) {
          onDismiss();
        }
      }}>
      <View style={styles.overlay}>
        <View style={[styles.dialogCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Dismiss Button (if optional) */}
          {!isMandatory && !isDownloading && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={theme.subtext} />
            </TouchableOpacity>
          )}

          {/* Header Icon */}
          <View style={styles.headerIconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles" size={28} color="#0D74CE" />
            </View>
          </View>

          {/* Titles */}
          <Text style={[styles.titleText, { color: theme.text }]}>
            Newer Build Available
          </Text>
          <Text style={[styles.subtitleText, { color: theme.subtext }]}>
            A newer version of Refertoire is ready for you.
          </Text>

          {/* Version Comparison Pill */}
          <View style={[styles.versionPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            <View style={styles.versionBadge}>
              <Text style={[styles.versionLabel, { color: theme.subtext }]}>Current</Text>
              <Text style={[styles.versionValue, { color: theme.text }]}>v{currentVersion}</Text>
            </View>

            <Ionicons name="arrow-forward" size={18} color="#0D74CE" style={styles.arrowIcon} />

            <View style={[styles.versionBadge, styles.newVersionBadge]}>
              <Text style={styles.newVersionLabel}>Latest Build</Text>
              <Text style={styles.newVersionValue}>
                v{release.version} {release.buildNumber ? `(#${release.buildNumber})` : ''}
              </Text>
            </View>
          </View>

          {/* Release Notes / Changelog */}
          {release.releaseNotes && (
            <View style={styles.notesContainer}>
              <Text style={[styles.notesHeader, { color: theme.subtext }]}>WHAT'S NEW</Text>
              <ScrollView
                style={[styles.notesScroll, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                contentContainerStyle={styles.notesContent}
                nestedScrollEnabled>
                <Text style={[styles.notesText, { color: theme.text }]}>
                  {release.releaseNotes}
                </Text>
              </ScrollView>
            </View>
          )}

          {/* Download Progress Bar Section */}
          {(isDownloading || isReadyToInstall || isError) && (
            <View style={styles.progressSection}>
              <View style={styles.progressLabels}>
                <Text style={[styles.statusText, { color: isError ? Colors.status.failed : theme.subtext }]}>
                  {isDownloading
                    ? 'Downloading update package...'
                    : isReadyToInstall
                    ? 'Ready to install!'
                    : 'Download failed. Please retry.'}
                </Text>
                <Text style={[styles.percentageText, { color: theme.text }]}>
                  {progressState.percentage}%
                </Text>
              </View>

              {/* Progress Bar Track */}
              <View style={[styles.progressBarTrack, { backgroundColor: theme.surfaceSubtle }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressState.percentage}%`,
                      backgroundColor: isError ? Colors.status.failed : '#0D74CE',
                    },
                  ]}
                />
              </View>

              {/* Bytes Downloaded Info */}
              {progressState.totalBytesExpected > 0 && (
                <Text style={[styles.bytesInfo, { color: theme.subtext }]}>
                  {formatBytes(progressState.bytesWritten)} of {formatBytes(progressState.totalBytesExpected)}
                </Text>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            {/* Primary Action Button */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: isError ? Colors.status.failed : '#0D74CE',
                  opacity: isDownloading ? 0.85 : 1,
                },
              ]}
              onPress={handleStartUpdate}
              disabled={isDownloading}>
              {isDownloading ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>
                    Downloading ({progressState.percentage}%)
                  </Text>
                </>
              ) : isReadyToInstall ? (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Install Update</Text>
                </>
              ) : isError ? (
                <>
                  <Ionicons name="reload-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Retry Download</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Update Now</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Secondary Action: Later */}
            {!isMandatory && !isDownloading && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={onDismiss}>
                <Text style={[styles.secondaryBtnText, { color: theme.subtext }]}>
                  Remind Me Later
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
    padding: 4,
  },
  headerIconContainer: {
    marginBottom: 14,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(13, 116, 206, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13, 116, 206, 0.25)',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  versionBadge: {
    alignItems: 'flex-start',
  },
  versionLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  arrowIcon: {
    marginHorizontal: 8,
  },
  newVersionBadge: {
    alignItems: 'flex-end',
  },
  newVersionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0D74CE',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newVersionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D74CE',
    marginTop: 2,
  },
  notesContainer: {
    width: '100%',
    marginBottom: 18,
  },
  notesHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  notesScroll: {
    maxHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
  },
  notesContent: {
    padding: 12,
  },
  notesText: {
    fontSize: 12,
    lineHeight: 18,
  },
  progressSection: {
    width: '100%',
    marginBottom: 18,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  bytesInfo: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  actionButtonsContainer: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#0D74CE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    width: '100%',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
