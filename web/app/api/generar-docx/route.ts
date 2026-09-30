import { NextRequest, NextResponse } from "next/server";
import { construirFut } from "@/lib/constructor";
import { generarDocxFut } from "@/lib/docx-generator";

// No hay almacenamiento: el documento se genera en memoria por cada
// solicitud y se entrega directo para descargar. Nada queda guardado en
// el servidor.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claveTramite, datos, nombreArchivo } = body as {
      claveTramite: string;
      datos: Record<string, string>;
      nombreArchivo?: string;
    };

    if (!claveTramite || !datos) {
      return NextResponse.json({ error: "Faltan datos del trámite." }, { status: 400 });
    }

    const fut = construirFut(claveTramite, datos);
    const buffer = await generarDocxFut(fut);
    const nombre = (nombreArchivo || `FUT_${claveTramite}`).replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${nombre}.docx"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: `Error generando el documento: ${msg}` }, { status: 500 });
  }
}
