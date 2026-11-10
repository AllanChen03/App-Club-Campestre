import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Campo from '../components/Campo';
import Alerta from '../components/Alerta';
import { authApi } from '../api/auth';
import { colones } from '../utils/formato';

const INICIAL = {
  nombre_completo: '',
  cedula: '',
  correo: '',
  telefono: '',
  fecha_nacimiento: '',
  direccion: '',
  contrasena: '',
  confirmar: '',
  id_tipo_membresia: ''
};

// "+506 8888 8888" -> "88888888"
function normalizarTelefono(valor) {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 11 && digitos.startsWith('506') ? digitos.slice(3) : digitos;
}

// "dd/mm/aaaa" -> "aaaa-mm-dd" (o null si no es una fecha válida)
function convertirFecha(valor) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  if (!m) return null;
  const [, d, mes, a] = m;
  const iso = `${a}-${mes}-${d}`;
  const fecha = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== iso) return null;
  if (fecha > new Date()) return null;
  return iso;
}

// Agrega las barras mientras se escribe la fecha
function formatearFecha(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function validar(f) {
  const e = {};
  if (!f.nombre_completo.trim()) e.nombre_completo = 'Ingrese su nombre completo';
  if (!f.cedula.trim()) e.cedula = 'Ingrese su cédula';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.trim())) e.correo = 'Ingrese un correo válido';
  if (!/^\d{8}$/.test(normalizarTelefono(f.telefono))) e.telefono = 'El teléfono debe tener 8 dígitos';
  if (!convertirFecha(f.fecha_nacimiento)) e.fecha_nacimiento = 'Use el formato dd/mm/aaaa';
  if (!f.direccion.trim()) e.direccion = 'Ingrese su dirección';
  if (f.contrasena.length < 8) e.contrasena = 'Mínimo 8 caracteres';
  if (f.confirmar !== f.contrasena || !f.confirmar) e.confirmar = 'Las contraseñas no coinciden';
  if (!f.id_tipo_membresia) e.id_tipo_membresia = 'Elija un tipo de membresía';
  return e;
}

export default function Registro() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INICIAL);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [cargando, setCargando] = useState(false);
  const [tipos, setTipos] = useState([]);
  const [errorTipos, setErrorTipos] = useState('');

  // Tipos de membresía desde la base de datos
  useEffect(() => {
    authApi
      .tiposMembresia()
      .then((d) => setTipos(d.tipos))
      .catch((err) => setErrorTipos(err.message));
  }, []);

  function cambiar(campo) {
    return (e) => {
      const valor = campo === 'fecha_nacimiento' ? formatearFecha(e.target.value) : e.target.value;
      setForm((f) => ({ ...f, [campo]: valor }));
      if (errores[campo]) setErrores((er) => ({ ...er, [campo]: undefined }));
    };
  }

  async function enviar(e) {
    e.preventDefault();
    const encontrados = validar(form);
    setErrores(encontrados);
    setErrorGeneral('');
    if (Object.keys(encontrados).length > 0) return;

    setCargando(true);
    try {
      await authApi.registro({
        nombre_completo: form.nombre_completo.trim(),
        cedula: form.cedula.trim(),
        correo: form.correo.trim(),
        telefono: normalizarTelefono(form.telefono),
        fecha_nacimiento: convertirFecha(form.fecha_nacimiento),
        direccion: form.direccion.trim(),
        contrasena: form.contrasena,
        id_tipo_membresia: Number(form.id_tipo_membresia)
      });
      const tipo = tipos.find((t) => String(t.id_tipo_membresia) === form.id_tipo_membresia);
      navigate('/registro/exitoso', {
        replace: true,
        state: { correo: form.correo.trim(), tipo }
      });
    } catch (err) {
      setErrorGeneral(err.message);
    } finally {
      setCargando(false);
    }
  }

  const campo = (nombre, etiqueta, props = {}) => (
    <Campo
      etiqueta={etiqueta}
      value={form[nombre]}
      onChange={cambiar(nombre)}
      error={errores[nombre]}
      {...props}
    />
  );

  return (
    <AuthLayout>
      <form className="tarjeta tarjeta--ancha" onSubmit={enviar} noValidate>
        <h2 className="tarjeta__titulo tarjeta__titulo--espacio">Crear cuenta</h2>

        {errorGeneral && <Alerta>{errorGeneral}</Alerta>}

        <div className="rejilla">
          {campo('nombre_completo', 'Nombre completo', { placeholder: 'Daniela Rojas Solano', autoComplete: 'name' })}
          {campo('cedula', 'Cédula', { placeholder: '1-1234-0567' })}
          {campo('correo', 'Correo electrónico', { tipo: 'email', placeholder: 'nombre@correo.com', autoComplete: 'email' })}
          {campo('telefono', 'Teléfono', { tipo: 'tel', placeholder: '+506 8888 8888', autoComplete: 'tel' })}
          {campo('fecha_nacimiento', 'Fecha de nacimiento', { placeholder: 'dd/mm/aaaa', inputMode: 'numeric' })}
          {campo('direccion', 'Dirección', { placeholder: 'Provincia, cantón, distrito', autoComplete: 'street-address' })}
          {campo('contrasena', 'Contraseña', { tipo: 'password', placeholder: 'Mínimo 8 caracteres', autoComplete: 'new-password' })}
          {campo('confirmar', 'Confirmar contraseña', { tipo: 'password', placeholder: 'Repita la contraseña', autoComplete: 'new-password' })}
        </div>

        <div className={`campo ${errores.id_tipo_membresia ? 'campo--error' : ''}`}>
          <label htmlFor="tipo-membresia" className="campo__etiqueta">Tipo de membresía</label>
          <select
            id="tipo-membresia"
            className="campo__input campo__select"
            value={form.id_tipo_membresia}
            onChange={cambiar('id_tipo_membresia')}
            disabled={tipos.length === 0}
          >
            <option value="">{errorTipos ? 'No se pudieron cargar las membresías' : 'Elija una membresía'}</option>
            {tipos.map((t) => (
              <option key={t.id_tipo_membresia} value={t.id_tipo_membresia}>
                {t.nombre} · {colones(t.precio)} · hasta {t.max_invitados} invitados al mes
              </option>
            ))}
          </select>
          {errores.id_tipo_membresia && <p className="campo__mensaje">{errores.id_tipo_membresia}</p>}
        </div>

        <button type="submit" className="boton boton--primario boton--separado" disabled={cargando}>
          {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        <p className="tarjeta__pie">
          ¿Ya tiene cuenta? <Link to="/login" className="enlace enlace--subrayado">Iniciar sesión</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
