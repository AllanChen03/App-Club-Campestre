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
import RutaProtegida from './components/RutaProtegida';
import InicioSegunRol from './components/InicioSegunRol';
import AppLayout from './components/AppLayout';
import AdminLayout from './components/AdminLayout';
import { ROLES_ADMIN, ROL_SOCIO, rolesDeSeccion } from './utils/roles';
<<<<<<< Updated upstream
=======
import EstadoCuenta from './components/EstadoCuenta';
import { leerSesion } from './api/cliente';
import MiMembresia from './pages/MiMembresia';
import MembresiasAdmin from './pages/admin/MembresiasAdmin';
>>>>>>> Stashed changes

// Secciones que corresponden a los módulos de otros integrantes
const pendiente = (titulo, volver) => <Proximamente titulo={titulo} volver={volver} />;

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
<<<<<<< Updated upstream
          <Route path="/membresia" element={pendiente('Membresía')} />
          <Route path="/estado-cuenta" element={pendiente('Estado de cuenta')} />
=======
          <Route path="/membresia" element={<MiMembresia />} />
          <Route path="/estado-cuenta" element={<VistaEstadoCuenta />} />
>>>>>>> Stashed changes
        </Route>
      </Route>

      {/* Administradores: cada sección solo para los roles de utils/roles.js */}
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
          {[
            ['instalaciones', 'Instalaciones'],
            ['invitados', 'Invitados del día'],
            ['cobros', 'Cobros'],
            ['notificaciones', 'Notificaciones']
          ].map(([ruta, titulo]) => (
            <Route key={ruta} element={<RutaProtegida roles={rolesDeSeccion(ruta)} />}>
              <Route path={ruta} element={pendiente(titulo, '/admin')} />
            </Route>
          ))}
<<<<<<< Updated upstream
=======

          <Route element={<RutaProtegida roles={rolesDeSeccion('membresias')} />}>
           <Route path="membresias" element={<MembresiasAdmin />} />
          </Route>

          {/* Módulo de Cobros conectado al componente real */}
          <Route element={<RutaProtegida roles={rolesDeSeccion('cobros')} />}>
            <Route path="cobros" element={<Cobros />} />
          </Route>

          {/* 2. Ruta específica de Notificaciones conectada al componente real */}
          <Route element={<RutaProtegida roles={rolesDeSeccion('notificaciones')} />}>
            <Route path="notificaciones" element={<Notificaciones />} />
          </Route>

>>>>>>> Stashed changes
        </Route>
      </Route>

      <Route path="*" element={<InicioSegunRol />} />
    </Routes>
  );
}
