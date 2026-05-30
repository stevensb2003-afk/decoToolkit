import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MousePointer, Layers, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CortesPanel } from './CortesPanel';
import { useEditorState } from '../_hooks/useEditorState';
type EditorState = ReturnType<typeof useEditorState>;
import type { Project, Brush } from '@/lib/types';
import type { MaterialRemnantGroup } from '../_hooks/useProjectHydration';

export interface EditorSidebarProps {
  es: EditorState;
  project: Project;
  areaToCover: number;
  projectAreaToCover: number;
  coveredArea: number;
  projectCoveredArea: number;
  wasteArea: number;
  materialUsage: Map<string, number>;
  groupedRemnantsByMaterial: Map<string, MaterialRemnantGroup>;
}

export function EditorSidebar({
  es,
  project,
  areaToCover,
  projectAreaToCover,
  coveredArea,
  projectCoveredArea,
  wasteArea,
  materialUsage,
  groupedRemnantsByMaterial
}: EditorSidebarProps) {
  return (
    <aside className="w-[320px] min-w-[320px] max-w-[320px] shrink-0 border-r bg-background p-4 h-full flex flex-col gap-6 overflow-y-auto scrollbar-discreet">
      <Collapsible defaultOpen className="border rounded-xl bg-card text-card-foreground shadow-sm transition-all duration-300 ease-in-out">
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl group">
            <CardTitle>Resumen</CardTitle>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent className="collapsible-content">
          <div className="px-6 pb-2">
            <div className="flex bg-muted rounded-full p-0.5 border border-border shadow-inner w-full max-w-[200px]">
              <button
                className={cn(
                  'flex-1 h-6 px-2 text-[10px] uppercase font-bold rounded-full transition-all duration-300 flex items-center justify-center outline-none',
                  es.summaryViewMode === 'surface'
                    ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100'
                )}
                onClick={e => { e.stopPropagation(); es.setSummaryViewMode('surface'); }}
              >
                <MousePointer className={cn('h-3 w-3 mr-1', es.summaryViewMode === 'surface' ? 'opacity-100' : 'opacity-40')} />
                Superficie
              </button>
              <button
                className={cn(
                  'flex-1 h-6 px-2 text-[10px] uppercase font-bold rounded-full transition-all duration-300 flex items-center justify-center outline-none',
                  es.summaryViewMode === 'project'
                    ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100'
                )}
                onClick={e => { e.stopPropagation(); es.setSummaryViewMode('project'); }}
              >
                <Layers className={cn('h-3 w-3 mr-1', es.summaryViewMode === 'project' ? 'opacity-100' : 'opacity-40')} />
                Proyecto
              </button>
            </div>
          </div>
          <CardContent className="text-sm space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{es.summaryViewMode === 'surface' ? 'Superficie:' : 'Proyecto Total:'}</span>
                <span className="font-medium">{((es.summaryViewMode === 'surface' ? areaToCover : projectAreaToCover) / 10000).toFixed(2)} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Área Cubierta:</span>
                <span className="font-medium">{((es.summaryViewMode === 'surface' ? coveredArea : projectCoveredArea) / 10000).toFixed(2)} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Área por cubrir:</span>
                <span className="font-medium">
                  {Math.max(0, ((es.summaryViewMode === 'surface' ? areaToCover : projectAreaToCover) - (es.summaryViewMode === 'surface' ? coveredArea : projectCoveredArea)) / 10000).toFixed(2)} m²
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desperdicio:</span>
                <span className="font-medium text-red-500">{(wasteArea / 10000).toFixed(2)} m²</span>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-medium">Materiales Usados</h3>
              {project.materials.map(mat => (
                <div key={mat.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: mat.color }} />
                    <span className="font-semibold">{mat.name}</span>
                  </div>
                  <span className="font-medium">{materialUsage.get(mat.id) ?? 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      <CortesPanel
        groupedRemnantsByMaterial={groupedRemnantsByMaterial}
        activeBrush={es.activeBrush}
        onSelectRemnant={(remnant: any) => es.handleSetActiveBrush({ ...remnant, type: 'remnant' } as Brush)}
      />
    </aside>
  );
}
