# FUT-UNDAC — Asistente CLI para el Formulario Único de Trámite

Sistema de línea de comandos que automatiza la creación del FUT
(Formulario Único de Trámite) de la Universidad Nacional Daniel Alcides
Carrión (UNDAC), pensado para estudiantes que no saben cómo redactar
estos documentos formales.

Genera el documento final en **Word (.docx)** y/o **PDF**, replicando
fielmente el formato oficial (logo, líneas punteadas, numeración de
campos, talón de recepción).

---

## Instalación

Requisitos: Python 3.9+, LibreOffice (solo si quieres generar PDF; el
.docx no lo necesita).

```bash
cd fut_cli
pip install -r requirements.txt
```

Eso es todo — **no se necesita Node.js**, el generador de Word está
escrito en Python puro (`python-docx`).

### Opción alternativa: ejecutable único (sin instalar Python)

Si vas a compartir el sistema con compañeros que no quieren instalar
Python, puedes empaquetarlo como un único binario con PyInstaller:

```bash
pip install pyinstaller

# En Linux/Mac (separador ":"):
pyinstaller --onefile --name fut-undac \
  --add-data "data/undac_logo.jpg:data" \
  --hidden-import rich \
  --console \
  main.py

# En Windows (separador ";", desde PowerShell o CMD):
pyinstaller --onefile --name fut-undac ^
  --add-data "data/undac_logo.jpg;data" ^
  --hidden-import rich ^
  --console ^
  main.py
```

Esto genera `dist/fut-undac` (o `dist/fut-undac.exe` en Windows). Ese
único archivo ya contiene Python y todas las dependencias — tus
compañeros solo necesitan copiarlo y ejecutarlo. La carpeta `output/`
con los documentos generados se crea automáticamente junto al
ejecutable. LibreOffice sigue siendo necesario aparte si quieren PDF.

---

## Modos de uso

### 1. Interfaz gráfica (recomendada) — nueva ✨

```bash
python gui.py
```

La aplicación de escritorio tiene 5 pantallas:

**Inicio**: muestra todos los trámites como tarjetas con ícono. Los más frecuentes aparecen primero. Clic en cualquier tarjeta para comenzar.

**Datos personales**: formulario con dos columnas, validación en tiempo real (verde = OK, rojo = error), botón de autocompletado por API UNDAC, y perfil guardado que se carga automáticamente.

**Fundamentación**: editor de texto con la redacción legal generada automáticamente. Puedes usarla tal cual, editarla, o escribir la tuya.

**Vista previa**: resumen completo del FUT antes de generar. Selecciona el formato (Word, PDF, o ambos) y genera con un clic.

**Resultado**: botones para abrir PDF/Word directamente, copiar la ruta, y generar un nuevo trámite.

### 2. Modo asistido por consola (wizard)

```bash
python main.py
python main.py wizard
```

### 3. Modo experto (DSL)

```bash
python main.py dsl mi_tramite.fut
python main.py dsl --inline
python main.py dsl --ejemplo
```

### 4. Configurar encabezado y pie de página (nuevo ✨)

```bash
python main.py plantilla           # abre el editor interactivo (por defecto)
python main.py plantilla editar    # lo mismo, explícito
python main.py plantilla ver       # muestra la plantilla guardada actualmente
python main.py plantilla restaurar # vuelve a los valores de fábrica
```

Editor de consola, en pantalla dividida (izquierda: preguntas / derecha:
vista previa en vivo del FUT, con datos de ejemplo). Cada respuesta se
refleja al instante en la vista previa. Se puede configurar:

- Encabezado personalizado (texto libre arriba del FUT)
- Logo de tu facultad/escuela (S/N + ruta del archivo)
- Nombre de la institución en el encabezado
- Pie de página (texto libre)
- Número de expediente / folio (S/N + prefijo)
- Fecha y lugar (muestra "FECHA Y LUGAR" en el campo 13 en vez de solo "FECHA")
- Cargo del destinatario personalizado (reemplaza el destinatario automático de cada trámite)
- Datos del estudiante en el encabezado (S/N)
- Nombre del año / lema oficial (S/N + texto)

Esto **no** se configura por cada FUT: es una **plantilla global**,
guardada en `~/.fut_undac/plantilla.json`, que se aplica automáticamente
a todos los FUT que generes después (wizard, DSL o GUI), hasta que la
vuelvas a cambiar.

### 5. Configurar campos sin tocar código (nuevo ✨)

Las etiquetas de los campos (lo que ve el usuario) y los alias que
acepta el modo DSL viven en `data/campos_config.json`, no en el
código Python. Se editan con el CLI:

```bash
# Ver todos los campos, su etiqueta actual y sus alias
python main.py campos listar

# Cambiar cómo se llama un campo en el formulario
# (el nombre interno "nombres_apellidos" NO cambia, solo el texto visible)
python main.py campos renombrar nombres_apellidos "Apellidos y Nombres"

# Aceptar una palabra nueva en el modo DSL, ej: NOMBRE: -> nombres_apellidos
python main.py campos alias nombre nombres_apellidos

# Quitar un alias
python main.py campos quitar-alias nombre
```

Estos cambios se aplican automáticamente en la GUI, el wizard y el
modo DSL — no requieren reiniciar nada más que volver a abrir la
app. `gui.py` y `core/dsl.py` leen `data/campos_config.json` a
través de `core/campos.py`.

### 6. Otros comandos

```bash
python main.py listar
python main.py perfiles
python test_api.py 2304403050
```



---

## Catálogo de trámites incluidos

| Clave | Trámite |
|---|---|
| `constancia_matricula` | Constancia de matrícula |
| `constancia_no_adeudar` | Constancia de no adeudar (biblioteca/economía) |
| `constancia_egresado` | Constancia de egresado / tercio-quinto superior |
| `traslado_interno` | Traslado interno (entre facultades/escuelas) |
| `traslado_externo` | Traslado externo (de otra universidad) |
| `convalidacion` | Convalidación de cursos |
| `reserva_matricula` | Reserva de matrícula |
| `rectificacion_notas` | Rectificación de notas |
| `carta_presentacion` | Carta de presentación (prácticas pre-profesionales) |
| `devolucion_documentos` | Devolución de documentos |
| `duplicado_carne` | Duplicado de carné universitario |
| `subsanacion_actas` | Subsanación de actas |
| `otro` | Trámite libre (no listado) |

Para agregar un trámite nuevo, basta con añadir una entrada al
diccionario `CATALOGO` en `core/catalogo.py` — no requiere tocar
ningún otro archivo del sistema.

---

## Integración con la API de UNDAC

El wizard puede autocompletar tus datos personales consultando la API
institucional por código de matrícula (`core/api_undac.py`).

La API devuelve el correo institucional y el personal por separado. El
correo institucional se autocompleta solo si termina en
`@undac.edu.pe` (por si la API vuelve a devolver un correo personal en
ese campo). La URL de la API lleva tokens, así que se configura con la
variable `UNDAC_API_BASE_URL` (ver `.env.example`).

---

## Arquitectura del proyecto

```
fut_cli/
├── main.py                 # CLI principal (argparse + subcomandos)
├── test_api.py              # Script de diagnóstico de la API de UNDAC
├── data/
│   └── undac_logo.jpg      # Logo oficial extraído del FUT original
├── core/
│   ├── catalogo.py         # Catálogo de trámites + plantillas de redacción
│   ├── modelo.py           # FUTData (estructura central) + validadores
│   ├── dsl.py               # Parser del mini-lenguaje (modo experto)
│   ├── constructor.py      # Combina catálogo + datos -> FUTData
│   ├── wizard.py            # Wizard interactivo (modo asistido)
│   ├── modo_experto.py     # Ejecutor del modo DSL
│   ├── generador.py        # Orquesta .docx -> .pdf (resuelve rutas en modo script y .exe)
│   ├── generar_docx_py.py  # Generador del .docx en Python puro (python-docx)
│   ├── api_undac.py         # Conector a la API institucional
│   ├── perfil.py            # Persistencia de perfil local (JSON)
│   ├── plantilla.py         # Config. de plantilla global (encabezado/pie) — JSON persistente
│   └── plantilla_cli.py     # Editor de consola con vista previa en vivo (comando "plantilla")
└── output/                  # Documentos generados (.docx, .pdf)
```

### Flujo de datos

```
Wizard (interactivo)  ──┐
                         ├──> dict de datos del usuario
DSL (texto plano)     ──┘
                              │
                              ▼
                    constructor.construir_fut()
                    (combina con catalogo.py)
                              │
                              ▼
                          FUTData
                              │
                              ▼
                  generador.generar_documentos()
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
          generar_docx_py.py      LibreOffice (PDF)
          (python-docx puro)            │
                    │                   │
                    ▼                   ▼
                 .docx               .pdf
```

---

## Validaciones incluidas

- **DNI**: 8 dígitos numéricos
- **Código de matrícula**: 6-12 dígitos numéricos
- **Celular**: 9 dígitos, debe empezar con 9
- **Correo**: formato de email válido
- **Campos obligatorios**: nombre, DNI, código, facultad, escuela,
  domicilio, fundamentación

El sistema detecta automáticamente si faltan datos para completar las
plantillas (placeholders sin resolver) y te avisa específicamente qué
falta, tanto en modo wizard como en modo DSL.
