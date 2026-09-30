#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_aws.py — Diagnóstico de conexión con AWS Bedrock.

Uso:
    python test_aws.py              # prueba conexión básica
    python test_aws.py tramite      # prueba detección de trámite
    python test_aws.py fund         # prueba generación de fundamentación
    python test_aws.py chat         # prueba el asistente de chat
    python test_aws.py todo         # prueba todo
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))


def print_ok(msg):    print(f"\033[92m✓ {msg}\033[0m")
def print_error(msg): print(f"\033[91m✗ {msg}\033[0m")
def print_info(msg):  print(f"\033[94m→ {msg}\033[0m")
def print_warn(msg):  print(f"\033[93m⚠ {msg}\033[0m")


def test_conexion():
    print("\n" + "="*55)
    print("  TEST 1 — Conexión con AWS Bedrock")
    print("="*55)
    from core.ia_aws import verificar_conexion
    resultado = verificar_conexion()
    if resultado["ok"]:
        print_ok(resultado["mensaje"])
        print_info(f"Modelo: {resultado['modelo']}")
        print_info(f"Respuesta de prueba: {resultado['respuesta_prueba']}")
    else:
        print_error(resultado["mensaje"])
        print()
        print("  Pasos para solucionar:")
        print("  1. Ejecuta: aws configure")
        print("  2. Activa el modelo en: console.aws.amazon.com > Bedrock > Model access")
        print("  3. Asegúrate de estar en la región us-east-1")
    return resultado["ok"]


def test_deteccion():
    print("\n" + "="*55)
    print("  TEST 2 — Detección de trámite desde texto libre")
    print("="*55)
    from core.ia_aws import detectar_tramite

    casos = [
        "necesito un papel que diga que estoy matriculado para pedir una beca",
        "quiero cambiarme de ingeniería civil a sistemas porque me gusta más programar",
        "me robaron el carné universitario y necesito uno nuevo",
    ]

    ok = True
    for texto in casos:
        print(f"\n  Entrada: \"{texto[:60]}...\"" if len(texto) > 60 else f"\n  Entrada: \"{texto}\"")
        try:
            resultado = detectar_tramite(texto)
            print_ok(f"Trámite detectado: {resultado['tramite_nombre']}")
            print_info(f"  Clave: {resultado['tramite_clave']}")
            print_info(f"  Confianza: {resultado['confianza']}")
            print_info(f"  Mensaje: {resultado['mensaje']}")
            if resultado.get("datos_extraidos"):
                print_info(f"  Datos extraídos: {resultado['datos_extraidos']}")
        except Exception as e:
            print_error(str(e))
            ok = False
    return ok


def test_fundamentacion():
    print("\n" + "="*55)
    print("  TEST 3 — Generación de fundamentación con IA")
    print("="*55)
    from core.ia_aws import generar_fundamentacion

    datos = {
        "nombres_apellidos": "QUISPE MAMANI JOSE CARLOS",
        "codigo": "2210089034",
        "escuela": "Ingeniería de Sistemas y Computación",
        "facultad": "Facultad de Ingeniería",
        "periodo": "2026-I",
        "motivo_uso": "postulación a beca universitaria",
    }

    print_info("Generando fundamentación para: constancia_matricula")
    print_info(f"Estudiante: {datos['nombres_apellidos']}")

    try:
        texto = generar_fundamentacion(
            tipo_tramite="constancia_matricula",
            datos_estudiante=datos,
            descripcion_libre="Necesito la constancia para presentarla al programa de becas del PRONABEC"
        )
        print_ok("Fundamentación generada:")
        print()
        print("  " + "\n  ".join(texto.split("\n")))
        print()

        # Verificar que tiene el formato correcto
        if texto.startswith("Que, el suscrito"):
            print_ok("Formato correcto: empieza con 'Que, el suscrito'")
        else:
            print_warn("El texto no empieza con 'Que, el suscrito' — puede necesitar ajuste")

        if "Por lo expuesto" in texto:
            print_ok("Formato correcto: termina con 'Por lo expuesto...'")
        else:
            print_warn("Falta la frase de cierre 'Por lo expuesto...'")

        return True
    except Exception as e:
        print_error(str(e))
        return False


def test_chat():
    print("\n" + "="*55)
    print("  TEST 4 — Chat asistente")
    print("="*55)
    from core.ia_aws import chat_asistente

    preguntas = [
        ("¿Qué documentos necesito para tramitar una constancia de matrícula?",
         "constancia_matricula"),
        ("¿Cuánto tiempo tarda la UNDAC en entregar los documentos?",
         None),
    ]

    ok = True
    historial = []
    for pregunta, tramite in preguntas:
        print(f"\n  Pregunta: \"{pregunta}\"")
        try:
            respuesta = chat_asistente(
                pregunta=pregunta,
                historial=historial,
                tramite_actual=tramite
            )
            print_ok("Respuesta del asistente:")
            print()
            for linea in respuesta.split("\n"):
                print(f"  {linea}")
            print()
            historial.append({"rol": "user", "texto": pregunta})
            historial.append({"rol": "assistant", "texto": respuesta})
        except Exception as e:
            print_error(str(e))
            ok = False
    return ok


def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else "conexion"

    print("\n  FUT-UNDAC — Diagnóstico AWS Bedrock")
    print(f"  Modo: {modo}")

    if modo in ("conexion", "todo"):
        if not test_conexion():
            print("\n  ⚠ Corrige la conexión antes de continuar con los otros tests.")
            if modo != "todo":
                return

    if modo in ("tramite", "todo"):
        test_deteccion()

    if modo in ("fund", "todo"):
        test_fundamentacion()

    if modo in ("chat", "todo"):
        test_chat()

    print("\n" + "="*55)
    print("  Diagnóstico completado.")
    print("  Si todos los tests pasaron, ya puedes usar la IA en la GUI.")
    print("="*55 + "\n")


if __name__ == "__main__":
    main()
