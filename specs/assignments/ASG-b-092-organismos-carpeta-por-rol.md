# Asignación ASG-b-092 — Mudar los Organismos a una carpeta que refleje su rol

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** Baja
> **created:** 2026-08-15
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-09-07
> **resulting_track:** fix-156-b-guardrail-rol-dumb-organismo

> **Nota de reclamación (2026-09-07):** se generó como `fix`, no como `spec`, porque de las 3
> opciones planteadas abajo se eligió la que la propia ASG pedía evaluar primero — el **guardrail
> en `architect.js`**, sin mover archivos. Ese alcance no requiere ACs nuevos ni cambia contratos
> públicos.

## Resolución (2026-09-07) — ARCH-24, sin mover archivos

Resuelta por `fix-156-b`. **El residuo estructural (mover a `shared/organisms/` o por dominio) se
cierra como NO necesario, no como pendiente.** El objetivo declarado arriba era *"que la ubicación
comunique el rol, para que la regla se vuelva evidente en vez de tener que recordarse"*. Eso se
cumple sin mover un archivo: el rol ahora está **declarado explícitamente** en
`scripts/lib/shared-organisms.allowlist.json`, con justificación por entrada, y **verificado** por
ARCH-24 en el linter y en el guard de escritura. Un dev que abre `shared/components/` ya no
necesita leer el código de cada componente: mira el allowlist. Mover 6 archivos agregaría un diff
grande sin resolver nada que el allowlist no resuelva ya.

**Hallazgo que reencuadró la asignación:** el guardrail no faltaba — **existía, enforceando la
regla vieja**. `.claude/hooks/pre-write-guard.js` bloqueaba cualquier `inject(...Facade)` en
`shared/` (carpeta = rol), la versión previa a `fix-146-b`. El problema real no era estructura de
carpetas: era que `fix-146-b` corrigió la prosa y no el guard que la enforcea, dejando una
contradicción silenciosa que además bloqueaba escrituras legítimas. Bonus: el patrón del guard
matcheaba `LayoutDrawerFacadeService` (plomería de `core/services/ui/`), que inyectan 5 de los 8
componentes involucrados.

**Criterio reutilizable, más allá de este caso:** cuando una regla tiene un guard automatizado,
corregir la regla sin corregir el guard no deja la regla "documentada pendiente de implementar" —
deja dos leyes contradictorias, y la que gana es la del guard. Al corregir una regla, buscá qué
hook o script la enforcea. Y si va a vivir en más de un consumidor, escribila una vez en un módulo
común (acá: `scripts/lib/shared-roles.js`).

**Si alguien quiere reabrir el movimiento de carpetas**, que sea por un motivo nuevo (ej. `shared/`
creció tanto que navegarlo cuesta), no por el objetivo original de esta asignación — ese ya está
cubierto.

---

## Contexto / Objetivo

Residuo de `ASG-b-089` / `fix-146-b`. Ese track corrigió
`.claude/rules/architecture.md` para que distinga por **rol** en vez de por carpeta:

- **Dumb presentacional** → prohibido inyectar Facades.
- **Organismo de dominio** → puede inyectar el Facade de *su* dominio.

La regla ya es correcta, pero **la estructura de carpetas todavía no la refleja**: ambas
categorías conviven mezcladas en `shared/components/`. Un dev (o un agente) que abre esa
carpeta no puede distinguir un `app-icon` de un `detalle-cuadratura-modal` sin leer el
código de cada uno.

Objetivo: que la ubicación comunique el rol, para que la regla se vuelva evidente en vez de
tener que recordarse.

## Alcance sugerido

Decidir **primero** cuál de estas dos formas se adopta — no empezar a mover archivos sin eso:

1. **Carpeta por rol:** `shared/components/` queda solo con Dumb presentacionales, y los
   organismos se van a `shared/organisms/`. Simple y explícito; el diff es grande pero
   mecánico.
2. **Por dominio:** cada organismo se muda junto a su dominio (ej. el drawer de cuadratura
   cerca de contabilidad), dejando `shared/` puramente presentacional. Más coherente
   conceptualmente, pero hay que resolver dónde viven los que comparten admin y secretaría —
   que es justamente por lo que están en `shared/` hoy.

Después de decidir: mover, actualizar imports, y actualizar `indices/COMPONENTS.md` +
`indices/USAGE-MAP.md`.

## Preguntas abiertas

- ¿Vale la pena el diff? Es un refactor de pura legibilidad, sin efecto en runtime ni en el
  usuario final. Puede no compensar frente a otras prioridades.
- ¿Conviene un guardrail en `scripts/architect.js` que valide la regla nueva (Dumb no inyecta
  / Organismo solo su dominio) **en vez de** mudar carpetas? Un lint que lo verifique podría
  dar el mismo beneficio sin tocar un solo archivo de código. **Evaluar esta opción antes que
  las otras dos** — es más barata y más duradera.

## Archivos involucrados

- `src/app/shared/components/**` (los 6 organismos identificados en `fix-146-b`)
- `.claude/rules/architecture.md` (referencia; ya corregida, no re-litigar el criterio)
- `indices/COMPONENTS.md`, `indices/USAGE-MAP.md`

## Notas para quien la reclame

- **No es urgente ni bloqueante.** El problema de fondo (la regla mentía) ya se resolvió en
  `fix-146-b`. Esto es cosmética estructural.
- Leer la sección "Resolución" de `specs/assignments/ASG-b-089-facade-en-dumb-components.md`
  y la Root Cause de `specs/fixes/fix-146-b-facade-en-dumb-components/fix.md` antes de
  estimar — ahí está la evidencia de por qué los 6 organismos son legítimos, para no
  reabrir esa discusión desde cero.

## Referencias

- `specs/fixes/fix-146-b-facade-en-dumb-components/fix.md`
- `.claude/rules/architecture.md` §Smart vs Dumb Components
- `.claude/rules/facades.md` §7
