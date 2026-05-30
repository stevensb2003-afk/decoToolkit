import { useEffect } from 'react';
import { useEditorState } from './useEditorState';
type EditorState = ReturnType<typeof useEditorState>;

export function useKeyboardShortcuts(
  historyIndex: number,
  historyLength: number,
  isUndoingOrRedoing: boolean,
  undo: () => void,
  redo: () => void,
  es: EditorState,
  setIsPivotSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          if (historyIndex < historyLength - 1 && !isUndoingOrRedoing) redo();
        } else {
          e.preventDefault();
          if (historyIndex >= 0 && !isUndoingOrRedoing) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (historyIndex < historyLength - 1 && !isUndoingOrRedoing) redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        es.setIsHandMode(!es.isHandMode);
        if (!es.isHandMode) {
          es.setIsEraserMode(false);
          es.setIsMeasureMode(false);
          es.setActiveBrush(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        es.handleToolSelect('eraser');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        es.handleToolSelect('brush');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        es.handleToolSelect('measure');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsPivotSelectorOpen(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        es.setViewZoom(1);
        if (es.setViewPan) es.setViewPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, historyLength, isUndoingOrRedoing, undo, redo, es, setIsPivotSelectorOpen]);
}
