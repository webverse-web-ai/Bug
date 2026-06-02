import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { fetchCurrentUser, loginUser as apiLogin, verifyOTP as apiVerifyOTP } from '../services/authService';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on boot
    const loadUser = async () => {
      try {
        let token;
        if (Platform.OS === 'web') {
          token = localStorage.getItem('jwt_token');
        } else {
          token = await SecureStore.getItemAsync('jwt_token');
        }

        if (token) {
          const userData = await fetchCurrentUser();
          setUser(userData);
        }
      } catch (error) {
        console.log("No valid session found:", error.message);
        await logout();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const saveToken = async (token) => {
    if (Platform.OS === 'web') {
      localStorage.setItem('jwt_token', token);
    } else {
      await SecureStore.setItemAsync('jwt_token', token);
    }
  };

  const login = async (email, password) => {
    const data = await apiLogin(email, password);
    if (data.token) {
      await saveToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const verifyOTP = async (email, otp) => {
    const data = await apiVerifyOTP(email, otp);
    if (data.token) {
      await saveToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = async () => {
    if (Platform.OS === 'web') {
      localStorage.removeItem('jwt_token');
    } else {
      await SecureStore.deleteItemAsync('jwt_token');
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, verifyOTP }}>
      {children}
    </AuthContext.Provider>
  );
};
