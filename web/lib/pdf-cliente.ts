// Descarga la hoja A4 de la vista previa como PDF, generado en el navegador a
// partir de lo que se ve (incluidas las ediciones del usuario). Nada se envía
// al servidor. Las librerías se cargan solo al pedir el PDF.

export function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function descargarPdfDesdeHoja(hoja: HTMLElement, nombreArchivo: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  // "capturando" oculta los textos de ayuda de los campos vacíos.
  hoja.classList.add("capturando");
  try {
    const canvas = await html2canvas(hoja, {
      scale: 3,
      backgroundColor: "#ffffff",
      width: hoja.offsetWidth,
      height: hoja.offsetHeight,
      onclone: (documento) => {
        // En pantalla la hoja se reduce con transform; en el PDF va a tamaño real.
        documento.querySelectorAll<HTMLElement>(".fut-escala").forEach((el) => {
          el.style.transform = "none";
        });
      },
    });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
    descargarBlob(pdf.output("blob"), nombreArchivo);
  } finally {
    hoja.classList.remove("capturando");
  }
}
