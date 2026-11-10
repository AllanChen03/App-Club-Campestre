const {
    registrarUsuario,
    iniciarSesion,
    refrescarSesion,
    recuperarContrasena,
    restablecerContrasena,
    listarTiposMembresia
} = require('../services/registro');

const { buscarUsuario, obtenerDatosSocio, modificarUsuario } =
    require('../services/usuarios');

const { supabaseAdmin } = require('../config/supabaseAdmin');
const { responderError } = require('../utils/ErrorHttp');
const v = require('../utils/validaciones');

async function registro(req, res) {
    try {
        const datos = req.body ?? {};

        const error =
            v.validarDatosPersonales(datos, true) ||
            v.validarCorreo(datos.correo) ||
            v.validarContrasena(datos.contrasena) ||
            (!Number.isInteger(datos.id_tipo_membresia)
                ? 'Debes elegir un tipo de membresía'
                : null);

        if (error) {
            return res.status(400).json({ mensaje: error });
        }

        const resultado = await registrarUsuario({
            ...datos,
            nombre_completo: datos.nombre_completo.trim(),
            cedula: datos.cedula.trim(),
            telefono: datos.telefono.trim(),
            direccion: datos.direccion.trim(),
            correo: datos.correo.trim().toLowerCase()
        });

        return res.status(201).json(resultado);

    } catch (error) {
        return responderError(res, error, 'Error en el registro',
            'No se pudo registrar el usuario', 400);
    }
}

async function login(req, res) {
    try {
        const { correo, contrasena } = req.body ?? {};

        if (!v.esTexto(correo) || !v.esTexto(contrasena)) {
            return res.status(400).json({
                mensaje: 'El correo y la contraseña son obligatorios'
            });
        }

        const resultado = await iniciarSesion(correo.trim(), contrasena);

        return res.status(200).json(resultado);

    } catch (error) {
        return responderError(res, error, 'Error al iniciar sesión',
            'No se pudo iniciar sesión');
    }
}

async function refrescar(req, res) {
    try {
        const { refresh_token } = req.body ?? {};

        if (!v.esTexto(refresh_token)) {
            return res.status(400).json({ mensaje: 'Falta el refresh_token' });
        }

        return res.status(200).json(await refrescarSesion(refresh_token));

    } catch (error) {
        return responderError(res, error, 'Error al refrescar sesión',
            'No se pudo renovar la sesión');
    }
}

async function obtenerPerfil(req, res) {
    try {
        const idUsuario = req.usuarioAuth.id;

        const usuario = await buscarUsuario(idUsuario);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        const socio = usuario.roles?.nombre === 'Socio'
            ? await obtenerDatosSocio(idUsuario)
            : null;

        return res.status(200).json({
            mensaje: 'Perfil consultado correctamente',
            usuario: {
                ...usuario,
                correo: req.usuarioAuth.email,
                socio
            }
        });

    } catch (error) {
        return responderError(res, error, 'Error al obtener perfil',
            'Error al obtener el perfil');
    }
}

async function actualizarPerfil(req, res) {
    try {
        const datos = req.body ?? {};
        const campos = Object.keys(datos);

        if (campos.length === 0 ||
            campos.some((campo) => !['telefono', 'direccion'].includes(campo))) {
            return res.status(400).json({
                mensaje: 'Solamente puedes modificar el teléfono y la dirección'
            });
        }

        const error = v.validarDatosPersonales(datos, false);

        if (error) {
            return res.status(400).json({ mensaje: error });
        }

        const cambios = {};
        campos.forEach((campo) => { cambios[campo] = datos[campo].trim(); });

        const usuario = await modificarUsuario(req.usuarioAuth.id, cambios);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        return res.status(200).json({
            mensaje: 'Perfil actualizado correctamente',
            usuario
        });

    } catch (error) {
        return responderError(res, error, 'Error al actualizar perfil',
            'Error al actualizar el perfil');
    }
}

async function cerrarSesion(req, res) {
    try {
        const token = req.headers.authorization.split(' ')[1];

        // Revocar la sesión actual en Supabase
        const { error } = await supabaseAdmin.auth.admin.signOut(token, 'local');

        if (error) {
            console.error('Error al cerrar sesión:', error.message);

            return res.status(500).json({
                mensaje: 'No se pudo cerrar la sesión'
            });
        }

        return res.status(200).json({
            mensaje: 'Sesión cerrada correctamente'
        });

    } catch (error) {
        return responderError(res, error, 'Error al cerrar sesión',
            'Error al cerrar la sesión');
    }
}

async function solicitarRecuperacion(req, res) {
    try {
        const { correo } = req.body ?? {};

        const error = v.validarCorreo(correo);

        if (error) {
            return res.status(400).json({ mensaje: error });
        }

        const resultado = await recuperarContrasena(correo.trim());

        return res.status(200).json(resultado);

    } catch (error) {
        console.error('Error en recuperación:', error.message);

        // Misma respuesta para no revelar qué correos existen
        return res.status(200).json({
            mensaje: 'Si el correo está registrado, recibirás un enlace para recuperar tu contraseña'
        });
    }
}

async function restablecer(req, res) {
    try {
        const { access_token, contrasena } = req.body ?? {};

        if (!v.esTexto(access_token)) {
            return res.status(400).json({ mensaje: 'El enlace no es válido' });
        }

        const error = v.validarContrasena(contrasena);

        if (error) {
            return res.status(400).json({ mensaje: error });
        }

        return res.status(200).json(await restablecerContrasena(access_token, contrasena));

    } catch (error) {
        return responderError(res, error, 'Error al restablecer contraseña',
            'No se pudo cambiar la contraseña');
    }
}

async function tiposMembresia(req, res) {
    try {
        return res.status(200).json({ tipos: await listarTiposMembresia() });
    } catch (error) {
        return responderError(res, error, 'Error al consultar membresías',
            'No se pudieron consultar los tipos de membresía');
    }
}

module.exports = {
    registro,
    login,
    refrescar,
    obtenerPerfil,
    actualizarPerfil,
    cerrarSesion,
    solicitarRecuperacion,
    restablecer,
    tiposMembresia
};
