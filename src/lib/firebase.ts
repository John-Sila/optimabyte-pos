import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Fallback config to prevent crash if file is missing
// The actual config is injected by set_up_firebase tool
let config = {
  apiKey: "AIzaSyCz44x30JDvPMRDyzOcFktAyYN6arp4EV8",
  authDomain: "pos-system-12348.firebaseapp.com",
  projectId: "pos-system-12348",
  storageBucket: "pos-system-12348.firebasestorage.app",
  messagingSenderId: "587882286852",
  appId: "1:587882286852:web:1bfeab58843f423085ca51",
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
