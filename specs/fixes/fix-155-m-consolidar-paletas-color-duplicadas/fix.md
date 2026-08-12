# Fix: Consolidar paletas de color duplicadas/hardcodeadas en fuentes únicas
> id: fix-155-m-consolidar-paletas-color-duplicadas
> refs: ASG-b-090
> status: in_progress
> created: 2026-08-12

## Root Cause

[Heredado de ASG-b-090, a confirmar]: Hallazgo H2 de la auditoría fresca del DS
(`indices/DS-AUDIT-2026-08-03.md`). No es "falta un token" — es que el mismo set de colores vive
copiado en 3-4 archivos sueltos, así que si alguien cambia el color de una categoría en un lugar,
quedan copias desincronizadas sin que nada lo detecte (el linter no compara constantes entre
archivos). 5 clusters:

1. **`SPEC_COLORS`** (especialidades A2-A5) — SÍ existe fuente canónica:
   `core/utils/professional-specializations.ts:6-11` (con `getSpecColor()` ya exportada), pero
   redefinida hardcodeada en 4 archivos: `admin-relator-ver-drawer.component.ts:13-16`,
   `admin-relator-editar-drawer.component.ts:20-23`, `admin-relator-crear-drawer.component.ts:326-329`,
   `admin-profesional-relatores.component.ts:502-507`.
2. **`COURSE_COLORS`** — NO existe fuente canónica hoy, hay que crearla (ej.
   `core/utils/course-colors.ts`, mismo patrón que `professional-specializations.ts`). Copias en
   `admin-promocion-ver-drawer.component.ts:13-16`, `admin-promocion-crear-drawer.component.ts:22-25`,
   `admin-profesional-promociones.component.ts:475-480`.
3. **Paleta de avatares (gradientes)** — duplicada byte-a-byte en
   `instructor-alumnos.component.ts:30-37` y `student-drawer-detail.component.ts:12-19` (8
   entradas `linear-gradient(...)`). Crear fuente única (ej. `core/utils/avatar-palette.ts`).
4. **`INCOME_COLORS`** (`core/utils/reportes-contables.utils.ts:44,47`) — ya vive en un solo
   archivo (no duplicada entre archivos), pero mezcla `var(--state-info)` con hex crudo
   (`#7c3aed`, `#0d9488`) dentro de la misma constante — inconsistente internamente. Evaluar si
   esos 2 colores deberían ser tokens semánticos nuevos o si el hex es intencional (colores de
   categoría que no mapean a ningún `--state-*` existente).
5. **Paleta de liquidaciones** (`core/facades/liquidaciones.facade.ts:21-28`) — array de 8 hex
   sin nombre semántico, vive en el Facade en vez de un util compartido.

Confirmado con el usuario (2026-08-12): se resuelven los 5 clusters en este mismo track, sin
dividir por cluster. Para (4) y (5), la decisión de diseño (token semántico nuevo vs constante con
nombre) se toma dentro de este track antes de tocar código, no se difiere a otro track.

## Alcance sugerido (heredado de la ASG)

- Para (1): importar `SPEC_COLORS`/`getSpecColor()` desde `professional-specializations.ts` en
  los 4 archivos, eliminar las copias locales. Es el más simple — fuente ya existe.
- Para (2): crear el util canónico, migrar los 3 archivos a importarlo.
- Para (3): crear el util canónico, migrar los 2 archivos.
- Para (4) y (5): decisión de diseño primero (¿token semántico nuevo o constante con nombre?)
  antes de tocar código — no forzar una consolidación que no tiene un hogar canónico obvio.

## ACs Afectados

Ninguno — fix de consolidación de fuente única, sin cambio de comportamiento visual (mismo valor
de color, solo cambia de dónde se lee). El riesgo real es solo de tipeo al copiar/pegar mal un hex.

## Cambio

_Pendiente de completar durante la implementación._

## Test de Regresión

_Pendiente de completar durante la implementación._

## Referencias

- `indices/DS-AUDIT-2026-08-03.md` §H2 (hallazgo completo con snippets línea por línea)
- `core/utils/professional-specializations.ts` (patrón canónico ya validado a replicar)
- ASG-b-090 (`specs/assignments/ASG-b-090-paletas-color-duplicadas.md`)
