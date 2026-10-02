# -*- coding: utf-8 -*-
"""
Sugerencia de trámite a partir de una descripción libre del estudiante,
SIN usar IA: compara palabras clave contra el nombre/ayuda de cada
trámite del catálogo (más algunos sinónimos comunes), sin llamar a
ningún servicio externo.

Reemplaza la detección que antes hacía AWS Bedrock (core/ia_aws.py),
que dejó de estar disponible/conectada.
"""

import re
import unicodedata

from .catalogo import CATALOGO

# Palabras demasiado comunes en cualquier pedido como para servir de pista
# ("quiero", "necesito", "trámite"...); se ignoran al comparar.
_STOPWORDS = {
    "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o",
    "a", "en", "por", "para", "con", "sin", "que", "mi", "me", "se", "su",
    "del", "al", "es", "soy", "estoy", "quiero", "necesito", "solicito",
    "hacer", "sobre", "como", "quisiera", "favor", "ayuda", "hola",
    "tramite", "fut", "universidad", "undac", "por favor",
}

# Sinónimos/expresiones coloquiales que un estudiante usaría y que no
# aparecen tal cual en el nombre o la ayuda del catálogo.
_KEYWORDS_EXTRA = {
    "constancia_matricula": ["matriculado", "matricula"],
    "constancia_no_adeudar": ["adeudo", "biblioteca", "deuda", "libros"],
    "constancia_egresado": ["egrese", "bachiller", "tercio", "quinto"],
    "traslado_interno": ["cambiarme", "cambio", "carrera"],
    "traslado_externo": ["otra", "vengo"],
    "convalidacion": ["convalidar", "convalidacion", "aprobados"],
    "reserva_matricula": ["congelar", "pausar", "reservar"],
    "rectificacion_notas": ["nota", "notas", "corregir", "equivocada"],
    "carta_presentacion": ["practicas", "empresa"],
    "designacion_supervisor_practicas": ["supervisor", "asesor", "practicas", "aceptacion", "aceptado"],
    "devolucion_documentos": ["devuelvan", "papeles", "documentos"],
    "duplicado_carne": ["perdi", "carnet", "carne"],
    "subsanacion_actas": ["acta", "actas"],
    "exoneracion_primeros_puestos": ["exoneracion", "exonerar", "primeros", "puestos", "comedor", "gratuita", "gratuito"],
}


def _normalizar(texto: str) -> list:
    texto = unicodedata.normalize("NFKD", texto.lower())
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    palabras = re.findall(r"[a-z0-9]+", texto)
    return [p for p in palabras if p not in _STOPWORDS and len(p) > 2]


def _texto_tramite(clave: str, datos: dict) -> str:
    partes = [datos.get("nombre", ""), datos.get("ayuda", "")]
    partes.extend(_KEYWORDS_EXTRA.get(clave, []))
    return " ".join(partes)


def sugerir_tramites(consulta: str, top_n: int = 3) -> list:
    """Devuelve hasta `top_n` trámites [(clave, nombre, score)], ordenados
    de mayor a menor relevancia frente a `consulta`, usando coincidencia
    de palabras clave (sin IA, sin conexión a internet). Lista vacía si
    ninguna palabra de la consulta coincide con ningún trámite conocido
    (por ejemplo, un pedido que no existe en el catálogo de la UNDAC,
    como una solicitud de cambio de asesor)."""
    palabras_consulta = set(_normalizar(consulta))
    if not palabras_consulta:
        return []

    resultados = []
    for clave, datos in CATALOGO.items():
        if clave == "otro":
            continue
        palabras_tramite = set(_normalizar(_texto_tramite(clave, datos)))
        score = len(palabras_consulta & palabras_tramite)
        if score > 0:
            resultados.append((clave, datos["nombre"], score))

    resultados.sort(key=lambda r: r[2], reverse=True)
    return resultados[:top_n]
