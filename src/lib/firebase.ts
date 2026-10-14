import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Project junction-e0625, same as the Flutter app. The "web" apiKey in
// firebase_options.dart belongs to another project and rejects our custom
// tokens (CREDENTIAL_MISMATCH), so default to the app's key for this project.
// Set VITE_FIREBASE_API_KEY / VITE_FIREBASE_APP_ID once a Web app is registered
// in the Firebase console.
const env = import.meta.env
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDzguQmJW2l8ZY5effSJ9zRrZ03i9lYpvQ',
  appId: env.VITE_FIREBASE_APP_ID || undefined,
  messagingSenderId: '944746529789',
  projectId: 'junction-e0625',
  authDomain: 'junction-e0625.firebaseapp.com',
  storageBucket: 'junction-e0625.firebasestorage.app',
}

const app = initializeApp(firebaseConfig)

export const firebaseAuth = getAuth(app)
export const firestore = getFirestore(app)

export async function signInToFirebase(customToken: string) {
  await signInWithCustomToken(firebaseAuth, customToken)
}
