import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function DownloadScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const apkUrl = 'https://refertoire.github.io/apk/Refertoire.apk';

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = apkUrl;
    } else {
      Linking.openURL(apkUrl);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="musical-notes" size={48} color={theme.tint} style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: theme.text }]}>Downloading Refertoire</Text>
        <Text style={[styles.sub, { color: theme.subtext }]}>
          Your download should begin automatically. If not, tap the button below.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.tint }]}
          onPress={() => {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.href = apkUrl;
            } else {
              Linking.openURL(apkUrl);
            }
          }}>
          <Ionicons name="download-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.btnText}>Download Refertoire APK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    maxWidth: 420,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
