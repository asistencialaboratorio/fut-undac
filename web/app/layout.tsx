import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "FUT-UNDAC | Generador de trámites",
  description:
    "Genera tu Formulario Único de Trámite (FUT) de la Universidad Nacional Daniel Alcides Carrión. Sin registro, sin guardar tus datos: descarga el Word o imprime el PDF al instante.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
