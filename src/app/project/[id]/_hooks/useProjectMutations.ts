import { useCallback } from 'react';
import { doc, collection, writeBatch, updateDoc, getDoc, serverTimestamp, arrayUnion, setDoc, deleteDoc } from 'firebase/firestore';
import { useEditorState } from './useEditorState';
type EditorState = ReturnType<typeof useEditorState>;
import { calculatePlacementFragments, calculateOffcuts } from '../_utils/clipper-geometry';
import type { PlacedPiece, Remnant, Project, Point, Material, Obstacle, Surface } from '@/lib/types';
import { calculatePolygonArea } from '@/lib/utils';

export function useProjectMutations(
  firestore: any,
  project: Project | null,
  activeSurface: Surface | null,
  activeSurfacePieces: PlacedPiece[],
  activeSurfaceObstacles: Obstacle[],
  placedPieces: PlacedPiece[] | undefined | null,
  obstacles: Obstacle[] | undefined | null,
  es: EditorState,
  addToHistory: (entry: any) => void,
  toast: any,
  currentObstaclePoints: Point[],
  editingObstacleId: string | null,
  setIsDrawingObstacle: React.Dispatch<React.SetStateAction<boolean>>,
  setEditingObstacleId: React.Dispatch<React.SetStateAction<string | null>>,
  setCurrentObstaclePoints: React.Dispatch<React.SetStateAction<Point[]>>,
  setIsObstaclesSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
) {
  const handlePiecePlacement = useCallback(async (positions: Point[]) => {
    if (!es.activeBrush || !positions.length || !activeSurface || !project || !firestore || !placedPieces) return;
    const { activeBrush, brushAngle } = es;
    const materialId = activeBrush.type === 'material' ? activeBrush.id : activeBrush.materialId;
    if (!materialId) { toast({ title: 'Error Crítico', variant: 'destructive' }); return; }

    const placements = positions.map((pos, index) => {
      const idealPiece = { x: pos.x, y: pos.y, width: activeBrush.width, height: activeBrush.height, rotation: brushAngle };
      const currentSourceSheetId = activeBrush.type === 'material'
        ? crypto.randomUUID()
        : project.remnants?.find(r => r.id === activeBrush.instanceIds[index])?.sourceSheetId;
      const groupedFragments = calculatePlacementFragments(idealPiece, activeBrush, activeSurface, activeSurfacePieces, activeSurfaceObstacles, es.isFillMode);
      const allFragments = groupedFragments.flat();
      const offcuts = groupedFragments.length > 0 ? calculateOffcuts(idealPiece, allFragments, materialId, activeBrush, currentSourceSheetId) : [];
      return { idealPiece, groupedFragments, offcuts, currentSourceSheetId };
    });

    const validPlacements = placements.filter(p => p.groupedFragments.length > 0);
    if (!validPlacements.length) {
      toast({ title: 'Colocación inválida', description: 'La pieza se superpone. Active el Modo Relleno para recortar automáticamente.', variant: 'destructive' });
      return;
    }

    const newPiecesData: Omit<PlacedPiece, 'id'>[] = [];
    const allOffcuts: Remnant[] = [];

    validPlacements.forEach(({ groupedFragments, offcuts, currentSourceSheetId }) => {
      const placementId = crypto.randomUUID();
      groupedFragments.forEach(fragmentGroup => {
        const allPoints = fragmentGroup.flatMap(f => f.points);
        const xs = allPoints.map(p => p.x), ys = allPoints.map(p => p.y);
        newPiecesData.push({
          placementId, surfaceId: activeSurface.id, materialId,
          source: { type: activeBrush.type, id: activeBrush.type === 'remnant' ? activeBrush.shapeId : activeBrush.id },
          x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2,
          width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
          rotation: 0, fragments: fragmentGroup,
          createdAt: serverTimestamp(), sourceSheetId: currentSourceSheetId,
        } as Omit<PlacedPiece, 'id'>);
      });
      allOffcuts.push(...offcuts);
    });

    try {
      const projectRef = doc(firestore, 'projects', project.id);
      const projectSnap = await getDoc(projectRef);
      const currentRemnants = projectSnap.exists() ? (projectSnap.data().remnants ?? []) : [];

      let newRemnantsState = [...currentRemnants];
      if (activeBrush.type === 'remnant') {
        const numUsed = validPlacements.length;
        newRemnantsState = newRemnantsState.filter(r => !activeBrush.instanceIds.slice(0, numUsed).includes(r.id));
        const newCount = activeBrush.count - numUsed;
        if (newCount > 0) es.setActiveBrush({ ...activeBrush, count: newCount, instanceIds: activeBrush.instanceIds.slice(numUsed) });
        else es.setActiveBrush(null);
      }
      if (allOffcuts.length) newRemnantsState = [...newRemnantsState, ...allOffcuts];

      const batch = writeBatch(firestore);
      const addedPieces: PlacedPiece[] = [];
      for (const pd of newPiecesData) {
        const ref = doc(collection(firestore, 'projects', project.id, 'placedPieces'));
        batch.set(ref, pd);
        addedPieces.push({ ...pd, id: ref.id, createdAt: new Date() } as PlacedPiece);
      }
      batch.update(projectRef, { remnants: newRemnantsState });
      await batch.commit();
      addToHistory({
        type: 'add-pieces',
        payload: {
          oldState: { pieces: [], remnants: currentRemnants },
          newState: { pieces: addedPieces, remnants: newRemnantsState }
        }
      });
    } catch (e) {
      console.error('Error placing piece(s):', e);
      toast({ title: 'Error', description: 'No se pudieron guardar las piezas.', variant: 'destructive' });
    }
  }, [es, activeSurface, activeSurfacePieces, activeSurfaceObstacles, project, firestore, placedPieces, addToHistory, toast]);

  const handlePieceDelete = useCallback(async (pieceId: string) => {
    if (!project || !firestore || !placedPieces) return;
    const pieceRef = doc(firestore, 'projects', project.id, 'placedPieces', pieceId);
    try {
      const projectRef = doc(firestore, 'projects', project.id);
      const [snap, projectSnap] = await Promise.all([getDoc(pieceRef), getDoc(projectRef)]);
      if (!snap.exists()) return;
      const piece = { id: snap.id, ...snap.data() } as PlacedPiece;
      const currentRemnants = projectSnap.exists() ? (projectSnap.data().remnants ?? []) : [];

      const allPts = piece.fragments.flatMap(f => f.points);
      const xs = allPts.map(p => p.x), ys = allPts.map(p => p.y);
      const newRemnant: Remnant = {
        id: crypto.randomUUID(), materialId: piece.materialId,
        points: piece.fragments[0]?.points ?? [], fragments: piece.fragments,
        x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2,
        width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
        createdAt: new Date(), sourceSheetId: piece.sourceSheetId,
      };
      const newRemnantsState = [...currentRemnants, newRemnant];
      const batch = writeBatch(firestore);
      batch.delete(pieceRef);
      batch.update(projectRef, { remnants: newRemnantsState });
      await batch.commit();
      addToHistory({
        type: 'delete-pieces',
        payload: {
          oldState: { pieces: [piece], remnants: currentRemnants },
          newState: { pieces: [], remnants: newRemnantsState }
        }
      });
      toast({ title: 'Pieza movida a cortes' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', variant: 'destructive' });
    }
  }, [project, firestore, placedPieces, addToHistory, toast]);

  const handleBatchDeletePieces = useCallback(async (pieceIds: string[]) => {
    if (!project || !firestore || !placedPieces || !pieceIds.length) return;
    try {
      const projectRef = doc(firestore, 'projects', project.id);
      const projectSnap = await getDoc(projectRef);
      const currentRemnants = projectSnap.exists() ? (projectSnap.data().remnants ?? []) : [];
      const newRemnantsState = [...currentRemnants];

      const batch = writeBatch(firestore);
      const deletedPieces: PlacedPiece[] = [];
      for (const pid of pieceIds) {
        const ref = doc(firestore, 'projects', project.id, 'placedPieces', pid);
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const piece = { id: snap.id, ...snap.data() } as PlacedPiece;
        deletedPieces.push(piece);
        const allPts = piece.fragments.flatMap(f => f.points);
        const xs = allPts.map(p => p.x), ys = allPts.map(p => p.y);
        newRemnantsState.push({
          id: crypto.randomUUID(), materialId: piece.materialId,
          points: piece.fragments[0]?.points ?? [], fragments: piece.fragments,
          x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2,
          width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
          createdAt: new Date(), sourceSheetId: piece.sourceSheetId,
        });
        batch.delete(ref);
      }
      batch.update(projectRef, { remnants: newRemnantsState });
      await batch.commit();
      addToHistory({
        type: 'delete-pieces',
        payload: {
          oldState: { pieces: deletedPieces, remnants: currentRemnants },
          newState: { pieces: [], remnants: newRemnantsState }
        }
      });
      toast({ title: `${deletedPieces.length} piezas movidas a cortes` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', variant: 'destructive' });
    }
  }, [project, firestore, placedPieces, addToHistory, toast]);

  const handleClearAll = useCallback(async () => {
    if (!activeSurface || !project || !firestore || !placedPieces) return;
    try {
      const projectRef = doc(firestore, 'projects', project.id);
      const projectSnap = await getDoc(projectRef);
      const currentRemnants = projectSnap.exists() ? (projectSnap.data().remnants ?? []) : [];
      if (!activeSurfacePieces.length && !currentRemnants.length) return;

      const batch = writeBatch(firestore);
      activeSurfacePieces.forEach(piece => {
        if (piece.id && !piece.id.startsWith('temp-'))
          batch.delete(doc(firestore, 'projects', project.id, 'placedPieces', piece.id));
      });
      if (currentRemnants.length) batch.update(projectRef, { remnants: [] });
      await batch.commit();
      if (es.activeBrush?.type === 'remnant') es.setActiveBrush(null);
      
      window.dispatchEvent(new CustomEvent('deco-clear-measurements'));

      addToHistory({
        type: 'clear-all',
        payload: {
          oldState: { pieces: activeSurfacePieces, remnants: currentRemnants },
          newState: { pieces: [], remnants: [] }
        }
      });
      toast({ title: 'Lienzo y Cortes Limpios' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', variant: 'destructive' });
    }
  }, [activeSurface, project, firestore, placedPieces, activeSurfacePieces, es, addToHistory, toast]);

  const handleRotateMaterial = useCallback(() => {
    if (!project || !firestore || !es.activeBrush || es.activeBrush.type !== 'material') return;
    const materialId = es.activeBrush.id;
    updateDoc(doc(firestore, 'projects', project.id), {
      materials: project.materials.map(m =>
        m.id === materialId ? { ...m, width: m.height, height: m.width } : m
      ),
    });
    es.setActiveBrush({ ...es.activeBrush, width: es.activeBrush.height, height: es.activeBrush.width });
  }, [project, firestore, es]);

  const handleFinishDrawingObstacle = useCallback(async (closeLoop = false, name?: string) => {
    if (!project || !firestore || !activeSurface || currentObstaclePoints.length < 3) {
      setIsDrawingObstacle(false); setCurrentObstaclePoints([]); return;
    }
    try {
      if (editingObstacleId) {
        const existingObs = obstacles?.find(o => o.id === editingObstacleId);
        await updateDoc(doc(firestore, 'projects', project.id, 'obstacles', editingObstacleId), {
          points: currentObstaclePoints,
          name: name || existingObs?.name || `Obstáculo ${activeSurfaceObstacles.length + 1}`,
        });
      } else {
        const obsRef = doc(collection(firestore, 'projects', project.id, 'obstacles'));
        await setDoc(obsRef, {
          surfaceId: activeSurface.id,
          points: currentObstaclePoints,
          name: name || `Obstáculo ${activeSurfaceObstacles.length + 1}`,
        });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error al guardar obstáculo', variant: 'destructive' });
    } finally {
      setIsDrawingObstacle(false);
      setEditingObstacleId(null);
      setCurrentObstaclePoints([]);
      setIsObstaclesSheetOpen(true);
    }
  }, [project, firestore, activeSurface, currentObstaclePoints, editingObstacleId, toast, activeSurfaceObstacles, obstacles, setIsDrawingObstacle, setEditingObstacleId, setCurrentObstaclePoints, setIsObstaclesSheetOpen]);

  const handleDeleteObstacle = useCallback(async (obstacleId: string) => {
    if (!project || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'projects', project.id, 'obstacles', obstacleId));
      toast({ title: 'Obstáculo eliminado con éxito' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error al eliminar obstáculo', variant: 'destructive' });
    }
  }, [project, firestore, toast]);

  const handleGenerateCuts = useCallback(async (newRemnants: Remnant[]) => {
    if (!project || !firestore) return;
    try {
      const oldRemnants = project.remnants ?? [];
      await updateDoc(doc(firestore, 'projects', project.id), { remnants: arrayUnion(...newRemnants) });
      const newRemnantsState = [...oldRemnants, ...newRemnants];
      addToHistory({
        type: 'generate-cuts',
        payload: {
          oldState: { pieces: [], remnants: oldRemnants },
          newState: { pieces: [], remnants: newRemnantsState }
        }
      });
      toast({ title: 'Cortes Generados', description: `Se han añadido ${newRemnants.length} nuevos cortes al proyecto.` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', variant: 'destructive' });
    }
  }, [project, firestore, addToHistory, toast]);

  return {
    handlePiecePlacement,
    handlePieceDelete,
    handleBatchDeletePieces,
    handleClearAll,
    handleRotateMaterial,
    handleFinishDrawingObstacle,
    handleDeleteObstacle,
    handleGenerateCuts
  };
}
