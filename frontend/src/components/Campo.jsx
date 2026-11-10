import { useId, useState } from 'react';

// Campo de formulario con etiqueta, error y opción "Mostrar" para contraseñas
export default function Campo({ etiqueta, error, tipo = 'text', ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const esContrasena = tipo === 'password';

  return (
    <div className={`campo ${error ? 'campo--error' : ''}`}>
      <label htmlFor={id} className="campo__etiqueta">{etiqueta}</label>
      <div className="campo__control">
        <input
          id={id}
          type={esContrasena && visible ? 'text' : tipo}
          className="campo__input"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {esContrasena && (
          <button type="button" className="campo__mostrar" onClick={() => setVisible((v) => !v)}>
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {error?.trim() && <p id={`${id}-error`} className="campo__mensaje">{error}</p>}
    </div>
  );
}
