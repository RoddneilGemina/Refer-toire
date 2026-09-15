import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';
import { DownloadService } from '@/services/downloadService';
import UploadScoreModal from '@/components/UploadScoreModal';

const VOICE_SECTIONS = [
  { id: 'Soprano 1', label: 'Soprano 1' },
  { id: 'Soprano 2', label: 'Soprano 2' },
  { id: 'Alto 1', label: 'Alto 1' },
  { id: 'Alto 2', label: 'Alto 2' },
  { id: 'Tenor 1', label: 'Tenor 1' },
  { id: 'Tenor 2', label: 'Tenor 2' },
  { id: 'Baritone', label: 'Baritone' },
  { id: 'Bass', label: 'Bass' },
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const {
    currentInstance,
    userRole,
    scores,
    isSyncing,
    reSyncAll,
    clearOfflineCache,
    signOut,
    preferredVoicePart,
    setPreferredVoicePart,
    uploadScore,
  } = useRepertoire();

  const [resyncing, setResyncing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

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

  const handleClearCache = () => {
    Alert.alert(
      'Clear Local PDF Cache',
      'This will delete all locally saved PDF files. You can re-download them anytime while connected to the internet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            await clearOfflineCache();
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Switch Choir Ensemble',
      'Sign out of the current repertoire instance? Your downloaded files will remain saved on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login');
          },
        },
      ]
    );
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
              onPress={() => setShowUploadModal(true)}>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.tint} style={{ marginRight: 8 }} />
              <Text style={[styles.adminUploadBtnText, { color: theme.text }]}>
                Upload New Sheet Music (PDF)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Singer Voice Part Preference */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>My Voice Section</Text>
          <Text style={[styles.sectionSub, { color: theme.subtext }]}>
            Sets your default vocal part for score rehearsals
          </Text>

          <View style={[styles.voiceChipsContainer, { backgroundColor: 'transparent' }]}>
            {VOICE_SECTIONS.map(v => {
              const isSelected = preferredVoicePart === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.voiceChip,
                    {
                      backgroundColor: isSelected ? theme.tint : theme.surfaceSubtle,
                      borderColor: isSelected ? theme.tint : theme.border,
                    },
                  ]}
                  onPress={() => setPreferredVoicePart(isSelected ? null : v.id)}>
                  <Text
                    style={[
                      styles.voiceChipText,
                      { color: isSelected ? '#FFFFFF' : theme.text },
                    ]}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

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
              onPress={handleClearCache}>
              <Ionicons name="trash-outline" size={16} color={Colors.status.failed} style={{ marginRight: 6 }} />
              <Text style={[styles.actionButtonText, { color: Colors.status.failed }]}>
                Clear Cache
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out / Disconnect Button */}
        {currentInstance && (
          <TouchableOpacity
            style={[
              styles.signOutButton,
              { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
            ]}
            onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color={Colors.status.failed} style={{ marginRight: 8 }} />
            <Text style={[styles.signOutText, { color: Colors.status.failed }]}>
              Disconnect from {currentInstance.code}
            </Text>
          </TouchableOpacity>
        )}

        {/* Footer info */}
        <View style={[styles.appFooter, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.appFooterText, { color: theme.subtext }]}>
            Refer-toire Choir Sync v1.0.0
          </Text>
          <Text style={[styles.appFooterSub, { color: theme.subtext }]}>
            Built with Expo SDK 57 & React Native
          </Text>
        </View>
      </ScrollView>

      {/* Upload Modal (accessible by admin from settings as well) */}
      <UploadScoreModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={uploadScore}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  voiceChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  voiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  voiceChipText: {
    fontSize: 13,
    fontWeight: '600',
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
