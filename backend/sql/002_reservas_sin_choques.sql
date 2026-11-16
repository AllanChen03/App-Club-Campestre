-- =====================================================================
-- Módulo de Reservas: la base impide reservas que choquen
--
-- El backend ya revisa la disponibilidad antes de guardar, pero si dos
-- socios reservan el mismo turno en el mismo instante, las dos revisiones
-- pueden pasar a la vez. Este trigger hace la revisión dentro de la base:
-- las reservas de una misma instalación y día se guardan de una en una,
-- y la segunda se rechaza si ya no cabe.
--
-- - Exclusiva: no puede haber dos reservas activas que se crucen.
-- - Por capacidad: en cada hora, la suma de personas no pasa la capacidad.
-- Solo cuentan las reservas Pendiente y Confirmada.
--
-- Correr una sola vez en el SQL Editor de Supabase.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.validar_choque_reserva()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tipo      character varying;
  v_capacidad integer;
  v_hora      time;
  v_personas  integer;
BEGIN
  -- Solo importa si la reserva queda activa
  IF NEW.estado NOT IN ('Pendiente', 'Confirmada') THEN
    RETURN NEW;
  END IF;

  -- En una actualización, solo se revisa si cambió algo que afecte el espacio
  IF TG_OP = 'UPDATE'
     AND OLD.estado IN ('Pendiente', 'Confirmada')
     AND NEW.id_instalacion = OLD.id_instalacion
     AND NEW.fecha_reserva = OLD.fecha_reserva
     AND NEW.hora_inicio = OLD.hora_inicio
     AND NEW.hora_fin = OLD.hora_fin
     AND NEW.cantidad_personas <= OLD.cantidad_personas THEN
    RETURN NEW;
  END IF;

  -- Una reserva a la vez por instalación y día (se libera al terminar la transacción)
  PERFORM pg_advisory_xact_lock(NEW.id_instalacion, (NEW.fecha_reserva - DATE '2000-01-01'));

  SELECT tipo_reserva, capacidad INTO v_tipo, v_capacidad
  FROM public.instalaciones
  WHERE id_instalacion = NEW.id_instalacion;

  IF v_tipo = 'Exclusiva' THEN
    IF EXISTS (
      SELECT 1 FROM public.reservas r
      WHERE r.id_instalacion = NEW.id_instalacion
        AND r.fecha_reserva = NEW.fecha_reserva
        AND r.estado IN ('Pendiente', 'Confirmada')
        AND r.id_reserva IS DISTINCT FROM NEW.id_reserva
        AND r.hora_inicio < NEW.hora_fin
        AND r.hora_fin > NEW.hora_inicio
    ) THEN
      RAISE EXCEPTION 'Ese horario acaba de ser reservado por otra persona. Elija otro turno'
        USING ERRCODE = 'exclusion_violation';
    END IF;
  ELSE
    -- Por capacidad: se revisa cada hora de la reserva
    v_hora := NEW.hora_inicio;
    WHILE v_hora < NEW.hora_fin LOOP
      SELECT COALESCE(SUM(r.cantidad_personas), 0) INTO v_personas
      FROM public.reservas r
      WHERE r.id_instalacion = NEW.id_instalacion
        AND r.fecha_reserva = NEW.fecha_reserva
        AND r.estado IN ('Pendiente', 'Confirmada')
        AND r.id_reserva IS DISTINCT FROM NEW.id_reserva
        AND r.hora_inicio < v_hora + INTERVAL '1 hour'
        AND r.hora_fin > v_hora;

      IF v_personas + NEW.cantidad_personas > v_capacidad THEN
        RAISE EXCEPTION 'Ya no hay espacio para % personas en ese horario: quedan %',
          NEW.cantidad_personas, GREATEST(v_capacidad - v_personas, 0)
          USING ERRCODE = 'exclusion_violation';
      END IF;

      v_hora := v_hora + INTERVAL '1 hour';
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_validar_choque_reserva
  BEFORE INSERT OR UPDATE OF id_instalacion, fecha_reserva, hora_inicio, hora_fin, cantidad_personas, estado
  ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_choque_reserva();

COMMIT;
