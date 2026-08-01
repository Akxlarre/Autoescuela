# Fix: escala tipográfica — eliminar tamaños ilegibles y cerrar el ratchet ARCH-17
> id: fix-082-b-escala-tipografica-legible
> refs: ASG-b-055
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

**[Heredado de ASG-b-055, a confirmar]:** `fix-032-m` migró 252 tamaños arbitrarios a la
escala del DS y dejó un baseline de 66 instancias residuales "que requieren decisión de
diseño". Reconteo verificado el 2026-07-31: **84 instancias en 27 archivos**, no 66 —
compuesto de tres categorías con causas distintas:

1. **8-9px (29 instancias)** — por debajo de `text-2xs` (10px), el "piso absoluto" que el
   propio DS ya declaró. No es decisión de diseño: es ilegible por definición del propio
   sistema.
2. **10-11px (15 instancias)** — drift puro. `fix-032-m` ya migró exactamente esta forma a
   `text-2xs`; que hayan vuelto significa que se escribieron **después** de esa migración,
   sin que el ratchet ARCH-17 lo notara (compara el TOTAL contra el baseline, no detecta
   "algo nuevo entró aunque el total global bajó" — mismo patrón de fallo que ASG-b-034
   documentó para `color-mix()`).
3. **13/15/17/22px (40 instancias)** — esta sí es decisión de diseño real: ¿encajarlos por
   redondeo a la escala existente, o formalizar un peldaño nuevo?

## ACs Afectados

Ninguno — fix autónomo, sin AC de spec previa.
Referencia: `specs/assignments/ASG-b-055-escala-tipografica-legible.md`.

## Archivos involucrados

- ~27 archivos con `text-[NNpx]` (lista exacta vía grep, ver Cambio)
- `scripts/lib/class-discipline.baseline.json` — re-baseline tras la migración

## Cambio

**84/84 instancias resueltas, 0 restantes.** Desglose:

### 1. Ilegibles + drift (44 instancias, sin decisión) — `scripts/migrate-illegible-text-sizes.mjs`

- 29 de 8-9px + 15 de 10-11px → `text-2xs` (el piso absoluto que el DS ya declaraba).
- Codemod idempotente, verificado con 2ª corrida = 0 cambios.
- **1 caso manual**: `admin-historial-pagos.component.ts:89` usaba `!text-[9px]` (prefijo
  `!important` de Tailwind) — el regex del codemod no lo capturaba porque el token real es
  `!text-[9px]`, no `text-[9px]`. Migrado a mano a `!text-2xs`.
- **2 casos manuales**: `vehicle-maintenances.component.ts:222` y
  `flota-list-content.component.ts:344` usaban `styleClass="text-[9px]..."` (prop de
  PrimeNG `<p-tag>`, no `class=""` nativo) — fuera del alcance del codemod (solo escaneaba
  `class="..."`). Migrados a mano a `styleClass="text-2xs..."`.

### 2. Decisión de diseño — 15/17/22px (7 instancias, confirmada por el usuario)

**Redondear a la escala existente**, no formalizar tokens nuevos para esto:

- `cuadratura-content.component.ts` — 4 totales de dinero (`font-black tabular-nums`, dos
  niveles jerárquicos): 22px → `text-xl` (×2), 17px → `text-lg` (×2).
- `liquidaciones-content.component.ts:623` — heading `text-[15px] font-bold` junto a un
  subtítulo `text-xs text-text-muted` (mismo shape que decenas de `.item-title` migrados en
  fix-078-b) → migrado a `.item-title` (clase canónica), no a un tamaño redondeado suelto.
- `public-contract.component.ts:147,155` — **no era decisión de escala, era el bug AP-013**
  (`text-[15px]` montado sobre `btn-primary`/`btn-secondary`, que ya definen
  `font-size: 0.875rem` como parte de su contrato — el override lo mutilaba). Se **eliminó**
  la clase de tamaño, restaurando el `font-size` propio del botón. No se tocó el `py-*`
  (padding) de esos mismos botones — también viola AP-013, pero es un hallazgo aparte fuera
  del alcance declarado de este fix (tamaños de texto, no padding).

### 3. Decisión de diseño — 13px (33 instancias, confirmada por el usuario)

**Formalizado un token nuevo: `--text-compact` (13px)**, no redondeado. Motivo verificado:
33 usos consistentes en **4 componentes contables** (`cuadratura-content`,
`historial-cuadraturas-content`, `detalle-cuadratura-modal`, `liquidaciones-content`), varios
dentro de tablas con `grid-template-columns` de **ancho fijo en píxeles** calibradas para
este tamaño exacto (ej. `80px 1fr 85px 85px 85px 85px 100px 36px`) — redondear a `sm` (14px)
arriesgaba overflow en columnas angostas; redondear a `xs` (12px) iba en contra del propio
propósito de este fix (dejar de reducir texto ya al límite). Solo 9 de 33 usos tienen
`tabular-nums` — el resto es texto descriptivo denso, no exclusivamente números, así que se
descartó un nombre semántico tipo "tabular" por engañoso para esos casos.

- `src/styles/tokens/_variables.scss` — nuevo `--text-compact: 0.8125rem` (13px), con
  comentario extenso explicando el motivo y el alcance ("NO usar fuera de UI densa tipo
  tabla").
- `src/tailwind.css` — bridge `@theme` (`--text-compact: var(--text-compact)`), mismo patrón
  que `--text-2xs` (sin par `--line-height`, se hereda).
- `scripts/migrate-text-13px-to-compact.mjs` (nuevo, idempotente) — 33 reemplazos en 4
  archivos. **Bug propio encontrado y corregido en el momento**: la primera versión del
  regex tenía `\b` al final (`/\btext-\[13px\]\b/g`), que nunca matchea porque `]` seguido de
  espacio/comilla son ambos caracteres no-palabra (no hay transición de boundary ahí) — 0
  reemplazos silenciosos en el dry-run. Corregido quitando los `\b` (el literal
  `text-[13px]` ya es inequívoco).

### 4. Ratchet ARCH-17 — baseline en 0

`npm run lint:arch -- --update-ds-baseline` → `ARCH-17: 0`. El ratchet ahora falla (warning,
no error — ver nota abajo) ante cualquier instancia nueva de `text-[NNpx]`.

**No promovido a error duro incondicional** (lo que sugería la Asignación): hoy
`checkClassDiscipline()` en `architect.js` usa `const report = STRICT ? reportError :
reportWarning;` de forma uniforme para ARCH-15/16/17/19 — diferenciar ARCH-17 del resto
requeriría otro cambio en `architect.js` (protegido, requiere al humano aplicar el patch).
Se deja como refinamiento opcional documentado, no bloqueante para cerrar este fix — el
baseline en 0 ya cumple el objetivo práctico (cualquier regresión se marca).

## Test de Regresión

- `npx tsc --noEmit` → sin errores.
- `npm run lint:arch -- --update-ds-baseline` → **ARCH-17: 0** (era 84). 0 errores.
- `grep -rho "text-\[[0-9]\+px\]" src/app --include="*.ts"` → **vacío** (0 instancias en
  todo `src/app`, verificado independientemente del codemod).
- `npm run lint:arch` → **exit 0**, 0 errores.
- `npm run test:ci` → **1651 passed, 3 skipped (pre-existentes), 0 failed, exit 0**
  (136/137 archivos, 248s). Idéntico al baseline — sin regresiones.
