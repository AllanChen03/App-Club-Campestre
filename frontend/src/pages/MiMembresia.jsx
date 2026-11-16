import { useCallback, useEffect, useState } from 'react';
import Alerta from '../components/Alerta';
import Campo from '../components/Campo';
import { membresiasApi } from '../api/membresias';
import { fecha, iniciales } from '../utils/formato';

const BEN_VACIO = {
  nombre_completo: '',
  cedula: '',
  telefono: '',
  fecha_nacimiento: '',
  parentesco: ''
};

function Dato({ etiqueta, children }) {
  return (
    <div className="dato">
      <dt>{etiqueta}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

export default function MiMembresia() {
  const [datos, setDatos] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(null);
  const [formBen, setFormBen] = useState(BEN_VACIO);

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      const res = await membresiasApi.mia();
      setDatos(res);
    } catch (err) {
      setErrorCarga(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (errorCarga) return <Alerta>{errorCarga}</Alerta>;
  if (!datos) return <p className="cargando">Cargando información de tu membresía…</p>;

  const m = datos.membresia_actual;
  const tipo = m?.tipos_membresia;
  const beneficiarios = m?.beneficiarios ?? [];
  const maxBen = tipo?.max_beneficiarios ?? 0;

  async function agregarBeneficiario(e) {
    e.preventDefault();
    setOcupado(true);
    setAviso(null);
    try {
      const { mensaje } = await membresiasApi.agregarMiBeneficiario(formBen);
      setFormBen(BEN_VACIO);
      setAviso({ tipo: 'exito', mensaje });
      await cargar();
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
    } finally {
      setOcupado(false);
    }
  }

  async function quitarBeneficiario(idBeneficiario) {
    setOcupado(true);
    setAviso(null);
    try {
      const { mensaje } = await membresiasApi.eliminarMiBeneficiario(idBeneficiario);
      setAviso({ tipo: 'exito', mensaje });
      await cargar();
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
    } finally {
      setOcupado(false);
      setConfirmarQuitar(null);
    }
  }

  return (
    <div className="perfil">
      <header className="perfil__encabezado">
        <span className="perfil__avatar">{iniciales(datos.usuario?.nombre_completo || 'Socio')}</span>
        <div>
          <h1 className="inicio__saludo">Mi Membresía</h1>
          <p className="perfil__sub">
            Socio N.º {datos.numero_socio} · Afiliado desde {fecha(datos.fecha_afiliacion)}
            {m && (
              <>
                {' '}· <span className={`insignia insignia--${m.estado?.toLowerCase()}`}>{m.estado}</span>
              </>
            )}
          </p>
        </div>
      </header>

      {aviso && <Alerta tipo={aviso.tipo}>{aviso.mensaje}</Alerta>}

      <div className="perfil__rejilla">
        {/* Tarjeta 1: Estado y plan actual */}
        <section className="caja">
          <h2 className="caja__titulo">Estado y plan actual</h2>
          {!m ? (
            <p className="caja__nota">Aún no tienes una membresía activa asociada a tu cuenta.</p>
          ) : (
            <>
              <dl className="datos datos--dos">
                <Dato etiqueta="Plan contratado">{tipo?.nombre}</Dato>
                <Dato etiqueta="Cuota mensual">₡{Number(tipo?.precio ?? 0).toLocaleString('es-CR')}</Dato>
                <Dato etiqueta="Fecha de inscripción">{fecha(m.fecha_inicio)}</Dato>
                <Dato etiqueta="Próxima renovación">
                  {m.fecha_vencimiento ? fecha(m.fecha_vencimiento) : 'Sin vencimiento'}
                </Dato>
                <Dato etiqueta="Invitados permitidos / mes">{tipo?.max_invitados ?? 0}</Dato>
                <Dato etiqueta="Beneficiarios permitidos">{maxBen}</Dato>
              </dl>
              {tipo?.descripcion && <p className="caja__nota">{tipo.descripcion}</p>}
            </>
          )}
        </section>

        {/* Tarjeta 2: Historial de membresía */}
        {m && (
          <section className="caja">
            <h2 className="caja__titulo">Historial de cambios</h2>
            {(datos.historial ?? []).length === 0 ? (
              <p className="caja__nota">No hay movimientos registrados aún.</p>
            ) : (
              <div className="lista-detalle">
                {datos.historial.map((h) => (
                  <div key={h.id_historial} className="lista-detalle__item lista-detalle__item--suave">
                    <div className="lista-detalle__info">
                      <span className="lista-detalle__titulo">
                        {h.estado_anterior ? `${h.estado_anterior} → ` : 'Inicio → '}
                        {h.estado_nuevo}
                      </span>
                      {h.motivo && <span className="lista-detalle__sub">{h.motivo}</span>}
                    </div>
                    <span className="lista-detalle__fecha">{fecha(h.fecha)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tarjeta 3: Beneficiarios */}
        {m && (
          <section className="caja caja--completa">
            <h2 className="caja__titulo">
              Beneficiarios registrados ({beneficiarios.length} de {maxBen})
            </h2>

            {maxBen === 0 ? (
              <p className="caja__nota">
                Tu plan actual ({tipo?.nombre}) no incluye beneficiarios adicionales.
              </p>
            ) : (
              <>
                {beneficiarios.length === 0 ? (
                  <p className="caja__nota">No has registrado beneficiarios en tu membresía.</p>
                ) : (
                  <div className="lista-detalle">
                    {beneficiarios.map((b) => (
                      <div key={b.id_beneficiario} className="lista-detalle__item">
                        <div className="lista-detalle__info">
                          <span className="lista-detalle__titulo">
                            {b.nombre_completo} · {b.parentesco}
                          </span>
                          <span className="lista-detalle__sub">
                            Cédula {b.cedula} · Nacimiento {fecha(b.fecha_nacimiento)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="boton boton--peligro boton--chico"
                          onClick={() => setConfirmarQuitar(b)}
                          disabled={ocupado}
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {confirmarQuitar && (
                  <div className="confirmacion subformulario">
                    <p>
                      <strong>¿Eliminar a {confirmarQuitar.nombre_completo}?</strong> Dejará de
                      aparecer como beneficiario en tu membresía familiar.
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
                        onClick={() => quitarBeneficiario(confirmarQuitar.id_beneficiario)}
                        disabled={ocupado}
                      >
                        {ocupado ? 'Eliminando…' : 'Sí, eliminar'}
                      </button>
                    </div>
                  </div>
                )}

                {beneficiarios.length < maxBen && (
                  <form className="subformulario" onSubmit={agregarBeneficiario}>
                    <h3 className="detalle__titulo">Registrar nuevo beneficiario</h3>
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
                    <button type="submit" className="boton boton--oscuro" disabled={ocupado}>
                      {ocupado ? 'Guardando…' : 'Registrar beneficiario'}
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}