"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { FutData } from "@/lib/constructor";
import "./FutDocument.css";

export type CampoEditable =
  | "solicito"
  | "sumilla"
  | "destinatario"
  | "nombresApellidos"
  | "cargoCentroTrabajo"
  | "dni"
  | "codigo"
  | "celular"
  | "correo"
  | "facultad"
  | "escuela"
  | "especialidad"
  | "domicilio"
  | "fundamentacion"
  | "anexo"
  | "fecha";

// A4 a 96 dpi
const A4_ANCHO_PX = 793.7;
const A4_ALTO_PX = 1122.5;
const ESCALA_MINIMA_LETRA = 0.62;

type Setter = (campo: CampoEditable) => (valor: string) => void;

function leerTexto(el: HTMLElement): string {
  return el.innerText.replace(/\r/g, "").replace(/ /g, " ");
}

function Editable({
  value,
  onChange,
  etiqueta,
  placeholder = "",
  inline = false,
  flujo = false,
  multilinea = false,
}: {
  value: string;
  onChange: (valor: string) => void;
  etiqueta: string;
  placeholder?: string;
  // inline: caja en línea con ancho mínimo; flujo: el texto sigue corriendo
  // después de lo que lo precede (como en un renglón del formulario).
  inline?: boolean;
  flujo?: boolean;
  multilinea?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Solo texto plano; los navegadores sin "plaintext-only" usan "true" y se
    // filtra el formato en onPaste.
    el.contentEditable = "plaintext-only";
    if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && leerTexto(el) !== value) el.textContent = value;
  }, [value]);

  function alEscribir(e: FormEvent<HTMLSpanElement>) {
    const el = e.currentTarget;
    if (!el.textContent) el.textContent = "";
    onChange(leerTexto(el));
  }

  function alPresionar(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Escape" || (e.key === "Enter" && !multilinea)) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  function alPegar(e: ClipboardEvent<HTMLSpanElement>) {
    e.preventDefault();
    const texto = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, multilinea ? texto : texto.replace(/\s*\n\s*/g, " "));
  }

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={etiqueta}
      aria-multiline={multilinea}
      spellCheck={false}
      data-ph={placeholder}
      className={`fut-edit ${inline ? "fut-inline" : flujo ? "fut-flujo" : "fut-block"}`}
      onInput={alEscribir}
      onKeyDown={alPresionar}
      onPaste={alPegar}
    />
  );
}

// Bloque de renglones punteados. Un clic en una parte vacía del renglón
// lleva el cursor al final del texto editable que contiene.
function Reglado({ lineas = 1, className = "", children }: { lineas?: number; className?: string; children: ReactNode }) {
  function alHacerClic(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const el = e.currentTarget.querySelector<HTMLElement>("[role=textbox]");
    if (!el) return;
    el.focus();
    const rango = document.createRange();
    rango.selectNodeContents(el);
    rango.collapse(false);
    const seleccion = window.getSelection();
    seleccion?.removeAllRanges();
    seleccion?.addRange(rango);
  }
  return (
    <div className={`fut-reglado ${className}`} style={{ "--n": lineas } as CSSProperties} onClick={alHacerClic}>
      {children}
    </div>
  );
}

function TresColumnas({
  fut,
  set,
  etiquetas,
  prefijo,
}: {
  fut: FutData;
  set: Setter;
  etiquetas: [string, string, string];
  prefijo?: string;
}) {
  return (
    <>
      <div className="fut-tres">
        <div className="fut-celda">
          <Editable etiqueta="Facultad" placeholder="Facultad" value={fut.facultad} onChange={set("facultad")} />
        </div>
        <span className="fut-barra">/</span>
        <div className="fut-celda">
          <Editable etiqueta="Escuela profesional" placeholder="Escuela" value={fut.escuela} onChange={set("escuela")} />
        </div>
        <span className="fut-barra">/</span>
        <div className="fut-celda">
          <Editable
            etiqueta="Especialidad"
            placeholder="Especialidad"
            value={fut.especialidad}
            onChange={set("especialidad")}
          />
        </div>
      </div>
      <div className="fut-tres fut-tres-etq">
        <span>
          {prefijo}
          {etiquetas[0]}
        </span>
        <span />
        <span>{etiquetas[1]}</span>
        <span />
        <span>{etiquetas[2]}</span>
      </div>
    </>
  );
}

function Campo({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <div className="fut-campo">
      <div className="fut-valor">{children}</div>
      <div className="fut-etiqueta">
        {numero}. {titulo}
      </div>
    </div>
  );
}

export default function FutDocument({
  fut,
  onChange,
  onDesborde,
}: {
  fut: FutData;
  onChange: (campo: CampoEditable, valor: string) => void;
  onDesborde?: (desborda: boolean) => void;
}) {
  const paginaRef = useRef<HTMLDivElement>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);
  const desbordaAntes = useRef(false);

  // Modo compacto adaptativo: si el contenido no cabe en la hoja, se reduce la
  // letra de a poco hasta que entre (o hasta el mínimo legible).
  useLayoutEffect(() => {
    const pagina = paginaRef.current;
    const contenido = contenidoRef.current;
    if (!pagina || !contenido) return;
    const desborda = () => contenido.scrollHeight > contenido.clientHeight + 1;
    let escala = 1;
    pagina.style.setProperty("--s", "1");
    while (desborda() && escala > ESCALA_MINIMA_LETRA) {
      escala = Math.round((escala - 0.02) * 100) / 100;
      pagina.style.setProperty("--s", String(escala));
    }
    const hayDesborde = desborda();
    if (hayDesborde !== desbordaAntes.current) {
      desbordaAntes.current = hayDesborde;
      onDesborde?.(hayDesborde);
    }
  });

  const set: Setter = (campo) => (valor) => onChange(campo, valor);

  return (
    <div ref={paginaRef} className="fut-page fut-editable" id="fut-document">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/undac_watermark.png" alt="" className="fut-watermark" />
      <div className="fut-marco" />
      <div className="fut-inner">
        <div ref={contenidoRef} className="fut-content">
          <div className="fut-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/undac_logo.jpg" alt="Logo UNDAC" />
            <div className="fut-titulo">
              <h1>UNIVERSIDAD NACIONAL DANIEL ALCIDES CARRIÓN</h1>
              <h2>FORMULARIO ÚNICO DE TRÁMITE</h2>
            </div>
          </div>
          <div className="fut-linea-titulo" />

          <div className="fut-solicito">
            <Reglado lineas={3}>
              <b>SOLICITO: </b>
              <Editable
                flujo
                multilinea
                etiqueta="Solicito"
                placeholder="Qué solicitas"
                value={fut.solicito}
                onChange={set("solicito")}
              />
            </Reglado>
          </div>
          <div className="fut-sumilla-etq">1. SUMILLA</div>

          <Campo numero={2} titulo="DESTINATARIO">
            <Editable etiqueta="Destinatario" value={fut.destinatario} onChange={set("destinatario")} />
          </Campo>

          <Campo numero={3} titulo="DATOS DEL USUARIO (APELLIDOS Y NOMBRES)">
            <Editable etiqueta="Apellidos y nombres" value={fut.nombresApellidos} onChange={set("nombresApellidos")} />
          </Campo>

          <Campo numero={4} titulo="CARGO ACTUAL Y/O CENTRO DE TRABAJO">
            <Editable etiqueta="Cargo o centro de trabajo" value={fut.cargoCentroTrabajo} onChange={set("cargoCentroTrabajo")} />
          </Campo>

          <div className="fut-campo">
            <div className="fut-doble">
              <Editable etiqueta="DNI" value={fut.dni} onChange={set("dni")} />
              <Editable etiqueta="Código de matrícula" value={fut.codigo} onChange={set("codigo")} />
            </div>
            <div className="fut-doble-etiquetas">
              <span>5. D.N.I.</span>
              <span>6. CÓDIGO DE MATRÍCULA</span>
            </div>
          </div>

          <div className="fut-campo">
            <div className="fut-doble">
              <Editable etiqueta="Celular" value={fut.celular} onChange={set("celular")} />
              <Editable etiqueta="Correo electrónico" value={fut.correo} onChange={set("correo")} />
            </div>
            <div className="fut-doble-etiquetas">
              <span>7. N° CELULAR/TELF.</span>
              <span>8. CORREO ELECTRÓNICO</span>
            </div>
          </div>

          <div className="fut-campo">
            <TresColumnas
              fut={fut}
              set={set}
              prefijo="9. "
              etiquetas={["FACULTAD", "ESCUELA PROFESIONAL", "ESPECIALIDAD"]}
            />
          </div>

          <Campo numero={10} titulo="DOMICILIO DEL USUARIO (Calle, Distrito, Provincia Y Región)">
            <Editable etiqueta="Domicilio" value={fut.domicilio} onChange={set("domicilio")} />
          </Campo>

          <div className="fut-campo fut-fundamentacion">
            <div className="fut-etiqueta">11. FUNDAMENTACIÓN DEL PEDIDO</div>
            <Reglado lineas={4}>
              <Editable
                multilinea
                etiqueta="Fundamentación del pedido"
                placeholder="Escribe la fundamentación"
                value={fut.fundamentacion}
                onChange={set("fundamentacion")}
              />
            </Reglado>
          </div>

          <div className="fut-cierre">
            <div>
              <b>12. ANEXO.</b>
              <Reglado lineas={3}>
                <Editable
                  flujo
                  multilinea
                  etiqueta="Anexo"
                  placeholder="Documentos que adjuntas"
                  value={fut.anexo}
                  onChange={set("anexo")}
                />
              </Reglado>
            </div>
            <div>
              <Reglado>
                <b>13. FECHA: </b>
                <Editable flujo etiqueta="Fecha" value={fut.fecha} onChange={set("fecha")} />
              </Reglado>
              <Reglado className="fut-firma">
                <b>14. FIRMA:</b>
              </Reglado>
            </div>
          </div>

          <div className="fut-igual" aria-hidden="true">
            {"=".repeat(98)}
          </div>

          <div className="fut-talon">
            <Reglado>
              <b>FUNDAMENTACIÓN DEL PEDIDO: </b>
              <Editable flujo etiqueta="Sumilla" value={fut.sumilla} onChange={set("sumilla")} />
            </Reglado>
            <div className="fut-talon-fila">
              <Reglado>
                <b>APELLIDOS Y NOMBRES: </b>
                <Editable
                  flujo
                  etiqueta="Apellidos y nombres (talón)"
                  value={fut.nombresApellidos}
                  onChange={set("nombresApellidos")}
                />
              </Reglado>
              <Reglado>
                <b>FOLIO:</b>
              </Reglado>
            </div>
            <div className="fut-talon-fila">
              <Reglado>
                <b>N° DE REGISTRO:</b>
              </Reglado>
              <Reglado>
                <b>FECHA:</b>
              </Reglado>
            </div>
            <div className="fut-campo">
              <TresColumnas fut={fut} set={set} etiquetas={["FACULTAD", "ESCUELA PROFESIONAL", "ESPECIALIDAD"]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Muestra la hoja A4 a tamaño fijo y, si la pantalla es más angosta, la
// reduce proporcionalmente (como una imagen) sin cambiar su disposición.
export function HojaA4({ children }: { children: ReactNode }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const medir = () => setEscala(Math.min(1, area.clientWidth / A4_ANCHO_PX));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(area);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={areaRef} className="fut-hoja-area">
      <div className="fut-escala-wrap" style={{ width: A4_ANCHO_PX * escala, height: A4_ALTO_PX * escala }}>
        <div className="fut-escala fut-sombra" style={{ transform: `scale(${escala})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
