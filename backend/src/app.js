
import express from 'express';
import cors from 'cors';
import pruebaRoutes from './routes/prueba.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        mensaje: 'API del Club Valle Alto funcionando'
    });
});

app.use('/api/prueba', pruebaRoutes);

export default app;
