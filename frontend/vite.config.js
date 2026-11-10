import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// PUERTO y API_URL se pueden definir en frontend/.env (opcional).
// El puerto del frontend debe coincidir con FRONTEND_URL del backend.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: Number(env.PUERTO) || 5173,
      strictPort: true,
      proxy: {
        '/api': env.API_URL || 'http://localhost:3000'
      }
    }
  };
});
