import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const envOverride = (import.meta.env.VITE_FIREBASE_ENV || '').toString().trim().toLowerCase();
const isLocalHost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.|192\.168\.|10\.)/.test(window.location.hostname);
const useDev = envOverride === 'dev' || (!envOverride && isLocalHost);
const useEmulator =
  (import.meta.env.VITE_FIREBASE_EMULATOR || '').toString().trim().toLowerCase() === 'true';

const devConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_DEV_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_DEV_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_DEV_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_DEV_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_DEV_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_DEV_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID,
};

const prodConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfig = useDev ? devConfig : prodConfig;

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);

if (useEmulator) {
  try {
    const host = (import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1').toString();
    const port = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);
    connectFirestoreEmulator(firestore, host, port);
    // eslint-disable-next-line no-console
    console.info(`[HSB] Firestore emulator connected at ${host}:${port}`);
  } catch {
    // ignore
  }
}
