import { useState, useCallback } from 'react';
import type { Point, VertexMeasurement, VertexFigure } from '@/lib/types';

export function useMeasurementState() {
  const [currentVertexPoints, setCurrentVertexPoints] = useState<Point[]>([]);
  const [previewVertexPoint, setPreviewVertexPoint] = useState<Point | null>(null);
  const [vertexMeasurements, setVertexMeasurements] = useState<VertexMeasurement[]>([]);
  const [savedVertexFigures, setSavedVertexFigures] = useState<VertexFigure[]>([]);
  const [savedAreaMeasurements, setSavedAreaMeasurements] = useState<Array<{ id: string; x: number; y: number; width: number; height: number }>>([]);
  const [showAreaMeasurements, setShowAreaMeasurements] = useState(true);
  const [showVertexMeasurements, setShowVertexMeasurements] = useState(true);
  const [hiddenAreaIds, setHiddenAreaIds] = useState<string[]>([]);
  const [hiddenVertexFigureIds, setHiddenVertexFigureIds] = useState<string[]>([]);

  const toggleAreaMeasurements = useCallback(() => setShowAreaMeasurements(prev => !prev), []);
  const toggleVertexMeasurements = useCallback(() => setShowVertexMeasurements(prev => !prev), []);

  const clearVertexMeasurements = useCallback(() => { 
    setSavedVertexFigures([]);
    setVertexMeasurements([]); 
    setCurrentVertexPoints([]); 
    setPreviewVertexPoint(null); 
    setHiddenVertexFigureIds([]);
  }, []);

  const undoVertexMeasurement = useCallback(() => {
    if (currentVertexPoints.length > 0) {
      setCurrentVertexPoints(prev => prev.slice(0, -1));
      setVertexMeasurements(prev => prev.slice(0, -1));
    }
  }, [currentVertexPoints.length]);

  const clearAreaMeasurements = useCallback(() => {
    setSavedAreaMeasurements([]);
    setHiddenAreaIds([]);
  }, []);

  const toggleAreaVisibility = useCallback((id: string) => setHiddenAreaIds(prev => prev.includes(id) ? prev.filter(hid => hid !== id) : [...prev, id]), []);
  const toggleVertexFigureVisibility = useCallback((id: string) => setHiddenVertexFigureIds(prev => prev.includes(id) ? prev.filter(hid => hid !== id) : [...prev, id]), []);
  const deleteAreaMeasurement = useCallback((id: string) => setSavedAreaMeasurements(prev => prev.filter(m => m.id !== id)), []);
  const deleteVertexFigure = useCallback((id: string) => setSavedVertexFigures(prev => prev.filter(f => f.id !== id)), []);

  return {
    currentVertexPoints, setCurrentVertexPoints,
    previewVertexPoint, setPreviewVertexPoint,
    vertexMeasurements, setVertexMeasurements,
    savedVertexFigures, setSavedVertexFigures,
    savedAreaMeasurements, setSavedAreaMeasurements,
    showAreaMeasurements, setShowAreaMeasurements,
    showVertexMeasurements, setShowVertexMeasurements,
    hiddenAreaIds, setHiddenAreaIds,
    hiddenVertexFigureIds, setHiddenVertexFigureIds,
    toggleAreaMeasurements, toggleVertexMeasurements,
    clearVertexMeasurements, undoVertexMeasurement, clearAreaMeasurements,
    toggleAreaVisibility, toggleVertexFigureVisibility, deleteAreaMeasurement, deleteVertexFigure
  };
}
