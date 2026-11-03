
const { supabaseAuth } = require('../config/supabaseAuth');

// Verificar que el usuario tenga una sesión válida
async function verificarToken(req, res, next) {
    try {
        // Obtener el token del encabezado Authorization
        const autorizacion = req.headers.authorization;

        if (!autorizacion || !autorizacion.startsWith('Bearer ')) {
            return res.status(401).json({
                mensaje: 'No se proporcionó un token válido'
            });
        }

        const token = autorizacion.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                mensaje: 'No se proporcionó un token'
            });
        }

        // Verificar el token con Supabase Auth
        const { data, error } =
            await supabaseAuth.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                mensaje: 'Token inválido o expirado'
            });
        }

        // Guardar el usuario autenticado en la solicitud
        req.usuarioAuth = data.user;

        // Permitir continuar a la siguiente función
        next();

    } catch (error) {
        console.error('Error al verificar token:', error.message);

        return res.status(500).json({
            mensaje: 'Error al verificar la autenticación'
        });
    }
}

module.exports = { verificarToken };
