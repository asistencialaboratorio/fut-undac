// Configuración de campos del formulario del FUT.
// Puerto desde data/campos_config.json (app de escritorio).

export type ValidadorKey = "dni" | "codigo" | "celular" | "correo" | null;

export interface CampoConfig {
  clave: string;
  etiqueta: string;
  obligatorio: boolean;
  placeholder: string;
  validador: ValidadorKey;
  ayuda: string;
}

export const CAMPOS_CONFIG: CampoConfig[] = [
  {
    clave: "nombres_apellidos",
    etiqueta: "Apellidos y Nombres",
    obligatorio: true,
    placeholder: "QUISPE MAMANI JOSE CARLOS",
    validador: null,
    ayuda: "Primero apellidos, luego nombres tal como figuran en tu DNI",
  },
  {
    clave: "dni",
    etiqueta: "D.N.I.",
    obligatorio: true,
    placeholder: "76543210",
    validador: "dni",
    ayuda: "8 dígitos numéricos",
  },
  {
    clave: "codigo",
    etiqueta: "Código de Matrícula",
    obligatorio: true,
    placeholder: "2210089034",
    validador: "codigo",
    ayuda: "Código numérico de 6 a 12 dígitos",
  },
  {
    clave: "celular",
    etiqueta: "N° Celular",
    obligatorio: true,
    placeholder: "987654321",
    validador: "celular",
    ayuda: "9 dígitos, debe comenzar con 9",
  },
  {
    clave: "correo",
    etiqueta: "Correo Electrónico",
    obligatorio: true,
    placeholder: "jose.quispe@undac.edu.pe",
    validador: "correo",
    ayuda: "Usa tu correo institucional @undac.edu.pe",
  },
  {
    clave: "facultad",
    etiqueta: "Facultad",
    obligatorio: true,
    placeholder: "Facultad de Ingeniería",
    validador: null,
    ayuda: "Elige tu facultad de la lista o escríbela si no aparece",
  },
  {
    clave: "escuela",
    etiqueta: "Escuela Profesional",
    obligatorio: true,
    placeholder: "Ingeniería de Sistemas y Computación",
    validador: null,
    ayuda: "Se filtra según la Facultad elegida",
  },
  {
    clave: "especialidad",
    etiqueta: "Especialidad",
    obligatorio: false,
    placeholder: "Sistemas de Información",
    validador: null,
    ayuda: "Opcional — deja en blanco si no aplica",
  },
  {
    clave: "domicilio",
    etiqueta: "Domicilio",
    obligatorio: true,
    placeholder: "Jr. Comercio 456, Yanacancha, Pasco",
    validador: null,
    ayuda: "Calle, Distrito, Provincia y Región",
  },
  {
    clave: "cargo_centro_trabajo",
    etiqueta: "Cargo / Centro de Trabajo",
    obligatorio: false,
    placeholder: "Estudiante",
    validador: null,
    ayuda: "Opcional — solo si trabajas actualmente",
  },
];

export const ANCHO_COMPLETO = new Set(["nombres_apellidos", "domicilio", "cargo_centro_trabajo"]);
