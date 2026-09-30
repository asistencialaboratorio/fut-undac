import { FutData } from "@/lib/constructor";
import "./FutDocument.css";

function Valor({ children }: { children: React.ReactNode }) {
  return <div className="fut-valor">{children || " "}</div>;
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <div className="fut-etiqueta">{children}</div>;
}

export default function FutDocument({ fut }: { fut: FutData }) {
  const facultadLinea = [fut.facultad, fut.escuela, fut.especialidad]
    .filter((v) => v && v.trim())
    .join("   /   ");

  const solicitoLineas = fut.solicito.split("\n");

  return (
    <div className="fut-page" id="fut-document">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/undac_watermark.png" alt="" className="fut-watermark" />
      <div className="fut-content">
        <div className="fut-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/undac_logo.jpg" alt="Logo UNDAC" />
          <div className="fut-header-titulo">
            <h1>UNIVERSIDAD NACIONAL DANIEL ALCIDES CARRIÓN</h1>
            <h2>FORMULARIO ÚNICO DE TRÁMITE</h2>
          </div>
          <div style={{ width: 56 }} />
        </div>

        <div className="fut-solicito">
          {solicitoLineas.map((linea, i) => (
            <div className="linea" key={i}>
              {i === 0 && <b>SOLICITO: </b>}
              {linea}
            </div>
          ))}
        </div>

        <div className="fut-campo">
          <Valor>{fut.destinatario}</Valor>
          <Etiqueta>2. DESTINATARIO</Etiqueta>
        </div>

        <div className="fut-campo">
          <Valor>{fut.nombresApellidos}</Valor>
          <Etiqueta>3. DATOS DEL USUARIO (APELLIDOS Y NOMBRES)</Etiqueta>
        </div>

        <div className="fut-campo">
          <Valor>{fut.cargoCentroTrabajo}</Valor>
          <Etiqueta>4. CARGO ACTUAL Y/O CENTRO DE TRABAJO</Etiqueta>
        </div>

        <div className="fut-campo fut-fila-doble">
          <Valor>{fut.dni}</Valor>
          <Valor>{fut.codigo}</Valor>
        </div>
        <div className="fut-fila-doble" style={{ marginTop: -6, marginBottom: 8 }}>
          <Etiqueta>5. D.N.I.</Etiqueta>
          <Etiqueta>6. CÓDIGO DE MATRÍCULA</Etiqueta>
        </div>

        <div className="fut-campo fut-fila-doble">
          <Valor>{fut.celular}</Valor>
          <Valor>{fut.correo}</Valor>
        </div>
        <div className="fut-fila-doble" style={{ marginTop: -6, marginBottom: 8 }}>
          <Etiqueta>7. N° CELULAR/TELF.</Etiqueta>
          <Etiqueta>8. CORREO ELECTRÓNICO</Etiqueta>
        </div>

        <div className="fut-campo">
          <Valor>{facultadLinea}</Valor>
          <Etiqueta>9. FACULTAD / ESCUELA PROFESIONAL / ESPECIALIDAD</Etiqueta>
        </div>

        <div className="fut-campo">
          <Valor>{fut.domicilio}</Valor>
          <Etiqueta>10. DOMICILIO DEL USUARIO (Calle, Distrito, Provincia Y Región)</Etiqueta>
        </div>

        <div className="fut-campo fut-fundamentacion">
          <Etiqueta>11. FUNDAMENTACIÓN DEL PEDIDO</Etiqueta>
          <div className="fut-valor">{fut.fundamentacion}</div>
        </div>

        <div className="fut-anexo-fecha">
          <div>
            <b>12. ANEXO.</b>
          </div>
          <div>
            <b>13. FECHA:</b> {fut.fecha}
          </div>
        </div>
        <div className="fut-campo" style={{ minHeight: "2.2em" }}>
          <div className="fut-valor">{fut.anexo}</div>
        </div>

        <div className="fut-firma">
          <div>
            <b>14. FIRMA:</b>
          </div>
          <div className="fut-valor" style={{ minHeight: "1.6em" }} />
        </div>

        <hr className="fut-separador" />

        <div className="fut-talon-fila">
          <div>
            <b>FUNDAMENTACIÓN DEL PEDIDO:</b> {fut.sumilla}
          </div>
          <div>
            <b>FOLIO:</b> ______________
          </div>
        </div>
        <div className="fut-talon-fila">
          <div>
            <b>APELLIDOS Y NOMBRES:</b> {fut.nombresApellidos}
          </div>
          <div>
            <b>N° DE REGISTRO:</b> ______________
          </div>
        </div>
        <div className="fut-talon-fila" style={{ borderBottom: "none" }}>
          <div>&nbsp;</div>
          <div>
            <b>FECHA:</b> ______________
          </div>
        </div>
        <div className="fut-fila-triple">
          <div className="fut-talon-triple-valor">{fut.facultad}</div>
          <div className="fut-talon-triple-valor">{fut.escuela}</div>
          <div className="fut-talon-triple-valor">{fut.especialidad}</div>
        </div>
        <div className="fut-fila-triple">
          <div className="fut-talon-triple-etiqueta">FACULTAD</div>
          <div className="fut-talon-triple-etiqueta">ESCUELA PROFESIONAL</div>
          <div className="fut-talon-triple-etiqueta">ESPECIALIDAD</div>
        </div>
      </div>
    </div>
  );
}
