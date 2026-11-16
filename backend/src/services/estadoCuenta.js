// Arma el estado de cuenta de un socio con datos reales:
// periodo actual, estado de cada cargo (pagado, parcial, pendiente o vencido),
// saldos según los pagos aplicados y el historial de periodos anteriores.

const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ErrorHttp } = require('../utils/ErrorHttp');
const { ahora } = require('../utils/horario');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// '2026-11' -> 'noviembre 2026'
const nombrePeriodo = (p) => `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Acepta el id del socio o el id de usuario
async function buscarSocio(id) {
    const columna = REGEX_UUID.test(String(id)) ? 'id_usuario' : 'id_socio';
    if (columna === 'id_socio' && !/^\d+$/.test(String(id))) {
        throw new ErrorHttp(400, 'El identificador del socio no es válido');
    }

    const { data, error } = await supabaseAdmin
        .from('socios')
        .select(`
            id_socio,
            numero_socio,
            usuarios(nombre_completo, cedula),
            membresias(estado, fecha_inicio, tipos_membresia(nombre))
        `)
        .eq(columna, id)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ErrorHttp(404, 'Socio no encontrado');

    const membresias = [...(data.membresias ?? [])]
        .sort((a, b) => String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)));
    const membresia = membresias.find((m) => m.estado === 'Activa') ?? membresias[0] ?? null;

    return {
        id_socio: data.id_socio,
        numero_socio: data.numero_socio,
        nombre_completo: data.usuarios?.nombre_completo ?? '',
        cedula: data.usuarios?.cedula ?? '',
        membresia: membresia ? `${membresia.tipos_membresia?.nombre ?? ''} (${membresia.estado})` : 'Sin membresía'
    };
}

// Estado que ve el socio: los pagos aplicados mandan sobre el estado guardado
function estadoActual(cargo, pagado, hoy) {
    const monto = Number(cargo.monto);
    if (cargo.estado === 'Pagado' || pagado >= monto) return 'Pagado';
    if (String(cargo.fecha_vencimiento) < hoy) return 'Vencido';
    if (pagado > 0 || cargo.estado === 'Parcial') return 'Parcial';
    return 'Pendiente';
}

function totales(cargos) {
    const suma = (lista, campo) => lista.reduce((t, c) => t + c[campo], 0);
    return {
        facturado: suma(cargos, 'monto'),
        pagado: suma(cargos, 'pagado'),
        pendiente: suma(cargos.filter((c) => c.estado_actual !== 'Vencido'), 'saldo'),
        vencido: suma(cargos.filter((c) => c.estado_actual === 'Vencido'), 'saldo'),
        saldo: suma(cargos, 'saldo')
    };
}

async function construirEstadoCuenta(idSocioOUsuario) {
    const socio = await buscarSocio(idSocioOUsuario);
    const hoy = ahora().fecha;
    const periodoActual = hoy.slice(0, 7);

    const [{ data: cargosBd, error: e1 }, { data: pagos, error: e2 }] = await Promise.all([
        supabaseAdmin
            .from('cargos')
            .select('*, detalle_pagos(monto_aplicado)')
            .eq('id_socio', socio.id_socio)
            .order('fecha_emision', { ascending: false }),
        supabaseAdmin
            .from('pagos')
            .select('id_pago, monto_total, fecha_pago')
            .eq('id_socio', socio.id_socio)
            .order('fecha_pago', { ascending: false })
    ]);

    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    // Los cargos anulados no se cobran ni se muestran
    const cargos = cargosBd
        .filter((c) => c.estado !== 'Anulado')
        .map(({ detalle_pagos: detalle, ...c }) => {
            const monto = Number(c.monto);
            const aplicado = (detalle ?? []).reduce((t, d) => t + Number(d.monto_aplicado), 0);
            const pagado = c.estado === 'Pagado' ? monto : Math.min(aplicado, monto);
            return {
                ...c,
                monto,
                pagado,
                saldo: monto - pagado,
                estado_actual: estadoActual(c, pagado, hoy),
                periodo: String(c.fecha_emision).slice(0, 7)
            };
        });

    // Periodo actual: lo emitido este mes y todo lo que siga sin pagar
    const actuales = cargos.filter((c) => c.periodo === periodoActual || c.saldo > 0);

    // Periodos anteriores: lo emitido en meses pasados, agrupado por mes
    const porMes = new Map();
    cargos.filter((c) => c.periodo < periodoActual).forEach((c) => {
        if (!porMes.has(c.periodo)) porMes.set(c.periodo, []);
        porMes.get(c.periodo).push(c);
    });

    const periodos = [...porMes.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([periodo, lista]) => {
            const t = totales(lista);
            return {
                periodo,
                nombre: nombrePeriodo(periodo),
                ...t,
                estado: t.saldo === 0 ? 'Pagado' : t.vencido > 0 ? 'Vencido' : 'Pendiente',
                cargos: lista
            };
        });

    const conSaldo = actuales.filter((c) => c.saldo > 0).map((c) => String(c.fecha_vencimiento));
    const resumen = totales(actuales);

    return {
        socio,
        periodo: periodoActual,
        nombre_periodo: nombrePeriodo(periodoActual),
        proxima_fecha_limite: conSaldo.length ? conSaldo.sort()[0] : null,
        resumen,
        cargos: actuales,
        periodos,
        pagos: pagos ?? [],
        // Compatibilidad con pantallas anteriores
        saldoTotal: totales(cargos).saldo
    };
}

// Cargos de un periodo concreto (para el PDF de un mes anterior)
async function estadoDePeriodo(idSocioOUsuario, periodo) {
    const completo = await construirEstadoCuenta(idSocioOUsuario);
    if (!periodo || periodo === completo.periodo) return completo;

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) throw new ErrorHttp(400, 'El periodo no es válido');

    const { data: todos, error } = await supabaseAdmin
        .from('cargos')
        .select('*, detalle_pagos(monto_aplicado)')
        .eq('id_socio', completo.socio.id_socio)
        .gte('fecha_emision', `${periodo}-01`)
        .neq('estado', 'Anulado');

    if (error) throw new Error(error.message);

    const hoy = ahora().fecha;
    const cargos = todos
        .filter((c) => String(c.fecha_emision).slice(0, 7) === periodo)
        .map(({ detalle_pagos: detalle, ...c }) => {
            const monto = Number(c.monto);
            const aplicado = (detalle ?? []).reduce((t, d) => t + Number(d.monto_aplicado), 0);
            const pagado = c.estado === 'Pagado' ? monto : Math.min(aplicado, monto);
            return { ...c, monto, pagado, saldo: monto - pagado, estado_actual: estadoActual(c, pagado, hoy), periodo };
        });

    return {
        ...completo,
        periodo,
        nombre_periodo: nombrePeriodo(periodo),
        resumen: totales(cargos),
        cargos
    };
}

// Cargos con saldo por pagar (pendientes, parciales o vencidos; los anulados no cuentan)
async function cobrosPendientes(idSocioOUsuario) {
    const { cargos } = await construirEstadoCuenta(idSocioOUsuario);
    const conSaldo = cargos.filter((c) => c.saldo > 0);
    return {
        cantidad: conSaldo.length,
        saldo: conSaldo.reduce((t, c) => t + c.saldo, 0)
    };
}

const colones = (n) => `₡${Math.round(Number(n)).toLocaleString('es-CR')}`;

module.exports = { construirEstadoCuenta, estadoDePeriodo, nombrePeriodo, cobrosPendientes, colones };
