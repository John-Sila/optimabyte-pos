import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Fallback config to prevent crash if file is missing
// The actual config is injected by set_up_firebase tool
let config = {
  apiKey: "API_KEY_HERE",
  authDomain: "PROJECT_ID.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
  firestoreDatabaseId: "(default)"
};

try {
  // Try to load the config from the platform-generated file
  // Using dynamic import for JSON in ESM
  // @ts-ignore - Dynamically injected by platform
  const appletConfig = await import('../../firebase-applet-config.json', { with: { type: 'json' } });
  config = appletConfig.default;
} catch (e) {
  console.warn('Firebase config missing or load failed. App will be in limited mode.');
}

const app = getApps().length > 0 ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app, config.firestoreDatabaseId || '(default)');
