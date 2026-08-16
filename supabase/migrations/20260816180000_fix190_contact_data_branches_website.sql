-- ============================================================
-- Fix 190: Datos de contacto reales en `branches` y `website_config`
--
-- Problema: ambas sedes y ambos sitios públicos quedaron con datos de contacto
--   placeholder de desarrollo (teléfonos `+56 42 000 000X`, correos en dominios
--   inexistentes, direcciones inventadas como 'Av. Libertad 123' y 'Maipón 999').
--   El bloque `contact` de `website_config` no es editable desde
--   `admin/configuracion-web/`, por lo que nunca pudo corregirse desde la UI.
--
-- Por qué una migración correctiva y no editar el seed:
--   Los archivos `20260301000010_09b_seed_data.sql` y `20260522000000_create_website_config.sql`
--   YA fueron aplicados. Editarlos es lo que volvió ilegible la historia del bucket
--   `documents` (creado `public=true` en 20260307/20260310, cerrado en 20260413).
--   Un entorno limpio aplica el seed y luego esta migración, terminando correcto.
--
-- Idempotente: filtra por `slug`, se puede re-ejecutar sin efecto adicional.
-- Verificación: bloque DO al final que lanza excepción si queda algún placeholder.
--
-- Datos confirmados por el dueño el 2026-08-16.
-- Origen: auditoría `.compliance/` corrida 1 · track `fix-190-m`.
-- ============================================================

-- ── 1. Sedes ────────────────────────────────────────────────────────────────
--
-- `Autoescuela Chillán`  = Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL (RUT 76.007.217-6)
-- `Conductores Chillán`  = Sociedad Comercial Chillán Capacita Limitada          (RUT 77.940.120-0)
--
-- Cada sede es un responsable de datos independiente ante la Agencia de Protección
-- de Datos Personales. La dirección y el correo de abajo son los que la política de
-- privacidad de cada sociedad declara públicamente, por lo que deben coincidir.

UPDATE public.branches
SET
  address = 'Maipón 418, Chillán',
  phone   = '+56 42 232 7800',
  email   = 'otecchillan@gmail.com'
WHERE slug = 'autoescuela-chillan';

UPDATE public.branches
SET
  address = 'Carrera 74, Chillán',
  phone   = '+56 42 224 4030',
  email   = 'conductorchillan@gmail.com'
WHERE slug = 'conductores-chillan';

-- ── 2. Bloque `contact` de los sitios públicos ──────────────────────────────
--
-- Se reemplazan solo las tres claves de contacto; el resto del JSONB (hero, faq,
-- precios, etc.) queda intacto.

UPDATE public.website_config wc
SET config = jsonb_set(
               jsonb_set(
                 jsonb_set(
                   wc.config,
                   '{contact,address}', to_jsonb('Maipón 418, Chillán'::text), true
                 ),
                 '{contact,phone}',     to_jsonb('+56 42 232 7800'::text), true
               ),
               '{contact,email}',       to_jsonb('otecchillan@gmail.com'::text), true
             )
FROM public.branches b
WHERE b.id = wc.branch_id
  AND b.slug = 'autoescuela-chillan';

UPDATE public.website_config wc
SET config = jsonb_set(
               jsonb_set(
                 jsonb_set(
                   wc.config,
                   '{contact,address}', to_jsonb('Carrera 74, Chillán'::text), true
                 ),
                 '{contact,phone}',     to_jsonb('+56 42 224 4030'::text), true
               ),
               '{contact,email}',       to_jsonb('conductorchillan@gmail.com'::text), true
             )
FROM public.branches b
WHERE b.id = wc.branch_id
  AND b.slug = 'conductores-chillan';

-- ── 3. Verificación (test de regresión de fix-190-m) ────────────────────────
--
-- El harness de tests del proyecto es unitario con mocks y no consulta la base,
-- así que la verificación vive acá: falla ruidosamente en cualquier entorno donde
-- los updates de arriba no hayan surtido efecto.

-- Se afirma en POSITIVO (los valores reales están presentes) y no solo en negativo
-- (no quedan placeholders). Motivo: `jsonb_set` sobre una ruta anidada cuyo padre no
-- existe devuelve el JSONB sin cambios, en silencio. Una comprobación que solo busque
-- placeholders daría verde ante ese no-op, porque tampoco encontraría el valor viejo.

DO $$
DECLARE
  v_bad INT;
BEGIN
  -- 3.1 `branches`: cada sede debe tener exactamente sus datos reales.
  SELECT COUNT(*) INTO v_bad
  FROM public.branches
  WHERE (slug = 'autoescuela-chillan' AND NOT (
           address = 'Maipón 418, Chillán'
       AND phone   = '+56 42 232 7800'
       AND email   = 'otecchillan@gmail.com'))
     OR (slug = 'conductores-chillan' AND NOT (
           address = 'Carrera 74, Chillán'
       AND phone   = '+56 42 224 4030'
       AND email   = 'conductorchillan@gmail.com'));

  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'fix-190: % sede(s) sin los datos de contacto reales esperados', v_bad;
  END IF;

  -- 3.2 `website_config`: el bloque `contact` de cada sitio debe coincidir con su sede.
  --     Detecta tanto el placeholder sobreviviente como el no-op de `jsonb_set`.
  SELECT COUNT(*) INTO v_bad
  FROM public.website_config wc
  JOIN public.branches b ON b.id = wc.branch_id
  WHERE b.slug IN ('autoescuela-chillan', 'conductores-chillan')
    AND NOT (
          wc.config->'contact'->>'address' = b.address
      AND wc.config->'contact'->>'phone'   = b.phone
      AND wc.config->'contact'->>'email'   = b.email
    );

  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'fix-190: % sitio(s) con bloque `contact` que no coincide con su sede', v_bad;
  END IF;

  RAISE NOTICE 'fix-190: datos de contacto verificados en branches y website_config';
END $$;
