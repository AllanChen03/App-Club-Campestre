import { useCallback, useEffect, useState } from 'react';
import Modal from '../Modal';
import Campo from '../Campo';
import Alerta from '../Alerta';
import { membresiasApi } from '../../api/membresias';
import { useAuth } from '../../context/AuthContext';
import { fecha } from '../../utils/formato';
import { ROL_GENERAL } from '../../utils/roles';

const ESTADOS = ['Pendiente', 'Activa', 'Vencida', 'Suspendida', 'Cancelada'];

const BEN_VACIO = {
  nombre_completo: '',
  cedula: '',
  telefono: '',
  fecha_nacimiento: '',
  parentesco: ''
};

export default function DetalleMembresiaModal({ idMembresia, tipos, onCerrar, onActualizado }) {
  const { usuario: sesion } = useAuth();
  const esGeneral = sesion?.rol === ROL_GENERAL;

  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(null);

  const [formMem, setFormMem] = useState({
    id_tipo_membresia: '',
    fecha_inicio: '',
    fecha_vencimiento: '',
    estado: '',
    motivo: ''
  });

  const [formBen, setFormBen] = useState(BEN_VACIO);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const { membresia } = await membresiasApi.obtenerDetalle(idMembresia);
      setDetalle(membresia);
      setFormMem({
        id_tipo_membresia: String(membresia.id_tipo_membresia),
        fecha_inicio: String(membresia.fecha_inicio ?? '').slice(0, 10),
        fecha_vencimiento: String(membresia.fecha_vencimiento ?? '').slice(0, 10),
        estado: membresia.estado,
        motivo: ''
      });
    } catch (err) {
      setError(err.message);
    }
  }, [idMembresia]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarCambios(e) {
    e.preventDefault();
    setOcupado(true);
    setAviso(null);
    try {
      const { mensaje } = await membresiasApi.actualizar(idMembresia, {
        id_tipo_membresia: Number(formMem.id_tipo_membresia),
        fecha_inicio: formMem.fecha_inicio || null,
        fecha_vencimiento: formMem.fecha_vencimiento || null,
        estado: formMem.estado,
        motivo: formMem.motivo
      });
      await cargar();
      setAviso({ tipo: 'exito', mensaje });
      onActualizado?.();
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
    } finally {
      setOcupado(false);
    }
  }

  async function crearBeneficiario(e) {
    e.preventDefault();
    setOcupado(true);
    setAviso(null);
    try {
      const { mensaje } = await membresiasApi.agregarBeneficiario(idMembresia, formBen);
      setFormBen(BEN_VACIO);
      await cargar();
      setAviso({ tipo: 'exito', mensaje });
      onActualizado?.();
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
    } finally {
      setOcupado(false);
    }
  }

  async function borrarBeneficiario(idBen) {
    setOcupado(true);
    setAviso(null);
    try {
      const { mensaje } = await membresiasApi.eliminarBeneficiario(idMembresia, idBen);
      await cargar();
      setAviso({ tipo: 'exito', mensaje });
      onActualizado?.();
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
    } finally {
      setOcupado(false);
      setConfirmarQuitar(null);
    }
  }

  const maxBen = detalle?.tipos_membresia?.max_beneficiarios ?? 0;
  const listaBen = detalle?.beneficiarios ?? [];

  return (
    <Modal titulo="Detalle de la membresía" onCerrar={onCerrar} lateral>
      {error && <Alerta>{error}</Alerta>}
      {!detalle && !error && <p className="cargando">Cargando…</p>}

      {detalle && (
        <>
          <header className="detalle__encabezado">
            <h2 className="tarjeta__titulo">{detalle.socios?.usuarios?.nombre_completo}</h2>
            <p className="perfil__sub">
              Socio N.º {detalle.socios?.numero_socio} · {detalle.tipos_membresia?.nombre} ·{' '}
              <span className={`insignia insignia--${detalle.estado?.toLowerCase()}`}>{detalle.estado}</span>
            </p>
          </header>

          {aviso && <Alerta tipo={aviso.tipo}>{aviso.mensaje}</Alerta>}

          <section className="detalle__seccion">
            <h3 className="detalle__titulo">Resumen del plan</h3>
            <dl className="datos datos--dos">
              <div className="dato">
                <dt>Cuota mensual</dt>
                <dd>₡{Number(detalle.tipos_membresia?.precio ?? 0).toLocaleString('es-CR')}</dd>
              </div>
              <div className="dato">
                <dt>Invitados por mes</dt>
                <dd>{detalle.tipos_membresia?.max_invitados ?? 0}</dd>
              </div>
              <div className="dato">
                <dt>Inicio</dt>
                <dd>{fecha(detalle.fecha_inicio)}</dd>
              </div>
              <div className="dato">
                <dt>Vencimiento</dt>
                <dd>{fecha(detalle.fecha_vencimiento)}</dd>
              </div>
            </dl>
          </section>

          {esGeneral && (
            <form className="detalle__seccion" onSubmit={guardarCambios}>
              <h3 className="detalle__titulo">Modificar o renovar membresía</h3>
              <div className="rejilla">
                <div className="campo">
                  <label className="campo__etiqueta" htmlFor="det-tipo">Tipo de membresía</label>
                  <select
                    id="det-tipo"
                    className="campo__input campo__select"
                    value={formMem.id_tipo_membresia}
                    onChange={(e) => setFormMem({ ...formMem, id_tipo_membresia: e.target.value })}
                  >
                    {tipos.map((t) => (
                      <option key={t.id_tipo_membresia} value={t.id_tipo_membresia}>
                        {t.nombre} (₡{Number(t.precio).toLocaleString('es-CR')})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo">
                  <label className="campo__etiqueta" htmlFor="det-estado">Estado</label>
                  <select
                    id="det-estado"
                    className="campo__input campo__select"
                    value={formMem.estado}
                    onChange={(e) => setFormMem({ ...formMem, estado: e.target.value })}
                  >
                    {ESTADOS.map((est) => (
                      <option key={est} value={est}>{est}</option>
                    ))}
                  </select>
                </div>

                <Campo
                  etiqueta="Fecha de inicio"
                  tipo="date"
                  value={formMem.fecha_inicio}
                  onChange={(e) => setFormMem({ ...formMem, fecha_inicio: e.target.value })}
                />
                <Campo
                  etiqueta="Fecha de vencimiento"
                  tipo="date"
                  value={formMem.fecha_vencimiento}
                  onChange={(e) => setFormMem({ ...formMem, fecha_vencimiento: e.target.value })}
                />
              </div>

              <Campo
                etiqueta="Motivo del cambio"
                value={formMem.motivo}
                onChange={(e) => setFormMem({ ...formMem, motivo: e.target.value })}
                placeholder="Ej. Pago confirmado, renovación anual o suspensión"
              />

              <button type="submit" className="boton boton--oscuro" disabled={ocupado}>
                {ocupado ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          )}

          <section className="detalle__seccion">
            <h3 className="detalle__titulo">
              Beneficiarios ({listaBen.length} de {maxBen})
            </h3>

            {maxBen === 0 ? (
              <p className="caja__nota">
                El plan {detalle.tipos_membresia?.nombre} no admite beneficiarios adicionales.
              </p>
            ) : (
              <>
                {listaBen.length === 0 ? (
                  <p className="caja__nota">No hay beneficiarios registrados en esta membresía.</p>
                ) : (
                  <div className="lista-detalle">
                    {listaBen.map((b) => (
                      <div key={b.id_beneficiario} className="lista-detalle__item">
                        <div className="lista-detalle__info">
                          <span className="lista-detalle__titulo">
                            {b.nombre_completo} · {b.parentesco}
                          </span>
                          <span className="lista-detalle__sub">
                            Cédula {b.cedula} · Nacimiento {fecha(b.fecha_nacimiento)}
                          </span>
                        </div>
                        {esGeneral && (
                          <button
                            type="button"
                            className="boton boton--peligro boton--chico"
                            onClick={() => setConfirmarQuitar(b)}
                            disabled={ocupado}
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {confirmarQuitar && (
                  <div className="confirmacion subformulario">
                    <p>
                      <strong>¿Quitar a {confirmarQuitar.nombre_completo}?</strong> Dejará de estar
                      vinculado como beneficiario de esta membresía.
                    </p>
                    <div className="confirmacion__botones">
                      <button
                        type="button"
                        className="boton boton--secundario boton--chico"
                        onClick={() => setConfirmarQuitar(null)}
                        disabled={ocupado}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="boton boton--peligro boton--chico"
                        onClick={() => borrarBeneficiario(confirmarQuitar.id_beneficiario)}
                        disabled={ocupado}
                      >
                        {ocupado ? 'Quitando…' : 'Sí, quitar'}
                      </button>
                    </div>
                  </div>
                )}

                {esGeneral && listaBen.length < maxBen && (
                  <form className="subformulario" onSubmit={crearBeneficiario}>
                    <h4 className="detalle__titulo">Agregar beneficiario</h4>
                    <div className="rejilla">
                      <Campo
                        etiqueta="Nombre completo"
                        value={formBen.nombre_completo}
                        onChange={(e) => setFormBen({ ...formBen, nombre_completo: e.target.value })}
                      />
                      <Campo
                        etiqueta="Cédula"
                        value={formBen.cedula}
                        onChange={(e) => setFormBen({ ...formBen, cedula: e.target.value })}
                      />
                      <Campo
                        etiqueta="Parentesco"
                        value={formBen.parentesco}
                        onChange={(e) => setFormBen({ ...formBen, parentesco: e.target.value })}
                        placeholder="Ej. Cónyuge, Hijo/a"
                      />
                      <Campo
                        etiqueta="Fecha de nacimiento"
                        tipo="date"
                        value={formBen.fecha_nacimiento}
                        onChange={(e) => setFormBen({ ...formBen, fecha_nacimiento: e.target.value })}
                      />
                      <Campo
                        etiqueta="Teléfono (opcional)"
                        tipo="tel"
                        inputMode="numeric"
                        maxLength={8}
                        value={formBen.telefono}
                        onChange={(e) => setFormBen({ ...formBen, telefono: e.target.value })}
                      />
                    </div>
                    <button type="submit" className="boton boton--secundario boton--chico" disabled={ocupado}>
                      + Agregar beneficiario
                    </button>
                  </form>
                )}
              </>
            )}
          </section>

          <section className="detalle__seccion">
            <h3 className="detalle__titulo">Historial de cambios</h3>
            {(detalle.historial ?? []).length === 0 ? (
              <p className="caja__nota">Sin movimientos registrados.</p>
            ) : (
              <div className="lista-detalle">
                {detalle.historial.map((h) => (
                  <div key={h.id_historial} className="lista-detalle__item lista-detalle__item--suave">
                    <div className="lista-detalle__info">
                      <span className="lista-detalle__titulo">
                        {h.estado_anterior ? `${h.estado_anterior} → ` : 'Asignación → '}
                        {h.estado_nuevo}
                      </span>
                      {h.motivo && <span className="lista-detalle__sub">{h.motivo}</span>}
                      {h.usuarios?.nombre_completo && (
                        <span className="lista-detalle__sub">Por: {h.usuarios.nombre_completo}</span>
                      )}
                    </div>
                    <span className="lista-detalle__fecha">{fecha(h.fecha)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Modal>
  );
}