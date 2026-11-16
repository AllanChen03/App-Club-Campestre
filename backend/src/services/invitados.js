const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ErrorHttp } = require('../utils/ErrorHttp');
const { esTexto } = require('../utils/validaciones');
const h = require('../utils/horario');

const RELACIONES = ['Familiar', 'Amigo', 'Otro'];

function rangoMes(fecha) {
    const inicio = `${fecha.slice(0, 7)}-01`;
    const d = new Date(`${inicio}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return { inicio, siguiente: d.toISOString().slice(0, 10) };
}

// Visitas (no canceladas) de los invitados de un socio en el mes de `fecha`
async function contarVisitasMes(idSocio, fecha, { excluirReserva = null } = {}) {
    const { inicio, siguiente } = rangoMes(fecha);

    let consulta = supabaseAdmin
        .from('visitas_invitados')
        .select('id_visita, id_reserva, id_invitado, fecha_visita, invitados!inner(id_socio)')
        .eq('invitados.id_socio', idSocio)
        .neq('estado', 'Cancelada')
        .gte('fecha_visita', inicio)
        .lt('fecha_visita', siguiente);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    // Un mismo invitado el mismo día cuenta una sola vez, aunque tenga varias visitas
    const unicas = new Set(data
        .filter((v) => !excluirReserva || v.id_reserva !== excluirReserva)
        .map((v) => `${v.id_invitado}|${v.fecha_visita}`));
    return unicas.size;
}

async function cupoDelMes(socio, fecha = h.ahora().fecha) {
    const usados = await contarVisitasMes(socio.id_socio, fecha);
    const limite = socio.membresia?.max_invitados ?? 0;
    const { siguiente } = rangoMes(fecha);
    return {
        mes: fecha.slice(0, 7),
        limite,
        usados,
        restantes: Math.max(limite - usados, 0),
        renueva: siguiente
    };
}

const selectVisita = (extra = '') => `
    id_visita,
    id_reserva,
    fecha_visita,
    estado,
    instalaciones(nombre),
    reservas(id_instalacion, instalaciones!reservas_id_instalacion_fkey(nombre)),
    invitados!inner(id_invitado, id_socio, nombre_completo, cedula, telefono, relacion${extra})
`;
const SELECT_VISITA = selectVisita();

function formatearVisita(v) {
    return {
        id_visita: v.id_visita,
        id_reserva: v.id_reserva,
        fecha_visita: v.fecha_visita,
        estado: v.estado,
        instalacion: v.instalaciones?.nombre ?? v.reservas?.instalaciones?.nombre ?? null,
        id_invitado: v.invitados.id_invitado,
        nombre_completo: v.invitados.nombre_completo,
        cedula: v.invitados.cedula,
        telefono: v.invitados.telefono,
        relacion: v.invitados.relacion
    };
}

// Invitados registrados por el socio (para elegirlos en una reserva) y sus visitas
async function invitadosDelSocio(idSocio) {
    const hoy = h.ahora().fecha;

    const [{ data: invitados, error: e1 }, { data: visitas, error: e2 }] = await Promise.all([
        supabaseAdmin
            .from('invitados')
            .select('id_invitado, nombre_completo, cedula, telefono, relacion, visitas_invitados(estado, id_reserva, fecha_creacion)')
            .eq('id_socio', idSocio)
            .order('nombre_completo', { ascending: true }),
        supabaseAdmin
            .from('visitas_invitados')
            .select(SELECT_VISITA)
            .eq('invitados.id_socio', idSocio)
            .gte('fecha_visita', h.sumarDias(hoy, -90))
            .order('fecha_visita', { ascending: true })
    ]);

    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    const lista = visitas.map(formatearVisita);

    // Si el socio canceló la visita de un invitado desde Invitados y no le queda
    // ninguna otra, el invitado se considera eliminado y ya no se ofrece en las reservas.
    // (Si la visita se canceló porque se canceló una reserva, el invitado sigue disponible.)
    const eliminado = (i) => {
        const visitas = [...(i.visitas_invitados ?? [])]
            .sort((a, b) => String(b.fecha_creacion).localeCompare(String(a.fecha_creacion)));
        return visitas.length > 0 &&
            visitas.every((v) => v.estado === 'Cancelada') &&
            visitas[0].id_reserva === null;
    };

    const vigentes = invitados
        .filter((i) => !eliminado(i))
        .map(({ visitas_invitados: _visitas, ...i }) => i);

    return {
        invitados: vigentes,
        proximas: lista.filter((v) => v.estado === 'Programada' && v.fecha_visita >= hoy),
        anteriores: lista.filter((v) => !(v.estado === 'Programada' && v.fecha_visita >= hoy)).reverse()
    };
}

function leerInvitado(body) {
    const d = body ?? {};
    const cedula = String(d.cedula ?? '').replace(/\D/g, '');
    const telefono = d.telefono ? String(d.telefono).replace(/\D/g, '') : null;

    if (!esTexto(d.nombre_completo) || d.nombre_completo.trim().length > 150) {
        throw new ErrorHttp(400, 'Escriba el nombre completo del invitado');
    }
    if (!/^[1-9]\d{0,11}$/.test(cedula)) {
        throw new ErrorHttp(400, 'La cédula debe tener solo números y no puede empezar con 0');
    }
    if (telefono && !/^\d{8}$/.test(telefono)) {
        throw new ErrorHttp(400, 'El teléfono debe tener 8 dígitos');
    }
    if (!RELACIONES.includes(d.relacion)) {
        throw new ErrorHttp(400, 'Elija la relación: Familiar, Amigo u Otro');
    }

    return { nombre_completo: d.nombre_completo.trim(), cedula, telefono, relacion: d.relacion };
}

// Busca al invitado del socio por cédula; si no existe, lo crea. Si existe, actualiza sus datos.
async function guardarInvitado(idSocio, datos) {
    const { data: existente, error } = await supabaseAdmin
        .from('invitados')
        .select('id_invitado')
        .eq('id_socio', idSocio)
        .eq('cedula', datos.cedula)
        .limit(1);

    if (error) throw new Error(error.message);

    if (existente.length) {
        const id = existente[0].id_invitado;
        const { error: e } = await supabaseAdmin.from('invitados').update(datos).eq('id_invitado', id);
        if (e) throw new Error(e.message);
        return id;
    }

    const { data, error: e } = await supabaseAdmin
        .from('invitados')
        .insert({ ...datos, id_socio: idSocio })
        .select('id_invitado')
        .single();

    if (e) throw new Error(e.message);
    return data.id_invitado;
}

// Registra un invitado y su visita (con o sin instalación)
async function registrarVisita(socio, body) {
    const datos = leerInvitado(body);
    const fecha = body?.fecha_visita;
    const hoy = h.ahora().fecha;

    if (!h.esFecha(fecha)) throw new ErrorHttp(400, 'Elija la fecha de la visita');
    if (fecha < hoy) throw new ErrorHttp(400, 'La fecha de la visita ya pasó');
    if (fecha > h.sumarDias(hoy, 90)) throw new ErrorHttp(400, 'Puede registrar visitas con hasta 90 días de anticipación');

    let idInstalacion = null;
    if (body.id_instalacion !== undefined && body.id_instalacion !== null && body.id_instalacion !== '') {
        if (!Number.isInteger(body.id_instalacion)) throw new ErrorHttp(400, 'La instalación no es válida');
        const { data, error } = await supabaseAdmin
            .from('instalaciones').select('id_instalacion, estado')
            .eq('id_instalacion', body.id_instalacion).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data || data.estado !== 'Activa') throw new ErrorHttp(400, 'La instalación no está disponible');
        idInstalacion = data.id_instalacion;
    }

    const cupo = await cupoDelMes(socio, fecha);
    if (cupo.restantes <= 0) {
        throw new ErrorHttp(409, `Ya usó los ${cupo.limite} invitados que su membresía permite para ese mes`);
    }

    const idInvitado = await guardarInvitado(socio.id_socio, datos);

    // El mismo invitado no se registra dos veces el mismo día
    const { data: repetida, error: e1 } = await supabaseAdmin
        .from('visitas_invitados')
        .select('id_visita')
        .eq('id_invitado', idInvitado)
        .eq('fecha_visita', fecha)
        .neq('estado', 'Cancelada')
        .limit(1);

    if (e1) throw new Error(e1.message);
    if (repetida.length) throw new ErrorHttp(409, 'Este invitado ya tiene una visita registrada ese día');

    const { data, error } = await supabaseAdmin
        .from('visitas_invitados')
        .insert({ id_invitado: idInvitado, id_instalacion: idInstalacion, fecha_visita: fecha })
        .select(SELECT_VISITA)
        .single();

    if (error) throw new Error(error.message);
    return formatearVisita(data);
}

async function cancelarVisita(socio, idVisita) {
    const { data, error } = await supabaseAdmin
        .from('visitas_invitados')
        .select('id_visita, id_reserva, fecha_visita, estado, invitados!inner(id_socio)')
        .eq('id_visita', idVisita)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data || data.invitados.id_socio !== socio.id_socio) throw new ErrorHttp(404, 'Visita no encontrada');
    if (data.id_reserva) {
        throw new ErrorHttp(409, 'Esta visita es parte de una reserva. Quite al invitado desde la reserva');
    }
    if (data.estado !== 'Programada' || data.fecha_visita < h.ahora().fecha) {
        throw new ErrorHttp(409, 'Solo se pueden cancelar visitas programadas que no han pasado');
    }

    const { error: e } = await supabaseAdmin
        .from('visitas_invitados').update({ estado: 'Cancelada' }).eq('id_visita', idVisita);
    if (e) throw new Error(e.message);
}

// Recepción: invitados esperados en un día
async function invitadosDelDia(fecha) {
    const { data, error } = await supabaseAdmin
        .from('visitas_invitados')
        .select(selectVisita(', socios(id_usuario, numero_socio, usuarios(nombre_completo))'))
        .eq('fecha_visita', fecha)
        .neq('estado', 'Cancelada')
        .order('id_visita', { ascending: true });

    if (error) throw new Error(error.message);

    // Una fila por invitado: si tiene varias visitas ese día, se juntan sus instalaciones
    const porInvitado = new Map();
    data.forEach((v) => {
        const previa = porInvitado.get(v.invitados.id_invitado);
        if (!previa) return porInvitado.set(v.invitados.id_invitado, v);
        const nombres = (x) => x.instalaciones?.nombre ?? x.reservas?.instalaciones?.nombre ?? null;
        const juntas = [...new Set([nombres(previa), nombres(v)].filter(Boolean))].join(' y ');
        porInvitado.set(v.invitados.id_invitado, { ...previa, instalaciones: juntas ? { nombre: juntas } : null });
    });

    return [...porInvitado.values()].map((v) => ({
        ...formatearVisita(v),
        socio: {
            id_usuario: v.invitados?.socios?.id_usuario ?? null,
            numero_socio: v.invitados?.socios?.numero_socio ?? '',
            nombre_completo: v.invitados?.socios?.usuarios?.nombre_completo ?? ''
        }
    }));
}

module.exports = {
    RELACIONES,
    contarVisitasMes,
    cupoDelMes,
    invitadosDelSocio,
    registrarVisita,
    cancelarVisita,
    invitadosDelDia
};
