
const express = require('express');

const {
    registro,
    login,
    refrescar,
    obtenerPerfil,
    actualizarPerfil,
    cerrarSesion,
    solicitarRecuperacion,
    restablecer,
    tiposMembresia
} = require('../controllers/authController');

const { verificarToken } =
    require('../middlewares/verificarToken');

const { verificarRol, verificarActivo } =
    require('../middlewares/verificarPermisos');

const { ROLES_ADMIN, ROL_SOCIO } = require('../utils/roles');

const router = express.Router();

router.post('/registro', registro);

router.post('/login', login);

router.get(
    '/perfil',
    verificarToken,
    verificarRol(...ROLES_ADMIN, ROL_SOCIO),
    verificarActivo,
    obtenerPerfil
);

router.patch(
    '/perfil',
    verificarToken,
    verificarRol(...ROLES_ADMIN, ROL_SOCIO),
    verificarActivo,
    actualizarPerfil
);

router.post(
    '/logout',
    verificarToken,
    cerrarSesion
);

router.post(
    '/recuperar-contrasena',
    solicitarRecuperacion
);

router.post('/restablecer-contrasena', restablecer);

router.post('/refrescar', refrescar);

router.get('/tipos-membresia', tiposMembresia);

router.get(
    '/protegida',
    verificarToken,
    verificarRol('Administrador', 'Socio'),
    verificarActivo,
    (req, res) => {
        return res.status(200).json({
            mensaje: 'Acceso autorizado',
            id_usuario: req.usuarioAuth.id,
            correo: req.usuarioAuth.email
        });
    }
);

router.get(
    '/admin',
    verificarToken,
    verificarRol('Administrador'),
    verificarActivo,
    (req, res) => {
        return res.status(200).json({
            mensaje: 'Bienvenido al área de administración'
        });
    }
);

router.get(
    '/socio',
    verificarToken,
    verificarRol('Socio'),
    verificarActivo,
    (req, res) => {
        return res.status(200).json({
            mensaje: 'Bienvenido al área de socios'
        });
    }
);

module.exports = router;
