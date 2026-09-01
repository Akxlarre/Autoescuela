# Fix: spec de cuadratura llama a un método que fue renombrado (fix-080 sin cobertura)

> id: fix-154-b-spec-cuadratura-metodo-renombrado
> refs: fix-080 (comportamiento protegido), spec 0004-i (refactor que causó el drift)
> status: done
> created: 2026-09-01

## Root Cause

`secretaria-contabilidad-cuadratura.component.spec.ts:55` llama `(component as any).openIngresoDrawer()`
y falla con `TypeError: component.openIngresoDrawer is not a function`.

El método **no desapareció: se renombró** a `abrirDrawerIngreso()` en el commit `eb91d035`
("corrige paridad de Secretaría/Admin en varias vistas"), que unificó la nomenclatura de los
handlers de drawer del componente (`abrirDrawerArqueo`, `abrirDrawerIngreso`, `abrirDrawerEgreso`).
El spec quedó apuntando al nombre viejo.

**El `as any` del test es lo que dejó pasar el drift.** Los métodos son `protected`, así que el
spec castea a `any` para llamarlos — y eso desactiva la verificación de TypeScript justo en la
línea que habría fallado en compilación al renombrar. El rename se propagó al template y al
componente, pero no al spec, y nadie se enteró.

## Por qué NO se borra el describe

El comportamiento que fix-080 protege **sigue vivo y sigue siendo frágil**. `abrirDrawerIngreso()`
hace exactamente las tres cosas que el test asevera:

```typescript
protected abrirDrawerIngreso(): void {
  this.pagosFacade.seleccionarParaPago(null);
  // Sin initialize(), alumnosConDeuda() está vacío y el drawer en modo global no puede
  // poblar el <select> de alumno (fix-080-m).
  void this.pagosFacade.initialize();
  this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Ingreso', 'trending-up');
}
```

Ese `initialize()` es precisamente lo que fix-080-m agregó, y su propio comentario explica que sin
él el `<select>` de alumno queda vacío. Borrar el describe habría dejado ese bug sin red de
seguridad — y es la **única** cobertura que tiene: el spec del gemelo admin
(`admin-contabilidad-cuadratura.component.spec.ts`) cubre otra cosa (branch-gate de fix-212-m), no
este comportamiento.

## Cambio

- **Archivo:** `src/app/features/secretaria/contabilidad-cuadratura/secretaria-contabilidad-cuadratura.component.spec.ts`
- **Qué cambia:** el test llama `abrirDrawerIngreso()` en vez de `openIngresoDrawer()`, y el
  `describe` se renombra para reflejar el nombre actual sin perder la referencia a fix-080.

## Test de Regresión

- `secretaria-contabilidad-cuadratura.component.spec.ts > abrirDrawerIngreso (fix-080) > llama pagosFacade.seleccionarParaPago(null) e initialize() antes de abrir el drawer` ✓

### Verificado con test de mutación (2026-09-01)

Un test que pasa no prueba que proteja algo — podría estar pasando vacuamente. Como el objetivo
declarado de este fix es **restaurar cobertura**, se verificó que el test efectivamente falla ante
la regresión que dice cubrir:

| Estado del componente | Resultado |
|---|---|
| `void this.pagosFacade.initialize()` presente | **1 passed** ✓ |
| Esa línea comentada (mutación temporal) | **1 failed** ✓ |

Es decir: el test detecta exactamente la regresión de fix-080-m (el `<select>` de alumno vacío por
falta de `initialize()`). La mutación se revirtió con `git checkout --` y se confirmó que el
componente quedó sin modificar.

## Notas — deuda relacionada que NO se toca acá

El gemelo admin (`admin-contabilidad-cuadratura.component.ts:126`) tiene su propio
`abrirDrawerIngreso()` y **no** tiene test de este comportamiento. Queda fuera del alcance de este
fix (un fix = una causa raíz), pero vale registrarlo: la paridad Secretaría/Admin que persigue
`eb91d035` no está cubierta simétricamente por tests.
