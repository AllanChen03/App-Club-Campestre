
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !publishableKey || !secretKey) {
    throw new Error('Faltan las credenciales de Supabase');
}

// Cliente público
export const supabase = createClient(
    supabaseUrl,
    publishableKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

// Cliente administrativo
export const supabaseAdmin = createClient(
    supabaseUrl,
    secretKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);
