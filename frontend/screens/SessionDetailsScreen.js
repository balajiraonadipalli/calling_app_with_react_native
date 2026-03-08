import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Audio } from 'expo-av';

export default function SessionDetailsScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  // Audio Playback States
  const [sound, setSound] = useState();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const sessionRef = doc(db, 'sessions', sessionId);

    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        setSession({ id: docSnap.id, ...docSnap.data() });
      } else {
        Alert.alert('Error', 'Session not found.');
        navigation.goBack();
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching session details:", error);
      Alert.alert('Error', 'Could not load session details.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId]);

  useEffect(() => {
    return sound
      ? () => {
        console.log('Unloading Sound');
        sound.unloadAsync();
      }
      : undefined;
  }, [sound]);

  const togglePlayback = async () => {
    if (!session?.hasRecordingAvailable && !session?.audioUrl) {
      Alert.alert("Not Found", "No recording is available for this session.");
      return;
    }

    try {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        if (!sound) {
          setIsPlaybackLoading(true);
          console.log('Fetching audio string from Firestore Database...');

          // Legacy check for old storage or fetch the new base64 string from Firestore
          let audioSource = session.audioUrl;
          if (!audioSource) {
            const recordingDoc = await getDoc(doc(db, 'recordings', sessionId));
            if (recordingDoc.exists() && recordingDoc.data().audioData) {
              audioSource = recordingDoc.data().audioData;
            } else {
              setIsPlaybackLoading(false);
              return Alert.alert("Not Found", "This recording was not saved to the database.");
            }
          }

          console.log('Loading Sound into expo-av...');
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: audioSource },
            { shouldPlay: true }
          );
          setSound(newSound);
          setIsPlaybackLoading(false);
          setIsPlaying(true);

          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.didJustFinish) {
              setIsPlaying(false);
              newSound.setPositionAsync(0);
            }
          });
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error("Playback error:", error);
      Alert.alert("Playback Error", "Failed to load/play audio recording.");
      setIsPlaybackLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    // In a real app, use expo-print to generate a PDF and expo-sharing to save/share
    Alert.alert('Download', 'Mock: PDF generated and downloaded to device.');
  };

  if (loading || !session) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Fetching AI Insights...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Insights</Text>
        <TouchableOpacity onPress={handleDownloadPDF} style={styles.downloadBtn}>
          <Text style={styles.downloadText}>↓ PDF</Text>
        </TouchableOpacity>
      </View>

      {session.status === 'processing' ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.processingText}>OpenAI is analyzing the recording...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Recording Playback Card */}
          {(session.hasRecordingAvailable || session.audioUrl) && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Call Recording</Text>
              <TouchableOpacity
                style={styles.playbackButton}
                onPress={togglePlayback}
                disabled={isPlaybackLoading}
              >
                {isPlaybackLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.playbackButtonText}>
                    {isPlaying ? '⏸ Pause Recording' : '▶ Play Recording'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Summary Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>AI Summary</Text>
            <Text style={styles.bodyText}>{session.summary || 'No summary available.'}</Text>
          </View>

          {/* Extracted Doubts */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Extracted Doubts</Text>
            {session.extractedDoubts?.map((doubt, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bodyText}>{doubt}</Text>
              </View>
            )) || <Text style={styles.bodyText}>No doubts identified.</Text>}
          </View>

          {/* AI Clarifications */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>AI Clarifications</Text>
            {session.aiClarifications?.map((item, index) => (
              <View key={index} style={styles.clarificationItem}>
                <Text style={styles.doubtText}>Q: {item.doubt}</Text>
                <Text style={styles.clarificationText}>A: {item.explanation}</Text>
              </View>
            )) || <Text style={styles.bodyText}>No clarifications available.</Text>}
          </View>

          {/* Transcript Accordion */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.transcriptHeader}
              onPress={() => setShowTranscript(!showTranscript)}
            >
              <Text style={styles.sectionTitle}>Full Transcript</Text>
              <Text style={styles.toggleText}>{showTranscript ? '-' : '+'}</Text>
            </TouchableOpacity>

            {showTranscript && (
              <Text style={[styles.bodyText, { marginTop: 12 }]}>
                {session.transcript || 'No transcript generated.'}
              </Text>
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 16,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  processingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  downloadBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  downloadText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    marginRight: 8,
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clarificationItem: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  doubtText: {
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  clarificationText: {
    color: '#059669', // Emerald
    lineHeight: 22,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  toggleText: {
    fontSize: 24,
    color: '#4F46E5',
    fontWeight: '300',
  },
  playbackButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  playbackButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  }
});
