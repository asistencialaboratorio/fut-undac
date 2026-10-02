// Construye los datos completos del FUT combinando la plantilla del
// trámite elegido (catalogo.ts) con los datos del usuario.
// Puerto desde core/constructor.py (app de escritorio).

import { obtenerTramite } from "./catalogo";

export interface FutData {
  tramiteClave: string;
  tramiteNombre: string;
  solicito: string;
  sumilla: string;
  destinatario: string;
  nombresApellidos: string;
  cargoCentroTrabajo: string;
  dni: string;
  codigo: string;
  celular: string;
  correo: string;
  facultad: string;
  escuela: string;
  especialidad: string;
  domicilio: string;
  fundamentacion: string;
  anexo: string;
  fecha: string;
  extra: Record<string, string>;
}

function formatear(plantilla: string, contexto: Record<string, string>): string {
  let texto = plantilla.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, clave: string) => {
    return clave in contexto ? contexto[clave] : `__FALTA:${clave}__`;
  });
  // Limpia artefactos de formateo cuando un placeholder opcional quedó vacío
  // (espacios dobles, o un espacio suelto antes de coma/punto).
  texto = texto.replace(/[ \t]{2,}/g, " ");
  texto = texto.replace(/ +([,.;:])/g, "$1");
  return texto;
}

function fechaHoyLarga(): string {
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const hoy = new Date();
  return `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;
}

export function construirFut(claveTramite: string, datosUsuario: Record<string, string>): FutData {
  const tramite = obtenerTramite(claveTramite);

  const contexto: Record<string, string> = { ...datosUsuario };
  if (!("codigo" in contexto)) contexto.codigo = "";
  if (!("escuela" in contexto)) contexto.escuela = "";
  if (!("facultad" in contexto)) contexto.facultad = "";
  for (const opcional of tramite.camposExtraOpcionales ?? []) {
    if (!(opcional in contexto)) contexto[opcional] = "";
  }
  // Nombre completo de la facultad ("Facultad de Ingeniería"), por si el
  // usuario la escribió sin el prefijo "Facultad de".
  const facultad = contexto.facultad.trim();
  contexto.facultad_completa = !facultad || /^facultad\b/i.test(facultad) ? facultad : `Facultad de ${facultad}`;
  // Variante en mayúsculas de cada valor (ej. {campo_mayus}), para plantillas
  // de SOLICITO/SUMILLA que van en mayúsculas como título.
  for (const [clave, valor] of Object.entries(contexto)) {
    contexto[`${clave}_mayus`] = valor.toLocaleUpperCase("es");
  }

  const textoLibre = (datosUsuario.fundamentacion ?? "").trim();

  const fut: FutData = {
    tramiteClave: claveTramite,
    tramiteNombre: tramite.nombre,
    solicito: formatear(tramite.solicito, contexto),
    sumilla: formatear(tramite.sumilla, contexto),
    destinatario: formatear(tramite.destinatario, contexto),
    nombresApellidos: datosUsuario.nombres_apellidos ?? "",
    cargoCentroTrabajo: datosUsuario.cargo_centro_trabajo ?? "",
    dni: datosUsuario.dni ?? "",
    codigo: datosUsuario.codigo ?? "",
    celular: datosUsuario.celular ?? "",
    correo: datosUsuario.correo ?? "",
    facultad: datosUsuario.facultad ?? "",
    escuela: datosUsuario.escuela ?? "",
    especialidad: datosUsuario.especialidad ?? "",
    domicilio: datosUsuario.domicilio ?? "",
    fundamentacion: textoLibre || formatear(tramite.fundamentacionPlantilla, contexto),
    anexo: datosUsuario.anexo || tramite.anexoSugerido,
    fecha: datosUsuario.fecha || fechaHoyLarga(),
    extra: Object.fromEntries(tramite.camposExtra.map((c) => [c, datosUsuario[c] ?? ""])),
  };

  return fut;
}

const CAMPOS_TEXTO = [
  "tramiteClave", "tramiteNombre", "solicito", "sumilla", "destinatario",
  "nombresApellidos", "cargoCentroTrabajo", "dni", "codigo", "celular", "correo",
  "facultad", "escuela", "especialidad", "domicilio", "fundamentacion", "anexo", "fecha",
] as const;

const MAX_LARGO_CAMPO = 5000;

// Valida un FUT recibido del navegador (ya editado por el usuario): solo
// acepta los campos conocidos, todos de texto y de largo razonable.
export function normalizarFut(crudo: unknown): FutData | null {
  if (!crudo || typeof crudo !== "object") return null;
  const origen = crudo as Record<string, unknown>;
  const fut: FutData = {
    tramiteClave: "", tramiteNombre: "", solicito: "", sumilla: "", destinatario: "",
    nombresApellidos: "", cargoCentroTrabajo: "", dni: "", codigo: "", celular: "", correo: "",
    facultad: "", escuela: "", especialidad: "", domicilio: "", fundamentacion: "", anexo: "",
    fecha: "", extra: {},
  };
  for (const campo of CAMPOS_TEXTO) {
    const valor = origen[campo];
    if (typeof valor !== "string" || valor.length > MAX_LARGO_CAMPO) return null;
    fut[campo] = valor;
  }
  return fut;
}

export function camposFaltantesEnTexto(texto: string): string[] {
  const matches = texto.matchAll(/__FALTA:([a-zA-Z0-9_]+)__/g);
  return Array.from(matches, (m) => m[1]);
}
