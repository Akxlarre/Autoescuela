# Asignación ASG-b-093 — "Evaluar clase" debe abrir en Drawer, no navegar a otra página

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-17
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Detectado por el usuario durante QA visual de ASG-b-084 (App-like piloto de tabs en
`/instructor/alumnos/:id/ficha`). Hoy, al hacer clic en "Evaluar" sobre una clase práctica
(tabla "Ficha Técnica"), el botón es un `<a [routerLink]="['/app/instructor/alumnos', studentId,
'evaluacion', sessionId]">` — navega a una página completa distinta, perdiendo el contexto de la
ficha del alumno (scroll, tab activo, etc.).

El usuario prefiere que "Evaluar" abra un **Drawer lateral** (mismo patrón que
"Registrar Venta"/"Agregar Servicio" en Servicios Especiales — `LayoutDrawerFacadeService`),
sin abandonar la ficha.

## Alcance sugerido

1. Localizar el componente actual de evaluación de clase (ruta
   `/app/instructor/alumnos/:studentId/evaluacion/:sessionId`) y su Facade asociado.
2. Evaluar si conviene extraer el formulario de evaluación a un componente de Drawer reutilizable
   (via `LayoutDrawerFacadeService.open()`), o si el componente de ruta actual ya es suficientemente
   autónomo para envolver tal cual.
3. Reemplazar los `routerLink` de "Evaluar"/"Ver detalles" (desktop y mobile, tabla y card view)
   en `instructor-ficha.component.ts` por un evento que abra el drawer con el `sessionId`
   correspondiente.
4. Verificar que la ruta antigua (`/evaluacion/:sessionId`) siga funcionando si hay otros
   puntos de entrada que la usen directamente (deep links, notificaciones, etc.) — no romper
   navegación externa si existe.

## Preguntas abiertas

- ¿Hay otros lugares del sistema (notificaciones, emails) que linkeen directo a
  `/evaluacion/:sessionId`? Si es así, esa ruta no se puede eliminar, solo dejar de ser el
  camino primario desde la ficha.

## Referencias

- `src/app/features/instructor/ficha/instructor-ficha.component.ts` (botones "Evaluar"/"Ver
  Detalles"/"Ver", líneas ~303-334 desktop y ~412-439 mobile)
- Patrón de Drawer a replicar: `ServiciosEspecialesFacade.openRegistrarVentaDrawer()` +
  `LayoutDrawerFacadeService`

## Archivos involucrados

- `src/app/features/instructor/ficha/instructor-ficha.component.ts`
- Componente/ruta de evaluación de clase (a identificar)

---

## Nota de renumeración (2026-08-22)

Esta asignación nació como `ASG-b-092`, chocando con `ASG-b-092-organismos-carpeta-por-rol`
(creada antes, el 2026-08-15, y referenciada desde `ASG-b-089`). Se renumeró a `ASG-b-093`.

⚠️ **Pendiente de reconciliar al mergear `fixes_final_boss`:** esa rama resolvió la misma
colisión de otra forma (commit `47efcc7c`, 2026-08-19), renombrando este archivo a
`ASG-i-001`. Ese ID ya está tomado en `main` por `ASG-i-001-ortografia-y-voseo-argentino`
(mergeado en el PR #126), así que la rama arrastra hoy **dos** `ASG-i-001`. Al mergear hay
que **descartar el rename de esa rama** y conservar este archivo — de lo contrario vuelven
dos colisiones a la vez. Se mantuvo el prefijo `b` a pesar de que `created_by` es `i`
(decisión del owner, 2026-08-22) para no consumir un número del contador de Ignacio que él
pueda estar usando en paralelo.
