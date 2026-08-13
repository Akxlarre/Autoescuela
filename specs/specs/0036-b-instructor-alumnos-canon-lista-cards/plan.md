# Plan 0036-b — "Mis Alumnos" (instructor) alineado al canon de Base Alumnos

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-12
> **Talla:** S (pequeño) — toca 2 archivos existentes, sin facade/migración nueva, sin
> nuevo dominio. Las 2 decisiones abiertas de `spec.md` §9 se resuelven acá mismo (abajo)
> aplicando paridad exacta con el comportamiento actual, no quedan ambiguas.

---

## Decisiones (resuelven spec.md §9)

1. **¿Teléfono/email en la tabla?** → **No.** Las cards de hoy NO muestran
   teléfono/email (solo aparecen en el drawer de detalle). La tabla mantiene paridad
   exacta: Nombre+RUT / Curso / Progreso / Próxima Clase / Estado. Cambiar esto sería
   agregar alcance no pedido — si se quiere después, es un fix aparte.
2. **¿Columna "Acciones" o fila completa clickeable?** → **Fila completa clickeable**
   (igual que la card hoy: todo el `<div class="student-card">` tiene `(click)`, "Ficha"
   es solo texto decorativo con chevron, no un botón separado). La tabla replica esto:
   `<tr (click)="openDetail(s)">` con cursor pointer, sin columna de acciones dedicada.

---

## 1. Resumen ejecutivo

Reemplazar el `.bento-grid` de cards-siempre de `InstructorAlumnosComponent` por el patrón
dual-viewport ya usado en `admin-instructores`/`admin-secretarias`: `<table>` real en
desktop (`.hide-on-squeeze`, sin paginar, scroll interno vía `.bento-fill`) + las cards que
ya existen hoy en mobile/tablet (`.show-on-squeeze`, sin tocar su HTML — ya tienen
`sliceByBudget`+"Cargar más" de fix-139-b). Un solo componente, dos vistas condicionadas
por `@container` — mismo mecanismo que sus 2 pares admin.

---

## 2. Inventario de impacto

### Archivos a CREAR

Ninguno.

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/instructor/alumnos/instructor-alumnos.component.ts` | Envolver el contenido en `dual-viewport-container`; agregar vista `<table>` desktop (`.hide-on-squeeze`) que consume `filteredStudents()` completo (sin `sliceByBudget`, scroll interno); marcar el grid de cards existente como `.show-on-squeeze` (sin cambios internos a las cards). Agregar CSS `@container` (mismo bloque que `admin-instructores.component.ts`). | Alinear al canon dual-viewport, resolver AC1–AC5 |
| `src/app/features/instructor/alumnos/instructor-alumnos.component.spec.ts` | Sin cambios de aserciones (la lógica de densidad — `maxVisible`/`visibleStudents`/`remainingStudents` — sigue igual, solo aplica a la vista mobile ahora). Se deja como está; si `/verify` revela una regresión de esa lógica se ajusta ahí, no se reescribe de cero. | Confirmar que fix-139-b no se rompe |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- Patrón `dual-viewport-container` + `.hide-on-squeeze`/`.show-on-squeeze` +
  `@container instructorContainer` — copiado literal de
  `admin-instructores.component.ts` (mismo mecanismo, container query propio del
  componente, no depende del tier global de `LayoutService`).
- `StudentDrawerDetailComponent` — sin cambios, se sigue abriendo igual desde
  `openDetail()`.
- `<app-empty-state>`, `<app-skeleton-block>`, `<p-tag>`, `<app-icon>` — sin cambios.

### Facades/Services existentes que extendemos
- Ninguno — `InstructorAlumnosFacade` no cambia (spec explícitamente fuera de alcance).
- `filteredStudents()` (computed ya existente) se reutiliza tal cual para ambas vistas
  (la tabla consume la lista completa, las cards consumen `visibleStudents()` que ya
  deriva de `filteredStudents()` + densidad).

### Componentes/Facades que NO existen y debemos crear
- Ninguno. No se justifica extraer un componente `shared/` nuevo — ver spec.md §4
  (out of scope) para el razonamiento (modelos de datos distintos entre "Base Alumnos" y
  "Mis Alumnos", mismo precedente que `admin-instructores`/`secretaria-instructores` no
  comparten componente pese a ser casi-clones).

---

## 4. Modelo de datos

N/A — sin cambios de persistencia, RLS, ni modelos DTO/UI.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
InstructorAlumnosComponent (Smart, sin cambios de Facade)
  ├─ filteredStudents() [computed existente, sin cambios]
  ├─ visibleStudents()/remainingStudents()/loadMoreStudents() [fix-139-b, sin cambios]
  │
  ├─ VISTA DESKTOP (.hide-on-squeeze, nueva)
  │    <table> ← filteredStudents() completo, sin paginar, scroll interno (.bento-fill)
  │    (click) en <tr> → openDetail(s)
  │
  └─ VISTA MOBILE/TABLET (.show-on-squeeze, ya existente — grid de cards de hoy)
       <div class="bento-grid"> ← visibleStudents() (sliceByBudget)
       (click) en card → openDetail(s)
```

### Capas tocadas

- **Smart**: `features/instructor/alumnos/instructor-alumnos.component.ts` (único
  archivo con cambios reales).
- **Dumb**: ninguno nuevo.
- **Facade**: `InstructorAlumnosFacade` — sin cambios.
- **Service**: N/A.
- **Migration**: N/A.

---

## 6. Restricciones aplicables

Reglas aplicables: `architecture.md` (Smart component, OnPush ya vigente, sin tocar
Facade), `visual-system.md` (reutiliza clases del canon dual-viewport existente, sin
tokens nuevos), `testing-tdd.md` (sin `computed()` nuevo con decisión — la tabla consume
signals ya testeados en fix-139-b, no requiere `.spec.ts` adicional salvo que `/verify`
revele lo contrario).

---

## 7. Plan de testing

- Tests unitarios: ninguno nuevo esperado (sin lógica nueva — la tabla es un
  `@for` sobre un signal ya cubierto por `instructor-alumnos.component.spec.ts`
  existente). Si la implementación termina agregando algún `computed()` de decisión
  (ej. para ordenar columnas), se le agrega test en ese momento, no antes.
- QA manual (`/verify`): 390×844 (debe verse igual que hoy — cards), 1024×768 y 1440×900
  (debe verse la tabla nueva, sin paginar, scroll interno), click en fila → abre drawer,
  buscador/filtros/sort funcionando en ambas vistas, `force-compact` con drawer abierto
  (angosta el contenedor → debe caer a vista cards vía el `@container` propio, no vía
  `LayoutService.tier()` global — verificar que ambos mecanismos no choquen).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El `@container` propio (`instructorContainer`) y el `LayoutService.tier()` global (usado por `mobileShown`/`maxVisible` de fix-139-b) miden anchos distintos — la tabla podría aparecer mientras las cards siguen en modo "cargar más" de mobile, o viceversa, generando un estado inconsistente en el breakpoint de transición. | Media | Verificar en `/verify` el rango 850–1024px (breakpoint del `@container` es 850px, el de `LayoutService` es 1024px) — si hay una zona donde se ve mal, ajustar el breakpoint del `@container` a 1024px para que coincida (mismo valor que usa `admin-instructores`, que ya convive con este mismo mecanismo dual sin problema documentado). |
| La tabla sin paginar con muchos alumnos (instructor con 50+ alumnos asignados, caso raro pero posible) reintroduce el riesgo de "dataset grande sin límite" ya investigado en ASG-b-087/088 para otras páginas. | Baja | Mismo patrón que `admin-instructores` (tabla completa + scroll interno) — no se bloquea por esto, consistente con la decisión ya tomada para esa página hermana. Si se vuelve un problema real, es un fix aparte (no bloquea este spec). |

---

## 9. Orden de implementación

1. Envolver el `.bento-banner` en `dual-viewport-container`, agregar el CSS `@container`
   (copiado de `admin-instructores.component.ts`).
2. Agregar la vista `<table>` desktop (`.hide-on-squeeze`) con las 5 columnas decididas
   arriba, consumiendo `filteredStudents()`.
3. Envolver el grid de cards existente en `.show-on-squeeze` (sin tocar su HTML interno).
4. `/verify` en 390×844, 850×900 (breakpoint), 1024×768, 1440×900 — golden path +
   `force-compact`.
5. Ajustar breakpoint del `@container` si el riesgo #1 se confirma.
6. `npm run test:ci` + `npm run lint:arch` + `npx tsc --noEmit`.

---

## 10. Estimación

S — medio día.

---

## Changelog

- 2026-08-12 — plan inicial, talla S, 2 decisiones abiertas de spec.md resueltas acá.
