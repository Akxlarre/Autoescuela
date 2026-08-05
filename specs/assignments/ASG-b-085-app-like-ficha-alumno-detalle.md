# Asignación ASG-b-085 — App-like: `/admin/alumnos/:id` + `/secretaria/alumnos/:id` (⚠️ la más grande y riesgosa del rollout)

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Segunda mitad del paso 16 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). **⚠️ No
reclamar esta sin haber hecho antes ASG-b-084 (instructor/ficha, el piloto)** — reusar el
patrón de tabs ya validado ahí, no re-derivarlo desde cero acá.

`AdminAlumnoDetalleComponent` (shared admin+secretaria): **1654 líneas, la página más grande y
de mayor tráfico de todo el sistema** (ficha de alumno — matrículas, pagos, documentos, clases).

## Por qué esto es distinto a cualquier otra pieza del rollout

- El componente **YA tiene ~20 líneas de comentario explicando por qué NO usa `--fill-screen`**
  (líneas 828-850, CSS custom override documentado) — es una **decisión deliberada y ya
  razonada** del equipo en su momento, no un descuido. Bajo el criterio formal nuevo de
  `visual-system.md`, esa razón ("página de detalle con secciones secuenciales") ya no es
  válida — pero hay que revertir una decisión escrita a propósito, con cuidado, no simplemente
  ignorarla.
- **NO tiene tabs propias hoy.** El `<app-tabs>` que usa es para elegir entre MATRÍCULAS del
  alumno (si tiene varias) — no para las secciones internas (Ficha/Matrículas/Pagos/Documentos/
  Clases). Reestructurar en tabs significa **construir la UI de tabs desde cero** para esas
  secciones, no reusar algo que ya exista en este archivo.
- Es la ficha que la secretaria/admin abre más veces al día — cualquier regresión visual acá se
  nota inmediatamente y en volumen.

## Plan

1. Leer el patrón resultante de ASG-b-084 (piloto en `instructor/ficha`) antes de diseñar nada.
2. Reestructurar en tabs: Ficha / Matrículas / Pagos / Documentos / Clases — **sin perder
   ninguna acción existente** (editar perfil, inasistencias, reagendar clases, historial de
   pagos, etc. — catalogar TODAS las acciones actuales antes de mover nada).
3. Revertir el CSS custom override de las líneas 828-850 una vez que las tabs resuelvan el
   problema que ese CSS estaba parchando.
4. `--fill-screen-kpi` (o el que corresponda según cuántas filas queden arriba de las tabs) +
   `.bento-fill` en el panel de la tab activa.

## Checklist de cierre (⚠️ más exigente que el resto del rollout, dado el riesgo)

- [ ] `force-compact` verificado con drawer abierto
- [ ] `.spec.ts` para toda la lógica de tabs/densidad nueva
- [ ] `/verify` en **AMBAS rutas** (admin y secretaria), 390×844, 1440×900 y 768 de alto, **en
      CADA tab**, no solo la default
- [ ] QA visual exhaustivo con el owner del producto antes de cerrar — no basta con ACs en verde
      automatizados (lección de spec 0030: el QA geométrico no reemplaza la mirada humana,
      hicieron falta 2 rondas de feedback real después de un "cierre" con todo verde)
- [ ] Confirmar con captura antes/después que NINGUNA acción de la ficha se perdió al mover a tabs
- [ ] Realtime/SWR: si esta ficha tiene datos con Realtime, probar reset de scroll (ítem 6 de
      "Edge cases estresados")

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/alumnos/:id`
- `specs/assignments/ASG-b-084-app-like-instructor-ficha-piloto.md` — patrón de tabs a reusar
- Memoria de proyecto `project-asistencia-b-layout-dual-spec0030` — lección de QA geométrico vs
  mirada humana, aplicable directamente acá por el riesgo

## Archivos involucrados

- `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`
