import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ChatScreen from '../screens/ChatScreen';
import AddPeerScreen from '../screens/AddPeerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LockScreen from '../screens/LockScreen';
import {useApp} from '../context/AppContext';
import {useTheme} from '../context/ThemeContext';

const Stack = createStackNavigator();

const LoadingScreen = () => {
  const {colors, typography} = useTheme();
  return (
    <View style={[styles.loadingContainer, {backgroundColor: colors.background}]}> 
      <ActivityIndicator size="large" color={colors.primary} />
      <Text
        style={[
          styles.loadingText,
          typography.textStyle(typography.size.sm, typography.weight.semibold),
          {color: colors.textSecondary}
        ]}>
        Preparing Session secure network...
      </Text>
    </View>
  );
};

const AppNavigator = () => {
  const {ready, profile, appUnlocked} = useApp();

  if (!ready) {
    return <LoadingScreen />;
  }

  const pinLocked = Boolean(profile?.security?.pinEnabled) && !appUnlocked;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {!profile ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : pinLocked ? (
          <Stack.Screen name="Lock" component={LockScreen} />
        ) : (
          <>
            <Stack.Screen name="Contacts" component={ContactsScreen} />
            <Stack.Screen name="AddPeer" component={AddPeerScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 12
  }
});

export default AppNavigator;
