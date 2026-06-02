import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Since we are using Expo API Routes, the URL can just be relative when running in the same web environment,
 * or it needs the full host URL if running on a native device connecting to the local server.
 * During development, Expo API routes usually run on the same port as the Metro bundler.
 * You may need to dynamically adjust this based on your env.
 */
// If on native device, replace localhost with your machine's local IP (e.g., http://192.168.1.100:8081)
const getApiUrl = () => {
  if (__DEV__ && Platform.OS !== 'web') {
    // Determine automatically or hardcode to your local network IP if needed
    // Assuming standard Expo port 8081 for now. If using an emulator, 10.0.2.2 works for Android.
    return Platform.OS === 'android' ? 'http://10.0.2.2:8081' : 'http://localhost:8081';
  }
  return ''; // For web, relative paths work
};

const API_BASE_URL = getApiUrl() + '/api/auth';

const getHeaders = async () => {
  let token = null;
  try {
    if (Platform.OS === 'web') {
      token = localStorage.getItem('jwt_token');
    } else {
      token = await SecureStore.getItemAsync('jwt_token');
    }
  } catch (e) {
    console.warn("Could not get token:", e);
  }

  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const loginUser = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to login');
  return data;
};

export const signupUser = async (fullName, email, password) => {
  const response = await fetch(`${API_BASE_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email, password }),
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to signup');
  return data;
};

export const verifyOTP = async (email, otp) => {
  const response = await fetch(`${API_BASE_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to verify OTP');
  return data;
};

export const fetchCurrentUser = async () => {
  const response = await fetch(`${API_BASE_URL}/me`, {
    method: 'GET',
    headers: await getHeaders(),
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch user');
  return data.user;
};

export const forgotPassword = async (email) => {
  const response = await fetch(`${API_BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to send recovery email');
  return data;
};

export const resetPassword = async (email, otp, newPassword) => {
  const response = await fetch(`${API_BASE_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, newPassword }),
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to reset password');
  return data;
};

export const socialLogin = async (provider) => {
  // Social auth will be implemented in the next phase
  throw new Error("Social auth not yet implemented");
};
