import { NextRequest, NextResponse } from "next/server";
import { facultadDeEscuela } from "@/lib/facultades";

// Proxy server-side a la API institucional de la UNDAC. Se hace desde el
// servidor (no desde el navegador) porque la API solo responde por HTTP
// (no HTTPS), lo que el navegador bloquearía como "contenido mixto" si
// se llamara directo desde esta página HTTPS.
//
// OJO: el campo "Correo Institucional" que devuelve la API en realidad
// trae el correo PERSONAL del estudiante (error conocido de la API), así
// que nunca se usa automáticamente. Y "Programa facultad" es en realidad
// el nombre de la ESCUELA, no de la facultad — se usa el catálogo local
// para deducir la facultad real a partir de esa escuela.
// La URL completa (incluye tokens de acceso propios de la API) se toma de
// una variable de entorno para no dejarla fija en el código público.
// Configúrala en Vercel (Settings -> Environment Variables) o en
// .env.local para desarrollo; ver .env.example.
const BASE_URL = process.env.UNDAC_API_BASE_URL;

export async function GET(request: NextRequest) {
  if (!BASE_URL) {
    return NextResponse.json(
      { error: "El autocompletado por API no está configurado en este servidor (falta UNDAC_API_BASE_URL)." },
      { status: 500 },
    );
  }

  const codigo = (request.nextUrl.searchParams.get("codigo") || "").trim();

  if (!/^\d+$/.test(codigo)) {
    return NextResponse.json(
      { error: "El código de matrícula debe ser numérico para consultar la API." },
      { status: 400 },
    );
  }

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/${codigo}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo conectar a la API de UNDAC. Es posible que el servicio solo sea " +
          "accesible desde la red institucional (wifi del campus o VPN universitaria).",
      },
      { status: 502 },
    );
  }

  if (resp.status === 403) {
    return NextResponse.json(
      {
        error:
          "La API rechazó la conexión (403 Forbidden). Es posible que el servicio solo " +
          "sea accesible desde la red institucional de UNDAC (wifi del campus o VPN).",
      },
      { status: 502 },
    );
  }
  if (resp.status === 404) {
    return NextResponse.json({ error: `Código de matrícula '${codigo}' no encontrado (404).` }, { status: 404 });
  }
  if (!resp.ok) {
    return NextResponse.json({ error: `La API respondió con error HTTP ${resp.status}.` }, { status: 502 });
  }

  let data: Record<string, string>;
  try {
    data = await resp.json();
  } catch {
    return NextResponse.json(
      { error: "La API devolvió una respuesta no válida (¿código inexistente?)." },
      { status: 502 },
    );
  }

  if (!data || !data["Nombres"]) {
    return NextResponse.json({ error: `No se encontraron datos para el código '${codigo}'.` }, { status: 404 });
  }

  const apellidoPaterno = (data["Apellido paterno"] || "").trim();
  const apellidoMaterno = (data["Apellido materno"] || "").trim();
  const nombres = (data["Nombres"] || "").trim();
  const nombresApellidos = `${apellidoPaterno} ${apellidoMaterno} ${nombres}`.trim().replace(/\s+/g, " ");

  const escuela = (data["Programa facultad"] || "").trim();
  const facultad = facultadDeEscuela(escuela);

  return NextResponse.json({
    nombresApellidos,
    dni: (data["Dni"] || "").trim(),
    facultad,
    escuela,
    domicilio: (data["Domicilio"] || "").trim(),
  });
}
