import { NextRequest, NextResponse } from "next/server";
import { normalizarFut } from "@/lib/constructor";
import { generarDocxFut } from "@/lib/docx-generator";

// No hay almacenamiento: el documento se genera en memoria por cada
// solicitud y se entrega directo para descargar. Nada queda guardado en el
// servidor. Recibe el FUT ya editado por el usuario en la vista previa.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { fut?: unknown; nombreArchivo?: unknown };
    const fut = normalizarFut(body.fut);

    if (!fut) {
      return NextResponse.json({ error: "Faltan datos del trámite o no son válidos." }, { status: 400 });
    }

    const buffer = await generarDocxFut(fut);
    const nombre = String(body.nombreArchivo || `FUT_${fut.tramiteClave}`)
      .slice(0, 100)
      .replace(/[^a-zA-Z0-9_-]/g, "_");

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
