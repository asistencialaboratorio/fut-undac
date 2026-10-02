# FUT-UNDAC Web

Versión web del generador de FUT (Formulario Único de Trámite) de la
Universidad Nacional Daniel Alcides Carrión (UNDAC). Guía al estudiante
por un wizard paso a paso y genera el documento final en **Word (.docx)**
listo para descargar, sin necesidad de instalar nada.

Es la contraparte web del proyecto de consola/escritorio en la raíz de
este repositorio (`main.py`, `gui.py`).

## Cómo funciona

- **Wizard** (`components/Wizard.tsx`): selección de trámite, datos
  personales, fundamentación y vista previa, todo en el navegador.
- **Vista previa A4 editable** (`components/FutDocument.tsx`): la hoja se
  muestra a tamaño A4 fijo (se reduce proporcionalmente en pantallas
  chicas) y cualquier texto se edita con un clic. Si el texto no cabe, la
  letra se reduce sola hasta que entre en una hoja. Desde ahí se descarga
  Word, PDF o se imprime, siempre con lo que se ve en la hoja. El PDF se
  genera en el navegador (`lib/pdf-cliente.ts`, imagen de la hoja a alta
  resolución); "Imprimir" usa el PDF vectorial del propio navegador.
- **Autocompletado por código de matrícula**
  (`app/api/consultar-estudiante/route.ts`, método `POST`): consulta la
  API institucional de UNDAC desde el servidor, para que el token de la
  URL no llegue al navegador. Completa nombre, DNI, correo institucional,
  facultad, escuela y domicilio. Como la ruta es pública, limita a 10
  consultas por IP cada 10 minutos.
  Requiere la variable de entorno `UNDAC_API_BASE_URL` — ver abajo.
  **Solo responde desde la red institucional de UNDAC** (wifi del campus
  o VPN), así que fuera de esa red este paso falla de forma controlada y
  el estudiante puede seguir llenando los datos a mano.
- **Generación del documento** (`app/api/generar-docx/route.ts`): arma
  el `.docx` en memoria (`lib/docx-generator.ts`) a partir del FUT ya
  editado en la vista previa y lo entrega directo para descargar. No se
  guarda nada en el servidor.

## Requisitos

- Node.js 20+

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Variables de entorno

Copia `.env.example` a `.env.local` y completa el valor real:

```bash
cp .env.example .env.local
```

| Variable | Descripción |
|---|---|
| `UNDAC_API_BASE_URL` | URL base (con tokens) del endpoint institucional de UNDAC usado para el autocompletado por código de matrícula. Sin esta variable, esa función responde con un error controlado; el resto de la app sigue funcionando. |

## Deploy en Vercel

1. Importa este repositorio en Vercel.
2. En **Settings → Environment Variables**, agrega `UNDAC_API_BASE_URL`
   con el valor real.
3. Deploy. `next.config.ts` ya incluye `outputFileTracingIncludes` para
   que las funciones serverless empaqueten el logo y la marca de agua de
   `public/img/`, necesarios para generar el `.docx`.

Recuerda que el autocompletado por API solo funcionará para visitantes
conectados a la red institucional de UNDAC, sin importar dónde esté
desplegada la app.

## Estructura

```
web/
├── app/
│   ├── api/consultar-estudiante/route.ts   # Proxy a la API de UNDAC
│   ├── api/generar-docx/route.ts            # Genera y entrega el .docx
│   └── page.tsx                             # Punto de entrada (renderiza Wizard)
├── components/
│   ├── Wizard.tsx                           # Flujo completo del formulario
│   ├── FutDocument.tsx                      # Vista previa del FUT
│   └── ...
├── lib/
│   ├── catalogo.ts                          # Catálogo de trámites (espejo de core/catalogo.py)
│   ├── constructor.ts                       # Combina catálogo + datos del usuario
│   ├── docx-generator.ts                    # Generador del .docx
│   └── validadores.ts                       # Validaciones (DNI, celular, correo, etc.)
└── public/img/                              # Logo y marca de agua institucional
```
