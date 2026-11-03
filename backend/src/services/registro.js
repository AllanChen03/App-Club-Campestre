
const { supabaseAdmin } = require('../config/supabaseAdmin');
const { supabaseAuth } = require('../config/supabaseAuth');

// Registrar un nuevo socio
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

    // Crear la cuenta en Supabase Auth
    const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
            email: correo,
            password: contrasena,
            email_confirm: true
        });

    if (authError) {
        throw new Error(authError.message);
    }

    const idUsuario = authData.user.id;

    // Registrar los datos del socio, membresía y cargo
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

        // Eliminar la cuenta Auth si falla el registro
        const { error: deleteError } =
            await supabaseAdmin.auth.admin.deleteUser(idUsuario);

        if (deleteError) {
            console.error(
                'Error al eliminar usuario de Auth:',
                deleteError.message
            );
        }

        throw new Error(error.message);
    }

    return {
        mensaje: 'Cuenta registrada correctamente',
        id_socio: data,
        estado: 'Pendiente de pago'
    };
}

// Iniciar sesión
async function iniciarSesion(correo, contrasena) {

    // Validar correo y contraseña
    const { data, error } =
        await supabaseAuth.auth.signInWithPassword({
            email: correo,
            password: contrasena
        });

    if (error) {
        throw new Error('Correo o contraseña incorrectos');
    }

    // Consultar los datos del usuario
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
            .single();

    if (usuarioError) {
        console.error(
            'Error al consultar usuarios:',
            usuarioError.message
        );

        throw new Error('Error al consultar los datos del usuario');
    }

    if (!usuario) {
        throw new Error('El usuario no existe en la tabla usuarios');
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

module.exports = {
    registrarUsuario,
    iniciarSesion
};
