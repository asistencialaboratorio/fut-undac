#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de diagnóstico para probar la conexión a la API de UNDAC desde
tu propia máquina (fuera del sandbox de Claude, que no tiene acceso a
ese dominio).

Uso:
    python test_api.py 2304403050
    python test_api.py              (usa un código de ejemplo)
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from core import api_undac


def main():
    codigo = sys.argv[1] if len(sys.argv) > 1 else "2304403050"

    print(f"Probando conexión a la API de UNDAC...")
    print(f"URL base: {api_undac.BASE_URL}")
    print(f"Código de prueba: {codigo}")
    print("-" * 60)

    try:
        info = api_undac.consultar_estudiante(codigo)
    except api_undac.APIError as e:
        print(f"\n✗ ERROR: {e}\n")
        print("Posibles causas:")
        print("  - Sin conexión a internet o a la red de UNDAC")
        print("  - El servicio de la API está caído")
        print("  - El código de matrícula no existe")
        print("  - Si el error es 403/401: puede requerir estar en la red")
        print("    institucional (VPN/wifi de la universidad) o un token")
        print("    de autenticación que la URL actual no incluye")
        sys.exit(1)

    print("\n✓ CONEXIÓN EXITOSA\n")
    print(f"  Nombre completo:        {info['nombres_apellidos']}")
    print(f"  DNI:                    {info['dni']}")
    print(f"  Facultad/Escuela:       {info['facultad']}")
    print(f"  Domicilio:              {info['domicilio']}")
    print(f"  Fecha de ingreso:       {info['fecha_ingreso']}")
    print(f"  Currícula:              {info['curricula']}")
    print(f"  Correo (¡OJO, es personal, NO institucional!): {info['correo_personal_detectado']}")
    print()
    print("Respuesta cruda de la API:")
    import json
    print(json.dumps(info["raw"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
