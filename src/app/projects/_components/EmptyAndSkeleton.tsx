'use client';

import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, PlusCircle } from "lucide-react";

export function ProjectsLoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/4 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export function ProjectsEmptyState() {
  return (
    <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/10">
      <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <FolderKanban className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold">No se encontraron proyectos</h2>
      <p className="text-muted-foreground mt-2 mb-6 max-w-sm mx-auto">
        Comienza creando tu primer proyecto o ajusta los filtros de búsqueda.
      </p>
      <Button asChild className="shadow-md">
        <Link href="/project/new">
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Proyecto
        </Link>
      </Button>
    </div>
  );
}
