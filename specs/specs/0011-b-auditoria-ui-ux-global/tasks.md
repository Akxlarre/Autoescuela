# Tasks — 0011-b Auditoría UI/UX Global

> Inventario de issues del barrido responsive (Playwright). Severidad: 🔴 Blocker · 🟠 Mayor · 🟡 Menor · ⚪ Cosmético.
> Metodología: por cada step × viewport → check de overflow programático + screenshot. Fix en la misma rama.

## Barrido responsive — Flujo público (`/inscripcion`)

### Tema AZUL (branchId=1 → auto-skip a datos personales, solo Clase B)

| # | Step | Viewport | Issue | Sev | Estado | AC |
|---|------|----------|-------|-----|--------|----|
| 01 | personal-data | 390 mobile | Indicador "N de 8 · Label" recortado ~8px por el borde superior del card (solape hero/card > padding inferior en mobile) | 🟡 | ✅ fixed | AC-R1, Área 1/2 |
| 02 | TODOS los steps | 390 mobile | CTA `.btn-primary`/`.btn-secondary` medían 40px (`py-2.5`); touch target < 44px. Pill "Ayuda" del hero: 30px. | 🟡 | ✅ fixed | AC-R1 §7.4 |
| 03 | license-type | 390 mobile | Tarjetas Clase B / Profesional forzadas a 2 columnas en mobile → texto comprimido a columnas angostas, info-box ilegible | 🟠 | ✅ fixed | AC-R1, US1/US3, Área §7.4 |
| 04 | schedule (grilla) | mobile **y** desktop | La grilla renderiza **dos columnas para la misma fecha** ("vie 5/6" aparece 2×, la segunda vacía). NO es responsive (persiste en 1280) → bug de datos/lógica en la generación de días del grid (componente o Edge Function `load-schedule`). | 🟠 | ⚠️ fuera de carril responsive — requiere fix track de lógica | §7.6 |
| 05 | psych-test (Sí/No) | 390 mobile | Toggles Sí/No del test medían 40px (`py-2`); <44px touch target y son los controles que el usuario toca 81 veces | 🟡 | ✅ fixed | AC-R1 §7.4/§7.7 |

**Fix ISSUE-05:** `matricula-steps/psych-test/psych-test.component.ts` — toggles Sí/No `py-2`→`py-2.5` (ambos botones). Verificado: altura = 44px. Beneficia también al psych-test del matrícula admin (mejora a11y segura).

**Fix ISSUE-01:** `public-wizard-shell.component.ts` — hero bottom padding `pb-8` → `pb-12 sm:pb-8`. Da 12px de clearance al indicador compacto en mobile; `sm:` (tablet/desktop) sin cambios. Verificado: `clearancePx: 12`, `occluded: false`, sin overflow horizontal.

**Fix ISSUE-03:** `public-license-type.component.ts` — grilla `[class.grid-cols-2]` (fija) → `grid-cols-1` base + `[class.sm:grid-cols-2]`. Mobile apila a 1 columna (ancho completo, texto legible); `sm:`+ mantiene 2 columnas. Verificado por screenshot.

**Fix ISSUE-02 (transversal):** `styles/themes/_public-enrollment.scss` — regla única `[data-public-theme] .btn-primary, .btn-secondary { min-height: 44px; }`. Garantiza ≥44px en TODOS los CTA del flujo público (presentes y futuros) sin editar cada step; scoped al flujo público, no afecta el app interno. Pill "Ayuda" del hero: `py-1.5`→`py-2` (~36px, alineada al badge de marca h-9). Verificado: "Continuar" = 44px.

### Vistas barridas OK (sin issues nuevos)

- [x] personal-data (azul) — mobile + tablet — limpio (post fix-01)
- [x] license-type (roja, multi-flujo) — mobile (post fix-03) + tablet
- [x] Orientación (sin branchId) — mobile — limpio, sin overflow, card centrado
- [x] Draft restore — mobile — limpio, CTAs con buena altura (post fix-02)
- [x] Retorno Webpay (error, sin token) — mobile — limpio, centrado
- [x] payment-mode (azul) — mobile — limpio, tarjetas apiladas, sin overflow
- [x] schedule grid (azul) — mobile — responsive OK (sin overflow, nav semanas ok); ⚠️ ver ISSUE-04 (bug datos)
- [x] psych-test-intro + psych-test (roja) — mobile — limpio (post fix-05)

### Steps gated — revisados por lectura de componente (sin navegar 12 slots)

- [x] documents — colores/iconos por token; CTA cubierto por fix-02. Guía de foto `grid-cols-2` sin variante responsive → **aceptable por diseño** (comparación Correcta/Incorrecta lado-a-lado; boxes h-24 ok en ~165px, tips text-xs ≤2 líneas). Sin fix.
- [x] contract — limpio; ambos `btn-secondary w-full py-2.5` + CTA primario cubiertos por fix-02 (min-height 44px). Layout flex mobile-friendly.
- [x] payment — limpio; layout flex, nota de confianza (lock), sin grids. Detalle DS menor: total con `font-size:1.75rem;font-weight:900` gradient-clip en vez de `.kpi-value` (deliberado, baja prioridad).
- [x] confirmation / pre-confirmation — limpio; centrado, max-w-md, terminal, sin CTAs.

### Repaso tablet 768 / desktop 1280 — completo

- [x] **Desktop 1280** (8 estados): draft-restore, datos personales, modalidad, horario, tipo licencia, test psicológico, orientación, retorno-error → 0 overflow, layouts limpios (screenshots `docs/qa-ux/audit-desktop-*`).
- [x] **Tablet 768** (directos): datos personales, tipo licencia, horario, modalidad, orientación, retorno → 0 overflow. Test psicológico por inferencia (variante `sm:` verificada a 390 y 1280).
- [x] schedule grid — ⚠️ ISSUE-06 detectado y corregido (abajo).
- [~] Gated (foto carnet, contrato, pago, confirmación): por lectura de componente (flex, sin grids forzados); no screenshot a 768/1280 por gating de 12 slots.

| # | Step | Viewport | Issue | Sev | Estado |
|---|------|----------|-------|-----|--------|
| 06 | schedule (grilla) | tablet 768 + desktop 1280 | Con **un solo día** disponible, `gridColumns()` usaba `1fr` por día → la columna se estiraba a todo el ancho (slots ~500px). | 🟡 | ✅ fixed (`minmax(0,200px)`, commit 721263d) |
| 07 | wizard-shell (stepper) | tablet 768 + desktop 1280 | El stepper horizontal quedaba **8px tapado** por el card y la etiqueta del paso activo recortada 4px. ISSUE-01 se había arreglado solo en mobile (`sm:pb-8` quedó corto vs 40px de solape). **Reportado por el usuario** (mi sweep midió overflow pero no esta oclusión). | 🟠 | ✅ fixed (`sm:pb-14`, commit 2e0fef7; clearance 16px) |
| 08 | schedule (carga) | todos | "Carga rara": skeleton de ~216px (2 bloques) vs grilla real ~672px → salto de layout de ~456px al cargar (card pega un estirón). **Reportado por el usuario.** | 🟡 | ✅ fixed (skeleton grilla-shaped header+9 filas ~484px, commit 49b0108; salto ~188px) |

### Pasada UX detallista (interacción/comportamiento)

| # | Área | Hallazgo | Sev | Estado |
|---|------|----------|-----|--------|
| 09 | personal-data (banner contexto) | "Editar selección" en sede de **flujo único** lleva a un license-type con una sola opción → nada que editar. | 🟡 | ✅ fixed (`canEdit` en contexto, commit 3b5494e; branchId=1 sin botón, branchId=2 con botón) |
| 10 | schedule | **Dead-end sin feedback**: si la capacidad del instructor (días con cupo, máx 1/día) < requerido, nunca se habilita "Confirmar" y no había mensaje. | 🟠 | ✅ fixed (aviso `insufficientAvailability`, commit 2005c35; sin falso positivo; caso positivo no reproducible con seed) |

**Verificado OK en la pasada detallista (sin issue):**
- Honeypot (`website`) correctamente oculto (1×1px, absolute, opacity 0) — invisible al usuario.
- Validación: RUT inválido → error "verifica el dígito verificador" (rojo) + borde rojo + Continuar disabled. Feedback positivo "Correo válido".
- Datos personales **se preservan** al volver atrás (goBack).
- Horario: contador "X/12" actualiza, slot seleccionado en azul, "Anterior" disabled en semana 1 (opacity 0.35), "Siguiente" activo, "Confirmar" disabled hasta completar.
- Regla 1 clase/día (fix-008) y placeholder instructor disabled (fix-009) funcionando.

### Hallazgos de consola (separados — no son la carga del horario)

- **View Transitions `TimeoutError`** — `Transition was aborted because of timeout in DOM update` al entrar a `/inscripcion` (una vez, no en la grilla). **Impacto: bajo / solo ruido de consola.** La ruta pública no está bajo `/app`, no tiene `.shell-content`/`view-transition-name: main-content`, y `::view-transition-*(root)` tiene `animation: none` → la transición es un no-op sin efecto visible. No contribuye a ninguna "rareza". Candidato backlog (ej. `skipTransition` para rutas públicas), NO bloqueante.
- **Supabase `400 token refresh`** — el cliente intenta `grant_type=refresh_token` en el flujo anónimo (sin sesión). Benigno funcionalmente pero ensucia consola. Candidato: no inicializar auto-refresh de auth en el contexto público/anónimo.

**Propuesta fix ISSUE-06:** `public-schedule.component.ts` `gridColumns()`: `60px repeat(N, 1fr)` → `60px repeat(N, minmax(0, 200px))` (cap de ancho; con varios días sigue ok). Baja prioridad: en prod los instructores suelen tener disponibilidad multi-día.

### Pendiente

- [ ] Retorno Webpay success/cancelled — requiere flujo de pago real / TBK_TOKEN
- [ ] ISSUE-06 — decidir si se aplica el cap de columna (propuesta arriba)
- [x] ISSUE-04 (bug grilla día duplicado) → **fix-007** (redeploy EF). ✅ resuelto y verificado post-deploy.
- [x] Regla 1 clase/día → **fix-008** (público enforce ✅) + secretaría se mantiene en 3 (decisión de negocio).

> **Nota gating:** documents/contract/payment/confirmation están detrás de seleccionar 12 slots en
> el grid (máx 1/día), lo que exige navegar varias semanas. Barrerlos por Playwright es costoso;
> alternativa: revisarlos por lectura de componente o reducir temporalmente el `requiredCount`.
