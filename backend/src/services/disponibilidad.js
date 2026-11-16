const { supabaseAdmin } = require('../config/supabaseAdmin');
const { aHora, aMinutos, marca, sumarDias, turnos, yaInicio } = require('../utils/horario');

const ESTADOS_ACTIVOS = ['Pendiente', 'Confirmada'];

// Reservas que ocupan espacio en una instalación y un día
async function reservasDelDia(idInstalacion, fecha, excluirId = null) {
    let consulta = supabaseAdmin
        .from('reservas')
        .select('id_reserva, hora_inicio, hora_fin, cantidad_personas, estado')
        .eq('id_instalacion', idInstalacion)
        .eq('fecha_reserva', fecha)
        .in('estado', ESTADOS_ACTIVOS);

    if (excluirId) consulta = consulta.neq('id_reserva', excluirId);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data;
}

// Bloqueos que tocan un día (o un rango de días) de una instalación
async function bloqueosEntre(idInstalacion, desde, hasta = desde) {
    let consulta = supabaseAdmin
        .from('bloqueos_instalaciones')
        .select('id_bloqueo, id_instalacion, fecha_inicio, fecha_fin, motivo')
        .lt('fecha_inicio', `${sumarDias(hasta, 1)}T00:00:00`)
        .gt('fecha_fin', `${desde}T00:00:00`)
        .order('fecha_inicio', { ascending: true });

    if (idInstalacion) consulta = consulta.eq('id_instalacion', idInstalacion);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data;
}

// Normaliza '2026-11-20T08:00:00' o '2026-11-20 08:00:00'
const normalizar = (v) => String(v).replace(' ', 'T').slice(0, 19);

function bloqueoEn(bloqueos, fecha, inicio, fin) {
    const desde = marca(fecha, aHora(inicio));
    const hasta = marca(fecha, aHora(fin));
    return bloqueos.find((b) => normalizar(b.fecha_inicio) < hasta && normalizar(b.fecha_fin) > desde) ?? null;
}

// Estado de cada turno de una instalación en un día
function calcularTurnos(instalacion, fecha, reservas, bloqueos) {
    return turnos(instalacion).map((t) => {
        const encima = reservas.filter((r) =>
            aMinutos(r.hora_inicio) < t.fin && aMinutos(r.hora_fin) > t.inicio);
        const personas = encima.reduce((s, r) => s + r.cantidad_personas, 0);
        const bloqueo = bloqueoEn(bloqueos, fecha, t.inicio, t.fin);
        const exclusiva = instalacion.tipo_reserva === 'Exclusiva';
        const cupo = exclusiva ? (encima.length ? 0 : instalacion.capacidad) : instalacion.capacidad - personas;

        let estado = 'Libre';
        if (yaInicio(fecha, aHora(t.inicio))) estado = 'Pasado';
        else if (bloqueo) estado = 'Bloqueado';
        else if (cupo <= 0) estado = 'Ocupado';

        return {
            hora_inicio: aHora(t.inicio),
            hora_fin: aHora(t.fin),
            estado,
            personas,
            cupo: Math.max(cupo, 0),
            motivo_bloqueo: bloqueo?.motivo ?? null
        };
    });
}

async function disponibilidad(instalacion, fecha, excluirId = null) {
    const [reservas, bloqueos] = await Promise.all([
        reservasDelDia(instalacion.id_instalacion, fecha, excluirId),
        bloqueosEntre(instalacion.id_instalacion, fecha)
    ]);
    return calcularTurnos(instalacion, fecha, reservas, bloqueos);
}

module.exports = {
    ESTADOS_ACTIVOS,
    reservasDelDia,
    bloqueosEntre,
    bloqueoEn,
    calcularTurnos,
    disponibilidad,
    normalizar
};
