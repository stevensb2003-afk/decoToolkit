'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider, useFirebaseAuth } from '@/firebase/provider';
import { initializeFirebaseClient } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

// Initialize Firebase on the client side, once, when this module is first loaded.
const { firebaseApp, auth, firestore } = initializeFirebaseClient();

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // The new dedicated hook now manages the user authentication state.
  const userAuthState = useFirebaseAuth(auth);

  // The provider now simply passes all state (services and user auth state) down.
  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
      user={userAuthState.user}
      isUserLoading={userAuthState.isUserLoading}
      userError={userAuthState.userError}
    >
      {children}
    </FirebaseProvider>
  );
}
