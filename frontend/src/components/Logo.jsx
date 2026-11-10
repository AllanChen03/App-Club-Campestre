export default function Logo() {
  return (
    <span className="logo">
      <svg className="logo__icono" viewBox="0 0 44 28" aria-hidden="true">
        <path d="M0 28 14 6l14 22z" fill="#F6F3EC" />
        <path d="M16 28 31 10l13 18z" fill="#D4EF6E" />
      </svg>
      <span className="logo__texto">
        <span className="logo__club">Club</span>
        <span className="logo__nombre">Valle Alto</span>
      </span>
    </span>
  );
}
