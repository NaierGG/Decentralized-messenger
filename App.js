import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import {AppProvider} from './src/context/AppContext';
import {ThemeProvider} from './src/context/ThemeContext';

const App = () => (
  <SafeAreaProvider>
    <ThemeProvider>
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

export default App;
