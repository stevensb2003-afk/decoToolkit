import { useState, useCallback, useRef } from 'react';
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import type { PlacedPiece, Remnant, Project, HistoryAction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cleanPayload } from '../_utils/clean-payload';

export function useHistory(firestore: any, project: Project | null) {
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoingOrRedoing, setIsUndoingOrRedoing] = useState(false);
  const { toast } = useToast();

  // Ref to keep historyIndex accessible synchronously inside callbacks
  // without creating stale closures that cause race conditions on concurrent writes.
  const historyIndexRef = useRef(-1);

  const addToHistory = useCallback((action: HistoryAction) => {
    const currentIndex = historyIndexRef.current;
    const nextIndex = currentIndex + 1;
    historyIndexRef.current = nextIndex;
    setHistory(prev => {
      const newHistory = prev.slice(0, nextIndex);
      newHistory.push(action);
      return newHistory;
    });
    setHistoryIndex(nextIndex);
  }, []);

  const applyState = (stateToApply: { pieces: PlacedPiece[]; remnants: Remnant[] }, stateToRemove: { pieces: PlacedPiece[]; remnants: Remnant[] }) => {
    if (!project) return null;
    const batch = writeBatch(firestore);
    const projectDocRef = doc(firestore, "projects", project.id);

    // 1. Remove pieces that shouldn't be there anymore
    stateToRemove.pieces.forEach(p => {
      const pieceRef = doc(firestore, "projects", project.id, "placedPieces", p.id);
      batch.delete(pieceRef);
    });

    // 2. Add pieces that should be there
    stateToApply.pieces.forEach(p => {
      const pieceRef = doc(firestore, "projects", project.id, "placedPieces", p.id);
      // Maintain original createdAt if present to avoid breaking ordering
      batch.set(pieceRef, cleanPayload({ ...p, createdAt: p.createdAt || serverTimestamp() }));
    });

    // 3. Sync remnants
    batch.update(projectDocRef, { remnants: cleanPayload(stateToApply.remnants ?? []) });
    
    return batch;
  };


  const undo = useCallback(() => {
    if (historyIndex < 0 || isUndoingOrRedoing || !firestore || !project) return;

    setIsUndoingOrRedoing(true);
    const actionToUndo = history[historyIndex];

    try {
      const batch = applyState(actionToUndo.payload.oldState, actionToUndo.payload.newState);
      if (!batch) {
        setIsUndoingOrRedoing(false);
        return;
      }

      // Optimistic local update
      const newIndex = historyIndex - 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);

      batch.commit().catch(e => {
        console.error("Error undoing action:", e);
        toast({ title: "Undo Failed", description: "Could not revert the last action.", variant: "destructive" });
        historyIndexRef.current = historyIndex; // Rollback ref
        setHistoryIndex(historyIndex); // Rollback optimistic update
      }).finally(() => {
        setIsUndoingOrRedoing(false);
      });

    } catch (e) {
      console.error("Error setting up undo action:", e);
      setIsUndoingOrRedoing(false);
    }
  }, [history, historyIndex, isUndoingOrRedoing, firestore, project, toast]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1 || isUndoingOrRedoing || !firestore || !project) return;

    setIsUndoingOrRedoing(true);
    const nextIndex = historyIndex + 1;
    const actionToRedo = history[nextIndex];

    try {
      const batch = applyState(actionToRedo.payload.newState, actionToRedo.payload.oldState);
      if (!batch) {
        setIsUndoingOrRedoing(false);
        return;
      }

      // Optimistic local update
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);

      batch.commit().catch(e => {
        console.error("Error redoing action:", e);
        toast({ title: "Redo Failed", description: "Could not re-apply the action.", variant: "destructive" });
        historyIndexRef.current = historyIndex; // Rollback ref
        setHistoryIndex(historyIndex); // Rollback optimistic update
      }).finally(() => {
        setIsUndoingOrRedoing(false);
      });

    } catch (e) {
      console.error("Error setting up redo action:", e);
      setIsUndoingOrRedoing(false);
    }
  }, [history, historyIndex, isUndoingOrRedoing, firestore, project, toast]);

  return {
    history,
    historyIndex,
    isUndoingOrRedoing,
    addToHistory,
    undo,
    redo
  };
}
