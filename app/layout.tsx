import type { Metadata } from "next";
import "../styles.css";

export const metadata: Metadata = {
  title: "Pachus — Ropita para los más mimados",
  description: "Prendas cómodas, tiernas y hechas con amor para tus compañeros de cuatro patas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
