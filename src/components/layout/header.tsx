
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  Home,
  Menu,
  LogOut,
  Shapes,
  FolderKanban,
  User as UserIcon,
  LayoutGrid,
  ShieldCheck,
  Wallet,
  Tag,
  Network,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase";
import { signOut } from "firebase/auth";
import { UserProfile } from "@/lib/types";
import { doc } from "firebase/firestore";
import { useMemo } from "react";

const mainNavItems = [
  { href: "/", label: "Home", icon: Home },
];

const toolNavItems = [
  { id: "projects", href: "/projects", label: "Mis Proyectos", icon: FolderKanban },
  { id: "inventory", href: "/materials", label: "Materiales Estándar", icon: Shapes },
  { id: "calculator", href: "/calculator", label: "Calculadora", icon: Calculator },
  { id: "admin", href: "/admin", label: "Admin", icon: ShieldCheck },
  { id: "caja", href: "/caja", label: "Control de Caja", icon: Wallet },
  { id: "pricing", href: "/precios-descuentos", label: "Precios & Descuentos", icon: Tag },
  { id: "procesos", href: "/procesos", label: "Procesos", icon: Network },
  { id: "tilopay", href: "/tilopay", label: "Cobros Tilopay", icon: CreditCard },
  { id: "admin", href: "/admin/alegra", label: "Contabilidad", icon: TrendingUp },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const firestore = useFirestore();

  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  const allowedModules = profile?.permissions?.allowedModules || [];
  const isAdmin = profile?.isAdmin || false;

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };


  const NavLink = ({
    href,
    label,
    icon: Icon,
    className,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
    className?: string;
  }) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
        pathname === href && "bg-muted text-primary",
        className
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 z-50">
      {/* Left side: Logo and Title */}
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold mr-auto"
      >
        <Image src="/favicon_azul.png" alt="DecoInnova Logo" width={32} height={32} />
        <span className="font-headline hidden sm:inline-block">DecoInnova Toolkit</span>
      </Link>

      {/* Mobile Menu (Sheet) */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col w-[300px] sm:w-[400px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de Navegación</SheetTitle>
            <SheetDescription>Accede a las diferentes secciones de DecoInnova Toolkit</SheetDescription>
          </SheetHeader>
          <div className="flex items-center gap-2 text-lg font-semibold mb-4 pb-4 border-b">
            <Image src="/favicon_azul.png" alt="DecoInnova Logo" width={32} height={32} />
            <span className="font-headline">DecoInnova Toolkit</span>
          </div>
          <nav className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
            {[...mainNavItems, ...toolNavItems].map((item: any) => {
              const isTool = !!item.id;
              const hasAccess = !isTool || (isAdmin || allowedModules.includes(item.id));
              if (!hasAccess) return null;
              return <NavLink key={item.href} {...item} />;
            })}
          </nav>

          <div className="mt-auto pt-4">
            <Separator className="mb-4" />
            <Button
              variant="outline"
              className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Right side: Desktop Nav and User Menu */}
      {/* Right side: Tools and User Menu */}
      <div className="flex items-center gap-2 md:gap-4 ml-auto md:ml-0">
        <nav className="hidden md:flex items-center gap-2 text-sm font-medium mr-2">
          {mainNavItems.map((item) => (
            <Button key={item.href} variant={pathname === item.href ? "secondary" : "ghost"} asChild>
              <Link href={item.href}>
                <item.icon className="h-4 w-4" />
                <span className="ml-2">{item.label}</span>
              </Link>
            </Button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-accent rounded-full transition-colors">
                <LayoutGrid className="h-5 w-5" />
                <span className="sr-only">Open tools menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Herramientas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[70vh] overflow-y-auto">
                {toolNavItems.map(item => {
                  const hasAccess = isAdmin || allowedModules.includes(item.id);
                  if (!hasAccess) return null;

                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="flex items-center gap-2 cursor-pointer py-2">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <Separator orientation="vertical" className="hidden md:block h-8 mr-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-primary/20">
              <Avatar className="h-8 w-8 md:h-9 md:w-9 border border-muted/50">
                {user?.photoURL ? <AvatarImage src={user.photoURL} alt={user.displayName || "User"} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {user?.displayName ? (
                    user.displayName.charAt(0).toUpperCase()
                  ) : user?.email ? (
                    user.email.charAt(0).toUpperCase()
                  ) : (
                    <UserIcon className="h-5 w-5" />
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.displayName || "Usuario"}</p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              <span>Mi Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
