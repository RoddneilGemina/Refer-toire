import React, { useState } from 'react';
import {
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
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

const VOICING_OPTIONS: Voicing[] = ['SATB', 'SATB div.', 'SSAA', 'SSA', 'TTBB', 'SAB', 'Unison', 'Solo & Choir'];
const SEASON_OPTIONS: LiturgicalSeason[] = ['Concert', 'General', 'Lent', 'Holy Week', 'Easter', 'Advent', 'Christmas', 'Evensong'];

export default function UploadScoreModal({ visible, onClose, onUpload }: UploadScoreModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [arranger, setArranger] = useState('');
  const [voicing, setVoicing] = useState<Voicing>('SATB');
  const [season, setSeason] = useState<LiturgicalSeason>('Concert');
  const [keySignature, setKeySignature] = useState('');
  const [tempo, setTempo] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size?: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setComposer('');
    setArranger('');
    setVoicing('SATB');
    setSeason('Concert');
    setKeySignature('');
    setTempo('');
    setNotes('');
    setSelectedFile(null);
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

        // Pre-fill title if empty from filename
        if (!title && asset.name) {
          const cleanName = asset.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setTitle(cleanName);
        }
      }
    } catch (err) {
      console.warn('Document picker error:', err);
      // Fallback demo file
      handleUseDemoFile();
    }
  };

  const handleUseDemoFile = () => {
    setSelectedFile({
      uri: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      name: 'Sample_Choral_Score.pdf',
      size: 145000,
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorMessage('Please enter the score title.');
      return;
    }
    if (!composer.trim()) {
      setErrorMessage('Please enter the composer.');
      return;
    }
    if (!selectedFile) {
      setErrorMessage('Please choose a PDF sheet music file.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onUpload(
        {
          title: title.trim(),
          composer: composer.trim(),
          arranger: arranger.trim() || undefined,
          voicing,
          season,
          keySignature: keySignature.trim() || undefined,
          tempo: tempo.trim() || undefined,
          notes: notes.trim() || undefined,
          tags: [season, voicing, 'Uploaded'],
        },
        selectedFile
      );

      resetForm();
      onClose();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to upload score. Please try again.');
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>Upload Score PDF</Text>
            <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
              Add sheet music to choir repertoire
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
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Sheet Music PDF File</Text>

            {selectedFile ? (
              <View style={[styles.filePreviewRow, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Ionicons name="document-text" size={32} color={theme.tint} />
                <View style={{ flex: 1, marginHorizontal: 10, backgroundColor: 'transparent' }}>
                  <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={[styles.fileSize, { color: theme.subtext }]}>
                    {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'PDF Document ready'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                  <Ionicons name="close-circle" size={20} color={theme.subtext} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.pickerBox, { borderColor: theme.border, backgroundColor: theme.surfaceSubtle }]}>
                <Ionicons name="cloud-upload-outline" size={36} color={theme.tint} style={{ marginBottom: 6 }} />
                <Text style={[styles.pickerTitle, { color: theme.text }]}>Choose PDF Sheet Music</Text>
                <Text style={[styles.pickerHint, { color: theme.subtext }]}>
                  Upload digital vocal score from device
                </Text>

                <View style={[styles.pickerActions, { backgroundColor: 'transparent' }]}>
                  <TouchableOpacity
                    style={[styles.pickButton, { backgroundColor: theme.tint }]}
                    onPress={handlePickDocument}>
                    <Ionicons name="folder-open-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.pickButtonText}>Browse Files</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.demoPickBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={handleUseDemoFile}>
                    <Text style={[styles.demoPickBtnText, { color: theme.subtext }]}>Use Sample PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Metadata Form */}
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Title */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Score Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text }]}
              placeholder="e.g. Hallelujah Chorus"
              placeholderTextColor={theme.subtext}
              value={title}
              onChangeText={setTitle}
            />

            {/* Composer */}
            <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>Composer *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text }]}
              placeholder="e.g. George Frideric Handel"
              placeholderTextColor={theme.subtext}
              value={composer}
              onChangeText={setComposer}
            />

            {/* Arranger */}
            <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>Arranger / Editor</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text }]}
              placeholder="Optional (e.g. arr. John Rutter)"
              placeholderTextColor={theme.subtext}
              value={arranger}
              onChangeText={setArranger}
            />

            {/* Voicing Selection */}
            <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 14 }]}>Voicing</Text>
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

            {/* Liturgical Season Selection */}
            <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 14 }]}>Season / Occasion</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {SEASON_OPTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: season === s ? theme.tint : theme.surfaceSubtle,
                      borderColor: season === s ? theme.tint : theme.border,
                    },
                  ]}
                  onPress={() => setSeason(s)}>
                  <Text style={[styles.chipText, { color: season === s ? '#FFFFFF' : theme.text }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Key Signature & Tempo Row */}
            <View style={[styles.rowFields, { backgroundColor: 'transparent' }]}>
              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>Key Signature</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text }]}
                  placeholder="e.g. D Major"
                  placeholderTextColor={theme.subtext}
                  value={keySignature}
                  onChangeText={setKeySignature}
                />
              </View>

              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>Tempo</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text }]}
                  placeholder="e.g. Allegro (♩ = 108)"
                  placeholderTextColor={theme.subtext}
                  value={tempo}
                  onChangeText={setTempo}
                />
              </View>
            </View>

            {/* Conductor Rehearsal Notes */}
            <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>
              Conductor's Rehearsal Notes
            </Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="Instructions for rehearsals, breathing marks, bar numbers, dynamics..."
              placeholderTextColor={theme.subtext}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />
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
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Upload to Choir Repertoire</Text>
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
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 74,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
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
    fontSize: 11,
    marginTop: 2,
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
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
