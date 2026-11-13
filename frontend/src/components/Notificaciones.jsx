import { useEffect, useState, useCallback } from 'react';
import Alerta from '../components/Alerta';
import Modal from '../components/Modal';
import { notificacionesApi } from '../api/notificaciones';
import { fecha } from '../utils/formato';

export default function Notificaciones() {
  const [pestanaActiva, setPestanaActiva] = useState('plantillas'); // 'plantillas' o 'historial'
  const [plantillas, setPlantillas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [usuarios, setUsuarios] = useState([]); // Lista de usuarios para el selector
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  
  // Estados para los modales
  const [plantillaEditando, setPlantillaEditando] = useState(null);
  const [historialVisualizando, setHistorialVisualizando] = useState(null);
  const [nuevaNotificacionAbierta, setNuevaNotificacionAbierta] = useState(false);
  
  const [ocupado, setOcupado] = useState(false);
  // Estados para los filtros del historial
  const [filtrosHistorial, setFiltrosHistorial] = useState({
    tipo: 'Todas',
    fechaDesde: '',
    fechaHasta: '',
    busquedaSocio: ''
  });
  // Cargar datos desde la API de forma unificada y segura
  const cargarDatos = useCallback(async () => {
    setError('');
    try {
      const [resPlantillas, resHistorial, resUsuarios] = await Promise.all([
        notificacionesApi.listarPlantillas(),
        notificacionesApi.listarHistorial(),
        notificacionesApi.listarUsuarios()
      ]);
      setPlantillas(resPlantillas);
      setHistorial(resHistorial);
      setUsuarios(resUsuarios || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Guardar cambios de plantilla editada
  async function guardarPlantilla(e) {
    e.preventDefault();
    if (!plantillaEditando) return;
    setOcupado(true);
    try {
      await notificacionesApi.actualizarPlantilla(plantillaEditando.id_plantilla, {
        nombre: plantillaEditando.nombre,
        tipo: plantillaEditando.tipo,
        asunto: plantillaEditando.asunto,
        contenido: plantillaEditando.contenido,
        estado: plantillaEditando.estado
      });
      setAviso('Plantilla actualizada exitosamente');
      setPlantillaEditando(null);
      cargarDatos();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  // Enviar nueva notificación desde el modal independiente
  async function enviarNuevaNotificacion(datosFormulario) {
    if (!datosFormulario.id_usuario || !datosFormulario.id_plantilla) {
      setError('Por favor selecciona un usuario y una plantilla');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      await notificacionesApi.enviar(datosFormulario);
      setAviso('Notificación enviada y registrada exitosamente');
      setNuevaNotificacionAbierta(false);
      cargarDatos();
      setPestanaActiva('historial'); // Cambiar automáticamente a la pestaña de historial
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  // Obtener el tipo real guardado o detectarlo por el nombre
  const obtenerTipoPlantilla = (p) => {
    if (p.tipo) return p.tipo;
    const n = (p.nombre || '').toLowerCase();
    if (n.includes('reserva')) return 'Reserva';
    if (n.includes('pago') || n.includes('membresía') || n.includes('cuota')) return 'Pago';
    if (n.includes('bienvenida') || n.includes('registro')) return 'Registro';
    if (n.includes('estado de cuenta')) return 'Estado de cuenta';
    return 'General';
  };
// Filtrar el historial según los criterios seleccionados
  const historialFiltrado = historial.filter((h) => {
    // Filtro por tipo de plantilla
    const nombrePlantilla = (h.plantillas?.nombre || '').toLowerCase();
    if (filtrosHistorial.tipo !== 'Todas') {
      const tipoFiltro = filtrosHistorial.tipo.toLowerCase();
      if (!nombrePlantilla.includes(tipoFiltro)) return false;
    }

    // Filtro por búsqueda de socio (nombre o correo)
    if (filtrosHistorial.busquedaSocio.trim() !== '') {
      const textoBusqueda = filtrosHistorial.busquedaSocio.toLowerCase();
      const nombreSocio = (h.usuarios?.nombre_completo || '').toLowerCase();
      const correoSocio = (h.usuarios?.correo || '').toLowerCase();
      if (!nombreSocio.includes(textoBusqueda) && !correoSocio.includes(textoBusqueda)) {
        return false;
      }
    }

    // Filtros por fecha (desde / hasta)
    const fechaItem = new Date(h.fecha_envio || h.fecha_creacion);
    if (filtrosHistorial.fechaDesde) {
      const fechaDesde = new Date(filtrosHistorial.fechaDesde);
      if (fechaItem < fechaDesde) return false;
    }
    if (filtrosHistorial.fechaHasta) {
      const fechaHasta = new Date(filtrosHistorial.fechaHasta);
      fechaHasta.setHours(23, 59, 59); // Incluir todo el día final
      if (fechaItem > fechaHasta) return false;
    }

    return true;
  });
  const contarPorTipo = (tipoFiltro) => 
    plantillas.filter(p => obtenerTipoPlantilla(p) === tipoFiltro).length;

  return (
    <div className="panel">
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">Notificaciones</h1>
          <p className="inicio__fecha">Gestión de plantillas de correo e historial de envíos</p>
        </div>
      </header>

      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}
      {error && <Alerta>{error}</Alerta>}

      {/* Pestañas de navegación */}
      <div className="pestanas" style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid #e5e7eb' }}>
        <button
          type="button"
          onClick={() => setPestanaActiva('plantillas')}
          style={{
            background: 'none',
            border: 'none',
            paddingBottom: '0.75rem',
            cursor: 'pointer',
            fontWeight: pestanaActiva === 'plantillas' ? 'bold' : 'normal',
            borderBottom: pestanaActiva === 'plantillas' ? '2px solid #2d5a27' : 'none',
            color: pestanaActiva === 'plantillas' ? '#2d5a27' : '#6b7280'
          }}
        >
          Plantillas
        </button>
        <button
          type="button"
          onClick={() => setPestanaActiva('historial')}
          style={{
            background: 'none',
            border: 'none',
            paddingBottom: '0.75rem',
            cursor: 'pointer',
            fontWeight: pestanaActiva === 'historial' ? 'bold' : 'normal',
            borderBottom: pestanaActiva === 'historial' ? '2px solid #2d5a27' : 'none',
            color: pestanaActiva === 'historial' ? '#2d5a27' : '#6b7280'
          }}
        >
          Historial
        </button>
      </div>

      {/* Contenido de la pestaña Plantillas */}
      {pestanaActiva === 'plantillas' && (
        <div>
          <h2 className="seccion__titulo" style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>Plantillas de notificación</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{plantillas.length} plantillas de correo · se envían solas cuando ocurre el evento</p>
          
          {/* Tarjetas de resumen superiores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Registro</span>
              <div style={{ color: '#2d5a27', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem' }}>{contarPorTipo('Registro')} plantilla{contarPorTipo('Registro') !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Estado de cuenta</span>
              <div style={{ color: '#7c3aed', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem' }}>{contarPorTipo('Estado de cuenta')} plantilla{contarPorTipo('Estado de cuenta') !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Pago</span>
              <div style={{ color: '#d97706', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem' }}>{contarPorTipo('Pago')} plantilla{contarPorTipo('Pago') !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Reserva</span>
              <div style={{ color: '#2563eb', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem' }}>{contarPorTipo('Reserva')} plantilla{contarPorTipo('Reserva') !== 1 ? 's' : ''}</div>
            </div>
          </div>

          <section className="tabla-tarjeta" style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
            <div className="tabla__scroll">
              <table className="tabla" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontSize: '0.875rem' }}>
                    <th style={{ paddingBottom: '0.75rem' }}>Plantilla</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Tipo</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Asunto</th>
                    <th style={{ paddingBottom: '0.75rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {plantillas.map((p) => {
                    const tipoDetectado = obtenerTipoPlantilla(p);
                    return (
                      <tr key={p.id_plantilla ?? p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '1rem 0', fontWeight: '500' }}>{p.nombre}</td>
                        <td style={{ padding: '1rem 0' }}>
                          <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500', background: '#f3f4f6', display: 'inline-block' }}>
                            {tipoDetectado}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0', color: '#4b5563' }}>{p.asunto}</td>
                        <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                          <button 
                            type="button" 
                            className="enlace-boton" 
                            onClick={() => setPlantillaEditando({ ...p, tipo: tipoDetectado })}
                            style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#2d5a27', fontWeight: '500' }}
                          >
                            ✏️ Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Contenido de la pestaña Historial */}
      {/* Contenido de la pestaña Historial */}
      {pestanaActiva === 'historial' && (
        <div>
          {/* Cabecera del título e Historial */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 className="seccion__titulo" style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0, color: '#111827' }}>Historial de notificaciones</h2>
            <button 
              type="button" 
              className="boton boton--oscuro"
              onClick={() => setNuevaNotificacionAbierta(true)}
              style={{ background: '#1b3b22', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '9999px', fontWeight: '500', cursor: 'pointer' }}
            >
              + Nueva Notificación
            </button>
          </div>

          {/* Tarjeta de Filtros */}
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
            
            {/* Tipo de notificación */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Tipo de notificación</label>
              <select 
                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.9375rem' }}
                value={filtrosHistorial.tipo}
                onChange={(e) => setFiltrosHistorial({ ...filtrosHistorial, tipo: e.target.value })}
              >
                <option value="Todas">Todas</option>
                <option value="Reserva">Reserva</option>
                <option value="Estado de cuenta">Estado de cuenta</option>
                <option value="Pago">Pago</option>
                <option value="Registro">Registro</option>
              </select>
            </div>

            {/* Fecha desde */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Fecha desde</label>
              <input 
                type="date"
                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.9375rem' }}
                value={filtrosHistorial.fechaDesde}
                onChange={(e) => setFiltrosHistorial({ ...filtrosHistorial, fechaDesde: e.target.value })}
              />
            </div>

            {/* Fecha hasta */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Fecha hasta</label>
              <input 
                type="date"
                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.9375rem' }}
                value={filtrosHistorial.fechaHasta}
                onChange={(e) => setFiltrosHistorial({ ...filtrosHistorial, fechaHasta: e.target.value })}
              />
            </div>

            {/* Buscar socio */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Buscar socio</label>
              <input 
                type="text"
                placeholder="🔍 Nombre o correo del socio"
                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.9375rem' }}
                value={filtrosHistorial.busquedaSocio}
                onChange={(e) => setFiltrosHistorial({ ...filtrosHistorial, busquedaSocio: e.target.value })}
              />
            </div>

          </div>

          {/* Tabla de Historial con datos filtrados */}
          <section className="tabla-tarjeta" style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
            <div className="tabla__scroll">
              <table className="tabla" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontSize: '0.875rem' }}>
                    <th style={{ paddingBottom: '0.75rem' }}>Socio</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Tipo</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Asunto</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Estado</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Fecha y Hora</th>
                    <th style={{ paddingBottom: '0.75rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                        No se encontraron notificaciones con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    historialFiltrado.map((h) => {
                      const nombrePl = h.plantillas?.nombre || 'General';
                      // Estilos para la etiqueta tipo insignia según el tipo
                      let badgeBg = '#f3f4f6';
                      let badgeColor = '#374151';
                      if (nombrePl.toLowerCase().includes('reserva')) { badgeBg = '#dbeafe'; badgeColor = '#1e40af'; }
                      else if (nombrePl.toLowerCase().includes('estado')) { badgeBg = '#ede9fe'; badgeColor = '#6d28d9'; }
                      else if (nombrePl.toLowerCase().includes('pago')) { badgeBg = '#fef3c7'; badgeColor = '#b45309'; }
                      else if (nombrePl.toLowerCase().includes('registro')) { badgeBg = '#d1fae5'; badgeColor = '#065f46'; }

                      return (
                        <tr key={h.id_historial ?? h.id_notificacion} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '1rem 0', fontWeight: '500', color: '#111827' }}>{h.usuarios?.nombre_completo ?? '—'}</td>
                          <td style={{ padding: '1rem 0' }}>
                            <span style={{ padding: '0.3rem 0.8rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500', background: badgeBg, color: badgeColor, display: 'inline-block', border: '1px solid rgba(0,0,0,0.05)' }}>
                               {nombrePl}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 0', color: '#4b5563' }}>{h.asunto}</td>
                          <td style={{ padding: '1rem 0' }}>
                            <span style={{ 
                              padding: '0.25rem 0.6rem', 
                              borderRadius: '0.25rem', 
                              fontSize: '0.75rem', 
                              fontWeight: '500',
                              background: h.estado === 'Enviada' ? '#d1fae5' : h.estado === 'Fallida' ? '#fee2e2' : '#fef3c7',
                              color: h.estado === 'Enviada' ? '#065f46' : h.estado === 'Fallida' ? '#991b1b' : '#92400e'
                            }}>
                              {h.estado}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 0', color: '#4b5563' }}>{h.fecha_envio ? fecha(h.fecha_envio) : fecha(h.fecha_creacion)}</td>
                          <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                            <button 
                              type="button" 
                              className="enlace-boton" 
                              onClick={() => setHistorialVisualizando(h)}
                              style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#2d5a27', fontWeight: '500' }}
                            >
                              👁️ Ver
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pie de tabla con conteo dinámico */}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280', fontSize: '0.875rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
              <span>Mostrando {historialFiltrado.length} de {historial.length} notificaciones</span>
            </div>
          </section>
        </div>
      )}

      {/* Modal Nueva Notificación Independiente */}
      <ModalNuevaNotificacion 
        abierto={nuevaNotificacionAbierta}
        onCerrar={() => setNuevaNotificacionAbierta(false)}
        usuarios={usuarios}
        plantillas={plantillas}
        onEnviar={enviarNuevaNotificacion}
        ocupado={ocupado}
      />

      {/* Modal Editar Plantilla */}
      {plantillaEditando && (
        <FormularioEdicion 
          plantilla={plantillaEditando} 
          onCerrar={() => setPlantillaEditando(null)} 
          onGuardar={guardarPlantilla}
          ocupado={ocupado}
        />
      )}

      {/* Modal Ver Historial (Detalle de Notificación) */}
      {historialVisualizando && (
        <Modal titulo="Detalle de Notificación" onCerrar={() => setHistorialVisualizando(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '0.5rem' }}>
            
            {/* Fila superior: Socio y Correo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Socio</label>
                <div style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', fontSize: '0.9375rem', fontWeight: '500' }}>
                  {historialVisualizando.usuarios?.nombre_completo ?? '—'}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Correo</label>
                <div style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', fontSize: '0.9375rem' }}>
                  {historialVisualizando.usuarios?.correo ?? '—'}
                </div>
              </div>
            </div>

            {/* Tipo de Notificación con Insignia */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Tipo</label>
              <div>
                {(() => {
                  const nombrePl = historialVisualizando.plantillas?.nombre || 'General';
                  let badgeBg = '#f3f4f6';
                  let badgeColor = '#374151';
                  if (nombrePl.toLowerCase().includes('reserva')) { badgeBg = '#dbeafe'; badgeColor = '#1e40af'; }
                  else if (nombrePl.toLowerCase().includes('estado')) { badgeBg = '#ede9fe'; badgeColor = '#6d28d9'; }
                  else if (nombrePl.toLowerCase().includes('pago')) { badgeBg = '#fef3c7'; badgeColor = '#b45309'; }
                  else if (nombrePl.toLowerCase().includes('registro')) { badgeBg = '#d1fae5'; badgeColor = '#065f46'; }

                  return (
                    <span style={{ padding: '0.4rem 1rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: '500', background: badgeBg, color: badgeColor, display: 'inline-flex', alignItems: 'center', gap: '0.375rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                      📅 {nombrePl}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Fecha y Hora */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Fecha y Hora</label>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', fontSize: '0.9375rem' }}>
                {historialVisualizando.fecha_envio ? fecha(historialVisualizando.fecha_envio) : fecha(historialVisualizando.fecha_creacion)}
              </div>
            </div>

            {/* Asunto */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Asunto</label>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', fontSize: '0.9375rem' }}>
                {historialVisualizando.asunto}
              </div>
            </div>

            {/* Mensaje */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#4b5563', marginBottom: '0.375rem', fontWeight: '500' }}>Mensaje</label>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', fontSize: '0.9375rem', whiteSpace: 'pre-wrap', minHeight: '120px', lineHeight: '1.5' }}>
                {historialVisualizando.contenido ?? 'Sin contenido registrado'}
              </div>
            </div>

            {/* Botón inferior Cerrar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
              <button 
                type="button" 
                onClick={() => setHistorialVisualizando(null)}
                style={{ background: '#1b3b22', color: '#fff', border: 'none', padding: '0.75rem 2.5rem', borderRadius: '9999px', fontWeight: '500', cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>

          </div>
        </Modal>
      )}
    </div>
  );
}

// ==========================================
// Subcomponente: Modal Nueva Notificación (Aislado para evitar pérdida de foco)
// ==========================================
function ModalNuevaNotificacion({ abierto, onCerrar, usuarios, plantillas, onEnviar, ocupado }) {
  const [form, setForm] = useState({
    id_usuario: '',
    id_plantilla: '',
    asunto: '',
    contenido: ''
  });

  if (!abierto) return null;

  const handlePlantillaChange = (e) => {
    const idPlantilla = e.target.value;
    const encontrada = plantillas.find(p => p.id_plantilla == idPlantilla);
    
    setForm(prev => ({
      ...prev,
      id_plantilla: idPlantilla,
      asunto: encontrada ? encontrada.asunto : '',
      contenido: encontrada ? encontrada.contenido : ''
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onEnviar(form);
  };

  return (
    <Modal titulo="Enviar Nueva Notificación" onCerrar={onCerrar}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Desplegable de Socios */}
        <div className="campo">
          <label className="campo__etiqueta" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Socio Destino
          </label>
          <select 
            className="campo__input"
            value={form.id_usuario}
            onChange={(e) => setForm({ ...form, id_usuario: e.target.value })}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '1rem' }}
            required
          >
            <option value="">-- Seleccione un socio --</option>
            {Array.isArray(usuarios) && usuarios.map(u => (
              <option key={u.id_usuario} value={u.id_usuario}>
                {u.nombre_completo}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Plantilla */}
        <div className="campo">
          <label className="campo__etiqueta" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Plantilla Base
          </label>
          <select 
            className="campo__input"
            value={form.id_plantilla}
            onChange={handlePlantillaChange}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '1rem' }}
            required
          >
            <option value="">-- Seleccione una plantilla --</option>
            {plantillas.map(p => (
              <option key={p.id_plantilla} value={p.id_plantilla}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Campo Asunto Editable */}
        <div className="campo">
          <label className="campo__etiqueta" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Asunto del Correo
          </label>
          <input 
            type="text"
            className="campo__input"
            value={form.asunto}
            onChange={(e) => setForm({ ...form, asunto: e.target.value })}
            placeholder="Seleccione una plantilla o escriba el asunto..."
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '1rem' }}
            required
          />
        </div>

        {/* Campo Contenido / Mensaje Editable */}
        <div className="campo">
          <label className="campo__etiqueta" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Mensaje (Editable)
          </label>
          <textarea 
            className="campo__input"
            rows={5}
            value={form.contenido}
            onChange={(e) => setForm({ ...form, contenido: e.target.value })}
            placeholder="Seleccione una plantilla o escriba el mensaje..."
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '1rem', fontFamily: 'inherit' }}
            required
          />
        </div>

        {/* Botones inferiores */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
          <button 
            type="button" 
            onClick={onCerrar}
            style={{ background: '#fff', border: '1px solid #111827', color: '#111827', padding: '0.75rem 2rem', borderRadius: '9999px', fontWeight: '500', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            disabled={ocupado}
            style={{ background: '#111827', border: 'none', color: '#fff', padding: '0.75rem 2rem', borderRadius: '9999px', fontWeight: '500', cursor: 'pointer' }}
          >
            {ocupado ? 'Enviando...' : 'Enviar Notificación'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Subcomponente aislado para edición de plantillas (Pestaña Plantillas)
function FormularioEdicion({ plantilla, onCerrar, onGuardar, ocupado }) {
  const [form, setForm] = useState(plantilla);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    plantilla.nombre = form.nombre;
    plantilla.tipo = form.tipo;
    plantilla.asunto = form.asunto;
    plantilla.contenido = form.contenido;
    onGuardar(e);
  };

  return (
    <Modal titulo="Editar Plantilla" onCerrar={onCerrar}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="campo">
          <label className="campo__etiqueta" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Nombre de la plantilla
          </label>
          <input 
            type="text"
            name="nombre"
            className="campo__input" 
            value={form.nombre ?? ''} 
            onChange={handleChange}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '1rem', background: '#fff' }}
          />
        </div>

        <div className="campo">
          <label className="campo__etiqueta" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Tipo
          </label>
          <select 
            name="tipo"
            className="campo__input"
            value={form.tipo ?? 'Registro'}
            onChange={handleChange}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: '#fff', fontSize: '1rem' }}
          >
            <option value="Registro">Registro</option>
            <option value="Estado de cuenta">Estado de cuenta</option>
            <option value="Pago">Pago</option>
            <option value="Reserva">Reserva</option>
          </select>
        </div>

        <div className="campo">
          <label className="campo__etiqueta" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Asunto del correo
          </label>
          <input 
            type="text"
            name="asunto"
            className="campo__input" 
            value={form.asunto ?? ''} 
            onChange={handleChange}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '1rem', background: '#fff' }}
          />
        </div>

        <div className="campo">
          <label className="campo__etiqueta" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Mensaje
          </label>
          <textarea 
            name="contenido"
            className="campo__input" 
            rows={6}
            value={form.contenido ?? ''} 
            onChange={handleChange}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '1rem', fontFamily: 'inherit', background: '#fff' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
          <button 
            type="button" 
            onClick={onCerrar}
            style={{ background: '#fff', border: '1px solid #111827', color: '#111827', padding: '0.75rem 2rem', borderRadius: '9999px', fontWeight: '500', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            disabled={ocupado}
            style={{ background: '#111827', border: 'none', color: '#fff', padding: '0.75rem 2rem', borderRadius: '9999px', fontWeight: '500', cursor: 'pointer' }}
          >
            {ocupado ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}