const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ErrorHttp } = require('../utils/ErrorHttp');
const { ahora: ahoraCR, sumarDias } = require('../utils/horario');

const ESTADOS_MEMBRESIA = ['Pendiente', 'Activa', 'Vencida', 'Suspendida', 'Cancelada'];

// -------------------- TIPOS DE MEMBRESÍA --------------------

async function listarTiposMembresia() {
    const { data, error } = await supabaseAdmin
        .from('tipos_membresia')
        .select('id_tipo_membresia, nombre, descripcion, precio, max_beneficiarios, max_invitados, fecha_creacion')
        .order('precio', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
}

async function crearTipoMembresia(datos) {
    const { data, error } = await supabaseAdmin
        .from('tipos_membresia')
        .insert({
            nombre: datos.nombre,
            descripcion: datos.descripcion || null,
            precio: Number(datos.precio),
            max_beneficiarios: Number(datos.max_beneficiarios ?? 0),
            max_invitados: Number(datos.max_invitados ?? 0)
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new ErrorHttp(409, 'Ya existe un tipo de membresía con ese nombre');
        }
        throw new Error(error.message);
    }
    return data;
}

async function actualizarTipoMembresia(idTipo, cambios) {
    const { data, error } = await supabaseAdmin
        .from('tipos_membresia')
        .update(cambios)
        .eq('id_tipo_membresia', idTipo)
        .select()
        .maybeSingle();

    if (error) {
        if (error.code === '23505') {
            throw new ErrorHttp(409, 'Ya existe un tipo de membresía con ese nombre');
        }
        throw new Error(error.message);
    }
    if (!data) throw new ErrorHttp(404, 'Tipo de membresía no encontrado');
    return data;
}

// -------------------- MEMBRESÍAS E HISTORIAL --------------------

async function listarSociosConMembresias() {
    const { data, error } = await supabaseAdmin
        .from('socios')
        .select(`
            id_socio,
            numero_socio,
            fecha_afiliacion,
            usuarios (
                id_usuario,
                nombre_completo,
                cedula,
                telefono,
                estado
            ),
            membresias (
                id_membresia,
                id_tipo_membresia,
                fecha_inicio,
                fecha_vencimiento,
                estado,
                fecha_creacion,
                tipos_membresia (
                    id_tipo_membresia,
                    nombre,
                    precio,
                    max_beneficiarios,
                    max_invitados
                ),
                beneficiarios (
                    id_beneficiario
                )
            )
        `)
        .order('id_socio', { ascending: true });

    if (error) throw new Error(error.message);

    return data.map((socio) => {
        const lista = [...(socio.membresias ?? [])].sort(
            (a, b) => b.id_membresia - a.id_membresia
        );
        const actual = lista.find((m) => m.estado === 'Activa') ?? lista[0] ?? null;

        return {
            id_socio: socio.id_socio,
            numero_socio: socio.numero_socio,
            fecha_afiliacion: socio.fecha_afiliacion,
            usuario: socio.usuarios,
            membresia_actual: actual
                ? {
                      ...actual,
                      cantidad_beneficiarios: actual.beneficiarios?.length ?? 0
                  }
                : null,
            total_membresias: lista.length
        };
    });
}

async function obtenerDetalleMembresia(idMembresia) {
    const { data, error } = await supabaseAdmin
        .from('membresias')
        .select(`
            id_membresia,
            id_socio,
            id_tipo_membresia,
            fecha_inicio,
            fecha_vencimiento,
            estado,
            fecha_creacion,
            tipos_membresia (
                id_tipo_membresia,
                nombre,
                descripcion,
                precio,
                max_beneficiarios,
                max_invitados
            ),
            socios (
                id_socio,
                numero_socio,
                fecha_afiliacion,
                usuarios (
                    id_usuario,
                    nombre_completo,
                    cedula,
                    telefono,
                    estado
                )
            ),
            beneficiarios (
                id_beneficiario,
                nombre_completo,
                cedula,
                telefono,
                fecha_nacimiento,
                parentesco,
                fecha_creacion
            )
        `)
        .eq('id_membresia', idMembresia)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ErrorHttp(404, 'Membresía no encontrada');

    const historial = await listarHistorialMembresia(idMembresia);
    return { ...data, historial };
}

async function registrarHistorial({ id_membresia, estado_anterior, estado_nuevo, id_usuario, motivo }) {
    const { error } = await supabaseAdmin
        .from('historial_membresias')
        .insert({
            id_membresia,
            estado_anterior: estado_anterior ?? null,
            estado_nuevo,
            id_usuario: id_usuario ?? null,
            motivo: motivo || null
        });

    if (error) {
        console.error('Error al registrar historial de membresía:', error.message);
    }
}

async function listarHistorialMembresia(idMembresia) {
    const { data, error } = await supabaseAdmin
        .from('historial_membresias')
        .select(`
            id_historial,
            estado_anterior,
            estado_nuevo,
            motivo,
            fecha,
            usuarios (
                nombre_completo
            )
        `)
        .eq('id_membresia', idMembresia)
        .order('fecha', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
}

async function asignarMembresia({
    id_socio,
    id_tipo_membresia,
    fecha_inicio,
    fecha_vencimiento,
    estado = 'Pendiente',
    motivo,
    generar_cargo = false,
    id_usuario_admin
}) {
    const inicio = fecha_inicio || ahoraCR().fecha;

    if (!fecha_vencimiento || fecha_vencimiento <= inicio) {
        throw new ErrorHttp(400, 'La fecha de renovación debe ser posterior a la fecha de inscripción');
    }

    const { data: tipo, error: tipoError } = await supabaseAdmin
        .from('tipos_membresia')
        .select('id_tipo_membresia, nombre, precio')
        .eq('id_tipo_membresia', id_tipo_membresia)
        .maybeSingle();

    if (tipoError) throw new Error(tipoError.message);
    if (!tipo) throw new ErrorHttp(404, 'El tipo de membresía seleccionado no existe');

    // Si la nueva asignación queda Activa, se cierra la membresía anterior del socio
    if (estado === 'Activa') {
        const { data: previas } = await supabaseAdmin
            .from('membresias')
            .select('id_membresia, estado')
            .eq('id_socio', Number(id_socio))
            .in('estado', ['Activa', 'Pendiente']);

        for (const prev of previas ?? []) {
            await supabaseAdmin
                .from('membresias')
                .update({ estado: 'Cancelada' })
                .eq('id_membresia', prev.id_membresia);

            await registrarHistorial({
                id_membresia: prev.id_membresia,
                estado_anterior: prev.estado,
                estado_nuevo: 'Cancelada',
                id_usuario: id_usuario_admin,
                motivo: 'Reemplazada por una nueva asignación de membresía'
            });
        }
    }

    const { data: nueva, error } = await supabaseAdmin
        .from('membresias')
        .insert({
            id_socio: Number(id_socio),
            id_tipo_membresia: Number(id_tipo_membresia),
            fecha_inicio: inicio,
            fecha_vencimiento,
            estado
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23514' || /membresias_fechas_check/i.test(error.message)) {
            throw new ErrorHttp(400, 'La fecha de renovación debe ser posterior a la fecha de inscripción');
        }
        throw new Error(error.message);
    }

    await registrarHistorial({
        id_membresia: nueva.id_membresia,
        estado_anterior: null,
        estado_nuevo: estado,
        id_usuario: id_usuario_admin,
        motivo: motivo || `Asignación de membresía ${tipo.nombre}`
    });

    if (generar_cargo && Number(tipo.precio) > 0) {

        await supabaseAdmin.from('cargos').insert({
            id_socio: Number(id_socio),
            concepto: `Cuota de membresía - ${tipo.nombre}`,
            descripcion: `Membresía #${nueva.id_membresia}`,
            monto: Number(tipo.precio),
            fecha_vencimiento: sumarDias(ahoraCR().fecha, 15),
            estado: 'Pendiente'
        });
    }

    return nueva;
}

async function modificarMembresia(idMembresia, cambios, idUsuarioAdmin) {
    const { data: actual, error: buscaError } = await supabaseAdmin
        .from('membresias')
        .select('id_membresia, estado, id_tipo_membresia, tipos_membresia(nombre)')
        .eq('id_membresia', idMembresia)
        .maybeSingle();

    if (buscaError) throw new Error(buscaError.message);
    if (!actual) throw new ErrorHttp(404, 'Membresía no encontrada');

    const actualizar = {};
    if (cambios.id_tipo_membresia !== undefined) actualizar.id_tipo_membresia = Number(cambios.id_tipo_membresia);
    if (cambios.fecha_inicio !== undefined) actualizar.fecha_inicio = cambios.fecha_inicio || null;
    if (cambios.fecha_vencimiento !== undefined) actualizar.fecha_vencimiento = cambios.fecha_vencimiento || null;
    if (cambios.estado !== undefined) actualizar.estado = cambios.estado;

    const { data: actualizada, error } = await supabaseAdmin
        .from('membresias')
        .update(actualizar)
        .eq('id_membresia', idMembresia)
        .select()
        .single();

    if (error) throw new Error(error.message);

    const estadoCambio = cambios.estado && cambios.estado !== actual.estado;
    const tipoCambio = cambios.id_tipo_membresia && Number(cambios.id_tipo_membresia) !== actual.id_tipo_membresia;

    if (estadoCambio || tipoCambio || cambios.motivo) {
        await registrarHistorial({
            id_membresia: Number(idMembresia),
            estado_anterior: actual.estado,
            estado_nuevo: actualizada.estado,
            id_usuario: idUsuarioAdmin,
            motivo: cambios.motivo || (tipoCambio ? 'Cambio de plan o renovación de membresía' : 'Actualización de estado')
        });
    }

    return actualizada;
}

// -------------------- BENEFICIARIOS --------------------

async function agregarBeneficiario(idMembresia, datos) {
    const { data: membresia, error: memError } = await supabaseAdmin
        .from('membresias')
        .select(`
            id_membresia,
            estado,
            tipos_membresia (
                nombre,
                max_beneficiarios
            ),
            beneficiarios (
                id_beneficiario
            )
        `)
        .eq('id_membresia', idMembresia)
        .maybeSingle();

    if (memError) throw new Error(memError.message);
    if (!membresia) throw new ErrorHttp(404, 'Membresía no encontrada');

    const maxPermitidos = membresia.tipos_membresia?.max_beneficiarios ?? 0;
    const actuales = membresia.beneficiarios?.length ?? 0;

    if (maxPermitidos <= 0) {
        throw new ErrorHttp(400, `La membresía ${membresia.tipos_membresia?.nombre} no permite registrar beneficiarios`);
    }

    if (actuales >= maxPermitidos) {
        throw new ErrorHttp(409, `Se alcanzó el límite máximo de ${maxPermitidos} beneficiarios para esta membresía`);
    }

    const { data, error } = await supabaseAdmin
        .from('beneficiarios')
        .insert({
            id_membresia: Number(idMembresia),
            nombre_completo: datos.nombre_completo.trim(),
            cedula: datos.cedula.trim(),
            telefono: datos.telefono ? datos.telefono.trim() : null,
            fecha_nacimiento: datos.fecha_nacimiento,
            parentesco: datos.parentesco.trim()
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new ErrorHttp(409, 'Ya existe un beneficiario registrado con esa cédula');
        }
        throw new Error(error.message);
    }

    return data;
}

async function eliminarBeneficiario(idMembresia, idBeneficiario) {
    const { data, error } = await supabaseAdmin
        .from('beneficiarios')
        .delete()
        .eq('id_membresia', idMembresia)
        .eq('id_beneficiario', idBeneficiario)
        .select()
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ErrorHttp(404, 'Beneficiario no encontrado en esta membresía');
    return data;
}

// -------------------- CONSULTA DEL PROPIO SOCIO --------------------

async function consultarMembresiaPorUsuario(idUsuario) {
    const { data: socio, error } = await supabaseAdmin
        .from('socios')
        .select(`
            id_socio,
            numero_socio,
            fecha_afiliacion,
            usuarios (
                nombre_completo,
                cedula,
                estado
            ),
            membresias (
                id_membresia,
                fecha_inicio,
                fecha_vencimiento,
                estado,
                fecha_creacion,
                tipos_membresia (
                    id_tipo_membresia,
                    nombre,
                    descripcion,
                    precio,
                    max_beneficiarios,
                    max_invitados
                ),
                beneficiarios (
                    id_beneficiario,
                    nombre_completo,
                    cedula,
                    telefono,
                    fecha_nacimiento,
                    parentesco
                )
            )
        `)
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!socio) throw new ErrorHttp(404, 'No se encontró un perfil de socio asociado a esta cuenta');

    const lista = [...(socio.membresias ?? [])].sort(
        (a, b) => b.id_membresia - a.id_membresia
    );
    const actual = lista.find((m) => m.estado === 'Activa') ?? lista[0] ?? null;
    const historial = actual ? await listarHistorialMembresia(actual.id_membresia) : [];

    return {
        id_socio: socio.id_socio,
        numero_socio: socio.numero_socio,
        fecha_afiliacion: socio.fecha_afiliacion,
        usuario: socio.usuarios,
        membresia_actual: actual,
        historial
    };
}

// -------------------- ACTIVACIÓN AL PAGAR --------------------

const CONCEPTO_MEMBRESIA = /^(membres[ií]a|cuota de membres[ií]a)/i;

function unAnoDespues(fecha) {
    const [a, m, d] = fecha.split('-');
    const dia = m === '02' && d === '29' ? '28' : d;
    return `${Number(a) + 1}-${m}-${dia}`;
}

// Cuando se termina de pagar la membresía de un socio que se acaba de registrar,
// la membresía pasa a Activa por un año desde hoy y la cuenta se activa para que
// pueda iniciar sesión. Una cuenta Suspendida no se toca: eso lo decide el admin.
async function activarMembresiaPagada(idSocio, idUsuarioAdmin) {
    const { data: membresia, error } = await supabaseAdmin
        .from('membresias')
        .select('id_membresia, estado, fecha_vencimiento, tipos_membresia(nombre)')
        .eq('id_socio', idSocio)
        .eq('estado', 'Pendiente')
        .order('id_membresia', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!membresia) return null;

    // Todos los cargos de membresía del socio deben estar pagados
    const { data: cargos, error: e } = await supabaseAdmin
        .from('cargos')
        .select('concepto, estado')
        .eq('id_socio', idSocio)
        .is('id_reserva', null)
        .not('estado', 'in', '("Pagado","Anulado")');

    if (e) throw new Error(e.message);
    if (cargos.some((c) => CONCEPTO_MEMBRESIA.test(c.concepto ?? ''))) return null;

    const hoy = ahoraCR().fecha;
    const vence = membresia.fecha_vencimiento && String(membresia.fecha_vencimiento) > hoy
        ? membresia.fecha_vencimiento
        : unAnoDespues(hoy);

    const { error: eu } = await supabaseAdmin
        .from('membresias')
        .update({ estado: 'Activa', fecha_inicio: hoy, fecha_vencimiento: vence })
        .eq('id_membresia', membresia.id_membresia)
        .eq('estado', 'Pendiente');

    if (eu) throw new Error(eu.message);

    await registrarHistorial({
        id_membresia: membresia.id_membresia,
        estado_anterior: 'Pendiente',
        estado_nuevo: 'Activa',
        id_usuario: idUsuarioAdmin,
        motivo: 'Pago de la membresía registrado'
    });

    const { data: socio } = await supabaseAdmin
        .from('socios').select('id_usuario').eq('id_socio', idSocio).single();

    const { data: cuenta, error: ec } = await supabaseAdmin
        .from('usuarios')
        .update({ estado: 'Activo' })
        .eq('id_usuario', socio.id_usuario)
        .eq('estado', 'Inactivo')
        .select('id_usuario')
        .maybeSingle();

    if (ec) throw new Error(ec.message);

    return {
        membresia: membresia.tipos_membresia?.nombre ?? '',
        vence,
        cuentaActivada: Boolean(cuenta)
    };
}

module.exports = {
    ESTADOS_MEMBRESIA,
    listarTiposMembresia,
    crearTipoMembresia,
    actualizarTipoMembresia,
    listarSociosConMembresias,
    obtenerDetalleMembresia,
    asignarMembresia,
    modificarMembresia,
    agregarBeneficiario,
    eliminarBeneficiario,
    consultarMembresiaPorUsuario,
    activarMembresiaPagada
};