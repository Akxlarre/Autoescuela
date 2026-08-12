# Asignación ASG-b-090 — Consolidar paletas de color duplicadas/hardcodeadas en fuentes únicas

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** Media
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-08-12
> **resulting_track:** fix-155-m-consolidar-paletas-color-duplicadas

---

## Contexto / Objetivo

Hallazgo H2 de la auditoría fresca del DS (`indices/DS-AUDIT-2026-08-03.md`). No es "falta un
token" — es que el mismo set de colores vive copiado en 3-4 archivos sueltos, así que si alguien
cambia el color de una categoría en un lugar, quedan copias desincronizadas sin que nada lo
detecte (el linter no compara constantes entre archivos). 5 clusters:

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

## Alcance sugerido

- Para (1): importar `SPEC_COLORS`/`getSpecColor()` desde `professional-specializations.ts` en
  los 4 archivos, eliminar las copias locales. Es el más simple — fuente ya existe.
- Para (2): crear el util canónico, migrar los 3 archivos a importarlo.
- Para (3): crear el util canónico, migrar los 2 archivos.
- Para (4) y (5): decisión de diseño primero (¿token semántico nuevo o constante con nombre?)
  antes de tocar código — no forzar una consolidación que no tiene un hogar canónico obvio.
- **No es necesario resolver los 5 clusters en el mismo track** — se puede dividir por cluster si
  se prefiere iterar en fixes chicos (`SPEC_COLORS` primero, por ser el de menor esfuerzo).

## Referencias

- `indices/DS-AUDIT-2026-08-03.md` §H2 (hallazgo completo con snippets línea por línea)
- `core/utils/professional-specializations.ts` (patrón canónico ya validado a replicar)

## Archivos involucrados

- `src/app/core/utils/professional-specializations.ts` (fuente, sin cambios de contenido)
- `src/app/features/admin/profesional-relatores/admin-relator-ver-drawer.component.ts`
- `src/app/features/admin/profesional-relatores/admin-relator-editar-drawer.component.ts`
- `src/app/features/admin/profesional-relatores/admin-relator-crear-drawer.component.ts`
- `src/app/features/admin/profesional-relatores/admin-profesional-relatores.component.ts`
- `src/app/features/admin/profesional-promociones/admin-promocion-ver-drawer.component.ts`
- `src/app/features/admin/profesional-promociones/admin-promocion-crear-drawer.component.ts`
- `src/app/features/admin/profesional-promociones/admin-profesional-promociones.component.ts`
- `src/app/features/instructor/alumnos/instructor-alumnos.component.ts`
- `src/app/features/instructor/alumnos/components/student-drawer-detail.component.ts`
- `src/app/core/utils/reportes-contables.utils.ts`
- `src/app/core/facades/liquidaciones.facade.ts`

## Notas para quien la reclame

- Cero riesgo visual si se hace bien — es el mismo valor de color, solo cambia de dónde se lee.
  El riesgo real es solo de tipeo al copiar/pegar mal un hex al consolidar.
- Verificar con `/verify` cada página tocada de todas formas, dado que hay precedente de bugs
  latentes encontrados exactamente en este tipo de migración (fix-043-b, fix-044-b encontraron
  tokens inexistentes con fallback silencioso roto al tocar pills de color similares).
