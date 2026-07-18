# Hotfix: TS2345: handlers onLogoSelected/onOgSelected/onHeroMediaSelected usan Event en lugar de File
> id: hotfix-001-b-ts2345-handlers-fileselected-usan-event
> status: done
> closed: 2026-05-24
> created: 2026-05-24

## Problema
Los handlers de `(fileSelected)` en `admin-configuracion-web.component.ts` están tipados como `(event: Event)` pero el output del componente `app-media-upload-control` emite `File` directamente.

## Cambio
- **Archivo:** `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts`
- **Qué cambia:** Firmas de `onLogoSelected`, `onOgSelected` y `onHeroMediaSelected` de `(event: Event)` a `(file: File)`, eliminando el casting innecesario de `event.target`.
