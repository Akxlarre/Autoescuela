# Hotfix: Las pestañas se parten en dos líneas en vez de abreviarse
> id: hotfix-170-m-pestanas-sin-partirse
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Problema
`app-tabs` (variante `line`) elige entre etiqueta completa, corta, solo ícono o desplegable según
lo que cabe. Medía el ancho **total** del texto, pero dibuja cada pestaña con `flex-1` (todas del
mismo ancho). Si el total cabía pero la pestaña más larga no cabía en su parte, el texto se partía
en dos líneas con el ícono separado, en vez de pasar a la etiqueta corta. Visto en Configuración
web a 1440 px: "Cursos & Precios" y "Contacto & Horas" en dos líneas (N7 de `fix-485-m`).

## Cambios
- **Archivo:** `src/app/core/utils/subnav-tier.utils.ts` (+ spec) — `fitsEqualColumns(anchos,
  disponible)`: con columnas iguales, cabe si la más ancha × la cantidad entra en el disponible.
- **Archivo:** `src/app/shared/components/tabs/tabs.component.ts` — cada tier se mide con
  `fitsEqualColumns` sobre el ancho de cada pestaña medida.

## Verificación
- Test de `fitsEqualColumns`.
- Navegador (2026-11-07): Configuración web a 1440 px pasa a etiquetas cortas en una línea (captura `c485-18-tabs.png`); Tareas sigue con etiquetas completas en una línea.
