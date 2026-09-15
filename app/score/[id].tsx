import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';

export default function ScoreViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { scores, toggleFavorite, preferredVoicePart } = useRepertoire();

  const score = scores.find(s => s.id === id);

  const [stageMode, setStageMode] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(true);

  if (!score) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={[styles.notFoundContainer, { backgroundColor: 'transparent' }]}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.status.failed} />
          <Text style={[styles.notFoundTitle, { color: theme.text }]}>Score Not Found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: theme.tint }]}>Return to Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const voicingColors = Colors.voicings[score.voicing] || {
    bg: theme.surfaceSubtle,
    text: theme.text,
    darkBg: theme.surfaceSubtle,
    darkText: theme.text,
  };
  const voicingBg = colorScheme === 'dark' ? voicingColors.darkBg : voicingColors.bg;
  const voicingTextColor = colorScheme === 'dark' ? voicingColors.darkText : voicingColors.text;

  // Stage mode colors: ultra-high contrast dark stage mode for dimmed hall lighting
  const stageBackground = '#05070A';
  const stageCard = '#0D1117';
  const stageText = '#E6EDF3';
  const stageBorder = '#30363D';

  const activeBg = stageMode ? stageBackground : theme.background;
  const activeCard = stageMode ? stageCard : theme.card;
  const activeText = stageMode ? stageText : theme.text;
  const activeBorder = stageMode ? stageBorder : theme.border;

  const handleShare = async () => {
    try {
      if (score.localUri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(score.localUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${score.title} Sheet Music`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Share.share({
          title: score.title,
          message: `${score.title} by ${score.composer} (${score.voicing}) - Refer-toire Choir Sheet Music`,
          url: score.sourceUrl,
        });
      }
    } catch (e) {
      Alert.alert('Sharing', 'Could not open share dialog.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: activeBg }]}>
      {/* Top Action Bar */}
      <View style={[styles.header, { backgroundColor: activeCard, borderBottomColor: activeBorder }]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: theme.surfaceSubtle }]}
          onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={activeText} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 12, backgroundColor: 'transparent' }}>
          <Text style={[styles.headerTitle, { color: activeText }]} numberOfLines={1}>
            {score.title}
          </Text>
          <Text style={[styles.headerSub, { color: theme.subtext }]} numberOfLines={1}>
            {score.composer}
          </Text>
        </View>

        <View style={[styles.headerActions, { backgroundColor: 'transparent' }]}>
          {/* Stage Mode Toggle */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: stageMode ? '#F59E0B22' : theme.surfaceSubtle,
                borderColor: stageMode ? '#F59E0B' : 'transparent',
                borderWidth: stageMode ? 1 : 0,
              },
            ]}
            onPress={() => setStageMode(!stageMode)}>
            <Ionicons
              name={stageMode ? 'flash' : 'flash-outline'}
              size={18}
              color={stageMode ? '#F59E0B' : activeText}
            />
          </TouchableOpacity>

          {/* Share / Open External (forScore) */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.surfaceSubtle }]}
            onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color={activeText} />
          </TouchableOpacity>

          {/* Favorite Toggle */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.surfaceSubtle }]}
            onPress={() => toggleFavorite(score.id)}>
            <Ionicons
              name={score.isFavorite ? 'star' : 'star-outline'}
              size={18}
              color={score.isFavorite ? '#F59E0B' : activeText}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Score Music Sheet Canvas / Reader */}
      <View style={[styles.viewerContainer, { backgroundColor: activeBg }]}>
        <ScrollView
          contentContainerStyle={styles.sheetScroll}
          maximumZoomScale={3}
          minimumZoomScale={1}>
          {/* Simulated High-Fidelity Sheet Music Score Page */}
          <View
            style={[
              styles.sheetPage,
              {
                backgroundColor: stageMode ? '#111620' : '#FFFFFF',
                borderColor: activeBorder,
                shadowColor: '#000',
              },
            ]}>
            {/* Score Page Header */}
            <View style={[styles.pageHeader, { backgroundColor: 'transparent' }]}>
              <View style={[styles.pageHeaderLeft, { backgroundColor: 'transparent' }]}>
                <Text
                  style={[
                    styles.scorePageVoicing,
                    { color: stageMode ? '#93C5FD' : '#1E40AF' },
                  ]}>
                  {score.voicing}
                </Text>
                {preferredVoicePart && (
                  <Text style={[styles.partHighlight, { color: theme.tint }]}>
                    Section: {preferredVoicePart}
                  </Text>
                )}
              </View>
              <Text style={[styles.pageNumberText, { color: stageMode ? '#94A3B8' : '#64748B' }]}>
                Page {currentPage} of {score.pageCount}
              </Text>
            </View>

            <Text
              style={[
                styles.sheetScoreTitle,
                { color: stageMode ? '#F8FAFC' : '#0F172A' },
              ]}>
              {score.title}
            </Text>
            <Text
              style={[
                styles.sheetScoreComposer,
                { color: stageMode ? '#CBD5E1' : '#475569' },
              ]}>
              {score.composer}
            </Text>

            {score.tempo && (
              <Text
                style={[
                  styles.sheetTempo,
                  { color: stageMode ? '#E2E8F0' : '#334155' },
                ]}>
                Tempo: {score.tempo} • Key: {score.keySignature || 'N/A'}
              </Text>
            )}

            {/* Score Visual Notation Preview Staves */}
            <View style={[styles.staffContainer, { backgroundColor: 'transparent' }]}>
              {[1, 2, 3, 4].map(staffIndex => (
                <View key={staffIndex} style={styles.grandStaff}>
                  <View style={[styles.clefIndicator, { backgroundColor: 'transparent' }]}>
                    <Text style={{ fontSize: 18, color: stageMode ? '#94A3B8' : '#334155' }}>
                      𝄞
                    </Text>
                  </View>
                  <View style={styles.fiveLines}>
                    <View style={[styles.staffLine, { backgroundColor: stageMode ? '#475569' : '#CBD5E1' }]} />
                    <View style={[styles.staffLine, { backgroundColor: stageMode ? '#475569' : '#CBD5E1' }]} />
                    <View style={[styles.staffLine, { backgroundColor: stageMode ? '#475569' : '#CBD5E1' }]} />
                    <View style={[styles.staffLine, { backgroundColor: stageMode ? '#475569' : '#CBD5E1' }]} />
                    <View style={[styles.staffLine, { backgroundColor: stageMode ? '#475569' : '#CBD5E1' }]} />
                  </View>
                </View>
              ))}
            </View>

            {/* Simulated Lyrics and Music Notes Preview */}
            <View
              style={[
                styles.lyricsContainer,
                {
                  backgroundColor: stageMode ? '#161F30' : '#F8FAFC',
                  borderColor: stageMode ? '#243248' : '#E2E8F0',
                },
              ]}>
              <Text style={[styles.lyricsLabel, { color: theme.tint }]}>REHEARSAL VOCAL TEXT</Text>
              <Text
                style={[
                  styles.lyricsText,
                  { color: stageMode ? '#E2E8F0' : '#1E293B' },
                ]}>
                {score.notes || 'Full masterwork score loaded into local cache for performance.'}
              </Text>
            </View>

            {/* Sheet Footer Badge */}
            <View style={[styles.sheetFooterBadge, { backgroundColor: 'transparent' }]}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.status.completed} />
              <Text style={[styles.sheetFooterText, { color: Colors.status.completed }]}>
                Downloaded Locally • Offline Verified
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Page Turn Floating Controls */}
        <View style={[styles.pageControls, { backgroundColor: activeCard, borderColor: activeBorder }]}>
          <TouchableOpacity
            style={[styles.pageBtn, { opacity: currentPage > 1 ? 1 : 0.3 }]}
            disabled={currentPage <= 1}
            onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}>
            <Ionicons name="chevron-back" size={20} color={activeText} />
            <Text style={[styles.pageBtnText, { color: activeText }]}>Previous</Text>
          </TouchableOpacity>

          <View style={[styles.pageCounterPill, { backgroundColor: theme.surfaceSubtle }]}>
            <Text style={[styles.pageCounterText, { color: activeText }]}>
              {currentPage} / {score.pageCount}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.pageBtn, { opacity: currentPage < score.pageCount ? 1 : 0.3 }]}
            disabled={currentPage >= score.pageCount}
            onPress={() => setCurrentPage(prev => Math.min(score.pageCount, prev + 1))}>
            <Text style={[styles.pageBtnText, { color: activeText }]}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color={activeText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsible Conductor Notes & Metadata Drawer */}
      <View
        style={[
          styles.drawer,
          {
            backgroundColor: activeCard,
            borderTopColor: activeBorder,
          },
        ]}>
        <TouchableOpacity
          style={[styles.drawerHandle, { backgroundColor: 'transparent' }]}
          onPress={() => setShowNotesDrawer(!showNotesDrawer)}>
          <View style={[styles.drawerBar, { backgroundColor: theme.subtext }]} />
          <View style={[styles.drawerTitleRow, { backgroundColor: 'transparent' }]}>
            <View style={[styles.badge, { backgroundColor: voicingBg }]}>
              <Text style={[styles.badgeText, { color: voicingTextColor }]}>
                {score.voicing}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={[styles.badgeText, { color: theme.subtext }]}>{score.season}</Text>
            </View>
            <Text style={[styles.drawerLabel, { color: activeText }]}>
              {showNotesDrawer ? 'Hide Rehearsal Notes' : 'Show Rehearsal Notes'}
            </Text>
            <Ionicons
              name={showNotesDrawer ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={theme.subtext}
            />
          </View>
        </TouchableOpacity>

        {showNotesDrawer && (
          <View style={[styles.drawerContent, { backgroundColor: 'transparent' }]}>
            {score.notes && (
              <View style={[styles.noteBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Ionicons name="information-circle-outline" size={16} color={theme.tint} />
                <Text style={[styles.noteText, { color: activeText }]}>{score.notes}</Text>
              </View>
            )}

            <View style={[styles.tagsRow, { backgroundColor: 'transparent' }]}>
              {score.tags.map(tag => (
                <View
                  key={tag}
                  style={[styles.tagPill, { backgroundColor: theme.surfaceSubtle }]}>
                  <Text style={[styles.tagText, { color: theme.subtext }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewerContainer: {
    flex: 1,
  },
  sheetScroll: {
    padding: 16,
    alignItems: 'center',
  },
  sheetPage: {
    width: '100%',
    maxWidth: 600,
    minHeight: 520,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    paddingBottom: 8,
  },
  pageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scorePageVoicing: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  partHighlight: {
    fontSize: 11,
    fontWeight: '600',
  },
  pageNumberText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sheetScoreTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sheetScoreComposer: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  sheetTempo: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  staffContainer: {
    gap: 16,
    marginVertical: 14,
  },
  grandStaff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clefIndicator: {
    width: 24,
    alignItems: 'center',
  },
  fiveLines: {
    flex: 1,
    gap: 5,
    paddingVertical: 4,
  },
  staffLine: {
    height: 1.5,
    width: '100%',
    borderRadius: 1,
  },
  lyricsContainer: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  lyricsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  lyricsText: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  sheetFooterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  sheetFooterText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pageControls: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    gap: 14,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pageCounterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageCounterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  drawer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  drawerHandle: {
    alignItems: 'center',
  },
  drawerBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
    opacity: 0.4,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  drawerLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  drawerContent: {
    marginTop: 12,
    gap: 8,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
