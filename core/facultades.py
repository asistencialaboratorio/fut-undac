# -*- coding: utf-8 -*-
"""
Catálogo de facultades y escuelas profesionales de la UNDAC, para
alimentar las listas desplegables de "Facultad" y "Escuela Profesional"
en el formulario (en vez de que el estudiante las escriba a mano).

Los datos viven en data/facultades_undac.json (11 facultades, 21
escuelas profesionales), tomados de la web institucional
(undac.edu.pe/explorar-facultades y la ficha de cada facultad).
"""

import json
import sys
from pathlib import Path


def _dir_data() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / "data"
    return Path(__file__).resolve().parent.parent / "data"


RUTA_FACULTADES = _dir_data() / "facultades_undac.json"

_cache = None


def _cargar() -> list:
    global _cache
    if _cache is None:
        try:
            with open(RUTA_FACULTADES, "r", encoding="utf-8") as f:
                _cache = json.load(f).get("facultades", [])
        except (OSError, json.JSONDecodeError):
            _cache = []
    return _cache


def listar_facultades() -> list:
    """Nombres de las 11 facultades, en el orden oficial de la UNDAC."""
    return [f["facultad"] for f in _cargar()]


def listar_escuelas(facultad: str = None) -> list:
    """Escuelas profesionales de `facultad`. Sin argumento, devuelve
    todas las escuelas de todas las facultades (lista plana, sin
    duplicados, para autocompletar antes de elegir facultad)."""
    facultades = _cargar()
    if facultad:
        for f in facultades:
            if f["facultad"] == facultad:
                return list(f["escuelas"])
        return []
    vistas = []
    for f in facultades:
        for e in f["escuelas"]:
            if e not in vistas:
                vistas.append(e)
    return vistas


def facultad_de_escuela(escuela: str) -> str:
    """Devuelve el nombre de la facultad a la que pertenece `escuela`,
    o cadena vacía si no se encuentra en el catálogo."""
    for f in _cargar():
        if escuela in f["escuelas"]:
            return f["facultad"]
    return ""
