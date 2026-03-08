import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { doc, setDoc, onSnapshot, collection, addDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { Audio } from 'expo-av';

export default function CallScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const { user } = useContext(AuthContext);

  const [timer, setTimer] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const webViewRef = useRef(null);
  const unsubscribeRefs = useRef([]);

  useEffect(() => {
    // Override iOS audio modes to force WebView sound to the loud speaker and prevent silent mode blocking
    const setupAudio = async () => {
      await Audio.requestPermissionsAsync().catch(console.warn);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });
    };
    setupAudio();

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (isCalling && !isUploading) return prev + 1;
        return prev;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      cleanupSession();
    };
  }, [isCalling, isUploading]);

  const sendToWebView = (type, payload) => {
    const msg = JSON.stringify({ type, payload });
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.postMessageFromRN(${JSON.stringify(msg)});`);
    }
  };

  const setupFirebaseListeners = () => {
    const callDocRef = doc(db, 'calls', sessionId);
    const callerCandidatesCollection = collection(callDocRef, 'callerCandidates');
    const calleeCandidatesCollection = collection(callDocRef, 'calleeCandidates');

    const sessionDocRef = doc(db, 'sessions', sessionId);
    const unsubSession = onSnapshot(sessionDocRef, (snapshot) => {
      const data = snapshot.data();
      if (data && (data.status === 'completed' || data.status === 'upcoming')) {
        cleanupSession();
        navigation.goBack();
      }
    });
    unsubscribeRefs.current.push(unsubSession);

    if (user.role === 'tutor') {
      const unsubCall = onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (data?.answer) {
          sendToWebView('answer', data.answer);
        }
      });
      unsubscribeRefs.current.push(unsubCall);

      const unsubCand = onSnapshot(calleeCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            sendToWebView('candidate', change.doc.data());
          }
        });
      });
      unsubscribeRefs.current.push(unsubCand);
    } else {
      const unsubCand = onSnapshot(callerCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            sendToWebView('candidate', change.doc.data());
          }
        });
      });
      unsubscribeRefs.current.push(unsubCand);
    }
  };

  const handleWebViewMessage = async (event) => {
    const dataObj = JSON.parse(event.nativeEvent.data);
    const { type, payload } = dataObj;
    const callDocRef = doc(db, 'calls', sessionId);
    const callerCandidatesCollection = collection(callDocRef, 'callerCandidates');
    const calleeCandidatesCollection = collection(callDocRef, 'calleeCandidates');

    try {
      if (type === 'ready') {
        setIsCalling(true);
        setupFirebaseListeners();

        if (user.role !== 'tutor') {
          const callData = (await getDoc(callDocRef)).data();
          if (callData?.offer) {
            sendToWebView('offer', callData.offer);
          }
        }
        sendToWebView('init', { isCaller: user.role === 'tutor' });
      } else if (type === 'offer') {
        await setDoc(callDocRef, { offer: payload });
      } else if (type === 'answer') {
        await updateDoc(callDocRef, { answer: payload });
      } else if (type === 'candidate') {
        if (user.role === 'tutor') {
          await addDoc(callerCandidatesCollection, payload);
        } else {
          await addDoc(calleeCandidatesCollection, payload);
        }
      } else if (type === 'recording') {
        if (payload) {
          await uploadRecording(payload);
        } else {
          try {
            const callSessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(callSessionRef, { status: 'completed' });
          } catch (err) {
            console.error('Error updating session status on end:', err);
          }
          cleanupSession();
          navigation.goBack();
        }
      } else if (type === 'error') {
        console.error('WebView WebRTC Error:', payload);
      } else if (type === 'log') {
        console.log('WebView WebRTC Log:', payload);
      }
    } catch (err) {
      console.error('Firestore Error:', err);
    }
  };

  const uploadRecording = async (base64DataUrl) => {
    try {
      console.log('Uploading Base64 audio string to free Firestore Database...');

      // Bypassing Firebase Storage completely to avoid billing requirement errors
      // We push the base64 URL directly into a new 'recordings' collection.
      const recordingDocRef = doc(db, 'recordings', sessionId);
      await setDoc(recordingDocRef, {
        sessionId: sessionId,
        audioData: base64DataUrl,
        createdAt: new Date().toISOString()
      });

      // Update the main session document so the playback screen knows it's ready
      const callSessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(callSessionRef, {
        status: 'completed',
        hasRecordingAvailable: true
      });

      Alert.alert('Session Ended', 'The recording was synced to Firestore successfully.');
      setIsUploading(false);
      navigation.goBack();
    } catch (error) {
      console.error('Firestore Upload Error:', error);
      Alert.alert('Upload Failed', 'There was an issue saving the recording. ' + error.message);
      setIsUploading(false);
      navigation.goBack();
    }
  };

  const endCall = async () => {
    setIsCalling(false);
    setIsUploading(true);
    sendToWebView('end', null);

    try {
      // Immediately notify the other user that the call is over before upload finishes
      const callSessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(callSessionRef, { status: 'completed' });
    } catch (err) {
      console.error('Error updating session status early:', err);
    }
  };

  const cleanupSession = () => {
    if (unsubscribeRefs.current.length > 0) {
      unsubscribeRefs.current.forEach((unsub) => unsub());
      unsubscribeRefs.current = [];
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</head>
<body style="background: transparent; margin: 0; padding: 0;">
  <audio id="localAudio" autoplay muted playsinline></audio>
  <audio id="remoteAudio" autoplay playsinline></audio>
  <script>
    // Forward console logs to RN terminal
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', payload: args.join(' ') }));
        originalLog(...args);
    };
    console.error = (...args) => {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', payload: args.join(' ') }));
        originalError(...args);
    };

    let pc;
    let mediaRecorder;
    let audioChunks = [];
    // We inject both the Google fallback STUN and the Metered TURN relay.
    const config = { iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: "turn:standard.relay.metered.ca:80", username: "9c47843af8f559ef25eeb53c", credential: "MtfyUstyJm10fkrL" },
        { urls: "turn:standard.relay.metered.ca:80?transport=tcp", username: "9c47843af8f559ef25eeb53c", credential: "MtfyUstyJm10fkrL" },
        { urls: "turn:standard.relay.metered.ca:443", username: "9c47843af8f559ef25eeb53c", credential: "MtfyUstyJm10fkrL" },
        { urls: "turns:standard.relay.metered.ca:443?transport=tcp", username: "9c47843af8f559ef25eeb53c", credential: "MtfyUstyJm10fkrL" }
    ]};
    let isWebRTCReady = false;
    let messageQueue = [];
    
    function sendToRN(type, data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload: data }));
    }

    async function processMessage(msg) {
        if (msg.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendToRN('answer', answer);
        } else if (msg.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        } else if (msg.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
        } else if (msg.type === 'end') {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = () => {
                sendToRN('recording', reader.result);
              };
            };
            mediaRecorder.stop();
          } else {
            sendToRN('recording', null);
          }
          if (pc) pc.close();
        }
    }

    // Bind safe receiver from RN
    window.postMessageFromRN = async function(msgString) {
      try {
        const msg = JSON.parse(msgString);
        if (msg.type === 'init') {
          await initP2P(msg.payload.isCaller);
          isWebRTCReady = true;
          // Drain the queue of any messages that arrived while permissions/init were loading
          while (messageQueue.length > 0) {
            const queuedMsg = messageQueue.shift();
            await processMessage(queuedMsg);
          }
        } else {
          if (!isWebRTCReady && msg.type !== 'end') {
             console.log("Queueing message until WebRTC initialized: ", msg.type);
             messageQueue.push(msg);
          } else {
             await processMessage(msg);
          }
        }
      } catch(e) {
        sendToRN('error', e.toString());
      }
    };

    async function initP2P(isCaller) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.start();

        pc = new RTCPeerConnection(config);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("ICE Candidate generated:", event.candidate.candidate);
            sendToRN('candidate', event.candidate);
          } else {
            console.log("ICE Gathering Complete");
          }
        };

        pc.ontrack = (event) => {
          console.log("Received remote track!");
          const remoteAudio = document.getElementById('remoteAudio');
          
          // Force element properties just to be safe
          remoteAudio.muted = false;
          remoteAudio.volume = 1.0;
          
          // Recreate the stream explicitly to bypass Safari/Android WebView Polyfill bugs
          if (event.streams && event.streams[0]) {
             remoteAudio.srcObject = event.streams[0];
          } else {
             remoteAudio.srcObject = new MediaStream([event.track]);
          }
          
          remoteAudio.onloadeddata = () => {
             console.log("Audio data loaded natively, initiating explicit playback...");
             remoteAudio.play().catch(e => console.error("onloadeddata play prevented:", e.toString()));
          };
          
          // Force playback immediately, and continuously attempt to play every 1 second 
          // to bypass strict mobile browser autoplay policies that ignore the first call.
          const forcePlay = () => {
              if (remoteAudio.paused) {
                 console.log("Audio is paused. Forcing play...");
                 remoteAudio.play().catch(e => console.error("Autoplay retry prevented:", e.toString()));
              }
          };
          forcePlay();
          setInterval(forcePlay, 1000);
        };

        if (isCaller) {
          console.log("I am Caller, creating offer...");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendToRN('offer', offer);
        } else {
          console.log("I am Callee, waiting for offer...");
        }
      } catch (e) {
        sendToRN('error', e.toString());
      }
    }

    // Tell RN we are ready
    setTimeout(() => {
        sendToRN('ready', null);
    }, 1000);
  </script>
</body>
</html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.warningBanner}>
        <Text style={styles.warningText}>⚠️ This call is being securely recorded for AI analysis.</Text>
      </View>
      <View style={styles.callContainer}>
        {/* Invisible WebView to run WebRTC in pure JS environment without Native Binaries! */}
        <View style={{ width: 1, height: 1, opacity: 0 }}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent, baseUrl: 'https://localhost' }}
            originWhitelist={['*']}
            onMessage={handleWebViewMessage}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            javaScriptEnabled={true}
            domStorageEnabled={true}
            useWebKit={true}
            mixedContentMode="always"       // CRITICAL FOR ANDROID WEBRTC OVER LOCALHOST
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            javaScriptCanOpenWindowsAutomatically={true}
          />
        </View>

        <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>🧑‍🏫</Text></View>
        <Text style={styles.statusText}>{isUploading ? 'Uploading Audio...' : (isCalling ? 'WebRTC Active' : 'Connecting...')}</Text>
        <Text style={styles.timerText}>{formatTime(timer)}</Text>

        {isUploading && <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 20 }} />}
      </View>
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={[styles.endCallButton, isUploading && { opacity: 0.5 }]} onPress={endCall} disabled={isUploading}>
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E293B' },
  warningBanner: { backgroundColor: '#FEF3C7', padding: 12, alignItems: 'center' },
  warningText: { color: '#92400E', fontWeight: '600', fontSize: 14 },
  callContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  avatarText: { fontSize: 60 },
  statusText: { color: '#94A3B8', fontSize: 18, marginBottom: 8 },
  timerText: { color: '#F8FAFC', fontSize: 48, fontWeight: '200', fontVariant: ['tabular-nums'] },
  controlsContainer: { padding: 40, alignItems: 'center', paddingBottom: 60 },
  endCallButton: { backgroundColor: '#EF4444', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  endCallText: { color: '#FFF', fontWeight: '700', fontSize: 12 }
});
