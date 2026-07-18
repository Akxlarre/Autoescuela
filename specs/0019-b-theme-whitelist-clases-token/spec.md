# Spec 0019-b — Whitelist de clases token derivada del `@theme`

> **Status:** done (2026-07-01 — ver acceptance.md)
> **Created:** 2026-07-01
> **Owner:** Akxlarre
> **Priority:** P1
> **Modelo Claude:** `claude-sonnet-4-6` (Sonnet 4.6) — requiere diseño de parser del bloque `@theme` y una estrategia de rollout en dos fases (warning → error), pero el problema está bien acotado y verificable.

---

## 1. Contexto de negocio

**Origen:** Auditoría "Clases de texto cortas MUERTAS" (memoria institucional + fix-030) y
sesión de análisis del tooling AST (2026-07-01).

**Persona afectada:** El agente y cualquier dev: escriben clases que Tailwind v4 **ignora
silenciosamente** (no generan CSS, el texto hereda el color del padre) y nada les avisa.

**Problema que resuelve:**
ARCH-11 es una **lista negra escrita a mano** (`bg-bg-*`, `*-state-*`, …) que se desactualiza
y tiene huecos: las formas cortas `text-primary`/`text-secondary`/`text-muted` (≈549 usos en
39 archivos, en migración vía fix-030) nunca estuvieron en ella. Cada vez que el `@theme`
cambia, la lista negra queda obsoleta. La fuente de verdad de qué clases existen ya está en
`src/tailwind.css` — el linter debería **derivarla**, no duplicarla.

**Hipótesis de valor:**
Invertir la lista negra por una whitelist derivada elimina esta clase entera de bug
("clase que parece del DS pero no renderiza") de forma permanente, no caso a caso.

---

## 2. User Stories

- **US1**: Como agente, quiero que `lint:arch` valide toda clase color-like contra el set real
  del `@theme`, para que una clase muerta nunca llegue al template.
- **US2**: Como humano, quiero que al agregar un token nuevo al `@theme` el linter lo acepte
  automáticamente, sin tener que editar `architect.js`.
- **US3**: Como humano, quiero un reporte del backlog existente de clases muertas, para
  coordinar la migración (fix-030) sin que el lint explote en rojo de un día para otro.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1 (parser @theme)**: Given el bloque `@theme` de `src/tailwind.css`, When corre el
  linter, Then extrae el set de tokens `--color-*` (y familias equivalentes) y deriva las
  utilities generables (`text-X`, `bg-X`, `border-X`, `ring-X`, …).
- **AC2 (clase muerta dispara)**: Given un template con `text-primary`, `text-muted`,
  `bg-bg-surface` o cualquier clase color-like fuera del set derivado, When corre `lint:arch`,
  Then la reporta (regla ARCH-11 v2) indicando la forma canónica más cercana si existe
  (ej: `text-primary` → `text-text-primary`).
- **AC3 (clase legítima pasa)**: Given utilities core de Tailwind que NO son de color
  (`text-sm`, `text-center`, `flex`, `p-4`, `bg-gradient-primary` de `@utility`), Then NO
  disparan — el validador solo evalúa la familia de color/token.
- **AC4 (reemplaza la lista negra)**: Given la regex hardcodeada actual de ARCH-11, When se
  cierra esta spec, Then queda eliminada de `architect.js` y todos sus casos quedan cubiertos
  por el set derivado (verificado con fixtures de cada patrón viejo).
- **AC5 (rollout en dos fases)**: Given el backlog existente (~549 usos), When corre
  `lint:arch`, Then las clases muertas **pre-existentes** se reportan como WARNING con conteo
  total, y solo el código **nuevo/modificado** (o un flag `--strict`) las trata como ERROR.
  El switch a error-para-todo se hace cuando el backlog llegue a 0 (cierre de fix-030).

### Edge cases obligatorios

- **AC-E1 (modificador de opacidad)**: Given `bg-brand/20` o `border-success/50`, Then valida
  el token base (`brand`, `success`) ignorando el `/N`.
- **AC-E2 (variantes)**: Given `dark:text-text-muted` o `hover:bg-surface`, Then valida la
  clase sin el prefijo de variante.
- **AC-E3 (clases dinámicas)**: Given un binding `[class.text-error]="cond"`, Then la clase
  dentro del binding también se valida.

---

## 4. Out of scope

- ❌ Migrar el backlog de 549 usos — eso es **fix-030** (en curso); esta spec solo lo mide.
- ❌ Validar clases SCSS (`var(--*)` en estilos) — solo clases Tailwind en templates/TS.
- ❌ Generar el `@theme` o modificar `tailwind.css`.

---

## 5. Dependencias

### Specs previas
- Ninguna bloqueante. **Sinergia con fix-030**: el conteo de backlog de esta spec sirve de
  métrica de avance de la migración.

### Capacidades del proyecto que se asumen existentes
- `src/tailwind.css` con bloque `@theme` como única fuente de tokens Tailwind.
- `architect.js` con registro `RULES` y análisis de `.ts` + `.html`.
- Tabla "Tokens `@theme` disponibles" en `indices/STYLES.md` (sirve de fixture de verificación).

### Capacidades nuevas requeridas
- Función `parseThemeTokens(tailwindCssPath)` reutilizable (idealmente compartida entre
  `architect.js` e `indices-sync.js` para que STYLES.md y el linter lean la misma verdad).
- ⚠️ **Constraint operativo:** `scripts/architect.js` protegido por File Protector — el humano
  aplica el diff o autoriza la escritura.

---

## 6. Datos y modelo (preliminar)

No aplica.

---

## 7. UX y flujos (preliminar)

Salida de consola: el warning de backlog agrega una línea-resumen
(`⚠ N usos de clases muertas pre-existentes — ver fix-030`), no N líneas de ruido.

---

## 8. Métricas de éxito post-launch

- Backlog de clases muertas visible en cada corrida y descendiendo hasta 0.
- Cero clases muertas nuevas introducidas post-merge.
- `architect.js` sin listas de tokens hardcodeadas.

---

## 9. Notas / decisiones abiertas

- [ ] ¿El set derivado se cachea (mtime de `tailwind.css`) o se parsea en cada corrida?
  (Propuesta: parsear siempre — es un archivo, costo despreciable.)
- [ ] Definir la lista exacta de prefijos color-like a validar
  (`text|bg|border|ring|from|to|via|fill|stroke|divide|outline|accent|caret`).

---

## Changelog

- 2026-07-01 — draft inicial por Akxlarre (redactado por Claude a partir del análisis AST de la sesión).
