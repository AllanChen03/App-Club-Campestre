// Avisos por correo de reservas: confirmación, modificación y cancelación.
// Usa las plantillas editables de la tabla `plantillas` y deja cada envío
// registrado en `notificaciones`, para que aparezca en el historial del club.

const { supabaseAdmin } = require('../config/supabaseAdmin');
const { waitUntil } = require('@vercel/functions');
const { enviarCorreo } = require('../config/correo');

const PLANTILLAS = {
    confirmacion: 'Confirmación de reservas',
    modificacion: 'Modificación de reserva',
    cancelacion: 'Cancelación de reserva'
};

// Texto de respaldo si la plantilla no existe o está inactiva
const RESPALDO = {
    confirmacion: {
        asunto: 'Reserva confirmada - Club Valle Alto',
        contenido: 'Estimado/a {nombre},\n\nSu reserva {codigo} ha sido confirmada.\n\nInstalación: {instalacion}\nFecha: {fecha}\nHorario: {hora_inicio} - {hora_fin}\nPersonas: {personas}\n\nClub Valle Alto.'
    },
    modificacion: {
        asunto: 'Reserva modificada - Club Valle Alto',
        contenido: 'Estimado/a {nombre},\n\nSu reserva {codigo} fue modificada. Estado actual: {estado}.\n\nInstalación: {instalacion}\nFecha: {fecha}\nHorario: {hora_inicio} - {hora_fin}\nPersonas: {personas}\n\nClub Valle Alto.'
    },
    cancelacion: {
        asunto: 'Reserva cancelada - Club Valle Alto',
        contenido: 'Estimado/a {nombre},\n\nLe informamos que su reserva {codigo} ha sido cancelada.\n\nInstalación: {instalacion}\nFecha: {fecha}\nHorario: {hora_inicio} - {hora_fin}\n\nClub Valle Alto.'
    }
};

const fechaCorta = (f) => String(f).slice(0, 10).split('-').reverse().join('/');

function hora12(valor) {
    const [h, m] = String(valor).split(':').map(Number);
    const sufijo = h < 12 ? 'a. m.' : 'p. m.';
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

// Reemplaza {variable} y {{variable}} (las plantillas usan llaves simples)
function rellenar(texto, variables) {
    return String(texto).replace(/\{\{?\s*([a-z_]+)\s*\}?\}/gi, (marca, clave) =>
        (variables[clave] !== undefined ? String(variables[clave]) : marca));
}

async function buscarPlantilla(tipo) {
    const { data, error } = await supabaseAdmin
        .from('plantillas')
        .select('id_plantilla, asunto, contenido, estado')
        .eq('nombre', PLANTILLAS[tipo])
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data?.estado === 'Activa' ? data : null;
}

async function destinatario(idSocio) {
    const { data, error } = await supabaseAdmin
        .from('socios')
        .select('id_usuario, usuarios(nombre_completo)')
        .eq('id_socio', idSocio)
        .single();

    if (error) throw new Error(error.message);

    const { data: auth, error: errorAuth } = await supabaseAdmin.auth.admin.getUserById(data.id_usuario);
    if (errorAuth) throw new Error(errorAuth.message);

    return {
        id_usuario: data.id_usuario,
        nombre: data.usuarios?.nombre_completo ?? 'socio',
        correo: auth?.user?.email ?? null
    };
}

async function enviar(tipo, reserva, { motivo } = {}) {
    const [persona, plantilla] = await Promise.all([destinatario(reserva.id_socio), buscarPlantilla(tipo)]);
    if (!persona.correo) return;

    const variables = {
        nombre: persona.nombre,
        codigo: reserva.codigo,
        instalacion: reserva.instalacion,
        fecha: fechaCorta(reserva.fecha_reserva),
        hora_inicio: hora12(reserva.hora_inicio),
        hora_fin: hora12(reserva.hora_fin),
        personas: reserva.cantidad_personas,
        estado: reserva.estado,
        motivo: motivo ?? ''
    };

    const base = plantilla ?? RESPALDO[tipo];
    const asunto = rellenar(base.asunto, variables);
    let contenido = rellenar(base.contenido, variables).replace(/\r\n/g, '\n');

    // Datos que no todas las plantillas incluyen pero el socio necesita saber
    const extras = [];
    if (motivo && !/\{\{?\s*motivo/i.test(base.contenido)) extras.push(`Motivo: ${motivo}`);
    if (tipo === 'modificacion' && reserva.estado === 'Pendiente' && !/\{\{?\s*estado/i.test(base.contenido)) {
        extras.push('La reserva quedó pendiente hasta que el club la vuelva a confirmar.');
    }
    if (tipo === 'confirmacion' && reserva.total_servicios > 0) {
        extras.push(`Servicios adicionales: ₡${Number(reserva.total_servicios).toLocaleString('es-CR')} (se suman a su estado de cuenta).`);
    }
    if (extras.length) {
        // Se colocan antes de la despedida (último párrafo corto), si la hay
        const parrafos = contenido.trimEnd().split(/\n\s*\n/);
        const despedida = parrafos.length > 1 && parrafos[parrafos.length - 1].length <= 80
            ? parrafos.pop() : null;
        parrafos.push(extras.join('\n'));
        if (despedida) parrafos.push(despedida);
        contenido = parrafos.join('\n\n');
    }

    // 1) Registrar como Pendiente
    const { data: registro, error } = await supabaseAdmin
        .from('notificaciones')
        .insert({
            id_usuario: persona.id_usuario,
            id_plantilla: plantilla?.id_plantilla ?? null,
            asunto,
            contenido,
            estado: 'Pendiente'
        })
        .select('id_notificacion')
        .single();

    if (error) throw new Error(error.message);

    // 2) Enviar y 3) marcar el resultado
    try {
        await enviarCorreo({ para: persona.correo, asunto, texto: contenido });
        await supabaseAdmin.from('notificaciones')
            .update({ estado: 'Enviada', fecha_envio: new Date().toISOString() })
            .eq('id_notificacion', registro.id_notificacion);
    } catch (e) {
        await supabaseAdmin.from('notificaciones')
            .update({ estado: 'Fallida' })
            .eq('id_notificacion', registro.id_notificacion);
        throw e;
    }
}

// Se llama sin esperar la respuesta: un correo que falla no debe deshacer
// ni demorar la reserva. El error queda en consola y como "Fallida" en el historial.
// En Vercel, waitUntil mantiene viva la función hasta que el correo termina de
// enviarse aunque ya se haya respondido; en local no hace nada.
function notificarReserva(tipo, reserva, extra = {}) {
    if (!PLANTILLAS[tipo] || !reserva) return Promise.resolve();
    const envio = enviar(tipo, reserva, extra).catch((e) => {
        console.error(`Error al enviar correo de ${tipo} de reserva ${reserva.codigo}:`, e.message);
    });
    waitUntil(envio);
    return envio;
}

module.exports = { notificarReserva, rellenar };
