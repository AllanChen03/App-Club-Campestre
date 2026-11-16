import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Alerta from '../../components/Alerta';
import SelectorTurnos, { turnoDisponible } from '../../components/reservas/SelectorTurnos';
import CampoNumero from '../../components/reservas/CampoNumero';
import { instalacionesApi, invitadosApi, reservasApi } from '../../api/reservas';
import { colones } from '../../utils/formato';
import {
  fechaConDia, hoy, instalacionDeArea, nombreMes, plural, rangoHoras, sumarDias
} from '../../utils/reservas';
import '../../styles/reservas.css';

const DIAS_ANTICIPACION = 90;

// Nueva reserva (/reservas/nueva) o modificación (/reservas/:id/modificar)
export default function FormReserva() {
  const { id } = useParams();
  const modificando = Boolean(id);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [instalaciones, setInstalaciones] = useState(null);
  const [idInstalacion, setIdInstalacion] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [turnos, setTurnos] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  const [personas, setPersonas] = useState(1);
  const [servicios, setServicios] = useState({});
  const [misInvitados, setMisInvitados] = useState([]);
  const [elegidos, setElegidos] = useState([]);
  const [cupo, setCupo] = useState(null);
  const [original, setOriginal] = useState(null);
  const [error, setError] = useState('');
  const [errorCarga, setErrorCarga] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Carga inicial: instalaciones, invitados y, si se modifica, la reserva
  useEffect(() => {
    const pedidos = [instalacionesApi.listar(), invitadosApi.mios()];
    if (modificando) pedidos.push(reservasApi.mia(id));

    Promise.all(pedidos)
      .then(([inst, inv, res]) => {
        setInstalaciones(inst.instalaciones);
        setMisInvitados(inv.invitados);

        if (res) {
          const r = res.reserva;
          if (!r.editable) {
            setErrorCarga('Esta reserva ya no se puede modificar.');
            return;
          }
          setOriginal(r);
          setIdInstalacion(String(r.id_instalacion));
          setFecha(r.fecha_reserva);
          setPersonas(r.cantidad_personas);
          setServicios(Object.fromEntries(r.servicios.map((s) => [s.id_servicio, s.cantidad])));
          setElegidos(r.invitados.map((i) => i.id_invitado));
        } else {
          const porArea = instalacionDeArea(inst.instalaciones, params.get('area'));
          setIdInstalacion(String((porArea ?? inst.instalaciones[0])?.id_instalacion ?? ''));
        }
      })
      .catch((e) => setErrorCarga(e.message));
  }, [id, modificando, params]);

  const instalacion = useMemo(
    () => instalaciones?.find((i) => String(i.id_instalacion) === idInstalacion) ?? null,
    [instalaciones, idInstalacion]
  );

  // Turnos del día elegido
  useEffect(() => {
    if (!instalacion || !fecha) return;
    let vigente = true;
    setTurnos(null);
    instalacionesApi.disponibilidad(instalacion.id_instalacion, fecha, modificando ? id : undefined)
      .then((d) => {
        if (!vigente) return;
        setTurnos(d.turnos);
        // Al modificar, se marca el horario actual la primera vez
        if (original && fecha === original.fecha_reserva) {
          const desde = d.turnos.findIndex((t) => t.hora_inicio === original.hora_inicio);
          const hasta = d.turnos.findIndex((t) => t.hora_fin === original.hora_fin);
          setSeleccion(desde >= 0 && hasta >= desde ? { desde, hasta } : null);
        }
      })
      .catch((e) => vigente && setError(e.message));
    return () => { vigente = false; };
  }, [instalacion, fecha, id, modificando, original]);

  // Cupo de invitados del mes de la reserva
  useEffect(() => {
    if (!fecha) return;
    invitadosApi.cupo(fecha).then((d) => setCupo(d.cupo)).catch(() => setCupo(null));
  }, [fecha]);

  function cambiarInstalacion(valor) {
    setIdInstalacion(valor);
    setSeleccion(null);
    setServicios({});
    setError('');
  }

  function cambiarFecha(valor) {
    setFecha(valor);
    setSeleccion(null);
    setError('');
  }

  const maximo = instalacion?.max_personas ?? 1;

  // Al cambiar a una instalación con menos cupo, las personas se ajustan al nuevo máximo
  useEffect(() => {
    if (instalacion && personas > maximo) setPersonas(maximo);
  }, [instalacion, maximo, personas]);
  const elegidosTurnos = seleccion && turnos ? turnos.slice(seleccion.desde, seleccion.hasta + 1) : [];
  const horarioValido = elegidosTurnos.length > 0 &&
    elegidosTurnos.every((t) => turnoDisponible(t, instalacion?.tipo_reserva, personas));

  const serviciosElegidos = (instalacion?.servicios_adicionales ?? [])
    .filter((s) => servicios[s.id_servicio])
    .map((s) => ({ ...s, cantidad: servicios[s.id_servicio] }));
  const total = serviciosElegidos.reduce((t, s) => t + Number(s.precio) * s.cantidad, 0);

  // Cupo restante sin contar los invitados que ya estaban en esta reserva
  const yaEnReserva = original && fecha.slice(0, 7) === original.fecha_reserva.slice(0, 7)
    ? original.invitados.length : 0;
  const cupoLibre = cupo ? cupo.restantes + yaEnReserva : 0;

  // Por qué no se pueden agregar más invitados (null si sí se puede)
  let motivoBloqueo = null;
  if (elegidos.length >= personas - 1) {
    motivoBloqueo = personas <= 1
      ? 'Para llevar invitados, aumente el número de personas: usted cuenta como 1.'
      : `Con ${personas} personas cabe${personas - 1 === 1 ? '' : 'n'} hasta ${plural(personas - 1, 'invitado', 'invitados')}. Aumente el número de personas para agregar otro.`;
  } else if (cupo && elegidos.length >= cupoLibre) {
    motivoBloqueo = `Ya usó su cupo de invitados de ${nombreMes(fecha)}.`;
  }

  function alternarInvitado(idInvitado) {
    setElegidos((lista) => (lista.includes(idInvitado)
      ? lista.filter((x) => x !== idInvitado)
      : [...lista, idInvitado]));
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');

    if (!horarioValido) return setError('Elija un horario disponible.');
    if (personas < 1 || personas > maximo) return setError(`El número de personas debe estar entre 1 y ${maximo}.`);
    if (elegidos.length > personas - 1) return setError('Los invitados no pueden superar el número de personas menos usted.');

    const datos = {
      id_instalacion: instalacion.id_instalacion,
      fecha_reserva: fecha,
      hora_inicio: elegidosTurnos[0].hora_inicio,
      hora_fin: elegidosTurnos[elegidosTurnos.length - 1].hora_fin,
      cantidad_personas: personas,
      servicios: serviciosElegidos.map((s) => ({ id_servicio: s.id_servicio, cantidad: s.cantidad })),
      invitados: elegidos
    };

    setEnviando(true);
    try {
      const r = modificando
        ? await reservasApi.modificarMia(id, datos)
        : await reservasApi.crear(datos);
      navigate(`/reservas/${r.reserva.id_reserva}`, { state: { aviso: r.mensaje } });
    } catch (err) {
      setError(err.message);
      // El horario pudo cambiar: se recargan los turnos
      instalacionesApi.disponibilidad(instalacion.id_instalacion, fecha, modificando ? id : undefined)
        .then((d) => setTurnos(d.turnos)).catch(() => {});
    } finally {
      setEnviando(false);
    }
  }

  if (errorCarga) {
    return (
      <div>
        <h1 className="inicio__saludo">{modificando ? 'Modificar reserva' : 'Nueva reserva'}</h1>
        <div style={{ marginTop: 20 }}><Alerta>{errorCarga}</Alerta></div>
        <Link to="/reservas" className="enlace enlace--subrayado">Volver a mis reservas</Link>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1 className="inicio__saludo">{modificando ? 'Modificar reserva' : 'Nueva reserva'}</h1>
        <p className="inicio__fecha">
          {modificando
            ? 'Cambie la fecha, el horario, las personas o los servicios. La reserva volverá a quedar pendiente.'
            : 'Elija la instalación, la fecha y el horario. Solo puede elegir turnos disponibles.'}
        </p>
      </header>

      {!instalaciones && <p className="cargando">Cargando…</p>}

      {instalaciones && (
        <form className="reserva-layout" onSubmit={enviar} noValidate>
          <section className="caja">
            <h2 className="caja__titulo">Datos de la reserva</h2>

            {error && <Alerta>{error}</Alerta>}

            <div className="rejilla">
              <div className="campo">
                <label htmlFor="instalacion" className="campo__etiqueta">Instalación</label>
                <select
                  id="instalacion"
                  className="campo__select-nativo"
                  value={idInstalacion}
                  disabled={modificando}
                  onChange={(e) => cambiarInstalacion(e.target.value)}
                >
                  {instalaciones.map((i) => (
                    <option key={i.id_instalacion} value={i.id_instalacion}>{i.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="fecha" className="campo__etiqueta">Fecha</label>
                <input
                  id="fecha"
                  type="date"
                  className="campo__input"
                  value={fecha}
                  min={hoy()}
                  max={sumarDias(hoy(), DIAS_ANTICIPACION)}
                  onChange={(e) => cambiarFecha(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="bloque">
              <p className="bloque__titulo">Horario</p>
              {!turnos && <p className="campo__ayuda">Cargando turnos…</p>}
              {turnos && (
                <>
                  <SelectorTurnos
                    turnos={turnos}
                    tipo={instalacion?.tipo_reserva}
                    personas={personas}
                    seleccion={seleccion}
                    onCambiar={setSeleccion}
                  />
                  <p className="campo__ayuda">
                    Turnos de {instalacion.duracion_reserva / 60} {instalacion.duracion_reserva === 60 ? 'hora' : 'horas'}.
                    Puede elegir hasta 2 turnos seguidos.
                  </p>
                </>
              )}
            </div>

            <div className="rejilla">
              <div className="campo">
                <label htmlFor="personas" className="campo__etiqueta">Número de personas (máximo {maximo})</label>
                <CampoNumero id="personas" valor={personas} min={1} max={maximo} onCambiar={setPersonas} />
                <p className="campo__ayuda">Incluyéndolo a usted y a sus invitados.</p>
              </div>
            </div>

            {instalacion?.servicios_adicionales.length > 0 && (
              <div className="bloque">
                <p className="bloque__titulo">Servicios adicionales (opcional)</p>
                <div className="opciones">
                  {instalacion.servicios_adicionales.map((s) => {
                    const marcado = Boolean(servicios[s.id_servicio]);
                    return (
                      <div key={s.id_servicio} className="opcion">
                        <input
                          id={`servicio-${s.id_servicio}`}
                          type="checkbox"
                          checked={marcado}
                          onChange={(e) => setServicios((x) => {
                            const n = { ...x };
                            if (e.target.checked) n[s.id_servicio] = 1; else delete n[s.id_servicio];
                            return n;
                          })}
                        />
                        <label htmlFor={`servicio-${s.id_servicio}`} className="opcion__texto">
                          {s.nombre}
                          {s.descripcion && <span className="opcion__sub">{s.descripcion}</span>}
                        </label>
                        {marcado && (
                          <CampoNumero
                            className="opcion__cantidad"
                            aria-label={`Cantidad de ${s.nombre}`}
                            valor={servicios[s.id_servicio]}
                            min={1}
                            max={20}
                            onCambiar={(n) => setServicios((x) => ({ ...x, [s.id_servicio]: n }))}
                          />
                        )}
                        <span className="opcion__precio">{colones(s.precio)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bloque">
              <p className="bloque__titulo">
                Invitados (opcional)
                {cupo && ` · le quedan ${cupoLibre} de ${cupo.limite} en ${nombreMes(fecha)}`}
              </p>
              {misInvitados.length === 0 ? (
                <p className="campo__ayuda">Todavía no ha registrado invitados.</p>
              ) : (
                <>
                  {motivoBloqueo && misInvitados.some((i) => !elegidos.includes(i.id_invitado)) && (
                    <p className="opciones__aviso" id="invitados-aviso">{motivoBloqueo}</p>
                  )}
                  <div className="opciones">
                    {misInvitados.map((i) => {
                      const marcado = elegidos.includes(i.id_invitado);
                      const bloqueado = !marcado && Boolean(motivoBloqueo);
                      return (
                        <label key={i.id_invitado} className={`opcion ${bloqueado ? 'opcion--bloqueada' : ''}`}>
                          <input
                            type="checkbox"
                            checked={marcado}
                            disabled={bloqueado}
                            aria-describedby={bloqueado ? 'invitados-aviso' : undefined}
                            onChange={() => alternarInvitado(i.id_invitado)}
                          />
                          <span className="opcion__texto">
                            {i.nombre_completo}
                            <span className="opcion__sub">{i.relacion}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              <Link to="/invitados" className="enlace" style={{ display: 'inline-block', marginTop: 10 }}>
                + Registrar invitado
              </Link>
            </div>

            <p className="caja__nota" style={{ marginBottom: 16 }}>
              Su solicitud quedará Pendiente hasta que el club la confirme.
            </p>

            <div className="detalle__acciones">
              <button type="submit" className="boton boton--oscuro" disabled={enviando || !horarioValido}>
                {enviando ? 'Enviando…' : modificando ? 'Guardar cambios' : 'Enviar solicitud'}
              </button>
              <Link to={modificando ? `/reservas/${id}` : '/reservas'} className="enlace enlace--subrayado">Cancelar</Link>
            </div>
          </section>

          <aside className="caja resumen-reserva" aria-live="polite">
            <h2 className="caja__titulo">Su reserva</h2>
            <p className="resumen-reserva__linea">{instalacion?.nombre ?? '—'}</p>
            <p className="resumen-reserva__linea">{fechaConDia(fecha)}</p>
            <p className="resumen-reserva__linea">
              {elegidosTurnos.length
                ? `${rangoHoras(elegidosTurnos[0].hora_inicio, elegidosTurnos[elegidosTurnos.length - 1].hora_fin)} (${elegidosTurnos.length * instalacion.duracion_reserva / 60} horas)`
                : 'Sin horario elegido'}
            </p>
            <p className="resumen-reserva__linea">
              {plural(personas, 'persona', 'personas')}, {elegidos.length ? plural(elegidos.length, 'invitado', 'invitados') : 'sin invitados'}
            </p>

            <div className="resumen-reserva__total">
              {serviciosElegidos.map((s) => (
                <p key={s.id_servicio} className="fila-total">
                  <span>{s.nombre}{s.cantidad > 1 ? ` x${s.cantidad}` : ''}</span>
                  <span>{colones(Number(s.precio) * s.cantidad)}</span>
                </p>
              ))}
              <p className="fila-total fila-total--fuerte">
                <span>Total de servicios</span>
                <span>{colones(total)}</span>
              </p>
              <p className="caja__nota">El total se suma a su estado de cuenta cuando el club confirma la reserva.</p>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
