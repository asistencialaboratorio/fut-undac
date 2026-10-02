// Genera el .docx del FUT en el servidor (Vercel Function), sin depender
// de Word ni LibreOffice — usa la librería `docx` (generación directa del
// formato OOXML). Sigue la misma disposición que la hoja de la vista previa
// (components/FutDocument.tsx), que replica el formulario oficial de la UNDAC:
// renglones punteados, valor sobre la línea y etiqueta
// numerada debajo, y talón de cargo al final. Ocupa una hoja A4 completa.

import fs from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  ImageRun,
  HorizontalPositionRelativeFrom,
  HorizontalPositionAlign,
  VerticalPositionRelativeFrom,
  VerticalPositionAlign,
  TextWrappingType,
  TabStopType,
  LineRuleType,
  TableLayoutType,
  convertMillimetersToTwip,
} from "docx";
import { FutData } from "./constructor";

const FONT = "Arial";
const CM = (n: number) => convertMillimetersToTwip(n * 10);

// Las imágenes no cambian entre solicitudes: se leen una sola vez.
const cacheAssets = new Map<string, Buffer>();
function leerAsset(nombre: string): Buffer {
  let datos = cacheAssets.get(nombre);
  if (!datos) {
    datos = fs.readFileSync(path.join(process.cwd(), "public", "img", nombre));
    cacheAssets.set(nombre, datos);
  }
  return datos;
}

const SIN_BORDE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const BORDES_NINGUNO = { top: SIN_BORDE, bottom: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE };
const BORDES_TABLA_NINGUNO = { ...BORDES_NINGUNO, insideHorizontal: SIN_BORDE, insideVertical: SIN_BORDE };
const PUNTEADO = { style: BorderStyle.DOTTED, size: 4, space: 1, color: "000000" };

// Tamaño de letra y alto de renglón según el largo de la fundamentación (modo
// compacto): `capacidad` es cuántos renglones de fundamentación caben en la
// hoja con ese ritmo; `ancho` son los caracteres que entran en un renglón.
interface Ritmo {
  size: number;
  lh: number; // alto exacto del renglón, en veinteavos de punto
  ancho: number;
  capacidad: number;
}
const RITMOS: Ritmo[] = [
  { size: 10.5, lh: 380, ancho: 88, capacidad: 7 },
  { size: 10, lh: 350, ancho: 93, capacidad: 9 },
  { size: 9.5, lh: 330, ancho: 98, capacidad: 10 },
  { size: 9, lh: 305, ancho: 104, capacidad: 12 },
  { size: 8.5, lh: 285, ancho: 111, capacidad: 14 },
  { size: 8, lh: 265, ancho: 118, capacidad: 16 },
];

function run(text: string, opts: { bold?: boolean; size: number }) {
  return new TextRun({ text: text || " ", font: FONT, size: Math.round(opts.size * 2), bold: opts.bold });
}

// Parte el texto en renglones de a lo más `ancho` caracteres, conservando los
// saltos de línea (una línea vacía queda como renglón en blanco).
function partir(texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const candidato = actual ? `${actual} ${palabra}` : palabra;
      if (candidato.length > ancho && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = candidato;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

function conMinimo(lineas: string[], minimo: number): string[] {
  const resultado = [...lineas];
  while (resultado.length < minimo) resultado.push("");
  return resultado;
}

function renglon(
  hijos: TextRun[],
  lh: number,
  opts: { antes?: number; sangria?: number; alineacion?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
) {
  return new Paragraph({
    spacing: { before: opts.antes ?? 0, after: 0, line: lh, lineRule: LineRuleType.EXACT },
    indent: opts.sangria ? { left: opts.sangria } : undefined,
    alignment: opts.alineacion,
    border: { bottom: PUNTEADO, between: PUNTEADO },
    children: hijos,
  });
}

function etiqueta(texto: string, size: number, opts: { sangria?: number; antes?: number; despues?: number } = {}) {
  return new Paragraph({
    spacing: { before: opts.antes ?? 20, after: opts.despues ?? 40 },
    indent: opts.sangria ? { left: opts.sangria } : undefined,
    children: [run(texto, { bold: true, size })],
  });
}

function celda(hijos: Paragraph[], ancho: number, izquierda = 0, derecha = 0) {
  return new TableCell({
    width: { size: ancho, type: WidthType.DXA },
    verticalAlign: VerticalAlign.BOTTOM,
    borders: BORDES_NINGUNO,
    margins: { top: 0, bottom: 0, left: izquierda, right: derecha },
    children: hijos,
  });
}

function tabla(anchos: number[], filas: TableRow[]) {
  return new Table({
    width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: anchos,
    layout: TableLayoutType.FIXED,
    borders: BORDES_TABLA_NINGUNO,
    rows: filas,
  });
}

// Facultad / Escuela / Especialidad en tres columnas separadas por "/".
function tablaTres(
  fut: FutData,
  ritmo: { size: number; lh: number },
  etiquetas: [string, string, string],
  etiquetaSize: number,
) {
  const anchos = [CM(4.7), CM(0.5), CM(6.4), CM(0.5), CM(4.5)];
  const valor = (texto: string) => renglon([run(texto, { size: ritmo.size })], ritmo.lh, { antes: 50 });
  const barra = () =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 70, after: 0, line: ritmo.lh, lineRule: LineRuleType.EXACT },
      children: [run("/", { size: ritmo.size })],
    });
  const rotulo = (texto: string) =>
    new Paragraph({ spacing: { before: 20, after: 40 }, children: [run(texto, { bold: true, size: etiquetaSize })] });
  const vacio = () => new Paragraph({ children: [] });
  const fila = (parrafos: Paragraph[]) => new TableRow({ children: parrafos.map((p, i) => celda([p], anchos[i])) });

  return tabla(anchos, [
    fila([valor(fut.facultad), barra(), valor(fut.escuela), barra(), valor(fut.especialidad)]),
    fila([rotulo(etiquetas[0]), vacio(), rotulo(etiquetas[1]), vacio(), rotulo(etiquetas[2])]),
  ]);
}

export async function generarDocxFut(fut: FutData): Promise<Buffer> {
  const logo = leerAsset("undac_logo.jpg");
  const watermark = leerAsset("undac_watermark.png");

  const lineasBase = (ancho: number) => partir(fut.fundamentacion || "", ancho);
  const ritmo = RITMOS.find((r) => lineasBase(r.ancho).length <= r.capacidad) ?? RITMOS[RITMOS.length - 1];
  const { size, lh } = ritmo;
  const sizeEtiqueta = size;
  const sizeTalon = Math.max(size - 2, 7.5);
  const lhTalon = Math.round(lh * 0.88);

  const ANCHO_UTIL = CM(16.6);

  // ── Encabezado ──
  const cabecera = tabla(
    [CM(2.2), ANCHO_UTIL - CM(2.2)],
    [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CM(2.2), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: BORDES_NINGUNO,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new ImageRun({ data: logo, type: "jpg", transformation: { width: 64, height: 76 } })],
              }),
            ],
          }),
          new TableCell({
            width: { size: ANCHO_UTIL - CM(2.2), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: BORDES_NINGUNO,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run("UNIVERSIDAD NACIONAL DANIEL ALCIDES CARRIÓN", { bold: true, size: 14 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run("FORMULARIO ÚNICO DE TRÁMITE", { size: 13 })],
              }),
            ],
          }),
        ],
      }),
    ],
  );

  const marcaDeAgua = new ImageRun({
    data: watermark,
    type: "png",
    transformation: { width: 435, height: 435 },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
      wrap: { type: TextWrappingType.NONE },
      behindDocument: true,
      allowOverlap: true,
    },
  });

  const lineaTitulo = new Paragraph({
    spacing: { before: 40, after: 180, line: 40, lineRule: LineRuleType.EXACT },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, space: 1, color: "000000" } },
    children: [marcaDeAgua],
  });

  // ── SOLICITO (3 renglones) y 1. SUMILLA ──
  const PREFIJO = "SOLICITO: ";
  const lineasSolicito = conMinimo(partir(PREFIJO + fut.solicito, 38), 3);
  lineasSolicito[0] = lineasSolicito[0].slice(PREFIJO.length);
  const sangriaSolicito = CM(7.3);
  const bloqueSolicito = lineasSolicito.map((linea, i) =>
    renglon(
      i === 0 ? [run(PREFIJO, { bold: true, size }), run(linea, { size })] : [run(linea, { size })],
      lh,
      { sangria: sangriaSolicito },
    ),
  );

  const valor = (texto: string) => renglon([run(texto, { size })], lh, { antes: 50 });
  const separacion = (): Paragraph => new Paragraph({ spacing: { before: 0, after: 0, line: 60, lineRule: LineRuleType.EXACT }, children: [] });

  // ── Fundamentación (renglones que llenan el espacio de la hoja) ──
  const lineasFund = conMinimo(lineasBase(ritmo.ancho), ritmo.capacidad);
  const bloqueFund = lineasFund.map((l) => renglon([run(l, { size })], lh));

  // ── Anexo / Fecha / Firma ──
  const lineasAnexo = conMinimo(partir(fut.anexo || "", 44), 3);
  const cierre = tabla(
    [CM(8.6), CM(8.0)],
    [
      new TableRow({
        children: [
          celda(
            [
              new Paragraph({ spacing: { before: 0, after: 20 }, children: [run("12. ANEXO.", { bold: true, size })] }),
              ...lineasAnexo.map((l) => renglon([run(l, { size })], lh)),
            ],
            CM(8.6),
            0,
            CM(0.3),
          ),
          new TableCell({
            width: { size: CM(8.0), type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            borders: BORDES_NINGUNO,
            margins: { top: 0, bottom: 0, left: CM(0.3), right: 0 },
            children: [
              renglon([run("13. FECHA: ", { bold: true, size }), run(fut.fecha, { size })], lh),
              renglon([run("14. FIRMA:", { bold: true, size })], lh, { antes: 260 }),
            ],
          }),
        ],
      }),
    ],
  );

  // ── Talón ──
  const talon = [
    renglon(
      [run("FUNDAMENTACIÓN DEL PEDIDO: ", { bold: true, size: sizeTalon }), run(fut.sumilla, { size: sizeTalon })],
      lhTalon,
    ),
    tabla(
      [CM(10.4), CM(6.2)],
      [
        new TableRow({
          children: [
            celda(
              [
                renglon(
                  [run("APELLIDOS Y NOMBRES: ", { bold: true, size: sizeTalon }), run(fut.nombresApellidos, { size: sizeTalon })],
                  lhTalon,
                ),
              ],
              CM(10.4),
              0,
              CM(0.3),
            ),
            celda([renglon([run("FOLIO:", { bold: true, size: sizeTalon })], lhTalon)], CM(6.2), CM(0.3)),
          ],
        }),
        new TableRow({
          children: [
            celda([renglon([run("N° DE REGISTRO:", { bold: true, size: sizeTalon })], lhTalon)], CM(10.4), 0, CM(0.3)),
            celda([renglon([run("FECHA:", { bold: true, size: sizeTalon })], lhTalon)], CM(6.2), CM(0.3)),
          ],
        }),
      ],
    ),
    tablaTres(fut, { size: sizeTalon, lh: lhTalon }, ["FACULTAD", "ESCUELA PROFESIONAL", "ESPECIALIDAD"], sizeTalon - 0.5),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: CM(21), height: CM(29.7) },
            margin: { top: CM(1.5), bottom: CM(1.3), left: CM(2.2), right: CM(2.2), header: 0, footer: 0 },
          },
        },
        children: [
          cabecera,
          lineaTitulo,

          ...bloqueSolicito,
          etiqueta("1. SUMILLA", size - 1, { sangria: CM(6.0), antes: 20, despues: 20 }),

          valor(fut.destinatario),
          etiqueta("2. DESTINATARIO", sizeEtiqueta),

          valor(fut.nombresApellidos),
          etiqueta("3. DATOS DEL USUARIO (APELLIDOS Y NOMBRES)", sizeEtiqueta),

          valor(fut.cargoCentroTrabajo),
          etiqueta("4. CARGO ACTUAL Y/O CENTRO DE TRABAJO", sizeEtiqueta),

          doble(fut.dni, fut.codigo, size, lh),
          etiquetaDoble("5. D.N.I.", "6. CÓDIGO DE MATRÍCULA", sizeEtiqueta),

          doble(fut.celular, fut.correo, size, lh),
          etiquetaDoble("7. N° CELULAR/TELF.", "8. CORREO ELECTRÓNICO", sizeEtiqueta),

          tablaTres(fut, { size, lh }, ["9. FACULTAD", "ESCUELA PROFESIONAL", "ESPECIALIDAD"], sizeEtiqueta),

          valor(fut.domicilio),
          etiqueta("10. DOMICILIO DEL USUARIO (Calle, Distrito, Provincia Y Región)", sizeEtiqueta),

          etiqueta("11. FUNDAMENTACIÓN DEL PEDIDO", sizeEtiqueta, { antes: 140, despues: 0 }),
          ...bloqueFund,

          separacion(),
          cierre,

          new Paragraph({
            spacing: { before: 140, after: 100 },
            children: [run("=".repeat(98), { size: 8 })],
          }),

          ...talon,

          // Word exige un párrafo después de la última tabla; uno mínimo evita que caiga a otra hoja.
          new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: [] }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

const TAB_DOBLE = CM(8.6);

// Dos valores en la misma línea punteada (DNI | código, celular | correo).
function doble(v1: string, v2: string, size: number, lh: number) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: TAB_DOBLE }],
    spacing: { before: 50, after: 0, line: lh, lineRule: LineRuleType.EXACT },
    border: { bottom: PUNTEADO },
    children: [run(v1, { size }), run("\t", { size }), run(v2, { size })],
  });
}

function etiquetaDoble(e1: string, e2: string, size: number) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: TAB_DOBLE }],
    spacing: { before: 20, after: 40 },
    children: [run(e1, { bold: true, size }), run("\t", { size }), run(e2, { bold: true, size })],
  });
}
