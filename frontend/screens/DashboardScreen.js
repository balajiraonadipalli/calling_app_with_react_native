import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, Alert, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, getDocs, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';

export default function DashboardScreen({ navigation }) {
    const { user, logout } = useContext(AuthContext);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [incomingCall, setIncomingCall] = useState(null);

    useEffect(() => {
        if (incomingCall) {
            // Vibrate pattern: wait 0ms, vibrate 1000ms, wait 1000ms, repeat
            Vibration.vibrate([0, 1000, 1000], true);
        } else {
            Vibration.cancel();
        }
        return () => Vibration.cancel();
    }, [incomingCall]);

    useEffect(() => {
        if (!user || (!user.id && !user.uid)) return;

        // Query sessions based on whether the user is a student or tutor
        const sessionsRef = collection(db, 'sessions');
        const roleField = user.role === 'student' ? 'studentId' : 'tutorId';

        // We query by role ID and sort on the client side to avoid Firebase Index errors
        const q = query(
            sessionsRef,
            where(roleField, '==', user.id || user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionsData = [];
            let foundIncoming = null;

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const sessionObj = { id: docSnap.id, ...data };
                sessionsData.push(sessionObj);

                // Check if this session is ringing and WE are the receiver (callerId exists, but it's not us)
                if (data.status === 'ringing' && data.callerId && data.callerId !== (user.id || user.uid)) {
                    foundIncoming = sessionObj;
                }
            });
            // Sort chronologically on the client side since we removed the Firestore orderBy constraint
            sessionsData.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

            setSessions(sessionsData);
            setIncomingCall(foundIncoming);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching sessions:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const createTestSession = async () => {
        try {
            setLoading(true);

            // Fetch one REAL opposing user from the database to create a test session with
            const otherRole = user.role === 'student' ? 'tutor' : 'student';
            const usersRef = collection(db, 'users');
            const oppQuery = query(usersRef, where('role', '==', otherRole), limit(1));
            const querySnapshot = await getDocs(oppQuery);

            let otherUser = { id: `mock-${otherRole}-id`, name: `Mock ${otherRole}` };
            if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                otherUser = { id: docSnap.id, name: docSnap.data().name || `Test ${otherRole}` };
            }

            const newSession = {
                studentId: user.role === 'student' ? user.id || user.uid : otherUser.id,
                student: { name: user.role === 'student' ? user.name : otherUser.name },
                tutorId: user.role === 'tutor' ? user.id || user.uid : otherUser.id,
                tutor: { name: user.role === 'tutor' ? user.name : otherUser.name },
                status: 'upcoming',
                scheduledAt: new Date().toISOString(),
                createdAt: new Date()
            };

            await addDoc(collection(db, 'sessions'), newSession);
            // onSnapshot will automatically catch this and refresh the list
        } catch (error) {
            console.error("Error creating test session:", error);
            setLoading(false);
        }
    };

    const initiateCall = async (session) => {
        try {
            const sessionRef = doc(db, 'sessions', session.id || session._id);
            await updateDoc(sessionRef, {
                status: 'ringing',
                callerId: user.id || user.uid
            });
            navigation.navigate('Call', { sessionId: session.id || session._id });
        } catch (error) {
            console.error("Error initiating call:", error);
            Alert.alert("Error", "Could not ring the other user.");
        }
    };

    const answerCall = async () => {
        if (!incomingCall) return;
        try {
            const sessionRef = doc(db, 'sessions', incomingCall.id || incomingCall._id);
            await updateDoc(sessionRef, { status: 'in-progress' });
            setIncomingCall(null);
            navigation.navigate('Call', { sessionId: incomingCall.id || incomingCall._id });
        } catch (error) {
            console.error("Error answering call:", error);
        }
    };

    const declineCall = async () => {
        if (!incomingCall) return;
        try {
            const sessionRef = doc(db, 'sessions', incomingCall.id || incomingCall._id);
            await updateDoc(sessionRef, {
                status: 'upcoming',
                callerId: null
            });
            setIncomingCall(null);
        } catch (error) {
            console.error("Error declining call:", error);
        }
    };

    const cancelStuckCall = async (session) => {
        try {
            Alert.alert(
                "Cancel Call",
                "Are you sure you want to cancel this ringing call?",
                [
                    { text: "No", style: "cancel" },
                    {
                        text: "Yes", onPress: async () => {
                            const sessionRef = doc(db, 'sessions', session.id || session._id);
                            await updateDoc(sessionRef, {
                                status: 'upcoming',
                                callerId: null
                            });
                        }
                    }
                ]
            );
        } catch (error) {
            console.error("Error canceling call:", error);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return '#10B981'; // Green
            case 'processing': return '#F59E0B'; // Orange
            case 'upcoming': return '#3B82F6'; // Blue
            default: return '#64748B'; // Gray
        }
    };

    const renderSessionCard = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('SessionDetails', { sessionId: item.id || item._id })}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                    {user.role === 'student' ? `Tutor: ${item.tutor?.name || 'Unknown'}` : `Student: ${item.student?.name || 'Unknown'}`}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
            </View>

            <Text style={styles.dateText}>
                {new Date(item.scheduledAt).toLocaleDateString()} at {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>

            {item.status === 'upcoming' && (
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.detailsButton}
                        onPress={() => navigation.navigate('SessionDetails', { sessionId: item.id || item._id })}
                    >
                        <Text style={styles.detailsButtonText}>Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.callButton}
                        onPress={() => initiateCall(item)}
                    >
                        <Text style={styles.callButtonText}>📞 Call {user.role === 'student' ? 'Tutor' : 'Student'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {item.status === 'ringing' && item.callerId === (user.id || user.uid) && (
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.callButton, { backgroundColor: '#EF4444' }]}
                        onPress={() => cancelStuckCall(item)}
                    >
                        <Text style={styles.callButtonText}>✕ Cancel Call</Text>
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {user?.name}</Text>
                    <Text style={styles.subtitle}>Your Sessions</Text>
                </View>
                <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSessionCard}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No sessions found.</Text>
                    }
                />
            )}

            {!loading && (
                <TouchableOpacity style={styles.testBtn} onPress={createTestSession}>
                    <Text style={styles.testBtnText}>+ Create Test Session</Text>
                </TouchableOpacity>
            )}

            {/* Incoming Call Modal */}
            <Modal
                visible={!!incomingCall}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.ringingCard}>
                        <View style={styles.pulsingCircle}>
                            <Text style={styles.ringingIcon}>📞</Text>
                        </View>
                        <Text style={styles.incomingText}>Incoming Call</Text>
                        <Text style={styles.callerNameText}>
                            {incomingCall?.callerId === incomingCall?.studentId
                                ? incomingCall?.student?.name
                                : incomingCall?.tutor?.name}
                        </Text>

                        <View style={styles.ringActionRow}>
                            <TouchableOpacity style={styles.declineBtn} onPress={declineCall}>
                                <Text style={styles.ringBtnText}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.answerBtn} onPress={answerCall}>
                                <Text style={styles.ringBtnText}>Answer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    greeting: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1E293B',
    },
    subtitle: {
        fontSize: 16,
        color: '#64748B',
        marginTop: 4,
    },
    logoutBtn: {
        padding: 8,
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
    },
    logoutText: {
        color: '#EF4444',
        fontWeight: '600',
    },
    testBtn: {
        backgroundColor: '#10B981',
        padding: 16,
        margin: 20,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    testBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    listContainer: {
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
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#334155',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    dateText: {
        fontSize: 14,
        color: '#94A3B8',
        marginBottom: 16,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    detailsButton: {
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    detailsButtonText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 14,
    },
    callButton: {
        backgroundColor: '#10B981', // Green for calling
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        flex: 1.5,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    callButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginTop: 40,
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ringingCard: {
        backgroundColor: '#FFF',
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
        width: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    pulsingCircle: {
        width: 80,
        height: 80,
        backgroundColor: '#10B98120',
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 2,
        borderColor: '#10B981',
    },
    ringingIcon: {
        fontSize: 32,
    },
    incomingText: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: '600',
        marginBottom: 8,
    },
    callerNameText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 30,
        textAlign: 'center',
    },
    ringActionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    declineBtn: {
        flex: 1,
        backgroundColor: '#EF4444',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginRight: 10,
    },
    answerBtn: {
        flex: 1,
        backgroundColor: '#10B981',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginLeft: 10,
    },
    ringBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    }
});
