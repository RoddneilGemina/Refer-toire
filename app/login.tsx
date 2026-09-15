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
import { DatabaseService } from '@/services/databaseService';

type TabMode = 'join' | 'create';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { signInWithCode, createGroup, currentInstance, signOut } = useRepertoire();

  const [activeTab, setActiveTab] = useState<TabMode>('join');

  // Join State
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create Group State
  const [ensembleName, setEnsembleName] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [customCode, setCustomCode] = useState('');

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
      router.replace('/(tabs)');
    } else {
      setErrorMessage(res.error || 'Failed to connect to repertoire instance');
    }
  };

  const handleCreateGroup = async () => {
    if (!ensembleName.trim()) {
      setErrorMessage('Please enter an ensemble name.');
      return;
    }
    if (!directorName.trim()) {
      setErrorMessage('Please enter the music director name.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const res = await createGroup({
      name: ensembleName.trim(),
      director: directorName.trim(),
      seasonName: seasonName.trim() || undefined,
      customCode: customCode.trim() || undefined,
    });

    setLoading(false);

    if (res.success) {
      router.replace('/(tabs)');
    } else {
      setErrorMessage(res.error || 'Failed to create group.');
    }
  };

  const handleSuggestCode = () => {
    if (ensembleName.trim()) {
      setCustomCode(DatabaseService.generateUniqueCode(ensembleName));
    } else {
      setCustomCode(DatabaseService.generateUniqueCode());
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
              <Ionicons name="musical-notes" size={42} color={theme.tint} />
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
                <Ionicons name="checkmark-circle" size={18} color={Colors.status.completed} />
                <Text style={[styles.currentCardTitle, { color: theme.text }]}>
                  Connected Ensemble
                </Text>
              </View>
              <Text style={[styles.currentChoirName, { color: theme.tint }]}>
                {currentInstance.name}
              </Text>
              <Text style={[styles.currentChoirCode, { color: theme.subtext }]}>
                Access Code: {currentInstance.code} • {currentInstance.scores.length} scores
              </Text>
              <View style={[styles.cardActionsRow, { backgroundColor: 'transparent' }]}>
                <TouchableOpacity
                  style={[styles.returnButton, { flex: 1, backgroundColor: theme.tint }]}
                  onPress={() => router.replace('/(tabs)')}>
                  <Text style={[styles.returnButtonText, { color: '#FFFFFF' }]}>
                    Open Library
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.disconnectButton, { flex: 1, backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                  onPress={async () => {
                    await signOut();
                    setCode('');
                  }}>
                  <Text style={[styles.disconnectButtonText, { color: Colors.status.failed }]}>
                    Disconnect
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Mode Switcher Tabs */}
          <View style={[styles.tabBar, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'join' && { backgroundColor: theme.card, shadowColor: '#000', elevation: 2 },
              ]}
              onPress={() => {
                setActiveTab('join');
                setErrorMessage(null);
              }}>
              <Ionicons
                name="key-outline"
                size={16}
                color={activeTab === 'join' ? theme.tint : theme.subtext}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  { color: activeTab === 'join' ? theme.text : theme.subtext },
                ]}>
                Enter Code
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'create' && { backgroundColor: theme.card, shadowColor: '#000', elevation: 2 },
              ]}
              onPress={() => {
                setActiveTab('create');
                setErrorMessage(null);
              }}>
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={activeTab === 'create' ? theme.tint : theme.subtext}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  { color: activeTab === 'create' ? theme.text : theme.subtext },
                ]}>
                Create Group
              </Text>
            </TouchableOpacity>
          </View>

          {/* JOIN GROUP TAB CONTENT */}
          {activeTab === 'join' ? (
            <>
              {/* Access Code Input */}
              <View
                style={[styles.inputCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Choir Access Code</Text>
                <Text style={[styles.inputHint, { color: theme.subtext }]}>
                  Enter the unique code for your choir to link and sync all scores offline
                </Text>

                <View
                  style={[
                    styles.inputRow,
                    { borderColor: theme.border, backgroundColor: theme.surfaceSubtle },
                  ]}>
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
                      <Ionicons
                        name="cloud-download-outline"
                        size={20}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.submitButtonText}>Link & Sync Repertoire</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Demo Instances Section */}
              <View style={[styles.demoSection, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.demoSectionTitle, { color: theme.subtext }]}>
                  OR JOIN A DEMO ENSEMBLE
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
            </>
          ) : (
            /* CREATE GROUP TAB CONTENT */
            <View
              style={[styles.inputCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.adminBadgeRow, { backgroundColor: 'transparent' }]}>
                <View style={[styles.crownBadge, { backgroundColor: theme.badgeBackground }]}>
                  <Text style={[styles.crownBadgeText, { color: theme.badgeText }]}>
                    👑 Group Creator / Admin
                  </Text>
                </View>
              </View>
              <Text style={[styles.inputLabel, { color: theme.text }]}>New Choir Repertoire</Text>
              <Text style={[styles.inputHint, { color: theme.subtext }]}>
                Initially, your repertoire will be empty. As the group admin, you can upload sheet music PDFs and invite members using your unique code.
              </Text>

              {/* Ensemble Name */}
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Ensemble Name *</Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="e.g. St. Cecilia Chamber Choir"
                placeholderTextColor={theme.subtext}
                value={ensembleName}
                onChangeText={t => {
                  setEnsembleName(t);
                  setErrorMessage(null);
                }}
              />

              {/* Director Name */}
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>
                Music Director *
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="e.g. Dr. Julian Vance"
                placeholderTextColor={theme.subtext}
                value={directorName}
                onChangeText={t => {
                  setDirectorName(t);
                  setErrorMessage(null);
                }}
              />

              {/* Season / Year */}
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>
                Season / Program Cycle
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="e.g. 2026 Masterworks Cycle"
                placeholderTextColor={theme.subtext}
                value={seasonName}
                onChangeText={setSeasonName}
              />

              {/* Unique Access Code */}
              <View style={[styles.codeHeaderRow, { backgroundColor: 'transparent', marginTop: 12 }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Unique Choir Access Code</Text>
                <TouchableOpacity onPress={handleSuggestCode}>
                  <Text style={[styles.suggestLink, { color: theme.tint }]}>Auto-Generate</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    color: theme.text,
                    fontWeight: '700',
                    letterSpacing: 1,
                  },
                ]}
                placeholder="e.g. CECILIA-2026 (or auto-generated)"
                placeholderTextColor={theme.subtext}
                autoCapitalize="characters"
                value={customCode}
                onChangeText={t => setCustomCode(t.toUpperCase())}
              />

              {errorMessage && (
                <View style={[styles.errorRow, { backgroundColor: 'transparent', marginTop: 12 }]}>
                  <Ionicons name="alert-circle" size={16} color={Colors.status.failed} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: theme.tint, opacity: loading ? 0.7 : 1, marginTop: 16 },
                ]}
                onPress={handleCreateGroup}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Create Group & Open Library</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Offline Rehearsal Notice */}
          <View style={[styles.footerNotice, { backgroundColor: 'transparent' }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.subtext} />
            <Text style={[styles.footerNoticeText, { color: theme.subtext }]}>
              All sheet music PDFs are synchronized directly into device storage, keeping scores accessible during rehearsals and concerts without WiFi.
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
    paddingTop: 28,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  currentCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  currentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  currentCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentChoirName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  currentChoirCode: {
    fontSize: 12,
    marginBottom: 10,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  returnButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  disconnectButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  disconnectButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  adminBadgeRow: {
    marginBottom: 12,
  },
  crownBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  crownBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  inputHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  codeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  formInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '700',
  },
  demoSection: {
    marginBottom: 20,
  },
  demoSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    paddingLeft: 4,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
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
    fontSize: 14,
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
