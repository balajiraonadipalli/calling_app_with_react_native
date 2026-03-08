import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';
import { ActivityIndicator, View, Text } from 'react-native';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CallScreen from '../screens/CallScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SessionDetailsScreen from '../screens/SessionDetailsScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const { user, isLoading } = useContext(AuthContext);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 10, color: '#64748B' }}>Loading application...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    // Authenticated User Stack
                    <>
                        <Stack.Screen name="Dashboard" component={DashboardScreen} />
                        <Stack.Screen name="Call" component={CallScreen} />
                        <Stack.Screen name="SessionDetails" component={SessionDetailsScreen} />
                    </>
                ) : (
                    // Auth Stack
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
