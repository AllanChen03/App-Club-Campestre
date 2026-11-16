const PDFDocument = require('pdfkit');
const { supabaseAdmin } = require('../config/supabaseAdmin');
const h = require('../utils/horario');
const { listarInstalaciones } = require('./instalaciones');
const { bloqueosEntre, bloqueoEn, ESTADOS_ACTIVOS } = require('./disponibilidad');
const { actualizarVencidas } = require('./reservas');

async function reservasEntre(desde, hasta, estados) {
    const { data, error } = await supabaseAdmin
        .from('reservas')
        .select('id_reserva, id_instalacion, fecha_reserva, hora_inicio, hora_fin, cantidad_personas, estado')
        .gte('fecha_reserva', desde)
        .lte('fecha_reserva', hasta)
        .in('estado', estados);

    if (error) throw new Error(error.message);
    return data;
}

// ---------------------- Ocupación por franja horaria ----------------------

function estadoEn(instalacion, fecha, inicio, fin, reservas, bloqueos) {
    const apertura = h.aMinutos(instalacion.hora_apertura);
    const cierre = h.aMinutos(instalacion.hora_cierre);

    if (inicio < apertura || fin > cierre) return { estado: 'Cerrado' };

    const bloqueo = bloqueoEn(bloqueos, fecha, inicio, fin);
    if (bloqueo) return { estado: 'Bloqueado', motivo: bloqueo.motivo };

    const encima = reservas.filter((r) =>
        r.id_instalacion === instalacion.id_instalacion &&
        h.aMinutos(r.hora_inicio) < fin && h.aMinutos(r.hora_fin) > inicio);

    if (instalacion.tipo_reserva === 'Exclusiva') {
        if (!encima.length) return { estado: 'Libre' };
        return { estado: encima.some((r) => r.estado === 'Confirmada') ? 'Reservada' : 'Pendiente' };
    }

    const personas = encima.reduce((s, r) => s + r.cantidad_personas, 0);
    return {
        estado: personas >= instalacion.capacidad ? 'Lleno' : personas > 0 ? 'Con reservas' : 'Libre',
        personas,
        capacidad: instalacion.capacidad
    };
}

async function ocupacion(fecha) {
    await actualizarVencidas();

    const [instalaciones, reservas, bloqueos] = await Promise.all([
        listarInstalaciones({ soloActivas: true }),
        reservasEntre(fecha, fecha, ESTADOS_ACTIVOS),
        bloqueosEntre(null, fecha)
    ]);

    const apertura = Math.min(...instalaciones.map((i) => h.aMinutos(i.hora_apertura)));
    const cierre = Math.max(...instalaciones.map((i) => h.aMinutos(i.hora_cierre)));

    const franjas = [];
    for (let m = apertura; m < cierre; m += 60) {
        franjas.push({
            hora: h.aHora(m),
            instalaciones: instalaciones.map((i) => ({
                id_instalacion: i.id_instalacion,
                ...estadoEn(i, fecha, m, m + 60, reservas, bloqueos.filter((b) => b.id_instalacion === i.id_instalacion))
            }))
        });
    }

    // Estado en este momento (solo si se consulta el día de hoy)
    const actual = h.ahora();
    const esHoy = fecha === actual.fecha;
    const ahora = instalaciones.map((i) => {
        const propios = bloqueos.filter((b) => b.id_instalacion === i.id_instalacion);
        const e = esHoy
            ? estadoEn(i, fecha, actual.minutos, actual.minutos + 1, reservas, propios)
            : null;

        let texto = null;
        if (e) {
            if (e.estado === 'Reservada') texto = 'En uso';
            else if (e.estado === 'Pendiente') texto = 'Libre';
            else if (e.capacidad) texto = `${e.personas} de ${e.capacidad}`;
            else texto = e.estado;
        }

        const bloqueoActual = esHoy ? propios.find((b) =>
            b.fecha_inicio.slice(0, 16) <= `${fecha}T${h.aHora(actual.minutos).slice(0, 5)}` &&
            b.fecha_fin.slice(0, 16) > `${fecha}T${h.aHora(actual.minutos).slice(0, 5)}`) : null;

        return {
            id_instalacion: i.id_instalacion,
            nombre: i.nombre,
            tipo_reserva: i.tipo_reserva,
            estado: e?.estado ?? null,
            texto,
            bloqueo: bloqueoActual
                ? { motivo: bloqueoActual.motivo, hasta: String(bloqueoActual.fecha_fin).replace(' ', 'T').slice(0, 16) }
                : null
        };
    });

    return {
        fecha,
        hora_actual: esHoy ? h.aHora(actual.minutos) : null,
        instalaciones: instalaciones.map((i) => ({
            id_instalacion: i.id_instalacion,
            nombre: i.nombre,
            tipo_reserva: i.tipo_reserva,
            capacidad: i.capacidad
        })),
        ahora,
        franjas
    };
}

// ---------------------- Reportes de uso ----------------------

async function reporteUso(desde, hasta) {
    await actualizarVencidas();

    const [instalaciones, reservas] = await Promise.all([
        listarInstalaciones(),
        reservasEntre(desde, hasta, ['Pendiente', 'Confirmada', 'Finalizada', 'Cancelada'])
    ]);

    const dias = h.diasEntre(desde, hasta);

    const filas = instalaciones.map((i) => {
        const propias = reservas.filter((r) => r.id_instalacion === i.id_instalacion);
        const vigentes = propias.filter((r) => r.estado !== 'Cancelada');
        const horasDe = (r) => (h.aMinutos(r.hora_fin) - h.aMinutos(r.hora_inicio)) / 60;

        const horas = vigentes.reduce((s, r) => s + horasDe(r), 0);
        const horasAbiertas = dias * (h.aMinutos(i.hora_cierre) - h.aMinutos(i.hora_apertura)) / 60;

        // Exclusiva: horas usadas sobre horas abiertas.
        // Por capacidad: personas-hora usadas sobre personas-hora posibles.
        const usado = i.tipo_reserva === 'Exclusiva'
            ? horas
            : vigentes.reduce((s, r) => s + horasDe(r) * r.cantidad_personas, 0);
        const posible = i.tipo_reserva === 'Exclusiva' ? horasAbiertas : horasAbiertas * i.capacidad;

        return {
            id_instalacion: i.id_instalacion,
            nombre: i.nombre,
            reservas: vigentes.length,
            horas,
            personas: vigentes.reduce((s, r) => s + r.cantidad_personas, 0),
            ocupacion: posible > 0 ? Math.round((usado / posible) * 1000) / 10 : 0,
            cancelaciones: propias.length - vigentes.length
        };
    });

    const conUso = [...filas].sort((a, b) => b.ocupacion - a.ocupacion || b.reservas - a.reservas);
    const mayor = conUso[0]?.reservas ? conUso[0] : null;
    const menor = conUso.length > 1 ? conUso[conUso.length - 1] : null;

    filas.forEach((f) => {
        f.demanda = mayor && f.id_instalacion === mayor.id_instalacion ? 'Mayor'
            : menor && f.id_instalacion === menor.id_instalacion && menor !== mayor ? 'Menor' : null;
    });

    return {
        desde,
        hasta,
        totales: {
            reservas: filas.reduce((s, f) => s + f.reservas, 0),
            horas: filas.reduce((s, f) => s + f.horas, 0),
            ocupacion: filas.length
                ? Math.round((filas.reduce((s, f) => s + f.ocupacion, 0) / filas.length) * 10) / 10
                : 0,
            cancelaciones: filas.reduce((s, f) => s + f.cancelaciones, 0)
        },
        mayor_demanda: mayor?.nombre ?? null,
        menor_demanda: menor && menor !== mayor ? menor.nombre : null,
        instalaciones: filas.sort((a, b) => b.ocupacion - a.ocupacion || b.reservas - a.reservas)
    };
}

const fechaCorta = (f) => f.split('-').reverse().join('/');

// Escribe el reporte en PDF sobre la respuesta HTTP
function reporteUsoPdf(reporte, salida) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 56 });
    doc.pipe(salida);

    const verde = '#1f4d3d';
    const gris = '#6b6f6a';

    doc.fillColor(verde).fontSize(10).text('CLUB VALLE ALTO', { characterSpacing: 2 });
    doc.moveDown(0.3);
    doc.fillColor('#1c2420').fontSize(22).text('Reporte de uso de instalaciones');
    doc.fillColor(gris).fontSize(11)
        .text(`Periodo: ${fechaCorta(reporte.desde)} al ${fechaCorta(reporte.hasta)}`);
    doc.moveDown(1.2);

    const t = reporte.totales;
    const resumen = [
        ['Reservas', String(t.reservas)],
        ['Horas reservadas', `${t.horas} h`],
        ['Ocupación promedio', `${t.ocupacion} %`],
        ['Cancelaciones', String(t.cancelaciones)]
    ];

    const anchoCaja = (doc.page.width - 112 - 30) / 4;
    const yCajas = doc.y;
    resumen.forEach(([etiqueta, valor], i) => {
        const x = 56 + i * (anchoCaja + 10);
        doc.roundedRect(x, yCajas, anchoCaja, 58, 6).strokeColor('#e6dfd2').stroke();
        doc.fillColor(gris).fontSize(9).text(etiqueta, x + 10, yCajas + 10, { width: anchoCaja - 20 });
        doc.fillColor(verde).fontSize(18).text(valor, x + 10, yCajas + 26, { width: anchoCaja - 20 });
    });

    doc.y = yCajas + 84;
    doc.x = 56;

    const columnas = [
        { titulo: 'Instalación', ancho: 170 },
        { titulo: 'Reservas', ancho: 70 },
        { titulo: 'Horas', ancho: 60 },
        { titulo: 'Ocupación', ancho: 75 },
        { titulo: 'Cancel.', ancho: 55 },
        { titulo: 'Demanda', ancho: 70 }
    ];

    const fila = (valores, opciones = {}) => {
        const y = doc.y;
        let x = 56;
        valores.forEach((v, i) => {
            doc.fillColor(opciones.color ?? '#1c2420').fontSize(opciones.tamano ?? 11)
                .text(v, x, y, { width: columnas[i].ancho - 8 });
            x += columnas[i].ancho;
        });
        doc.y = y + (opciones.alto ?? 22);
    };

    fila(columnas.map((c) => c.titulo), { color: gris, tamano: 9, alto: 18 });
    doc.moveTo(56, doc.y - 4).lineTo(56 + 500, doc.y - 4).strokeColor('#e6dfd2').stroke();
    doc.y += 6;

    reporte.instalaciones.forEach((f) => {
        fila([
            f.nombre,
            String(f.reservas),
            `${f.horas} h`,
            `${f.ocupacion} %`,
            String(f.cancelaciones),
            f.demanda ? `${f.demanda} demanda` : ''
        ]);
    });

    doc.moveDown(1);
    doc.x = 56;
    doc.fillColor(gris).fontSize(10).text(
        [
            reporte.mayor_demanda && `Mayor demanda: ${reporte.mayor_demanda}`,
            reporte.menor_demanda && `Menor demanda: ${reporte.menor_demanda}`
        ].filter(Boolean).join(' · ') || 'Sin reservas en el periodo'
    );
    doc.moveDown(0.6);
    doc.fontSize(8).text(
        'La ocupación de instalaciones exclusivas se calcula con horas reservadas sobre horas abiertas; ' +
        'la de instalaciones por capacidad, con personas-hora reservadas sobre personas-hora posibles. ' +
        'No incluye reservas canceladas.'
    );

    doc.end();
}

module.exports = { ocupacion, reporteUso, reporteUsoPdf };
