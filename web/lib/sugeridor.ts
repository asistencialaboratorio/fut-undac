// Sugerencia de trámite a partir de una descripción libre del estudiante,
// SIN usar IA: compara palabras clave contra el nombre/ayuda de cada
// trámite del catálogo (más algunos sinónimos comunes).
// Puerto desde core/sugeridor.py (app de escritorio).

import { CATALOGO } from "./catalogo";

const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o",
  "a", "en", "por", "para", "con", "sin", "que", "mi", "me", "se", "su",
  "del", "al", "es", "soy", "estoy", "quiero", "necesito", "solicito",
  "hacer", "sobre", "como", "quisiera", "favor", "ayuda", "hola",
  "tramite", "fut", "universidad", "undac",
]);

const KEYWORDS_EXTRA: Record<string, string[]> = {
  constancia_matricula: ["matriculado", "matricula"],
  constancia_no_adeudar: ["adeudo", "biblioteca", "deuda", "libros"],
  constancia_egresado: ["egrese", "bachiller", "tercio", "quinto"],
  traslado_interno: ["cambiarme", "cambio", "carrera"],
  traslado_externo: ["otra", "vengo"],
  convalidacion: ["convalidar", "convalidacion", "aprobados"],
  reserva_matricula: ["congelar", "pausar", "reservar"],
  rectificacion_notas: ["nota", "notas", "corregir", "equivocada"],
  carta_presentacion: ["practicas", "empresa"],
  designacion_asesor_practicas: ["asesor", "practicas", "aceptacion", "aceptado"],
  devolucion_documentos: ["devuelvan", "papeles", "documentos"],
  duplicado_carne: ["perdi", "carnet", "carne"],
  subsanacion_actas: ["acta", "actas"],
  exoneracion_primeros_puestos: ["exoneracion", "exonerar", "primeros", "puestos", "comedor", "gratuita", "gratuito"],
};

function normalizar(texto: string): string[] {
  const sinTildes = texto
    .toLocaleLowerCase("es")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  const palabras = sinTildes.match(/[a-z0-9]+/g) ?? [];
  return palabras.filter((p) => !STOPWORDS.has(p) && p.length > 2);
}

function textoTramite(clave: string, nombre: string, ayuda: string): string {
  const partes = [nombre, ayuda, ...(KEYWORDS_EXTRA[clave] ?? [])];
  return partes.join(" ");
}

export interface Sugerencia {
  clave: string;
  nombre: string;
  score: number;
}

export function sugerirTramites(consulta: string, topN = 3): Sugerencia[] {
  const palabrasConsulta = new Set(normalizar(consulta));
  if (palabrasConsulta.size === 0) return [];

  const resultados: Sugerencia[] = [];
  for (const [clave, datos] of Object.entries(CATALOGO)) {
    if (clave === "otro") continue;
    const palabrasTramite = new Set(normalizar(textoTramite(clave, datos.nombre, datos.ayuda)));
    let score = 0;
    for (const p of palabrasConsulta) {
      if (palabrasTramite.has(p)) score++;
    }
    if (score > 0) resultados.push({ clave, nombre: datos.nombre, score });
  }

  resultados.sort((a, b) => b.score - a.score);
  return resultados.slice(0, topN);
}
