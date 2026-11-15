const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ErrorHttp } = require('../utils/ErrorHttp');
const { ahora } = require('../utils/horario');

// Datos del socio que hace la solicitud, con su membresía vigente
async function socioDeUsuario(idUsuario) {
    const { data, error } = await supabaseAdmin
        .from('socios')
        .select(`
            id_socio,
            numero_socio,
            id_usuario,
            usuarios(nombre_completo, estado),
            membresias(
                estado,
                fecha_inicio,
                fecha_vencimiento,
                tipos_membresia(nombre, max_invitados)
            )
        `)
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ErrorHttp(403, 'Su cuenta no está registrada como socio');

    const hoy = ahora().fecha;
    const membresia = (data.membresias ?? []).find((m) =>
        m.estado === 'Activa' &&
        (!m.fecha_vencimiento || String(m.fecha_vencimiento).slice(0, 10) >= hoy)
    ) ?? null;

    return {
        id_socio: data.id_socio,
        id_usuario: data.id_usuario,
        numero_socio: data.numero_socio,
        nombre_completo: data.usuarios?.nombre_completo ?? '',
        membresia: membresia && {
            tipo: membresia.tipos_membresia?.nombre ?? '',
            max_invitados: membresia.tipos_membresia?.max_invitados ?? 0,
            fecha_vencimiento: membresia.fecha_vencimiento
        }
    };
}

// Exige membresía activa y vigente para reservar o registrar invitados
function exigirMembresia(socio) {
    if (!socio.membresia) {
        throw new ErrorHttp(403,
            'Necesita una membresía activa y vigente para usar esta función. Revise su membresía o estado de cuenta');
    }
}

module.exports = { socioDeUsuario, exigirMembresia };
