import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { UserProfile, Project, Surface, PlacedPiece, Obstacle } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';

export function useEditorData(projectId: string) {
  const { user, isUserLoading: authLoading } = useUser();
  const firestore = useFirestore();

  const [claims, setClaims] = useState<{ admin?: boolean }>({});
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [surfaces, setSurfaces] = useState<Surface[] | null>(null);
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[] | null>(null);
  const [obstacles, setObstacles] = useState<Obstacle[] | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Auth claims loading
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCheckingAuth(false);
      return;
    }
    user.getIdTokenResult()
      .then((idTokenResult) => {
        setClaims({ admin: !!idTokenResult.claims.admin });
        setCheckingAuth(false);
      })
      .catch((error) => {
        console.error("Error getting user token:", error);
        setCheckingAuth(false);
      });
  }, [user, authLoading]);

  // Profile loading
  useEffect(() => {
    if (!user || !firestore) return;
    const unsubscribe = onSnapshot(
      doc(firestore, 'users', user.uid),
      (snap) => {
        if (snap.exists()) setProfile({ id: snap.id, ...snap.data() } as UserProfile);
        else setProfile(null);
      },
      (err) => console.error("Profile error:", err)
    );
    return () => unsubscribe();
  }, [user, firestore]);

  // Editor data loading
  useEffect(() => {
    if (!firestore || !projectId) return;

    let isSubscribed = true;
    const unsubs: (() => void)[] = [];
    setIsLoading(true);
    setError(null);

    const handleError = (err: any, operation: string, path: string) => {
      if (!isSubscribed) return;
      if (err.code === 'failed-precondition' || err.message?.includes('failed-precondition')) {
        const urlMatch = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        if (urlMatch) {
          console.warn(`[Firestore Index Required] ${operation} on ${path}.\nCreate it here: ${urlMatch[0]}`);
        } else {
          console.warn(`[Firestore Index Required] ${operation} on ${path}.\n${err.message}`);
        }
        setError(err); // Preserve failed-precondition error
      } else {
        const contextualError = new FirestorePermissionError({ operation: 'list', path } as any);
        setError(contextualError);
      }
    };

    let projectLoaded = false;
    let surfacesLoaded = false;
    let piecesLoaded = false;
    let obstaclesLoaded = false;

    const checkLoading = () => {
      if (projectLoaded && surfacesLoaded && piecesLoaded && obstaclesLoaded && isSubscribed) {
        setIsLoading(false);
      }
    };

    // Project
    unsubs.push(
      onSnapshot(
        doc(firestore, "projects", projectId),
        (snap) => {
          if (!isSubscribed) return;
          if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
          else setProject(null);
          projectLoaded = true; checkLoading();
        },
        (err) => handleError(err, 'get', `projects/${projectId}`)
      )
    );

    // Surfaces
    unsubs.push(
      onSnapshot(
        collection(firestore, "projects", projectId, "surfaces"),
        (snap) => {
          if (!isSubscribed) return;
          setSurfaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Surface)));
          surfacesLoaded = true; checkLoading();
        },
        (err) => handleError(err, 'list', `projects/${projectId}/surfaces`)
      )
    );

    // Placed Pieces
    unsubs.push(
      onSnapshot(
        query(collection(firestore, "projects", projectId, "placedPieces"), orderBy('createdAt')),
        (snap) => {
          if (!isSubscribed) return;
          setPlacedPieces(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlacedPiece)));
          piecesLoaded = true; checkLoading();
        },
        (err) => handleError(err, 'list', `projects/${projectId}/placedPieces`)
      )
    );

    // Obstacles
    unsubs.push(
      onSnapshot(
        collection(firestore, "projects", projectId, "obstacles"),
        (snap) => {
          if (!isSubscribed) return;
          setObstacles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Obstacle)));
          obstaclesLoaded = true; checkLoading();
        },
        (err) => handleError(err, 'list', `projects/${projectId}/obstacles`)
      )
    );

    return () => {
      isSubscribed = false;
      unsubs.forEach(unsub => unsub());
    };
  }, [firestore, projectId]);

  return {
    user,
    authLoading,
    checkingAuth,
    claims,
    profile,
    project,
    surfaces,
    placedPieces,
    obstacles,
    isLoading: authLoading || checkingAuth || isLoading,
    error
  };
}
