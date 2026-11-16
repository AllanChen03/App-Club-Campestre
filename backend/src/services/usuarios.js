const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ErrorHttp } = require('../utils/ErrorHttp');
const { ahora: ahoraCR } = require('../utils/horario');
const { ROLES_ADMIN } = require('../utils/roles');

const CAMPOS_USUARIO = `
    id_usuario,
    nombre_completo,
    cedula,
    telefono,
    fecha_nacimiento,
    direccion,
    estado,
    fecha_creacion,
    roles(nombre)
`;

async function obtenerCorreos() {
    const correos = new Map();
    const porPagina = 1000;

    for (let pagina = 1; ; pagina++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page: pagina,
            perPage: porPagina
        });

        if (error) {
            throw new Error(error.message);
        }

        data.users.forEach((u) => correos.set(u.id, u.email));

        if (data.users.length < porPagina) break;
    }

    return correos;
}

async function listarUsuarios() {

    const [{ data, error }, correos] = await Promise.all([
        supabaseAdmin
            .from('usuarios')
            .select(`${CAMPOS_USUARIO}, socios(numero_socio)`)
            .order('nombre_completo', { ascending: true }),
        obtenerCorreos()
    ]);

    if (error) {
        throw new Error(error.message);
    }

    return data.map(({ socios, ...u }) => ({
        ...u,
        correo: correos.get(u.id_usuario) ?? null,
        numero_socio: primero(socios)?.numero_socio ?? null
    }));
}
async function buscarUsuario(idUsuario, { detalle = false } = {}) {

    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select(CAMPOS_USUARIO)
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!data || !detalle) {
        return data;
    }

    const [{ data: auth }, socio] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(idUsuario),
        obtenerDatosSocio(idUsuario)
    ]);

    return {
        ...data,
        correo: auth?.user?.email ?? null,
        ultimo_ingreso: auth?.user?.last_sign_in_at ?? null,
        socio
    };
}

async function obtenerDatosSocio(idUsuario) {

    const { data, error } = await supabaseAdmin
        .from('socios')
        .select(`
            numero_socio,
            fecha_afiliacion,
            membresias(
                estado,
                fecha_inicio,
                fecha_vencimiento,
                tipos_membresia(nombre, max_invitados, max_beneficiarios)
            )
        `)
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!data) {
        return null;
    }

    const membresias = [...(data.membresias ?? [])].sort((a, b) =>
        String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)));

    const actual = membresias.find((m) => m.estado === 'Activa') ?? membresias[0] ?? null;

    return {
        numero_socio: data.numero_socio,
        fecha_afiliacion: data.fecha_afiliacion,
        membresia: actual && {
            tipo: actual.tipos_membresia?.nombre ?? null,
            estado: actual.estado,
            fecha_inicio: actual.fecha_inicio,
            fecha_vencimiento: actual.fecha_vencimiento,
            max_invitados: actual.tipos_membresia?.max_invitados ?? null,
            max_beneficiarios: actual.tipos_membresia?.max_beneficiarios ?? null
        }
    };
}

function membresiaVigente(socio) {
    const m = socio?.membresia;

    if (!m || m.estado !== 'Activa') return false;
    if (!m.fecha_vencimiento) return true;

    const hoy = ahoraCR().fecha; // fecha de Costa Rica, no UTC
    return String(m.fecha_vencimiento).slice(0, 10) >= hoy;
}

async function modificarUsuario(idUsuario, cambios) {

    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .update(cambios)
        .eq('id_usuario', idUsuario)
        .select(CAMPOS_USUARIO)
        .maybeSingle();

    if (error) {
        if (error.code === '23505') {
            throw new ErrorHttp(409, 'Ya existe otro usuario con esa cédula');
        }
        throw new Error(error.message);
    }

    return data;
}

async function cambiarEstado(idUsuario, estadosOrigen, estadoNuevo) {

    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .update({ estado: estadoNuevo })
        .eq('id_usuario', idUsuario)
        .in('estado', estadosOrigen)
        .select('id_usuario, nombre_completo, estado')
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

async function crearAdministrador(datos) {

    const { data: rol, error: rolError } = await supabaseAdmin
        .from('roles')
        .select('id_rol, nombre')
        .eq('id_rol', datos.id_rol)
        .maybeSingle();

    if (rolError) {
        throw new Error(rolError.message);
    }

    if (!rol || !ROLES_ADMIN.includes(rol.nombre)) {
        throw new ErrorHttp(400, 'El rol elegido no es un rol de administrador');
    }

    const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
            email: datos.correo,
            password: datos.contrasena,
            email_confirm: true
        });

    if (authError) {
        if (/already|registered|exists/i.test(authError.message)) {
            throw new ErrorHttp(409, 'Ya existe una cuenta con ese correo');
        }
        throw new Error(authError.message);
    }

    const idUsuario = authData.user.id;

    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .insert({
            id_usuario: idUsuario,
            id_rol: rol.id_rol,
            nombre_completo: datos.nombre_completo,
            cedula: datos.cedula,
            telefono: datos.telefono,
            fecha_nacimiento: datos.fecha_nacimiento,
            direccion: datos.direccion,
            estado: 'Activo'
        })
        .select(CAMPOS_USUARIO)
        .single();

    if (error) {
        await supabaseAdmin.auth.admin.deleteUser(idUsuario);

        if (error.code === '23505') {
            throw new ErrorHttp(409, 'Ya existe un usuario con esa cédula');
        }
        throw new Error(error.message);
    }

    return { ...data, correo: datos.correo };
}

async function listarRolesAdministrativos() {

    const { data, error } = await supabaseAdmin
        .from('roles')
        .select('id_rol, nombre, descripcion')
        .in('nombre', ROLES_ADMIN)
        .order('id_rol', { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

function primero(valor) {
    return Array.isArray(valor) ? valor[0] : valor;
}

async function contar(tabla, columna, valor) {
    const { count, error } = await supabaseAdmin
        .from(tabla)
        .select('*', { count: 'exact', head: true })
        .eq(columna, valor);

    if (error) throw new Error(error.message);
    return count ?? 0;
}

async function borrar(consulta) {
    const { error } = await consulta;
    if (!error) return;
    if (error.code === '23503') {
        throw new ErrorHttp(409, 'El socio tiene registros asociados y no se puede eliminar. Márquelo como Inactivo');
    }
    throw new Error(error.message);
}

// Elimina un socio que nunca usó el club: sin pagos, reservas ni visitas de
// invitados. Si ya tiene historial se conserva (para los reportes y el estado
// de cuenta) y se le indica al administrador que lo marque como Inactivo.
// Se exige escribir el nombre completo como confirmación.
async function eliminarSocio(idUsuario, confirmacion) {
    const usuario = await buscarUsuario(idUsuario);
    if (!usuario) throw new ErrorHttp(404, 'Usuario no encontrado');
    if (ROLES_ADMIN.includes(usuario.roles?.nombre)) {
        throw new ErrorHttp(403, 'Solo se pueden eliminar cuentas de socios');
    }
    if (String(confirmacion ?? '').trim() !== usuario.nombre_completo) {
        throw new ErrorHttp(400, 'Escriba el nombre completo del socio para confirmar');
    }

    const { data: socio, error } = await supabaseAdmin
        .from('socios')
        .select('id_socio, numero_socio, membresias(id_membresia), invitados(id_invitado)')
        .eq('id_usuario', idUsuario)
        .maybeSingle();

    if (error) throw new Error(error.message);

    if (socio) {
        const idsInvitados = socio.invitados.map((i) => i.id_invitado);
        const [pagos, reservas, visitas] = await Promise.all([
            contar('pagos', 'id_socio', socio.id_socio),
            contar('reservas', 'id_socio', socio.id_socio),
            idsInvitados.length
                ? supabaseAdmin.from('visitas_invitados').select('*', { count: 'exact', head: true })
                    .in('id_invitado', idsInvitados).then(({ count, error: e }) => {
                        if (e) throw new Error(e.message);
                        return count ?? 0;
                    })
                : 0
        ]);

        const historial = [];
        if (pagos) historial.push(`${pagos} ${pagos === 1 ? 'pago' : 'pagos'}`);
        if (reservas) historial.push(`${reservas} ${reservas === 1 ? 'reserva' : 'reservas'}`);
        if (visitas) historial.push(`${visitas} ${visitas === 1 ? 'visita de invitado' : 'visitas de invitados'}`);
        if (historial.length) {
            throw new ErrorHttp(409,
                `No se puede eliminar: tiene ${historial.join(', ')}. Para darlo de baja, márquelo como Inactivo`);
        }

        const idsMembresias = socio.membresias.map((m) => m.id_membresia);
        if (idsMembresias.length) {
            await borrar(supabaseAdmin.from('beneficiarios').delete().in('id_membresia', idsMembresias));
            await borrar(supabaseAdmin.from('historial_membresias').delete().in('id_membresia', idsMembresias));
            await borrar(supabaseAdmin.from('membresias').delete().in('id_membresia', idsMembresias));
        }
        await borrar(supabaseAdmin.from('cargos').delete().eq('id_socio', socio.id_socio));
        await borrar(supabaseAdmin.from('invitados').delete().eq('id_socio', socio.id_socio));
        await borrar(supabaseAdmin.from('socios').delete().eq('id_socio', socio.id_socio));
    }

    await borrar(supabaseAdmin.from('notificaciones').delete().eq('id_usuario', idUsuario));
    await borrar(supabaseAdmin.from('usuarios').delete().eq('id_usuario', idUsuario));

    const { error: errorAuth } = await supabaseAdmin.auth.admin.deleteUser(idUsuario);
    if (errorAuth) console.error('Error al eliminar el usuario de Auth:', errorAuth.message);

    return { nombre: usuario.nombre_completo, numero_socio: socio?.numero_socio ?? null };
}

module.exports = {
    listarUsuarios,
    buscarUsuario,
    obtenerDatosSocio,
    membresiaVigente,
    modificarUsuario,
    cambiarEstado,
    crearAdministrador,
    listarRolesAdministrativos,
    eliminarSocio
};
