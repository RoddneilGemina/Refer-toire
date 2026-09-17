import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Setlist, ScoreItem } from '@/types/repertoire';
import { useRepertoire } from '@/context/RepertoireContext';

interface ProgramEditorModalProps {
  visible: boolean;
  programToEdit?: Setlist | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProgramEditorModal({
  visible,
  programToEdit,
  onClose,
  onSaved,
}: ProgramEditorModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { scores, createProgram, updateProgram } = useRepertoire();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [selectedScoreIds, setSelectedScoreIds] = useState<string[]>([]);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (programToEdit) {
        setTitle(programToEdit.title);
        setDate(programToEdit.date || '');
        setVenue(programToEdit.venue || '');
        setDescription(programToEdit.description || '');
        setSelectedScoreIds([...programToEdit.scoreIds]);
      } else {
        setTitle('');
        setDate('');
        setVenue('');
        setDescription('');
        setSelectedScoreIds([]);
      }
      setShowAddPicker(false);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [visible, programToEdit]);

  const handleToggleScore = (scoreId: string) => {
    setSelectedScoreIds(prev => {
      if (prev.includes(scoreId)) {
        return prev.filter(id => id !== scoreId);
      } else {
        return [...prev, scoreId];
      }
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setSelectedScoreIds(prev => {
      const cloned = [...prev];
      const temp = cloned[index - 1];
      cloned[index - 1] = cloned[index];
      cloned[index] = temp;
      return cloned;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedScoreIds.length - 1) return;
    setSelectedScoreIds(prev => {
      const cloned = [...prev];
      const temp = cloned[index + 1];
      cloned[index + 1] = cloned[index];
      cloned[index] = temp;
      return cloned;
    });
  };

  const handleRemove = (scoreId: string) => {
    setSelectedScoreIds(prev => prev.filter(id => id !== scoreId));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorMessage('Please enter a program title.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (programToEdit) {
        const res = await updateProgram(programToEdit.id, {
          title: title.trim(),
          date: date.trim() || undefined,
          venue: venue.trim() || undefined,
          description: description.trim() || undefined,
          scoreIds: selectedScoreIds,
        });
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to update program.');
          return;
        }
      } else {
        const res = await createProgram({
          title: title.trim(),
          date: date.trim() || undefined,
          venue: venue.trim() || undefined,
          description: description.trim() || undefined,
          scoreIds: selectedScoreIds,
        });
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to create program.');
          return;
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save program.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selected score items in order
  const selectedScores = selectedScoreIds
    .map(id => scores.find(s => s.id === id))
    .filter((s): s is ScoreItem => Boolean(s));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {programToEdit ? 'Edit Concert Program' : 'Create Concert Program'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
              Organize performance folders and ordered repertoire sets
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle }]}
            onPress={onClose}>
            <Ionicons name="close" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Program Title */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Program Title <Text style={{ color: Colors.status.failed }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="e.g. Spring Festival 2026, Sunday Service"
              placeholderTextColor={theme.subtext}
              value={title}
              onChangeText={text => {
                setTitle(text);
                if (errorMessage) setErrorMessage(null);
              }}
              returnKeyType="done"
            />
          </View>

          {/* Date & Venue Row */}
          <View style={styles.twoColumnRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Event Date (Optional)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="e.g. Oct 24, 2026"
                placeholderTextColor={theme.subtext}
                value={date}
                onChangeText={setDate}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Venue / Hall (Optional)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="e.g. Concert Hall"
                placeholderTextColor={theme.subtext}
                value={venue}
                onChangeText={setVenue}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Notes / Director Description</Text>
            <TextInput
              style={[
                styles.textInputArea,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="e.g. Performance notes, choir call times, or concert details..."
              placeholderTextColor={theme.subtext}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Pieces Inside Program Folder */}
          <View style={[styles.folderSection, { borderColor: theme.border }]}>
            <View style={[styles.folderHeaderRow, { backgroundColor: 'transparent' }]}>
              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <View style={[styles.folderTitleRow, { backgroundColor: 'transparent' }]}>
                  <Ionicons name="folder-open" size={18} color={theme.tint} style={{ marginRight: 6 }} />
                  <Text style={[styles.folderTitle, { color: theme.text }]}>
                    Program Pieces ({selectedScores.length})
                  </Text>
                </View>
                <Text style={[styles.folderSub, { color: theme.subtext }]}>
                  Arrange the performance order of scores in this folder
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.addPieceBtn, { backgroundColor: theme.tint }]}
                onPress={() => setShowAddPicker(!showAddPicker)}>
                <Ionicons
                  name={showAddPicker ? 'checkmark' : 'add'}
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.addPieceBtnText}>{showAddPicker ? 'Done Adding' : 'Add Pieces'}</Text>
              </TouchableOpacity>
            </View>

            {/* Checklist of Repertoire Scores to Add */}
            {showAddPicker && (
              <View
                style={[
                  styles.pickerContainer,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                ]}>
                <Text style={[styles.pickerHeader, { color: theme.subtext }]}>
                  TAP TO INCLUDE IN THIS PROGRAM:
                </Text>
                {scores.length === 0 ? (
                  <Text style={[styles.emptyPickerText, { color: theme.subtext }]}>
                    No scores uploaded yet. Upload sheet music in Repertoire tab first.
                  </Text>
                ) : (
                  scores.map(s => {
                    const isSelected = selectedScoreIds.includes(s.id);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.pickerItem,
                          {
                            backgroundColor: isSelected ? theme.card : 'transparent',
                            borderColor: isSelected ? theme.tint : 'transparent',
                          },
                        ]}
                        onPress={() => handleToggleScore(s.id)}>
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={isSelected ? theme.tint : theme.subtext}
                          style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                          <Text style={[styles.pickerItemTitle, { color: theme.text }]} numberOfLines={1}>
                            {s.title}
                          </Text>
                          <Text style={[styles.pickerItemComposer, { color: theme.subtext }]}>
                            {s.composer} • {s.voicing} {s.genre ? `• ${s.genre}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            {/* Ordered Scores List */}
            {selectedScores.length === 0 ? (
              <View style={[styles.emptyFolderBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Ionicons name="musical-notes-outline" size={32} color={theme.subtext} style={{ marginBottom: 6 }} />
                <Text style={[styles.emptyFolderTitle, { color: theme.text }]}>No Pieces Added Yet</Text>
                <Text style={[styles.emptyFolderText, { color: theme.subtext }]}>
                  Click "Add Pieces" above to choose sheet music from your repertoire.
                </Text>
              </View>
            ) : (
              selectedScores.map((score, index) => (
                <View
                  key={score.id}
                  style={[
                    styles.orderItemCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}>
                  <View style={[styles.orderIndexBadge, { backgroundColor: theme.tint }]}>
                    <Text style={styles.orderIndexText}>{index + 1}</Text>
                  </View>

                  <View style={{ flex: 1, backgroundColor: 'transparent', marginLeft: 10 }}>
                    <Text style={[styles.orderScoreTitle, { color: theme.text }]} numberOfLines={1}>
                      {score.title}
                    </Text>
                    <Text style={[styles.orderScoreMeta, { color: theme.subtext }]}>
                      {score.composer} • {score.voicing} {score.genre ? `• ${score.genre}` : ''}
                    </Text>
                  </View>

                  {/* Re-order & Remove Controls */}
                  <View style={[styles.orderActions, { backgroundColor: 'transparent' }]}>
                    <TouchableOpacity
                      style={[styles.moveBtn, { opacity: index === 0 ? 0.3 : 1 }]}
                      onPress={() => handleMoveUp(index)}
                      disabled={index === 0}>
                      <Ionicons name="chevron-up" size={18} color={theme.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.moveBtn, { opacity: index === selectedScores.length - 1 ? 0.3 : 1 }]}
                      onPress={() => handleMoveDown(index)}
                      disabled={index === selectedScores.length - 1}>
                      <Ionicons name="chevron-down" size={18} color={theme.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemove(score.id)}>
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {errorMessage && (
            <View style={[styles.errorBox, { backgroundColor: 'transparent' }]}>
              <Ionicons name="alert-circle" size={18} color={Colors.status.failed} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.tint, opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>
                  {programToEdit ? 'Update Program' : 'Create Program'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.border }]}
            onPress={onClose}
            disabled={isSubmitting}>
            <Text style={[styles.cancelButtonText, { color: theme.subtext }]}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  textInputArea: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  folderSection: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
  },
  folderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  folderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  folderSub: {
    fontSize: 12,
    marginTop: 2,
  },
  addPieceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addPieceBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    maxHeight: 220,
  },
  pickerHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  emptyPickerText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  pickerItemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickerItemComposer: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyFolderBox: {
    padding: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFolderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyFolderText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  orderItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
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
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  orderScoreTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderScoreMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moveBtn: {
    padding: 6,
    borderRadius: 6,
  },
  removeBtn: {
    padding: 6,
    borderRadius: 6,
    marginLeft: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  errorText: {
    color: Colors.status.failed,
    fontSize: 13,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
