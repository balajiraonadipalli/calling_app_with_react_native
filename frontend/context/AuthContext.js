import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Listen to Firebase Auth State Changes globally instead of local AsyncStorage polling
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Fetch the expanded profile (Role, Name) from Firestore Users collection
                try {
                    const userDocRef = doc(db, 'users', firebaseUser.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        setUser({ id: firebaseUser.uid, email: firebaseUser.email, ...userDoc.data() });
                    } else {
                        // Fallback block if Firestore doc does not exist for some reason
                        setUser({ id: firebaseUser.uid, email: firebaseUser.email, role: 'student', name: 'User' });
                    }
                } catch (error) {
                    console.error("Error fetching user profile from Firestore:", error);
                    setUser({ id: firebaseUser.uid, email: firebaseUser.email, role: 'student', name: 'User' });
                }
            } else {
                setUser(null);
            }
            setIsLoading(false);
        });

        // Cleanup subscription on unmount
        return unsubscribe;
    }, []);

    const login = async (email, password) => {
        try {
            console.log(`[AuthContext] Attempting to login user: ${email}`);
            await signInWithEmailAndPassword(auth, email, password);
            console.log(`[AuthContext] Login successful for: ${email}`);
            // onAuthStateChanged automatically triggers and updates `user` state
        } catch (e) {
            console.error(`[AuthContext] Login Error:`, e.code, e.message);
            throw e.message;
        }
    };

    const register = async (name, email, password, role, phoneNumber) => {
        try {
            console.log(`[AuthContext] Attempting to register user: ${email} as ${role}`);
            // 1. Create native Firebase User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;
            console.log(`[AuthContext] Successfully created Firebase Auth user: ${firebaseUser.uid}`);

            // 2. Hydrate their profile in Firestore so we can track their role and display name
            await setDoc(doc(db, 'users', firebaseUser.uid), {
                name,
                email,
                role, // 'student' or 'tutor'
                phoneNumber,
                createdAt: new Date()
            });
            console.log(`[AuthContext] Successfully saved user profile to Firestore`);
            // onAuthStateChanged triggers after this resolving
        } catch (e) {
            console.error(`[AuthContext] Registration Error:`, e.code, e.message);
            throw e.message;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
        } catch (e) {
            console.error("Logout Error", e);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
