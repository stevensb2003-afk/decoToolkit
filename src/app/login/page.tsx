
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { ensureUserProfile } from "../admin/actions";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";


const signInSchema = z.object({
  email: z.string().email({ message: "Por favor, ingresa un correo electrónico válido." }),
  password: z.string().min(1, { message: "La contraseña es obligatoria." }),
});

const resetPasswordSchema = z.object({
  email: z.string().email({ message: "Por favor, ingresa un correo electrónico válido." }),
});

type SignInFormValues = z.infer<typeof signInSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function PasswordInput({ field, showPassword, onTogglePassword }: { field: any, showPassword: boolean, onTogglePassword: () => void }) {
  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        placeholder="••••••••"
        {...field}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1/2 right-2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
        onClick={onTogglePassword}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function ForgotPasswordDialog({ form, onSubmit, open, onOpenChange }: { form: any, onSubmit: (data: any) => Promise<void>, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" type="button" className="text-xs h-auto p-0">¿Olvidaste tu contraseña?</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="reset-password-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="nombre@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="reset-password-form" disabled={isSubmitting}>
            {isSubmitting && <Loader className="animate-spin mr-2" />}
            Enviar enlace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);


  const signInForm = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  const handleAuthError = (err: any) => {
    let friendlyMessage = "Ocurrió un error inesperado.";
    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        friendlyMessage = "Correo o contraseña inválidos. Inténtalo de nuevo.";
        break;
      case 'auth/email-already-in-use':
        friendlyMessage = "Esta dirección de correo ya está en uso.";
        break;
      case 'auth/weak-password':
        friendlyMessage = "La contraseña es muy débil. Usa al menos 6 caracteres.";
        break;
      case 'auth/invalid-email':
        friendlyMessage = "El correo electrónico no es válido.";
        break;
      default:
        friendlyMessage = err.message;
        break;
    }
    setError(friendlyMessage);
  }

  const onSignInSubmit = async (data: SignInFormValues) => {
    setError(null);
    setIsLoading(true);
    if (!auth) {
      setError("El servicio de autenticación no está disponible.");
      setIsLoading(false);
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      // Ensure user profile exists in Firestore after successful sign-in
      await ensureUserProfile(userCredential.user.uid);
      router.push('/');
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
    if (!auth) {
      toast({ title: "Error", description: "El servicio de autenticación no está disponible.", variant: "destructive" });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, data.email);
      toast({
        title: "Correo enviado",
        description: "Revisa tu bandeja de entrada para restablecer tu contraseña.",
      });
      setResetDialogOpen(false);
      resetPasswordForm.reset();
    } catch (error: any) {
      let message = "Ocurrió un error desconocido.";
      if (error.code === 'auth/user-not-found') {
        message = "No se encontró ningún usuario con este correo electrónico.";
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };


  if (isUserLoading || (!isUserLoading && user)) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }


  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-blue-50 via-white to-sky-100">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="animate-in fade-in slide-in-from-top-4 duration-1000">
          <Image
            src="/logo_azul.png"
            alt="DecoInnova Logo"
            width={160}
            height={160}
            className="drop-shadow-sm"
          />
        </div>

        <Card className="w-full shadow-2xl border-white/40 bg-white/70 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-3xl font-black tracking-tight text-slate-800">Bienvenido</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Inicia sesión con tu cuenta de DecoInnova</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...signInForm}>
              <form onSubmit={signInForm.handleSubmit(onSignInSubmit)} className="space-y-4">
                <FormField
                  control={signInForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <Input placeholder="nombre@ejemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signInForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center">
                        <FormLabel>Contraseña</FormLabel>
                        <ForgotPasswordDialog
                          form={resetPasswordForm}
                          onSubmit={onResetPasswordSubmit}
                          open={resetDialogOpen}
                          onOpenChange={setResetDialogOpen}
                        />
                      </div>
                      <FormControl>
                        <PasswordInput
                          field={field}
                          showPassword={showPassword}
                          onTogglePassword={() => setShowPassword(!showPassword)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader className="animate-spin" /> : "Iniciar Sesión"}
                </Button>
              </form>
            </Form>

            {error && (
              <Alert variant="destructive" className="mt-4 border-destructive/20 bg-destructive/5 backdrop-blur-md">
                <Terminal className="h-4 w-4" />
                <AlertTitle className="font-bold">Error de Autenticación</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
