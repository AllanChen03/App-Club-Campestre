
const express = require('express');

const {
    registro,
    login,
    obtenerPerfil
} = require('../controllers/authController');

const { verificarToken } =
    require('../middlewares/verificarToken');

const router = express.Router();

router.post('/registro', registro);
router.post('/login', login);
router.get('/perfil', verificarToken, obtenerPerfil);


router.get('/protegida', verificarToken, (req, res) => {
    return res.status(200).json({
        mensaje: 'Acceso autorizado',
        id_usuario: req.usuarioAuth.id,
        correo: req.usuarioAuth.email
    });
});

module.exports = router;
