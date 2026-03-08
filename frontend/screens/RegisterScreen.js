import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen({ navigation }) {
    const { register } = useContext(AuthContext);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('student'); // 'student' or 'tutor'
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!name || !email || !password) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        try {
            setLoading(true);
            await register(name, email, password, role, "000-000-0000");
        } catch (err) {
            Alert.alert('Registration Failed', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join AI Tutor Call Assistant</Text>
            </View>

            <View style={styles.formContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                />

                <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                />

                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />

                <View style={styles.roleContainer}>
                    <Text style={styles.roleLabel}>I am a:</Text>
                    <View style={styles.roleButtons}>
                        <TouchableOpacity
                            style={[
                                styles.roleBtn,
                                role === 'student' && styles.roleBtnActive
                            ]}
                            onPress={() => setRole('student')}
                        >
                            <Text style={[
                                styles.roleBtnText,
                                role === 'student' && styles.roleBtnTextActive
                            ]}>Student</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.roleBtn,
                                role === 'tutor' && styles.roleBtnActive
                            ]}
                            onPress={() => setRole('tutor')}
                        >
                            <Text style={[
                                styles.roleBtnText,
                                role === 'tutor' && styles.roleBtnTextActive
                            ]}>Tutor</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleRegister}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.buttonText}>Sign Up</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.navigate('Login')}
                    disabled={loading}
                >
                    <Text style={styles.linkButtonText}>Already have an account? Login</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 24,
        justifyContent: 'center',
    },
    headerContainer: {
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: '#64748B',
    },
    formContainer: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    input: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        fontSize: 16,
        color: '#334155',
    },
    roleContainer: {
        marginBottom: 16,
    },
    roleLabel: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 8,
        fontWeight: '500',
    },
    roleButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    roleBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
    },
    roleBtnActive: {
        backgroundColor: '#EEF2FF',
        borderColor: '#4F46E5',
    },
    roleBtnText: {
        color: '#64748B',
        fontWeight: '600',
    },
    roleBtnTextActive: {
        color: '#4F46E5',
    },
    button: {
        backgroundColor: '#4F46E5',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    linkButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    linkButtonText: {
        color: '#4F46E5',
        fontSize: 14,
        fontWeight: '500',
    }
});
