import React, { useState } from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';
import { Setlist, ScoreItem } from '@/types/repertoire';
import ProgramEditorModal from '@/components/ProgramEditorModal';

export default function SetlistsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { currentInstance, scores, userRole, deleteProgram } = useRepertoire();

  const [expandedSetlistId, setExpandedSetlistId] = useState<string | null>(
    currentInstance?.setlists[0]?.id || null
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Setlist | null>(null);

  const setlists = currentInstance?.setlists || [];

  const getScoreById = (id: string): ScoreItem | undefined => {
    return scores.find(s => s.id === id);
  };

  const handleOpenCreateModal = () => {
    setEditingProgram(null);
    setModalVisible(true);
  };

  const handleOpenEditModal = (program: Setlist) => {
    setEditingProgram(program);
    setModalVisible(true);
  };

  const handleDeleteProgram = (program: Setlist) => {
    const doDelete = async () => {
      await deleteProgram(program.id);
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Delete program "${program.title}"?\n\nThis will remove the program folder.`
      );
      if (confirmed) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Program',
        `Are you sure you want to delete "${program.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const renderSetlistItem = ({ item }: { item: Setlist }) => {
    const isExpanded = expandedSetlistId === item.id;
    const setlistScores = item.scoreIds
      .map(id => getScoreById(id))
      .filter((s): s is ScoreItem => Boolean(s));

    return (
      <View
        style={[
          styles.setlistCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        {/* Setlist Header */}
        <TouchableOpacity
          style={[styles.setlistHeader, { backgroundColor: 'transparent' }]}
          onPress={() => setExpandedSetlistId(isExpanded ? null : item.id)}
          activeOpacity={0.7}>
          <View style={[styles.folderIconBadge, { backgroundColor: theme.surfaceSubtle }]}>
            <Ionicons name={isExpanded ? 'folder-open' : 'folder'} size={22} color={theme.tint} />
          </View>

          <View style={{ flex: 1, backgroundColor: 'transparent', marginLeft: 12 }}>
            <View style={[styles.titleRow, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.setlistTitle, { color: theme.text }]}>{item.title}</Text>
            </View>

            {(item.date || item.venue) && (
              <View style={[styles.dateRow, { backgroundColor: 'transparent' }]}>
                {item.date && (
                  <View style={[styles.metaPill, { backgroundColor: 'transparent' }]}>
                    <Ionicons name="calendar-outline" size={12} color={theme.tint} />
                    <Text style={[styles.setDate, { color: theme.tint }]}>{item.date}</Text>
                  </View>
                )}
                {item.venue && (
                  <View style={[styles.metaPill, { backgroundColor: 'transparent' }]}>
                    <Ionicons name="location-outline" size={12} color={theme.subtext} />
                    <Text style={[styles.setVenue, { color: theme.subtext }]}>{item.venue}</Text>
                  </View>
                )}
              </View>
            )}

            {item.description && (
              <Text style={[styles.setDescription, { color: theme.subtext }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>

          <View style={[styles.headerRight, { backgroundColor: 'transparent' }]}>
            <View style={[styles.countBadge, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={[styles.countBadgeText, { color: theme.text }]}>
                {item.scoreIds.length} {item.scoreIds.length === 1 ? 'score' : 'scores'}
              </Text>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.subtext}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded Score Order & Admin Program Controls */}
        {isExpanded && (
          <View style={[styles.scoresOrderList, { borderTopColor: theme.border }]}>
            {/* Admin Action Bar */}
            {userRole === 'admin' && (
              <View style={[styles.adminActionsRow, { borderBottomColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.editProgramBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                  onPress={() => handleOpenEditModal(item)}>
                  <Ionicons name="create-outline" size={14} color={theme.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.editProgramBtnText, { color: theme.text }]}>Edit Program</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteProgramBtn, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
                  onPress={() => handleDeleteProgram(item)}>
                  <Ionicons name="trash-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                  <Text style={styles.deleteProgramBtnText}>Delete Program</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.sectionHeadingRow, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.orderHeader, { color: theme.subtext }]}>
                PERFORMANCE REPERTOIRE SEQUENCE:
              </Text>
              {setlistScores.length > 0 && (
                <Text style={[styles.scoresCountSummary, { color: theme.tint }]}>
                  {setlistScores.length} pieces in folder
                </Text>
              )}
            </View>

            {setlistScores.length === 0 ? (
              <View style={[styles.emptyScoresNotice, { backgroundColor: theme.surfaceSubtle }]}>
                <Ionicons name="musical-notes-outline" size={24} color={theme.subtext} style={{ marginBottom: 4 }} />
                <Text style={[styles.emptyScoresText, { color: theme.subtext }]}>
                  No pieces added to this program folder yet.
                </Text>
                {userRole === 'admin' && (
                  <TouchableOpacity
                    style={[styles.addScoresQuickBtn, { backgroundColor: theme.tint }]}
                    onPress={() => handleOpenEditModal(item)}>
                    <Text style={styles.addScoresQuickBtnText}>Add Pieces from Repertoire</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              setlistScores.map((score, index) => {
                const voicingColors = Colors.voicings[score.voicing] || {
                  bg: theme.surfaceSubtle,
                  text: theme.text,
                  darkBg: theme.surfaceSubtle,
                  darkText: theme.text,
                };
                const voicingBg = colorScheme === 'dark' ? voicingColors.darkBg : voicingColors.bg;
                const voicingTextColor =
                  colorScheme === 'dark' ? voicingColors.darkText : voicingColors.text;

                return (
                  <TouchableOpacity
                    key={score.id}
                    style={[
                      styles.orderItem,
                      { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                    ]}
                    onPress={() =>
                      router.push({ pathname: '/score/[id]', params: { id: score.id } })
                    }>
                    <View style={[styles.orderIndexBadge, { backgroundColor: theme.badgeBackground }]}>
                      <Text style={[styles.orderIndexText, { color: theme.badgeText }]}>
                        {index + 1}
                      </Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: 'transparent', marginLeft: 10 }}>
                      <Text style={[styles.orderScoreTitle, { color: theme.text }]} numberOfLines={1}>
                        {score.title}
                      </Text>
                      <Text style={[styles.orderScoreComposer, { color: theme.subtext }]}>
                        {score.composer}
                      </Text>
                    </View>

                    <View style={[styles.orderRight, { backgroundColor: 'transparent' }]}>
                      {score.genre && (
                        <View style={[styles.miniGenreBadge, { backgroundColor: theme.card, borderColor: theme.border }]}>
                          <Text style={[styles.miniGenreText, { color: theme.tint }]}>
                            {score.genre}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.miniVoicingBadge, { backgroundColor: voicingBg }]}>
                        <Text style={[styles.miniVoicingText, { color: voicingTextColor }]}>
                          {score.voicing}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Screen Header with Admin Create Button */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>Concert Programs</Text>
          <Text style={[styles.screenSub, { color: theme.subtext }]}>
            Ordered service folders & performance sequences
          </Text>
        </View>

        {userRole === 'admin' && (
          <TouchableOpacity
            style={[styles.createProgramBtn, { backgroundColor: theme.tint }]}
            onPress={handleOpenCreateModal}>
            <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.createProgramBtnText}>New Program</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={setlists}
        keyExtractor={item => item.id}
        renderItem={renderSetlistItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { backgroundColor: 'transparent' }]}>
            <Ionicons name="folder-open-outline" size={52} color={theme.subtext} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Programs Created Yet</Text>
            <Text style={[styles.emptyText, { color: theme.subtext }]}>
              {userRole === 'admin'
                ? 'Create a concert or rehearsal program folder and arrange the performance order of your pieces.'
                : 'The director has not configured any concert program folders yet.'}
            </Text>
            {userRole === 'admin' && (
              <TouchableOpacity
                style={[styles.emptyCreateBtn, { backgroundColor: theme.tint }]}
                onPress={handleOpenCreateModal}>
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyCreateBtnText}>Create First Program</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Program Editor Modal */}
      <ProgramEditorModal
        visible={modalVisible}
        programToEdit={editingProgram}
        onClose={() => setModalVisible(false)}
        onSaved={() => {
          if (editingProgram) {
            setExpandedSetlistId(editingProgram.id);
          }
        }}
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
  createProgramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  createProgramBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  setlistCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  setlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  folderIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    marginBottom: 4,
  },
  setlistTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  setVenue: {
    fontSize: 12,
  },
  setDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 12,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scoresOrderList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  adminActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editProgramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  editProgramBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteProgramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  deleteProgramBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  scoresCountSummary: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyScoresNotice: {
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScoresText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  addScoresQuickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addScoresQuickBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  orderIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIndexText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orderScoreTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderScoreComposer: {
    fontSize: 12,
  },
  orderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniGenreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  miniGenreText: {
    fontSize: 10,
    fontWeight: '700',
  },
  miniVoicingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniVoicingText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
