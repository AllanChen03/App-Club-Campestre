
import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

router.get('/conexion', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('roles')
            .select('id_rol, nombre');

        if (error) {
            return res.status(500).json({
                mensaje: 'Error al consultar Supabase',
                error: error.message
            });
        }

        res.json({
            mensaje: 'Conexión con Supabase correcta',
            roles: data
        });

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error de conexión',
            error: error.message
        });
    }
});

export default router;
