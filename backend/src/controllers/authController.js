
const {
    registrarUsuario,
    iniciarSesion
} = require('../services/registro');

async function registro(req, res) {
    try {
        const {
            nombre_completo,
            cedula,
            telefono,
            fecha_nacimiento,
            direccion,
            correo,
            contrasena,
            id_tipo_membresia
        } = req.body;

        if (
            !nombre_completo ||
            !cedula ||
            !telefono ||
            !fecha_nacimiento ||
            !direccion ||
            !correo ||
            !contrasena ||
            !id_tipo_membresia
        ) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios'
            });
        }

        const resultado = await registrarUsuario(req.body);

        return res.status(201).json(resultado);

    } catch (error) {
        console.error('Error en el registro:', error.message);

        return res.status(400).json({
            mensaje: 'No se pudo registrar el usuario'
        });
    }
}



async function login(req, res) {
    try {
        const { correo, contrasena } = req.body;

        if (!correo || !contrasena) {
            return res.status(400).json({
                mensaje: 'El correo y la contraseña son obligatorios'
            });
        }

        const resultado = await iniciarSesion(
            correo,
            contrasena
        );

        return res.status(200).json(resultado);

    } catch (error) {
        console.error('Error al iniciar sesión:', error.message);

        return res.status(401).json({
            mensaje: 'No se pudo iniciar sesión'
        });
    }
}


const { supabaseAdmin } = require('../config/supabaseAdmin');

// Consultar el perfil del usuario autenticado
async function obtenerPerfil(req, res) {
    try {
        const idUsuario = req.usuarioAuth.id;

        const { data: usuario, error } = await supabaseAdmin
            .from('usuarios')
            .select(`
                id_usuario,
                nombre_completo,
                cedula,
                telefono,
                fecha_nacimiento,
                direccion,
                estado,
                roles(nombre)
            `)
            .eq('id_usuario', idUsuario)
            .single();

        if (error) {
            console.error('Error al consultar perfil:', error.message);

            return res.status(500).json({
                mensaje: 'Error al consultar el perfil'
            });
        }

        if (!usuario) {
            return res.status(404).json({
                mensaje: 'Usuario no encontrado'
            });
        }

        return res.status(200).json({
            mensaje: 'Perfil consultado correctamente',
            usuario: {
                ...usuario,
                correo: req.usuarioAuth.email
            }
        });

    } catch (error) {
        console.error('Error al obtener perfil:', error.message);

        return res.status(500).json({
            mensaje: 'Error al obtener el perfil'
        });
    }
}


module.exports = {
    registro,
    login,
    obtenerPerfil
};
