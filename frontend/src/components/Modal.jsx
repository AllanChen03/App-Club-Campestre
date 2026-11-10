import { useEffect, useRef } from 'react';

// Ventana modal: se cierra con Escape o clic en el fondo
export default function Modal({ titulo, onCerrar, children, lateral = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const anterior = document.activeElement;
    ref.current?.focus();
    const teclado = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', teclado);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', teclado);
      document.body.style.overflow = '';
      anterior?.focus?.();
    };
  }, [onCerrar]);

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        ref={ref}
        className={`modal ${lateral ? 'modal--lateral' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
      >
        <button type="button" className="modal__cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        {children}
      </div>
    </div>
  );
}
