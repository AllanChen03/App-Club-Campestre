import { useEffect, useState } from 'react';

// Número entero que deja escribir libremente y lo ajusta al rango al salir del campo.
// Mientras se escribe, avisa el valor solo si ya está dentro del rango.
export default function CampoNumero({ valor, min = 1, max, onCambiar, className = 'campo__input', ...props }) {
  const [texto, setTexto] = useState(String(valor));

  // Si el valor cambia desde afuera (por ejemplo, otro máximo), se refleja aquí
  useEffect(() => { setTexto(String(valor)); }, [valor]);

  function cambiar(e) {
    const limpio = e.target.value.replace(/\D/g, '').slice(0, 4);
    setTexto(limpio);
    const n = Number(limpio);
    if (limpio !== '' && n >= min && (max === undefined || n <= max)) onCambiar(n);
  }

  function ajustar() {
    const n = Number(texto);
    const final = !texto || n < min ? min : max !== undefined && n > max ? max : n;
    setTexto(String(final));
    if (final !== valor) onCambiar(final);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className={className}
      value={texto}
      onChange={cambiar}
      onBlur={ajustar}
      onKeyDown={(e) => e.key === 'Enter' && ajustar()}
      {...props}
    />
  );
}
