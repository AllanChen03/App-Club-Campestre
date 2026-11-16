require('dotenv').config(); 

const express = require('express');
const cors = require('cors');

// Importar rutas existentes
const authRoutes = require('./src/routes/authRoutes');
const usuariosRoutes = require('./src/routes/usuariosRoutes');

// Importar tus rutas nuevas del módulo financiero y notificaciones
const finanzasRoutes = require('./src/routes/finanzasRoutes');
const notificacionesRoutes = require('./src/routes/notificacionesRoutes');

// Módulo de reservas, instalaciones e invitados
const instalacionesRoutes = require('./src/routes/instalacionesRoutes');
const reservasRoutes = require('./src/routes/reservasRoutes');
const invitadosRoutes = require('./src/routes/invitadosRoutes');

const app = express();

// Acepta el frontend configurado y, en desarrollo, cualquier dirección local
// (localhost, 127.0.0.1 o *.localhost) para poder abrir una sesión por rol.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ORIGEN_LOCAL = /^http:\/\/(([a-z0-9-]+\.)*localhost|127\.0\.0\.1|\[::1\]):\d+$/i;

app.use(cors({
    origin(origen, responder) {
        responder(null, !origen || origen === FRONTEND_URL || ORIGEN_LOCAL.test(origen));
    }
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        mensaje: 'API del Club Valle Alto funcionando'
    });
});

// Registrar rutas en la aplicación
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/finanzas', finanzasRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/instalaciones', instalacionesRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/invitados', invitadosRoutes);

module.exports = app;