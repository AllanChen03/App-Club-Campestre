// Nombres de los roles tal como están en la tabla "roles" de Supabase
export const ROL_GENERAL = 'Administrador';
export const ROL_INSTALACIONES = 'Encargado de instalaciones';
export const ROL_COBROS = 'Encargado de cobros';
export const ROL_SOCIO = 'Socio';

export const ROLES_ADMIN = [ROL_GENERAL, ROL_INSTALACIONES, ROL_COBROS];

// Nombre que se muestra en pantalla
export const NOMBRE_ROL = { [ROL_GENERAL]: 'Administrador general' };
export const nombreRol = (rol) => NOMBRE_ROL[rol] ?? rol;

// Secciones del panel y qué roles pueden entrar a cada una.
// Para cambiar los permisos, edite solo esta lista.
export const SECCIONES_ADMIN = [
  { ruta: '', texto: 'Panel', roles: ROLES_ADMIN },
  { ruta: 'socios', texto: 'Socios', roles: ROLES_ADMIN },
  { ruta: 'membresias', texto: 'Membresías', roles: [ROL_GENERAL, ROL_COBROS] },
  { ruta: 'instalaciones', texto: 'Instalaciones', roles: [ROL_GENERAL, ROL_INSTALACIONES] },
  { ruta: 'invitados', texto: 'Invitados del día', roles: [ROL_GENERAL, ROL_INSTALACIONES] },
  { ruta: 'cobros', texto: 'Cobros', roles: [ROL_GENERAL, ROL_COBROS] },
  { ruta: 'notificaciones', texto: 'Notificaciones', roles: [ROL_GENERAL] },
  { ruta: 'administradores', texto: 'Administradores', roles: [ROL_GENERAL] }
];

export const rolesDeSeccion = (ruta) => SECCIONES_ADMIN.find((s) => s.ruta === ruta)?.roles ?? [ROL_GENERAL];
