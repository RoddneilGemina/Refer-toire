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
  Alert,
  Image,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';
import { DatabaseService } from '@/services/databaseService';

type AuthMode = 'signin' | 'signup';
type EnsembleMode = 'join' | 'create';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const {
    currentUser,
    currentInstance,
    signUp,
    signIn,
    signOutUser,
    signInWithCode,
    createGroup,
  } = useRepertoire();

  // Auth Form State
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Ensemble Form State
  const [ensembleMode, setEnsembleMode] = useState<EnsembleMode>('join');
  const [joinCode, setJoinCode] = useState('');
  const [ensembleName, setEnsembleName] = useState('');
  const [directorName, setDirectorName] = useState(currentUser?.fullName || '');
  const [seasonName, setSeasonName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [ensembleLoading, setEnsembleLoading] = useState(false);
  const [ensembleError, setEnsembleError] = useState<string | null>(null);

  // 1. Handle User Sign Up
  const handleSignUp = async () => {
    if (!fullName.trim()) {
      setAuthError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setAuthError('Please enter an email address.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthError(null);
    setAuthLoading(true);

    const res = await signUp({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    });

    setAuthLoading(false);

    if (res.success) {
      setDirectorName(fullName.trim());
      // Stay on screen to join or create ensemble
    } else {
      setAuthError(res.error || 'Failed to create account.');
    }
  };

  // 2. Handle User Sign In
  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setAuthError('Please enter both email and password.');
      return;
    }

    setAuthError(null);
    setAuthLoading(true);

    const res = await signIn({
      email: email.trim(),
      password,
    });

    setAuthLoading(false);

    if (res.success) {
      if (currentInstance) {
        router.replace('/(tabs)');
      }
    } else {
      setAuthError(res.error || 'Failed to sign in.');
    }
  };

  // 3. Handle Joining Ensemble with Code
  const handleJoinEnsemble = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setEnsembleError('Please enter an ensemble access code.');
      return;
    }

    setEnsembleError(null);
    setEnsembleLoading(true);

    const res = await signInWithCode(code);
    setEnsembleLoading(false);

    if (res.success) {
      router.replace('/(tabs)');
    } else {
      setEnsembleError(res.error || `Ensemble code "${code}" not found.`);
    }
  };

  // 4. Handle Creating New Ensemble (Creator is Admin by default)
  const handleCreateEnsemble = async () => {
    if (!ensembleName.trim()) {
      setEnsembleError('Please enter an ensemble name.');
      return;
    }
    const finalDirector = (directorName || currentUser?.fullName || '').trim();
    if (!finalDirector) {
      setEnsembleError('Please specify the choir director name.');
      return;
    }

    setEnsembleError(null);
    setEnsembleLoading(true);

    const res = await createGroup({
      name: ensembleName.trim(),
      director: finalDirector,
      seasonName: seasonName.trim() || undefined,
      customCode: customCode.trim() || undefined,
    });

    setEnsembleLoading(false);

    if (res.success) {
      router.replace('/(tabs)');
    } else {
      setEnsembleError(res.error || 'Failed to create ensemble.');
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}>
          {/* Header Branding: HD Logo */}
          <View style={[styles.headerContainer, { backgroundColor: 'transparent' }]}>
            <Image
              source={require('@/assets/images/refertoire-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* STEP 1: AUTHENTICATION (Sign In / Sign Up) */}
          {!currentUser ? (
            <View
              style={[
                styles.mainCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}>
              {/* Tab Switcher: Sign In vs Sign Up */}
              <View style={[styles.tabBar, { backgroundColor: theme.surfaceSubtle }]}>
                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    authMode === 'signin' && [styles.tabBtnActive, { backgroundColor: theme.card }],
                  ]}
                  onPress={() => {
                    setAuthMode('signin');
                    setAuthError(null);
                  }}>
                  <Ionicons
                    name="log-in-outline"
                    size={16}
                    color={authMode === 'signin' ? theme.tint : theme.subtext}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.tabBtnText,
                      { color: authMode === 'signin' ? theme.text : theme.subtext },
                      authMode === 'signin' && styles.tabBtnTextActive,
                    ]}>
                    Sign In
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    authMode === 'signup' && [styles.tabBtnActive, { backgroundColor: theme.card }],
                  ]}
                  onPress={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                  }}>
                  <Ionicons
                    name="person-add-outline"
                    size={16}
                    color={authMode === 'signup' ? theme.tint : theme.subtext}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.tabBtnText,
                      { color: authMode === 'signup' ? theme.text : theme.subtext },
                      authMode === 'signup' && styles.tabBtnTextActive,
                    ]}>
                    Create Account
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Error Message */}
              {authError && (
                <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#F87171' }]}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={[styles.errorText, { color: '#B91C1C' }]}>{authError}</Text>
                </View>
              )}

              {/* Sign Up Fields */}
              {authMode === 'signup' && (
                <View style={{ backgroundColor: 'transparent' }}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="e.g. Julian Vance"
                    placeholderTextColor={theme.subtext}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />

                  <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="e.g. director@cathedralchoir.org"
                    placeholderTextColor={theme.subtext}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={[styles.inputLabel, { color: theme.text }]}>Password (min 6 chars)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor={theme.subtext}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: theme.tint }]}
                    onPress={handleSignUp}
                    disabled={authLoading}>
                    {authLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.submitButtonText}>Create Account</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Sign In Fields */}
              {authMode === 'signin' && (
                <View style={{ backgroundColor: 'transparent' }}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="e.g. singer@choir.org"
                    placeholderTextColor={theme.subtext}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor={theme.subtext}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: theme.tint }]}
                    onPress={handleSignIn}
                    disabled={authLoading}>
                    {authLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.submitButtonText}>Sign In to Account</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            /* STEP 2: ENSEMBLE SELECTION (Logged In) */
            <View style={{ gap: 16, backgroundColor: 'transparent' }}>
              {/* Logged in User Profile Banner */}
              <View
                style={[
                  styles.profileBanner,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}>
                <View style={[styles.profileAvatar, { backgroundColor: theme.badgeBackground }]}>
                  <Ionicons name="person" size={22} color={theme.tint} />
                </View>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                  <Text style={[styles.profileName, { color: theme.text }]}>{currentUser.fullName}</Text>
                  <Text style={[styles.profileEmail, { color: theme.subtext }]}>
                    {currentUser.email}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.signOutBtn, { backgroundColor: theme.surfaceSubtle }]}
                  onPress={signOutUser}>
                  <Ionicons name="log-out-outline" size={16} color={Colors.status.failed} />
                  <Text style={[styles.signOutText, { color: Colors.status.failed }]}>Log Out</Text>
                </TouchableOpacity>
              </View>

              {/* Already Connected Group shortcut */}
              {currentInstance && (
                <View
                  style={[
                    styles.currentGroupBanner,
                    { backgroundColor: theme.badgeBackground, borderColor: theme.tint },
                  ]}>
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={[styles.currentGroupLabel, { color: theme.badgeText }]}>Active Repertoire</Text>
                    <Text style={[styles.currentGroupName, { color: theme.text }]}>{currentInstance.name}</Text>
                    <Text style={[styles.currentGroupCode, { color: theme.tint }]}>Code: {currentInstance.code}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.enterGroupBtn, { backgroundColor: theme.tint }]}
                    onPress={() => router.replace('/(tabs)')}>
                    <Text style={styles.enterGroupBtnText}>Open Scores</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Ensemble Tab Switcher: Join vs Create */}
              <View
                style={[
                  styles.mainCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}>
                <View style={[styles.tabBar, { backgroundColor: theme.surfaceSubtle }]}>
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      ensembleMode === 'join' && [styles.tabBtnActive, { backgroundColor: theme.card }],
                    ]}
                    onPress={() => {
                      setEnsembleMode('join');
                      setEnsembleError(null);
                    }}>
                    <Ionicons
                      name="key-outline"
                      size={16}
                      color={ensembleMode === 'join' ? theme.tint : theme.subtext}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.tabBtnText,
                        { color: ensembleMode === 'join' ? theme.text : theme.subtext },
                        ensembleMode === 'join' && styles.tabBtnTextActive,
                      ]}>
                      Join Ensemble
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      ensembleMode === 'create' && [styles.tabBtnActive, { backgroundColor: theme.card }],
                    ]}
                    onPress={() => {
                      setEnsembleMode('create');
                      setEnsembleError(null);
                    }}>
                    <Ionicons
                      name="add-circle-outline"
                      size={16}
                      color={ensembleMode === 'create' ? theme.tint : theme.subtext}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.tabBtnText,
                        { color: ensembleMode === 'create' ? theme.text : theme.subtext },
                        ensembleMode === 'create' && styles.tabBtnTextActive,
                      ]}>
                      Create Ensemble
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Ensemble Error Message */}
                {ensembleError && (
                  <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#F87171' }]}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                    <Text style={[styles.errorText, { color: '#B91C1C' }]}>{ensembleError}</Text>
                  </View>
                )}

                {/* JOIN ENSEMBLE */}
                {ensembleMode === 'join' && (
                  <View style={{ backgroundColor: 'transparent' }}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Enter Ensemble Access Code</Text>
                    <Text style={[styles.sectionSub, { color: theme.subtext }]}>
                      Ask your choir director for your group's 8-character access code.
                    </Text>

                    <TextInput
                      style={[
                        styles.codeInput,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.tint,
                        },
                      ]}
                      placeholder="e.g. CANTOR-4819"
                      placeholderTextColor={theme.subtext}
                      value={joinCode}
                      onChangeText={val => setJoinCode(val.toUpperCase())}
                      autoCapitalize="characters"
                    />

                    <TouchableOpacity
                      style={[styles.submitButton, { backgroundColor: theme.tint }]}
                      onPress={handleJoinEnsemble}
                      disabled={ensembleLoading}>
                      {ensembleLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.submitButtonText}>Join Ensemble Repertoire</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* CREATE NEW ENSEMBLE */}
                {ensembleMode === 'create' && (
                  <View style={{ backgroundColor: 'transparent' }}>
                    <View style={[styles.adminNoticeBadge, { backgroundColor: theme.badgeBackground }]}>
                      <Ionicons name="sparkles" size={16} color={theme.tint} style={{ marginRight: 6 }} />
                      <Text style={[styles.adminNoticeText, { color: theme.badgeText }]}>
                        You will be assigned as <Text style={{ fontWeight: '700' }}>Admin / Director</Text> by default.
                      </Text>
                    </View>

                    <Text style={[styles.inputLabel, { color: theme.text }]}>Ensemble / Choir Name</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder="e.g. Cathedral Chamber Choir"
                      placeholderTextColor={theme.subtext}
                      value={ensembleName}
                      onChangeText={setEnsembleName}
                    />

                    <Text style={[styles.inputLabel, { color: theme.text }]}>Director Name</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder="e.g. Dr. Julian Vance"
                      placeholderTextColor={theme.subtext}
                      value={directorName}
                      onChangeText={setDirectorName}
                    />

                    <Text style={[styles.inputLabel, { color: theme.text }]}>Season / Concert Name (Optional)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder="e.g. 2026 Masterworks Cycle"
                      placeholderTextColor={theme.subtext}
                      value={seasonName}
                      onChangeText={setSeasonName}
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <Text style={[styles.inputLabel, { color: theme.text, marginTop: 0 }]}>Custom Access Code (Optional)</Text>
                      <TouchableOpacity onPress={handleSuggestCode}>
                        <Text style={[styles.suggestText, { color: theme.tint }]}>Suggest Code</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.tint,
                          fontWeight: '700',
                          letterSpacing: 1,
                        },
                      ]}
                      placeholder="e.g. CANTOR-2026"
                      placeholderTextColor={theme.subtext}
                      value={customCode}
                      onChangeText={val => setCustomCode(val.toUpperCase())}
                      autoCapitalize="characters"
                    />

                    <TouchableOpacity
                      style={[styles.submitButton, { backgroundColor: theme.tint }]}
                      onPress={handleCreateEnsemble}
                      disabled={ensembleLoading}>
                      {ensembleLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.submitButtonText}>Create Ensemble & Become Director</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Web Standalone APK Download Banner */}
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={[styles.apkBanner, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              onPress={() => Linking.openURL('https://refertoire.github.io/apk/Refertoire.apk')}>
              <Ionicons name="logo-android" size={20} color="#22C55E" style={{ marginRight: 10 }} />
              <View style={{ backgroundColor: 'transparent', flex: 1 }}>
                <Text style={[styles.apkBannerTitle, { color: theme.text }]}>Download Android App (.APK)</Text>
                <Text style={[styles.apkBannerSub, { color: theme.subtext }]}>Offline sheet music & rehearsal scores on Android</Text>
              </View>
              <Ionicons name="download-outline" size={18} color={theme.tint} />
            </TouchableOpacity>
          )}

          {/* Keyboard Buffer Spacer */}
          <View style={styles.keyboardBuffer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 210,
    height: 210,
    alignSelf: 'center',
  },
  mainCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '600',
  },
  currentGroupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  currentGroupLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentGroupName: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  currentGroupCode: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  enterGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enterGroupBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  codeInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  adminNoticeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  adminNoticeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  suggestText: {
    fontSize: 12,
    fontWeight: '600',
  },
  keyboardBuffer: {
    height: 40,
  },
  apkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  apkBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  apkBannerSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
