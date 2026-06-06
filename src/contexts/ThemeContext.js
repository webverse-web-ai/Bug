import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { DARK_COLORS, LIGHT_COLORS } from '@/constants/theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState('dark');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      let savedTheme = null;
      if (Platform.OS === 'web') {
        savedTheme = localStorage.getItem('theme_mode');
      } else {
        savedTheme = await SecureStore.getItemAsync('theme_mode');
      }
      
      if (savedTheme) {
        setThemeMode(savedTheme);
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(newTheme);

    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('theme_mode', newTheme);
      } else {
        await SecureStore.setItemAsync('theme_mode', newTheme);
      }
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const COLORS = themeMode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme, COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
