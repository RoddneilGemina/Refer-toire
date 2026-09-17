import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Share,
  Platform,
  Switch,
  Image,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';
import { DownloadService } from '@/services/downloadService';
import { NetworkService } from '@/services/networkService';
import { UpdateService } from '@/services/updateService';
import * as DocumentPicker from 'expo-document-picker';
import UploadScoreModal, { SelectedPdfFile } from '@/components/UploadScoreModal';
import EnsembleMembersModal from '@/components/EnsembleMembersModal';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const {
    currentUser,
    currentInstance,
    userRole,
    ensembleMembers,
    scores,
    isSyncing,
    isOfflineMode,
    setOfflineMode,
    reSyncAll,
    clearOfflineCache,
    signOut,
    signOutUser,
    uploadScore,
  } = useRepertoire();

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<string | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<SelectedPdfFile | null>(null);

  const handleCheckForUpdates = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    setUpdateCheckStatus('Checking for updates...');

    try {
      const result = await UpdateService.checkForUpdates(true);
      if (result.available && result.release) {
        setUpdateCheckStatus(`New build available: v${result.release.version}`);
        UpdateService.simulateUpdate(result.release);
      } else {
        setUpdateCheckStatus('Your app is up to date.');
        Alert.alert(
          'Up to Date',
          `Refertoire v${result.currentVersion} (Build ${result.currentBuildNumber}) is currently the latest version.`
        );
      }
    } catch (err: any) {
      setUpdateCheckStatus('Update check failed.');
      Alert.alert('Notice', 'Unable to check for updates right now.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handlePickScoreFile = async () => {
    if (isOfflineMode || !NetworkService.isOnline()) {
      Alert.alert(
        'Upload Unavailable',
        'You can only upload sheet music while in online mode with an active internet connection. Please disable Offline Mode first.'
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPendingUploadFile({
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
        });
      }
    } catch (err) {
      console.warn('Error opening file picker:', err);
    }
  };

  const downloadedCount = scores.filter(s => s.downloadStatus === 'completed').length;
  const totalScores = scores.length;
  const diskBytes = currentInstance ? DownloadService.getInstanceDiskUsage(currentInstance.code) : 0;
  const diskSizeMB = (diskBytes / (1024 * 1024)).toFixed(2);

  const handleResync = async () => {
    setResyncing(true);
    await reSyncAll();
    setResyncing(false);
  };

  const handleShareCode = async () => {
    if (!currentInstance) return;
    try {
      await Share.share({
        title: `Join ${currentInstance.name} on Refer-toire`,
        message: `Join our choir repertoire on the Refer-toire app! Use Choir Access Code: ${currentInstance.code} to download all our sheet music offline.`,
      });
    } catch {
      // Ignored
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearOfflineCache();
    } catch (err) {
      console.warn('Clear cache error:', err);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/login');
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Choir & Storage</Text>
        <Text style={[styles.screenSub, { color: theme.subtext }]}>
          Manage offline storage, member codes, and ensemble permissions
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Account Card */}
        {currentUser && (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}>
            <View style={[styles.cardHeader, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Signed In Account</Text>
              <TouchableOpacity
                onPress={async () => {
                  await signOutUser();
                  router.push('/login');
                }}>
                <Text style={[styles.switchLink, { color: Colors.status.failed }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.userProfileRow, { backgroundColor: 'transparent' }]}>
              <View style={[styles.userAvatar, { backgroundColor: theme.badgeBackground }]}>
                <Ionicons name="person" size={20} color={theme.tint} />
              </View>
              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <Text style={[styles.userName, { color: theme.text }]}>{currentUser.fullName}</Text>
                <Text style={[styles.userEmail, { color: theme.subtext }]}>{currentUser.email}</Text>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: userRole === 'admin' ? theme.badgeBackground : theme.surfaceSubtle }]}>
                <Text style={[styles.roleBadgeText, { color: userRole === 'admin' ? theme.badgeText : theme.subtext }]}>
                  {userRole === 'admin' ? '👑 Admin' : '👤 Member'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Active Ensemble & Role Card */}
        {currentInstance ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}>
            <View style={[styles.cardHeader, { backgroundColor: 'transparent' }]}>
              <View style={[styles.roleBadge, { backgroundColor: userRole === 'admin' ? theme.badgeBackground : theme.surfaceSubtle }]}>
                <Text style={[styles.roleBadgeText, { color: userRole === 'admin' ? theme.badgeText : theme.subtext }]}>
                  {userRole === 'admin' ? '👑 Group Director / Admin' : '👤 Ensemble Singer / Member'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={[styles.switchLink, { color: theme.tint }]}>Switch Group</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.choirTitle, { color: theme.text }]}>{currentInstance.name}</Text>
            {currentInstance.subtitle && (
              <Text style={[styles.choirSubtext, { color: theme.subtext }]}>
                {currentInstance.subtitle}
              </Text>
            )}

            <View style={[styles.infoRow, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.infoLabel, { color: theme.subtext }]}>Director:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {currentInstance.director}
              </Text>
            </View>

            <View style={[styles.infoRow, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.infoLabel, { color: theme.subtext }]}>Season:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {currentInstance.seasonName}
              </Text>
            </View>

            <View style={[styles.infoRow, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.infoLabel, { color: theme.subtext }]}>Access Code:</Text>
              <Text style={[styles.infoCodeValue, { color: theme.tint }]}>
                {currentInstance.code}
              </Text>
            </View>

            {/* View Ensemble Members Button */}
            <TouchableOpacity
              style={[
                styles.membersNavBtn,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
              ]}
              onPress={() => setShowMembersModal(true)}>
              <View style={[styles.membersNavLeft, { backgroundColor: 'transparent' }]}>
                <Ionicons name="people" size={18} color={theme.tint} style={{ marginRight: 8 }} />
                <Text style={[styles.membersNavTitle, { color: theme.text }]}>
                  Ensemble Members
                </Text>
                <View style={[styles.memberCountBadge, { backgroundColor: theme.badgeBackground }]}>
                  <Text style={[styles.memberCountText, { color: theme.badgeText }]}>
                    {ensembleMembers.length}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border, alignItems: 'center' },
            ]}
            onPress={() => router.push('/login')}>
            <Ionicons name="key-outline" size={32} color={theme.tint} style={{ marginBottom: 8 }} />
            <Text style={[styles.choirTitle, { color: theme.text }]}>No Choir Connected</Text>
            <Text style={[styles.choirSubtext, { color: theme.subtext, textAlign: 'center' }]}>
              Tap to enter an access code or create a new choir group
            </Text>
          </TouchableOpacity>
        )}

        {/* ADMIN INVITE & UPLOAD BANNER */}
        {userRole === 'admin' && currentInstance && (
          <View
            style={[
              styles.adminBannerCard,
              { backgroundColor: theme.badgeBackground, borderColor: theme.tint },
            ]}>
            <View style={[styles.adminBannerHeader, { backgroundColor: 'transparent' }]}>
              <Ionicons name="megaphone" size={20} color={theme.tint} />
              <Text style={[styles.adminBannerTitle, { color: theme.badgeText }]}>
                Invite Singers to Your Repertoire
              </Text>
            </View>

            <Text style={[styles.adminBannerText, { color: theme.badgeText }]}>
              Give this code to your choir members. When they enter it in Refer-toire, all uploaded scores will sync to their phones automatically:
            </Text>

            <View style={[styles.codeDisplayBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.bigCodeText, { color: theme.tint }]}>
                {currentInstance.code}
              </Text>
              <TouchableOpacity
                style={[styles.shareCodeBtn, { backgroundColor: theme.tint }]}
                onPress={handleShareCode}>
                <Ionicons name="share-social-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.shareCodeBtnText}>Share Code</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.adminUploadBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={handlePickScoreFile}>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.tint} style={{ marginRight: 8 }} />
              <Text style={[styles.adminUploadBtnText, { color: theme.text }]}>
                Upload New Sheet Music (PDF)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Network & Offline Mode Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setOfflineMode(!isOfflineMode)}
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <View style={[styles.switchCardRow, { backgroundColor: 'transparent' }]}>
            <View style={{ flex: 1, backgroundColor: 'transparent', paddingRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', gap: 6 }}>
                <Ionicons
                  name={isOfflineMode ? 'cloud-offline' : 'cloud-done'}
                  size={20}
                  color={isOfflineMode ? '#F59E0B' : Colors.status.completed}
                />
                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
                  {isOfflineMode ? 'Offline Mode Active' : 'Online Live Mode'}
                </Text>
              </View>
              <Text style={[styles.sectionSub, { color: theme.subtext, marginTop: 4, marginBottom: 0 }]}>
                {isOfflineMode
                  ? 'App uses cached repertoire with 0ms network latency. Tap to restore online sync.'
                  : 'Live synchronization is active. Changes and updates from the director will sync automatically.'}
              </Text>
            </View>
            <Switch
              value={isOfflineMode}
              onValueChange={setOfflineMode}
              trackColor={{ false: theme.surfaceSubtle, true: '#F59E0B' }}
              thumbColor={isOfflineMode ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>
        </TouchableOpacity>

        {/* Offline Storage Engine */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <View style={[styles.storageHeader, { backgroundColor: 'transparent' }]}>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Offline PDF Storage
              </Text>
              <Text style={[styles.sectionSub, { color: theme.subtext }]}>
                {downloadedCount} of {totalScores} scores stored locally
              </Text>
            </View>
            <Ionicons name="shield-checkmark" size={24} color={Colors.status.completed} />
          </View>

          {/* Storage Bar */}
          <View style={[styles.storageBarBg, { backgroundColor: theme.surfaceSubtle }]}>
            <View
              style={[
                styles.storageBarFill,
                {
                  backgroundColor: Colors.status.completed,
                  width: `${totalScores > 0 ? (downloadedCount / totalScores) * 100 : 0}%`,
                },
              ]}
            />
          </View>

          <View style={[styles.storageStatsRow, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.statText, { color: theme.subtext }]}>
              Disk Usage: {diskSizeMB} MB
            </Text>
            <Text style={[styles.statText, { color: Colors.status.completed }]}>
              {downloadedCount === totalScores ? '100% Offline Ready' : 'Incomplete Sync'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={[styles.buttonRow, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
              ]}
              onPress={handleResync}
              disabled={resyncing || isSyncing}>
              {resyncing || isSyncing ? (
                <ActivityIndicator size="small" color={theme.tint} />
              ) : (
                <>
                  <Ionicons name="sync-outline" size={16} color={theme.text} style={{ marginRight: 6 }} />
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>Re-sync All</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
              ]}
              onPress={handleClearCache}
              disabled={isClearingCache}>
              {isClearingCache ? (
                <ActivityIndicator size="small" color={Colors.status.failed} style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="trash-outline" size={16} color={Colors.status.failed} style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.actionButtonText, { color: Colors.status.failed }]}>
                {isClearingCache ? 'Clearing...' : 'Clear Cache'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Software Updates Section */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.cardHeader, { backgroundColor: 'transparent' }]}>
            <Ionicons name="cloud-download-outline" size={20} color={theme.tint} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Software Updates</Text>
          </View>
          <Text style={[styles.sectionSub, { color: theme.subtext }]}>
            Refertoire automatically scans for newer builds and notifies you when updates are ready.
          </Text>

          <View style={[styles.storageStatsRow, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.statText, { color: theme.text }]}>
              Installed: v{UpdateService.currentVersion} (Build {UpdateService.currentBuildNumber})
            </Text>
            {updateCheckStatus && (
              <Text style={[styles.statText, { color: updateCheckStatus.includes('New build') ? '#0D74CE' : Colors.status.completed }]}>
                {updateCheckStatus}
              </Text>
            )}
          </View>

          <View style={[styles.buttonRow, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, flex: 1, justifyContent: 'center' },
              ]}
              onPress={handleCheckForUpdates}
              disabled={isCheckingUpdate}>
              {isCheckingUpdate ? (
                <ActivityIndicator size="small" color={theme.tint} style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="refresh-outline" size={16} color={theme.text} style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.actionButtonText, { color: theme.text }]}>
                {isCheckingUpdate ? 'Scanning for Updates...' : 'Check for Updates'}
              </Text>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.tint, borderColor: theme.tint, marginLeft: 10, justifyContent: 'center' },
                ]}
                onPress={() => Linking.openURL('https://refertoire.github.io/apk/Refertoire.apk')}>
                <Ionicons name="logo-android" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: '#FFFFFF', fontWeight: '700' }]}>
                  Download APK
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sign Out / Disconnect Button */}
        {currentInstance && (
          <TouchableOpacity
            style={[
              styles.signOutButton,
              { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, opacity: isSigningOut ? 0.7 : 1 },
            ]}
            onPress={handleSignOut}
            disabled={isSigningOut}>
            {isSigningOut ? (
              <ActivityIndicator size="small" color={Colors.status.failed} style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="log-out-outline" size={18} color={Colors.status.failed} style={{ marginRight: 8 }} />
            )}
            <Text style={[styles.signOutText, { color: Colors.status.failed }]}>
              {isSigningOut ? 'Disconnecting...' : `Disconnect from ${currentInstance.code}`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Footer info */}
        <View style={[styles.appFooter, { backgroundColor: 'transparent', alignItems: 'center' }]}>
          <Image
            source={require('@/assets/images/refertoire-logo.png')}
            style={{ width: 48, height: 48, marginBottom: 8 }}
            resizeMode="contain"
          />
          <Text style={[styles.appFooterText, { color: theme.subtext }]}>
            Refertoire Choir Sync v1.0.0
          </Text>
          <Text style={[styles.appFooterSub, { color: theme.subtext }]}>
            Built with Expo SDK 57 & React Native
          </Text>
        </View>
      </ScrollView>

      {/* Upload Modal (accessible by admin from settings as well) */}
      <UploadScoreModal
        file={pendingUploadFile}
        onClose={() => setPendingUploadFile(null)}
        onUpload={uploadScore}
      />
      {/* Ensemble Members Roster Modal */}
      <EnsembleMembersModal
        visible={showMembersModal}
        onClose={() => setShowMembersModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  membersNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  membersNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  membersNavTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  memberCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  screenSub: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  switchCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  switchLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  choirTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  choirSubtext: {
    fontSize: 13,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoCodeValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  adminBannerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  adminBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  adminBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  adminBannerText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  codeDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  bigCodeText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  shareCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareCodeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  adminUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
  },
  adminUploadBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 12,
    marginBottom: 12,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  storageBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  storageBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  storageStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statText: {
    fontSize: 11,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
  },
  appFooter: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appFooterText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  appFooterSub: {
    fontSize: 11,
  },
});
