#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FUT-UNDAC — Interfaz Gráfica v2
Diseño moderno con sidebar, cards con sombra y experiencia fluida.
"""

import sys, os, shutil, threading, subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from PIL import Image, ImageTk, ImageDraw, ImageFilter

from core.catalogo import CATALOGO, obtener_tramite
from core.constructor import construir_fut, campos_faltantes_en_texto
from core.modelo import validar_campo, ValidationError
from core.generador import generar_documentos, GeneracionError
from core import api_undac
from core import plantilla as plantilla_mod
from core.facultades import listar_facultades, listar_escuelas
from core.sugeridor import sugerir_tramites

# IA AWS — import opcional: solo se usa como ayuda extra para redactar la
# fundamentación (botón "Generar con IA"). Si boto3 no está instalado o no
# hay credenciales, la GUI sigue funcionando normalmente sin esa ayuda.
try:
    from core.ia_aws import generar_fundamentacion, BedrockError
    IA_DISPONIBLE = True
except ImportError:
    IA_DISPONIBLE = False
    BedrockError = Exception

# ══════════════════════════════════════════════════════════════
# PALETA DE COLORES — Diseño moderno UNDAC
# ══════════════════════════════════════════════════════════════
# Sidebar oscuro
SB_BG       = "#0a1628"   # fondo sidebar muy oscuro
SB_HOVER    = "#162040"   # hover sidebar
SB_ACTIVE   = "#1e3560"   # activo sidebar
SB_BORDER   = "#1a2e50"   # borde sidebar
SB_TEXT     = "#8aa4c8"   # texto sidebar inactivo
SB_TEXT_ACT = "#ffffff"   # texto sidebar activo
SB_ACCENT   = "#c9a227"   # dorado — acento principal

# Área de contenido
BG_MAIN     = "#f0f4fb"   # fondo contenido
BG_CARD     = "#ffffff"   # fondo tarjeta
BG_INPUT    = "#f8faff"   # fondo input
BG_HEADER   = "#ffffff"   # fondo header de sección

# Colores de acción
C_AZUL      = "#1a56db"   # botón primario
C_AZUL_H    = "#1343b0"   # hover primario
C_AZUL_OSC  = "#003087"   # azul UNDAC oscuro
C_DORADO    = "#c9a227"   # acento dorado
C_DORADO_H  = "#a88020"   # hover dorado
C_VERDE     = "#057a55"   # éxito
C_VERDE_BG  = "#ecfdf5"   # fondo éxito
C_ROJO      = "#dc2626"   # error
C_ROJO_BG   = "#fef2f2"   # fondo error
C_NARANJA   = "#d97706"   # advertencia
C_NARANJA_BG= "#fffbeb"   # fondo advertencia

# Textos y bordes
T_TITULO    = "#0f172a"   # título principal
T_CUERPO    = "#374151"   # texto cuerpo
T_SUAVE     = "#6b7280"   # texto secundario
T_HINT      = "#9ca3af"   # placeholder / hint
B_DEFAULT   = "#e5e7eb"   # borde default
B_FOCUS     = "#1a56db"   # borde focus
B_CARD      = "#e8edf5"   # borde tarjeta

# Fuentes
def F(size, weight="normal"):
    return ("Segoe UI", size, weight)

F_DISPLAY   = F(22, "bold")
F_H1        = F(16, "bold")
F_H2        = F(13, "bold")
F_H3        = F(11, "bold")
F_BODY      = F(10)
F_SMALL     = F(9)
F_MONO      = ("Consolas", 10)
F_ICON      = F(20)

ICONOS = {
    "constancia_matricula":    "📋",
    "constancia_no_adeudar":   "✅",
    "constancia_egresado":     "🎓",
    "traslado_interno":        "🔄",
    "traslado_externo":        "🚀",
    "convalidacion":           "📚",
    "reserva_matricula":       "📅",
    "rectificacion_notas":     "✏️",
    "carta_presentacion":      "📄",
    "designacion_supervisor_practicas": "🧑‍🏫",
    "devolucion_documentos":   "📦",
    "duplicado_carne":         "🪪",
    "subsanacion_actas":       "📝",
    "exoneracion_primeros_puestos": "🏆",
    "otro":                    "⚙️",
}

# Las etiquetas y el orden de los campos ya NO están hardcodeados aquí:
# se leen de data/campos_config.json, que se edita con
# `python main.py campos ...` (sin tocar este archivo).
from core.campos import campos_config_gui as _campos_config_gui

CAMPOS_CONFIG = [
    fila for fila in _campos_config_gui()
    if fila[0] != "fundamentacion"  # la fundamentación tiene su propia pantalla
]

FRECUENTES = ["constancia_matricula", "constancia_no_adeudar",
              "carta_presentacion", "constancia_egresado",
              "traslado_interno", "convalidacion"]


# ══════════════════════════════════════════════════════════════
# UTILIDADES DE IMAGEN
# ══════════════════════════════════════════════════════════════
def make_rounded_image(img: Image.Image, radius=12) -> Image.Image:
    """Aplica bordes redondeados a una imagen PIL."""
    mask = Image.new("L", img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, img.size[0]-1, img.size[1]-1],
                           radius=radius, fill=255)
    result = img.copy().convert("RGBA")
    result.putalpha(mask)
    return result


# ══════════════════════════════════════════════════════════════
# WIDGETS PERSONALIZADOS
# ══════════════════════════════════════════════════════════════

class ModernButton(tk.Frame):
    """Botón moderno con bordes redondeados simulados y estados hover/press."""
    def __init__(self, parent, text="", command=None, style="primary",
                 icon="", width=None, **kw):
        super().__init__(parent, bg=parent.cget("bg"), cursor="hand2")
        self.command = command

        styles = {
            "primary":   (C_AZUL,    C_AZUL_H,   "#ffffff"),
            "secondary": (BG_CARD,   BG_INPUT,    T_CUERPO),
            "gold":      (C_DORADO,  C_DORADO_H,  "#ffffff"),
            "danger":    (C_ROJO,    "#b91c1c",   "#ffffff"),
            "ghost":     (BG_MAIN,   B_DEFAULT,   T_CUERPO),
            "success":   (C_VERDE,   "#065f46",   "#ffffff"),
        }
        self._bg, self._bg_h, self._fg = styles.get(style, styles["primary"])

        label_text = f"{icon}  {text}" if icon else text
        self._lbl = tk.Label(self, text=label_text,
                             font=F_H3, bg=self._bg, fg=self._fg,
                             padx=18, pady=9,
                             highlightbackground=B_DEFAULT if style == "secondary" else self._bg,
                             highlightthickness=1 if style == "secondary" else 0)
        if width:
            self._lbl.config(width=width)
        self._lbl.pack(fill="both", expand=True)
        self.config(bg=self._bg)

        for w in (self, self._lbl):
            w.bind("<Enter>",    self._on_enter)
            w.bind("<Leave>",    self._on_leave)
            w.bind("<Button-1>", self._on_click)
            w.bind("<ButtonRelease-1>", self._on_release)

    def _on_enter(self, e):
        self._lbl.config(bg=self._bg_h)
        self.config(bg=self._bg_h)

    def _on_leave(self, e):
        self._lbl.config(bg=self._bg)
        self.config(bg=self._bg)

    def _on_click(self, e):
        self._lbl.config(bg=self._bg_h)

    def _on_release(self, e):
        self._lbl.config(bg=self._bg_h)
        if self.command:
            self.command()

    def config_state(self, enabled: bool):
        state = "normal" if enabled else "disabled"
        self._lbl.config(state=state)


class ModernEntry(tk.Frame):
    """Campo de entrada estilizado con etiqueta, hint y validación visual."""
    def __init__(self, parent, clave, etiqueta, obligatorio=True,
                 ejemplo="", validador_key=None, ayuda="", valores=None, **kw):
        super().__init__(parent, bg=BG_MAIN)
        self.clave = clave
        self.obligatorio = obligatorio
        self.validador_key = validador_key
        self.var = tk.StringVar()
        self._valid = None

        # Campos que NO deben ir en mayúsculas
        NO_MAYUSC = {"correo", "fundamentacion", "anexo"}
        self._auto_mayusc = clave not in NO_MAYUSC and validador_key not in {"correo"}

        # Etiqueta
        row_lbl = tk.Frame(self, bg=BG_MAIN)
        row_lbl.pack(fill="x", pady=(0, 2))

        lbl_text = etiqueta + (" *" if obligatorio else "")
        tk.Label(row_lbl, text=lbl_text,
                 font=F(9, "bold"), bg=BG_MAIN,
                 fg=T_TITULO if obligatorio else T_SUAVE).pack(side="left")

        self._lbl_estado = tk.Label(row_lbl, text="", font=F_SMALL,
                                    bg=BG_MAIN)
        self._lbl_estado.pack(side="right")

        # Borde del campo (simula borde redondeado con frame)
        self._border = tk.Frame(self, bg=B_DEFAULT,
                                highlightbackground=B_DEFAULT,
                                highlightthickness=0, padx=1, pady=1)
        self._border.pack(fill="x")

        self._inner = tk.Frame(self._border, bg=BG_CARD)
        self._inner.pack(fill="x")

        self.entry = tk.Entry(self._inner, textvariable=self.var,
                              font=F_BODY, bg=BG_CARD, fg=T_TITULO,
                              relief="flat", bd=0,
                              insertbackground=C_AZUL)
        self.entry.pack(fill="x", padx=10, pady=8)

        # Hint
        if ayuda or ejemplo:
            tk.Label(self, text=ayuda or f"Ej: {ejemplo}",
                     font=F_SMALL, bg=BG_MAIN, fg=T_HINT,
                     anchor="w").pack(fill="x", pady=(2, 0))

        self.entry.bind("<FocusIn>",  self._on_focus)
        self.entry.bind("<FocusOut>", self._on_blur)
        self.var.trace_add("write", self._on_write)

        # Sugerencias (p.ej. Facultad/Escuela de la UNDAC): el campo sigue
        # siendo texto libre (editable), pero muestra una lista para elegir.
        # Se usa una Toplevel posicionada a mano (no ttk.Combobox) porque su
        # desplegable interno queda mal ubicado cuando el campo está dentro
        # de un Canvas con scroll (como el formulario), abriéndose lejos de
        # donde está el campo.
        self._valores_todas = list(valores) if valores else None
        self._popup = None
        self._listbox = None
        if self._valores_todas is not None:
            self.entry.bind("<KeyRelease>", self._on_key_sugerencias, add="+")
            self.entry.bind("<FocusIn>", self._mostrar_sugerencias, add="+")
            self.entry.bind("<Down>", self._foco_listbox, add="+")
            self.entry.bind("<Escape>", lambda e: self._ocultar_sugerencias(), add="+")
            self.bind("<Destroy>", lambda e: self._ocultar_sugerencias())

    def _on_write(self, *a):
        if self._auto_mayusc:
            val = self.var.get()
            upper = val.upper()
            if val != upper:
                pos = self.entry.index("insert")
                self.var.set(upper)
                try:
                    self.entry.icursor(pos)
                except Exception:
                    pass
        self._validate()

    def _on_focus(self, e):
        self._border.config(bg=B_FOCUS)
        self._inner.config(bg=BG_CARD)

    def _on_blur(self, e):
        self._validate()
        color = (C_VERDE if self._valid is True
                 else C_ROJO if self._valid is False
                 else B_DEFAULT)
        self._border.config(bg=color)
        if self._valores_todas is not None:
            # Delay corto: si el foco se fue porque el usuario hizo clic en
            # la lista de sugerencias, deja que ese clic se procese antes
            # de ocultarla (si no, se oculta antes de registrar el clic).
            self.after(150, self._ocultar_si_perdio_foco)

    def _ocultar_si_perdio_foco(self):
        try:
            foco = self.focus_get()
        except Exception:
            foco = None
        if foco is not self.entry and foco is not self._listbox:
            self._ocultar_sugerencias()

    def _validate(self):
        v = self.var.get().strip()
        if not v:
            self._valid = None
            self._lbl_estado.config(text="")
            return
        if self.validador_key:
            try:
                validar_campo(self.validador_key, v)
                self._valid = True
                self._lbl_estado.config(text="✓", fg=C_VERDE)
            except ValidationError as e:
                self._valid = False
                self._lbl_estado.config(text=str(e), fg=C_ROJO)
        else:
            self._valid = True
            self._lbl_estado.config(text="✓", fg=C_VERDE)

    def get(self): return self.var.get().strip()
    def set(self, v): self.var.set(v)

    def set_valores(self, valores):
        """Actualiza las opciones de un campo creado con `valores=...`
        (usado para filtrar Escuela Profesional según la Facultad elegida)."""
        self._valores_todas = list(valores)

    # ── Sugerencias tipo autocompletar (Toplevel posicionado a mano) ──

    def _filtrar_sugerencias(self):
        texto = self.get().lower()
        if not texto:
            return self._valores_todas
        return [v for v in self._valores_todas if texto in v.lower()] or self._valores_todas

    def _mostrar_sugerencias(self, e=None):
        if not self._valores_todas:
            return
        opciones = self._filtrar_sugerencias()
        if not opciones:
            self._ocultar_sugerencias()
            return
        if self._popup is None:
            self._popup = tk.Toplevel(self)
            self._popup.withdraw()
            self._popup.overrideredirect(True)
            try:
                self._popup.attributes("-topmost", True)
            except Exception:
                pass
            self._listbox = tk.Listbox(
                self._popup, font=F_BODY, activestyle="none",
                relief="flat", highlightthickness=1,
                highlightbackground=B_FOCUS, bg=BG_CARD, fg=T_TITULO,
                selectbackground=C_AZUL, selectforeground="white")
            self._listbox.pack(fill="both", expand=True)
            self._listbox.bind("<<ListboxSelect>>", self._al_elegir_sugerencia)
            self._listbox.bind("<Return>", self._al_elegir_sugerencia)
            self._listbox.bind("<Escape>", lambda e: self._ocultar_sugerencias())
            self._listbox.bind("<FocusOut>", lambda e: self.after(150, self._ocultar_si_perdio_foco))

        self._listbox.delete(0, "end")
        for op in opciones:
            self._listbox.insert("end", op)

        x = self.entry.winfo_rootx()
        y = self.entry.winfo_rooty() + self.entry.winfo_height()
        ancho = max(self.entry.winfo_width(), 180)
        alto = min(len(opciones), 8) * 21 + 4
        self._popup.geometry(f"{ancho}x{alto}+{x}+{y}")
        self._popup.deiconify()
        self._popup.lift()

    def _ocultar_sugerencias(self):
        if self._popup is not None:
            try:
                self._popup.withdraw()
            except Exception:
                pass

    def _on_key_sugerencias(self, e):
        if e.keysym in ("Up", "Down", "Return", "Escape"):
            return
        self._mostrar_sugerencias()

    def _foco_listbox(self, e):
        if self._popup is not None and self._popup.winfo_viewable():
            self._listbox.focus_set()
            if not self._listbox.curselection():
                self._listbox.selection_set(0)
            return "break"

    def _al_elegir_sugerencia(self, e):
        if not self._listbox.curselection():
            return
        valor = self._listbox.get(self._listbox.curselection()[0])
        self.var.set(valor)
        self._ocultar_sugerencias()
        self.entry.focus_set()
        self.entry.icursor("end")
        self.entry.event_generate("<<ValoresSeleccionados>>")

    def is_valid(self):
        v = self.get()
        if self.obligatorio and not v:
            self._border.config(bg=C_ROJO)
            self._lbl_estado.config(text="Obligatorio", fg=C_ROJO)
            return False
        if v and self.validador_key:
            try:
                validar_campo(self.validador_key, v)
                return True
            except ValidationError as e:
                self._lbl_estado.config(text=str(e), fg=C_ROJO)
                return False
        return True


class TarjetaTramite(tk.Frame):
    """Card moderno para un trámite con ícono, título y estado hover animado."""
    def __init__(self, parent, clave, nombre, icono, callback, es_frecuente=False):
        super().__init__(parent, bg=BG_CARD, cursor="hand2",
                         highlightbackground=B_CARD, highlightthickness=1)
        self.clave = clave
        self.callback = callback
        self._hovered = False

        # Barra de color lateral (dorado para frecuentes, azul para resto)
        color_barra = C_DORADO if es_frecuente else C_AZUL_OSC
        barra = tk.Frame(self, bg=color_barra, width=4)
        barra.pack(side="left", fill="y")

        cuerpo = tk.Frame(self, bg=BG_CARD, padx=14, pady=12)
        cuerpo.pack(side="left", fill="both", expand=True)

        # Ícono + badge frecuente
        fila_top = tk.Frame(cuerpo, bg=BG_CARD)
        fila_top.pack(fill="x")

        tk.Label(fila_top, text=icono, font=("Segoe UI", 18),
                 bg=BG_CARD, fg=T_TITULO).pack(side="left")

        if es_frecuente:
            badge = tk.Label(fila_top, text=" ★ Frecuente ",
                             font=F(8, "bold"), bg="#fef3c7",
                             fg="#92400e", padx=4, pady=1)
            badge.pack(side="right")

        tk.Label(cuerpo, text=nombre,
                 font=F(10, "bold"), bg=BG_CARD, fg=T_TITULO,
                 wraplength=185, justify="left",
                 anchor="w").pack(fill="x", pady=(6, 0))

        flecha = tk.Label(cuerpo, text="→", font=F(11, "bold"),
                          bg=BG_CARD, fg=T_HINT, anchor="e")
        flecha.pack(fill="x", pady=(4, 0))
        self._flecha = flecha
        self._barra = barra
        self._cuerpo = cuerpo
        self._color_barra = color_barra

        todos = [self, barra, cuerpo, fila_top, flecha] + fila_top.winfo_children() + cuerpo.winfo_children()
        for w in todos:
            w.bind("<Button-1>", self._click)
            w.bind("<Enter>",    self._enter)
            w.bind("<Leave>",    self._leave)

    def _click(self, e): self.callback(self.clave)

    def _enter(self, e):
        self._set_all_bg("#eef2ff")
        self._flecha.config(fg=C_AZUL)
        self.config(highlightbackground=C_AZUL)

    def _leave(self, e):
        self._set_all_bg(BG_CARD)
        self._flecha.config(fg=T_HINT)
        self.config(highlightbackground=B_CARD)
        self._barra.config(bg=self._color_barra)

    def _set_all_bg(self, color):
        try:
            for w in self.winfo_children():
                if w != self._barra:
                    w.config(bg=color)
                    for c in w.winfo_children():
                        try: c.config(bg=color)
                        except: pass
        except: pass


class SidebarBtn(tk.Frame):
    """Botón de la sidebar con ícono y texto."""
    def __init__(self, parent, icon, text, command, active=False):
        super().__init__(parent, bg=SB_BG, cursor="hand2")
        self.command = command
        self._active = active

        self._frame = tk.Frame(self, bg=SB_ACTIVE if active else SB_BG,
                               padx=16, pady=10)
        self._frame.pack(fill="x")

        left = tk.Frame(self._frame, bg=self._frame.cget("bg"))
        left.pack(side="left")

        tk.Label(left, text=icon, font=("Segoe UI", 13),
                 bg=self._frame.cget("bg"),
                 fg=SB_TEXT_ACT if active else SB_TEXT).pack(side="left")
        self._lbl = tk.Label(left, text=" " + text,
                             font=F(10, "bold" if active else "normal"),
                             bg=self._frame.cget("bg"),
                             fg=SB_TEXT_ACT if active else SB_TEXT)
        self._lbl.pack(side="left")

        if active:
            accent = tk.Frame(self._frame, bg=SB_ACCENT, width=3)
            accent.pack(side="right", fill="y")

        for w in [self, self._frame, left] + left.winfo_children():
            w.bind("<Button-1>", self._click)
            w.bind("<Enter>",    self._enter)
            w.bind("<Leave>",    self._leave)

    def _click(self, e):
        if self.command: self.command()

    def _enter(self, e):
        if not self._active:
            try:
                self._frame.config(bg=SB_HOVER)
                for w in self._frame.winfo_children():
                    try:
                        w.config(bg=SB_HOVER)
                        for c in w.winfo_children():
                            try: c.config(bg=SB_HOVER)
                            except Exception: pass
                    except Exception: pass
            except Exception: pass

    def _leave(self, e):
        if not self._active:
            try:
                bg = SB_BG
                self._frame.config(bg=bg)
                for w in self._frame.winfo_children():
                    try:
                        w.config(bg=bg)
                        for c in w.winfo_children():
                            try: c.config(bg=bg)
                            except Exception: pass
                    except Exception: pass
            except Exception: pass


class Badge(tk.Label):
    def __init__(self, parent, text, color=C_AZUL, bg=BG_MAIN, **kw):
        super().__init__(parent, text=text,
                         font=F(8, "bold"),
                         fg="white", bg=color,
                         padx=6, pady=2, **kw)


class DividerLabel(tk.Frame):
    """Separador con texto centrado tipo sección."""
    def __init__(self, parent, text, bg=BG_MAIN):
        super().__init__(parent, bg=bg)
        tk.Frame(self, bg=B_DEFAULT, height=1).pack(
            side="left", fill="x", expand=True, padx=(0, 10), pady=10)
        tk.Label(self, text=text, font=F(9, "bold"),
                 bg=bg, fg=T_SUAVE).pack(side="left")
        tk.Frame(self, bg=B_DEFAULT, height=1).pack(
            side="left", fill="x", expand=True, padx=(10, 0), pady=10)


def make_scrollable(parent, bg=BG_MAIN):
    """Retorna (canvas, inner_frame) con scroll vertical."""
    wrap = tk.Frame(parent, bg=bg)
    wrap.pack(fill="both", expand=True)

    canvas = tk.Canvas(wrap, bg=bg, highlightthickness=0, bd=0)
    sb = ttk.Scrollbar(wrap, orient="vertical", command=canvas.yview)
    canvas.configure(yscrollcommand=sb.set)

    sb.pack(side="right", fill="y")
    canvas.pack(side="left", fill="both", expand=True)

    inner = tk.Frame(canvas, bg=bg)
    cw = canvas.create_window((0, 0), window=inner, anchor="nw")

    canvas.bind("<Configure>",
                lambda e: canvas.itemconfig(cw, width=e.width))
    inner.bind("<Configure>",
               lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
    canvas.bind_all("<MouseWheel>",
                    lambda e: canvas.yview_scroll(-1*(e.delta//120), "units"))
    return canvas, inner


# ══════════════════════════════════════════════════════════════
# APLICACIÓN PRINCIPAL
# ══════════════════════════════════════════════════════════════
class AppFUT(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("FUT-UNDAC")
        self.geometry("1060x700")
        self.minsize(900, 600)
        self.configure(bg=SB_BG)

        # Centrar
        self.update_idletasks()
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"1060x700+{(sw-1060)//2}+{(sh-700)//2}")

        # Icono de ventana
        try:
            self.iconbitmap(default="")
        except Exception:
            pass

        self.datos_sesion = {}
        self.tramite_actual = None
        self.fut_generado = None
        self._campos_widgets = {}
        self._pantalla_actual = "inicio"
        # Widgets dinámicos — inicializar a None
        self._btn_gen = None
        self._progress_gen = None
        self._lbl_gen_est = None
        self._var_docx = tk.BooleanVar(value=True)
        self._var_pdf = tk.BooleanVar(value=True)
        self._txt_fund = None
        self._lbl_api = None
        self._var_cod_api = tk.StringVar()
        self._var_anexo = tk.StringVar()

        # Logo
        self._logo_img = None
        logo_path = SCRIPT_DIR / "data" / "undac_logo.jpg"
        if logo_path.exists():
            img = Image.open(logo_path).convert("RGBA").resize((40, 47), Image.LANCZOS)
            self._logo_img = ImageTk.PhotoImage(img)

        self._construir_layout()
        self._mostrar_inicio()

    # ── Layout base: sidebar + contenido ────────────────────
    def _construir_layout(self):
        # Sidebar fija
        self.sidebar = tk.Frame(self, bg=SB_BG, width=220)
        self.sidebar.pack(side="left", fill="y")
        self.sidebar.pack_propagate(False)

        # Logo + nombre en sidebar
        hdr_sb = tk.Frame(self.sidebar, bg=SB_BG, pady=20, padx=16)
        hdr_sb.pack(fill="x")
        if self._logo_img:
            tk.Label(hdr_sb, image=self._logo_img,
                     bg=SB_BG).pack(side="left", padx=(0, 10))
        txt_frame = tk.Frame(hdr_sb, bg=SB_BG)
        txt_frame.pack(side="left")
        tk.Label(txt_frame, text="FUT-UNDAC",
                 font=F(13, "bold"), bg=SB_BG, fg=SB_TEXT_ACT).pack(anchor="w")
        tk.Label(txt_frame, text="Formulario Único\nde Trámite",
                 font=F(8), bg=SB_BG, fg=SB_TEXT,
                 justify="left").pack(anchor="w")

        # Línea divisoria
        tk.Frame(self.sidebar, bg=SB_BORDER, height=1).pack(fill="x", padx=12)

        # Menú de navegación
        nav_lbl = tk.Label(self.sidebar, text="MENÚ",
                           font=F(8, "bold"), bg=SB_BG, fg=SB_TEXT,
                           padx=16, pady=8)
        nav_lbl.pack(anchor="w", pady=(12, 4))

        self._nav_btns = {}
        nav_items = [
            ("inicio",    "🏠", "Inicio"),
            ("tramites",  "📋", "Mis Trámites"),
        ]
        for clave, icon, label in nav_items:
            btn = SidebarBtn(self.sidebar, icon, label,
                             command=lambda c=clave: self._nav(c),
                             active=(clave == "inicio"))
            btn.pack(fill="x")
            self._nav_btns[clave] = btn

        # Espaciador
        tk.Frame(self.sidebar, bg=SB_BG).pack(fill="both", expand=True)

        # Pie de sidebar
        pie = tk.Frame(self.sidebar, bg=SB_BG, pady=12, padx=16)
        pie.pack(fill="x")
        tk.Frame(pie, bg=SB_BORDER, height=1).pack(fill="x", pady=(0, 8))
        self._lbl_pie_sidebar = tk.Label(
            pie, text=self._texto_pie_sidebar(),
            font=F_SMALL, bg=SB_BG, fg=SB_TEXT)
        self._lbl_pie_sidebar.pack(anchor="w")

        # Área de contenido principal
        self.main = tk.Frame(self, bg=BG_MAIN)
        self.main.pack(side="left", fill="both", expand=True)

    def _nav(self, clave):
        # Actualizar estados de botones sidebar
        for k, btn in self._nav_btns.items():
            bg = SB_ACTIVE if k == clave else SB_BG
            btn._frame.config(bg=bg)
            for w in btn._frame.winfo_children():
                try:
                    w.config(bg=bg)
                    for c in w.winfo_children():
                        try: c.config(bg=bg)
                        except: pass
                except: pass
        self._pantalla_actual = clave
        {"inicio": self._mostrar_inicio,
         "tramites": self._mostrar_inicio,
         }.get(clave, self._mostrar_inicio)()

    def _texto_pie_sidebar(self) -> str:
        anio = plantilla_mod.obtener_plantilla().get("anio_periodo", "")
        return f"v2.0 — UNDAC {anio}".strip()

    def _limpiar_main(self):
        for w in self.main.winfo_children():
            w.destroy()

    def _header_seccion(self, titulo, subtitulo="", btn_label=None, btn_cmd=None):
        """Barra de encabezado de sección con título, subtítulo y botón opcional."""
        hdr = tk.Frame(self.main, bg=BG_HEADER,
                       highlightbackground=B_DEFAULT, highlightthickness=0)
        hdr.pack(fill="x")

        # Línea de color arriba
        tk.Frame(hdr, bg=C_AZUL_OSC, height=3).pack(fill="x")

        contenido = tk.Frame(hdr, bg=BG_HEADER, padx=24, pady=14)
        contenido.pack(fill="x")

        texto = tk.Frame(contenido, bg=BG_HEADER)
        texto.pack(side="left")
        tk.Label(texto, text=titulo, font=F_H1,
                 bg=BG_HEADER, fg=T_TITULO).pack(anchor="w")
        if subtitulo:
            tk.Label(texto, text=subtitulo, font=F_SMALL,
                     bg=BG_HEADER, fg=T_SUAVE).pack(anchor="w", pady=(2, 0))

        if btn_label and btn_cmd:
            ModernButton(contenido, text=btn_label, command=btn_cmd,
                         style="secondary").pack(side="right")
        return hdr

    # ══════════════════════════════════════════════════════════
    # PANTALLA 1: INICIO / Selección de trámite
    # ══════════════════════════════════════════════════════════
    def _mostrar_inicio(self):
        self._limpiar_main()
        self.tramite_actual = None

        # Header
        self._header_seccion("¿Qué trámite necesitas hoy?",
                             "Selecciona el tipo de documento que deseas generar")

        _, inner = make_scrollable(self.main)
        inner.config(padx=24, pady=20)

        # ── Búsqueda rápida (por palabras clave, sin IA) ──
        search_frame = tk.Frame(inner, bg=BG_CARD,
                                highlightbackground=B_DEFAULT, highlightthickness=1)
        search_frame.pack(fill="x", pady=(0, 20))
        search_inner = tk.Frame(search_frame, bg=BG_CARD, padx=12, pady=8)
        search_inner.pack(fill="x")

        # Fila 1: búsqueda normal
        fila_s = tk.Frame(search_inner, bg=BG_CARD)
        fila_s.pack(fill="x")
        tk.Label(fila_s, text="🔍", font=F(11), bg=BG_CARD,
                 fg=T_SUAVE).pack(side="left", padx=(0, 6))
        self._var_busqueda = tk.StringVar()
        entry_busq = tk.Entry(fila_s, textvariable=self._var_busqueda,
                              font=F_BODY, bg=BG_CARD, fg=T_TITULO,
                              relief="flat", bd=0,
                              insertbackground=C_AZUL)
        HINT_BUSQ = "Describe lo que necesitas (ej: 'se me perdió mi carné')..."
        entry_busq.insert(0, HINT_BUSQ)
        entry_busq.config(fg=T_HINT)
        entry_busq.pack(side="left", fill="x", expand=True)
        entry_busq.bind("<Return>", lambda e: _buscar_tramite())

        lbl_sugerencia = tk.Label(search_inner, text="", font=F_SMALL,
                                  bg=BG_CARD, wraplength=600, justify="left")
        lbl_sugerencia.pack(fill="x", pady=(4, 0))

        def _clear_hint(e):
            if entry_busq.get() == HINT_BUSQ:
                entry_busq.delete(0, "end")
                entry_busq.config(fg=T_TITULO)
        def _restore_hint(e):
            if not entry_busq.get():
                entry_busq.insert(0, HINT_BUSQ)
                entry_busq.config(fg=T_HINT)
        entry_busq.bind("<FocusIn>", _clear_hint)
        entry_busq.bind("<FocusOut>", _restore_hint)

        def _limpiar_botones_sugeridos():
            for b in getattr(self, "_btns_sugeridos", []):
                try: b.destroy()
                except Exception: pass
            self._btns_sugeridos = []

        def _buscar_tramite():
            texto = entry_busq.get().strip()
            _limpiar_botones_sugeridos()
            if not texto or texto == HINT_BUSQ:
                return
            sugerencias = sugerir_tramites(texto)
            if not sugerencias:
                lbl_sugerencia.config(
                    text="No encontré un trámite que coincida. Elige uno de la "
                         "lista de abajo, o usa \"Otro trámite\" para redactar uno libre.",
                    fg=T_SUAVE)
                return
            clave, nombre, _score = sugerencias[0]
            lbl_sugerencia.config(text=f"💡 Podría ser: {nombre}", fg=C_AZUL)
            for clave_s, nombre_s, _ in sugerencias:
                btn = ModernButton(
                    search_inner, text=f"{ICONOS.get(clave_s,'📄')} {nombre_s} →",
                    command=lambda c=clave_s: self._seleccionar_tramite(c),
                    style="primary" if clave_s == clave else "secondary")
                btn.pack(anchor="w", pady=(6, 0))
                self._btns_sugeridos.append(btn)

        self._btns_sugeridos = []
        btn_buscar_row = tk.Frame(search_inner, bg=BG_CARD)
        btn_buscar_row.pack(fill="x", pady=(6, 0))
        ModernButton(btn_buscar_row, text="🔍 Sugerir trámite",
                     command=_buscar_tramite,
                     style="gold").pack(side="left", padx=(0, 8))
        tk.Label(btn_buscar_row, text="o selecciona directamente abajo",
                 font=F_SMALL, bg=BG_CARD, fg=T_HINT).pack(side="left")

        # ── Estadísticas rápidas ──
        stats = tk.Frame(inner, bg=BG_MAIN)
        stats.pack(fill="x", pady=(0, 20))

        stats_data = [
            ("13", "Trámites\ndisponibles", C_AZUL, "#eff6ff"),
            ("🔒", "Tus datos\nseguros", C_VERDE, C_VERDE_BG),
            ("⚡", "Generación\ninstantánea", C_DORADO, "#fffbeb"),
            ("📄", "Word\n+ PDF", C_AZUL_OSC, "#f0f4ff"),
        ]
        for i, (val, lbl, fg, bg) in enumerate(stats_data):
            card = tk.Frame(stats, bg=bg,
                            highlightbackground=B_DEFAULT, highlightthickness=1)
            card.grid(row=0, column=i, padx=(0 if i==0 else 6, 0), sticky="nsew")
            stats.grid_columnconfigure(i, weight=1)
            inner_s = tk.Frame(card, bg=bg, padx=14, pady=10)
            inner_s.pack(fill="both")
            tk.Label(inner_s, text=val, font=F(18, "bold"),
                     bg=bg, fg=fg).pack(anchor="w")
            tk.Label(inner_s, text=lbl, font=F_SMALL,
                     bg=bg, fg=T_SUAVE, justify="left").pack(anchor="w")

        # ── Trámites frecuentes ──
        DividerLabel(inner, "⭐  Trámites Frecuentes").pack(fill="x", pady=(0, 10))

        grid_freq = tk.Frame(inner, bg=BG_MAIN)
        grid_freq.pack(fill="x", pady=(0, 6))
        self._poblar_grilla(grid_freq, FRECUENTES, cols=3, frecuentes=True)

        # ── Todos los trámites ──
        RESTO = [k for k in CATALOGO if k not in FRECUENTES]
        DividerLabel(inner, "📋  Todos los Trámites").pack(fill="x", pady=(12, 10))

        grid_resto = tk.Frame(inner, bg=BG_MAIN)
        grid_resto.pack(fill="x")
        self._poblar_grilla(grid_resto, RESTO, cols=3, frecuentes=False)

    def _poblar_grilla(self, parent, claves, cols=3, frecuentes=False):
        for i, clave in enumerate(claves):
            t = CATALOGO[clave]
            card = TarjetaTramite(parent, clave, t["nombre"],
                                  ICONOS.get(clave, "📄"),
                                  self._seleccionar_tramite,
                                  es_frecuente=frecuentes)
            col, row = i % cols, i // cols
            card.grid(row=row, column=col, padx=5, pady=5, sticky="nsew")
            parent.grid_columnconfigure(col, weight=1)

    # ══════════════════════════════════════════════════════════
    # PANTALLA 2: Formulario de datos
    # ══════════════════════════════════════════════════════════
    def _seleccionar_tramite(self, clave):
        self.tramite_actual = clave
        self._mostrar_formulario()

    def _mostrar_formulario(self):
        self._limpiar_main()
        tramite = obtener_tramite(self.tramite_actual)

        self._header_seccion(
            f"{ICONOS.get(self.tramite_actual,'📄')}  {tramite['nombre']}",
            "Paso 1 de 3 — Completa tus datos personales",
            btn_label="← Cambiar trámite",
            btn_cmd=self._mostrar_inicio
        )

        # Barra de progreso estilo pasos
        prog_frame = tk.Frame(self.main, bg=BG_MAIN, padx=24, pady=10)
        prog_frame.pack(fill="x")
        pasos = ["Datos personales", "Fundamentación", "Vista previa"]
        for i, paso in enumerate(pasos):
            activo = i == 0
            color_bg = C_AZUL if activo else B_DEFAULT
            color_fg = "white" if activo else T_SUAVE
            tk.Label(prog_frame, text=f"  {i+1}. {paso}  ",
                     font=F(9, "bold" if activo else "normal"),
                     bg=color_bg, fg=color_fg, padx=2, pady=4).pack(side="left")
            if i < len(pasos) - 1:
                tk.Label(prog_frame, text=" › ",
                         font=F_SMALL, bg=BG_MAIN, fg=T_HINT).pack(side="left")

        _, inner = make_scrollable(self.main)
        inner.config(padx=24, pady=16)

        # ── Consejo del trámite ──
        if tramite.get("ayuda"):
            aviso = tk.Frame(inner, bg="#eff6ff",
                             highlightbackground="#bfdbfe", highlightthickness=1)
            aviso.pack(fill="x", pady=(0, 16))
            av_i = tk.Frame(aviso, bg="#eff6ff", padx=14, pady=10)
            av_i.pack(fill="x")
            tk.Label(av_i, text="💡", font=F(14), bg="#eff6ff").pack(side="left", anchor="n")
            tk.Label(av_i, text=tramite["ayuda"], font=F_SMALL,
                     bg="#eff6ff", fg="#1e40af",
                     wraplength=750, justify="left").pack(side="left", padx=(8, 0))

        # ── API autocompletar ──
        api_card = tk.Frame(inner, bg=BG_CARD,
                            highlightbackground=B_DEFAULT, highlightthickness=1)
        api_card.pack(fill="x", pady=(0, 16))
        api_i = tk.Frame(api_card, bg=BG_CARD, padx=16, pady=12)
        api_i.pack(fill="x")

        top_api = tk.Frame(api_i, bg=BG_CARD)
        top_api.pack(fill="x")
        tk.Label(top_api, text="🔍  Autocompletar con código de matrícula",
                 font=F_H3, bg=BG_CARD, fg=T_TITULO).pack(side="left")
        self._lbl_api = tk.Label(top_api, text="", font=F_SMALL, bg=BG_CARD)
        self._lbl_api.pack(side="right")

        tk.Label(api_i,
                 text="El sistema consulta la API de UNDAC y completa tu nombre, DNI, facultad y domicilio automáticamente.",
                 font=F_SMALL, bg=BG_CARD, fg=T_SUAVE).pack(anchor="w", pady=(4, 8))

        fila_api = tk.Frame(api_i, bg=BG_CARD)
        fila_api.pack(fill="x")

        self._var_cod_api = tk.StringVar(value=self.datos_sesion.get("codigo",""))
        api_entry_frame = tk.Frame(fila_api, bg=B_DEFAULT, padx=1, pady=1)
        api_entry_frame.pack(side="left")
        tk.Entry(api_entry_frame, textvariable=self._var_cod_api,
                 font=F_BODY, width=18, bg=BG_CARD, fg=T_TITULO,
                 relief="flat", bd=0, insertbackground=C_AZUL).pack(
                     padx=8, pady=6)

        ModernButton(fila_api, text="Consultar API", icon="🔍",
                     command=self._consultar_api, style="primary").pack(
                         side="left", padx=(8, 0))

        # ── Datos personales en dos columnas ──
        DividerLabel(inner, "Datos Personales").pack(fill="x", pady=(4, 12))

        self._campos_widgets = {}

        ANCHO_COMPLETO = {"nombres_apellidos", "domicilio", "cargo_centro_trabajo"}
        col_frame = tk.Frame(inner, bg=BG_MAIN)
        col_frame.pack(fill="x")
        col_L = tk.Frame(col_frame, bg=BG_MAIN)
        col_R = tk.Frame(col_frame, bg=BG_MAIN)
        col_L.pack(side="left", fill="both", expand=True, padx=(0, 8))
        col_R.pack(side="left", fill="both", expand=True)

        for i, (clave, etiq, oblig, ej, val_key, ayuda) in enumerate(CAMPOS_CONFIG):
            parent_c = inner if clave in ANCHO_COMPLETO else (col_L if i%2==0 else col_R)
            valores_campo = {"facultad": listar_facultades(),
                             "escuela": listar_escuelas()}.get(clave)
            w = ModernEntry(parent_c, clave, etiq, oblig, ej, val_key, ayuda,
                            valores=valores_campo)
            w.pack(fill="x", pady=6)
            valor = self.datos_sesion.get(clave, "")
            if valor: w.set(valor)
            self._campos_widgets[clave] = w

        # Al elegir Facultad, filtrar Escuela Profesional a las escuelas
        # reales de esa facultad (sin bloquear texto libre si no calza).
        if "facultad" in self._campos_widgets and "escuela" in self._campos_widgets:
            w_fac, w_esc = self._campos_widgets["facultad"], self._campos_widgets["escuela"]
            def _al_elegir_facultad(_e=None):
                escuelas = listar_escuelas(w_fac.get())
                if escuelas:
                    w_esc.set_valores(escuelas)
                    if w_esc.get() not in escuelas:
                        w_esc.set(escuelas[0])
            w_fac.entry.bind("<<ValoresSeleccionados>>", _al_elegir_facultad)
            w_fac.entry.bind("<FocusOut>", lambda e: _al_elegir_facultad(), add="+")

        # ── Campos extra del trámite ──
        campos_extra = tramite.get("campos_extra", [])
        campos_opc = set(tramite.get("campos_extra_opcionales", []))
        if campos_extra:
            DividerLabel(inner, f"Datos del trámite — {tramite['nombre']}").pack(
                fill="x", pady=(12, 12))
            col2 = tk.Frame(inner, bg=BG_MAIN)
            col2.pack(fill="x")
            cL2 = tk.Frame(col2, bg=BG_MAIN)
            cR2 = tk.Frame(col2, bg=BG_MAIN)
            cL2.pack(side="left", fill="both", expand=True, padx=(0, 8))
            cR2.pack(side="left", fill="both", expand=True)
            for i, campo in enumerate(campos_extra):
                w = ModernEntry(cL2 if i%2==0 else cR2,
                                campo, campo.replace("_"," ").capitalize(),
                                campo not in campos_opc)
                w.pack(fill="x", pady=6)
                self._campos_widgets[campo] = w

        # ── Anexo ──
        DividerLabel(inner, "Documentos a Adjuntar").pack(fill="x", pady=(12, 12))
        self._var_anexo = tk.StringVar(value=tramite.get("anexo_sugerido",""))
        w_anx = ModernEntry(inner, "anexo", "Anexos (documentos adjuntos)", False,
                            "Copia de DNI, recibo de pago", None,
                            "Documenta lo que adjuntarás al trámite")
        w_anx.set(tramite.get("anexo_sugerido",""))
        w_anx.pack(fill="x", pady=6)
        self._campos_widgets["anexo"] = w_anx

        # ── Acciones ──
        acc = tk.Frame(inner, bg=BG_MAIN, pady=16)
        acc.pack(fill="x")

        ModernButton(acc, text="Continuar →", icon="",
                     command=self._ir_a_fundamentacion,
                     style="primary").pack(side="right")

    def _consultar_api(self):
        codigo = self._var_cod_api.get().strip()
        if not codigo:
            if self._lbl_api:
                self._lbl_api.config(text="Ingresa un código", fg=C_NARANJA)
            return
        if self._lbl_api:
            self._lbl_api.config(text="⏳ Consultando...", fg=T_SUAVE)
        self.update()

        def _buscar():
            try:
                info = api_undac.consultar_estudiante(codigo)
                self.after(0, lambda: self._aplicar_api(info, codigo))
            except api_undac.APIError as e:
                msg = str(e)[:70]
                self.after(0, lambda: self._lbl_api.config(
                    text=f"✗ {msg}", fg=C_ROJO) if self._lbl_api else None)

        threading.Thread(target=_buscar, daemon=True).start()

    def _aplicar_api(self, info, codigo):
        mapeo = {"nombres_apellidos": info["nombres_apellidos"],
                 "dni": info["dni"], "codigo": codigo,
                 "facultad": info["facultad"], "escuela": info["escuela"],
                 "domicilio": info["domicilio"],
                 "correo": info["correo_institucional"]}
        for k, v in mapeo.items():
            if k in self._campos_widgets and v:
                self._campos_widgets[k].set(v)
        nombre = info["nombres_apellidos"].split()[0] if info["nombres_apellidos"] else ""
        if self._lbl_api:
            self._lbl_api.config(text=f"✓ Datos de {nombre} cargados", fg=C_VERDE)

    def _recolectar_datos(self):
        datos = {}
        for clave, widget in self._campos_widgets.items():
            datos[clave] = widget.get()
        return datos

    def _ir_a_fundamentacion(self):
        hay_error = any(not w.is_valid() for w in self._campos_widgets.values())
        if hay_error:
            messagebox.showwarning("Campos incompletos",
                                   "Completa los campos obligatorios (*).")
            return
        self.datos_sesion = self._recolectar_datos()
        self._mostrar_fundamentacion()

    # ══════════════════════════════════════════════════════════
    # PANTALLA 3: Fundamentación
    # ══════════════════════════════════════════════════════════
    def _mostrar_fundamentacion(self):
        self._limpiar_main()
        tramite = obtener_tramite(self.tramite_actual)

        self._header_seccion(
            "✍️  Fundamentación del pedido",
            "Paso 2 de 3 — Revisa o edita el texto legal generado automáticamente",
            btn_label="← Volver", btn_cmd=self._mostrar_formulario
        )

        # Barra progreso paso 2
        prog = tk.Frame(self.main, bg=BG_MAIN, padx=24, pady=8)
        prog.pack(fill="x")
        pasos = ["Datos personales", "Fundamentación", "Vista previa"]
        for i, paso in enumerate(pasos):
            activo = i == 1
            tk.Label(prog, text=f"  {i+1}. {paso}  ",
                     font=F(9, "bold" if activo else "normal"),
                     bg=C_AZUL if activo else B_DEFAULT,
                     fg="white" if activo else T_SUAVE,
                     padx=2, pady=4).pack(side="left")
            if i < 2:
                tk.Label(prog, text=" › ", font=F_SMALL,
                         bg=BG_MAIN, fg=T_HINT).pack(side="left")

        _, cuerpo = make_scrollable(self.main)
        cuerpo.config(padx=24, pady=16)

        # Texto sugerido
        try:
            fut_prev = construir_fut(self.tramite_actual, self.datos_sesion)
            texto_auto = fut_prev.fundamentacion
        except Exception:
            texto_auto = ""

        # Aviso
        av = tk.Frame(cuerpo, bg="#eff6ff",
                      highlightbackground="#bfdbfe", highlightthickness=1)
        av.pack(fill="x", pady=(0, 14))
        av_i = tk.Frame(av, bg="#eff6ff", padx=14, pady=10)
        av_i.pack(fill="x")
        tk.Label(av_i, text="💡  El texto legal fue generado con tus datos. Puedes usarlo tal cual o editarlo libremente.",
                 font=F_SMALL, bg="#eff6ff", fg="#1e40af",
                 wraplength=780, justify="left").pack(anchor="w")

        # ── Panel de IA para fundamentación ──
        ia_frame = tk.Frame(cuerpo, bg="#0f1f3d",
                            highlightbackground="#c9a227", highlightthickness=1)
        ia_frame.pack(fill="x", pady=(0, 12))
        ia_inner = tk.Frame(ia_frame, bg="#0f1f3d", padx=14, pady=12)
        ia_inner.pack(fill="x")

        tk.Label(ia_inner, text="🤖  Generar con IA (AWS Bedrock)",
                 font=F_H3, bg="#0f1f3d", fg="#c9a227").pack(anchor="w")
        tk.Label(ia_inner,
                 text="Describe tu situación en tus propias palabras y la IA redactará el texto legal formal.",
                 font=F_SMALL, bg="#0f1f3d", fg="#8aa4c8").pack(anchor="w", pady=(2, 8))

        ia_entry_wrap = tk.Frame(ia_inner, bg="#1a2e50", padx=1, pady=1)
        ia_entry_wrap.pack(fill="x", pady=(0, 8))
        self._var_desc_ia = tk.StringVar()
        HINT_IA = "Ej: necesito la constancia para postular a una beca del PRONABEC, estoy en 5to semestre con promedio 15..."
        ia_entry = tk.Entry(ia_entry_wrap, textvariable=self._var_desc_ia,
                            font=F_BODY, bg="#0a1628", fg="#e2e8f0",
                            relief="flat", bd=0, insertbackground="#c9a227")
        ia_entry.pack(fill="x", padx=10, pady=7)
        ia_entry.insert(0, HINT_IA)
        ia_entry.config(fg="#475569")

        def _clear_ia(e):
            if ia_entry.get() == HINT_IA:
                ia_entry.delete(0, "end")
                ia_entry.config(fg="#e2e8f0")
        def _restore_ia(e):
            if not ia_entry.get():
                ia_entry.insert(0, HINT_IA)
                ia_entry.config(fg="#475569")
        ia_entry.bind("<FocusIn>",  _clear_ia)
        ia_entry.bind("<FocusOut>", _restore_ia)

        self._lbl_ia_fund = tk.Label(ia_inner, text="", font=F_SMALL,
                                     bg="#0f1f3d", fg="#8aa4c8",
                                     wraplength=750, justify="left")
        self._lbl_ia_fund.pack(anchor="w", pady=(0, 4))

        def _generar_fund_ia():
            if not IA_DISPONIBLE:
                self._lbl_ia_fund.config(
                    text="⚠ boto3 no instalado. Ejecuta: pip install boto3",
                    fg=C_NARANJA)
                return
            desc = ia_entry.get().strip()
            if desc == HINT_IA: desc = ""
            self._lbl_ia_fund.config(text="⏳ Generando con AWS Bedrock...", fg="#8aa4c8")
            self.update()

            def _tarea():
                try:
                    texto = generar_fundamentacion(
                        tipo_tramite=self.tramite_actual,
                        datos_estudiante=self.datos_sesion,
                        descripcion_libre=desc
                    )
                    def _aplicar():
                        self._txt_fund.delete("1.0", "end")
                        self._txt_fund.insert("1.0", texto)
                        self._lbl_ia_fund.config(
                            text="✓ Fundamentación generada con IA. Puedes editarla.",
                            fg=C_VERDE)
                    self.after(0, _aplicar)
                except BedrockError as e:
                    msg = f"✗ {str(e)[:90]}"
                    self.after(0, lambda: self._lbl_ia_fund.config(text=msg, fg=C_ROJO))
                except Exception as e:
                    msg = f"✗ Error: {str(e)[:70]}"
                    self.after(0, lambda: self._lbl_ia_fund.config(text=msg, fg=C_ROJO))

            threading.Thread(target=_tarea, daemon=True).start()

        ModernButton(ia_inner, text="✨ Generar fundamentación con IA",
                     command=_generar_fund_ia, style="gold").pack(anchor="w")

        # Info solicito / destinatario
        info_row = tk.Frame(cuerpo, bg=BG_MAIN)
        info_row.pack(fill="x", pady=(0, 10))
        try:
            for etiq, val in [("SOLICITO", fut_prev.solicito),
                               ("A", fut_prev.destinatario)]:
                chip = tk.Frame(info_row, bg=BG_CARD,
                                highlightbackground=B_DEFAULT, highlightthickness=1)
                chip.pack(side="left", padx=(0, 8))
                chip_i = tk.Frame(chip, bg=BG_CARD, padx=10, pady=5)
                chip_i.pack()
                tk.Label(chip_i, text=etiq, font=F(8, "bold"),
                         bg=BG_CARD, fg=T_SUAVE).pack(side="left")
                tk.Label(chip_i, text=f"  {val}", font=F_SMALL,
                         bg=BG_CARD, fg=T_TITULO).pack(side="left")
        except Exception:
            pass

        # Editor
        lbl_edit = tk.Frame(cuerpo, bg=BG_MAIN)
        lbl_edit.pack(fill="x", pady=(0, 6))
        tk.Label(lbl_edit, text="Campo 11 — Fundamentación del pedido",
                 font=F_H3, bg=BG_MAIN, fg=T_TITULO).pack(side="left")

        edit_wrap = tk.Frame(cuerpo, bg=B_FOCUS, padx=1, pady=1)
        edit_wrap.pack(fill="both", expand=True)
        edit_bg = tk.Frame(edit_wrap, bg=BG_CARD)
        edit_bg.pack(fill="both", expand=True)

        self._txt_fund = scrolledtext.ScrolledText(
            edit_bg, font=F_BODY, bg=BG_CARD, fg=T_TITULO,
            relief="flat", wrap="word", padx=14, pady=12,
            insertbackground=C_AZUL, height=11)
        self._txt_fund.pack(fill="both", expand=True)
        self._txt_fund.insert("1.0", texto_auto)

        # Botones del editor
        btns_edit = tk.Frame(cuerpo, bg=BG_MAIN, pady=8)
        btns_edit.pack(fill="x")
        ModernButton(btns_edit, text="🔄 Regenerar",
                     command=lambda: (self._txt_fund.delete("1.0","end"),
                                      self._txt_fund.insert("1.0", texto_auto)),
                     style="secondary").pack(side="left", padx=(0, 8))
        ModernButton(btns_edit, text="🗑 Limpiar",
                     command=lambda: self._txt_fund.delete("1.0","end"),
                     style="secondary").pack(side="left")
        ModernButton(btns_edit, text="Vista previa →",
                     command=self._ir_a_vista_previa,
                     style="primary").pack(side="right")

    def _ir_a_vista_previa(self):
        self.datos_sesion["fundamentacion"] = self._txt_fund.get("1.0","end").strip()
        self._mostrar_vista_previa()

    # ══════════════════════════════════════════════════════════
    # PANTALLA 4: Vista previa
    # ══════════════════════════════════════════════════════════
    def _mostrar_vista_previa(self):
        self._limpiar_main()
        tramite = obtener_tramite(self.tramite_actual)

        self._header_seccion(
            "👁  Vista previa del FUT",
            "Paso 3 de 3 — Revisa el documento antes de generarlo",
            btn_label="← Editar", btn_cmd=self._mostrar_fundamentacion
        )

        # Barra progreso paso 3
        prog = tk.Frame(self.main, bg=BG_MAIN, padx=24, pady=8)
        prog.pack(fill="x")
        for i, paso in enumerate(["Datos personales", "Fundamentación", "Vista previa"]):
            activo = i == 2
            tk.Label(prog, text=f"  {i+1}. {paso}  ",
                     font=F(9, "bold" if activo else "normal"),
                     bg=C_AZUL if activo else B_DEFAULT,
                     fg="white" if activo else T_SUAVE,
                     padx=2, pady=4).pack(side="left")
            if i < 2:
                tk.Label(prog, text=" › ", font=F_SMALL,
                         bg=BG_MAIN, fg=T_HINT).pack(side="left")

        try:
            fut = construir_fut(self.tramite_actual, self.datos_sesion)
            self.fut_generado = fut
        except Exception as e:
            messagebox.showerror("Error", str(e))
            return

        # Layout: preview izquierda + panel generar derecha
        layout = tk.Frame(self.main, bg=BG_MAIN, padx=24, pady=12)
        layout.pack(fill="both", expand=True)

        # ── Columna izquierda: preview del documento ──
        col_preview = tk.Frame(layout, bg=BG_MAIN)
        col_preview.pack(side="left", fill="both", expand=True, padx=(0, 16))

        _, inner_prev = make_scrollable(col_preview)
        inner_prev.config(pady=4)

        # Tarjeta FUT
        fut_card = tk.Frame(inner_prev, bg=BG_CARD,
                            highlightbackground=B_CARD, highlightthickness=1)
        fut_card.pack(fill="x")

        # Encabezado del FUT (simula la barra del documento)
        enc = tk.Frame(fut_card, bg=C_AZUL_OSC, padx=16, pady=10)
        enc.pack(fill="x")
        tk.Label(enc, text=f"{ICONOS.get(self.tramite_actual,'📄')} {tramite['nombre'].upper()}",
                 font=F(11, "bold"), bg=C_AZUL_OSC, fg="white").pack(anchor="w")
        tk.Label(enc, text=f"SOLICITO: {fut.solicito}",
                 font=F_SMALL, bg=C_AZUL_OSC, fg="#a8c4f0").pack(anchor="w")

        body_prev = tk.Frame(fut_card, bg=BG_CARD, padx=18, pady=14)
        body_prev.pack(fill="x")

        def fila_prev(n, etiq, valor, color_val=T_TITULO):
            f = tk.Frame(body_prev, bg=BG_CARD)
            f.pack(fill="x", pady=3)
            tk.Frame(f, bg=B_DEFAULT, width=2).pack(side="left", fill="y", padx=(0, 8))
            col = tk.Frame(f, bg=BG_CARD)
            col.pack(side="left", fill="both", expand=True)
            tk.Label(col, text=f"{n}. {etiq}",
                     font=F(8, "bold"), bg=BG_CARD, fg=T_SUAVE,
                     anchor="w").pack(fill="x")
            tk.Label(col, text=valor or "—",
                     font=F_BODY, bg=BG_CARD, fg=color_val,
                     anchor="w", wraplength=380, justify="left").pack(fill="x")

        fila_prev(1,  "Sumilla",              fut.sumilla)
        fila_prev(2,  "Destinatario",         fut.destinatario)
        fila_prev(3,  "Apellidos y Nombres",  fut.nombres_apellidos)
        fila_prev(5,  "D.N.I.",               fut.dni)
        fila_prev(6,  "Código de Matrícula",  fut.codigo)
        fila_prev(7,  "Celular",              fut.celular)
        fila_prev(8,  "Correo",               fut.correo)
        fila_prev(9,  "Facultad / Escuela",   f"{fut.facultad} / {fut.escuela}")
        fila_prev(10, "Domicilio",            fut.domicilio)

        # Fundamentación destacada
        tk.Frame(body_prev, bg=B_DEFAULT, height=1).pack(fill="x", pady=8)
        tk.Label(body_prev, text="11. Fundamentación del pedido",
                 font=F(9,"bold"), bg=BG_CARD, fg=T_SUAVE).pack(anchor="w")
        fund_box = tk.Frame(body_prev, bg="#f8faff",
                            highlightbackground="#dde5f5", highlightthickness=1)
        fund_box.pack(fill="x", pady=(4, 8))
        tk.Label(fund_box, text=fut.fundamentacion,
                 font=F_SMALL, bg="#f8faff", fg=T_TITULO,
                 wraplength=380, justify="left",
                 padx=10, pady=8).pack(anchor="w")

        tk.Frame(body_prev, bg=B_DEFAULT, height=1).pack(fill="x", pady=4)
        fila_prev(12, "Anexo",  fut.anexo)
        fila_prev(13, "Fecha",  fut.fecha, C_AZUL)

        # ── Columna derecha: panel de generación ──
        col_gen = tk.Frame(layout, bg=BG_MAIN, width=260)
        col_gen.pack(side="right", fill="y")
        col_gen.pack_propagate(False)

        # Tarjeta de generación
        gen_card = tk.Frame(col_gen, bg=BG_CARD,
                            highlightbackground=C_DORADO, highlightthickness=2)
        gen_card.pack(fill="x")
        gen_i = tk.Frame(gen_card, bg=BG_CARD, padx=16, pady=16)
        gen_i.pack(fill="x")

        tk.Label(gen_i, text="Generar documento",
                 font=F_H2, bg=BG_CARD, fg=T_TITULO).pack(anchor="w")
        tk.Label(gen_i, text="Selecciona el formato de salida:",
                 font=F_SMALL, bg=BG_CARD, fg=T_SUAVE,
                 pady=4).pack(anchor="w")

        self._var_docx = tk.BooleanVar(value=True)
        self._var_pdf  = tk.BooleanVar(value=True)

        for var, lbl, icon in [(self._var_docx,"Word (.docx)","📝"),
                               (self._var_pdf, "PDF","📄")]:
            chk_frame = tk.Frame(gen_i, bg=BG_CARD)
            chk_frame.pack(fill="x", pady=2)
            cb = tk.Checkbutton(chk_frame, variable=var,
                                font=F_BODY, bg=BG_CARD,
                                activebackground=BG_CARD,
                                fg=T_TITULO, selectcolor=BG_CARD)
            cb.pack(side="left")
            tk.Label(chk_frame, text=f"{icon} {lbl}",
                     font=F_BODY, bg=BG_CARD, fg=T_TITULO).pack(side="left")

        tk.Frame(gen_i, bg=B_DEFAULT, height=1).pack(fill="x", pady=10)

        self._progress_gen = ttk.Progressbar(gen_i, mode="indeterminate")
        self._lbl_gen_est = tk.Label(gen_i, text="", font=F_SMALL,
                                     bg=BG_CARD, wraplength=220, justify="left")

        self._btn_gen = ModernButton(gen_i, text="⬇  Generar FUT",
                                     command=self._generar,
                                     style="gold")
        self._btn_gen.pack(fill="x", pady=(0, 4))
        tk.Label(gen_i, text="El documento se guardará en la carpeta output/",
                 font=F_SMALL, bg=BG_CARD, fg=T_HINT,
                 wraplength=220, justify="left").pack(anchor="w")

    def _generar(self):
        formatos = []
        if self._var_docx.get(): formatos.append("docx")
        if self._var_pdf.get():  formatos.append("pdf")
        if not formatos:
            messagebox.showwarning("Sin formato", "Selecciona al menos un formato.")
            return

        # Actualizar UI de forma segura
        try:
            if self._btn_gen:
                self._btn_gen.config_state(False)
                self._btn_gen._lbl.config(text="⏳ Generando...")
            if self._progress_gen:
                self._progress_gen.pack(fill="x", pady=(8, 2))
                self._progress_gen.start(10)
            if self._lbl_gen_est:
                self._lbl_gen_est.pack(fill="x")
                self._lbl_gen_est.config(text="Procesando, por favor espera...", fg=T_SUAVE)
        except Exception:
            pass
        self.update()

        def _tarea():
            try:
                salida = generar_documentos(self.fut_generado, tuple(formatos))
                self.after(0, lambda: self._generar_ok(salida))
            except Exception as e:
                msg = str(e)
                self.after(0, lambda: self._generar_error(msg))

        threading.Thread(target=_tarea, daemon=True).start()

    def _generar_ok(self, salida):
        try:
            if self._progress_gen:
                self._progress_gen.stop()
                self._progress_gen.pack_forget()
            if self._lbl_gen_est:
                self._lbl_gen_est.pack_forget()
            if self._btn_gen:
                self._btn_gen.config_state(True)
                self._btn_gen._lbl.config(text="⬇  Generar FUT")
        except Exception:
            pass
        self._mostrar_resultado(salida)

    def _generar_error(self, msg):
        try:
            if self._progress_gen:
                self._progress_gen.stop()
                self._progress_gen.pack_forget()
            if self._btn_gen:
                self._btn_gen.config_state(True)
                self._btn_gen._lbl.config(text="⬇  Generar FUT")
            if self._lbl_gen_est:
                self._lbl_gen_est.config(text=f"✗ {msg}", fg=C_ROJO)
        except Exception:
            pass
        messagebox.showerror("Error al generar", msg)

    # ══════════════════════════════════════════════════════════
    # PANTALLA 5: Resultado
    # ══════════════════════════════════════════════════════════
    def _mostrar_resultado(self, salida):
        self._limpiar_main()

        # Header éxito
        hdr = tk.Frame(self.main, bg=C_VERDE_BG)
        hdr.pack(fill="x")
        tk.Frame(hdr, bg=C_VERDE, height=3).pack(fill="x")
        hdr_i = tk.Frame(hdr, bg=C_VERDE_BG, padx=24, pady=16)
        hdr_i.pack(fill="x")
        tk.Label(hdr_i, text="✅  ¡FUT generado exitosamente!",
                 font=F_H1, bg=C_VERDE_BG, fg=C_VERDE).pack(anchor="w")
        tramite = obtener_tramite(self.tramite_actual)
        tk.Label(hdr_i,
                 text=f"{tramite['nombre']}  ·  {self.fut_generado.nombres_apellidos}  ·  {self.fut_generado.fecha}",
                 font=F_SMALL, bg=C_VERDE_BG, fg=T_SUAVE).pack(anchor="w", pady=(4, 0))

        cuerpo = tk.Frame(self.main, bg=BG_MAIN, padx=24, pady=20)
        cuerpo.pack(fill="both", expand=True)

        tk.Label(cuerpo, text="Archivos generados",
                 font=F_H2, bg=BG_MAIN, fg=T_TITULO).pack(anchor="w", pady=(0, 12))

        # Cards de archivos
        for ruta, tipo, icono, estilo in [
            (salida.get("pdf"),  "PDF — listo para imprimir y presentar",
             "📄", "primary"),
            (salida.get("docx"), "Word — editable en Microsoft Word",
             "📝", "secondary"),
        ]:
            if not ruta: continue
            file_card = tk.Frame(cuerpo, bg=BG_CARD,
                                 highlightbackground=B_DEFAULT,
                                 highlightthickness=1)
            file_card.pack(fill="x", pady=6)
            fc_i = tk.Frame(file_card, bg=BG_CARD, padx=16, pady=12)
            fc_i.pack(fill="x")

            left = tk.Frame(fc_i, bg=BG_CARD)
            left.pack(side="left", fill="both", expand=True)
            tk.Label(left, text=f"{icono}  {tipo}",
                     font=F_H3, bg=BG_CARD, fg=T_TITULO).pack(anchor="w")
            tk.Label(left, text=str(ruta),
                     font=F_SMALL, bg=BG_CARD, fg=T_SUAVE).pack(anchor="w", pady=(2,0))

            right = tk.Frame(fc_i, bg=BG_CARD)
            right.pack(side="right")
            ModernButton(right, text="Abrir",
                         command=lambda r=ruta: self._abrir_archivo(r),
                         style="primary").pack(side="left", padx=(0,6))
            ModernButton(right, text="Copiar ruta",
                         command=lambda r=ruta: self._copiar(str(r)),
                         style="secondary").pack(side="left")

        # Acciones
        tk.Frame(cuerpo, bg=B_DEFAULT, height=1).pack(fill="x", pady=16)
        tk.Label(cuerpo, text="¿Qué deseas hacer ahora?",
                 font=F_H2, bg=BG_MAIN, fg=T_TITULO).pack(anchor="w", pady=(0, 10))

        acc = tk.Frame(cuerpo, bg=BG_MAIN)
        acc.pack(anchor="w")
        ModernButton(acc, text="+ Nuevo trámite", icon="",
                     command=self._mostrar_inicio, style="primary").pack(
                         side="left", padx=(0, 8))
        ModernButton(acc, text="✏  Editar y regenerar",
                     command=self._mostrar_formulario, style="secondary").pack(
                         side="left", padx=(0, 8))

        ruta_carpeta = Path(salida.get("pdf") or salida.get("docx")).parent
        ModernButton(acc, text="📂 Abrir carpeta",
                     command=lambda: self._abrir_archivo(ruta_carpeta),
                     style="secondary").pack(side="left")

        # Tip
        tip = tk.Frame(cuerpo, bg="#fffbeb",
                       highlightbackground="#fde68a", highlightthickness=1)
        tip.pack(fill="x", pady=(20, 0))
        tip_i = tk.Frame(tip, bg="#fffbeb", padx=14, pady=10)
        tip_i.pack(fill="x")
        tk.Label(tip_i, text="📌 Siguiente paso:",
                 font=F(9,"bold"), bg="#fffbeb", fg="#92400e").pack(anchor="w")
        tk.Label(tip_i,
                 text="Imprime el PDF y preséntalo en la mesa de partes de tu facultad. "
                      "El talón inferior (cargo) lo sellan con folio y N° de registro en ventanilla.",
                 font=F_SMALL, bg="#fffbeb", fg="#78350f",
                 wraplength=780, justify="left").pack(anchor="w", pady=(2, 0))

    # ══════════════════════════════════════════════════════════
    # UTILIDADES
    # ══════════════════════════════════════════════════════════
    def _abrir_archivo(self, ruta):
        ruta = Path(ruta)
        try:
            if sys.platform == "win32":
                if ruta.is_dir():
                    subprocess.Popen(["explorer", str(ruta)])
                else:
                    os.startfile(str(ruta))
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(ruta)])
            else:
                subprocess.Popen(["xdg-open", str(ruta)])
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo abrir:\n{ruta}\n\n{e}")

    def _copiar(self, texto):
        self.clipboard_clear()
        self.clipboard_append(texto)


# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    app = AppFUT()
    app.mainloop()
