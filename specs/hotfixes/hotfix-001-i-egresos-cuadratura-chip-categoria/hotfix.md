# Hotfix: Jerarquía visual de "Egresos / Retiros" en Cuadratura
> id: hotfix-001-i-egresos-cuadratura-chip-categoria
> refs: —
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Problema
La fila de cada egreso en `cuadratura-content.component.ts` muestra la categoría (ej.
"Combustible") como texto plano gris antepuesto a la descripción ("Combustible — plata"), sin
jerarquía visual. Se ve pobre comparado con el resto del panel (chips/badges usados en otras
secciones de Cuadratura y del DS).

## Cambios
- **Archivo:** `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts` —
  reemplazar el prefijo de texto plano `{{ label }} —` por un chip/badge con ícono de categoría
  (reutilizando tokens del DS, sin colores hardcodeados), manteniendo la descripción libre al
  lado. Sin cambios de datos/Facade — puramente presentacional sobre `categoryLabel()` ya
  existente (fix-006-i).
- **Implementado:** nuevo `categoryIcon()` (mismo patrón que `categoryLabel()`, `Record` con
  fallback `'tag'`) — `fuel` para combustible, `receipt` para gasto. La columna MOTIVO ahora
  muestra un ícono circular (`bg-warning/10`) + `<app-badge variant="neutral">` con la etiqueta
  + la descripción libre, en vez del texto gris antepuesto.
- **`src/app/app.config.ts`**: registrado el ícono `Fuel` (Lucide) en `provideIcons()` — no
  estaba en el pick set.
- **Test:** `cuadratura-content.component.spec.ts` — 4 tests nuevos para `categoryIcon()`
  (paralelos a los ya existentes de `categoryLabel()`). 8/8 verdes.
- Verificación: `npx tsc --noEmit` limpio, `npx ng build --configuration=development` exitoso,
  `npm run lint:arch` exit 0 (sin nuevos warnings; el único ARCH-09 sobre este archivo es
  preexistente por tamaño de clase, no relacionado a este cambio).
