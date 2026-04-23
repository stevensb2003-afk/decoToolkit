import type { Metadata, Viewport } from 'next';
import { Inter, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Header } from '@/components/layout/header';
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'DecoInnova Toolkit',
  description: 'A toolkit for interior design and material planning.',
  icons: {
    icon: '/favicon_azul.png',
    apple: '/decoToolkit_app_icon.png',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DecoToolkit',
  },
};

export const viewport: Viewport = {
  themeColor: '#0055b3',
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${sourceCodePro.variable}`}>
      <head>
        <link rel="icon" href="/favicon_azul.png" />
      </head>
      <body className="font-body antialiased h-full bg-background">
        <FirebaseClientProvider>
          <div className="flex flex-col h-full">
            {children}
          </div>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
