// Validadores de campos. Puerto desde core/modelo.py (app de escritorio).

export class ValidationError extends Error {}

export function validarDni(valor: string): string {
  const v = valor.trim();
  if (!/^\d{8}$/.test(v)) {
    throw new ValidationError("El DNI debe tener exactamente 8 dígitos numéricos.");
  }
  return v;
}

export function validarCodigo(valor: string): string {
  const v = valor.trim();
  if (!/^\d{6,12}$/.test(v)) {
    throw new ValidationError("El código de matrícula debe ser numérico (6 a 12 dígitos).");
  }
  return v;
}

export function validarCelular(valor: string): string {
  const v = valor.trim().replace(/\s+/g, "");
  if (!/^9\d{8}$/.test(v)) {
    throw new ValidationError("El celular debe tener 9 dígitos y empezar con 9 (ej: 987654321).");
  }
  return v;
}

// Si solo escribieron el usuario del correo (sin "@"), se completa con el
// dominio institucional.
export function completarCorreo(valor: string): string {
  const v = valor.trim();
  return v && !v.includes("@") ? `${v}@undac.edu.pe` : v;
}

export function validarCorreo(valor: string): string {
  const v = valor.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
    throw new ValidationError("El correo no tiene un formato válido.");
  }
  return v;
}

type ValidadorFn = (valor: string) => string;

export const VALIDADORES: Record<string, ValidadorFn> = {
  dni: validarDni,
  codigo: validarCodigo,
  celular: validarCelular,
  correo: validarCorreo,
};

/** Devuelve null si es válido, o el mensaje de error si no lo es. */
export function validarCampo(nombreCampo: string | null, valor: string): string | null {
  if (!nombreCampo) return null;
  const fn = VALIDADORES[nombreCampo];
  if (!fn) return null;
  try {
    fn(valor);
    return null;
  } catch (e) {
    if (e instanceof ValidationError) return e.message;
    throw e;
  }
}
