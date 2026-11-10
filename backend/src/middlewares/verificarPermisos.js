
const { supabaseAdmin } = require('../config/supabaseAdmin');

function verificarRol(...rolesPermitidos) {
    return async (req, res, next) => {
        try {
            const idUsuario = req.usuarioAuth.id;

            const { data: usuario, error } = await supabaseAdmin
                .from('usuarios')
                .select(`
                    id_usuario,
                    estado,
                    roles(nombre)
                `)
                .eq('id_usuario', idUsuario)
                .maybeSingle();

            if (error) {
                console.error('Error al verificar rol:', error.message);

                return res.status(500).json({
                    mensaje: 'Error al consultar los permisos'
                });
            }

            if (!usuario || !usuario.roles) {
                return res.status(403).json({
                    mensaje: 'No se encontraron los permisos del usuario'
                });
            }

            if (!rolesPermitidos.includes(usuario.roles.nombre)) {
                return res.status(403).json({
                    mensaje: 'No tienes permisos para acceder a esta función'
                });
            }

            req.usuarioSistema = usuario;
            next();

        } catch (error) {
            console.error('Error al verificar rol:', error.message);

            return res.status(500).json({
                mensaje: 'Error al verificar los permisos'
            });
        }
    };
}

function verificarActivo(req, res, next) {
    if (!req.usuarioSistema) {
        return res.status(403).json({
            mensaje: 'No se encontraron los datos del usuario'
        });
    }

    if (req.usuarioSistema.estado !== 'Activo') {
        return res.status(403).json({
            mensaje: 'Tu cuenta no está activa'
        });
    }

    next();
}

module.exports = {
    verificarRol,
    verificarActivo
};
