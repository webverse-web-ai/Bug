import { Platform } from 'react-native';

// Google OAuth via expo-auth-session needs Web Crypto, which only exists in a
// secure context (https or localhost). On an insecure origin (e.g. a LAN IP)
// initializing the auth request crashes with "6000ms timeout exceeded". Use this
// to avoid mounting the auth hook where it isn't supported.
export const oauthSupported = () =>
  Platform.OS !== 'web' ||
  (typeof window !== 'undefined' &&
    (window.isSecureContext || /^(localhost|127\.0\.0\.1)$/.test(window.location?.hostname || '')));
