# -*- coding: utf-8 -*-
"""
Conector a la API institucional de UNDAC para autocompletar datos
del estudiante a partir de su código de matrícula.

La API devuelve "Correo Personal" y "Correo Institucional" por separado.
Como antes ese segundo campo traía el correo personal por error, solo se
usa como correo institucional si realmente termina en @undac.edu.pe.
"""

import os
import sys
import urllib.request
import urllib.error
import json
from pathlib import Path

from .facultades import facultad_de_escuela

TIMEOUT_SEGUNDOS = 8


class APIError(Exception):
    pass


def _dir_env() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def base_url() -> str:
    """URL base de la API (incluye tokens propios de la API, por eso no
    está en el código). Se toma de la variable de entorno
    UNDAC_API_BASE_URL o, si no existe, del archivo `.env` junto al
    proyecto/ejecutable (ver `.env.example`)."""
    url = os.environ.get("UNDAC_API_BASE_URL", "").strip()
    if not url:
        try:
            for linea in (_dir_env() / ".env").read_text(encoding="utf-8").splitlines():
                clave, _, valor = linea.partition("=")
                if clave.strip() == "UNDAC_API_BASE_URL":
                    url = valor.strip().strip("\"'")
                    break
        except OSError:
            pass
    if not url:
        raise APIError(
            "Falta configurar UNDAC_API_BASE_URL (variable de entorno o "
            "archivo .env; ver .env.example)."
        )
    return url.rstrip("/")


def consultar_estudiante(codigo: str) -> dict:
    """Consulta la API institucional por código de matrícula.

    Devuelve un diccionario normalizado:
        {
            "nombres_apellidos": str,
            "dni": str,
            "correo_institucional": str,  # "" si no termina en @undac.edu.pe
            "correo_personal": str,
            "facultad": str,
            "escuela": str,
            "domicilio": str,
            "fecha_ingreso": str,
            "curricula": str,
            "raw": dict,  # respuesta original sin procesar
        }

    Lanza APIError si la consulta falla o el código no existe.
    """
    codigo = codigo.strip()
    if not codigo.isdigit():
        raise APIError("El código de matrícula debe ser numérico para consultar la API.")

    url = f"{base_url()}/{codigo}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEGUNDOS) as resp:
            raw_bytes = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 403:
            raise APIError(
                "La API rechazó la conexión (403 Forbidden). Es posible que "
                "el servicio solo sea accesible desde la red institucional "
                "de UNDAC (wifi del campus o VPN universitaria)."
            )
        if e.code == 404:
            raise APIError(f"Código de matrícula '{codigo}' no encontrado (404).")
        raise APIError(f"La API respondió con error HTTP {e.code}.")
    except urllib.error.URLError as e:
        raise APIError(
            f"No se pudo conectar a la API de UNDAC: {e.reason}. "
            "Verifica tu conexión a internet o si necesitas estar en la "
            "red institucional."
        )
    except TimeoutError:
        raise APIError("La API tardó demasiado en responder (timeout).")
    except Exception as e:
        raise APIError(f"Error inesperado consultando la API: {e}")

    try:
        data = json.loads(raw_bytes.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise APIError("La API devolvió una respuesta no válida (¿código inexistente?).")

    if not data or "Nombres" not in data:
        raise APIError(f"No se encontraron datos para el código '{codigo}'.")

    apellido_paterno = data.get("Apellido paterno", "").strip()
    apellido_materno = data.get("Apellido materno", "").strip()
    nombres = data.get("Nombres", "").strip()
    nombres_apellidos = f"{apellido_paterno} {apellido_materno} {nombres}".strip()
    nombres_apellidos = " ".join(nombres_apellidos.split())  # normaliza espacios

    # "Programa facultad" es, en realidad, el nombre de la ESCUELA/programa
    # (ej. "INGENIERÍA DE SISTEMAS Y COMPUTACIÓN"), no el de la facultad.
    # Se usa el catálogo de la UNDAC para deducir la facultad correcta a
    # partir de esa escuela; si no la reconoce, se deja la escuela sola y
    # el usuario completa la facultad manualmente.
    escuela = data.get("Programa facultad", "").strip()
    facultad = facultad_de_escuela(escuela)

    correo_inst = data.get("Correo Institucional", "").strip()
    if not correo_inst.lower().endswith("@undac.edu.pe"):
        correo_inst = ""

    return {
        "nombres_apellidos": nombres_apellidos,
        "dni": data.get("Dni", "").strip(),
        "correo_institucional": correo_inst,
        "correo_personal": data.get("Correo Personal", "").strip(),
        "facultad": facultad,
        "escuela": escuela,
        "domicilio": data.get("Domicilio", "").strip(),
        "fecha_ingreso": data.get("Fecha de Ingreso", "").strip(),
        "curricula": data.get("Curricula", "").strip(),
        "raw": data,
    }
