import { useCallback, useEffect, useState } from 'react';
import Alerta from '../components/Alerta';
import Campo from '../components/Campo';
import { instalacionesApi, invitadosApi } from '../api/reservas';
import {
  RELACIONES, fechaConDia, formatoCedula, hoy, nombreMes, sumarDias
} from '../utils/reservas';
import { fecha as fechaCorta } from '../utils/formato';
import '../styles/reservas.css';

const VACIO = { nombre_completo: '', cedula: '', telefono: '', fecha_visita: '', id_instalacion: '', relacion: '' };

export default function Invitados() {
  const [datos, setDatos] = useState(null);
  const [instalaciones, setInstalaciones] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cancelandoId, setCancelandoId] = useState(null);

  const cargar = useCallback(() => {
    invitadosApi.mios().then(setDatos).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    cargar();
    instalacionesApi.listar().then((d) => setInstalaciones(d.instalaciones)).catch(() => {});
  }, [cargar]);

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setErrores((x) => ({ ...x, [campo]: '' }));
  };

  function validar() {
    const e = {};
    const cedula = form.cedula.replace(/\D/g, '');
    if (!form.nombre_completo.trim()) e.nombre_completo = 'Escriba el nombre completo';
    if (!/^[1-9]\d{0,11}$/.test(cedula)) e.cedula = 'Solo números; no puede empezar con 0';
    if (form.telefono && !/^\d{8}$/.test(form.telefono.replace(/\D/g, ''))) e.telefono = 'Debe tener 8 dígitos';
    if (!form.fecha_visita) e.fecha_visita = 'Elija la fecha';
    if (!form.relacion) e.relacion = 'Elija la relación';
    return e;
  }

  async function registrar(ev) {
    ev.preventDefault();
    setError('');
    setAviso('');
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      await invitadosApi.registrar({
        nombre_completo: form.nombre_completo.trim(),
        cedula: form.cedula,
        telefono: form.telefono || null,
        fecha_visita: form.fecha_visita,
        id_instalacion: form.id_instalacion ? Number(form.id_instalacion) : null,
        relacion: form.relacion
      });
      setAviso(`${form.nombre_completo.trim()} quedó registrado para el ${fechaCorta(form.fecha_visita)}.`);
      setForm(VACIO);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cancelarVisita(v) {
    setCancelandoId(v.id_visita);
    setError('');
    setAviso('');
    try {
      await invitadosApi.cancelarVisita(v.id_visita);
      setAviso(`Se canceló la visita de ${v.nombre_completo}.`);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelandoId(null);
    }
  }

  const cupo = datos?.cupo;
  const porcentaje = cupo?.limite ? Math.min(100, (cupo.usados / cupo.limite) * 100) : 0;
  const sinMembresia = datos && !datos.membresia;

  return (
    <div>
      <header>
        <h1 className="inicio__saludo">Invitados</h1>
        <p className="inicio__fecha">Registre a sus invitados antes de la visita. El club los recibe con su nombre y cédula.</p>
      </header>

      {error && <Alerta>{error}</Alerta>}
      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}
      {sinMembresia && (
        <Alerta tipo="aviso">Necesita una membresía activa para registrar invitados.</Alerta>
      )}

      {cupo && (
        <section className="caja cupo" aria-label="Cupo de invitados del mes">
          <div>
            <p className="cupo__titulo">
              Le quedan {cupo.restantes} de {cupo.limite} invitados en {nombreMes(cupo.mes)}
            </p>
            <p className="cupo__sub">
              Ha registrado {cupo.usados} este mes. El cupo se renueva el {fechaCorta(cupo.renueva)}.
            </p>
          </div>
          <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={cupo.limite} aria-valuenow={cupo.usados}>
            <div className={`progreso__barra ${cupo.restantes === 0 ? 'progreso__barra--lleno' : ''}`} style={{ width: `${porcentaje}%` }} />
          </div>
        </section>
      )}

      <div className="dos-columnas">
        <form className="caja" onSubmit={registrar} noValidate>
          <h2 className="caja__titulo">Registrar invitado</h2>
          <Campo etiqueta="Nombre completo" placeholder="Nombre y apellidos" value={form.nombre_completo}
            onChange={cambiar('nombre_completo')} error={errores.nombre_completo} autoComplete="off" />
          <div className="rejilla">
            <Campo etiqueta="Cédula" placeholder="1-0000-0000" value={form.cedula}
              onChange={cambiar('cedula')} error={errores.cedula} inputMode="numeric" autoComplete="off" />
            <Campo etiqueta="Fecha de visita" tipo="date" value={form.fecha_visita}
              min={hoy()} max={sumarDias(hoy(), 90)} onChange={cambiar('fecha_visita')} error={errores.fecha_visita} />
            <div className="campo">
              <label htmlFor="inv-instalacion" className="campo__etiqueta">Instalación</label>
              <select id="inv-instalacion" className="campo__select-nativo" value={form.id_instalacion} onChange={cambiar('id_instalacion')}>
                <option value="">Sin instalación específica</option>
                {instalaciones.map((i) => <option key={i.id_instalacion} value={i.id_instalacion}>{i.nombre}</option>)}
              </select>
            </div>
            <div className={`campo ${errores.relacion ? 'campo--error' : ''}`}>
              <label htmlFor="inv-relacion" className="campo__etiqueta">Relación</label>
              <select id="inv-relacion" className="campo__select-nativo" value={form.relacion} onChange={cambiar('relacion')}
                aria-invalid={Boolean(errores.relacion)}>
                <option value="">Familiar, amigo u otro</option>
                {RELACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {errores.relacion && <p className="campo__mensaje">{errores.relacion}</p>}
            </div>
          </div>
          <Campo etiqueta="Teléfono (opcional)" placeholder="8888 8888" value={form.telefono}
            onChange={cambiar('telefono')} error={errores.telefono} inputMode="tel" />
          <button type="submit" className="boton boton--primario" disabled={enviando || sinMembresia || cupo?.restantes === 0}>
            {enviando ? 'Registrando…' : 'Registrar invitado'}
          </button>
          <p className="caja__nota">Para que un invitado entre con usted a una reserva, elíjalo al crear o modificar la reserva.</p>
        </form>

        <section className="caja">
          <h2 className="caja__titulo">Próximas visitas</h2>
          {!datos && <p className="cargando">Cargando…</p>}
          {datos && datos.proximas.length === 0 && <p className="tabla__vacio">No tiene visitas programadas.</p>}
          <div className="visitas">
            {datos?.proximas.map((v) => (
              <div key={v.id_visita} className="visita">
                <div className="visita__info">
                  <strong>{v.nombre_completo}</strong> · {v.relacion}
                  <div className="visita__sub">
                    {fechaConDia(v.fecha_visita)} · {v.instalacion ?? 'Sin instalación'} · Cédula {formatoCedula(v.cedula)}
                    {v.id_reserva && ' · en una reserva'}
                  </div>
                </div>
                {!v.id_reserva && (
                  <button type="button" className="boton boton--peligro boton--chico"
                    disabled={cancelandoId === v.id_visita} onClick={() => cancelarVisita(v)}>
                    {cancelandoId === v.id_visita ? 'Cancelando…' : 'Cancelar'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {datos?.anteriores.length > 0 && (
            <details className="detalles-plegables">
              <summary>Visitas anteriores y canceladas ({datos.anteriores.length})</summary>
              <div className="visitas" style={{ marginTop: 12 }}>
                {datos.anteriores.map((v) => (
                  <div key={v.id_visita} className="visita">
                    <div className="visita__info">
                      <strong>{v.nombre_completo}</strong> · {v.relacion}
                      <div className="visita__sub">{fechaConDia(v.fecha_visita)} · {v.instalacion ?? 'Sin instalación'}</div>
                    </div>
                    <span className={`insignia insignia--${v.estado.toLowerCase()}`}>{v.estado}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
