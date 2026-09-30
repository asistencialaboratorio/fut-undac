// Genera el .docx del FUT en el servidor (Vercel Function), sin depender
// de Word ni LibreOffice — usa la librería `docx` (generación directa del
// formato OOXML). Puerto/adaptación del diseño de core/generar_docx_py.py
// (app de escritorio): valor arriba, etiqueta numerada debajo, encabezado
// con logo + título, marca de agua de fondo, y talón de cargo al final.

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
  TextWrappingType,
  TabStopType,
  convertMillimetersToTwip,
} from "docx";
import { FutData } from "./constructor";

const FONT = "Arial";
const CM = (n: number) => convertMillimetersToTwip(n * 10);

function leerAsset(nombre: string): Buffer {
  return fs.readFileSync(path.join(process.cwd(), "public", "img", nombre));
}

function celdaSinBorde(children: Paragraph[], width?: number) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    children,
  });
}

function run(text: string, opts: { bold?: boolean; size?: number } = {}) {
  return new TextRun({ text: text || " ", font: FONT, size: (opts.size ?? 10.5) * 2, bold: opts.bold });
}

function valorParrafo(texto: string, size: number) {
  return new Paragraph({
    spacing: { before: 80, after: 20 },
    border: { bottom: { style: BorderStyle.DOTTED, size: 4, space: 1, color: "000000" } },
    children: [run(texto || " ", { size })],
  });
}

function etiquetaParrafo(numero: number | null, texto: string, size: number) {
  return new Paragraph({
    spacing: { before: 0, after: 100 },
    children: [run(numero ? `${numero}. ${texto}` : texto, { bold: true, size })],
  });
}

function valorParrafoDoble(v1: string, v2: string, size: number) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: CM(9.5) }],
    spacing: { before: 80, after: 20 },
    border: { bottom: { style: BorderStyle.DOTTED, size: 4, space: 1, color: "000000" } },
    children: [run(v1 || " ", { size }), run("\t"), run(v2 || " ", { size })],
  });
}

function etiquetaParrafoDoble(n1: number, e1: string, n2: number, e2: string, size: number) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: CM(9.5) }],
    spacing: { before: 0, after: 100 },
    children: [
      run(`${n1}. ${e1}`, { bold: true, size }),
      run("\t"),
      run(`${n2}. ${e2}`, { bold: true, size }),
    ],
  });
}

export async function generarDocxFut(fut: FutData): Promise<Buffer> {
  const logo = leerAsset("undac_logo.jpg");
  const watermark = leerAsset("undac_watermark.png");

  const compacto = (fut.fundamentacion || "").length > 500;
  const size = compacto ? 9.5 : 10.5;

  const facultadLinea = [fut.facultad, fut.escuela, fut.especialidad]
    .filter((v) => v && v.trim())
    .join("   /   ");

  const headerTable = new Table({
    width: { size: CM(17.7), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          celdaSinBorde(
            [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ data: logo, type: "jpg", transformation: { width: 48, height: 56 } })],
              }),
            ],
            CM(2.2),
          ),
          celdaSinBorde([
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [run("UNIVERSIDAD NACIONAL DANIEL ALCIDES CARRIÓN", { bold: true, size: 13.5 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [run("FORMULARIO ÚNICO DE TRÁMITE", { bold: true, size: 12 })],
            }),
          ]),
        ],
      }),
    ],
  });

  const lineaGruesa = new Paragraph({
    spacing: { before: 80, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, space: 1, color: "000000" } },
    children: [],
  });

  const solicitoLineas = fut.solicito.split("\n");
  const solicitoParrafos = solicitoLineas.map(
    (linea, i) =>
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 80 },
        border: { bottom: { style: BorderStyle.DOTTED, size: 4, space: 1, color: "000000" } },
        children: i === 0 ? [run("SOLICITO: ", { bold: true, size }), run(linea, { size })] : [run(linea, { size })],
      }),
  );

  const fundamentacionLineas = (fut.fundamentacion || "").split("\n").filter((l) => l.trim() !== "");
  const fundamentacionParrafos = (fundamentacionLineas.length ? fundamentacionLineas : [""]).map(
    (linea) => valorParrafo(linea, size),
  );

  const watermarkImage = new ImageRun({
    data: watermark,
    type: "png",
    transformation: { width: 360, height: 360 },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: CM(7.5) },
      wrap: { type: TextWrappingType.NONE },
      behindDocument: true,
      allowOverlap: true,
    },
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: CM(1.1), bottom: CM(1.1), left: CM(1.9), right: CM(1.9) },
          },
        },
        children: [
          new Paragraph({ children: [watermarkImage] }),
          headerTable,
          lineaGruesa,
          ...solicitoParrafos,

          valorParrafo(fut.destinatario, size),
          etiquetaParrafo(2, "DESTINATARIO", size),

          valorParrafo(fut.nombresApellidos, size),
          etiquetaParrafo(3, "DATOS DEL USUARIO (APELLIDOS Y NOMBRES)", size),

          valorParrafo(fut.cargoCentroTrabajo, size),
          etiquetaParrafo(4, "CARGO ACTUAL Y/O CENTRO DE TRABAJO", size),

          valorParrafoDoble(fut.dni, fut.codigo, size),
          etiquetaParrafoDoble(5, "D.N.I.", 6, "CÓDIGO DE MATRÍCULA", size),

          valorParrafoDoble(fut.celular, fut.correo, size),
          etiquetaParrafoDoble(7, "N° CELULAR/TELF.", 8, "CORREO ELECTRÓNICO", size),

          valorParrafo(facultadLinea, size),
          new Paragraph({
            spacing: { before: 0, after: 100 },
            children: [run("9. FACULTAD  /  ESCUELA PROFESIONAL  /  ESPECIALIDAD", { bold: true, size: size - 1 })],
          }),

          valorParrafo(fut.domicilio, size),
          etiquetaParrafo(10, "DOMICILIO DEL USUARIO (Calle, Distrito, Provincia Y Región)", size),

          etiquetaParrafo(11, "FUNDAMENTACIÓN DEL PEDIDO", size),
          ...fundamentacionParrafos,

          new Paragraph({
            tabStops: [{ type: TabStopType.LEFT, position: CM(9.5) }],
            spacing: { before: 80, after: 40 },
            children: [
              run("12. ANEXO.", { bold: true, size }),
              run("\t"),
              run(`13. FECHA: ${fut.fecha}`, { bold: true, size }),
            ],
          }),
          valorParrafo(fut.anexo, size),

          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [run("14. FIRMA:", { bold: true, size })],
          }),
          valorParrafo("", size),

          new Paragraph({ spacing: { before: 120, after: 120 }, children: [run("=".repeat(98), { size: 8 })] }),

          new Paragraph({
            spacing: { after: 100 },
            children: [run("FUNDAMENTACIÓN DEL PEDIDO: ", { bold: true, size: 8.5 }), run(fut.sumilla, { size: 8.5 })],
          }),
          new Paragraph({
            tabStops: [{ type: TabStopType.LEFT, position: CM(12.5) }],
            spacing: { after: 100 },
            children: [
              run("APELLIDOS Y NOMBRES: ", { bold: true, size: 8.5 }),
              run(fut.nombresApellidos, { size: 8.5 }),
              run("\t"),
              run("FOLIO: ", { bold: true, size: 8.5 }),
              run("________________", { size: 8.5 }),
            ],
          }),
          new Paragraph({
            tabStops: [{ type: TabStopType.LEFT, position: CM(12.5) }],
            spacing: { after: 100 },
            children: [
              run("N° DE REGISTRO: ", { bold: true, size: 8.5 }),
              run("________________", { size: 8.5 }),
              run("\t"),
              run("FECHA: ", { bold: true, size: 8.5 }),
              run("________________", { size: 8.5 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 40 },
            border: { bottom: { style: BorderStyle.DOTTED, size: 4, space: 1, color: "000000" } },
            children: [run(facultadLinea || " ", { size: 8.5 })],
          }),
          new Paragraph({
            children: [run("FACULTAD / ESCUELA PROFESIONAL / ESPECIALIDAD", { bold: true, size: 7.5 })],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
