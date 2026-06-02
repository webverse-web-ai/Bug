/**
 * Form validation utilities for auth screens.
 */

export const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validatePassword = (password, minLength = 8) => {
  return password && password.length >= minLength;
};

export const validatePasswordMatch = (password, confirmPassword) => {
  return password === confirmPassword;
};

export const validateRequired = (value) => {
  return value && value.trim().length > 0;
};

/**
 * Returns a password strength score from 0 to 1.
 */
export const getPasswordStrength = (password) => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score += 0.2;
  if (password.length >= 10) score += 0.2;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 0.2;
  if (/[0-9]/.test(password)) score += 0.2;
  if (/[^A-Za-z0-9]/.test(password)) score += 0.2;
  return score;
};
