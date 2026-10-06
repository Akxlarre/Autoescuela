# Fix: La sede al entrar y salir de las pantallas de Clase Profesional
> id: fix-334-m-sede-al-entrar-y-salir-de-profesional
> refs: ASG-i-025 · fix-319-m (A07, A09, A10, A11 · S22 · D13, D14)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause

Las ~18 pantallas de Clase Profesional llaman `BranchFacade.setProfessionalOnly(true)` al montarse
y `(false)` al desmontarse. Ese método tiene tres defectos con una sola causa: **trata la sede
"forzada" por la pantalla como si fuera la elección del usuario, y la calcula una sola vez**.

1. **Al entrar** cambia la sede visible a la Profesional sin guardarla, pero **solo si la lista de
   sedes ya está cargada**. Tras un F5 (o al abrir la URL directo) la lista todavía es el "stub"
   de una sede sacado de `localStorage` (`hasProfessional: false`), no encuentra sede Profesional
   y la deja como está. Nadie la vuelve a evaluar cuando `loadBranches()` termina.
   - Desde "Todas" → menú → F5: la pantalla queda en "Todas las sedes" con "Programar Promoción"
     habilitado → una promoción creada así quedaría con `branch_id = null`.
   - URL/marcador con Autoescuela Chillán guardada: queda en Autoescuela, "0 matrículas".
2. **Al salir** pone la sede en `null` ("Todas") **sin guardarlo**: el selector muestra "Todas",
   pero tras F5 vuelve la que estaba guardada. Además pierde la sede que el usuario tenía antes
   de entrar (D14 pide volver a esa).
3. Aparte, el modal "Conmutar Sede" del sidebar cambia la sede pero **no navega** al ítem
   cliqueado (D13 pide navegar).

## ACs Afectados

Ninguno de spec — fix autónomo derivado del testing de `fix-319-m`. Cierra:

- **A10 / S22:** al entrar a una pantalla Profesional (menú, F5, URL directa, marcador), el
  selector termina **siempre** en la sede Profesional antes de cargar datos.
- **A09 / D14:** al salir, el selector vuelve a la sede que había **antes de entrar** ("Todas" si
  era "Todas"), y lo guardado coincide con lo que se ve (F5 después de salir no cambia nada).
- **A07 / A11 / D13:** aceptar "Conmutar Sede" cambia la sede **y navega** al ítem cliqueado.

## Cambio

- **`core/facades/branch.facade.ts`**
  - `ensureBranchesLoaded()`: espera la lista real de sedes; reutiliza la carga en curso en vez de
    duplicarla (`loadBranches()` comparte su promesa).
  - `setProfessionalOnly(true)` recuerda la sede previa (solo al entrar, no si ya estaba en modo
    Profesional: Pre-inscritos embebido lo vuelve a llamar) y aplica la Profesional **en memoria,
    sin guardarla** — lo guardado sigue siendo la elección del usuario.
  - `setProfessionalOnly(false)` vuelve a la sede previa y la guarda (`selectBranch`).
  - `loadBranches()` reaplica la sede Profesional si el modo está activo (red de seguridad).
- **`core/guards/professional-branch.guard.ts`**: quien tiene selector (admin, secretaria con
  grant) entra **después** de `ensureBranchesLoaded()`, así `setProfessionalOnly(true)` encuentra
  la sede en `ngOnInit` y la primera consulta ya sale con la sede correcta (los facades
  Profesional no tienen `createRequestGuard`). La rama de secretaria sin grant usa lo mismo en vez
  de `branches().length === 0`, que el stub de `localStorage` hacía saltar.
- **`app.routes.ts`**: `professionalBranchGuard` en las rutas de admin que llaman
  `setProfessionalOnly` (hoy solo lo tenían las de secretaria).
- **`layout/sidebar.component.ts`**: tras "Conmutar Sede", navega al `routerLink` del ítem.

## Test de Regresión

- `src/app/core/facades/branch.facade.spec.ts > modo Profesional — fix-334-m` (sede previa, sin
  persistir al entrar, restaurar y persistir al salir, reaplicar tras `loadBranches`, llamada
  anidada, `ensureBranchesLoaded` sin duplicar la consulta) ✓
- `src/app/core/guards/professional-branch.guard.spec.ts` — admin y secretaria con grant esperan
  la carga de sedes ✓
- Navegador (Playwright MCP): los 3 caminos de A10 (menú desde "Todas" + F5, URL con Autoescuela
  guardada, conmutar + F5), A09 (salir → sede previa, F5 igual) y A07 (conmutar navega) ✓

### Verificación (2026-10-06)

- `branch.facade.spec.ts` + `professional-branch.guard.spec.ts`: 49/49 (13 nuevos; en rojo antes
  del cambio). Suite completa: 3312 ✓ / 0 ✗ (antes 3299). `tsc` sin errores; `lint:arch` sin
  errores nuevos.
- Navegador, admin:
  - Desde "Todas" → menú Promociones: Conductores, guardada "Todas" → **F5: Conductores**, 5
    promociones → salir a Base B: "Todas" → F5: "Todas".
  - Autoescuela guardada + URL directa a Base Prof. / Libro / Promociones: **Conductores** en las
    tres (64 matrículas, 5 promociones) → salir: Autoescuela, guardada Autoescuela.
  - Red: tras el F5 **todas** las consultas salen con `branch_id=eq.2` (ninguna con la sede 1).
  - Autoescuela → clic en Libro de Clases → "Conmutar Sede" → abre `/app/admin/libro-de-clases`
    en Conductores (D13).
- Secretarias: secretariaB entra a Base Prof. y Libro; secretariaA (sede sin Profesional) sigue
  redirigida a `/app/secretaria/dashboard`; multisede con Autoescuela guardada + URL directa →
  Conductores, y al salir vuelve a Autoescuela.
- Nota de comportamiento: "Conmutar Sede" es una elección explícita y se guarda, así que al salir
  de Profesional después de conmutar se vuelve a Conductores (es la sede que había al entrar).
