# Fix: Precio incorrecto en banner de pre-inscripción profesional
> id: fix-011-b-precio-profesional-banner
> refs: 0009-rediseno-ux-flujo-inscripcion-online-publico
> status: done
> closed: 2026-06-09
> created: 2026-06-09

## Root Cause

El computed `context()` en `PublicEnrollmentComponent` busca el curso profesional con:

```typescript
course = opts.find((o) => o.category === 'professional')
```

Esto toma el **primer** curso profesional del catálogo (A2, A3, A4 o A5 según el orden en
BD). El alumno no ha elegido el subtipo de licencia todavía — el precio mostrado en el
banner puede no corresponder al curso que finalmente contrate.

Dado que el flujo profesional es una pre-inscripción (la escuela contacta al alumno para
definir el curso concreto), el precio específico de un subtipo es engañoso.

## ACs Afectados

- Ninguno en spec 0009 (edge case no cubierto) — fix autónomo.

## Cambio

- **Archivo:** `src/app/features/public-enrollment/public-enrollment.component.ts`
- **Qué cambia:** En el computed `context()`, cuando `flow === 'professional'`, calcular
  el precio mínimo entre todos los cursos profesionales disponibles y mostrar la etiqueta
  como `"desde $X"`. Si todos tienen el mismo precio, mostrar el precio directo sin
  el prefijo.

## Test de Regresión

- Test visual / computed en `public-enrollment.component.ts`:
  - Si hay cursos profesionales con precios distintos → `priceLabel` empieza con `"desde "`
  - Si todos tienen el mismo precio → `priceLabel` muestra el precio sin prefijo
  - Si `flow === 'class_b'` → `priceLabel` no tiene prefijo (comportamiento actual intacto)
