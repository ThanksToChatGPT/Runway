import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Outfit Builder',
  description:
    'Compara prendas entre tiendas en COP, guarda favoritos y arma tu outfit paso a paso.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <AppProvider>
          <Header />
          <main className="page">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
