// Catálogo de facultades y escuelas profesionales de la UNDAC.
// Fuente: undac.edu.pe/explorar-facultades (11 facultades, 21 escuelas).
// Puerto desde data/facultades_undac.json (app de escritorio).

export interface FacultadEntry {
  facultad: string;
  escuelas: string[];
}

export const FACULTADES: FacultadEntry[] = [
  {
    facultad: "Facultad de Ingeniería",
    escuelas: [
      "Ingeniería Civil",
      "Ingeniería de Sistemas y Computación",
      "Ingeniería Geológica",
      "Ingeniería Metalúrgica",
      "Ingeniería Ambiental",
    ],
  },
  {
    facultad: "Facultad de Ingeniería de Minas",
    escuelas: ["Ingeniería de Minas"],
  },
  {
    facultad: "Facultad de Ciencias de la Salud",
    escuelas: ["Enfermería", "Obstetricia"],
  },
  {
    facultad: "Facultad de Medicina Humana",
    escuelas: ["Medicina Humana"],
  },
  {
    facultad: "Facultad de Odontología",
    escuelas: ["Odontología"],
  },
  {
    facultad: "Facultad de Ciencias Económicas y Contables",
    escuelas: ["Contabilidad", "Economía"],
  },
  {
    facultad: "Facultad de Ciencias Empresariales",
    escuelas: ["Administración"],
  },
  {
    facultad: "Facultad de Ciencias de la Educación",
    escuelas: ["Educación Inicial", "Educación Primaria", "Educación Secundaria"],
  },
  {
    facultad: "Facultad de Ciencias de la Comunicación",
    escuelas: ["Ciencias de la Comunicación"],
  },
  {
    facultad: "Facultad de Derecho y Ciencias Políticas",
    escuelas: ["Derecho"],
  },
  {
    facultad: "Facultad de Ciencias Agropecuarias",
    escuelas: ["Agronomía", "Zootecnia", "Industrias Alimentarias - La Merced"],
  },
];

export function listarFacultades(): string[] {
  return FACULTADES.map((f) => f.facultad);
}

export function listarEscuelas(facultad?: string): string[] {
  if (facultad) {
    return FACULTADES.find((f) => f.facultad === facultad)?.escuelas ?? [];
  }
  const vistas: string[] = [];
  for (const f of FACULTADES) {
    for (const e of f.escuelas) {
      if (!vistas.includes(e)) vistas.push(e);
    }
  }
  return vistas;
}

export function facultadDeEscuela(escuela: string): string {
  return FACULTADES.find((f) => f.escuelas.includes(escuela))?.facultad ?? "";
}
