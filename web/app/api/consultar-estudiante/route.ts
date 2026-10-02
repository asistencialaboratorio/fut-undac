import { NextRequest, NextResponse } from "next/server";
import { facultadDeEscuela } from "@/lib/facultades";

// Proxy server-side a la API institucional de la UNDAC. Se hace desde el
// servidor (y no desde el navegador) para que el token que lleva la URL
// de la API nunca llegue al cliente.
//
// "Programa facultad" es en realidad el nombre de la ESCUELA, no de la
// facultad — se usa el catálogo local para deducir la facultad real a
// partir de esa escuela. El "Correo Institucional" solo se usa si
// realmente termina en @undac.edu.pe (antes la API traía ahí el personal).
//
// La URL completa (incluye tokens de acceso propios de la API) se toma de
// una variable de entorno para no dejarla fija en el código público.
// Configúrala en Vercel/Netlify (Environment Variables) o en .env.local
// para desarrollo; ver .env.example.
const BASE_URL = process.env.UNDAC_API_BASE_URL;

// Esta ruta es pública y devuelve datos personales con solo el código, así
// que se limitan las consultas por IP para frenar el barrido de códigos. El
// contador vive en memoria de cada instancia serverless: no es un límite
// exacto.
const VENTANA_MS = 10 * 60 * 1000;
const MAX_CONSULTAS = 10;
const consultasPorIp = new Map<string, number[]>();

function excedeLimite(ip: string): boolean {
  const ahora = Date.now();
  if (consultasPorIp.size > 5000) consultasPorIp.clear();
  const recientes = (consultasPorIp.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  recientes.push(ahora);
  consultasPorIp.set(ip, recientes);
  return recientes.length > MAX_CONSULTAS;
}

function ipDelCliente(request: NextRequest): string {
  return (
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "desconocida"
  );
}

export async function POST(request: NextRequest) {
  if (!BASE_URL) {
    return NextResponse.json(
      { error: "El autocompletado por API no está configurado en este servidor (falta UNDAC_API_BASE_URL)." },
      { status: 500 },
    );
  }

  if (excedeLimite(ipDelCliente(request))) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera unos minutos e inténtalo de nuevo." },
      { status: 429 },
    );
  }

  let body: { codigo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  }
  const codigo = String(body.codigo ?? "").trim();

  if (!/^\d{6,12}$/.test(codigo)) {
    return NextResponse.json(
      { error: "El código de matrícula debe ser numérico (6 a 12 dígitos)." },
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
    return NextResponse.json({ error: `Código de matrícula '${codigo}' no encontrado.` }, { status: 404 });
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

  const correoInstitucional = (data["Correo Institucional"] || "").trim();

  return NextResponse.json({
    nombresApellidos,
    dni: (data["Dni"] || "").trim(),
    correoInstitucional: correoInstitucional.toLowerCase().endsWith("@undac.edu.pe") ? correoInstitucional : "",
    facultad,
    escuela,
    domicilio: (data["Domicilio"] || "").trim(),
  });
}
