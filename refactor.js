const fs = require('fs');
const file = 'src/app/project/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add imports
const importsToAdd = `
import { useProjectHydration } from './_hooks/useProjectHydration';
import { useProjectMutations } from './_hooks/useProjectMutations';
import { useKeyboardShortcuts } from './_hooks/useKeyboardShortcuts';
import { EditorSidebar } from './_components/EditorSidebar';
`;
content = content.replace('// ── Components ─────────────────────────────────────────────────────────────', '// ── Components ─────────────────────────────────────────────────────────────' + importsToAdd);

// Remove extracted lines (Auth redirect to handleGenerateCuts)
const startToRemove = '  // ── Auth redirect ────────────────────────────────────────────────────────';
const endToRemove = '  const handleDownloadPDF = useCallback(async () => {';
const beforeExtracted = content.split(startToRemove)[0];
const afterExtracted = content.split(endToRemove)[1];

const replacementHooks = `  // ── Auth redirect ────────────────────────────────────────────────────────
  const {
    activeSurface, activeSurfacePieces, activeSurfaceObstacles,
    areaToCover, coveredArea, projectAreaToCover, projectCoveredArea,
    wasteArea, materialUsage, groupedRemnantsByMaterial
  } = useProjectHydration(project, surfaces, placedPieces, obstacles, es, authLoading, checkingAuth, user);

  const {
    handlePiecePlacement, handlePieceDelete, handleBatchDeletePieces,
    handleClearAll, handleRotateMaterial, handleFinishDrawingObstacle,
    handleDeleteObstacle, handleGenerateCuts
  } = useProjectMutations(
    firestore, project ?? null, activeSurface, activeSurfacePieces, activeSurfaceObstacles,
    placedPieces, obstacles, es, addToHistory, toast,
    setIsDrawingObstacle, setEditingObstacleId, setCurrentObstaclePoints, setIsObstaclesSheetOpen
  );

  useKeyboardShortcuts(historyIndex, history.length, isUndoingOrRedoing, undo, redo, es, setIsPivotSelectorOpen);

  const handleStartDrawingObstacle = useCallback(() => {
    setIsDrawingObstacle(true);
    setEditingObstacleId(null);
    setCurrentObstaclePoints([]);
  }, []);

  const handleEditObstacle = useCallback((o: Obstacle) => {
    setEditingObstacleId(o.id);
    setCurrentObstaclePoints([...o.points]);
    setObstacleAnchorIndex(0);
    setIsDrawingObstacle(true);
    setIsObstaclesSheetOpen(false);
  }, []);

  const handleAddObstacleSegment = useCallback((newPoint: Point) => {
    setCurrentObstaclePoints(prev => [...prev, newPoint]);
  }, []);

  const handleUndoObstacleSegment = useCallback(() => {
    setCurrentObstaclePoints(prev => prev.slice(0, -1));
  }, []);

  const handleUpdateObstacleStartPoint = useCallback((newPoint: Point) => {
    setCurrentObstaclePoints(prev => {
      if (prev.length === 0) return prev;
      const currentStart = prev[0];
      const dx = newPoint.x - currentStart.x;
      const dy = newPoint.y - currentStart.y;
      if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return prev;
      return prev.map(p => ({ x: p.x + dx, y: p.y + dy }));
    });
  }, []);

  const handleUpdateObstacleLastPoint = useCallback((newPoint: Point) => {
    setCurrentObstaclePoints(prev => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = newPoint;
      return copy;
    });
  }, []);

  const handleCancelObstacleDrawing = useCallback(() => {
    setIsDrawingObstacle(false);
    setEditingObstacleId(null);
    setCurrentObstaclePoints([]);
    setPreviewSegment(null);
  }, []);

  const handleDownloadPDF = useCallback(async () => {`;

content = beforeExtracted + replacementHooks + afterExtracted;

// Replace sidebar
const sidebarStart = '        {/* ── Left sidebar: Resumen + Cortes ─────────────────────────────── */}';
const sidebarEnd = '        {/* ── Main area ──────────────────────────────────────────────────── */}';
const sidebarReplacement = `        {/* ── Left sidebar: Resumen + Cortes ─────────────────────────────── */}
        <EditorSidebar
          es={es}
          project={project}
          areaToCover={areaToCover}
          projectAreaToCover={projectAreaToCover}
          coveredArea={coveredArea}
          projectCoveredArea={projectCoveredArea}
          wasteArea={wasteArea}
          materialUsage={materialUsage}
          groupedRemnantsByMaterial={groupedRemnantsByMaterial}
        />

        {/* ── Main area ──────────────────────────────────────────────────── */}`;

content = content.replace(new RegExp(sidebarStart.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '.*?' + sidebarEnd.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 's'), sidebarReplacement);

fs.writeFileSync(file, content);
console.log('Modified page.tsx');
