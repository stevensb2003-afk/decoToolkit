
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import type { DefaultMaterial, Unit, Project, Material, UserProfile } from "@/lib/types";
import { collection, query, getDocs, doc, addDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { PlusCircle, Trash2, Loader, User as UserIcon, Check } from "lucide-react";
import { convertToCm, convertFromCm, cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";

// --- Form Schemas ---
const DimensionInputSchema = z.object({
  value: z.coerce.number().positive("Value must be positive"),
  unit: z.enum(["m", "cm"]),
});

const MaterialSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Material name is required"),
  width: DimensionInputSchema,
  height: DimensionInputSchema,
  installationOrientation: z.enum(["Vertical", "Horizontal"]),
  defaultMaterialId: z.string().optional(),
  color: z.string().min(1, "Color is required"),
});

const SurfaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Surface name is required"),
  width: DimensionInputSchema,
  height: DimensionInputSchema,
});

const ProjectFormSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  userId: z.string().min(1, "Project owner is required."), 
  materials: z.array(MaterialSchema).min(1, "At least one material is required"),
  surfaces: z.array(SurfaceSchema).min(1, "At least one surface is required"),
});

type ProjectFormValues = z.infer<typeof ProjectFormSchema>;

// --- Default Values ---
const defaultColors = ['#A67B5B', '#D2B48C', '#C0C0C0', '#808080', '#F5DEB3', '#36454F'];

const createDefaultMaterial = () => ({
  id: crypto.randomUUID(),
  name: "",
  width: { value: 0, unit: "m" as Unit },
  height: { value: 0, unit: "m" as Unit },
  installationOrientation: "Vertical" as "Vertical" | "Horizontal",
  defaultMaterialId: "custom",
  color: defaultColors[0],
});

const createDefaultSurface = () => ({
  id: crypto.randomUUID(),
  name: "",
  width: { value: 0, unit: "m" as Unit },
  height: { value: 0, unit: "m" as Unit },
});


export default function CreateProjectPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const defaultMaterialsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "defaultMaterials")) : null,
    [firestore]
  );

  const { data: defaultMaterials, isLoading: materialsLoading } = useCollection<DefaultMaterial>(defaultMaterialsQuery);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(ProjectFormSchema),
    defaultValues: {
      projectName: "",
      clientName: "",
      clientPhone: "",
      userId: user?.uid || undefined,
      materials: [createDefaultMaterial()],
      surfaces: [createDefaultSurface()],
    },
  });

  const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({
    control: form.control, name: "materials",
  });
  const { fields: surfaceFields, append: appendSurface, remove: removeSurface } = useFieldArray({
    control: form.control, name: "surfaces",
  });
  
  useEffect(() => {
    if (!firestore) return;
    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const usersCollection = collection(firestore, "users");
            const usersSnapshot = await getDocs(usersCollection);
            const usersList = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as UserProfile);
            setAllUsers(usersList);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast({ title: "Error", description: "Could not load user list.", variant: "destructive" });
        } finally {
            setUsersLoading(false);
        }
    };
    fetchUsers();
  }, [firestore, toast]);
  
  useEffect(() => {
    if (user && !form.getValues('userId')) {
      form.setValue('userId', user.uid);
    }
  }, [user, form]);

  const onSubmit = async (data: ProjectFormValues) => {
    if (!user || !firestore) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    try {
      const processedMaterials: Material[] = data.materials.map(m => ({
        ...m,
        width: convertToCm(m.width.value, m.width.unit),
        height: convertToCm(m.height.value, m.height.unit),
      }));
      
      const newProjectData: Omit<Project, 'id' | 'surfaces'> = {
        userId: data.userId,
        projectName: data.projectName,
        clientName: data.clientName || "",
        clientPhone: data.clientPhone || "",
        materials: processedMaterials,
        remnants: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const projectDocRef = await addDoc(collection(firestore, "projects"), newProjectData);
      
      const batch = writeBatch(firestore);
      for (const surface of data.surfaces) {
        const surfaceDocRef = doc(collection(firestore, "projects", projectDocRef.id, "surfaces"));
        batch.set(surfaceDocRef, { 
            name: surface.name,
            width: convertToCm(surface.width.value, surface.width.unit), 
            height: convertToCm(surface.height.value, surface.height.unit) 
        });
      }
      
      await batch.commit();
      toast({ title: "Project Created", description: "The new project has been successfully created." });
      router.push(`/project/${projectDocRef.id}`);
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast({ title: "Error Creating Project", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  };

  const handleDefaultMaterialChange = (materialId: string, index: number) => {
    const selectedMaterial = defaultMaterials?.find(m => m.id === materialId);
    form.setValue(`materials.${index}.defaultMaterialId`, materialId);
    if (selectedMaterial) {
      const currentWidthUnit = form.getValues(`materials.${index}.width.unit`);
      const currentHeightUnit = form.getValues(`materials.${index}.height.unit`);
      form.setValue(`materials.${index}.width.value`, convertFromCm(selectedMaterial.width, currentWidthUnit));
      form.setValue(`materials.${index}.height.value`, convertFromCm(selectedMaterial.height, currentHeightUnit));
    }
  }

  const isLoading = isUserLoading || materialsLoading || usersLoading;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-4xl p-4 md:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <header className="mb-8">
                <h1 className="text-3xl font-bold font-headline">Create New Project</h1>
                <p className="text-muted-foreground">Define your project parameters to generate a cutting plan.</p>
              </header>

              <Card>
                <CardHeader className="flex-row items-start justify-between">
                  <div className="space-y-1.5">
                    <CardTitle>Project and Client Details</CardTitle>
                  </div>
                  <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem className="w-full max-w-xs">
                        {usersLoading ? (
                          <Skeleton className="h-10 w-full" />
                        ) : (
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Select a user..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {allUsers.map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="projectName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl><Input placeholder="e.g., Kitchen Remodel" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="clientName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Client Name</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="clientPhone"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Client Phone</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., 8888-8888" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>1. Materials</CardTitle>
                  <CardDescription>Define up to 3 types of materials you will be using.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {materialFields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4 relative bg-muted/50">
                      <div className="absolute top-2 right-2 flex gap-1">
                        {materialFields.length > 1 && (
                          <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => removeMaterial(index)}>
                            <Trash2 className="h-4 w-4" /><span className="sr-only">Remove Material</span>
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`materials.${index}.defaultMaterialId`}
                          render={({ field: selectField }) => (
                            <FormItem>
                              <FormLabel>Material Type</FormLabel>
                              <Select onValueChange={(value) => handleDefaultMaterialChange(value, index)} value={selectField.value}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Select a standard material" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="custom">Custom</SelectItem>
                                  {defaultMaterials?.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField control={form.control} name={`materials.${index}.name`} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Material Name</FormLabel><FormControl><Input placeholder="e.g., Cherry Wood" {...field} /></FormControl><FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name={`materials.${index}.height`} render={({ field: aField }) => (
                          <FormItem>
                            <FormLabel>Length</FormLabel>
                            <div className="flex gap-2">
                              <FormControl><Input type="number" step="any" {...form.register(`materials.${index}.height.value`)} /></FormControl>
                              <Select onValueChange={(unit) => form.setValue(`materials.${index}.height.unit`, unit as Unit)} defaultValue={aField.value.unit}>
                                <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="m">m</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent>
                              </Select>
                            </div>
                            <FormMessage>{form.formState.errors.materials?.[index]?.height?.value?.message}</FormMessage>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`materials.${index}.width`} render={({ field: aField }) => (
                          <FormItem>
                            <FormLabel>Width</FormLabel>
                            <div className="flex gap-2">
                              <FormControl><Input type="number" step="any" {...form.register(`materials.${index}.width.value`)} /></FormControl>
                              <Select onValueChange={(unit) => form.setValue(`materials.${index}.width.unit`, unit as Unit)} defaultValue={aField.value.unit}>
                                <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="m">m</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent>
                              </Select>
                            </div>
                            <FormMessage>{form.formState.errors.materials?.[index]?.width?.value?.message}</FormMessage>
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name={`materials.${index}.installationOrientation`} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Installation Orientation</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="Vertical">Vertical</SelectItem><SelectItem value="Horizontal">Horizontal</SelectItem></SelectContent>
                            </Select><FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`materials.${index}.color`} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color</FormLabel>
                            <FormControl>
                              <div className="flex gap-2 flex-wrap">
                                {defaultColors.map((color, colorIndex) => (
                                  <button type="button" key={color} className={cn("h-8 w-8 rounded-md border-2", field.value === color ? 'border-primary' : 'border-transparent')} style={{ backgroundColor: color }} onClick={() => field.onChange(color)}>
                                    {field.value === color && <Check className="h-5 w-5 text-white stroke-current" />}
                                  </button>
                                ))}
                              </div>
                            </FormControl><FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  ))}
                  {materialFields.length < 3 && (
                    <Button type="button" variant="outline" onClick={() => appendMaterial(createDefaultMaterial())}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Material
                    </Button>
                  )}
                  {form.formState.errors.materials && <p className="text-sm font-medium text-destructive">{form.formState.errors.materials.message || form.formState.errors.materials.root?.message}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>2. Surfaces</CardTitle>
                  <CardDescription>Define the surfaces (e.g., walls, countertops) to be covered.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {surfaceFields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4 relative bg-muted/50">
                      <div className="absolute top-2 right-2 flex gap-1">
                        {surfaceFields.length > 1 && (
                          <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => removeSurface(index)}>
                            <Trash2 className="h-4 w-4" /><span className="sr-only">Remove Surface</span>
                          </Button>
                        )}
                      </div>
                      <FormField control={form.control} name={`surfaces.${index}.name`} render={({ field }) => (
                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g., Main Counter" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name={`surfaces.${index}.width`} render={({ field: aField }) => (
                          <FormItem>
                            <FormLabel>Width</FormLabel>
                            <div className="flex gap-2">
                              <FormControl><Input type="number" step="any" {...form.register(`surfaces.${index}.width.value`)} /></FormControl>
                              <Select onValueChange={(unit) => form.setValue(`surfaces.${index}.width.unit`, unit as Unit)} defaultValue={aField.value.unit}>
                                <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="m">m</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent>
                              </Select>
                            </div>
                            <FormMessage>{form.formState.errors.surfaces?.[index]?.width?.value?.message}</FormMessage>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`surfaces.${index}.height`} render={({ field: aField }) => (
                          <FormItem>
                            <FormLabel>Height</FormLabel>
                            <div className="flex gap-2">
                              <FormControl><Input type="number" step="any" {...form.register(`surfaces.${index}.height.value`)} /></FormControl>
                              <Select onValueChange={(unit) => form.setValue(`surfaces.${index}.height.unit`, unit as Unit)} defaultValue={aField.value.unit}>
                                <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="m">m</SelectItem><SelectItem value="cm">cm</SelectItem></SelectContent>
                              </Select>
                            </div>
                             <FormMessage>{form.formState.errors.surfaces?.[index]?.height?.value?.message}</FormMessage>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  ))}
                  {surfaceFields.length < 6 && (
                    <Button type="button" variant="outline" onClick={() => appendSurface(createDefaultSurface())}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Surface
                    </Button>
                  )}
                  {form.formState.errors.surfaces && <p className="text-sm font-medium text-destructive">{form.formState.errors.surfaces.message || form.formState.errors.surfaces.root?.message}</p>}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <Loader className="animate-spin" /> : "Create Project"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </>
  );
}

    