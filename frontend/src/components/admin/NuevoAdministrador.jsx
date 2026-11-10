import { useEffect, useState } from 'react';
import Modal from '../Modal';
import Campo from '../Campo';
import Alerta from '../Alerta';
import { usuariosApi } from '../../api/usuarios';
import { REGEX_CORREO } from '../../utils/formato';
import { nombreRol } from '../../utils/roles';

const INICIAL = {
  nombre_completo: '',
  cedula: '',
  correo: '',
  telefono: '',
  fecha_nacimiento: '',
  direccion: '',
  contrasena: '',
  confirmar: '',
  id_rol: ''
};

function validar(f) {
  const e = {};
  if (!f.nombre_completo.trim()) e.nombre_completo = 'Ingrese el nombre completo';
  if (!f.cedula.trim()) e.cedula = 'Ingrese la cédula';
  if (!REGEX_CORREO.test(f.correo.trim())) e.correo = 'Ingrese un correo válido';
  if (!/^\d{8}$/.test(f.telefono.trim())) e.telefono = 'Debe tener 8 dígitos';
  if (!f.fecha_nacimiento) e.fecha_nacimiento = 'Ingrese la fecha';
  if (!f.direccion.trim()) e.direccion = 'Ingrese la dirección';
  if (f.contrasena.length < 8) e.contrasena = 'Mínimo 8 caracteres';
  if (f.confirmar !== f.contrasena || !f.confirmar) e.confirmar = 'Las contraseñas no coinciden';
  if (!f.id_rol) e.id_rol = 'Elija un rol';
  return e;
}

export default function NuevoAdministrador({ onCerrar, onCreado }) {
  const [form, setForm] = useState(INICIAL);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [roles, setRoles] = useState([]);

  // Roles administrativos registrados en la base de datos
  useEffect(() => {
    usuariosApi
      .roles()
      .then((d) => setRoles(d.roles))
      .catch((err) => setError(err.message));
  }, []);

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setErrores((er) => ({ ...er, [campo]: undefined }));
  };

  async function enviar(e) {
    e.preventDefault();
    const encontrados = validar(form);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;

    setGuardando(true);
    setError('');
    try {
      const { confirmar, ...datos } = form;
      const { usuario } = await usuariosApi.crearAdministrador({
        ...datos,
        id_rol: Number(datos.id_rol),
        nombre_completo: datos.nombre_completo.trim(),
        cedula: datos.cedula.trim(),
        correo: datos.correo.trim(),
        telefono: datos.telefono.trim(),
        direccion: datos.direccion.trim()
      });
      onCreado(usuario);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nuevo administrador" onCerrar={onCerrar}>
      <form onSubmit={enviar} noValidate>
        <h2 className="tarjeta__titulo tarjeta__titulo--espacio">Nuevo administrador</h2>
        {error && <Alerta>{error}</Alerta>}
        <div className="rejilla">
          <Campo etiqueta="Nombre completo" value={form.nombre_completo} onChange={cambiar('nombre_completo')} error={errores.nombre_completo} />
          <Campo etiqueta="Cédula" value={form.cedula} onChange={cambiar('cedula')} error={errores.cedula} />
          <Campo etiqueta="Correo electrónico" tipo="email" value={form.correo} onChange={cambiar('correo')} error={errores.correo} autoComplete="off" />
          <Campo etiqueta="Teléfono" tipo="tel" inputMode="numeric" maxLength={8} value={form.telefono} onChange={cambiar('telefono')} error={errores.telefono} />
          <Campo etiqueta="Fecha de nacimiento" tipo="date" value={form.fecha_nacimiento} onChange={cambiar('fecha_nacimiento')} error={errores.fecha_nacimiento} />
          <Campo etiqueta="Dirección" value={form.direccion} onChange={cambiar('direccion')} error={errores.direccion} />
          <Campo etiqueta="Contraseña inicial" tipo="password" value={form.contrasena} onChange={cambiar('contrasena')} error={errores.contrasena} autoComplete="new-password" />
          <Campo etiqueta="Confirmar contraseña" tipo="password" value={form.confirmar} onChange={cambiar('confirmar')} error={errores.confirmar} autoComplete="new-password" />
        </div>
        <div className={`campo ${errores.id_rol ? 'campo--error' : ''}`}>
          <label htmlFor="rol-admin" className="campo__etiqueta">Rol asignado</label>
          <select
            id="rol-admin"
            className="campo__input campo__select"
            value={form.id_rol}
            onChange={cambiar('id_rol')}
            disabled={roles.length === 0}
          >
            <option value="">Elija un rol</option>
            {roles.map((r) => (
              <option key={r.id_rol} value={r.id_rol}>{nombreRol(r.nombre)}</option>
            ))}
          </select>
          {errores.id_rol && <p className="campo__mensaje">{errores.id_rol}</p>}
        </div>
        <p className="caja__nota">
          Comparta la contraseña inicial con la persona; podrá cambiarla con "¿Olvidó su contraseña?".
        </p>
        <button type="submit" className="boton boton--primario boton--separado" disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear administrador'}
        </button>
      </form>
    </Modal>
  );
}
