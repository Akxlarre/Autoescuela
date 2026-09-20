# Asignación ASG-i-010 — Pantalla de aviso "módulo no habilitado todavía" (piloto)

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** hotfix
> **priority:** P2
> **created:** 2026-09-15
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-09-19
> **resulting_track:** fix-255-m-piloto-guard-fase-portales-inscripcion

---

## Contexto / Objetivo

Complementa ASG-i-008 y ASG-i-009. Cuando el guard de fase bloquee una ruta oculta (por URL
directa, un bookmark viejo, o alguien escribiendo la ruta a mano), **no debe caer en
`acceso-denegado`** — esa pantalla está pensada para "no tenés permiso" (error de rol), y el
caso real acá es distinto: "el módulo existe, pero no está habilitado en esta fase todavía".
Mostrar el mensaje equivocado va a generar tickets de soporte confundiendo un bug de permisos
con una decisión de producto.

## Alcance sugerido

- Componente/página nueva y simple (puede ser una variante liviana de
  `features/not-found/not-found.component.ts` o `features/acceso-denegado/`, evaluar cuál se
  parece más antes de crear uno desde cero) con un mensaje tipo "Este módulo estará disponible
  próximamente" + un botón para volver al dashboard del rol actual.
- El guard de fase (ASG-i-008) redirige acá en vez de a `acceso-denegado` cuando el motivo del
  bloqueo es "fase", no "rol incorrecto".
- Copy en español neutro/chileno del proyecto, sin tecnicismos ("feature flag", "fase 1") — el
  usuario final no necesita saber la jerga interna.

## Fuera de alcance

- No es una landing de marketing ni necesita diseño elaborado — es una pantalla de cortesía,
  tratamiento simple, coherente con el resto de la app (tokens del DS, no colores arbitrarios).

## Referencias

- `src/app/features/acceso-denegado/acceso-denegado.component.ts` (para no duplicar estilo)
- `src/app/features/not-found/not-found.component.ts` (para no duplicar estilo)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/` (componente nuevo, nombre a definir por quien reclame)
- `src/app/app.routes.ts` (agregar la ruta del aviso — mismo archivo que ASG-i-008/009)

## Notas para quien la reclame

- Depende del guard que se diseñe en ASG-i-008 — coordinar quién lo reclama primero, o
  reclamar ambas juntas en el mismo track si el mismo dev las va a hacer de una.
