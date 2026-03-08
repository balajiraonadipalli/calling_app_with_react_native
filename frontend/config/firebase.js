import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration using Expo Public Env Vars
const firebaseConfig = {
    apiKey: "AIzaSyDRankpiKxegDHREkcZZuCrKl3u558s89U",
    authDomain: "callingfeature-b2a3c.firebaseapp.com",
    projectId: "callingfeature-b2a3c",
    storageBucket: "callingfeature-b2a3c.firebasestorage.app",
    messagingSenderId: "335346617782",
    appId: "1:335346617782:web:fd7ea0326ffe84b4924517",
    measurementId: "G-K1SE7V84QW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const db = getFirestore(app);
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});
export const storage = getStorage(app);
