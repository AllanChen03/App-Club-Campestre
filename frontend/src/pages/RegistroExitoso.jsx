import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { colones } from '../utils/formato';

export default function RegistroExitoso() {
  const { state } = useLocation();

  // Solo se llega aquí después de registrarse
  if (!state?.correo) return <Navigate to="/registro" replace />;

  return (
    <AuthLayout>
      <div className="tarjeta">
        <h2 className="tarjeta__titulo">¡Su cuenta está lista!</h2>
        <p className="tarjeta__subtitulo">
          Registramos su cuenta con el correo <strong>{state.correo}</strong>
          {state.tipo && (
            <> y la membresía <strong>{state.tipo.nombre}</strong> ({colones(state.tipo.precio)})</>
          )}
          . Podrá iniciar sesión cuando la administración confirme el pago de su membresía.
        </p>
        <div className="acciones">
          <Link to="/login" state={{ correo: state.correo }} className="boton boton--primario">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
