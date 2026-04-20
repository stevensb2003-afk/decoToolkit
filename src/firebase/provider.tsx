'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect, DependencyList } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// --- Types and Interfaces ---

interface FirebaseServices {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the context
export interface FirebaseContextState extends FirebaseServices, UserAuthState {
  areServicesAvailable: boolean;
}

// Props for the provider component
interface FirebaseProviderProps extends FirebaseServices, UserAuthState {
  children: ReactNode;
}

// Return type for useFirebase() hook
export interface FirebaseServicesAndUser extends Required<FirebaseServices>, UserAuthState { }

// Return type for useUser() hook
export type UserHookResult = UserAuthState;


// --- React Context ---
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);


/**
 * FirebaseProvider: A simple component that takes all state via props
 * and provides it to the context. It no longer contains any internal logic.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  user,
  isUserLoading,
  userError,
}) => {

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp,
      firestore,
      auth,
      user,
      isUserLoading,
      userError,
    };
  }, [firebaseApp, firestore, auth, user, isUserLoading, userError]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


// --- Hooks ---

/**
 * Hook to access the raw Firebase context.
 * Primarily for internal use by other hooks.
 */
function useFirebaseContext(): FirebaseContextState {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebaseContext must be used within a FirebaseProvider.');
  }
  return context;
}

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useFirebaseContext();

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider setup.');
  }

  return {
    firebaseApp: context.firebaseApp!,
    firestore: context.firestore!,
    auth: context.auth!,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

/**
 * Hook specifically for accessing the authenticated user's state.
 */
export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useFirebaseContext();
  return { user, isUserLoading, userError };
};


/**
 * A custom hook to manage the Firebase auth state.
 * This should be used in the top-level client provider.
 * @param auth The Firebase Auth instance.
 */
export const useFirebaseAuth = (auth: Auth | null): UserAuthState => {
  const [userState, setUserState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    if (!auth) {
      setUserState({ user: null, isUserLoading: false, userError: new Error("Auth service not available.") });
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUserState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => {
        console.error("useFirebaseAuth: onAuthStateChanged error:", error);
        setUserState({ user: null, isUserLoading: false, userError: error });
      }
    );

    // Timeout fallback in case Firebase hangs
    const timeoutId = setTimeout(() => {
      setUserState(prev => {
        if (prev.isUserLoading) {
          console.warn("useFirebaseAuth: Initialization timed out.");
          return {
            user: null,
            isUserLoading: false,
            userError: new Error("Auth initialization timed out. check your connection.")
          };
        }
        return prev;
      });
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    }
  }, [auth]);

  return userState;
};

// --- Utility Hooks ---
type MemoFirebase<T> = T & { __memo?: boolean };

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);

  if (typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;

  return memoized;
}
