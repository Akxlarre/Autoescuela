# Fix: Publicar la web pisa "Por qué elegirnos" con textos fijos
> id: fix-491-m-publicar-no-pisa-por-que-elegirnos
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

`onSubmit()` de Configuración web arma `whyUs` con 6 textos escritos en el componente, sin mirar
lo guardado. Cada "Publicar" reemplazaba el contenido de "Por qué elegirnos" de la sede, aunque
nadie lo hubiera tocado (S16 de `fix-485-m`). El panel no tiene editor para esa sección, así que
no había forma de conservar un contenido propio.

Decisión D3 de `fix-485-m`: publicar conserva lo guardado; sin editor por ahora.

## ACs Afectados

- Ninguno de spec — hallazgo S16 del testing `fix-485-m` (decisión D3).

## Cambio

- **`core/utils/website-config.utils.ts` (nuevo):** `whyUsToPublish(guardado)` devuelve lo
  guardado; solo si la sede no tiene nada usa los 6 textos por defecto (`DEFAULT_WHY_US`, los
  mismos que antes iban fijos).
- **`features/admin/configuracion-web/admin-configuracion-web.component.ts`:** publica
  `whyUsToPublish(config().whyUs)`.

## Test de Regresión

- `core/utils/website-config.utils.spec.ts` ✓
