import { useMemo, useEffect } from 'react';
import type { Project, Surface, PlacedPiece, Obstacle, Remnant, GroupedRemnant, Material } from '@/lib/types';
import { calculatePolygonArea } from '@/lib/utils';
import { useEditorState } from './useEditorState';
type EditorState = ReturnType<typeof useEditorState>;
import { useRouter } from 'next/navigation';

export type MaterialRemnantGroup = { material: Material; remnants: GroupedRemnant[] };

export function useProjectHydration(
  project: Project | null,
  surfaces: Surface[] | undefined | null,
  placedPieces: PlacedPiece[] | undefined | null,
  obstacles: Obstacle[] | undefined | null,
  es: EditorState,
  authLoading: boolean,
  checkingAuth: boolean,
  user: any
) {
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !checkingAuth && !user) router.replace('/login');
  }, [authLoading, checkingAuth, user, router]);

  useEffect(() => {
    if (surfaces?.length && !es.activeSurfaceId) es.setActiveSurfaceId(surfaces[0].id);
  }, [surfaces, es.activeSurfaceId, es]);

  const activeSurface = useMemo(
    () => surfaces?.find(s => s.id === es.activeSurfaceId) ?? null,
    [surfaces, es.activeSurfaceId]
  );
  const activeSurfacePieces = useMemo(
    () => placedPieces?.filter(p => p.surfaceId === activeSurface?.id) ?? [],
    [placedPieces, activeSurface]
  );
  const activeSurfaceObstacles = useMemo(
    () => obstacles?.filter(o => o.surfaceId === activeSurface?.id) ?? [],
    [obstacles, activeSurface]
  );

  const areaToCover = useMemo(() => {
    if (!activeSurface) return 0;
    return activeSurface.width * activeSurface.height
      - activeSurfaceObstacles.reduce((t, o) => t + Math.abs(calculatePolygonArea(o.points)), 0);
  }, [activeSurface, activeSurfaceObstacles]);

  const coveredArea = useMemo(
    () => activeSurfacePieces.reduce(
      (t, p) => t + Math.abs(p.fragments.reduce((s, f) => s + calculatePolygonArea(f.points), 0)), 0),
    [activeSurfacePieces]
  );

  const projectAreaToCover = useMemo(() => {
    if (!surfaces) return 0;
    return surfaces.reduce((t, s) => t + s.width * s.height, 0)
      - (obstacles ?? []).reduce((t, o) => t + Math.abs(calculatePolygonArea(o.points)), 0);
  }, [surfaces, obstacles]);

  const projectCoveredArea = useMemo(
    () => (placedPieces ?? []).reduce(
      (t, p) => t + Math.abs(p.fragments.reduce((s, f) => s + calculatePolygonArea(f.points), 0)), 0),
    [placedPieces]
  );

  const wasteArea = useMemo(() => {
    if (!project?.remnants) return 0;
    return project.remnants.reduce((total, r) => {
      const frags = r.fragments ?? [{ id: 'legacy', points: r.points }];
      return total + Math.abs(frags.reduce((s, f) => s + calculatePolygonArea(f.points), 0));
    }, 0);
  }, [project?.remnants]);

  const materialUsage = useMemo((): Map<string, number> => {
    const usage = new Map<string, number>();
    if (!project?.materials) return usage;
    project.materials.forEach(m => usage.set(m.id, 0));
    const uniqueSheets = new Map<string, Set<string>>();
    (placedPieces ?? []).forEach(p => {
      const sid = p.sourceSheetId || p.placementId || p.id;
      if (!uniqueSheets.has(p.materialId)) uniqueSheets.set(p.materialId, new Set());
      uniqueSheets.get(p.materialId)!.add(sid);
    });
    (project.remnants ?? []).forEach(r => {
      const sid = r.sourceSheetId || r.id;
      if (!uniqueSheets.has(r.materialId)) uniqueSheets.set(r.materialId, new Set());
      uniqueSheets.get(r.materialId)!.add(sid);
    });
    uniqueSheets.forEach((sheets, matId) => { if (usage.has(matId)) usage.set(matId, sheets.size); });
    return usage;
  }, [placedPieces, project?.materials, project?.remnants]);

  const groupedRemnantsByMaterial = useMemo((): Map<string, MaterialRemnantGroup> => {
    const result = new Map<string, MaterialRemnantGroup>();
    if (!project?.remnants || !project.materials) return result;
    const getShapeId = (r: Remnant) => {
      const frags = r.fragments ?? [{ id: 'legacy', points: r.points }];
      const allPts = frags.flatMap(f => f.points);
      const minX = Math.min(...allPts.map(p => p.x));
      const minY = Math.min(...allPts.map(p => p.y));
      return frags.map(f => {
        const pts = f.points
          .map(p => ({ x: Math.round((p.x - minX) * 100) / 100, y: Math.round((p.y - minY) * 100) / 100 }))
          .sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
        return pts.map(p => `${p.x},${p.y}`).join(';');
      }).sort().join('|');
    };
    const shapeGroups = new Map<string, GroupedRemnant>();
    for (const r of project.remnants) {
      if (!r.points?.length) continue;
      const shapeId = getShapeId(r);
      const key = `${r.materialId}_${shapeId}`;
      if (shapeGroups.has(key)) {
        const g = shapeGroups.get(key)!;
        g.count += 1; g.instanceIds.push(r.id);
      } else {
        shapeGroups.set(key, { ...r, count: 1, shapeId, instanceIds: [r.id] });
      }
    }
    for (const gr of shapeGroups.values()) {
      const material = project.materials.find(m => m.id === gr.materialId);
      if (!material) continue;
      if (!result.has(gr.materialId)) result.set(gr.materialId, { material, remnants: [] });
      result.get(gr.materialId)!.remnants.push(gr);
    }
    return result;
  }, [project?.remnants, project?.materials]);

  return {
    activeSurface,
    activeSurfacePieces,
    activeSurfaceObstacles,
    areaToCover,
    coveredArea,
    projectAreaToCover,
    projectCoveredArea,
    wasteArea,
    materialUsage,
    groupedRemnantsByMaterial
  };
}
