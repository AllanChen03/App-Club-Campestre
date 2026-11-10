const { supabaseAdmin } = require('../config/supabaseAdmin');
const { supabaseAuth } = require('../config/supabaseAuth');
const { ErrorHttp } = require('../utils/ErrorHttp');
const intentosLogin = require('./intentosLogin');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

async function registrarUsuario(datos) {

    const {
        nombre_completo,
        cedula,
        telefono,
        fecha_nacimiento,
        direccion,
        correo,
        contrasena,
        id_tipo_membresia
    } = datos;

    const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
            email: correo,
            password: contrasena,
            email_confirm: true
        });

    if (authError) {
        if (/already|registered|exists/i.test(authError.message)) {
            throw new ErrorHttp(409, 'Ya existe una cuenta con ese correo');
        }
        throw new Error(authError.message);
    }

    const idUsuario = authData.user.id;

    const { data, error } = await supabaseAdmin.rpc(
        'registrar_socio',
        {
            p_id_usuario: idUsuario,
            p_nombre_completo: nombre_completo,
            p_cedula: cedula,
            p_telefono: telefono,
            p_fecha_nacimiento: fecha_nacimiento,
            p_direccion: direccion,
            p_id_tipo_membresia: id_tipo_membresia
        }
    );

    if (error) {

        const { error: deleteError } =
            await supabaseAdmin.auth.admin.deleteUser(idUsuario);

        if (deleteError) {
            console.error(
                'Error al eliminar usuario de Auth:',
                deleteError.message
            );
        }

        if (error.code === '23505' || /duplicate|cedula/i.test(error.message)) {
            throw new ErrorHttp(409, 'Ya existe una cuenta con esa cédula');
        }

        throw new Error(error.message);
    }

    return {
        mensaje: 'Cuenta registrada correctamente',
        id_socio: data,
        estado: 'Pendiente de pago'
    };
}

async function iniciarSesion(correo, contrasena) {

    const hasta = intentosLogin.bloqueadoHasta(correo);

    if (hasta) {
        throw new ErrorHttp(429,
            'Hubo demasiados intentos fallidos. Intente de nuevo más tarde',
            { bloqueado_hasta: hasta.toISOString() });
    }

    const { data, error } =
        await supabaseAuth.auth.signInWithPassword({
            email: correo,
            password: contrasena
        });

    if (error) {
        const bloqueo = intentosLogin.registrarFallo(correo);

        if (bloqueo) {
            throw new ErrorHttp(429,
                'Hubo demasiados intentos fallidos. Intente de nuevo más tarde',
                { bloqueado_hasta: bloqueo.toISOString() });
        }

        throw new ErrorHttp(401, 'Correo o contraseña incorrectos');
    }

    intentosLogin.limpiar(correo);

    const { data: usuario, error: usuarioError } =
        await supabaseAdmin
            .from('usuarios')
            .select(`
                id_usuario,
                nombre_completo,
                estado,
                roles(nombre)
            `)
            .eq('id_usuario', data.user.id)
            .maybeSingle();

    if (usuarioError) {
        console.error(
            'Error al consultar usuarios:',
            usuarioError.message
        );

        throw new Error('Error al consultar los datos del usuario');
    }

    if (!usuario) {
        await revocarSesion(data.session.access_token);
        throw new ErrorHttp(403, 'La cuenta no tiene datos de usuario registrados');
    }

    if (usuario.estado !== 'Activo') {
        await revocarSesion(data.session.access_token);

        const mensaje = usuario.estado === 'Suspendido'
            ? 'Su cuenta está suspendida. Comuníquese con la administración del club'
            : 'Su cuenta no está activa. Si acaba de registrarse, se activará cuando se confirme el pago de su membresía';

        throw new ErrorHttp(403, mensaje, { estado: usuario.estado });
    }

    return {
        mensaje: 'Inicio de sesión correcto',
        usuario: {
            id_usuario: usuario.id_usuario,
            nombre_completo: usuario.nombre_completo,
            rol: usuario.roles.nombre,
            estado: usuario.estado
        },
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
    };
}

async function revocarSesion(token) {
    const { error } = await supabaseAdmin.auth.admin.signOut(token, 'local');

    if (error) {
        console.error('Error al revocar sesión:', error.message);
    }
}

async function refrescarSesion(refreshToken) {

    const { data, error } =
        await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
        throw new ErrorHttp(401, 'La sesión expiró. Inicie sesión de nuevo');
    }

    return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
    };
}

async function recuperarContrasena(correo) {

    const { error } =
        await supabaseAuth.auth.resetPasswordForEmail(correo, {
            redirectTo: `${FRONTEND_URL}/restablecer-contrasena`
        });

    if (error) {
        console.error(
            'Error al solicitar recuperación:',
            error.message
        );

        throw new Error('No se pudo procesar la recuperación');
    }

    return {
        mensaje: 'Si el correo está registrado, recibirás un enlace para recuperar tu contraseña'
    };
}

async function restablecerContrasena(token, contrasena) {

    const { data, error } = await supabaseAuth.auth.getUser(token);

    if (error || !data.user) {
        throw new ErrorHttp(401, 'El enlace expiró o no es válido. Solicite uno nuevo');
    }

    if (!esTokenDeRecuperacion(token)) {
        throw new ErrorHttp(401, 'El enlace no es de recuperación de contraseña');
    }

    const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
            password: contrasena
        });

    if (updateError) {
        if (/different|same/i.test(updateError.message)) {
            throw new ErrorHttp(400, 'La nueva contraseña debe ser diferente a la anterior');
        }
        throw new Error(updateError.message);
    }

    await revocarSesion(token);

    return { mensaje: 'Contraseña actualizada correctamente' };
}


function esTokenDeRecuperacion(token) {
    try {
        const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
        );
        return Array.isArray(payload.amr) &&
            payload.amr.some((m) => m.method === 'recovery' || m.method === 'otp');
    } catch {
        return false;
    }
}


async function listarTiposMembresia() {

    const { data, error } = await supabaseAdmin
        .from('tipos_membresia')
        .select('id_tipo_membresia, nombre, descripcion, precio, max_beneficiarios, max_invitados')
        .order('precio', { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

module.exports = {
    registrarUsuario,
    iniciarSesion,
    refrescarSesion,
    recuperarContrasena,
    restablecerContrasena,
    listarTiposMembresia
};
