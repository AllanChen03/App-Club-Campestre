const {
    listarUsuarios,
    buscarUsuario,
    membresiaVigente,
    modificarUsuario,
    cambiarEstado,
    crearAdministrador,
    listarRolesAdministrativos
} = require('../services/usuarios');

const { recuperarContrasena } = require('../services/registro');
const { ROLES_ADMIN, ROL_SOCIO } = require('../utils/roles');

const { responderError } = require('../utils/ErrorHttp');
const v = require('../utils/validaciones');

const ID_INVALIDO = { mensaje: 'El identificador del usuario no es válido' };
const NO_ENCONTRADO = { mensaje: 'Usuario no encontrado' };
const ESTADO_CAMBIO = { mensaje: 'El estado del usuario cambió. Intenta nuevamente' };

function esPropiaCuenta(req, id) {
    return id.toLowerCase() === req.usuarioAuth.id.toLowerCase();
}

async function obtenerUsuarios(req, res) {
    try {
        const usuarios = await listarUsuarios();

        return res.status(200).json({
            mensaje: 'Usuarios consultados correctamente',
            usuarios
        });

    } catch (error) {
        return responderError(res, error, 'Error al consultar usuarios',
            'No se pudieron consultar los usuarios');
    }
}

async function obtenerUsuario(req, res) {
    try {
        const { id } = req.params;

        if (!v.validarUUID(id)) return res.status(400).json(ID_INVALIDO);

        const usuario = await buscarUsuario(id, { detalle: true });

        if (!usuario) return res.status(404).json(NO_ENCONTRADO);

        return res.status(200).json({
            mensaje: 'Usuario consultado correctamente',
            usuario
        });

    } catch (error) {
        return responderError(res, error, 'Error al consultar usuario',
            'No se pudo consultar el usuario');
    }
}

async function actualizarUsuario(req, res) {
    try {
        const { id } = req.params;

        if (!v.validarUUID(id)) return res.status(400).json(ID_INVALIDO);

        const camposPermitidos = [
            'nombre_completo',
            'cedula',
            'telefono',
            'fecha_nacimiento',
            'direccion'
        ];

        const datos = req.body;

        if (!datos || typeof datos !== 'object' ||
            Array.isArray(datos) ||
            Object.keys(datos).length === 0) {
            return res.status(400).json({
                mensaje: 'Debes proporcionar datos para actualizar'
            });
        }

        if (Object.keys(datos).some((campo) => !camposPermitidos.includes(campo))) {
            return res.status(400).json({
                mensaje: 'Se enviaron campos que no se pueden modificar'
            });
        }

        const error = v.validarDatosPersonales(datos, false);

        if (error) return res.status(400).json({ mensaje: error });

        const cambios = {};
        Object.keys(datos).forEach((campo) => { cambios[campo] = datos[campo].trim(); });

        const usuario = await modificarUsuario(id, cambios);

        if (!usuario) return res.status(404).json(NO_ENCONTRADO);

        return res.status(200).json({
            mensaje: 'Usuario actualizado correctamente',
            usuario
        });

    } catch (error) {
        return responderError(res, error, 'Error al actualizar usuario',
            'No se pudo actualizar el usuario');
    }
}

async function suspenderCuenta(req, res) {
    try {
        const { id } = req.params;

        if (!v.validarUUID(id)) return res.status(400).json(ID_INVALIDO);

        if (esPropiaCuenta(req, id)) {
            return res.status(403).json({ mensaje: 'No puedes suspender tu propia cuenta' });
        }

        const usuario = await buscarUsuario(id);

        if (!usuario) return res.status(404).json(NO_ENCONTRADO);

        if (ROLES_ADMIN.includes(usuario.roles?.nombre)) {
            return res.status(403).json({
                mensaje: 'No se puede suspender una cuenta administrativa. Puede desactivarla'
            });
        }

        if (usuario.estado !== 'Activo') {
            return res.status(400).json({ mensaje: 'Solo se pueden suspender usuarios activos' });
        }

        const resultado = await cambiarEstado(id, ['Activo'], 'Suspendido');

        if (!resultado) return res.status(409).json(ESTADO_CAMBIO);

        return res.status(200).json({
            mensaje: 'Usuario suspendido correctamente',
            usuario: resultado
        });

    } catch (error) {
        return responderError(res, error, 'Error al suspender usuario',
            'No se pudo suspender el usuario');
    }
}

async function activarCuenta(req, res) {
    try {
        const { id } = req.params;

        if (!v.validarUUID(id)) return res.status(400).json(ID_INVALIDO);

        const usuario = await buscarUsuario(id, { detalle: true });

        if (!usuario) return res.status(404).json(NO_ENCONTRADO);

        if (!['Suspendido', 'Inactivo'].includes(usuario.estado)) {
            return res.status(400).json({
                mensaje: 'Solo se pueden activar cuentas suspendidas o inactivas'
            });
        }

        if (usuario.roles?.nombre === ROL_SOCIO && !membresiaVigente(usuario.socio)) {
            return res.status(409).json({
                mensaje: 'El socio no tiene una membresía activa y vigente. Registre primero el pago de la membresía'
            });
        }

        const resultado = await cambiarEstado(id, ['Suspendido', 'Inactivo'], 'Activo');

        if (!resultado) return res.status(409).json(ESTADO_CAMBIO);

        return res.status(200).json({
            mensaje: 'Cuenta activada correctamente',
            usuario: resultado
        });

    } catch (error) {
        return responderError(res, error, 'Error al activar usuario',
            'No se pudo activar el usuario');
    }
}

async function desactivarCuenta(req, res) {
    try {
        const { id } = req.params;

        if (!v.validarUUID(id)) return res.status(400).json(ID_INVALIDO);

        if (esPropiaCuenta(req, id)) {
            return res.status(403).json({ mensaje: 'No puedes desactivar tu propia cuenta' });
        }

        const usuario = await buscarUsuario(id);

        if (!usuario) return res.status(404).json(NO_ENCONTRADO);

        if (!['Activo', 'Suspendido'].includes(usuario.estado)) {
            return res.status(400).json({ mensaje: 'La cuenta ya está inactiva' });
        }

        const resultado = await cambiarEstado(id, ['Activo', 'Suspendido'], 'Inactivo');

        if (!resultado) return res.status(409).json(ESTADO_CAMBIO);

        return res.status(200).json({
            mensaje: 'Cuenta desactivada correctamente',
            usuario: resultado
        });

    } catch (error) {
        return responderError(res, error, 'Error al desactivar usuario',
            'No se pudo desactivar el usuario');
    }
}

async function registrarAdministrador(req, res) {
    try {
        const datos = req.body ?? {};

        const error =
            v.validarDatosPersonales(datos, true) ||
            v.validarCorreo(datos.correo) ||
            v.validarContrasena(datos.contrasena) ||
            (!Number.isInteger(datos.id_rol) ? 'Debes elegir un rol' : null);

        if (error) return res.status(400).json({ mensaje: error });

        const usuario = await crearAdministrador({
            id_rol: datos.id_rol,
            nombre_completo: datos.nombre_completo.trim(),
            cedula: datos.cedula.trim(),
            telefono: datos.telefono.trim(),
            fecha_nacimiento: datos.fecha_nacimiento,
            direccion: datos.direccion.trim(),
            correo: datos.correo.trim().toLowerCase(),
            contrasena: datos.contrasena
        });

        return res.status(201).json({
            mensaje: 'Administrador creado correctamente',
            usuario
        });

    } catch (error) {
        return responderError(res, error, 'Error al crear administrador',
            'No se pudo crear el administrador');
    }
}

async function restablecerContrasenaSocio(req, res) {
    try {
        const { id } = req.params;

        if (!v.validarUUID(id)) return res.status(400).json(ID_INVALIDO);

        const usuario = await buscarUsuario(id, { detalle: true });

        if (!usuario) return res.status(404).json(NO_ENCONTRADO);

        if (usuario.roles?.nombre !== ROL_SOCIO) {
            return res.status(400).json({
                mensaje: 'Solo se puede restablecer la contraseña de socios'
            });
        }

        if (!usuario.correo) {
            return res.status(400).json({ mensaje: 'El socio no tiene un correo registrado' });
        }

        await recuperarContrasena(usuario.correo);

        return res.status(200).json({
            mensaje: `Se envió el enlace para restablecer la contraseña a ${usuario.correo}`
        });

    } catch (error) {
        return responderError(res, error, 'Error al restablecer contraseña de socio',
            'No se pudo enviar el correo de restablecimiento');
    }
}

async function rolesAdministrativos(req, res) {
    try {
        return res.status(200).json({ roles: await listarRolesAdministrativos() });
    } catch (error) {
        return responderError(res, error, 'Error al consultar roles',
            'No se pudieron consultar los roles');
    }
}

module.exports = {
    obtenerUsuarios,
    obtenerUsuario,
    actualizarUsuario,
    suspenderCuenta,
    activarCuenta,
    desactivarCuenta,
    registrarAdministrador,
    restablecerContrasenaSocio,
    rolesAdministrativos
};
