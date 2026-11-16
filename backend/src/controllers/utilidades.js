const { responderError } = require('../utils/ErrorHttp');
const { socioDeUsuario } = require('../services/socios');

// Envuelve un controlador: cualquier error se responde con el formato del proyecto
function manejar(contexto, mensajeGenerico, controlador) {
    return async (req, res) => {
        try {
            await controlador(req, res);
        } catch (error) {
            responderError(res, error, contexto, mensajeGenerico);
        }
    };
}

// Lee un id numérico de la ruta; responde 400 si no es válido
function leerId(valor) {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Middleware: carga en req.socio los datos del socio autenticado
async function cargarSocio(req, res, next) {
    try {
        req.socio = await socioDeUsuario(req.usuarioAuth.id);
        next();
    } catch (error) {
        responderError(res, error, 'Error al cargar el socio', 'No se pudieron cargar sus datos de socio');
    }
}

module.exports = { manejar, leerId, cargarSocio };
