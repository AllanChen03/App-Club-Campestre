-- =====================================================================
-- Módulo de Reservas e instalaciones (Integrante 3)
-- Cambios aprobados por el equipo el 14/11/2026.
-- Detalle y justificación: https://claude.ai/artifact/BBpvsJ9HVdMwXg1dVks4UU
--
-- Correr una sola vez en el SQL Editor de Supabase.
-- Todo va dentro de una transacción: si algo falla, no se aplica nada.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Visitas de invitados: instalación opcional
--    Una visita puede no estar ligada a una reserva ni a una instalación.
-- ---------------------------------------------------------------------
ALTER TABLE public.visitas_invitados
  ADD COLUMN id_instalacion integer
    REFERENCES public.instalaciones (id_instalacion);

-- ---------------------------------------------------------------------
-- 2. Máximo de personas por reserva, por instalación
--    Se mantiene 12 como regla general y el salón es la excepción (40).
--    El límite pasa de un CHECK fijo en reservas a una columna en
--    instalaciones, validada con un trigger.
-- ---------------------------------------------------------------------
ALTER TABLE public.instalaciones
  ADD COLUMN max_personas_reserva integer NOT NULL DEFAULT 12
    CHECK (max_personas_reserva > 0);

-- Quitar el CHECK actual (1 a 12) sin depender de su nombre
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.reservas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%cantidad_personas%'
  LOOP
    EXECUTE format('ALTER TABLE public.reservas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_cantidad_personas_check CHECK (cantidad_personas >= 1);

CREATE OR REPLACE FUNCTION public.validar_personas_reserva()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_max integer;
BEGIN
  SELECT max_personas_reserva INTO v_max
  FROM public.instalaciones
  WHERE id_instalacion = NEW.id_instalacion;

  IF NEW.cantidad_personas > v_max THEN
    RAISE EXCEPTION 'Esta instalación admite como máximo % personas por reserva', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_validar_personas_reserva
  BEFORE INSERT OR UPDATE OF cantidad_personas, id_instalacion
  ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_personas_reserva();

-- ---------------------------------------------------------------------
-- 3. Las reservas nuevas empiezan como Pendiente
-- ---------------------------------------------------------------------
ALTER TABLE public.reservas
  ALTER COLUMN estado SET DEFAULT 'Pendiente';

-- ---------------------------------------------------------------------
-- 4. Historial de cambios de estado de cada reserva (pantalla S4)
-- ---------------------------------------------------------------------
CREATE TABLE public.historial_reservas (
  id_historial    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_reserva      integer NOT NULL REFERENCES public.reservas (id_reserva),
  estado_anterior character varying
    CHECK (estado_anterior IN ('Pendiente', 'Confirmada', 'Cancelada', 'Finalizada')),
  estado_nuevo    character varying NOT NULL
    CHECK (estado_nuevo IN ('Pendiente', 'Confirmada', 'Cancelada', 'Finalizada')),
  id_usuario      uuid REFERENCES public.usuarios (id_usuario),  -- quién hizo el cambio
  motivo          character varying,
  fecha           timestamp with time zone NOT NULL DEFAULT now()
);

-- El backend usa la service_role, que no pasa por RLS.
-- Activarlo evita que alguien lea la tabla con la clave pública.
ALTER TABLE public.historial_reservas ENABLE ROW LEVEL SECURITY;

-- Registro inicial para las reservas que ya existen
INSERT INTO public.historial_reservas (id_reserva, estado_anterior, estado_nuevo, motivo, fecha)
SELECT id_reserva, NULL, estado, 'Registro inicial', fecha_creacion
FROM public.reservas;

-- ---------------------------------------------------------------------
-- 5. Cargos ligados a una reserva (servicios adicionales)
--    Opcional: los cargos de membresía siguen sin reserva.
-- ---------------------------------------------------------------------
ALTER TABLE public.cargos
  ADD COLUMN id_reserva integer
    REFERENCES public.reservas (id_reserva);

-- ---------------------------------------------------------------------
-- 6. Bloqueos en hora local de Costa Rica, sin zona horaria
--    Igual que reservas (fecha + hora local). La tabla está vacía.
-- ---------------------------------------------------------------------
ALTER TABLE public.bloqueos_instalaciones
  ALTER COLUMN fecha_inicio TYPE timestamp without time zone
    USING fecha_inicio AT TIME ZONE 'America/Costa_Rica',
  ALTER COLUMN fecha_fin TYPE timestamp without time zone
    USING fecha_fin AT TIME ZONE 'America/Costa_Rica';

ALTER TABLE public.bloqueos_instalaciones
  ADD CONSTRAINT bloqueos_fechas_check CHECK (fecha_fin > fecha_inicio);

-- ---------------------------------------------------------------------
-- 7. Datos de instalaciones
-- ---------------------------------------------------------------------
UPDATE public.instalaciones
SET tipo_reserva = 'Exclusiva', max_personas_reserva = 40
WHERE id_instalacion = 4;  -- Salón de Eventos

UPDATE public.instalaciones
SET duracion_reserva = 120
WHERE id_instalacion = 1;  -- Cancha de tenis: turnos de 2 horas

UPDATE public.instalaciones
SET hora_apertura = '06:00'
WHERE id_instalacion = 2;  -- Campo de golf: 6:00–18:00, 4 turnos de 3 horas

-- ---------------------------------------------------------------------
-- 8. Reservas de prueba ajustadas a los turnos nuevos (mismo día)
-- ---------------------------------------------------------------------
UPDATE public.reservas SET hora_inicio = '09:00', hora_fin = '12:00' WHERE id_reserva = 2;  -- Golf
UPDATE public.reservas SET hora_inicio = '08:00', hora_fin = '10:00' WHERE id_reserva = 3;  -- Tenis
UPDATE public.reservas SET hora_inicio = '08:00', hora_fin = '12:00' WHERE id_reserva = 4;  -- Piscina
UPDATE public.reservas SET hora_inicio = '10:00', hora_fin = '12:00' WHERE id_reserva = 5;  -- Tenis

-- La hora de fin siempre después de la de inicio
ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_horas_check CHECK (hora_fin > hora_inicio);

-- ---------------------------------------------------------------------
-- 9. Índices para las consultas más frecuentes
-- ---------------------------------------------------------------------
CREATE INDEX idx_reservas_instalacion_fecha ON public.reservas (id_instalacion, fecha_reserva);
CREATE INDEX idx_reservas_socio ON public.reservas (id_socio);
CREATE INDEX idx_bloqueos_instalacion_fechas ON public.bloqueos_instalaciones (id_instalacion, fecha_inicio, fecha_fin);
CREATE INDEX idx_visitas_fecha ON public.visitas_invitados (fecha_visita);
CREATE INDEX idx_historial_reserva ON public.historial_reservas (id_reserva);
CREATE INDEX idx_cargos_reserva ON public.cargos (id_reserva);

COMMIT;
