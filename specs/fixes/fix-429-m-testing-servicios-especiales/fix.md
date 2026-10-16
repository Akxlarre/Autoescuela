# Fix: Testing — Servicios especiales
> id: fix-429-m-testing-servicios-especiales
> refs: ASG-i-031
> status: in_progress
> created: 2026-10-15

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/031-servicios-especiales.md`.

## Root Cause

[Heredado de ASG-i-031, a confirmar]: Venta de servicios sueltos (psicotécnico, etc.) a alumnos o
clientes externos. Es un módulo bastante autocontenido; su única conexión fuerte es que la venta
tiene que entrar a caja y reportes.

**Clasificación:** Funcional · dificultad Baja · rutas: `/app/{admin,secretaria}/servicios-especiales`.

### Alcance confirmado al reclamar (Matías, 2026-10-15)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `fix-021-i` (app-like), `fix-022-i` (borrar servicio) y `ASG-b-050`
   (borrar/anular ventas).
2. **E2E manual** — los casos A…O del checklist, incluidas las sospechas abiertas.
3. **Playwright** — venta → assert del KPI "Total recaudado", en la suite de `0019-m` (`e2e/`).

Los hallazgos se corrigen en la misma sesión, cada uno en su propio fix/hotfix.

**El checklist es anterior a varios fixes.** Lectura rápida del código al reclamar (sin navegador):

| Sospecha | Estado aparente | Cómo se ejecuta |
|---|---|---|
| S2 — ventas fuera de Reportes/Dashboard | `reportes-contables.facade.ts` y `dashboard.facade.ts` ya leen `special_service_sales` | Regresión |
| S3 — fecha UTC | El facade usa `chileToday()`/`chileMonth()` (`0024-m`) | Regresión |
| S4 — sin medio de pago | Migración `20261012120000_fix047_special_service_sales_payment_method` | Regresión |
| S5 — RLS sin sede | Migración `20261001150000_rls_aislamiento_por_sede` | Regresión |
| S1 — export sin control de acceso | La edge function no llama a `auth.getUser()` | Abierta |
| S7 — límite de 200 ventas | Sigue `.limit(200)` | Abierta |
| S8 — venta a alumno sin vínculo | Sigue `student_id: null` | Abierta (depende de decisión) |
| S6, S9–S16 | Sin revisar | Abiertas |

### Decisiones de negocio (§5 del checklist)

No se marcan ✅/❌. Antes de ejecutar los casos que dependen de ellas se revisa cuáles ya quedaron
respondidas por fixes posteriores al checklist (p. ej. `fix-047` para medio de pago); las que
sigan abiertas se consultan en bloque.

### Fuera de alcance

- Los flujos por dentro de Caja Diaria / Cuadratura (`029`) y Reportes: acá solo que la venta se
  refleja en ellos.

## Resultados

_Pendiente de ejecución._

## Fixes derivados

_Ninguno todavía._

## Test de regresión

Suite e2e del módulo (capa 3).
