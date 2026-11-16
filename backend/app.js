
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
<<<<<<< Updated upstream
=======
const usuariosRoutes = require('./src/routes/usuariosRoutes');
const membresiasRoutes = require('./src/routes/membresiasRoutes');
>>>>>>> Stashed changes

const usuariosRoutes = require('./src/routes/usuariosRoutes');

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        mensaje: 'API del Club Valle Alto funcionando'
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
<<<<<<< Updated upstream
=======
app.use('/api/membresias', membresiasRoutes);
app.use('/api/finanzas', finanzasRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
>>>>>>> Stashed changes

module.exports = app;
