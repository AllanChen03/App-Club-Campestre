const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ErrorHttp } = require('../utils/ErrorHttp');
const { esTexto } = require('../utils/validaciones');
const h = require('../utils/horario');
const { buscarInstalacion } = require('./instalaciones');
const { ESTADOS_ACTIVOS, normalizar } = require('./disponibilidad');
const { cancelarReserva } = require('./reservas');

const MAX_DIAS_BLOQUEO = 365;
const REGEX_MARCA = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:00)?$/;

function leerMarca(valor, campo) {
    if (typeof valor !== 'string' || !REGEX_MARCA.test(valor) || !h.esFecha(valor.slice(0, 10))) {
        throw new ErrorHttp(400, `La fecha y hora de ${campo} no son válidas`);
    }
    return `${valor.slice(0, 16)}:00`;
}

async function listarBloqueos({ id_instalacion, incluirPasados = false } = {}) {
    const actual = h.ahora();

    let consulta = supabaseAdmin
        .from('bloqueos_instalaciones')
        .select('id_bloqueo, id_instalacion, fecha_inicio, fecha_fin, motivo, fecha_creacion, instalaciones(nombre)')
        .order('fecha_inicio', { ascending: true });

    if (id_instalacion) consulta = consulta.eq('id_instalacion', id_instalacion);
    if (!incluirPasados) consulta = consulta.gt('fecha_fin', `${actual.fecha}T${h.aHora(actual.minutos)}`);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    return data.map((b) => ({
        id_bloqueo: b.id_bloqueo,
        id_instalacion: b.id_instalacion,
        instalacion: b.instalaciones?.nombre ?? '',
        fecha_inicio: normalizar(b.fecha_inicio),
        fecha_fin: normalizar(b.fecha_fin),
        motivo: b.motivo
    }));
}

// Crea el bloqueo y cancela las reservas activas que caen dentro
async function crearBloqueo(body, idUsuario) {
    const d = body ?? {};

    if (!Number.isInteger(d.id_instalacion)) throw new ErrorHttp(400, 'Elija una instalación');
    if (!esTexto(d.motivo) || d.motivo.trim().length > 200) throw new ErrorHttp(400, 'Escriba el motivo del bloqueo');

    const inicio = leerMarca(d.fecha_inicio, 'inicio');
    const fin = leerMarca(d.fecha_fin, 'fin');

    if (fin <= inicio) throw new ErrorHttp(400, 'El fin del bloqueo debe ser posterior al inicio');
    if (h.diasEntre(inicio.slice(0, 10), fin.slice(0, 10)) > MAX_DIAS_BLOQUEO) {
        throw new ErrorHttp(400, 'Un bloqueo puede durar como máximo un año');
    }

    const actual = h.ahora();
    if (fin <= `${actual.fecha}T${h.aHora(actual.minutos)}`) {
        throw new ErrorHttp(400, 'El bloqueo termina en el pasado');
    }

    const instalacion = await buscarInstalacion(d.id_instalacion);
    if (!instalacion) throw new ErrorHttp(404, 'Instalación no encontrada');

    // Reservas activas que se cruzan con el bloqueo
    const { data: reservas, error } = await supabaseAdmin
        .from('reservas')
        .select('id_reserva, fecha_reserva, hora_inicio, hora_fin')
        .eq('id_instalacion', d.id_instalacion)
        .in('estado', ESTADOS_ACTIVOS)
        .gte('fecha_reserva', inicio.slice(0, 10))
        .lte('fecha_reserva', fin.slice(0, 10));

    if (error) throw new Error(error.message);

    const afectadas = reservas.filter((r) =>
        h.marca(r.fecha_reserva, r.hora_inicio) < fin && h.marca(r.fecha_reserva, r.hora_fin) > inicio);

    const motivo = d.motivo.trim();

    const { data: bloqueo, error: e } = await supabaseAdmin
        .from('bloqueos_instalaciones')
        .insert({ id_instalacion: d.id_instalacion, fecha_inicio: inicio, fecha_fin: fin, motivo })
        .select('id_bloqueo')
        .single();

    if (e) throw new Error(e.message);

    const canceladas = [];
    for (const r of afectadas) {
        try {
            const c = await cancelarReserva(r.id_reserva, {
                idUsuario,
                motivo: `Instalación bloqueada: ${motivo}`
            });
            canceladas.push({ id_reserva: c.id_reserva, codigo: c.codigo, socio: c.socio?.nombre_completo ?? '' });
        } catch (err) {
            // Una reserva que ya empezó no se cancela: queda registrada para revisión
            if (!(err instanceof ErrorHttp)) throw err;
        }
    }

    return { id_bloqueo: bloqueo.id_bloqueo, canceladas };
}

async function eliminarBloqueo(idBloqueo) {
    const { data, error } = await supabaseAdmin
        .from('bloqueos_instalaciones')
        .delete()
        .eq('id_bloqueo', idBloqueo)
        .select('id_bloqueo')
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ErrorHttp(404, 'Bloqueo no encontrado');
}

module.exports = { listarBloqueos, crearBloqueo, eliminarBloqueo };
