# fix-036-m — Iniciar Clase: no permite kilometraje inicial en 0

## Contexto

El dueño reportó que al iniciar una clase con un vehículo nuevo (0 km
registrados, tanto en el odómetro real como en la BD), el drawer "Iniciar
Clase" no deja avanzar: el campo "Kilometraje Actual" se pre-llena con `0`
pero el formulario queda inválido, mostrando "Ingrese un valor válido
(mayor a 0)" y el botón "Comenzar Clase" permanece deshabilitado.

## Causa raíz

`admin-iniciar-clase-drawer.component.ts:220`:

```ts
kmStart: [currentKm, [Validators.required, Validators.min(1), Validators.max(999999)]],
```

`Validators.min(1)` exige que el kilometraje inicial sea **como mínimo 1**,
pero un vehículo recién ingresado a la flota legítimamente puede tener
`currentKm = 0`. El mensaje de error en el template (línea ~148,
"Ingrese un valor válido (mayor a 0)") refuerza el mismo supuesto
incorrecto.

## Alcance

En `admin-iniciar-clase-drawer.component.ts`:

1. Cambiar `Validators.min(1)` → `Validators.min(0)` (línea 220).
2. Ajustar el mensaje de error asociado (línea ~148) de
   "Ingrese un valor válido (mayor a 0)" a algo que no asuma que 0 es
   inválido (ej: "Ingrese un valor válido").

No se toca `admin-finalizar-clase-drawer.component.ts` — ahí el mínimo de
1 km sí tiene sentido porque exige que el kilometraje final sea **mayor**
al inicial (`cls.kmStart`), no un mínimo absoluto de 1.

## Acceptance Criteria

- [x] AC0: Con un vehículo de 0 km, el campo "Kilometraje Actual" con
  valor `0` es válido y el botón "Comenzar Clase" se habilita (con el
  resto de campos completos). `Validators.min(0)` lo permite.
- [x] AC1: Un valor negativo sigue siendo inválido — `Validators.min(0)`
  sigue rechazando negativos.
- [x] AC2: El máximo de 999.999 km sigue funcionando igual — no se tocó
  `Validators.max(999999)`.

## Cierre

`tsc --noEmit` sin errores. Verificación visual confirmada por el dueño en
vivo: vehículo con 0 km ahora permite iniciar la clase. Fix cerrado.

## Test de regresión

Cambio de un `Validator` en un Smart Component (drawer) — se verifica con
`tsc --noEmit` + verificación visual manual (Playwright MCP no disponible
en este entorno) a confirmar por el dueño: iniciar clase con vehículo de
0 km debe habilitar "Comenzar Clase".
