# Asignación ASG-i-009 — Recortar Clase Profesional a solo Matrícula + Base de Alumnos

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-15
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Misma decisión de alcance que ASG-i-008 (reunión de equipo, 2026-09-15), pero dentro de Clase
Profesional específicamente: **Clase B se entrega completa, sin recortes.** De Clase
Profesional, en la primera entrega solo queda visible:

1. **Matricular a Clase Profesional** — es el mismo wizard de matrícula que ya usa Clase B
   (`admin-matricula` / `secretaria-matricula`), que ya soporta ambas categorías de curso. No
   hay que tocar el wizard en sí — matricular Profesional debe seguir funcionando igual.
2. **Base de Alumnos Profesional** — `clase-profesional/alumnos` (admin) /
   `profesional/alumnos` (secretaria).

Todo el resto de Clase Profesional queda oculto en esta fase (no eliminado):

| Módulo | Ruta Admin | Ruta Secretaria |
|---|---|---|
| Pre-inscritos | `clase-profesional/pre-inscritos` | `profesional/pre-inscritos` |
| Relatores | `clase-profesional/relatores` | `profesional/relatores` |
| Promociones | `clase-profesional/promociones` | `profesional/promociones` |
| Asistencia | `clase-profesional/asistencia` | `profesional/asistencia` |
| Certificados | `clase-profesional/certificados` | `profesional/certificados` |
| Evaluaciones | `clase-profesional/evaluaciones` | `profesional/evaluaciones` |
| Archivo | `clase-profesional/archivo` | `profesional/archivo` |
| Ex-Alumnos Profesional | `ex-alumnos-profesional` | `ex-alumnos-profesional` |

## Alcance sugerido

1. Ocultar las 8 rutas de la tabla de arriba con el mismo mecanismo de "fase" que se diseñe en
   ASG-i-008 (reutilizar, no duplicar un segundo sistema de flags).
2. En `menu-config.service.ts`, dentro de los bloques de menú de `admin` y `secretaria`, quitar
   los ítems correspondientes a esas 8 rutas (ver referencias abajo con línea aproximada),
   dejando visibles solo "Base Alumnos Profesional" y el ítem de "Matrícula" ya existente.
3. Igual que en ASG-i-008: la condición de "oculto en esta fase" debe vivir en un solo lugar
   consultado tanto por el guard de rutas como por el menú.

## Verificación de dependencias (hecha 2026-09-16 — resultado: seguro ocultar)

Antes de ejecutar esto se investigó si "Matricular a Clase Profesional" depende de que alguien
opere manualmente Promociones o Relatores. Resultado, con código real revisado:

- **Promociones se auto-generan.** `supabase/migrations/20260807090000_auto_create_next_promotions_cron.sql`
  agenda un `pg_cron` diario (06:00 UTC) que invoca la Edge Function
  `supabase/functions/auto-create-next-promotions/index.ts` — mantiene un colchón de 1
  promoción `in_progress` + 2 `planned` sin intervención humana. `EnrollmentFacade` (línea
  ~909) solo **lee** `promotion_courses` ya existentes, nunca depende de que alguien haya
  entrado a la pantalla de Promociones.
- **Las transiciones de estado también son automáticas** (`planned→in_progress→finished`,
  migración `20260820100000_fix196_promotion_finished_completes_enrollments.sql`).
- **Relatores no tiene ninguna referencia cruzada con `enrollment.facade.ts`** — cero
  acoplamiento, confirmado por grep. Ocultarlo no afecta la matrícula.
- El job está fijado a `branch_id = 2` — no es un descuido: coincide con que Clase
  Profesional ya está restringida a una sola sede en el código (`professionalBranchGuard`
  en `app.routes.ts`).

**Conclusión: ocultar Promociones y Relatores es seguro para el flujo de matrícula.**

⚠️ **Efecto secundario menor a comunicar al equipo (no bloqueante):** la Base de Alumnos
Profesional muestra KPIs derivados de Asistencia/Evaluaciones (semáforo "en riesgo" desde
`v_professional_attendance.attendance_flag`, módulos aprobados desde
`professional_module_grades`). Con esas dos pantallas ocultas, nadie carga esos datos, así
que esas columnas van a verse vacías/en cero — no es un bug, es esperable mientras dure esta
fase. Dejarlo dicho explícitamente en la demo/documentación para que no se reporte como error.

## Fuera de alcance

- No tocar Clase B — se entrega completa, sin recortes.
- No tocar el wizard de matrícula en sí (`EnrollmentFacade` y sus pasos) — solo qué rutas del
  menú de Clase Profesional quedan visibles alrededor de él.
- No eliminar código, rutas, componentes ni tests de los 8 módulos ocultos.

## Referencias

- `src/app/app.routes.ts` — bloque `clase-profesional/*` bajo `admin` y `profesional/*` bajo
  `secretaria`, más `ex-alumnos-profesional` (top-level en ambos).
- `src/app/core/services/auth/menu-config.service.ts` — ítems de menú Profesional, admin desde
  la línea ~74 y secretaria desde la línea ~201 (puede haberse movido, confirmar antes de
  editar).
- `indices/FACADES.md` — entrada de `EnrollmentFacade` para revisar la dependencia con
  Promociones antes de ocultarlas (punto 3 del alcance).

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/app.routes.ts` (mismo archivo que ASG-i-008 — coordinar para no pisarse)
- `src/app/core/services/auth/menu-config.service.ts` (mismo archivo que ASG-i-008)

## Notas para quien la reclame

- Resolver junto con ASG-i-008 si conviene el mismo track — comparten archivos y mecanismo.
- El punto 3 (dependencia de Promociones) es el riesgo real de esta asignación — no es solo
  "ocultar 8 links", puede requerir una decisión de producto. Si aparece, volver a levantarlo
  en la próxima reunión antes de resolverlo unilateralmente.
