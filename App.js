import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import {AppProvider} from './src/context/AppContext';

const App = () => (
  <SafeAreaProvider>
    <AppProvider>
      <AppNavigator />
    </AppProvider>
  </SafeAreaProvider>
);

export default App;
