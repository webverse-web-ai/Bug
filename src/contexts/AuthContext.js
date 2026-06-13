import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { fetchCurrentUser, loginUser as apiLogin, verifyOTP as apiVerifyOTP, oauthLogin as apiOauthLogin, apiSaveGeminiToken, apiSaveOpenRouterKey, apiCompleteSetup } from '@/client/api/authService';
import { createTeam as apiCreateTeam, joinTeam as apiJoinTeam, manageMember as apiManageMember, updateProfile as apiUpdateProfile } from '@/client/api/teamService';
import { clearCache } from '@/client/cache/swr';

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
      // Hydrate the full user (incl. team membership) so onboarding gates are correct.
      setUser(await fetchCurrentUser().catch(() => data.user));
    }
    return data;
  };

  const oauthLogin = async (provider, accessToken) => {
    const data = await apiOauthLogin(provider, accessToken);
    if (data.token) {
      await saveToken(data.token);
      // Hydrate the full user (incl. team membership) so onboarding gates are correct.
      setUser(await fetchCurrentUser().catch(() => data.user));
    }
    return data;
  };

  const verifyOTP = async (email, otp) => {
    const data = await apiVerifyOTP(email, otp);
    if (data.token) {
      await saveToken(data.token);
      // Hydrate the full user (incl. team membership) so onboarding gates are correct.
      setUser(await fetchCurrentUser().catch(() => data.user));
    }
    return data;
  };

  const saveGeminiToken = async (accessToken) => {
    await apiSaveGeminiToken(accessToken);
    setUser(prev => ({ ...prev, hasGeminiToken: true }));
  };

  const saveOpenRouterKey = async (key) => {
    await apiSaveOpenRouterKey(key);
    setUser(prev => ({ ...prev, hasOpenRouterKey: true }));
  };

  const completeSetup = async (username, path) => {
    const data = await apiCompleteSetup(username, path);
    setUser(prev => ({ ...prev, username: data.user.username }));
    return data;
  };

  // Re-fetch the full user (team status, role, AI flags) from the server.
  const refreshUser = async () => {
    try { const u = await fetchCurrentUser(); setUser(u); return u; } catch { return null; }
  };

  const createTeam = async (businessUsername, businessName) => {
    const data = await apiCreateTeam(businessUsername, businessName);
    if (data.token) await saveToken(data.token); // new token carries the teamId
    await refreshUser();
    return data;
  };

  const joinTeam = async (businessUsername) => {
    const data = await apiJoinTeam(businessUsername);
    if (data.token) await saveToken(data.token);
    await refreshUser();
    return data;
  };

  const manageMember = async (userId, action, role, permissions) => {
    const data = await apiManageMember(userId, action, role, permissions);
    return data;
  };

  const updateProfile = async (payload) => {
    const data = await apiUpdateProfile(payload);
    await refreshUser();
    return data;
  };

  const logout = async () => {
    clearCache(); // drop cached workspace data so the next user starts clean
    if (Platform.OS === 'web') {
      localStorage.removeItem('jwt_token');
    } else {
      await SecureStore.deleteItemAsync('jwt_token');
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, oauthLogin, logout, verifyOTP, saveGeminiToken, saveOpenRouterKey, completeSetup, refreshUser, createTeam, joinTeam, manageMember, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
