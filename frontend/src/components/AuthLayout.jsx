import Logo from './Logo';

const AREAS = [
  { nombre: 'Golf', color: 'var(--golf)' },
  { nombre: 'Tenis', color: 'var(--tenis)' },
  { nombre: 'Piscina', color: 'var(--piscina)' },
  { nombre: 'Salón', color: 'var(--salon)' }
];

// Plantilla de dos columnas usada por login, registro y recuperación
export default function AuthLayout({ children, pie }) {
  return (
    <div className="auth">
      <aside className="auth__panel">
        <Logo />

        <div className="auth__mensaje">
          <h1 className="auth__titular">
            Su club,
            <br />
            <em>a un clic.</em>
          </h1>
          <p className="auth__texto">
            Reserve canchas, registre invitados y revise su estado de cuenta desde un solo lugar.
          </p>
          <ul className="auth__areas">
            {AREAS.map((a) => (
              <li key={a.nombre} className="pildora">
                <span className="pildora__punto" style={{ background: a.color }} />
                {a.nombre}
              </li>
            ))}
          </ul>
        </div>

        <span className="auth__sol" aria-hidden="true" />
        <svg className="auth__montanas" viewBox="0 0 640 270" preserveAspectRatio="none" aria-hidden="true">
          <path d="M290 270 444 0l196 270z" fill="#2B5E49" />
          <path d="M0 270 230 40l180 230z" fill="#15372B" />
          <path d="M370 270 505 100l135 170z" fill="#173E30" />
        </svg>
      </aside>

      <main className="auth__contenido">
        <div className="auth__centro">{children}</div>
        {pie}
      </main>
    </div>
  );
}
