const { supabaseAdmin } = require('../config/supabaseAdmin');
const { ErrorHttp } = require('../utils/ErrorHttp');
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

    const hoy = new Date().toISOString().slice(0, 10);
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

module.exports = {
    listarUsuarios,
    buscarUsuario,
    obtenerDatosSocio,
    membresiaVigente,
    modificarUsuario,
    cambiarEstado,
    crearAdministrador,
    listarRolesAdministrativos
};
