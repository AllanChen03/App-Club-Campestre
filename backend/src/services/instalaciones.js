const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ErrorHttp } = require('../utils/ErrorHttp');
const { esTexto } = require('../utils/validaciones');
const { aMinutos, esHora } = require('../utils/horario');

const TIPOS_RESERVA = ['Exclusiva', 'Por capacidad'];
const ESTADOS_INSTALACION = ['Activa', 'Inactiva'];
const ESTADOS_SERVICIO = ['Activo', 'Inactivo'];

const CAMPOS_INSTALACION = `
    id_instalacion,
    nombre,
    descripcion,
    capacidad,
    hora_apertura,
    hora_cierre,
    duracion_reserva,
    tipo_reserva,
    max_personas_reserva,
    estado,
    servicios_adicionales(id_servicio, nombre, descripcion, precio, estado)
`;

function errorBase(error) {
    if (error?.code === '23505') {
        return new ErrorHttp(409, 'Ya existe una instalación con ese nombre');
    }
    return new Error(error.message);
}

function ordenarServicios(instalacion) {
    return {
        ...instalacion,
        servicios_adicionales: [...(instalacion.servicios_adicionales ?? [])]
            .sort((a, b) => a.id_servicio - b.id_servicio)
    };
}

// Máximo de personas que admite una sola reserva en esta instalación
function maximoPersonas(instalacion) {
    return Math.min(instalacion.max_personas_reserva, instalacion.capacidad);
}

async function listarInstalaciones({ soloActivas = false } = {}) {
    let consulta = supabaseAdmin
        .from('instalaciones')
        .select(CAMPOS_INSTALACION)
        .order('id_instalacion', { ascending: true });

    if (soloActivas) consulta = consulta.eq('estado', 'Activa');

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    return data.map((i) => {
        const instalacion = ordenarServicios(i);
        if (soloActivas) {
            instalacion.servicios_adicionales =
                instalacion.servicios_adicionales.filter((s) => s.estado === 'Activo');
        }
        return { ...instalacion, max_personas: maximoPersonas(instalacion) };
    });
}

async function buscarInstalacion(idInstalacion) {
    const { data, error } = await supabaseAdmin
        .from('instalaciones')
        .select(CAMPOS_INSTALACION)
        .eq('id_instalacion', idInstalacion)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const instalacion = ordenarServicios(data);
    return { ...instalacion, max_personas: maximoPersonas(instalacion) };
}

// Valida los datos de una instalación. Con parcial=true solo revisa lo enviado,
// pero el horario se revisa completo usando los valores actuales.
function validarInstalacion(datos, actual = null) {
    const final = { ...(actual ?? {}), ...datos };

    if (datos.nombre !== undefined &&
        (!esTexto(datos.nombre) || datos.nombre.trim().length > 100)) {
        return 'El nombre no es válido';
    }

    if (datos.descripcion !== undefined && datos.descripcion !== null &&
        (typeof datos.descripcion !== 'string' || datos.descripcion.length > 255)) {
        return 'La descripción no es válida';
    }

    for (const campo of ['capacidad', 'max_personas_reserva']) {
        if (datos[campo] !== undefined &&
            (!Number.isInteger(datos[campo]) || datos[campo] < 1 || datos[campo] > 1000)) {
            return campo === 'capacidad'
                ? 'La capacidad debe ser un número entero mayor que 0'
                : 'El máximo de personas por reserva debe ser un número entero mayor que 0';
        }
    }

    if (datos.tipo_reserva !== undefined && !TIPOS_RESERVA.includes(datos.tipo_reserva)) {
        return 'El tipo de reserva no es válido';
    }

    if (datos.estado !== undefined && !ESTADOS_INSTALACION.includes(datos.estado)) {
        return 'El estado no es válido';
    }

    for (const campo of ['hora_apertura', 'hora_cierre']) {
        if (datos[campo] !== undefined &&
            (!esHora(datos[campo]) || aMinutos(datos[campo]) % 60 !== 0)) {
            return 'Las horas de apertura y cierre deben ser horas en punto';
        }
    }

    if (datos.duracion_reserva !== undefined &&
        (!Number.isInteger(datos.duracion_reserva) ||
         datos.duracion_reserva < 60 || datos.duracion_reserva % 60 !== 0)) {
        return 'La duración de cada turno debe ser de 60, 120, 180… minutos';
    }

    const apertura = aMinutos(final.hora_apertura);
    const cierre = aMinutos(final.hora_cierre);

    if (cierre <= apertura) {
        return 'La hora de cierre debe ser posterior a la de apertura';
    }

    if ((cierre - apertura) % final.duracion_reserva !== 0) {
        return 'El horario debe dividirse en turnos exactos: ajuste la apertura, el cierre o la duración';
    }

    return null;
}

function limpiarInstalacion(datos) {
    const permitidos = [
        'nombre', 'descripcion', 'capacidad', 'hora_apertura', 'hora_cierre',
        'duracion_reserva', 'tipo_reserva', 'max_personas_reserva', 'estado'
    ];
    const limpio = {};
    permitidos.forEach((c) => {
        if (datos[c] === undefined) return;
        limpio[c] = typeof datos[c] === 'string' ? datos[c].trim() : datos[c];
    });
    if (limpio.descripcion === '') limpio.descripcion = null;
    return limpio;
}

async function crearInstalacion(datos) {
    const obligatorios = ['nombre', 'capacidad', 'hora_apertura', 'hora_cierre',
        'duracion_reserva', 'tipo_reserva'];

    if (obligatorios.some((c) => datos[c] === undefined || datos[c] === '')) {
        throw new ErrorHttp(400, 'Complete todos los campos obligatorios');
    }

    const limpio = limpiarInstalacion({ max_personas_reserva: 12, estado: 'Activa', ...datos });
    const error = validarInstalacion(limpio);
    if (error) throw new ErrorHttp(400, error);

    const { data, error: errorBd } = await supabaseAdmin
        .from('instalaciones')
        .insert(limpio)
        .select('id_instalacion')
        .single();

    if (errorBd) throw errorBase(errorBd);

    return buscarInstalacion(data.id_instalacion);
}

async function actualizarInstalacion(idInstalacion, datos) {
    const actual = await buscarInstalacion(idInstalacion);
    if (!actual) throw new ErrorHttp(404, 'Instalación no encontrada');

    const limpio = limpiarInstalacion(datos);
    if (Object.keys(limpio).length === 0) {
        throw new ErrorHttp(400, 'Debe enviar al menos un dato para actualizar');
    }

    const error = validarInstalacion(limpio, actual);
    if (error) throw new ErrorHttp(400, error);

    const { error: errorBd } = await supabaseAdmin
        .from('instalaciones')
        .update(limpio)
        .eq('id_instalacion', idInstalacion);

    if (errorBd) throw errorBase(errorBd);

    return buscarInstalacion(idInstalacion);
}

// Elimina una instalación. Exige escribir su nombre exacto como confirmación.
// Si ya tiene reservas o visitas, no se borra (se perdería el historial y los
// cargos ligados): en ese caso se debe marcar como Inactiva.
async function eliminarInstalacion(idInstalacion, confirmacion) {
    const instalacion = await buscarInstalacion(idInstalacion);
    if (!instalacion) throw new ErrorHttp(404, 'Instalación no encontrada');

    if (typeof confirmacion !== 'string' || confirmacion.trim() !== instalacion.nombre) {
        throw new ErrorHttp(400, 'Escriba el nombre exacto de la instalación para confirmar');
    }

    const contar = async (tabla) => {
        const { count, error } = await supabaseAdmin
            .from(tabla)
            .select('*', { count: 'exact', head: true })
            .eq('id_instalacion', idInstalacion);
        if (error) throw new Error(error.message);
        return count;
    };

    const [reservas, visitas] = await Promise.all([contar('reservas'), contar('visitas_invitados')]);
    if (reservas || visitas) {
        const partes = [
            reservas && `${reservas} ${reservas === 1 ? 'reserva' : 'reservas'}`,
            visitas && `${visitas} ${visitas === 1 ? 'visita de invitado' : 'visitas de invitados'}`
        ].filter(Boolean).join(' y ');
        throw new ErrorHttp(409,
            `No se puede eliminar porque tiene ${partes} en su historial. Márquela como Inactiva para que ya no se pueda reservar`);
    }

    // Sin historial: se borran sus servicios y bloqueos, y después la instalación
    for (const tabla of ['servicios_adicionales', 'bloqueos_instalaciones']) {
        const { error } = await supabaseAdmin.from(tabla).delete().eq('id_instalacion', idInstalacion);
        if (error) throw new Error(error.message);
    }

    const { error } = await supabaseAdmin.from('instalaciones').delete().eq('id_instalacion', idInstalacion);
    if (error) throw new Error(error.message);

    return instalacion.nombre;
}

// ---------------------- Servicios adicionales ----------------------

function validarServicio(datos, parcial) {
    if ((!parcial || datos.nombre !== undefined) &&
        (!esTexto(datos.nombre) || datos.nombre.trim().length > 100)) {
        return 'El nombre del servicio no es válido';
    }
    if ((!parcial || datos.precio !== undefined) &&
        (typeof datos.precio !== 'number' || !Number.isFinite(datos.precio) || datos.precio < 0)) {
        return 'El precio debe ser un número mayor o igual a 0';
    }
    if (datos.descripcion !== undefined && datos.descripcion !== null &&
        (typeof datos.descripcion !== 'string' || datos.descripcion.length > 255)) {
        return 'La descripción no es válida';
    }
    if (datos.estado !== undefined && !ESTADOS_SERVICIO.includes(datos.estado)) {
        return 'El estado del servicio no es válido';
    }
    return null;
}

function limpiarServicio(datos) {
    const limpio = {};
    ['nombre', 'descripcion', 'precio', 'estado'].forEach((c) => {
        if (datos[c] === undefined) return;
        limpio[c] = typeof datos[c] === 'string' ? datos[c].trim() : datos[c];
    });
    if (limpio.descripcion === '') limpio.descripcion = null;
    return limpio;
}

async function crearServicio(idInstalacion, datos) {
    const instalacion = await buscarInstalacion(idInstalacion);
    if (!instalacion) throw new ErrorHttp(404, 'Instalación no encontrada');

    const error = validarServicio(datos, false);
    if (error) throw new ErrorHttp(400, error);

    const { data, error: errorBd } = await supabaseAdmin
        .from('servicios_adicionales')
        .insert({ ...limpiarServicio(datos), id_instalacion: idInstalacion })
        .select('id_servicio, nombre, descripcion, precio, estado')
        .single();

    if (errorBd) throw new Error(errorBd.message);
    return data;
}

async function actualizarServicio(idServicio, datos) {
    const error = validarServicio(datos, true);
    if (error) throw new ErrorHttp(400, error);

    const limpio = limpiarServicio(datos);
    if (Object.keys(limpio).length === 0) {
        throw new ErrorHttp(400, 'Debe enviar al menos un dato para actualizar');
    }

    const { data, error: errorBd } = await supabaseAdmin
        .from('servicios_adicionales')
        .update(limpio)
        .eq('id_servicio', idServicio)
        .select('id_servicio, nombre, descripcion, precio, estado')
        .maybeSingle();

    if (errorBd) throw new Error(errorBd.message);
    if (!data) throw new ErrorHttp(404, 'Servicio no encontrado');
    return data;
}

module.exports = {
    TIPOS_RESERVA,
    listarInstalaciones,
    buscarInstalacion,
    crearInstalacion,
    actualizarInstalacion,
    eliminarInstalacion,
    crearServicio,
    actualizarServicio,
    maximoPersonas
};
