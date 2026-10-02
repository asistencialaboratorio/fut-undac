# -*- coding: utf-8 -*-
"""
Orquesta la generación de los archivos finales (.docx y .pdf) a partir
de un FUTData, invocando el script de Node (generar_docx.js) y
LibreOffice para la conversión a PDF.
"""

# -*- coding: utf-8 -*-
"""
Orquesta la generación de los archivos finales (.docx y .pdf) a partir
de un FUTData, usando el generador Python puro (sin dependencia de
Node.js) y LibreOffice para la conversión a PDF.
"""

import re
import shutil
import subprocess
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path

from .generar_docx_py import generar_docx


def _dir_proyecto() -> Path:
    """Determina la carpeta base del proyecto.

    En modo script normal: la carpeta del paquete fut_cli/.
    En modo ejecutable PyInstaller (--onefile): PyInstaller descomprime
    los recursos en una carpeta temporal (sys._MEIPASS) que se borra al
    cerrar el programa, así que la salida NO debe ir ahí. En ese caso
    usamos la carpeta donde está el .exe/binario real.
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


DIR_PROYECTO = _dir_proyecto()
DIR_SALIDA = DIR_PROYECTO / "output"

# Rutas conocidas donde puede estar el conversor de LibreOffice headless
# usado por el skill de docx en el sandbox de Claude. Si no existe
# (uso normal en la PC del estudiante), se usa 'soffice' del PATH.
_SOFFICE_SCRIPT_SANDBOX = Path("/mnt/skills/public/docx/scripts/office/soffice.py")


class GeneracionError(Exception):
    pass


def _slug(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"[^a-zA-Z0-9]+", "_", texto).strip("_").lower()
    return texto or "fut"


def _nombre_archivo(fut) -> str:
    apellido = (fut.nombres_apellidos or "estudiante").split()[0]
    fecha_slug = date.today().strftime("%Y%m%d")
    return f"FUT_{_slug(fut.tramite_clave)}_{_slug(apellido)}_{fecha_slug}"


def _convertir_a_pdf_word(docx_path: Path, pdf_path: Path) -> None:
    """Convierte un .docx a .pdf usando Microsoft Word (COM) en Windows.
    Requiere pywin32 y Word instalados.

    COM exige inicializarse en cada hilo que lo use (CoInitialize); la GUI
    invoca esta función desde un hilo secundario (threading.Thread), así
    que sin esto falla con 'CoInitialize no ha sido llamado'."""
    import pythoncom  # type: ignore
    import win32com.client  # type: ignore

    pythoncom.CoInitialize()
    try:
        # DispatchEx crea una instancia PRIVADA de Word. Con Dispatch se
        # reutilizaría el Word que el usuario tenga abierto, y el Quit() de
        # abajo le cerraría sus documentos.
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        # Evita que cualquier cuadro de diálogo (conversión, formato, etc.)
        # deje el proceso de Word colgado esperando input del usuario.
        word.DisplayAlerts = 0  # wdAlertsNone
        try:
            doc = word.Documents.Open(
                str(docx_path), ConfirmConversions=False,
                ReadOnly=True, AddToRecentFiles=False,
            )
            try:
                # 17 = wdFormatPDF
                doc.SaveAs(str(pdf_path), FileFormat=17)
            finally:
                doc.Close(False)
        finally:
            # Si Open ya falló, Quit también puede fallar (proceso en mal
            # estado); no dejar que eso oculte el error real de arriba.
            try:
                word.Quit()
            except Exception:
                pass
    finally:
        pythoncom.CoUninitialize()


def _convertir_a_pdf_word_con_reintento(docx_path: Path, pdf_path: Path) -> None:
    """Envoltura con un reintento automático: la automatización COM de Word
    puede fallar de forma intermitente (incluyendo el engañoso 'la licencia
    ha expirado'). Cada intento usa su propia instancia de Word, así que no
    hace falta cerrar procesos ajenos."""
    try:
        _convertir_a_pdf_word(docx_path, pdf_path)
    except ImportError:
        raise
    except Exception:
        time.sleep(1.5)
        _convertir_a_pdf_word(docx_path, pdf_path)


def _convertir_a_pdf(docx_path: Path, dir_salida: Path) -> Path:
    """Convierte un .docx a .pdf probando, en orden, LibreOffice (script del
    sandbox o binario del sistema) y, en Windows, Microsoft Word."""
    pdf_path = docx_path.with_suffix(".pdf")

    if _SOFFICE_SCRIPT_SANDBOX.exists():
        cmd = ["python3", str(_SOFFICE_SCRIPT_SANDBOX), "--headless",
               "--convert-to", "pdf", "--outdir", str(dir_salida), str(docx_path)]
        resultado = subprocess.run(cmd, capture_output=True, text=True)
        if resultado.returncode != 0 or not pdf_path.exists():
            raise GeneracionError(f"Error convirtiendo a PDF:\n{resultado.stderr}")
        return pdf_path

    binario = shutil.which("soffice") or shutil.which("libreoffice")
    if binario:
        cmd = [binario, "--headless", "--convert-to", "pdf",
               "--outdir", str(dir_salida), str(docx_path)]
        resultado = subprocess.run(cmd, capture_output=True, text=True)
        if resultado.returncode == 0 and pdf_path.exists():
            return pdf_path
        error_libreoffice = resultado.stderr
    else:
        error_libreoffice = None

    if sys.platform == "win32":
        try:
            _convertir_a_pdf_word_con_reintento(docx_path, pdf_path)
        except ImportError:
            pass
        except Exception as e:
            raise GeneracionError(f"Error convirtiendo a PDF con Microsoft Word:\n{e}")
        else:
            if pdf_path.exists():
                return pdf_path

    if error_libreoffice is not None:
        raise GeneracionError(f"Error convirtiendo a PDF:\n{error_libreoffice}")
    raise GeneracionError(
        "No se encontró LibreOffice ('soffice'/'libreoffice') ni Microsoft "
        "Word disponible para convertir a PDF. Instala LibreOffice, o el "
        "paquete 'pywin32' si tienes Word instalado, o genera solo el "
        "formato .docx."
    )


def _nombre_base_disponible(nombre_base: str, formatos) -> str:
    """Si el .docx o .pdf de ese nombre ya existen y están bloqueados por
    otro programa (típicamente un lector de PDF con el archivo anterior
    todavía abierto), devuelve un nombre alterno libre (agregando _2, _3,
    ...) en vez de fallar al intentar sobrescribirlos."""
    n = 1
    candidato = nombre_base
    while True:
        bloqueado = False
        for ext in ("docx", "pdf"):
            if ext not in formatos:
                continue
            ruta = DIR_SALIDA / f"{candidato}.{ext}"
            if not ruta.exists():
                continue
            try:
                with open(ruta, "r+b"):
                    pass
            except OSError:
                bloqueado = True
                break
        if not bloqueado:
            return candidato
        n += 1
        candidato = f"{nombre_base}_{n}"


def generar_documentos(fut, formatos=("docx", "pdf"), nombre_base=None):
    """Genera el/los archivo(s) solicitados en DIR_SALIDA.

    formatos: tupla con cualquier combinación de "docx", "pdf"
    Devuelve dict {"docx": Path|None, "pdf": Path|None}
    """
    DIR_SALIDA.mkdir(parents=True, exist_ok=True)
    nombre_base = nombre_base or _nombre_archivo(fut)
    nombre_base = _nombre_base_disponible(nombre_base, formatos)

    docx_path = DIR_SALIDA / f"{nombre_base}.docx"
    pdf_path = DIR_SALIDA / f"{nombre_base}.pdf"

    try:
        generar_docx(fut.to_dict(), str(docx_path))
    except Exception as e:
        raise GeneracionError(f"Error generando .docx: {e}")

    if not docx_path.exists():
        raise GeneracionError("El .docx no se generó correctamente.")

    salida = {"docx": docx_path if "docx" in formatos else None, "pdf": None}

    if "pdf" in formatos:
        salida["pdf"] = _convertir_a_pdf(docx_path, DIR_SALIDA)

    if "docx" not in formatos and docx_path.exists():
        docx_path.unlink(missing_ok=True)
        salida["docx"] = None

    return salida
