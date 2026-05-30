import React, { useState } from 'react';
import {
  HelpCircle,
  Zap,
  Navigation,
  Brush as BrushIcon,
  Ruler,
  SquareDashedBottom,
  Command,
  Maximize,
  RotateCw,
  Info,
  Crop,
  Scissors,
  Gamepad2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function HelpDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full h-10 w-10 shadow-sm border-2">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Ayuda y Atajos</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl border-none shadow-2xl top-10 translate-y-0">
        <DialogHeader className="p-8 pb-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <HelpCircle className="h-24 w-24" />
          </div>
          <DialogTitle className="text-3xl font-bold flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-300 animate-pulse" />
            Dominando DecoToolkit
          </DialogTitle>
          <DialogDescription className="text-blue-100 text-lg">
            ¡Hola! Aquí tienes todo lo necesario para convertirte en un experto del diseño.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="nav" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-8 bg-muted/30 border-b">
            <TabsList className="h-14 bg-transparent gap-6 p-0">
              <TabsTrigger value="nav" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                <Navigation className="h-4 w-4" /> Navegación
              </TabsTrigger>
              <TabsTrigger value="materials" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                <BrushIcon className="h-4 w-4" /> Materiales
              </TabsTrigger>
              <TabsTrigger value="measure" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                <Ruler className="h-4 w-4" /> Medición
              </TabsTrigger>
              <TabsTrigger value="obstacles" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                <SquareDashedBottom className="h-4 w-4" /> Obstáculos
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-14 flex gap-2 font-bold transition-all">
                <Command className="h-4 w-4" /> Atajos
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <ScrollArea className="h-full px-8 py-6">
              <TabsContent value="nav" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid gap-4">
                  <div className="flex gap-4 p-4 rounded-xl bg-blue-50 border border-blue-100 shadow-sm transition-all hover:shadow-md">
                    <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
                      <Maximize className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-900 text-lg">Control de Vista</h4>
                      <p className="text-blue-800/70 mb-2">Usa <kbd className="bg-white px-2 py-0.5 rounded border shadow-sm text-black inline-flex items-center gap-1 font-mono">Ctrl + H</kbd> para activar la mano y arrastrar el lienzo con soltura.</p>
                      <p className="text-blue-800/70">Usa <kbd className="bg-white px-2 py-0.5 rounded border shadow-sm text-black inline-flex items-center gap-1 font-mono">Ctrl + Rueda</kbd> para hacer zoom y ver cada detalle.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 rounded-xl border bg-white shadow-sm transition-all hover:shadow-md">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <RotateCw className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">Pánico / Reseteo</h4>
                      <p className="text-slate-600">Si te pierdes en el lienzo, pulsa <kbd className="bg-slate-50 px-2 py-0.5 rounded border text-slate-900 font-mono">Ctrl + Espacio</kbd> para volver al centro y al 100% de zoom instantáneamente.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-indigo-50 p-4 border border-indigo-100 flex items-start gap-3">
                  <Info className="h-5 w-5 text-indigo-600 mt-0.5" />
                  <p className="text-indigo-900 text-sm italic">
                    <b>Truco:</b> También puedes usar el botón central del ratón (la rueda) para panear sin cambiar de herramienta.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="materials" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-4">
                  <div className="flex gap-4 items-start border-l-4 border-orange-400 pl-4 py-2">
                    <div className="p-2 rounded-lg bg-orange-50 shrink-0">✨</div>
                    <div>
                      <h4 className="font-bold text-lg">Colocación en Serie</h4>
                      <p className="text-muted-foreground italic mb-1">"¡La forma más rápida de llenar una superficie!"</p>
                      <p className="text-muted-foreground">Haz clic y <b>arrastra</b> sobre el lienzo. El editor colocará automáticamente filas de piezas perfectamente alineadas.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start border-l-4 border-blue-400 pl-4 py-2">
                    <div className="p-2 rounded-lg bg-blue-50 shrink-0">🔄</div>
                    <div>
                      <h4 className="font-bold text-lg">Gira antes de poner</h4>
                      <p className="text-muted-foreground">Usa <kbd className="bg-muted px-2 py-0.5 rounded border font-mono">Alt + Rueda</kbd> para rotar la pieza que tienes en el cursor. Verás el ángulo en tiempo real.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start border-l-4 border-purple-400 pl-4 py-2">
                    <div className="p-2 rounded-lg bg-purple-50 shrink-0">📍</div>
                    <div>
                      <h4 className="font-bold text-lg">Punto de Sujeción</h4>
                      <p className="text-muted-foreground">Cambia desde qué esquina agarras la pieza con <kbd className="bg-muted px-2 py-0.5 rounded border font-mono">Ctrl + A</kbd>. Ideal para empezar con precisión desde bordes.</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="measure" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-green-50/50 border-2 border-green-100 relative overflow-hidden group hover:bg-green-50 transition-colors">
                    <div className="absolute top-2 right-2 h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Crop className="h-4 w-4 text-green-600" />
                    </div>
                    <h4 className="font-bold text-green-900 mb-1">Modo Área</h4>
                    <p className="text-green-800/70 text-sm">Dibuja rectángulos para medir superficies rápidas y obtener m² al instante.</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-emerald-50/50 border-2 border-emerald-100 relative overflow-hidden group hover:bg-emerald-50 transition-colors">
                    <div className="absolute top-2 right-2 h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Scissors className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-emerald-900 mb-1">Modo Vértice</h4>
                    <p className="text-emerald-800/70 text-sm">Une puntos libremente para perímetros complejos o distancias personalizadas.</p>
                  </div>
                </div>
                <div className="bg-muted/50 p-4 rounded-xl border space-y-2">
                  <div className="flex items-center gap-2"><div className="w-6 text-center font-bold bg-white rounded border text-xs py-0.5">⇧</div><p className="text-sm">Mantén <b>Shift</b> para forzar líneas rectas (horizontales o verticales).</p></div>
                  <div className="flex items-center gap-2"><div className="w-6 text-center font-bold bg-white rounded border text-xs py-0.5">Esc</div><p className="text-sm">Cancela el dibujo actual en cualquier momento.</p></div>
                  <div className="flex items-center gap-2"><div className="w-6 text-center font-bold bg-white rounded border text-xs py-0.5">⌫</div><p className="text-sm"><b>Retroceso:</b> Elimina el último vértice dibujado.</p></div>
                </div>
              </TabsContent>

              <TabsContent value="obstacles" className="mt-0 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                  <p className="text-purple-900 font-bold flex items-center gap-2 mb-2">
                    <SquareDashedBottom className="h-4 w-4" /> Magia con Obstáculos
                  </p>
                  <p className="text-purple-800/80 text-sm leading-relaxed">
                    Define columnas, enchufes o ventanas. El material se cortará automáticamente para evitarlos. ¡No pierdas ni un centímetro!
                  </p>
                </div>

                <div className="space-y-3">
                  <h5 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" /> Atajos del modo Dibujo
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:border-purple-300 transition-colors">
                      <span className="text-xs font-semibold">Girar segmento</span>
                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        <kbd className="bg-muted px-1.5 py-0.5 rounded border">Alt + Rueda (15°)</kbd>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:border-purple-300 transition-colors">
                      <span className="text-xs font-semibold">Direcciones 90°</span>
                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        <kbd className="bg-muted px-1.5 py-0.5 rounded border">↑</kbd>
                        <kbd className="bg-muted px-1.5 py-0.5 rounded border">↓</kbd>
                        <kbd className="bg-muted px-1.5 py-0.5 rounded border">←</kbd>
                        <kbd className="bg-muted px-1.5 py-0.5 rounded border">→</kbd>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:border-purple-300 transition-colors">
                      <span className="text-xs font-semibold">Añadir segmento</span>
                      <kbd className="bg-muted px-1.5 py-0.5 rounded border font-mono text-[10px]">Enter</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:border-purple-300 transition-colors">
                      <span className="text-xs font-semibold">Guardar Obstáculo</span>
                      <kbd className="bg-muted px-1.5 py-0.5 rounded border font-mono text-[10px]">Ctrl + Enter</kbd>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="all" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="rounded-xl border shadow-sm divide-y overflow-hidden">
                  <div className="p-3 bg-muted/20 font-bold text-sm flex justify-between">
                    <span>Acción</span>
                    <span>Atajo</span>
                  </div>
                  {[
                    { a: "Herramienta Mano (Toggle)", k: "Ctrl + H" },
                    { a: "Pincel de Material", k: "Ctrl + V" },
                    { a: "Goma de Borrar", k: "Ctrl + E" },
                    { a: "Calculadora / Medición", k: "Ctrl + R" },
                    { a: "Cambiar Punto Anclaje", k: "Ctrl + A" },
                    { a: "Deshacer acción", k: "Ctrl + Z" },
                    { a: "Rehacer acción", k: "Ctrl + Y / Shift+Z" },
                    { a: "Reseteo de vista", k: "Ctrl + Space" },
                  ].map((row, i) => (
                    <div key={i} className="p-3 flex justify-between items-center text-sm hover:bg-slate-50 transition-colors">
                      <span className="text-muted-foreground">{row.a}</span>
                      <kbd className="bg-muted px-2 py-0.5 rounded border font-mono text-[10px]">{row.k}</kbd>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row sm:justify-between items-center">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Gamepad2 className="h-4 w-4" />
            <span>Sugerencia: Prueba a mantener las teclas para combinaciones rápidas.</span>
          </div>
          <Button onClick={() => setIsOpen(false)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
            ¡Entendido!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
