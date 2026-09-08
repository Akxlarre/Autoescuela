# Fix: Cerrar el hueco de ARCH-08 (colores hardcodeados) + guardrail de card ad-hoc
> id: fix-160-b-guardrail-colores-hardcodeados-y-card-adhoc
> refs: fix-158-b-rediseno-cards-alumnos, fix-159-b-rollout-cards-alumnos-profesional-y-ex-alumnos
> status: done
> closed: 2026-09-08
> created: 2026-09-08

## Root Cause
`visual-system.md` prohíbe los colores hardcodeados y nombra explícitamente `bg-[#ff0000]`,
pero la regex de ARCH-08 sólo matchea colores de **paleta con número**:

```
/(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|...)-\d{2,3}/
```

No cubre `bg-white`, `text-black` ni el hex arbitrario `bg-[#hex]` que la propia regla nombra.
Por eso `npm run lint:arch` da **exit 0** con un bug de contraste real adentro:
en `flota-list-content` la patente del vehículo se pinta con `bg-white` hardcodeado y hereda
`color: rgb(244,244,245)` del tema oscuro → **contraste 1.05:1, texto invisible en dark mode**
(verificado en el navegador, no inferido de la lectura).

Ese es el mismo mecanismo que produjo las 221 instancias ad-hoc de overline documentadas en
`visual-system.md`: **una regla que existe sólo en la prosa se erosiona.** La composición
ad-hoc de card (`bg-base border border-border-subtle rounded-xl` en vez de `.card`) no tiene
guard de ningún tipo, y ya lleva 20 ocurrencias en 14 archivos.

Además la regex de ARCH-08 está **escrita dos veces** (una para `.ts`, otra para `.html`) —
la misma duplicación que ARCH-24 dejó como criterio: si va a vivir en más de un lugar,
escribila una sola vez en un módulo común.

## ACs Afectados
- Ninguno — fix de harness. Habilita el rollout de cards (los 11 archivos restantes) con el
  linter como red de seguridad en vez de grep manual.
- **Excepción declarada:** el guard nuevo delató las 3 cards creadas en fix-158-b/fix-159-b
  (`alumno-card`, `alumno-profesional-card`, `egresado-card`), que usaban `text-white` en el
  avatar. Se corrigen acá porque son código de esta misma sesión y la corrección es estricta-
  mente mejor: `AVATAR_PALETTES` ya declara el `text` de cada entrada, así que se pasa a
  `[style.color]="palette().text"` — usa la fuente de verdad en vez de asumir blanco.

## Cambio
- **Archivo nuevo:** `scripts/lib/hardcoded-colors.js` — implementación única de ARCH-08,
  ampliada a `white`/`black`/`transparent`-sobre-color y hex arbitrario (`bg-[#...]`).
  Reemplaza las DOS regex duplicadas de `architect.js`. Con `.test.mjs` y modo CLI standalone.
- **Archivo nuevo:** `scripts/lib/hardcoded-colors.test.mjs` — micro-suite.
- **Archivo nuevo:** `scripts/lib/card-composition.js` — ARCH-25: detecta la composición
  ad-hoc de card (borde+radio+fondo a mano) donde corresponde `.card`. **Ratchet**, no error
  duro: arranca con el conteo actual como cuota y sólo puede bajar (mismo patrón que
  ARCH-16/ARCH-19). Con `.test.mjs`.
- **Archivo nuevo:** `scripts/lib/card-composition.test.mjs` — micro-suite.
- **Archivo nuevo:** `scripts/harness/patch-architect-arch25.js` — cableado en el archivo
  protegido. **Lo corre una PERSONA, no el agente** (precedente `patch-architect-arch24.js`:
  un agente no debe poder cambiar los guardrails que lo evalúan).

## 2ª pasada — corrección de un error propio (ARCH-26)
La 1ª pasada amplió ARCH-08 manteniéndola como **error duro**. Resultado: `lint:arch` pasó
de exit 0 a **exit 1 con 27 hallazgos**. Al revisarlos uno por uno, la mayoría era legítima:

| Caso | Veredicto |
|---|---|
| `bg-white` en `<iframe>` de PDF (dms-doc-preview, route-sheet) | Legítimo: es el papel |
| `bg-white` con `opacity-10` (daily-schedule-timeline) | Legítimo: velo, no superficie |
| `bg-white` en perilla de toggle (arqueo-cierre) | Legítimo por convención |
| 20 × `text-white` | Texto sobre gradiente de marca |
| **`bg-white` en flota-list-content** | **El único bug real** |

Dejar el linter en rojo con hallazgos mayormente correctos es exactamente cómo un guardrail
se vuelve ruido — la advertencia que yo mismo escribí en el header de `card-composition.js`
y que igual pisé una regla después. Corregido separando:
- **ARCH-08** (error duro): sólo colores de paleta (`text-red-500`). Nunca son correctos;
  el repo ya está en cero.
- **ARCH-26** (ratchet): absolutos opacos + hex arbitrario. Son *a veces* correctos.
  Los velos (`/50`, `opacity-N`) quedan fuera **por regla, no por excepción**.

## Test de Regresión
- `node scripts/lib/hardcoded-colors.test.mjs` → **20 verdes**
- `node scripts/lib/card-composition.test.mjs` → **16 verdes**
- `node scripts/lib/class-discipline.test.mjs` → verde
- `npm run lint:arch` → **exit 0** con ambos patches aplicados y el baseline sellado.
  Los 173 warnings restantes (ARCH-09/10/11) son backlog pre-existente, igual que antes.
- **Bug de Flota corregido y verificado en el navegador:** contraste **1.05:1 → 16.12:1**
  en modo oscuro, legible también en claro.

### Cuotas selladas del ratchet
`ARCH-15: 14` · `ARCH-16: 76` · `ARCH-17: 0` · `ARCH-19: 102` · `ARCH-25: 137` · `ARCH-26: 26`

### Trampa en la que caí (vale documentarla)
Al comentar el fix en `flota-list-content` usé **backticks dentro de un comentario HTML
adentro del `template:` literal** — cierran el string. `visual-system.md` ya lo documenta, y
el síntoma fue el descrito ahí: errores de sintaxis en líneas no relacionadas y `ng serve`
sirviendo un bundle stale en silencio (el navegador mostró el `bg-white` viejo y por un rato
medí el elemento equivocado creyendo que el fix no había funcionado).

## Aplicación (ya aplicada en esta sesión, con visto bueno explícito del owner)
```
node scripts/harness/patch-architect-arch08-arch25.js
node scripts/harness/patch-architect-arch26.js
npm run lint:arch -- --update-ds-baseline
```
