import React, { useState } from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';
import { Setlist, ScoreItem } from '@/types/repertoire';

export default function SetlistsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { currentInstance, scores } = useRepertoire();

  const [expandedSetlistId, setExpandedSetlistId] = useState<string | null>(
    currentInstance?.setlists[0]?.id || null
  );

  const setlists = currentInstance?.setlists || [];

  const getScoreById = (id: string): ScoreItem | undefined => {
    return scores.find(s => s.id === id);
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
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <View style={[styles.titleRow, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.setlistTitle, { color: theme.text }]}>{item.title}</Text>
            </View>
            {item.date && (
              <View style={[styles.dateRow, { backgroundColor: 'transparent' }]}>
                <Ionicons name="calendar-outline" size={13} color={theme.tint} />
                <Text style={[styles.setDate, { color: theme.tint }]}>{item.date}</Text>
              </View>
            )}
            {item.description && (
              <Text style={[styles.setDescription, { color: theme.subtext }]}>
                {item.description}
              </Text>
            )}
          </View>

          <View style={[styles.headerRight, { backgroundColor: 'transparent' }]}>
            <View style={[styles.countBadge, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={[styles.countBadgeText, { color: theme.text }]}>
                {item.scoreIds.length} scores
              </Text>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.subtext}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded Score Order */}
        {isExpanded && (
          <View style={[styles.scoresOrderList, { borderTopColor: theme.border }]}>
            <Text style={[styles.orderHeader, { color: theme.subtext }]}>
              PERFORMANCE / REHEARSAL ORDER:
            </Text>

            {setlistScores.map((score, index) => {
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
                    <View style={[styles.miniVoicingBadge, { backgroundColor: voicingBg }]}>
                      <Text style={[styles.miniVoicingText, { color: voicingTextColor }]}>
                        {score.voicing}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Concert Programs</Text>
        <Text style={[styles.screenSub, { color: theme.subtext }]}>
          Ordered service folders & concert performance sequences
        </Text>
      </View>

      <FlatList
        data={setlists}
        keyExtractor={item => item.id}
        renderItem={renderSetlistItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { backgroundColor: 'transparent' }]}>
            <Ionicons name="folder-open-outline" size={48} color={theme.subtext} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Programs Configured</Text>
            <Text style={[styles.emptyText, { color: theme.subtext }]}>
              The music director hasn’t created any concert setlists for this ensemble yet.
            </Text>
          </View>
        }
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
    gap: 4,
    marginBottom: 4,
  },
  setDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  setDescription: {
    fontSize: 13,
    lineHeight: 18,
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
  orderHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
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
    maxWidth: 260,
  },
});
