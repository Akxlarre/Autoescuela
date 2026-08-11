# Plan 0008-m — App-like: matriz de notas (Evaluaciones profesional)

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-10

---

## 1. Resumen ejecutivo

Se extrae la lógica y el template de `AdminProfesionalEvaluacionesComponent` a un nuevo Dumb
compartido `app-evaluaciones-profesional-content` (`shared/components/`) — el mismo patrón ya
usado en el proyecto para pares admin/secretaria casi-clon (`liquidaciones-content`,
`historial-cuadraturas-content`, `servicios-especiales-content`). Ambos componentes Smart pasan
a ser wrappers delgados que inyectan `EvaluacionesProfesionalFacade` (ya compartido por ambos
hoy) y delegan el template al contenido compartido. La extracción es también la corrección del
bug del badge (AC5) y la vía para garantizar AC4 (paridad total) por construcción, no por
disciplina manual. Sobre ese componente único se aplica el patrón app-like en los dos modos
(aterrizaje/grilla) según el diagnóstico ya hecho en `indices/APP-LIKE-ROLLOUT.md:67`. Por
último, rename de label/ruta a "Evaluaciones" en el lado secretaria.

Orden grueso: (1) extraer el contenido compartido preservando comportamiento actual bit-a-bit,
sin tocar CSS todavía → (2) aplicar app-like sobre el componente único → (3) rename de
label/ruta → (4) QA visual en ambas rutas.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/shared/components/evaluaciones-profesional-content/evaluaciones-profesional-content.component.ts` | Dumb | Template + lógica de presentación extraída de ambos componentes casi-clon. `computed()` derivados (stats, validaciones de grilla) que hoy viven en `AdminProfesionalEvaluacionesComponent` se mueven aquí. |
| `src/app/shared/components/evaluaciones-profesional-content/evaluaciones-profesional-content.component.spec.ts` | Test | Cubre los `computed()`/lógica de densidad movidos (obligatorio por `testing-tdd.md` — tiene lógica, no es un dumb puro de bindings). |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/admin/profesional-evaluaciones/admin-profesional-evaluaciones.component.ts` | Se reduce a wrapper delgado: `inject(EvaluacionesProfesionalFacade)`, `inject(BranchFacade)`, `ngOnInit`/`ngOnDestroy`, pasa signals como `input()` a `<app-evaluaciones-profesional-content>` | Elimina duplicación real; garantiza AC4 por diseño |
| `src/app/features/secretaria/profesional-notas/secretaria-profesional-notas.component.ts` | Igual que admin — wrapper delgado. El archivo/carpeta física NO se renombra (out of scope de la spec) | Idem |
| `src/app/app.routes.ts` | Ruta secretaria `profesional/notas` → `profesional/evaluaciones` (línea ~524) | AC7 |
| `src/app/core/services/auth/menu-config.service.ts` | Label secretaria `'Calificaciones'` → `'Evaluaciones'` (línea ~223), `routerLink` actualizado a `/app/secretaria/profesional/evaluaciones` (línea ~225) | AC6, AC7 |
| `src/app/features/secretaria/profesional-notas/secretaria-profesional-notas.component.ts` | Fallback de título `'Calificaciones'` → `'Evaluaciones'` (línea ~556) | AC8 |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|

Ninguno — la extracción reduce ambos componentes existentes, no los elimina (siguen siendo el
punto de entrada de ruta / lifecycle de cada rol).

---

## 3. Reutilización (Discovery)

> Salida del paso DESCUBRIR. Qué ya existe que vamos a aprovechar.

### Componentes existentes que reutilizamos
- `app-badge`, `app-icon`, `app-section-hero`, `app-skeleton-block`, `app-stat-box` — ya usados
  por ambos componentes actuales, se mueven tal cual al Dumb nuevo.
- `BentoGridLayoutDirective` — se mantiene en el nuevo componente compartido.
- Patrón de extracción `*-content` — copiado de `liquidaciones-content`,
  `historial-cuadraturas-content`, `dms-list-content`, `servicios-especiales-content` (mismo
  problema: admin/secretaria casi-clon, misma solución ya validada 4+ veces en este proyecto).

### Facades/Services existentes que extendemos
- `EvaluacionesProfesionalFacade` — **no se modifica**. Ya es inyectado por ambos componentes hoy
  (`admin-profesional-evaluaciones.component.ts:581`,
  `secretaria-profesional-notas.component.ts:536`) — la extracción no cambia su contrato, solo
  mueve QUIÉN consume sus signals.
- `BranchFacade` — igual, ya inyectado por ambos, sin cambios.
- `GsapAnimationsService` — se mueve al Dumb nuevo (hoy solo en admin,
  `admin-profesional-evaluaciones.component.ts:22`; se aplica igual en el Dumb para que ambos
  wrappers hereden la misma animación sin duplicar la llamada).
- `ConfirmModalService` — usado hoy solo por admin para `confirmarNotas()`. Verificar en la
  extracción si secretaria también debe poder confirmar notas (revisar permisos de rol) o si el
  botón debe quedar oculto/deshabilitado para secretaria — **decisión a confirmar en QA visual**,
  no asumida de antemano (posible AC-E4 si aplica, agregar durante `/spec-tasks` si se confirma
  que sí es una diferencia de permisos legítima y no un descuido).

### Componentes/Facades que NO existen y debemos crear
- `app-evaluaciones-profesional-content` — justificado: es la única forma de garantizar AC4
  (paridad total verificable, no por disciplina de copiar-pegar cambios en 2 archivos cada vez).
  Alternativa descartada: mantener 2 archivos y sincronizarlos a mano — es exactamente el patrón
  que ya causó el bug de badge (AC5), y el propio dominio del proyecto ya resolvió este problema
  4 veces con extracción a `shared/components/*-content`.

---

## 4. Modelo de datos

N/A — no se toca BD, RLS, ni DTOs. `EvaluacionesProfesionalFacade` y sus modelos
(`core/models/ui/evaluaciones-profesional.model.ts`) se reutilizan sin cambios.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
/admin/clase-profesional/evaluaciones          /secretaria/profesional/evaluaciones
        │                                              │
        ▼                                              ▼
AdminProfesionalEvaluacionesComponent      SecretariaProfesionalNotasComponent
  (Smart, wrapper delgado)                   (Smart, wrapper delgado)
  ├─ inject(EvaluacionesProfesionalFacade)   ├─ inject(EvaluacionesProfesionalFacade)
  ├─ inject(BranchFacade)                    ├─ inject(BranchFacade)
  └─ <app-evaluaciones-profesional-content>  └─ <app-evaluaciones-profesional-content>
              │                                         │
              └───────────────┬─────────────────────────┘
                               ▼
              app-evaluaciones-profesional-content (Dumb, shared/)
                input: grupos, grilla, isLoading, isDesktop, ...
                output: seleccionarCurso, guardarNota, confirmarNotas, ...
                — único lugar con el template de los 2 modos
                  (aterrizaje / grilla) y el CSS sticky bidireccional
```

### Capas tocadas

- **Smart**: `features/admin/profesional-evaluaciones/admin-profesional-evaluaciones.component.ts`,
  `features/secretaria/profesional-notas/secretaria-profesional-notas.component.ts`
- **Dumb**: `shared/components/evaluaciones-profesional-content/evaluaciones-profesional-content.component.ts`
- **Facade**: `core/facades/evaluaciones-profesional.facade.ts` (sin cambios, solo consumido)
- **Service**: ninguno nuevo
- **Migration**: N/A

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Smart/Dumb estricto (la extracción ES la aplicación de esta regla),
  OnPush en el nuevo Dumb, Signals para `input()`/`output()`
- [ ] `facades.md` — sin cambios de Facade
- [ ] `models.md` — sin DTOs/UI models nuevos
- [x] `visual-system.md` — Bento Grid (`--fill-screen-kpi` o el modificador que se determine en
  la sub-decisión de densidad del modo aterrizaje), `.bento-fill`, sin colores hardcodeados, GSAP
  (no CSS `@keyframes`)
- [ ] `swr-pattern.md` — el Facade ya tiene su propio patrón de carga, no se toca
- [ ] `notifications.md` — sin notificaciones nuevas
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para el Dumb nuevo (tiene `computed()` de
  densidad/validación, no es un dumb puro)
- [ ] `ai-readability.md` — revisar si los botones de mutación existentes (`confirmarNotas`,
  guardar nota) ya tienen `data-llm-action`; si no, es deuda preexistente fuera de esta spec salvo
  que se detecte durante la extracción (en ese caso, agregarlo es gratis al estar tocando el
  archivo)

---

## 7. Plan de testing

- **Unitarios**: `.spec.ts` del nuevo `evaluaciones-profesional-content.component.ts` — cubrir
  cualquier `computed()` de stats (`computeGradebookStats`, `countModulosCompletos` — ya son
  funciones puras en `core/utils/gradebook-stats.ts`, verificar que ya tienen tests propios y no
  hace falta duplicar) y la lógica de densidad nueva del modo aterrizaje (AC-E1).
- **Regresión**: correr los tests existentes de `AdminProfesionalEvaluacionesComponent` (si
  existen) contra el wrapper nuevo — deben seguir pasando sin modificar sus expectativas de
  negocio, solo la estructura de inyección.
- **QA manual (Playwright MCP, `/verify`)**:
  - Ambas rutas (`/admin/clase-profesional/evaluaciones`, `/secretaria/profesional/evaluaciones`)
  - Ambos modos (aterrizaje, grilla) en cada ruta
  - 3 tamaños: 390×844, 1440×900, 768 de alto (checklist del rollout, `ASG-b-080` §"Checklist de
    cierre")
  - Confirmar scroll bidireccional sticky intacto (header + columna alumno) tras el cambio
  - `force-compact` con drawer abierto en ambas páginas
  - Confirmar visualmente AC4 (comparación lado a lado admin vs secretaria con el mismo dato)
  - Confirmar AC5 (badge con ícono/texto separados) en secretaria
  - Confirmar AC6/AC7/AC8 (label, ruta, título) navegando por el menú real

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Romper el scroll bidireccional sticky (header + columna alumno) ya construido a mano, por no entender bien el CSS custom inline actual antes de tocarlo | Media-Alta | Leer y documentar el CSS custom completo ANTES de mover una sola línea (paso 1 del orden de implementación); extraer el modo grilla en un commit separado del modo aterrizaje para poder aislar una regresión |
| La extracción a Dumb compartido revela una diferencia de permisos real (ej. `confirmarNotas` solo debería existir para admin) en vez de ser un descuido de duplicación | Media | Verificar con el owner ANTES de ocultar/eliminar cualquier botón que hoy solo existe en uno de los dos — no asumir que toda diferencia es un bug (ver nota en §3 sobre `ConfirmModalService`) |
| Modo aterrizaje con cantidad variable de grupos de promoción sin límite definido — decisión de densidad (scroll compartido vs. límite+"cargar más") mal elegida degrada UX con muchos grupos | Media | Reusar `sliceByBudget`/`visibleWithLoadMore` de `core/utils/layout-tier.utils.ts` (patrón ya validado en `alumnos-list-content`) en vez de inventar un criterio nuevo |
| Rename de ruta secretaria sin redirect (decisión ya tomada por el owner) rompe algún link externo no detectado por el grep (ej. hardcodeado en un email, notificación, o mensaje de WhatsApp) | Baja | Grep adicional sobre `core/facades/` y Edge Functions por `profesional/notas` antes de cerrar (no solo `src/app`) |

---

## 9. Orden de implementación

1. Leer y documentar (comentario breve, no extenso) el CSS custom sticky existente en
   `admin-profesional-evaluaciones.component.ts` antes de mover nada.
2. Crear `evaluaciones-profesional-content.component.ts` + `.spec.ts`, moviendo el template y la
   lógica de `AdminProfesionalEvaluacionesComponent` tal cual (sin aplicar app-like todavía) —
   commit de "extracción pura", comportamiento idéntico al actual.
3. Convertir `AdminProfesionalEvaluacionesComponent` en wrapper delgado, verificar visualmente
   que la página admin se ve exactamente igual que antes de tocar nada.
4. Convertir `SecretariaProfesionalNotasComponent` en wrapper delgado usando el mismo Dumb —
   este paso es el que corrige AC4/AC5 automáticamente (el badge ya no puede divergir).
5. Aplicar el patrón app-like sobre `evaluaciones-profesional-content` (ambos modos), integrando
   con el CSS sticky documentado en el paso 1, sin romperlo.
6. Rename de label/ruta a "Evaluaciones" (`app.routes.ts`, `menu-config.service.ts`, fallback de
   título en el wrapper de secretaria).
7. `npm run test:ci` + `npm run lint:arch`.
8. QA visual completo (`/verify`) en ambas rutas, ambos modos, 3 tamaños.
9. Sincronizar `indices/COMPONENTS.md`, `indices/ROUTES.md`, `indices/USAGE-MAP.md`,
   `indices/APP-LIKE-ROLLOUT.md` (marcar la fila 13/familia "matriz de notas" como cerrada).

---

## 10. Estimación

M — 1 a 3 días.

---

## Changelog

- 2026-08-10 — plan inicial
