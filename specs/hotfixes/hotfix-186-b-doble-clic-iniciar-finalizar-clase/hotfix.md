# Hotfix: doble clic en "Comenzar Clase" / "Cerrar Clase" avisa "La clase cambió" sin que nadie la cambiara
> id: hotfix-186-b-doble-clic-iniciar-finalizar-clase
> refs: ASG-i-026 (fix-186-b, caso K18)
> status: done
> closed: 2026-11-10
> created: 2026-11-10

## Problema
Con doble clic, `onSubmit` / `onFinalize` corren dos veces: el botón se deshabilita recién en el
siguiente render. La BD aplica una sola acción (guard de estado de fix-388-m), pero la segunda
llamada cae en `StaleSessionError` y la secretaria ve "La clase cambió — Esta clase ya fue
iniciada, en otra pestaña o por otra persona", que es falso. Intermitente (depende del timing).

## Cambios
- **Archivo:** `src/app/features/admin/asistencia/admin-iniciar-clase-drawer.component.ts` — `onSubmit` sale si `isSubmitting()` ya está prendido.
- **Archivo:** `src/app/features/admin/asistencia/admin-finalizar-clase-drawer.component.ts` — `onFinalize` y `onCancelStart` salen si `isSubmitting()` ya está prendido.
- Regresión: `e2e/agenda-6.spec.ts` K18.
