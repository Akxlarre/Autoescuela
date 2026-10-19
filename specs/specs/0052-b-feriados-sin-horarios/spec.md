# Spec 0052-b — Los feriados no ofrecen horarios de clase

> **Status:** done (2026-10-19; ver acceptance.md)
> **Created:** 2026-10-19
> **Owner:** Benjamín
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** `ASG-i-026` (checklist 026, caso B15 / M09). **Decisiones del owner (2026-10-19):**

1. Un feriado no ofrece horarios de Clase B (Agenda, matrícula presencial y online, reagendar).
2. La lista de feriados se mantiene sola: una tarea mensual trae los del año actual y el siguiente.
3. El **20 de agosto** (natalicio de Bernardo O'Higgins, feriado solo en Chillán y Chillán Viejo)
   también cuenta: las dos sedes están en Chillán.

### Cómo está hoy

- Los feriados **no están en la BD**. Solo las promociones de Clase Profesional los consultan, en el
  navegador, a la API oficial (`apis.digital.gob.cl`) con dos respaldos (`api.boostr.cl`,
  `date.nager.at`).
- `v_class_b_schedule_availability` genera bloques todos los días hábiles del curso, feriados
  incluidos.
- Ninguna de las tres fuentes trae el 20 de agosto de Chillán (es regional por comuna).

## 2. Acceptance Criteria

- **AC1** — Existe `public.holidays` (fecha, nombre, alcance `national` / `local`, fuente). Admin y
  secretarias la pueden leer; nadie la escribe desde la app.
- **AC2** — La Edge Function `sync-holidays` trae los feriados nacionales del año actual y el
  siguiente (oficial → boostr → nager, el primero que responda con datos de ese año) y agrega el
  20 de agosto de Chillán como `local`. Es idempotente (correrla dos veces no duplica).
- **AC3** — Un cron mensual la ejecuta. Se corre una vez al desplegar.
- **AC4** — `v_class_b_schedule_availability` no genera bloques en una fecha de `holidays`.
- **AC5** — Admin y secretarias siguen leyendo la vista sin error (regla de fix-226-b: GRANT y test
  impersonando).
- **AC-E1** — Si ninguna fuente responde, la función no borra nada y avisa en el log; los feriados
  ya cargados siguen valiendo.

## 3. Fuera de alcance

- Clases ya agendadas en un feriado (no se tocan; hoy no hay).
- Editar feriados desde Ajustes.
- Clase Profesional / promociones (siguen con su consulta actual).

## 4. Nota para el futuro (feriados regionales)

Los feriados regionales dependen de la **comuna** de cada sede, y las APIs nacionales no los traen
(o los marcan como no globales). Hoy se agrega a mano en `sync-holidays` solo el 20 de agosto de
Chillán y Chillán Viejo, porque las dos sedes están ahí. **Si se abre una sede en otra comuna**, hay
que revisar sus feriados locales y pasar `holidays` a tener alcance por sede (`branch_id`), en vez
de valer para todas.

## Progreso

- [x] AC1, AC4, AC5 — test `supabase/tests/agenda/0052-b-feriados.sql` 6/6 en BEGIN…ROLLBACK.
- [x] AC2, AC3, AC-E1 — migración aplicada, `sync-holidays` desplegada y ejecutada (34 feriados
      2026–2027), cron activo. Ver acceptance.md.
