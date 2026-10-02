// Datos que se guardan solo en este navegador (localStorage): el perfil del
// estudiante y el historial de FUT generados. Nada se envía al servidor.

import type { FutData } from "./constructor";
import { completarCorreo } from "./validadores";

const K_PERFIL = "fut-undac:perfil";
const K_HISTORIAL = "fut-undac:historial";
const MAX_HISTORIAL = 20;

export const CAMPOS_PERFIL = [
  "nombres_apellidos",
  "dni",
  "codigo",
  "celular",
  "correo",
  "facultad",
  "escuela",
  "domicilio",
  "cargo_centro_trabajo",
] as const;

export interface EntradaHistorial {
  id: string;
  generado: string;
  fut: FutData;
}

function leer(clave: string): unknown {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function cargarPerfil(): Record<string, string> {
  const crudo = leer(K_PERFIL);
  const perfil: Record<string, string> = {};
  if (crudo && typeof crudo === "object") {
    for (const campo of CAMPOS_PERFIL) {
      const valor = (crudo as Record<string, unknown>)[campo];
      if (typeof valor === "string" && valor) perfil[campo] = valor;
    }
  }
  return perfil;
}

export function guardarPerfil(datos: Record<string, string>): boolean {
  const perfil: Record<string, string> = {};
  for (const campo of CAMPOS_PERFIL) if (datos[campo]?.trim()) perfil[campo] = datos[campo].trim();
  if (perfil.correo) perfil.correo = completarCorreo(perfil.correo);
  return escribir(K_PERFIL, perfil);
}

export function borrarPerfil() {
  try {
    localStorage.removeItem(K_PERFIL);
  } catch {}
}

export function cargarHistorial(): EntradaHistorial[] {
  const crudo = leer(K_HISTORIAL);
  if (!Array.isArray(crudo)) return [];
  return crudo.filter(
    (e): e is EntradaHistorial =>
      !!e && typeof e.id === "string" && typeof e.generado === "string" && !!e.fut && typeof e.fut.tramiteClave === "string",
  );
}

export function agregarAlHistorial(fut: FutData) {
  const entrada: EntradaHistorial = { id: String(Date.now()), generado: new Date().toISOString(), fut };
  escribir(K_HISTORIAL, [entrada, ...cargarHistorial()].slice(0, MAX_HISTORIAL));
}

export function quitarDelHistorial(id: string) {
  escribir(K_HISTORIAL, cargarHistorial().filter((e) => e.id !== id));
}

export function borrarHistorial() {
  try {
    localStorage.removeItem(K_HISTORIAL);
  } catch {}
}
