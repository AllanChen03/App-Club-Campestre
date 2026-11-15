import { Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Registro from './pages/Registro';
import RegistroExitoso from './pages/RegistroExitoso';
import RecuperarContrasena from './pages/RecuperarContrasena';
import RestablecerContrasena from './pages/RestablecerContrasena';
import Inicio from './pages/Inicio';
import Perfil from './pages/Perfil';
import Proximamente from './pages/Proximamente';
import PanelAdmin from './pages/admin/PanelAdmin';
import Usuarios from './pages/admin/Usuarios';
import Notificaciones from './components/Notificaciones';
import Cobros from './components/Cobros';
import RutaProtegida from './components/RutaProtegida';
import InicioSegunRol from './components/InicioSegunRol';
import AppLayout from './components/AppLayout';
import AdminLayout from './components/AdminLayout';
import { ROLES_ADMIN, ROL_SOCIO, rolesDeSeccion } from './utils/roles';
import EstadoCuenta from './components/EstadoCuenta';
import { leerSesion } from './api/cliente';

const pendiente = (titulo, volver) => <Proximamente titulo={titulo} volver={volver} />;

const VistaEstadoCuenta = () => {
  const sesion = leerSesion();
  const idSocio = sesion?.usuario?.id_socio || sesion?.id_socio || 1; 
  return <EstadoCuenta idSocio={idSocio} />;
};

export default function App() {
  return (
    <Routes>
      {/* Pantallas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/registro/exitoso" element={<RegistroExitoso />} />
      <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
      <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />

      {/* Socios */}
      <Route element={<RutaProtegida roles={[ROL_SOCIO]} />}>
        <Route element={<AppLayout />}>
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/reservas" element={pendiente('Reservas')} />
          <Route path="/invitados" element={pendiente('Invitados')} />
          <Route path="/membresia" element={pendiente('Membresía')} />
          <Route path="/estado-cuenta" element={<VistaEstadoCuenta />} />
        </Route>
      </Route>

      {/* Administradores */}
      <Route path="/admin" element={<RutaProtegida roles={ROLES_ADMIN} />}>
        <Route element={<AdminLayout />}>
          <Route index element={<PanelAdmin />} />
          <Route path="perfil" element={<Perfil />} />
          <Route element={<RutaProtegida roles={rolesDeSeccion('socios')} />}>
            <Route
              path="socios"
              element={<Usuarios key="socios" roles={[ROL_SOCIO]} titulo="Socios" descripcion="Consulte, edite y cambie el estado de las cuentas de socios." />}
            />
          </Route>
          <Route element={<RutaProtegida roles={rolesDeSeccion('administradores')} />}>
            <Route
              path="administradores"
              element={<Usuarios key="admins" roles={ROLES_ADMIN} titulo="Administradores" descripcion="Cuentas con acceso al panel de administración." />}
            />
          </Route>

          {/* Módulos restantes con "Próximamente" */}
          {[
            ['membresias', 'Membresías'],
            ['instalaciones', 'Instalaciones'],
            ['invitados', 'Invitados del día']
          ].map(([ruta, titulo]) => (
            <Route key={ruta} element={<RutaProtegida roles={rolesDeSeccion(ruta)} />}>
              <Route path={ruta} element={pendiente(titulo, '/admin')} />
            </Route>
          ))}

          {/* Módulo de Cobros conectado al componente real */}
          <Route element={<RutaProtegida roles={rolesDeSeccion('cobros')} />}>
            <Route path="cobros" element={<Cobros />} />
          </Route>

          {/* 2. Ruta específica de Notificaciones conectada al componente real */}
          <Route element={<RutaProtegida roles={rolesDeSeccion('notificaciones')} />}>
            <Route path="notificaciones" element={<Notificaciones />} />
          </Route>

        </Route>
      </Route>

      <Route path="*" element={<InicioSegunRol />} />
    </Routes>
  );
}