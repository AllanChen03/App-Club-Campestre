const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ErrorHttp } = require('../utils/ErrorHttp');
const h = require('../utils/horario');
const { buscarInstalacion, maximoPersonas } = require('./instalaciones');
const { disponibilidad, ESTADOS_ACTIVOS } = require('./disponibilidad');
const { contarVisitasMes } = require('./invitados');
const { notificarReserva } = require('./notificacionesReservas');

const MAX_TURNOS = 2;
const DIAS_ANTICIPACION = 90;
const DIAS_PAGO_CARGO = 30;

// Las relaciones se nombran porque visitas_invitados y cargos también
// conectan reservas con instalaciones y socios.
const SELECT_RESERVA = `
    id_reserva,
    id_socio,
    id_instalacion,
    fecha_reserva,
    hora_inicio,
    hora_fin,
    cantidad_personas,
    estado,
    fecha_creacion,
    instalaciones!reservas_id_instalacion_fkey(nombre, tipo_reserva, capacidad),
    reservas_servicios(id_servicio, cantidad, precio_unitario, servicios_adicionales(nombre)),
    visitas_invitados(id_visita, id_invitado, estado, invitados(nombre_completo, cedula, relacion))
`;

const SELECT_DETALLE = `
    ${SELECT_RESERVA},
    socios!reservas_id_socio_fkey(numero_socio, id_usuario, usuarios(nombre_completo, telefono)),
    historial_reservas(estado_anterior, estado_nuevo, motivo, fecha, usuarios(nombre_completo)),
    cargos(id_cargo, monto, estado)
`;

// La base rechaza reservas que chocan (trigger validar_choque_reserva, código 23P01).
// Pasa cuando dos personas reservan el mismo turno al mismo tiempo.
function errorDeGuardado(error) {
    return error?.code === '23P01' ? new ErrorHttp(409, error.message) : new Error(error.message);
}

const codigo = (id) => `R-${String(id).padStart(4, '0')}`;

function formatear(r) {
    const servicios = (r.reservas_servicios ?? []).map((s) => ({
        id_servicio: s.id_servicio,
        nombre: s.servicios_adicionales?.nombre ?? '',
        cantidad: s.cantidad,
        precio_unitario: Number(s.precio_unitario)
    }));

    const salida = {
        id_reserva: r.id_reserva,
        codigo: codigo(r.id_reserva),
        id_socio: r.id_socio,
        id_instalacion: r.id_instalacion,
        instalacion: r.instalaciones?.nombre ?? '',
        tipo_reserva: r.instalaciones?.tipo_reserva ?? '',
        fecha_reserva: r.fecha_reserva,
        hora_inicio: r.hora_inicio,
        hora_fin: r.hora_fin,
        cantidad_personas: r.cantidad_personas,
        estado: r.estado,
        fecha_creacion: r.fecha_creacion,
        servicios,
        total_servicios: servicios.reduce((t, s) => t + s.cantidad * s.precio_unitario, 0),
        invitados: (r.visitas_invitados ?? [])
            .filter((v) => v.estado !== 'Cancelada')
            .map((v) => ({
                id_visita: v.id_visita,
                id_invitado: v.id_invitado,
                nombre_completo: v.invitados?.nombre_completo ?? '',
                cedula: v.invitados?.cedula ?? '',
                relacion: v.invitados?.relacion ?? ''
            })),
        editable: ESTADOS_ACTIVOS.includes(r.estado) && !h.yaInicio(r.fecha_reserva, r.hora_inicio)
    };

    if (r.socios) {
        salida.socio = {
            numero_socio: r.socios.numero_socio,
            nombre_completo: r.socios.usuarios?.nombre_completo ?? '',
            telefono: r.socios.usuarios?.telefono ?? ''
        };
    }

    if (r.historial_reservas) {
        salida.historial = [...r.historial_reservas]
            .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
            .map((x) => ({
                estado_anterior: x.estado_anterior,
                estado_nuevo: x.estado_nuevo,
                motivo: x.motivo,
                fecha: x.fecha,
                usuario: x.usuarios?.nombre_completo ?? null
            }));
    }

    if (r.cargos) {
        salida.cargo = r.cargos.find((c) => c.estado !== 'Anulado') ?? null;
    }

    return salida;
}

// ---------------------- Historial y cambios de estado ----------------------

async function registrarHistorial(idReserva, anterior, nuevo, idUsuario, motivo = null) {
    const { error } = await supabaseAdmin.from('historial_reservas').insert({
        id_reserva: idReserva,
        estado_anterior: anterior,
        estado_nuevo: nuevo,
        id_usuario: idUsuario,
        motivo
    });
    if (error) console.error('Error al registrar historial de reserva:', error.message);
}

// Cambia el estado solo si sigue en el estado esperado (evita cambios cruzados)
async function cambiarEstado(reserva, nuevo, idUsuario, motivo = null) {
    const { data, error } = await supabaseAdmin
        .from('reservas')
        .update({ estado: nuevo })
        .eq('id_reserva', reserva.id_reserva)
        .eq('estado', reserva.estado)
        .select('id_reserva')
        .maybeSingle();

    if (error) throw errorDeGuardado(error);
    if (!data) throw new ErrorHttp(409, 'La reserva cambió mientras tanto. Recargue e intente de nuevo');

    await registrarHistorial(reserva.id_reserva, reserva.estado, nuevo, idUsuario, motivo);
}

// Pone al día las reservas cuyo horario ya pasó:
// confirmadas que terminaron -> Finalizada; pendientes que ya empezaron -> Cancelada.
async function actualizarVencidas() {
    const hoy = h.ahora().fecha;

    const { data, error } = await supabaseAdmin
        .from('reservas')
        .select('id_reserva, fecha_reserva, hora_inicio, hora_fin, estado')
        .in('estado', ESTADOS_ACTIVOS)
        .lte('fecha_reserva', hoy);

    if (error) throw new Error(error.message);

    for (const r of data) {
        try {
            if (r.estado === 'Confirmada' && h.yaTermino(r.fecha_reserva, r.hora_fin)) {
                await cambiarEstado(r, 'Finalizada', null, 'La reserva terminó');
            } else if (r.estado === 'Pendiente' && h.yaInicio(r.fecha_reserva, r.hora_inicio)) {
                await cambiarEstado(r, 'Cancelada', null, 'No se confirmó antes de la hora de inicio');
                await cancelarVisitas(r.id_reserva);
                await anularCargo(r.id_reserva);
            }
        } catch (e) {
            if (!(e instanceof ErrorHttp)) console.error('Error al actualizar reserva vencida:', e.message);
        }
    }

    // Visitas de días anteriores que siguen programadas
    await supabaseAdmin
        .from('visitas_invitados')
        .update({ estado: 'Finalizada' })
        .eq('estado', 'Programada')
        .lt('fecha_visita', hoy);
}

// ---------------------- Cargos de servicios adicionales ----------------------

async function crearCargo(reserva) {
    if (!reserva.total_servicios) return null;

    // Si ya hay un cargo vigente (por ejemplo, ya pagado), no se cobra dos veces
    const { data: existente, error: errorExistente } = await supabaseAdmin
        .from('cargos')
        .select('id_cargo')
        .eq('id_reserva', reserva.id_reserva)
        .neq('estado', 'Anulado')
        .limit(1);

    if (errorExistente) throw new Error(errorExistente.message);
    if (existente.length) return existente[0];

    // Ejemplo: "R-0016 · Cancha de tenis 16/11/2026: Alquiler de raqueta x2 (₡6 000), Tubo de bolas (₡2 000)"
    const colones = (n) => `₡${Number(n).toLocaleString('es-CR')}`;
    const detalle = reserva.servicios
        .map((s) => `${s.nombre}${s.cantidad > 1 ? ` x${s.cantidad}` : ''} (${colones(s.cantidad * s.precio_unitario)})`)
        .join(', ');
    const fecha = reserva.fecha_reserva.split('-').reverse().join('/');

    const { data, error } = await supabaseAdmin
        .from('cargos')
        .insert({
            id_socio: reserva.id_socio,
            id_reserva: reserva.id_reserva,
            concepto: 'Servicios adicionales de reserva',
            descripcion: `${reserva.codigo} · ${reserva.instalacion} ${fecha}: ${detalle}`.slice(0, 255),
            monto: reserva.total_servicios,
            fecha_vencimiento: h.sumarDias(h.ahora().fecha, DIAS_PAGO_CARGO),
            estado: 'Pendiente'
        })
        .select('id_cargo')
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// Anula el cargo pendiente de una reserva. Si ya se pagó, se deja como está.
async function anularCargo(idReserva) {
    const { error } = await supabaseAdmin
        .from('cargos')
        .update({ estado: 'Anulado' })
        .eq('id_reserva', idReserva)
        .eq('estado', 'Pendiente');

    if (error) throw new Error(error.message);
}

async function cancelarVisitas(idReserva) {
    const { error } = await supabaseAdmin
        .from('visitas_invitados')
        .update({ estado: 'Cancelada' })
        .eq('id_reserva', idReserva)
        .eq('estado', 'Programada');

    if (error) throw new Error(error.message);
}

// ---------------------- Validación de una solicitud ----------------------

function leerSolicitud(body, { parcial = false } = {}) {
    const datos = body ?? {};
    const salida = {};

    if (!parcial || datos.id_instalacion !== undefined) {
        if (!Number.isInteger(datos.id_instalacion)) throw new ErrorHttp(400, 'Elija una instalación');
        salida.id_instalacion = datos.id_instalacion;
    }

    if (!h.esFecha(datos.fecha_reserva)) throw new ErrorHttp(400, 'Elija una fecha válida');
    if (!h.esHora(datos.hora_inicio) || !h.esHora(datos.hora_fin)) {
        throw new ErrorHttp(400, 'Elija un horario válido');
    }
    if (!Number.isInteger(datos.cantidad_personas) || datos.cantidad_personas < 1) {
        throw new ErrorHttp(400, 'Indique cuántas personas asistirán');
    }

    const servicios = datos.servicios ?? [];
    if (!Array.isArray(servicios) || servicios.some((s) =>
        !Number.isInteger(s?.id_servicio) || !Number.isInteger(s?.cantidad) || s.cantidad < 1 || s.cantidad > 20)) {
        throw new ErrorHttp(400, 'Los servicios adicionales no son válidos');
    }
    if (new Set(servicios.map((s) => s.id_servicio)).size !== servicios.length) {
        throw new ErrorHttp(400, 'Un servicio aparece repetido');
    }

    const invitados = datos.invitados ?? [];
    if (!Array.isArray(invitados) || invitados.some((i) => !Number.isInteger(i)) ||
        new Set(invitados).size !== invitados.length) {
        throw new ErrorHttp(400, 'La lista de invitados no es válida');
    }

    return {
        ...salida,
        fecha_reserva: datos.fecha_reserva,
        hora_inicio: h.aHora(h.aMinutos(datos.hora_inicio)),
        hora_fin: h.aHora(h.aMinutos(datos.hora_fin)),
        cantidad_personas: datos.cantidad_personas,
        servicios,
        invitados
    };
}

// Revisa horario, aforo, choques y bloqueos. Devuelve los servicios con precio.
async function validarReserva(instalacion, s, { excluirId = null } = {}) {
    if (instalacion.estado !== 'Activa') {
        throw new ErrorHttp(409, 'La instalación no está disponible para reservas');
    }

    const hoy = h.ahora().fecha;
    if (s.fecha_reserva < hoy) throw new ErrorHttp(400, 'La fecha ya pasó');
    if (s.fecha_reserva > h.sumarDias(hoy, DIAS_ANTICIPACION)) {
        throw new ErrorHttp(400, `Solo se puede reservar con hasta ${DIAS_ANTICIPACION} días de anticipación`);
    }

    const maximo = maximoPersonas(instalacion);
    if (s.cantidad_personas > maximo) {
        throw new ErrorHttp(400, `Esta instalación admite como máximo ${maximo} personas por reserva`);
    }

    // El horario debe ser 1 o 2 turnos seguidos
    const turnos = await disponibilidad(instalacion, s.fecha_reserva, excluirId);
    const inicio = turnos.findIndex((t) => t.hora_inicio === s.hora_inicio);
    const fin = turnos.findIndex((t) => t.hora_fin === s.hora_fin);

    if (inicio === -1 || fin === -1 || fin < inicio) {
        throw new ErrorHttp(400, 'El horario debe coincidir con los turnos de la instalación');
    }
    if (fin - inicio + 1 > MAX_TURNOS) {
        throw new ErrorHttp(400, `Puede reservar como máximo ${MAX_TURNOS} turnos seguidos`);
    }

    for (const t of turnos.slice(inicio, fin + 1)) {
        const rango = `${t.hora_inicio.slice(0, 5)}–${t.hora_fin.slice(0, 5)}`;
        if (t.estado === 'Pasado') throw new ErrorHttp(400, `El turno de ${rango} ya empezó`);
        if (t.estado === 'Bloqueado') {
            throw new ErrorHttp(409, `La instalación está bloqueada de ${rango}: ${t.motivo_bloqueo}`);
        }
        if (instalacion.tipo_reserva === 'Exclusiva' && t.estado === 'Ocupado') {
            throw new ErrorHttp(409, `El turno de ${rango} ya está reservado`);
        }
        if (instalacion.tipo_reserva === 'Por capacidad' && t.cupo < s.cantidad_personas) {
            throw new ErrorHttp(409, t.cupo > 0
                ? `En el turno de ${rango} solo quedan ${t.cupo} espacios`
                : `El turno de ${rango} está lleno`);
        }
    }

    // Servicios: deben pertenecer a la instalación y estar activos
    const disponibles = new Map(instalacion.servicios_adicionales
        .filter((x) => x.estado === 'Activo')
        .map((x) => [x.id_servicio, x]));

    return s.servicios.map((x) => {
        const servicio = disponibles.get(x.id_servicio);
        if (!servicio) throw new ErrorHttp(400, 'Uno de los servicios no está disponible para esta instalación');
        return { id_servicio: x.id_servicio, cantidad: x.cantidad, precio_unitario: Number(servicio.precio) };
    });
}

// Invitados elegidos: deben ser del socio, caber en la reserva y en el cupo del mes
async function validarInvitados(socio, s, idReserva = null) {
    if (s.invitados.length === 0) return;

    if (s.invitados.length > s.cantidad_personas - 1) {
        throw new ErrorHttp(400, 'Los invitados no pueden superar el número de personas menos usted');
    }

    const { data, error } = await supabaseAdmin
        .from('invitados')
        .select('id_invitado')
        .eq('id_socio', socio.id_socio)
        .in('id_invitado', s.invitados);

    if (error) throw new Error(error.message);
    if (data.length !== s.invitados.length) throw new ErrorHttp(400, 'Uno de los invitados no es válido');

    const usados = await contarVisitasMes(socio.id_socio, s.fecha_reserva, { excluirReserva: idReserva });
    const limite = socio.membresia?.max_invitados ?? 0;

    // Un invitado que ya tiene visita ese día no gasta otro espacio del cupo
    const yaVienen = new Set((await visitasDelDia(s.invitados, s.fecha_reserva, idReserva)).map((v) => v.id_invitado));
    const nuevos = s.invitados.filter((id) => !yaVienen.has(id)).length;

    if (usados + nuevos > limite) {
        const quedan = Math.max(limite - usados, 0);
        throw new ErrorHttp(409,
            `Su membresía permite ${limite} invitados por mes. Le quedan ${quedan} para ese mes`);
    }
}

async function guardarServicios(idReserva, servicios) {
    const { error: errorBorrar } = await supabaseAdmin
        .from('reservas_servicios').delete().eq('id_reserva', idReserva);
    if (errorBorrar) throw new Error(errorBorrar.message);

    if (servicios.length === 0) return;

    const { error } = await supabaseAdmin.from('reservas_servicios')
        .insert(servicios.map((x) => ({ ...x, id_reserva: idReserva })));
    if (error) throw new Error(error.message);
}

// Visitas activas de estos invitados en una fecha que no son de esta reserva
async function visitasDelDia(idsInvitados, fecha, idReserva = null) {
    if (!idsInvitados.length) return [];
    const { data, error } = await supabaseAdmin
        .from('visitas_invitados')
        .select('id_visita, id_invitado, id_reserva')
        .in('id_invitado', idsInvitados)
        .eq('fecha_visita', fecha)
        .eq('estado', 'Programada');
    if (error) throw new Error(error.message);
    return data.filter((v) => v.id_reserva !== idReserva);
}

// Deja las visitas de la reserva iguales a la lista de invitados.
// Si el invitado ya tenía una visita suelta ese día, se usa esa misma
// (así no aparece dos veces en recepción ni gasta dos espacios del cupo).
async function guardarVisitas(idReserva, s, idInstalacion) {
    const { data: actuales, error } = await supabaseAdmin
        .from('visitas_invitados')
        .select('id_visita, id_invitado')
        .eq('id_reserva', idReserva)
        .eq('estado', 'Programada');

    if (error) throw new Error(error.message);

    const quitar = actuales.filter((v) => !s.invitados.includes(v.id_invitado)).map((v) => v.id_visita);
    const mantener = actuales.filter((v) => s.invitados.includes(v.id_invitado));
    const agregar = s.invitados.filter((id) => !actuales.some((v) => v.id_invitado === id));

    if (quitar.length) {
        await supabaseAdmin.from('visitas_invitados').update({ estado: 'Cancelada' }).in('id_visita', quitar);
    }
    if (mantener.length) {
        await supabaseAdmin.from('visitas_invitados')
            .update({ fecha_visita: s.fecha_reserva, id_instalacion: idInstalacion })
            .in('id_visita', mantener.map((v) => v.id_visita));
    }

    // Visitas sueltas (sin reserva) de estos invitados en la fecha de la reserva
    const sueltas = (await visitasDelDia(s.invitados, s.fecha_reserva, idReserva))
        .filter((v) => v.id_reserva === null);

    const nuevas = [];
    for (const id of agregar) {
        const suelta = sueltas.find((v) => v.id_invitado === id);
        if (suelta) {
            const { error: e } = await supabaseAdmin.from('visitas_invitados')
                .update({ id_reserva: idReserva, id_instalacion: idInstalacion })
                .eq('id_visita', suelta.id_visita);
            if (e) throw new Error(e.message);
        } else {
            nuevas.push({ id_invitado: id, id_reserva: idReserva, id_instalacion: idInstalacion, fecha_visita: s.fecha_reserva });
        }
    }

    // Si la reserva cambió de fecha y el invitado ya tenía una visita suelta ese día, sobra
    const duplicadas = sueltas
        .filter((v) => mantener.some((m) => m.id_invitado === v.id_invitado))
        .map((v) => v.id_visita);
    if (duplicadas.length) {
        await supabaseAdmin.from('visitas_invitados').update({ estado: 'Cancelada' }).in('id_visita', duplicadas);
    }

    if (nuevas.length) {
        const { error: e } = await supabaseAdmin.from('visitas_invitados').insert(nuevas);
        if (e) throw new Error(e.message);
    }
}

// ---------------------- Consultas ----------------------

async function buscarReserva(idReserva, { detalle = false } = {}) {
    const { data, error } = await supabaseAdmin
        .from('reservas')
        .select(detalle ? SELECT_DETALLE : SELECT_RESERVA)
        .eq('id_reserva', idReserva)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? formatear(data) : null;
}

async function listarReservasSocio(idSocio) {
    await actualizarVencidas();

    const { data, error } = await supabaseAdmin
        .from('reservas')
        .select(SELECT_RESERVA)
        .eq('id_socio', idSocio)
        .order('fecha_reserva', { ascending: false })
        .order('hora_inicio', { ascending: false });

    if (error) throw new Error(error.message);
    return data.map(formatear);
}

async function listarReservasAdmin({ desde, hasta, id_instalacion, estado }) {
    await actualizarVencidas();

    let consulta = supabaseAdmin
        .from('reservas')
        .select(`${SELECT_RESERVA}, socios!reservas_id_socio_fkey(numero_socio, usuarios(nombre_completo))`)
        .gte('fecha_reserva', desde)
        .lte('fecha_reserva', hasta)
        .order('fecha_reserva', { ascending: true })
        .order('hora_inicio', { ascending: true });

    if (id_instalacion) consulta = consulta.eq('id_instalacion', id_instalacion);
    if (estado) consulta = consulta.eq('estado', estado);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data.map(formatear);
}

async function detalleReserva(idReserva) {
    await actualizarVencidas();
    return buscarReserva(idReserva, { detalle: true });
}

// ---------------------- Acciones ----------------------

async function crearReserva(socio, body) {
    const s = leerSolicitud(body);
    const instalacion = await buscarInstalacion(s.id_instalacion);
    if (!instalacion) throw new ErrorHttp(404, 'Instalación no encontrada');

    const servicios = await validarReserva(instalacion, s);
    await validarInvitados(socio, s);

    const { data, error } = await supabaseAdmin
        .from('reservas')
        .insert({
            id_socio: socio.id_socio,
            id_instalacion: s.id_instalacion,
            fecha_reserva: s.fecha_reserva,
            hora_inicio: s.hora_inicio,
            hora_fin: s.hora_fin,
            cantidad_personas: s.cantidad_personas,
            estado: 'Pendiente'
        })
        .select('id_reserva')
        .single();

    if (error) throw errorDeGuardado(error);

    await guardarServicios(data.id_reserva, servicios);
    await guardarVisitas(data.id_reserva, s, s.id_instalacion);
    await registrarHistorial(data.id_reserva, null, 'Pendiente', socio.id_usuario, 'Solicitud del socio');

    const reserva = await buscarReserva(data.id_reserva, { detalle: true });
    notificarReserva('recepcion', reserva);
    return reserva;
}

// Modificación por el socio (vuelve a Pendiente) o por un administrador
// (mantiene el estado y recalcula el cargo si ya estaba confirmada).
async function modificarReserva(idReserva, body, { socio = null, idUsuario, esAdmin = false }) {
    const actual = await buscarReserva(idReserva);
    if (!actual) throw new ErrorHttp(404, 'Reserva no encontrada');
    if (socio && actual.id_socio !== socio.id_socio) throw new ErrorHttp(404, 'Reserva no encontrada');
    if (!actual.editable) {
        throw new ErrorHttp(409, 'Solo se pueden modificar reservas pendientes o confirmadas que aún no han iniciado');
    }

    const s = leerSolicitud({ ...body, id_instalacion: actual.id_instalacion });
    const instalacion = await buscarInstalacion(actual.id_instalacion);
    const servicios = await validarReserva(instalacion, s, { excluirId: idReserva });

    // Los invitados se validan contra el socio dueño de la reserva
    const dueno = socio ?? await duenoDeReserva(actual);
    await validarInvitados(dueno, s, idReserva);

    const nuevoEstado = esAdmin ? actual.estado : 'Pendiente';

    const { data, error } = await supabaseAdmin
        .from('reservas')
        .update({
            fecha_reserva: s.fecha_reserva,
            hora_inicio: s.hora_inicio,
            hora_fin: s.hora_fin,
            cantidad_personas: s.cantidad_personas,
            estado: nuevoEstado
        })
        .eq('id_reserva', idReserva)
        .eq('estado', actual.estado)
        .select('id_reserva')
        .maybeSingle();

    if (error) throw errorDeGuardado(error);
    if (!data) throw new ErrorHttp(409, 'La reserva cambió mientras tanto. Recargue e intente de nuevo');

    await guardarServicios(idReserva, servicios);
    await guardarVisitas(idReserva, s, actual.id_instalacion);

    if (actual.estado === 'Confirmada') await anularCargo(idReserva);

    await registrarHistorial(idReserva, actual.estado, nuevoEstado, idUsuario,
        esAdmin ? 'Modificada por el club' : 'Modificada por el socio');

    const reserva = await buscarReserva(idReserva, { detalle: true });

    if (nuevoEstado === 'Confirmada') await crearCargo(reserva);

    notificarReserva('modificacion', reserva);
    return buscarReserva(idReserva, { detalle: true });
}

async function duenoDeReserva(reserva) {
    const { data, error } = await supabaseAdmin
        .from('socios')
        .select('id_usuario')
        .eq('id_socio', reserva.id_socio)
        .single();
    if (error) throw new Error(error.message);
    const { socioDeUsuario } = require('./socios');
    return socioDeUsuario(data.id_usuario);
}

async function confirmarReserva(idReserva, idUsuario) {
    const actual = await buscarReserva(idReserva);
    if (!actual) throw new ErrorHttp(404, 'Reserva no encontrada');
    if (actual.estado !== 'Pendiente') throw new ErrorHttp(409, 'Solo se pueden confirmar reservas pendientes');
    if (h.yaInicio(actual.fecha_reserva, actual.hora_inicio)) {
        throw new ErrorHttp(409, 'La reserva ya inició y no se puede confirmar');
    }

    await cambiarEstado(actual, 'Confirmada', idUsuario, 'Confirmada por el club');
    await crearCargo(actual);

    const reserva = await buscarReserva(idReserva, { detalle: true });
    notificarReserva('confirmacion', reserva);
    return reserva;
}

async function cancelarReserva(idReserva, { socio = null, idUsuario, motivo = null }) {
    const actual = await buscarReserva(idReserva);
    if (!actual) throw new ErrorHttp(404, 'Reserva no encontrada');
    if (socio && actual.id_socio !== socio.id_socio) throw new ErrorHttp(404, 'Reserva no encontrada');
    if (!actual.editable) {
        throw new ErrorHttp(409, 'Solo se pueden cancelar reservas pendientes o confirmadas que aún no han iniciado');
    }

    await cambiarEstado(actual, 'Cancelada', idUsuario,
        motivo || (socio ? 'Cancelada por el socio' : 'Cancelada por el club'));
    await cancelarVisitas(idReserva);
    await anularCargo(idReserva);

    const reserva = await buscarReserva(idReserva, { detalle: true });
    notificarReserva('cancelacion', reserva, { motivo });
    return reserva;
}

// Cuando una cuenta de socio se suspende o desactiva, sus reservas que aún no
// empiezan se cancelan (liberan el turno, anulan el cargo y avisan por correo)
// y sus visitas de invitados futuras también. Las que ya empezaron no se tocan.
async function cancelarReservasDelSocio(idUsuario, { idUsuarioAdmin, motivo }) {
    const { data: socio, error } = await supabaseAdmin
        .from('socios')
        .select('id_socio')
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!socio) return { canceladas: [], visitas: 0 };

    await actualizarVencidas();
    const hoy = h.ahora().fecha;

    const { data: reservas, error: e } = await supabaseAdmin
        .from('reservas')
        .select('id_reserva')
        .eq('id_socio', socio.id_socio)
        .in('estado', ESTADOS_ACTIVOS)
        .gte('fecha_reserva', hoy);

    if (e) throw new Error(e.message);

    const canceladas = [];
    for (const r of reservas) {
        try {
            const c = await cancelarReserva(r.id_reserva, { idUsuario: idUsuarioAdmin, motivo });
            canceladas.push(c.codigo);
        } catch (err) {
            // Una reserva que ya empezó no se cancela
            if (!(err instanceof ErrorHttp)) throw err;
        }
    }

    // Visitas sin reserva (las de las reservas ya se cancelaron arriba)
    const invitados = await idsInvitadosDe(socio.id_socio);
    if (!invitados.length) return { canceladas, visitas: 0 };

    const { data: visitas, error: ev } = await supabaseAdmin
        .from('visitas_invitados')
        .update({ estado: 'Cancelada' })
        .eq('estado', 'Programada')
        .gte('fecha_visita', hoy)
        .in('id_invitado', invitados)
        .select('id_visita');

    if (ev) throw new Error(ev.message);
    return { canceladas, visitas: visitas.length };
}

async function idsInvitadosDe(idSocio) {
    const { data, error } = await supabaseAdmin
        .from('invitados')
        .select('id_invitado')
        .eq('id_socio', idSocio);

    if (error) throw new Error(error.message);
    return data.map((i) => i.id_invitado);
}

module.exports = {
    codigo,
    formatear,
    actualizarVencidas,
    cancelarVisitas,
    anularCargo,
    cambiarEstado,
    buscarReserva,
    listarReservasSocio,
    listarReservasAdmin,
    detalleReserva,
    crearReserva,
    modificarReserva,
    confirmarReserva,
    cancelarReserva,
    cancelarReservasDelSocio
};
