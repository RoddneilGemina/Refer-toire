import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Share,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';
import PdfViewer from '@/components/PdfViewer';
import { ViewMode } from '@/components/PdfViewer.types';

export default function ScoreViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { scores, currentInstance, localUris, toggleFavorite, preferredVoicePart } =
    useRepertoire();

  // Find score from active repertoire or instance manifest
  const score =
    scores.find((s) => s.id === id) ||
    currentInstance?.scores.find((s) => s.id === id);

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

  const handleToggleFullscreen = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
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

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: activeBg }]}>
      {/* Top Action Bar (toggled with screen click or performance mode) */}
      {showControls && (
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

            {/* Web Fullscreen Toggle */}
            {Platform.OS === 'web' && (
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
            )}

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
          onPageChange={(p, total) => {
            setCurrentPage(p);
            setTotalPages(total);
          }}
          onLoadSuccess={(total) => {
            setTotalPages(total);
          }}
          onError={(err) => {
            console.warn('ScoreViewer PDF notice:', err);
          }}
          onToggleControls={() => {
            setShowControls((prev) => !prev);
          }}
        />

        {/* Page Turn Floating Controls (Single Page Mode) */}
        {viewMode === 'single' && (
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

            <View style={[styles.pageCounterPill, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={[styles.pageCounterText, { color: activeText }]}>
                {currentPage} / {totalPages}
              </Text>
            </View>

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
              {score.duration && (
                <Text style={[styles.metadataItem, { color: theme.subtext }]}>
                  Duration: <Text style={{ color: activeText, fontWeight: '600' }}>{score.duration}</Text>
                </Text>
              )}
            </View>

            <View style={[styles.tagsRow, { backgroundColor: 'transparent' }]}>
              {score.tags.map((tag) => (
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
});
