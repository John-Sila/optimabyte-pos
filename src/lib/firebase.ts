import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let config = {
  apiKey: "AIzaSyCz44x30JDvPMRDyzOcFktAyYN6arp4EV8",
  authDomain: "pos-system-12348.firebaseapp.com",
  projectId: "pos-system-12348",
  storageBucket: "pos-system-12348.firebasestorage.app",
  messagingSenderId: "587882286852",
  appId: "1:587882286852:web:1bfeab58843f423085ca51",
  firestoreDatabaseId: "(default)"
};

const app = getApps().length > 0 ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app, config.firestoreDatabaseId || '(default)');
