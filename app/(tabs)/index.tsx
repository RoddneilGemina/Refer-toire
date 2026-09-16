import React, { useState } from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';
import { ScoreItem, Voicing, LiturgicalSeason, PieceGenre } from '@/types/repertoire';
import { SORT_OPTIONS } from '@/utils/sorting';
import * as DocumentPicker from 'expo-document-picker';
import UploadScoreModal, { SelectedPdfFile } from '@/components/UploadScoreModal';
import NetworkStatusBar from '@/components/NetworkStatusBar';

const VOICING_FILTERS: Array<Voicing | 'ALL'> = ['ALL', 'SATB', 'SSAA', 'TTBB', 'SAB'];
const SEASON_FILTERS: Array<LiturgicalSeason | 'ALL'> = ['ALL', 'Lent', 'Holy Week', 'Christmas', 'Concert', 'Evensong', 'General'];
const GENRE_FILTERS: Array<PieceGenre | 'ALL'> = ['ALL', 'Folk', 'Pop', 'Classical', 'Sacred', 'Contemporary', 'Jazz', 'Spiritual'];

export default function RepertoireLibraryScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const {
    currentInstance,
    userRole,
    isLoading,
    isSyncing,
    syncProgress,
    filteredAndSortedScores,
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    voicingFilter,
    setVoicingFilter,
    seasonFilter,
    setSeasonFilter,
    genreFilter,
    setGenreFilter,
    favoritesOnly,
    setFavoritesOnly,
    isOfflineMode,
    setOfflineMode,
    toggleFavorite,
    uploadScore,
    reSyncAll,
  } = useRepertoire();

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<SelectedPdfFile | null>(null);

  const handlePickScoreFile = async () => {
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

  // If no instance loaded, show welcome empty state
  if (!isLoading && !currentInstance) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={[styles.emptyContainer, { backgroundColor: 'transparent' }]}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceSubtle }]}>
            <Ionicons name="musical-notes-outline" size={54} color={theme.tint} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Choir Connected</Text>
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            Sign in with a choir access code or create a new ensemble repertoire group.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.tint }]}
            onPress={() => router.push('/login')}>
            <Ionicons name="key-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Join or Create Group</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderScoreItem = ({ item }: { item: ScoreItem }) => {
    const voicingColors = Colors.voicings[item.voicing] || {
      bg: theme.surfaceSubtle,
      text: theme.text,
      darkBg: theme.surfaceSubtle,
      darkText: theme.text,
    };
    const voicingBg = colorScheme === 'dark' ? voicingColors.darkBg : voicingColors.bg;
    const voicingTextColor = colorScheme === 'dark' ? voicingColors.darkText : voicingColors.text;

    return (
      <TouchableOpacity
        style={[
          styles.scoreCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
        onPress={() => router.push({ pathname: '/score/[id]', params: { id: item.id } })}
        activeOpacity={0.7}>
        <View style={[styles.scoreCardContent, { backgroundColor: 'transparent' }]}>
          {/* Top Row: Voicing, Season & Status */}
          <View style={[styles.metaRow, { backgroundColor: 'transparent' }]}>
            <View style={styles.badgesGroup}>
              <View style={[styles.voicingBadge, { backgroundColor: voicingBg }]}>
                <Text style={[styles.voicingText, { color: voicingTextColor }]}>
                  {item.voicing}
                </Text>
              </View>
              <View style={[styles.seasonBadge, { backgroundColor: theme.surfaceSubtle }]}>
                <Text style={[styles.seasonText, { color: theme.subtext }]}>{item.season}</Text>
              </View>
              {item.genre && (
                <View style={[styles.genreBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                  <Text style={[styles.genreText, { color: theme.tint }]}>{item.genre}</Text>
                </View>
              )}
            </View>

            <View style={styles.statusGroup}>
              {item.downloadStatus === 'completed' ? (
                <View style={styles.downloadedPill}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.status.completed} />
                  <Text style={styles.downloadedPillText}>Offline</Text>
                </View>
              ) : item.downloadStatus === 'downloading' ? (
                <ActivityIndicator size="small" color={theme.tint} />
              ) : (
                <Ionicons name="cloud-outline" size={16} color={theme.subtext} />
              )}

              <TouchableOpacity
                onPress={() => toggleFavorite(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.starButton}>
                <Ionicons
                  name={item.isFavorite ? 'star' : 'star-outline'}
                  size={20}
                  color={item.isFavorite ? '#F59E0B' : theme.subtext}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Title and Composer */}
          <Text style={[styles.scoreTitle, { color: theme.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.scoreComposer, { color: theme.subtext }]}>
            {item.composer}
            {item.arranger ? ` • arr. ${item.arranger}` : ''}
          </Text>

          {/* Bottom details (Key, Pages, Duration) */}
          <View style={[styles.footerRow, { backgroundColor: 'transparent' }]}>
            <View style={styles.footerDetail}>
              <Ionicons name="document-text-outline" size={13} color={theme.subtext} />
              <Text style={[styles.footerText, { color: theme.subtext }]}>
                {item.pageCount} pages
              </Text>
            </View>

            {item.keySignature && (
              <View style={styles.footerDetail}>
                <Ionicons name="musical-note-outline" size={13} color={theme.subtext} />
                <Text style={[styles.footerText, { color: theme.subtext }]}>
                  {item.keySignature}
                </Text>
              </View>
            )}

            {item.duration && (
              <View style={styles.footerDetail}>
                <Ionicons name="time-outline" size={13} color={theme.subtext} />
                <Text style={[styles.footerText, { color: theme.subtext }]}>{item.duration}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* App & Choir Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <View style={[styles.titleBadgeRow, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.choirName, { color: theme.text }]} numberOfLines={1}>
              {currentInstance?.name || 'Refer-toire'}
            </Text>
            <View
              style={[
                styles.rolePill,
                { backgroundColor: userRole === 'admin' ? theme.badgeBackground : theme.surfaceSubtle },
              ]}>
              <Text
                style={[
                  styles.rolePillText,
                  { color: userRole === 'admin' ? theme.badgeText : theme.subtext },
                ]}>
                {userRole === 'admin' ? '👑 Admin' : '👤 Member'}
              </Text>
            </View>
          </View>

          <Text style={[styles.choirSub, { color: theme.subtext }]}>
            {currentInstance?.director} • Code: {currentInstance?.code} • {currentInstance?.scores.length ?? 0} Scores
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.syncBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            onPress={() => reSyncAll()}
            disabled={isSyncing}>
            {isSyncing ? (
              <>
                <ActivityIndicator size="small" color={theme.tint} style={{ marginRight: 6 }} />
                <Text style={[styles.syncBadgeText, { color: theme.tint }]}>
                  {syncProgress
                    ? `${syncProgress.completedFiles}/${syncProgress.totalFiles}`
                    : 'Syncing...'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="cloud-done-outline"
                  size={16}
                  color={Colors.status.completed}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.syncBadgeText, { color: Colors.status.completed }]}>
                  Synced
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Network Connectivity Status Banner (Thin banner below the bar of account & code details) */}
      <NetworkStatusBar />

      {/* Search Bar & Filter Toggle */}
      <View style={[styles.searchSection, { backgroundColor: 'transparent' }]}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
          ]}>
          <Ionicons name="search" size={18} color={theme.subtext} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search titles, composers, tags..."
            placeholderTextColor={theme.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.subtext} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterToggleBtn,
            {
              backgroundColor:
                showFilterDrawer || favoritesOnly || voicingFilter !== 'ALL' || seasonFilter !== 'ALL'
                  ? theme.badgeBackground
                  : theme.surfaceSubtle,
              borderColor: theme.border,
            },
          ]}
          onPress={() => setShowFilterDrawer(!showFilterDrawer)}>
          <Ionicons
            name="options-outline"
            size={20}
            color={
              showFilterDrawer || favoritesOnly || voicingFilter !== 'ALL' || seasonFilter !== 'ALL'
                ? theme.tint
                : theme.subtext
            }
          />
        </TouchableOpacity>
      </View>

      {/* Quick Genre Filter Scroll Chips */}
      <View style={[styles.genreScrollWrapper, { backgroundColor: 'transparent' }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genreScrollContent}>
          {GENRE_FILTERS.map(g => {
            const isSelected = genreFilter === g;
            return (
              <TouchableOpacity
                key={g}
                style={[
                  styles.genreFilterChip,
                  isSelected
                    ? { backgroundColor: theme.tint, borderColor: theme.tint }
                    : { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                ]}
                onPress={() => setGenreFilter(g)}>
                <Text
                  style={[
                    styles.genreFilterChipText,
                    { color: isSelected ? '#FFFFFF' : theme.text, fontWeight: isSelected ? '700' : '500' },
                  ]}>
                  {g === 'ALL' ? 'All Genres' : g}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Collapsible Filter Bar (Voicing, Season, Favorites) */}
      {showFilterDrawer && (
        <View
          style={[
            styles.drawerContainer,
            { backgroundColor: theme.card, borderBottomColor: theme.border },
          ]}>
          {/* Voicing Filter Pills */}
          <Text style={[styles.filterGroupTitle, { color: theme.subtext }]}>VOICING</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {VOICING_FILTERS.map(v => (
              <TouchableOpacity
                key={v}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: voicingFilter === v ? theme.tint : theme.surfaceSubtle,
                  },
                ]}
                onPress={() => setVoicingFilter(v)}>
                <Text
                  style={[
                    styles.filterPillText,
                    { color: voicingFilter === v ? '#FFFFFF' : theme.text },
                  ]}>
                  {v}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Season Filter Pills */}
          <Text style={[styles.filterGroupTitle, { color: theme.subtext, marginTop: 10 }]}>
            SEASON / OCCASION
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {SEASON_FILTERS.map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: seasonFilter === s ? theme.tint : theme.surfaceSubtle,
                  },
                ]}
                onPress={() => setSeasonFilter(s)}>
                <Text
                  style={[
                    styles.filterPillText,
                    { color: seasonFilter === s ? '#FFFFFF' : theme.text },
                  ]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Favorites Only Toggle */}
          <View style={[styles.favToggleRow, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity
              style={[
                styles.favFilterChip,
                {
                  backgroundColor: favoritesOnly ? theme.tint : theme.surfaceSubtle,
                },
              ]}
              onPress={() => setFavoritesOnly(!favoritesOnly)}>
              <Ionicons
                name={favoritesOnly ? 'star' : 'star-outline'}
                size={16}
                color={favoritesOnly ? '#FFFFFF' : theme.text}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.filterPillText,
                  { color: favoritesOnly ? '#FFFFFF' : theme.text },
                ]}>
                Favorites Only
              </Text>
            </TouchableOpacity>

            {(voicingFilter !== 'ALL' || seasonFilter !== 'ALL' || favoritesOnly) && (
              <TouchableOpacity
                onPress={() => {
                  setVoicingFilter('ALL');
                  setSeasonFilter('ALL');
                  setFavoritesOnly(false);
                }}>
                <Text style={[styles.clearFilterText, { color: theme.tint }]}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Sorting Selector Chips */}
      <View style={[styles.sortSection, { backgroundColor: 'transparent' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
          <Text style={[styles.sortLabel, { color: theme.subtext }]}>Sort by:</Text>
          {SORT_OPTIONS.map(opt => {
            const isSelected = sortOption.field === opt.field;
            return (
              <TouchableOpacity
                key={opt.field}
                style={[
                  styles.sortChip,
                  {
                    backgroundColor: isSelected ? theme.badgeBackground : theme.surfaceSubtle,
                    borderColor: isSelected ? theme.tint : 'transparent',
                  },
                ]}
                onPress={() => setSortOption(opt)}>
                <Text
                  style={[
                    styles.sortChipText,
                    { color: isSelected ? theme.tint : theme.subtext, fontWeight: isSelected ? '700' : '500' },
                  ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Scores FlatList */}
      <FlatList
        data={filteredAndSortedScores}
        keyExtractor={item => item.id}
        renderItem={renderScoreItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={[styles.emptyList, { backgroundColor: 'transparent' }]}>
            <Ionicons name="musical-notes-outline" size={48} color={theme.subtext} />
            <Text style={[styles.emptyListTitle, { color: theme.text }]}>
              {currentInstance?.scores.length === 0
                ? 'Repertoire is Currently Empty'
                : 'No Matching Scores'}
            </Text>
            <Text style={[styles.emptyListSub, { color: theme.subtext }]}>
              {currentInstance?.scores.length === 0
                ? userRole === 'admin'
                  ? 'Your group is ready! As group director, tap below to upload the first sheet music PDF for your singers.'
                  : 'The music director has not uploaded any scores to this repertoire yet.'
                : 'Try adjusting your search query or removing active filters.'}
            </Text>

            {userRole === 'admin' && currentInstance?.scores.length === 0 && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.tint, marginTop: 16 }]}
                onPress={handlePickScoreFile}>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Upload First Score (PDF)</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Admin Floating Action Button (FAB) to Upload PDF */}
      {userRole === 'admin' && (
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: theme.tint }]}
          onPress={handlePickScoreFile}
          activeOpacity={0.8}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>Upload PDF</Text>
        </TouchableOpacity>
      )}

      {/* PDF Upload Modal (Only opens after choosing a file) */}
      <UploadScoreModal
        file={pendingUploadFile}
        onClose={() => setPendingUploadFile(null)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choirName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  choirSub: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  genreScrollWrapper: {
    paddingBottom: 8,
  },
  genreScrollContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  genreFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  genreFilterChipText: {
    fontSize: 12,
  },
  genreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  genreText: {
    fontSize: 10,
    fontWeight: '700',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterGroupTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  pillScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  favToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  favFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortSection: {
    paddingVertical: 8,
  },
  sortScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 80,
    gap: 12,
  },
  scoreCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  scoreCardContent: {},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voicingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  voicingText: {
    fontSize: 11,
    fontWeight: '700',
  },
  seasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  seasonText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  downloadedPillText: {
    color: Colors.status.completed,
    fontSize: 11,
    fontWeight: '600',
  },
  starButton: {
    padding: 2,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  scoreComposer: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
    paddingTop: 8,
  },
  footerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyListTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyListSub: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    gap: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
