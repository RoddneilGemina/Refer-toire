import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Share,
  Platform,
  Dimensions,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';
import { DatabaseService } from '@/services/databaseService';
import { supabase } from '@/lib/supabase';
import { ScoreItem } from '@/types/repertoire';
import PdfViewer from '@/components/PdfViewer';
import { ViewMode } from '@/components/PdfViewer.types';

export default function ScoreViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { scores, currentInstance, localUris, toggleFavorite, preferredVoicePart, userRole } =
    useRepertoire();

  const [fetchedScore, setFetchedScore] = useState<ScoreItem | null>(null);

  // Find score from active repertoire, instance manifest, or directly fetched
  const score =
    scores.find((s) => s.id === id) ||
    currentInstance?.scores.find((s) => s.id === id) ||
    fetchedScore;

  // Direct fetch fallback for direct URLs or page reloads
  useEffect(() => {
    if (!score && id) {
      supabase
        .from('scores')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (data) {
            setFetchedScore({
              id: data.id,
              title: data.title,
              composer: data.composer,
              voicing: data.voicing,
              season: (data.category as any) || 'General',
              keySignature: data.key_signature,
              tempo: data.tempo,
              duration: data.duration,
              pageCount: data.page_count || 1,
              sourceUrl: data.source_url,
              localUri: data.source_url,
              notes: data.notes,
              tags: data.tags || [],
              fileSize: data.file_size || 0,
              downloadStatus: 'completed',
              addedAt: data.created_at || new Date().toISOString(),
            });
          }
        });
    }
  }, [id, score]);

  // Sheet Music Reader States
  const [stageMode, setStageMode] = useState<boolean>(false);
  const [sepiaMode, setSepiaMode] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(score?.pageCount || 1);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Go to Page Modal State
  const [showGoToPageModal, setShowGoToPageModal] = useState<boolean>(false);
  const [targetPageInput, setTargetPageInput] = useState<string>('');

  // Sync totalPages if score metadata changes
  useEffect(() => {
    if (score?.pageCount && score.pageCount > totalPages) {
      setTotalPages(score.pageCount);
    }
  }, [score?.pageCount]);

  // Handle Fullscreen change listener on Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleFsChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }
  }, []);

  // Ensure orientation is re-locked to portrait when navigating away from score viewer
  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
  }, []);

  if (!score) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={[styles.notFoundContainer, { backgroundColor: 'transparent' }]}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.status.failed} />
          <Text style={[styles.notFoundTitle, { color: theme.text }]}>Score Not Found</Text>
          <Text style={[styles.notFoundSub, { color: theme.subtext }]}>
            This musical score may have been removed or is not available.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: theme.tint }]}>Return to Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const voicingColors = (Colors.voicings as Record<string, any>)[score.voicing] || {
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

  const activeBg = stageMode ? stageBackground : sepiaMode ? '#FAF5EA' : theme.background;
  const activeCard = stageMode ? stageCard : sepiaMode ? '#F2E8D3' : theme.card;
  const activeText = stageMode ? stageText : sepiaMode ? '#4A3B2C' : theme.text;
  const activeBorder = stageMode ? stageBorder : sepiaMode ? '#E2D5BE' : theme.border;

  // Resolved PDF target
  const resolvedLocalUri = localUris[score.id] || score.localUri;

  const handleShare = async () => {
    try {
      if (resolvedLocalUri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(resolvedLocalUri, {
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

  const handleToggleFullscreen = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {}
        setIsFullscreen(true);
      } else {
        try {
          await document.exitFullscreen();
        } catch {}
        setIsFullscreen(false);
      }
      return;
    }

    try {
      if (!isFullscreen) {
        // Unlock orientation to allow both portrait and landscape viewing
        await ScreenOrientation.unlockAsync();
        setIsFullscreen(true);
      } else {
        // Re-lock to standard portrait orientation
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Screen orientation toggle notice:', err);
      setIsFullscreen(!isFullscreen);
    }
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.5, +(prev + 0.2).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(0.6, +(prev - 0.2).toFixed(2)));
  };

  const handleResetZoom = () => {
    setZoomScale(1.0);
  };

  const handlePrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  const handlePageChange = useCallback((p: number, total: number) => {
    setCurrentPage(p);
    setTotalPages(total);
  }, []);

  const handleOpenGoToPage = useCallback(() => {
    setTargetPageInput(String(currentPage));
    setShowGoToPageModal(true);
  }, [currentPage]);

  const handleJumpToPage = useCallback((pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setShowGoToPageModal(false);
    }
  }, [totalPages]);

  const handleJumpSubmit = useCallback(() => {
    const num = parseInt(targetPageInput.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      handleJumpToPage(num);
    } else {
      Alert.alert('Invalid Page', `Please enter a page number between 1 and ${totalPages}.`);
    }
  }, [targetPageInput, totalPages, handleJumpToPage]);

  const handleLoadSuccess = useCallback((total: number) => {
    if (total > 0) {
      setTotalPages(total);
      if (score && score.pageCount !== total && currentInstance?.code) {
        score.pageCount = total;
        DatabaseService.updateScorePageCount(currentInstance.code, score.id, total);
      }
    }
  }, [score, currentInstance?.code]);

  const handleToggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: activeBg }]}>
      <StatusBar
        hidden={isFullscreen}
        backgroundColor={activeBg}
        barStyle={colorScheme === 'dark' || stageMode ? 'light-content' : 'dark-content'}
      />

      {/* Floating Exit Fullscreen Button - sole UI element in Fullscreen */}
      {isFullscreen && (
        <TouchableOpacity
          style={styles.exitFullscreenFloatingBtn}
          onPress={handleToggleFullscreen}
          activeOpacity={0.85}
          accessibilityLabel="Exit Fullscreen Mode">
          <Ionicons name="contract-outline" size={18} color="#FFFFFF" />
          <Text style={styles.exitFullscreenFloatingText}>Exit Fullscreen</Text>
        </TouchableOpacity>
      )}

      {/* Top Action Bar (toggled with screen click or performance mode - hidden in fullscreen) */}
      {!isFullscreen && showControls && (
        <View style={[styles.header, { backgroundColor: activeCard, borderBottomColor: activeBorder }]}>
          {/* Back Button */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.surfaceSubtle }]}
            onPress={() => router.back()}
            accessibilityLabel="Back to Repertoire">
            <Ionicons name="chevron-back" size={20} color={activeText} />
          </TouchableOpacity>

          {/* Title & Composer Info */}
          <View style={{ flex: 1, marginHorizontal: 10, backgroundColor: 'transparent' }}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: activeText }]} numberOfLines={1}>
                {score.title}
              </Text>
              <View style={[styles.headerVoicingBadge, { backgroundColor: voicingBg }]}>
                <Text style={[styles.headerVoicingText, { color: voicingTextColor }]}>
                  {score.voicing}
                </Text>
              </View>
            </View>
            <Text style={[styles.headerSub, { color: theme.subtext }]} numberOfLines={1}>
              {score.composer}
              {preferredVoicePart ? ` • Your Part: ${preferredVoicePart}` : ''}
              {score.keySignature ? ` • ${score.keySignature}` : ''}
            </Text>
          </View>

          {/* Reader Controls Toolbar */}
          <View style={[styles.headerActions, { backgroundColor: 'transparent' }]}>
            {/* Zoom Controls */}
            <View style={[styles.zoomGroup, { backgroundColor: theme.surfaceSubtle }]}>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={handleZoomOut}
                disabled={zoomScale <= 0.6}
                accessibilityLabel="Zoom Out">
                <Ionicons name="remove" size={16} color={activeText} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.zoomResetBtn}
                onPress={handleResetZoom}
                accessibilityLabel="Reset Zoom">
                <Text style={[styles.zoomText, { color: activeText }]}>
                  {Math.round(zoomScale * 100)}%
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={handleZoomIn}
                disabled={zoomScale >= 2.5}
                accessibilityLabel="Zoom In">
                <Ionicons name="add" size={16} color={activeText} />
              </TouchableOpacity>
            </View>

            {/* Single Page vs Continuous Scroll Mode */}
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: theme.surfaceSubtle,
                },
              ]}
              accessibilityLabel={viewMode === 'single' ? 'Switch to Continuous Scroll' : 'Switch to Single Page'}
              onPress={() => setViewMode(viewMode === 'single' ? 'scroll' : 'single')}>
              <Ionicons
                name={viewMode === 'single' ? 'document-text-outline' : 'albums-outline'}
                size={18}
                color={activeText}
              />
            </TouchableOpacity>

            {/* Sepia Parchment Mode Toggle */}
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: sepiaMode ? '#F59E0B22' : theme.surfaceSubtle,
                  borderColor: sepiaMode ? '#D97706' : 'transparent',
                  borderWidth: sepiaMode ? 1 : 0,
                },
              ]}
              accessibilityLabel="Warm Parchment Tone"
              onPress={() => {
                setSepiaMode(!sepiaMode);
                if (!sepiaMode) setStageMode(false);
              }}>
              <Ionicons
                name={sepiaMode ? 'sunny' : 'sunny-outline'}
                size={18}
                color={sepiaMode ? '#D97706' : activeText}
              />
            </TouchableOpacity>

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
              accessibilityLabel="Dark Stage Mode (Concert Hall Inversion)"
              onPress={() => {
                setStageMode(!stageMode);
                if (!stageMode) setSepiaMode(false);
              }}>
              <Ionicons
                name={stageMode ? 'flash' : 'flash-outline'}
                size={18}
                color={stageMode ? '#F59E0B' : activeText}
              />
            </TouchableOpacity>

            {/* Fullscreen Mode Toggle (Web & Native) */}
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.surfaceSubtle }]}
              accessibilityLabel={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              onPress={handleToggleFullscreen}>
              <Ionicons
                name={isFullscreen ? 'contract-outline' : 'expand-outline'}
                size={18}
                color={activeText}
              />
            </TouchableOpacity>

            {/* Go to Page Action */}
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.surfaceSubtle }]}
              accessibilityLabel="Go to Page"
              onPress={handleOpenGoToPage}>
              <Ionicons name="navigate-outline" size={18} color={activeText} />
            </TouchableOpacity>

            {/* Share / Open External (forScore) */}
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.surfaceSubtle }]}
              accessibilityLabel="Share / Export PDF"
              onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color={activeText} />
            </TouchableOpacity>

            {/* Favorite Toggle */}
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.surfaceSubtle }]}
              accessibilityLabel="Favorite Score"
              onPress={() => toggleFavorite(score.id)}>
              <Ionicons
                name={score.isFavorite ? 'star' : 'star-outline'}
                size={18}
                color={score.isFavorite ? '#F59E0B' : activeText}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Full-Featured PDF Viewer Canvas / Reader */}
      <View style={[styles.viewerContainer, { backgroundColor: activeBg }]}>
        <PdfViewer
          sourceUrl={score.sourceUrl}
          localUri={resolvedLocalUri}
          title={score.title}
          composer={score.composer}
          voicing={score.voicing}
          notes={score.notes}
          initialPage={currentPage}
          stageMode={stageMode}
          sepiaMode={sepiaMode}
          viewMode={viewMode}
          zoomScale={zoomScale}
          onPageChange={handlePageChange}
          onLoadSuccess={handleLoadSuccess}
          onError={(err) => {
            console.warn('ScoreViewer PDF notice:', err);
          }}
          onToggleControls={handleToggleControls}
        />

        {/* Page Turn Floating Controls (Single Page Mode - hidden in fullscreen) */}
        {!isFullscreen && viewMode === 'single' && (
          <View
            style={[
              styles.pageControls,
              {
                backgroundColor: activeCard,
                borderColor: activeBorder,
              },
            ]}>
            <TouchableOpacity
              style={[styles.pageBtn, { opacity: currentPage > 1 ? 1 : 0.3 }]}
              disabled={currentPage <= 1}
              onPress={handlePrevPage}
              accessibilityLabel="Previous Page (Left Arrow / Foot Pedal)">
              <Ionicons name="chevron-back" size={20} color={activeText} />
              <Text style={[styles.pageBtnText, { color: activeText }]}>Prev</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pageCounterPill, { backgroundColor: theme.surfaceSubtle }]}
              onPress={handleOpenGoToPage}
              accessibilityLabel="Tap to jump to page">
              <Text style={[styles.pageCounterText, { color: activeText }]}>
                {currentPage} / {totalPages}
              </Text>
              <Ionicons name="swap-horizontal-outline" size={13} color={theme.subtext} style={{ marginLeft: 5 }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pageBtn, { opacity: currentPage < totalPages ? 1 : 0.3 }]}
              disabled={currentPage >= totalPages}
              onPress={handleNextPage}
              accessibilityLabel="Next Page (Right Arrow / Foot Pedal)">
              <Text style={[styles.pageBtnText, { color: activeText }]}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color={activeText} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Collapsible Conductor Notes & Metadata Drawer (hidden in fullscreen) */}
      {!isFullscreen && (
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

            <View style={styles.metadataGrid}>
              {score.tempo && (
                <Text style={[styles.metadataItem, { color: theme.subtext }]}>
                  Tempo: <Text style={{ color: activeText, fontWeight: '600' }}>{score.tempo}</Text>
                </Text>
              )}
              {score.keySignature && (
                <Text style={[styles.metadataItem, { color: theme.subtext }]}>
                  Key: <Text style={{ color: activeText, fontWeight: '600' }}>{score.keySignature}</Text>
                </Text>
              )}
            </View>

            <View style={[styles.tagsRow, { backgroundColor: 'transparent' }]}>
              {score.tags.map((tag: string) => (
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
      )}

      {/* Go to Page Modal */}
      <Modal
        visible={showGoToPageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoToPageModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGoToPageModal(false)}>
          <View
            style={[
              styles.goToPageCard,
              { backgroundColor: activeCard, borderColor: activeBorder },
            ]}
            onStartShouldSetResponder={() => true}>
            <View style={styles.goToPageHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
                <Ionicons name="navigate-circle-outline" size={22} color={theme.tint} />
                <Text style={[styles.goToPageTitle, { color: activeText }]}>Go to Page</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowGoToPageModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={theme.subtext} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.goToPageSub, { color: theme.subtext }]}>
              Enter a page number (1 – {totalPages}) or tap below:
            </Text>

            {/* Input Row */}
            <View style={styles.goToPageInputRow}>
              <TextInput
                style={[
                  styles.goToPageInput,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    color: activeText,
                  },
                ]}
                keyboardType="number-pad"
                value={targetPageInput}
                onChangeText={setTargetPageInput}
                placeholder="Page #"
                placeholderTextColor={theme.subtext}
                selectTextOnFocus
                autoFocus
                onSubmitEditing={handleJumpSubmit}
              />
              <TouchableOpacity
                style={[styles.goToPageSubmitBtn, { backgroundColor: theme.tint }]}
                onPress={handleJumpSubmit}>
                <Text style={styles.goToPageSubmitText}>Go</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>

            {/* Quick-Jump Chips (Horizontal Scroll) */}
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.quickJumpLabel, { color: theme.subtext }]}>All Pages:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickJumpChips}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  const isCur = p === currentPage;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.quickPageChip,
                        {
                          backgroundColor: isCur ? theme.tint : theme.surfaceSubtle,
                          borderColor: isCur ? theme.tint : theme.border,
                        },
                      ]}
                      onPress={() => handleJumpToPage(p)}>
                      <Text
                        style={[
                          styles.quickPageChipText,
                          { color: isCur ? '#FFFFFF' : activeText, fontWeight: isCur ? '700' : '500' },
                        ]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerVoicingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  headerVoicingText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomResetBtn: {
    paddingHorizontal: 6,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 11,
    fontWeight: '700',
  },
  viewerContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  pageControls: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    gap: 12,
    zIndex: 20,
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
    paddingHorizontal: 12,
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
    paddingTop: 6,
    paddingBottom: 12,
    zIndex: 15,
  },
  drawerHandle: {
    alignItems: 'center',
  },
  drawerBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
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
    fontSize: 12,
    fontWeight: '600',
  },
  drawerContent: {
    marginTop: 10,
    gap: 8,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  metadataGrid: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  metadataItem: {
    fontSize: 11,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    marginBottom: 6,
  },
  notFoundSub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 300,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(13, 116, 206, 0.1)',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  exitFullscreenFloatingBtn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 42,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    gap: 7,
  },
  exitFullscreenFloatingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  goToPageCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  goToPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  goToPageTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  goToPageSub: {
    fontSize: 13,
    marginBottom: 16,
  },
  goToPageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  goToPageInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  goToPageSubmitBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goToPageSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  quickJumpLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickJumpChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  quickPageChip: {
    minWidth: 44,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  quickPageChipText: {
    fontSize: 14,
  },
});
