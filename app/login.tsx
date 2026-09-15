import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';
import { InstanceService } from '@/services/instanceService';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { signInWithCode, currentInstance } = useRepertoire();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const demoInstances = InstanceService.getAvailableDemoInstances();

  const handleSignIn = async (codeToUse?: string) => {
    const targetCode = (codeToUse || code).trim();
    if (!targetCode) {
      setErrorMessage('Please enter an access code.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const res = await signInWithCode(targetCode);
    setLoading(false);

    if (res.success) {
      // Redirect to main repertoire list
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } else {
      setErrorMessage(res.error || 'Failed to connect to repertoire instance');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header & Logo */}
          <View style={[styles.headerSection, { backgroundColor: 'transparent' }]}>
            <View style={[styles.iconCircle, { backgroundColor: theme.surfaceSubtle }]}>
              <Ionicons name="musical-notes" size={44} color={theme.tint} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Refer-toire</Text>
            <Text style={[styles.subtitle, { color: theme.subtext }]}>
              Choir Repertoire & Sheet Music Sync Engine
            </Text>
          </View>

          {/* Active Choir Status if already logged in */}
          {currentInstance && (
            <View
              style={[
                styles.currentCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}>
              <View style={[styles.currentCardHeader, { backgroundColor: 'transparent' }]}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.status.completed} />
                <Text style={[styles.currentCardTitle, { color: theme.text }]}>
                  Currently Logged In
                </Text>
              </View>
              <Text style={[styles.currentChoirName, { color: theme.tint }]}>
                {currentInstance.name}
              </Text>
              <Text style={[styles.currentChoirCode, { color: theme.subtext }]}>
                Code: {currentInstance.code} • {currentInstance.scores.length} scores
              </Text>
              <TouchableOpacity
                style={[styles.returnButton, { backgroundColor: theme.surfaceSubtle }]}
                onPress={() => router.replace('/(tabs)')}>
                <Text style={[styles.returnButtonText, { color: theme.text }]}>
                  Return to Library
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Access Code Input */}
          <View
            style={[styles.inputCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Choir Access Code</Text>
            <Text style={[styles.inputHint, { color: theme.subtext }]}>
              Provided by your choral director or music librarian
            </Text>

            <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.surfaceSubtle }]}>
              <Ionicons name="key-outline" size={20} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.inputField, { color: theme.text }]}
                placeholder="e.g. CANTATE-2026"
                placeholderTextColor={theme.subtext}
                autoCapitalize="characters"
                autoCorrect={false}
                value={code}
                onChangeText={t => {
                  setCode(t.toUpperCase());
                  setErrorMessage(null);
                }}
                onSubmitEditing={() => handleSignIn()}
                editable={!loading}
              />
              {code.length > 0 && (
                <TouchableOpacity onPress={() => setCode('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={theme.subtext} />
                </TouchableOpacity>
              )}
            </View>

            {errorMessage && (
              <View style={[styles.errorRow, { backgroundColor: 'transparent' }]}>
                <Ionicons name="alert-circle" size={16} color={Colors.status.failed} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.tint, opacity: loading ? 0.7 : 1 },
              ]}
              onPress={() => handleSignIn()}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Download & Sync Repertoire</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Demo Instances Section */}
          <View style={[styles.demoSection, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.demoSectionTitle, { color: theme.subtext }]}>
              OR SELECT A DEMO ENSEMBLE
            </Text>

            {demoInstances.map(demo => (
              <TouchableOpacity
                key={demo.code}
                style={[
                  styles.demoCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
                onPress={() => {
                  setCode(demo.code);
                  handleSignIn(demo.code);
                }}
                disabled={loading}>
                <View style={[styles.demoCardLeft, { backgroundColor: 'transparent' }]}>
                  <View style={[styles.demoBadge, { backgroundColor: theme.badgeBackground }]}>
                    <Text style={[styles.demoBadgeText, { color: theme.badgeText }]}>
                      {demo.code}
                    </Text>
                  </View>
                  <Text style={[styles.demoName, { color: theme.text }]}>{demo.name}</Text>
                  <Text style={[styles.demoScoreCount, { color: theme.subtext }]}>
                    {demo.scoreCount} scores ready for offline sync
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={theme.tint} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Offline Rehearsal Notice */}
          <View style={[styles.footerNotice, { backgroundColor: 'transparent' }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.subtext} />
            <Text style={[styles.footerNoticeText, { color: theme.subtext }]}>
              Once synchronized, all PDF sheet music is stored locally on your device for reliable access in churches and concert halls without WiFi.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  currentCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  currentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  currentCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentChoirName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  currentChoirCode: {
    fontSize: 13,
    marginBottom: 12,
  },
  returnButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  returnButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  inputHint: {
    fontSize: 13,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  clearBtn: {
    padding: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
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
    borderRadius: 12,
    height: 50,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  demoSection: {
    marginBottom: 24,
  },
  demoSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  demoCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  demoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  demoName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  demoScoreCount: {
    fontSize: 12,
  },
  footerNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  footerNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});
