import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Voicing, UploadScoreData, PieceGenre } from '@/types/repertoire';

export interface SelectedPdfFile {
  uri: string;
  name: string;
  size?: number;
}

interface UploadScoreModalProps {
  file: SelectedPdfFile | null;
  onClose: () => void;
  onUpload: (
    scoreData: UploadScoreData,
    file: SelectedPdfFile
  ) => Promise<any>;
}

const VOICING_OPTIONS: Voicing[] = ['SATB', 'SATB div.', 'SSAA', 'SSA', 'TTBB', 'SAB', 'Unison'];
const GENRE_OPTIONS: PieceGenre[] = [
  'Folk',
  'Pop',
  'Classical',
  'Sacred',
  'Contemporary',
  'Jazz',
  'Spiritual',
  'Renaissance',
  'World',
  'Musical Theatre',
  'General',
];

const cleanFileNameToTitle = (filename: string): string => {
  return filename
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[_-]/g, ' ') // Replace underscores and dashes with spaces
    .replace(/\s+/g, ' ')
    .trim();
};

export default function UploadScoreModal({ file, onClose, onUpload }: UploadScoreModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  // Active selected file (starts from prop, can be swapped via Change File)
  const [selectedFile, setSelectedFile] = useState<SelectedPdfFile | null>(file);

  // The single required field
  const [title, setTitle] = useState('');

  // Optional details
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [composer, setComposer] = useState('');
  const [voicing, setVoicing] = useState<Voicing>('SATB');
  const [genre, setGenre] = useState<PieceGenre>('General');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever prop `file` changes
  useEffect(() => {
    if (file) {
      setSelectedFile(file);
      setTitle(cleanFileNameToTitle(file.name));
      setComposer('');
      setVoicing('SATB');
      setGenre('General');
      setShowOptionalDetails(false);
      setErrorMessage(null);
      setIsSubmitting(false);
    } else {
      setSelectedFile(null);
      setTitle('');
    }
  }, [file]);

  // If no file has been chosen yet, do not display modal
  if (!file || !selectedFile) {
    return null;
  }

  const handlePickDifferentFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newFile: SelectedPdfFile = {
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
        };
        setSelectedFile(newFile);
        setTitle(cleanFileNameToTitle(asset.name));
      }
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorMessage('Please enter the song title.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await onUpload(
        {
          title: title.trim(),
          composer: composer.trim() || undefined,
          voicing: voicing || 'SATB',
          season: 'General',
          genre: genre || 'General',
          tags: ['Uploaded', genre || 'General'],
        },
        selectedFile
      );

      if (result && !result.success) {
        setErrorMessage(result.error || 'Failed to upload score. Please try again.');
        return;
      }

      onClose();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to upload score. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={Boolean(file && selectedFile)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Upload Sheet Music</Text>
            <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
              Confirm title and add score to choir repertoire
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle }]}
            onPress={onClose}>
            <Ionicons name="close" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Chosen File Card */}
          <View style={[styles.fileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.fileCardTop}>
              <View style={[styles.fileIconWrapper, { backgroundColor: theme.surfaceSubtle }]}>
                <Ionicons name="document-text" size={30} color="#EF4444" />
              </View>

              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <View style={styles.badgeRow}>
                  <View style={[styles.pdfBadge, { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.pdfBadgeText}>PDF SCORE</Text>
                  </View>
                  <Text style={[styles.readyText, { color: Colors.status.completed }]}>
                    ✓ File Selected
                  </Text>
                </View>

                <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={2}>
                  {selectedFile.name}
                </Text>

                {selectedFile.size !== undefined && selectedFile.size > 0 && (
                  <Text style={[styles.fileSize, { color: theme.subtext }]}>
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.changeFileBtn, { borderColor: theme.border, backgroundColor: theme.surfaceSubtle }]}
              onPress={handlePickDifferentFile}>
              <Ionicons name="swap-horizontal" size={16} color={theme.tint} style={{ marginRight: 6 }} />
              <Text style={[styles.changeFileText, { color: theme.tint }]}>Change PDF File</Text>
            </TouchableOpacity>
          </View>

          {/* Song Title Input (The primary & single required detail) */}
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Song Title *</Text>
            <Text style={[styles.fieldHint, { color: theme.subtext }]}>
              Enter the title to display in your choir's repertoire library
            </Text>

            <TextInput
              style={[
                styles.titleInput,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="e.g. Ave Verum Corpus"
              placeholderTextColor={theme.subtext}
              value={title}
              onChangeText={t => {
                setTitle(t);
                setErrorMessage(null);
              }}
              autoFocus
              selectTextOnFocus
            />
          </View>

          {/* Optional Details Collapsible (Voicing & Composer) */}
          <View style={[styles.optionalSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.optionalToggleRow, { backgroundColor: 'transparent' }]}
              onPress={() => setShowOptionalDetails(!showOptionalDetails)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' }}>
                <Ionicons name="options-outline" size={16} color={theme.subtext} />
                <Text style={[styles.optionalToggleText, { color: theme.subtext }]}>
                  Additional Details (Optional)
                </Text>
              </View>
              <Ionicons
                name={showOptionalDetails ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.subtext}
              />
            </TouchableOpacity>

            {showOptionalDetails && (
              <View style={[styles.optionalBody, { backgroundColor: 'transparent' }]}>
                {/* Genre / Piece Type */}
                <Text style={[styles.optionalLabel, { color: theme.text }]}>Genre / Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {GENRE_OPTIONS.map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: genre === g ? theme.tint : theme.surfaceSubtle,
                          borderColor: genre === g ? theme.tint : theme.border,
                        },
                      ]}
                      onPress={() => setGenre(g)}>
                      <Text style={[styles.chipText, { color: genre === g ? '#FFFFFF' : theme.text }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Composer */}
                <Text style={[styles.optionalLabel, { color: theme.text, marginTop: 12 }]}>Composer (Optional)</Text>
                <TextInput
                  style={[
                    styles.optionalInput,
                    { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
                  ]}
                  placeholder="e.g. W.A. Mozart"
                  placeholderTextColor={theme.subtext}
                  value={composer}
                  onChangeText={setComposer}
                />

                {/* Voicing */}
                <Text style={[styles.optionalLabel, { color: theme.text, marginTop: 12 }]}>Voicing</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {VOICING_OPTIONS.map(v => (
                    <TouchableOpacity
                      key={v}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: voicing === v ? theme.tint : theme.surfaceSubtle,
                          borderColor: voicing === v ? theme.tint : theme.border,
                        },
                      ]}
                      onPress={() => setVoicing(v)}>
                      <Text style={[styles.chipText, { color: voicing === v ? '#FFFFFF' : theme.text }]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
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
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Upload Song</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cancel Button */}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  fileCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  fileCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  fileIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  pdfBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pdfBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  readyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  fileSize: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  changeFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  changeFileText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 12,
    marginBottom: 10,
  },
  titleInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  optionalSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  optionalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionalBody: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  optionalLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  optionalInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    color: Colors.status.failed,
    fontSize: 13,
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    marginTop: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
