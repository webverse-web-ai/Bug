import { Platform } from 'react-native';
import { getToken } from './authService';

const host = () => {
  if (__DEV__ && Platform.OS !== 'web') return Platform.OS === 'android' ? 'http://10.0.2.2:8082' : 'http://localhost:8082';
  return '';
};
const headers = async () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` });

const json = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

export const checkTeamUsername = async (username) =>
  json(await fetch(`${host()}/api/team/check-username?username=${encodeURIComponent(username)}`, { headers: await headers() }));

export const getMyTeam = async () =>
  json(await fetch(`${host()}/api/team`, { headers: await headers(), cache: 'no-store' }));

export const createTeam = async (businessUsername, businessName) =>
  json(await fetch(`${host()}/api/team`, { method: 'POST', headers: await headers(), body: JSON.stringify({ businessUsername, businessName }) }));

export const joinTeam = async (businessUsername) =>
  json(await fetch(`${host()}/api/team/join`, { method: 'POST', headers: await headers(), body: JSON.stringify({ businessUsername }) }));

export const manageMember = async (userId, action, role, permissions) =>
  json(await fetch(`${host()}/api/team/member`, { method: 'PUT', headers: await headers(), body: JSON.stringify({ userId, action, role, permissions }) }));

export const updateProfile = async (payload) =>
  json(await fetch(`${host()}/api/profile`, { method: 'PUT', headers: await headers(), body: JSON.stringify(payload) }));
