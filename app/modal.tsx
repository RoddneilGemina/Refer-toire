import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRepertoire } from '@/context/RepertoireContext';

export default function InfoModalScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { currentInstance } = useRepertoire();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.iconCircle, { backgroundColor: theme.surfaceSubtle }]}>
          <Ionicons name="musical-notes" size={40} color={theme.tint} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>About Refer-toire</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          Choir Repertoire & Sheet Music Sync Engine
        </Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Active Choir Instance</Text>
          {currentInstance ? (
            <>
              <Text style={[styles.cardHighlight, { color: theme.tint }]}>
                {currentInstance.name}
              </Text>
              <Text style={[styles.cardDetail, { color: theme.subtext }]}>
                Code: {currentInstance.code}
              </Text>
              <Text style={[styles.cardDetail, { color: theme.subtext }]}>
                Director: {currentInstance.director}
              </Text>
              <Text style={[styles.cardDetail, { color: theme.subtext }]}>
                Scores: {currentInstance.scores.length} works synced
              </Text>
            </>
          ) : (
            <Text style={[styles.cardDetail, { color: theme.subtext }]}>
              No choir currently connected. Enter your choir access code to load scores.
            </Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>How Refer-toire Works</Text>
          <View style={[styles.stepRow, { backgroundColor: 'transparent' }]}>
            <Ionicons name="key-outline" size={18} color={theme.tint} />
            <Text style={[styles.stepText, { color: theme.text }]}>
              Sign in with your ensemble's unique access code.
            </Text>
          </View>
          <View style={[styles.stepRow, { backgroundColor: 'transparent' }]}>
            <Ionicons name="cloud-download-outline" size={18} color={theme.tint} />
            <Text style={[styles.stepText, { color: theme.text }]}>
              All PDF scores in that instance automatically download to your device storage.
            </Text>
          </View>
          <View style={[styles.stepRow, { backgroundColor: 'transparent' }]}>
            <Ionicons name="filter-outline" size={18} color={theme.tint} />
            <Text style={[styles.stepText, { color: theme.text }]}>
              Scores are organized automatically by Title, Composer, Voicing, and Liturgical Season.
            </Text>
          </View>
          <View style={[styles.stepRow, { backgroundColor: 'transparent' }]}>
            <Ionicons name="airplane-outline" size={18} color={theme.tint} />
            <Text style={[styles.stepText, { color: theme.text }]}>
              Enjoy 100% offline access in rehearsals, churches, and concert stages without WiFi.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: theme.tint }]}
          onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  cardHighlight: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDetail: {
    fontSize: 13,
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginVertical: 6,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    marginTop: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
