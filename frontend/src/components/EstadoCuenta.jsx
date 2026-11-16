import React, { useCallback, useEffect, useState } from 'react';
import Alerta from './Alerta';
import Modal from './Modal';
import { descargarPdfEstadoCuentaAPI, obtenerEstadoCuentaAPI } from '../api/finanzas';
import { colones, fecha } from '../utils/formato';

const CLASE_ESTADO = { Pagado: 'texto-verde', Pendiente: 'texto-ambar', Parcial: 'texto-ambar', Vencido: 'texto-rojo' };
const capital = (t = '') => t.charAt(0).toUpperCase() + t.slice(1);

// Estado de cuenta del socio: periodo actual, periodos anteriores y PDF.
// Todos los datos vienen del backend (/api/finanzas/estado-cuenta).
export default function EstadoCuenta({ idSocio }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [vista, setVista] = useState(null); // periodo que se previsualiza en PDF
  const [descargando, setDescargando] = useState(false);
  const [errorPdf, setErrorPdf] = useState('');

  useEffect(() => {
    if (!idSocio) return;
    obtenerEstadoCuentaAPI(idSocio)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [idSocio]);

  const cerrarVista = useCallback(() => { setVista(null); setErrorPdf(''); }, []);

  // El PDF se pide con el token de la sesión
  async function descargarPdf() {
    setDescargando(true);
    setErrorPdf('');
    try {
      await descargarPdfEstadoCuentaAPI(idSocio, vista.esActual ? null : vista.periodo);
    } catch (err) {
      setErrorPdf(err.message);
    } finally {
      setDescargando(false);
    }
  }

  if (!idSocio) return <div className="app__contenido"><Alerta>No se encontró su cuenta de socio.</Alerta></div>;
  if (error) return <div className="app__contenido"><Alerta>{error}</Alerta></div>;
  if (!data) {
    return <div className="cargando" style={{ padding: '40px', textAlign: 'center' }}>Cargando estado de cuenta...</div>;
  }

  const r = data.resumen;
  const actual = { esActual: true, periodo: data.periodo, nombre: data.nombre_periodo, cargos: data.cargos, ...r };

  return (
    <div className="app__contenido">
      <div className="panel__encabezado" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="inicio__saludo" style={{ fontSize: '30px' }}>Estado de cuenta</h1>
          <p className="inicio__fecha" style={{ margin: '4px 0 0' }}>
            Periodo: {data.nombre_periodo}
            {data.proxima_fecha_limite
              ? `  •  Próxima fecha límite de pago: ${fecha(data.proxima_fecha_limite)}`
              : '  •  Sin saldo pendiente'}
          </p>
        </div>
        <button type="button" onClick={() => setVista(actual)} className="boton boton--oscuro">
          Descargar PDF
        </button>
      </div>

      <div className="resumen" style={{ marginBottom: '32px' }}>
        <div className="resumen__tarjeta">
          <div className="resumen__etiqueta">Total del periodo</div>
          <div className="resumen__valor">{colones(r.facturado)}</div>
        </div>
        <div className="resumen__tarjeta">
          <div className="resumen__etiqueta">Pagado</div>
          <div className="resumen__valor texto-verde">{colones(r.pagado)}</div>
        </div>
        <div className="resumen__tarjeta">
          <div className="resumen__etiqueta">Pendiente</div>
          <div className="resumen__valor texto-ambar">{colones(r.pendiente)}</div>
        </div>
        <div className="resumen__tarjeta">
          <div className="resumen__etiqueta">Vencido</div>
          <div className="resumen__valor texto-rojo">{colones(r.vencido)}</div>
        </div>
      </div>

      <div className="tabla-tarjeta" style={{ marginBottom: '16px' }}>
        <div className="tabla__scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Emitido</th>
                <th>Fecha límite</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.cargos.length > 0 ? (
                data.cargos.map((cargo) => (
                  <tr key={cargo.id_cargo} style={{ cursor: 'default' }}>
                    <td style={{ fontWeight: 600, whiteSpace: 'normal' }}>
                      {cargo.concepto}
                      {cargo.descripcion && (
                        <div style={{ fontWeight: 400, fontSize: '13px', color: 'var(--texto-suave)' }}>{cargo.descripcion}</div>
                      )}
                    </td>
                    <td>{fecha(cargo.fecha_emision)}</td>
                    <td>{fecha(cargo.fecha_vencimiento)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {colones(cargo.monto)}
                      {cargo.estado_actual === 'Parcial' && (
                        <div style={{ fontWeight: 400, fontSize: '13px' }}>Saldo {colones(cargo.saldo)}</div>
                      )}
                    </td>
                    <td>
                      <span className={`tabla__estado ${CLASE_ESTADO[cargo.estado_actual] ?? ''}`}>{cargo.estado_actual}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="tabla__vacio">No hay cargos en este periodo.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" className="tabla__pie" style={{ textAlign: 'right' }}>Saldo pendiente</td>
                <td colSpan="2" className="tabla__pie">{colones(r.saldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="caja__nota" style={{ marginBottom: '36px' }}>
        Incluye lo emitido este mes y cualquier cargo anterior que siga sin pagar. Los pagos se realizan en la
        administración del club y se reflejan aquí una vez registrados.
      </p>

      <h2 className="seccion__titulo" style={{ fontSize: '20px', marginBottom: '16px' }}>Periodos anteriores</h2>
      {data.periodos.length === 0 ? (
        <p className="tabla__vacio">Todavía no hay periodos anteriores.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.periodos.map((p) => (
            <div key={p.periodo} className="tabla-tarjeta"
              style={{ margin: 0, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '40px', alignItems: 'center', fontSize: '15px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600 }}>{capital(p.nombre)}</span>
                <span style={{ color: 'var(--texto-suave)' }}>{colones(p.facturado)}</span>
                <span className={CLASE_ESTADO[p.estado]} style={{ fontWeight: 600 }}>{p.estado}</span>
              </div>
              <button type="button" onClick={() => setVista({ ...p, esActual: false })} className="enlace-boton">
                Ver PDF
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Vista previa del PDF con los mismos datos que se descargan */}
      {vista && (
        <Modal titulo="Vista previa del PDF" onCerrar={cerrarVista}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', margin: '0 40px 24px 0' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: '600', margin: 0 }}>Vista previa del PDF</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={cerrarVista} className="boton boton--secundario boton--chico">Volver</button>
              <button type="button" onClick={descargarPdf} disabled={descargando} className="boton boton--oscuro boton--chico">
                {descargando ? 'Descargando…' : 'Descargar'}
              </button>
            </div>
          </div>
          {errorPdf && <p className="campo__mensaje" role="alert" style={{ marginBottom: '16px' }}>{errorPdf}</p>}

          <div style={{ background: 'var(--blanco)', border: '1px solid var(--borde)', borderRadius: '12px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--verde)', fontSize: '16px' }}>Club Valle Alto</span>
              <span style={{ fontSize: '12px', color: 'var(--texto-suave)' }}>
                Emitido el {new Intl.DateTimeFormat('es-CR', { timeZone: 'America/Costa_Rica' }).format(new Date())}
              </span>
            </div>

            <h3 style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 'bold', marginBottom: '16px' }}>
              Estado de cuenta, {vista.nombre}
            </h3>

            <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginBottom: '24px', lineHeight: '1.6' }}>
              <p>Socio: {data.socio.nombre_completo}</p>
              <p>Cédula: {data.socio.cedula}</p>
              <p>Membresía: {data.socio.membresia}  •  Socio N.º {data.socio.numero_socio}</p>
            </div>

            <div className="tabla__scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--borde)', textAlign: 'left', color: 'var(--texto-suave)', fontSize: '12px' }}>
                    <th style={{ paddingBottom: '8px' }}>Concepto</th>
                    <th style={{ paddingBottom: '8px' }}>Fecha límite</th>
                    <th style={{ paddingBottom: '8px' }}>Estado</th>
                    <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.cargos.length === 0 && (
                    <tr><td colSpan="4" style={{ padding: '10px 0', color: 'var(--texto-suave)' }}>No hay cargos en este periodo.</td></tr>
                  )}
                  {vista.cargos.map((c) => (
                    <tr key={c.id_cargo} style={{ borderBottom: '1px solid var(--borde)' }}>
                      <td style={{ padding: '10px 8px 10px 0' }}>{c.concepto}</td>
                      <td style={{ padding: '10px 8px 10px 0' }}>{fecha(c.fecha_vencimiento)}</td>
                      <td style={{ padding: '10px 8px 10px 0' }} className={CLASE_ESTADO[c.estado_actual]}>{c.estado_actual}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right' }}>{colones(c.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total del periodo</span><span>{colones(vista.facturado)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pagado</span><span>{colones(vista.pagado)}</span></div>
              {vista.vencido > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Vencido</span><span>{colones(vista.vencido)}</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
                <span>Total pendiente</span><span>{colones(vista.saldo)}</span>
              </div>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--texto-suave)', marginTop: '20px' }}>
              Los pagos se realizan en la administración del club. Este documento es un resumen informativo.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
