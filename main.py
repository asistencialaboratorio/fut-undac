#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FUT-UNDAC CLI — Asistente para generar el Formulario Único de Trámite
de la Universidad Nacional Daniel Alcides Carrión.

Uso:
    python main.py                      Inicia el wizard interactivo (modo asistido)
    python main.py wizard               Igual que el anterior, explícito
    python main.py dsl archivo.fut      Modo experto: procesa un archivo DSL
    python main.py dsl --inline         Modo experto: pega el DSL directamente en la terminal
    python main.py dsl --ejemplo        Muestra un ejemplo de sintaxis DSL
    python main.py listar               Lista los trámites disponibles
    python main.py perfiles             Lista los perfiles guardados localmente
    python main.py plantilla            Configura encabezado/pie de página (vista previa en vivo)
"""

import argparse
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Confirm
from rich import box

from core.wizard import ejecutar_wizard
from core.modo_experto import (
    procesar_dsl_texto, ejecutar_modo_experto_desde_archivo,
    mostrar_ayuda_dsl,
)
from core.dsl import DSLError
from core.catalogo import listar_tramites
from core.generador import generar_documentos, GeneracionError
from core import perfil as perfil_mod
from core import campos as campos_mod
from core import plantilla_cli

console = Console()


def _mostrar_resumen_fut(fut):
    tabla = Table(box=box.SIMPLE, show_header=False)
    tabla.add_column("Campo", style="bold")
    tabla.add_column("Valor")
    tabla.add_row("Trámite", fut.tramite_nombre)
    tabla.add_row("Solicito", fut.solicito)
    tabla.add_row("Nombres y apellidos", fut.nombres_apellidos)
    tabla.add_row("DNI", fut.dni)
    tabla.add_row("Código", fut.codigo)
    tabla.add_row("Facultad", fut.facultad)
    tabla.add_row("Escuela", fut.escuela)
    console.print(Panel(tabla, title="Resumen del FUT a generar", border_style="cyan"))
    console.print()
    console.print(Panel(fut.fundamentacion, title="Fundamentación del pedido", border_style="green"))


def _preguntar_formato():
    console.print()
    formato = console.input(
        "[bold cyan]¿Qué formato deseas generar?[/bold cyan] "
        "[dim](docx / pdf / ambos)[/dim] [default: ambos]: "
    ).strip().lower() or "ambos"
    if formato == "docx":
        return ("docx",)
    if formato == "pdf":
        return ("pdf",)
    return ("docx", "pdf")


def _generar_y_mostrar(fut):
    _mostrar_resumen_fut(fut)
    formatos = _preguntar_formato()
    console.print("[dim]Generando documento(s)...[/dim]")
    try:
        salida = generar_documentos(fut, formatos=formatos)
    except GeneracionError as e:
        console.print(f"[red]✗ Error al generar el documento: {e}[/red]")
        sys.exit(1)

    console.print()
    console.print(Panel.fit("[bold green]✓ Documento(s) generado(s) con éxito[/bold green]", border_style="green"))
    if salida.get("docx"):
        console.print(f"  Word: {salida['docx']}")
    if salida.get("pdf"):
        console.print(f"  PDF:  {salida['pdf']}")
    return salida


def cmd_wizard(args):
    fut = ejecutar_wizard()
    _generar_y_mostrar(fut)


def cmd_dsl(args):
    if args.ejemplo:
        mostrar_ayuda_dsl()
        return

    if args.inline:
        console.print(Panel.fit(
            "[bold]Pega tu DSL[/bold] (línea vacía + 'FIN' para terminar):",
            border_style="cyan"
        ))
        lineas = []
        while True:
            linea = sys.stdin.readline()
            if not linea:
                break
            if linea.strip() == "FIN":
                break
            lineas.append(linea.rstrip("\n"))
        texto = "\n".join(lineas)
    elif args.archivo:
        ruta = Path(args.archivo)
        if not ruta.exists():
            console.print(f"[red]✗ Archivo no encontrado: {args.archivo}[/red]")
            sys.exit(1)
        texto = ruta.read_text(encoding="utf-8")
    else:
        console.print("[yellow]Debes indicar un archivo, usar --inline, o --ejemplo. "
                       "Usa -h para ayuda.[/yellow]")
        sys.exit(1)

    try:
        fut, errores = procesar_dsl_texto(texto)
    except DSLError as e:
        console.print(f"[red]✗ Error de sintaxis DSL:[/red]\n{e}")
        sys.exit(1)

    if errores:
        console.print(Panel.fit(
            "\n".join(f"• {e}" for e in errores),
            title="[bold red]Faltan datos / errores de validación[/bold red]",
            border_style="red"
        ))
        continuar = Confirm.ask("¿Deseas generar el documento de todas formas (con espacios en blanco)?", default=False)
        if not continuar:
            sys.exit(1)

    _generar_y_mostrar(fut)


def cmd_listar(args):
    tabla = Table(box=box.SIMPLE, show_header=True, header_style="bold cyan", title="Trámites disponibles")
    tabla.add_column("Clave", style="green")
    tabla.add_column("Nombre")
    for clave, nombre in listar_tramites():
        tabla.add_row(clave, nombre)
    console.print(tabla)


def cmd_campos_listar(args):
    tabla = Table(box=box.SIMPLE, show_header=True, header_style="bold cyan",
                  title="Campos configurados")
    tabla.add_column("Clave interna", style="green")
    tabla.add_column("Etiqueta (lo que ve el usuario)")
    tabla.add_column("Obligatorio")
    tabla.add_column("Alias (modo DSL)")
    for c in campos_mod.cargar_campos():
        tabla.add_row(
            c["clave"], c["etiqueta"],
            "sí" if c["obligatorio"] else "no",
            ", ".join(c.get("alias", [])) or "—",
        )
    console.print(tabla)
    console.print(f"\n[dim]Archivo de configuración: {campos_mod.RUTA_CONFIG}[/dim]")


def cmd_campos_renombrar(args):
    try:
        campo = campos_mod.renombrar_etiqueta(args.clave, args.nueva_etiqueta)
    except campos_mod.CamposError as e:
        console.print(f"[red]✗ {e}[/red]")
        sys.exit(1)
    console.print(
        f"[green]✓[/green] El campo [bold]{campo['clave']}[/bold] ahora se "
        f"muestra como: [bold cyan]\"{campo['etiqueta']}\"[/bold cyan]"
    )


def cmd_campos_alias(args):
    try:
        campo = campos_mod.agregar_alias(args.alias, args.clave)
    except campos_mod.CamposError as e:
        console.print(f"[red]✗ {e}[/red]")
        sys.exit(1)
    console.print(
        f"[green]✓[/green] Ahora en el modo DSL puedes escribir "
        f"[bold cyan]{args.alias.upper()}:[/bold cyan] y equivale a "
        f"[bold]{campo['clave']}[/bold]."
    )


def cmd_campos_quitar_alias(args):
    try:
        clave = campos_mod.quitar_alias(args.alias)
    except campos_mod.CamposError as e:
        console.print(f"[red]✗ {e}[/red]")
        sys.exit(1)
    console.print(f"[green]✓[/green] Alias '{args.alias}' eliminado (era de '{clave}').")


def cmd_campos(args):
    if not args.subaccion:
        console.print("[yellow]Usa: campos listar | renombrar | alias | quitar-alias[/yellow]")
        return
    args.subfunc(args)


def cmd_plantilla_editar(args):
    plantilla_cli.ejecutar_editor_plantilla()


def cmd_plantilla_ver(args):
    plantilla_cli.mostrar_plantilla_actual()


def cmd_plantilla_restaurar(args):
    if Confirm.ask("¿Restaurar la plantilla a los valores de fábrica?", default=False):
        plantilla_cli.restaurar_plantilla_por_defecto()


def cmd_plantilla(args):
    if not args.subaccion:
        # Sin subcomando -> abre directamente el editor interactivo
        cmd_plantilla_editar(args)
        return
    args.subfunc(args)


def cmd_perfiles(args):
    perfiles = perfil_mod.listar_perfiles()
    if not perfiles:
        console.print("[yellow]No hay perfiles guardados todavía.[/yellow]")
        return
    tabla = Table(box=box.SIMPLE, show_header=True, header_style="bold cyan", title="Perfiles guardados")
    tabla.add_column("Código")
    tabla.add_column("Nombre")
    tabla.add_column("Facultad")
    for p in perfiles:
        tabla.add_row(p.get("codigo", ""), p.get("nombres_apellidos", ""), p.get("facultad", ""))
    console.print(tabla)


def main():
    parser = argparse.ArgumentParser(
        prog="fut-undac",
        description="Asistente CLI para generar el Formulario Único de Trámite (FUT) de la UNDAC."
    )
    sub = parser.add_subparsers(dest="comando")

    p_wizard = sub.add_parser("wizard", help="Modo asistido paso a paso (por defecto)")
    p_wizard.set_defaults(func=cmd_wizard)

    p_dsl = sub.add_parser("dsl", help="Modo experto: define el FUT con el mini-lenguaje DSL")
    p_dsl.add_argument("archivo", nargs="?", help="Ruta a un archivo .fut con la sintaxis DSL")
    p_dsl.add_argument("--inline", action="store_true", help="Pegar el DSL directamente en la terminal")
    p_dsl.add_argument("--ejemplo", action="store_true", help="Mostrar un ejemplo de sintaxis DSL")
    p_dsl.set_defaults(func=cmd_dsl)

    p_listar = sub.add_parser("listar", help="Listar los trámites disponibles en el catálogo")
    p_listar.set_defaults(func=cmd_listar)

    p_perfiles = sub.add_parser("perfiles", help="Listar los perfiles guardados localmente")
    p_perfiles.set_defaults(func=cmd_perfiles)

    p_plantilla = sub.add_parser(
        "plantilla",
        help="Configurar encabezado/pie de página del FUT con vista previa en vivo (se guarda como plantilla global)",
    )
    p_plantilla.set_defaults(func=cmd_plantilla)
    sub_plantilla = p_plantilla.add_subparsers(dest="subaccion")

    p_p_editar = sub_plantilla.add_parser(
        "editar", help="Abrir el editor interactivo con vista previa en vivo (por defecto)"
    )
    p_p_editar.set_defaults(subfunc=cmd_plantilla_editar)

    p_p_ver = sub_plantilla.add_parser("ver", help="Mostrar la plantilla guardada actualmente")
    p_p_ver.set_defaults(subfunc=cmd_plantilla_ver)

    p_p_restaurar = sub_plantilla.add_parser("restaurar", help="Volver a los valores de fábrica")
    p_p_restaurar.set_defaults(subfunc=cmd_plantilla_restaurar)

    p_campos = sub.add_parser(
        "campos",
        help="Configurar etiquetas y alias de los campos del formulario (sin editar código)",
    )
    p_campos.set_defaults(func=cmd_campos)
    sub_campos = p_campos.add_subparsers(dest="subaccion")

    p_c_listar = sub_campos.add_parser("listar", help="Mostrar todos los campos configurados")
    p_c_listar.set_defaults(subfunc=cmd_campos_listar)

    p_c_renombrar = sub_campos.add_parser(
        "renombrar",
        help="Cambiar la etiqueta visible de un campo, ej: campos renombrar nombres_apellidos \"Apellidos y Nombres\"",
    )
    p_c_renombrar.add_argument("clave", help="Nombre interno del campo (ver 'campos listar')")
    p_c_renombrar.add_argument("nueva_etiqueta", help="Nuevo texto a mostrar")
    p_c_renombrar.set_defaults(subfunc=cmd_campos_renombrar)

    p_c_alias = sub_campos.add_parser(
        "alias",
        help="Agregar una palabra alternativa aceptada en el modo DSL, ej: campos alias nombre nombres_apellidos",
    )
    p_c_alias.add_argument("alias", help="Palabra alternativa (ej: nombre)")
    p_c_alias.add_argument("clave", help="Campo interno al que apunta (ej: nombres_apellidos)")
    p_c_alias.set_defaults(subfunc=cmd_campos_alias)

    p_c_quitar = sub_campos.add_parser("quitar-alias", help="Eliminar un alias existente")
    p_c_quitar.add_argument("alias")
    p_c_quitar.set_defaults(subfunc=cmd_campos_quitar_alias)

    args = parser.parse_args()

    if not args.comando:
        # Sin subcomando -> wizard por defecto
        cmd_wizard(args)
        return

    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Cancelado por el usuario.[/yellow]")
        sys.exit(130)
