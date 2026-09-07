import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const missingConfig = Object.entries(config).filter(([, value]) => !value?.trim()).map(([key]) => key);
export function initializeFirebase() {
  if (missingConfig.length) throw new Error(`Add Firebase configuration to .env.local: ${missingConfig.join(', ')}`);
  const app = initializeApp(config);
  const auth = getAuth(app);
  auth.useDeviceLanguage();
  return { auth, database: getDatabase(app) };
}
