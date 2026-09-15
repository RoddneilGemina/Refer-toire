import React, { useState } from 'react';
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
import { Voicing, LiturgicalSeason, UploadScoreData } from '@/types/repertoire';

interface UploadScoreModalProps {
  visible: boolean;
  onClose: () => void;
  onUpload: (
    scoreData: UploadScoreData,
    file: { uri: string; name: string; size?: number }
  ) => Promise<any>;
}

const VOICING_OPTIONS: Voicing[] = ['SATB', 'SATB div.', 'SSAA', 'SSA', 'TTBB', 'SAB', 'Unison'];

export default function UploadScoreModal({ visible, onClose, onUpload }: UploadScoreModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  // Only Song Title is required
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size?: number } | null>(null);

  // Optional collapsible details
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [composer, setComposer] = useState('');
  const [voicing, setVoicing] = useState<Voicing>('SATB');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setSelectedFile(null);
    setComposer('');
    setVoicing('SATB');
    setShowOptionalDetails(false);
    setErrorMessage(null);
    setIsSubmitting(false);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
        });

        // Auto-fill song title from the selected PDF filename if title is empty
        if (!title && asset.name) {
          const cleanName = asset.name
            .replace(/\.[^/.]+$/, '') // Remove extension
            .replace(/[_-]/g, ' ') // Replace underscores and dashes with spaces
            .trim();
          setTitle(cleanName);
        }
      }
    } catch (err) {
      console.warn('Document picker error:', err);
      handleUseDemoFile();
    }
  };

  const handleUseDemoFile = () => {
    const demoName = 'Ave_Verum_Corpus.pdf';
    setSelectedFile({
      uri: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      name: demoName,
      size: 145000,
    });
    if (!title) {
      setTitle('Ave Verum Corpus');
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a PDF file first.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Please enter the song title.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onUpload(
        {
          title: title.trim(),
          composer: composer.trim() || undefined,
          voicing: voicing || 'SATB',
          season: 'General',
          tags: ['Uploaded'],
        },
        selectedFile
      );

      resetForm();
      onClose();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to upload file. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Upload Sheet Music</Text>
            <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
              Add a new PDF score to choir repertoire
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle }]}
            onPress={() => {
              resetForm();
              onClose();
            }}>
            <Ionicons name="close" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* PDF File Picker Section */}
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>PDF Sheet Music File *</Text>

            {selectedFile ? (
              <View style={[styles.filePreviewRow, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Ionicons name="document-text" size={32} color={theme.tint} />
                <View style={{ flex: 1, marginHorizontal: 10, backgroundColor: 'transparent' }}>
                  <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={[styles.fileSize, { color: Colors.status.completed }]}>
                    ✓ Ready to upload {selectedFile.size ? `(${(selectedFile.size / 1024).toFixed(1)} KB)` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                  <Ionicons name="close-circle" size={20} color={theme.subtext} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.pickerBox, { borderColor: theme.border, backgroundColor: theme.surfaceSubtle }]}>
                <Ionicons name="cloud-upload-outline" size={38} color={theme.tint} style={{ marginBottom: 6 }} />
                <Text style={[styles.pickerTitle, { color: theme.text }]}>Choose PDF Score</Text>
                <Text style={[styles.pickerHint, { color: theme.subtext }]}>
                  Select your digital sheet music file from device
                </Text>

                <View style={[styles.pickerActions, { backgroundColor: 'transparent' }]}>
                  <TouchableOpacity
                    style={[styles.pickButton, { backgroundColor: theme.tint }]}
                    onPress={handlePickDocument}>
                    <Ionicons name="folder-open-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.pickButtonText}>Browse PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.demoPickBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={handleUseDemoFile}>
                    <Text style={[styles.demoPickBtnText, { color: theme.subtext }]}>Use Sample File</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Song Title Input (The primary & required detail) */}
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Song Title *</Text>
            <Text style={[styles.fieldHint, { color: theme.subtext }]}>
              The title displayed in your choir repertoire library
            </Text>

            <TextInput
              style={[
                styles.titleInput,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="e.g. Hallelujah Chorus"
              placeholderTextColor={theme.subtext}
              value={title}
              onChangeText={t => {
                setTitle(t);
                setErrorMessage(null);
              }}
              autoFocus={Boolean(selectedFile)}
            />
          </View>

          {/* Optional Details Collapsible (Optional composer / voicing) */}
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
                {/* Composer */}
                <Text style={[styles.optionalLabel, { color: theme.text }]}>Composer (Optional)</Text>
                <TextInput
                  style={[styles.optionalInput, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text }]}
                  placeholder="e.g. George Frideric Handel"
                  placeholderTextColor={theme.subtext}
                  value={composer}
                  onChangeText={setComposer}
                />

                {/* Voicing */}
                <Text style={[styles.optionalLabel, { color: theme.text, marginTop: 10 }]}>Voicing</Text>
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
  pickerBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  pickerHint: {
    fontSize: 12,
    marginBottom: 14,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pickButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  demoPickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  demoPickBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
});
