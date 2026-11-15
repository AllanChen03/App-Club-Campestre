import React, { useEffect, useState } from 'react';
import { obtenerEstadoCuentaAPI } from '../api/finanzas';

export default function EstadoCuenta({ idSocio }) {
  const [data, setData] = useState({ cargos: [], pagos: [], saldoTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [mostrarModalPdf, setMostrarModalPdf] = useState(false); // Estado para controlar el modal

  useEffect(() => {
    if (!idSocio) {
      setLoading(false);
      return;
    }
    obtenerEstadoCuentaAPI(idSocio)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [idSocio]);

  if (loading) {
    return <div className="cargando" style={{ padding: '40px', textAlign: 'center' }}>Cargando estado de cuenta...</div>;
  }

  const totalPeriodo = data.cargos.reduce((acc, curr) => acc + Number(curr.monto), 0);
  const pendiente = data.cargos
    .filter(c => c.estado === 'Pendiente' || c.estado === 'Parcial')
    .reduce((acc, curr) => acc + Number(curr.monto), 0);
  const pagado = data.cargos
    .filter(c => c.estado === 'Pagado')
    .reduce((acc, curr) => acc + Number(curr.monto), 0);
  const vencido = data.cargos
    .filter(c => c.estado === 'Vencido' || (c.estado === 'Pendiente' && new Date(c.fecha_vencimiento) < new Date()))
    .reduce((acc, curr) => acc + Number(curr.monto), 0);

  const urlPdf = `http://localhost:3000/api/finanzas/estado-cuenta/${idSocio}/pdf`;

  return (
    <div className="app__contenido">
      {/* Cabecera y botón de PDF que abre el modal */}
      <div className="panel__encabezado" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="inicio__saludo" style={{ fontSize: '30px' }}>Estado de cuenta</h1>
          <p className="inicio__fecha" style={{ margin: '4px 0 0' }}>
            Periodo: octubre 2026  •  Fecha límite de pago: 25/10/2026
          </p>
        </div>
        {idSocio && (
          <button
            onClick={() => setMostrarModalPdf(true)}
            className="boton boton--oscuro"
          >
            Descargar PDF
          </button>
        )}
      </div>

      {/* Tarjetas de Resumen (4 métricas) */}
      <div className="resumen" style={{ marginBottom: '32px' }}>
        <div className="resumen__tarjeta">
          <div className="resumen__etiqueta">Total del periodo</div>
          <div className="resumen__valor">₡{totalPeriodo.toLocaleString()}</div>
        </div>
        <div className="resumen__tarjeta">
          <div className="resumen__etiqueta">Pagado</div>
          <div className="resumen__valor texto-verde">₡{pagado.toLocaleString()}</div>
        </div>
        <div className="resumen__tarjeta">
          <div className="resumen__etiqueta">Pendiente</div>
          <div className="resumen__valor texto-ambar">₡{pendiente.toLocaleString()}</div>
        </div>
        <div className="resumen__tarjeta">
          <div className="resumen__etiqueta">Vencido</div>
          <div className="resumen__valor texto-rojo">₡{vencido.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabla de Cargos del Periodo */}
      <div className="tabla-tarjeta" style={{ marginBottom: '16px' }}>
        <div className="tabla__scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Fecha</th>
                <th>Fecha límite</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.cargos && data.cargos.length > 0 ? (
                data.cargos.map((cargo) => (
                  <tr key={cargo.id_cargo}>
                    <td style={{ fontWeight: 600 }}>{cargo.concepto}</td>
                    <td>{cargo.fecha_emision || '01/10/2026'}</td>
                    <td>{cargo.fecha_vencimiento}</td>
                    <td style={{ fontWeight: 600 }}>₡{Number(cargo.monto).toLocaleString()}</td>
                    <td>
                      <span className={`tabla__estado ${
                        cargo.estado === 'Pagado' ? 'texto-verde' :
                        cargo.estado === 'Pendiente' ? 'texto-ambar' : 'texto-rojo'
                      }`}>
                        {cargo.estado}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="tabla__vacio">
                    No hay cargos registrados para este periodo.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" className="tabla__pie" style={{ textAlign: 'right' }}>Total del periodo</td>
                <td colSpan="2" className="tabla__pie">₡{totalPeriodo.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="caja__nota" style={{ marginBottom: '36px' }}>
        Los pagos se realizan en la administración del club y se reflejan aquí una vez registrados.
      </p>

      {/* Sección de Periodos Anteriores */}
      <h2 className="seccion__titulo" style={{ fontSize: '20px', marginBottom: '16px' }}>Periodos anteriores</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="tabla-tarjeta" style={{ margin: 0, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '40px', alignItems: 'center', fontSize: '15px' }}>
            <span style={{ fontWeight: 600 }}>Septiembre 2026</span>
            <span style={{ color: 'var(--texto-suave)' }}>₡85,000</span>
            <span className="texto-verde" style={{ fontWeight: 600 }}>Pagado</span>
          </div>
          {idSocio && (
            <button onClick={() => setMostrarModalPdf(true)} className="enlace-boton">
              Ver PDF
            </button>
          )}
        </div>
      </div>

      {/* MODAL DE VISTA PREVIA DEL PDF */}
      {mostrarModalPdf && (
        <div className="modal-fondo">
          <div className="modal" style={{ maxWidth: '750px', padding: '40px' }}>
            
            {/* Cabecera del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: '600', margin: 0 }}>
                Vista previa del PDF
              </h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setMostrarModalPdf(false)}
                  className="boton boton--secundario boton--chico"
                >
                  Volver
                </button>
                <a
                  href={urlPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="boton boton--oscuro boton--chico"
                  style={{ textDecoration: 'none' }}
                >
                  Descargar
                </a>
              </div>
            </div>

            {/* Documento simulado (Vista previa de la maqueta) */}
            <div style={{ background: '#ffffff', border: '1px solid var(--borde)', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontWeight: 'bold', color: '#1f4d3d', fontSize: '16px' }}>Club Valle Alto</span>
                <span style={{ fontSize: '12px', color: 'var(--texto-suave)' }}>Emitido el 15/10/2026</span>
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 'bold', marginBottom: '16px' }}>
                Estado de cuenta, octubre 2026
              </h3>

              <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginBottom: '24px', lineHeight: '1.6' }}>
                <p>Socia: Daniela Rojas Solano</p>
                <p>Cédula: 1-1234-0567</p>
                <p>Membresía: Familiar  •  Socio N.º 00248</p>
              </div>

              <hr style={{ border: '0', borderTop: '1px solid var(--borde)', marginBottom: '20px' }} />

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--borde)', textAlign: 'left', color: 'var(--texto-suave)', fontSize: '12px' }}>
                    <th style={{ paddingBottom: '8px' }}>Concepto</th>
                    <th style={{ paddingBottom: '8px' }}>Fecha límite</th>
                    <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 0' }}>Cuota Familiar, octubre 2026</td>
                    <td style={{ padding: '10px 0' }}>25/10/2026</td>
                    <td style={{ padding: '10px 0', textAlign: 'right' }}>₡85 000</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 0' }}>Alquiler de palos, golf 03/10/2026</td>
                    <td style={{ padding: '10px 0' }}>25/10/2026</td>
                    <td style={{ padding: '10px 0', textAlign: 'right' }}>₡8 000</td>
                  </tr>
                </tbody>
              </table>

              <hr style={{ border: '0', borderTop: '1px solid var(--borde)', marginBottom: '16px' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px', marginBottom: '24px' }}>
                <span>Total pendiente</span>
                <span>₡93 000</span>
              </div>

              <p style={{ fontSize: '11px', color: 'var(--texto-suave)' }}>
                Los pagos se realizan en la administración del club. Este documento es un resumen informativo.
              </p>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}