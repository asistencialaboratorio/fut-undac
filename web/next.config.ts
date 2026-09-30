import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El endpoint de generación de Word lee el logo y la marca de agua desde
  // public/img con una ruta armada en tiempo de ejecución (fs.readFileSync),
  // así que el rastreo automático de Next.js no los detecta solo. Sin esto,
  // funcionan en local (los archivos ya están en disco) pero fallan en
  // Vercel, donde la función serverless no incluye public/ por defecto.
  outputFileTracingIncludes: {
    "/api/generar-docx": ["./public/img/**/*"],
  },
};

export default nextConfig;
