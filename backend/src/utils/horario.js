// Utilidades de fecha y hora para reservas.
// Todo se maneja en hora local de Costa Rica, sin zona horaria,
// igual que se guarda en la base (reservas y bloqueos).

const ZONA = 'America/Costa_Rica';

const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
});

// { fecha: 'YYYY-MM-DD', minutos: minutos desde medianoche } en Costa Rica
function ahora() {
    const partes = Object.fromEntries(
        formato.formatToParts(new Date()).map((p) => [p.type, p.value])
    );

    return {
        fecha: `${partes.year}-${partes.month}-${partes.day}`,
        minutos: Number(partes.hour) * 60 + Number(partes.minute)
    };
}

// '08:30' o '08:30:00' -> 510
function aMinutos(hora) {
    const [h, m] = String(hora).split(':').map(Number);
    return h * 60 + (m || 0);
}

// 510 -> '08:30:00'
function aHora(minutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    return `${h}:${m}:00`;
}

function esFecha(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const d = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

function esHora(valor) {
    return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(valor);
}

// Suma días a 'YYYY-MM-DD'
function sumarDias(fecha, dias) {
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

// Días entre dos fechas, incluyendo ambas
function diasEntre(desde, hasta) {
    const ms = new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`);
    return Math.round(ms / 86400000) + 1;
}

// Turnos de una instalación: [{ inicio: 480, fin: 600 }, ...]
function turnos(instalacion) {
    const lista = [];
    const apertura = aMinutos(instalacion.hora_apertura);
    const cierre = aMinutos(instalacion.hora_cierre);
    const duracion = instalacion.duracion_reserva;

    for (let inicio = apertura; inicio + duracion <= cierre; inicio += duracion) {
        lista.push({ inicio, fin: inicio + duracion });
    }

    return lista;
}

// ¿La reserva (fecha + hora) ya empezó?
function yaInicio(fecha, horaInicio) {
    const actual = ahora();
    if (fecha < actual.fecha) return true;
    if (fecha > actual.fecha) return false;
    return aMinutos(horaInicio) <= actual.minutos;
}

// ¿La reserva ya terminó?
function yaTermino(fecha, horaFin) {
    const actual = ahora();
    if (fecha < actual.fecha) return true;
    if (fecha > actual.fecha) return false;
    return aMinutos(horaFin) <= actual.minutos;
}

// Fecha + hora -> 'YYYY-MM-DDTHH:MM:SS' (formato de los bloqueos)
function marca(fecha, hora) {
    return `${fecha}T${aHora(aMinutos(hora))}`;
}

module.exports = {
    ahora,
    aMinutos,
    aHora,
    esFecha,
    esHora,
    sumarDias,
    diasEntre,
    turnos,
    yaInicio,
    yaTermino,
    marca
};
