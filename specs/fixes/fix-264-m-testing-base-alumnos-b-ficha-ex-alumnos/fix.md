# Fix: Testing — Base de Alumnos Clase B, ficha del alumno y ex-alumnos
> id: fix-264-m-testing-base-alumnos-b-ficha-ex-alumnos
> refs: ASG-i-024
> status: in_progress
> created: 2026-10-01

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklists que se ejecutan:** `specs/testing-piloto/024a-base-alumnos-b.md` (lista, Papelera,
> exportaciones) y `specs/testing-piloto/024b-ficha-ex-alumnos.md` (ficha y Ex-Alumnos B).

## Root Cause

[Heredado de ASG-i-024, a confirmar]: La Base de Alumnos y la ficha son donde la secretaria opera
a diario sobre un alumno ya matriculado: consulta el progreso, reprograma clases, justifica
inasistencias, archiva, restaura y re-matricula. La ficha agrega datos de clases, pagos,
documentos y asistencia, así que es un buen detector de inconsistencias entre módulos.

**Clasificación:** Integración · dificultad Alta · rutas: `/app/{admin,secretaria}/alumnos`,
`/alumnos/:id`, `/ex-alumnos` (+ papelera).

### Alcance confirmado al reclamar (Matías, 2026-10-01)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `0016-b`, `0006-i`, `0007-i`, `0038-b`, `fix-039-i`, `fix-040-i`.
2. **E2E manual** — los casos de `024a` y `024b`, incluidas las sospechas S1…S12 (`024a`) y
   S1…S20 (`024b`), que salen de leer código y hay que confirmar o descartar en navegador.
3. **Playwright** — los casos marcados "Auto ✓" se automatizan en la suite de `0019-m`
   (`e2e/`, `npm run test:e2e`). `ASG-i-021` ya está completada, así que esta capa no está
   bloqueada.

Ajustes sobre el texto de la ASG:

- **Sospechas que ya tienen asignación propia:** acá solo se confirman o descartan y se
  referencian; no se abre un fix duplicado.
  - Edge functions sin control de rol/sede (`024a` S1, S2; `024b` S2) → `ASG-i-041`, `ASG-i-042`.
  - Secretaria edita a cualquier usuario (`024b` S1) → `ASG-i-043`.
  - RLS por rol sin sede (`024a` P08; `024b` S03, S04) → `ASG-i-045`.
  - Canales Realtime mudos (`024a` S5; `024b` S3) → `ASG-i-056`.
  - Fechas en UTC (`024a` S9; `024b` S17) → `ASG-i-054`.
- **Sospechas ya corregidas, se ejecutan como regresión:** `024b` S4 y S5 (`fix-263-m`) y la parte
  de la nota de `024b` S10 (`fix-262-m`). La decisión B05/O01 de `024b` ya está tomada: el estado
  de la ficha sale de la matrícula seleccionada.
- **Datos de prueba:** los casos que cambian estado (archivar, restaurar, marcar ex-alumno,
  reprogramar, justificar, editar perfil) usan **alumnos sembrados para este track**, con prefijo
  `E2E-`. Los datos del seed de `0008-i` solo se leen.
- **Decisiones de negocio** (§5 de ambos checklists): no se marcan ✅/❌. Se listan abajo como
  pendientes para que las defina el owner.

### Fuera de alcance

- Base de Alumnos Profesional → `ASG-i-025`.
- Inasistencias y penalización en detalle → `ASG-i-027`.

## ACs Afectados

Ninguno propio — track de testing. Se verifican los ACs ya documentados en `0016-b`, `0006-i`,
`0007-i`, `0038-b`, `fix-039-i` y `fix-040-i`.

## Datos de prueba usados

<!-- Nombre/RUT real de cada dato D1…D17 (024a) y D1…D20 (024b). -->

| Checklist | Dato | Alumno usado | Notas |
|---|---|---|---|

## Resultados

<!-- Un bloque por sección del checklist. Res.: ✅ / ❌ / ⏸ (bloqueado o pendiente de decisión). -->

### 024a — Base de Alumnos B (lista)

| ID | Res. | Evidencia / observación | Track generado |
|---|---|---|---|

### 024b — Ficha del alumno y Ex-Alumnos B

| ID | Res. | Evidencia / observación | Track generado |
|---|---|---|---|

## Sospechas: confirmadas / descartadas

| Checklist | # | Resultado | Evidencia | Track |
|---|---|---|---|---|

## Bugs encontrados

| # | Descripción | Gravedad | Track |
|---|---|---|---|

## Decisiones de negocio pendientes

<!-- Las de §5 de cada checklist que sigan abiertas al cerrar el track. -->

## Cambio

Ninguno en código de producción. Lo único que este track agrega son los tests E2E de la capa 3.

- **Archivo:** `e2e/` (specs nuevos del módulo, por definir al automatizar)
- **Qué cambia:** casos "Auto ✓" de `024a` y `024b` automatizados

## Test de Regresión

- `e2e/` — specs del módulo Alumnos B / ficha / ex-alumnos (por definir) ✓
