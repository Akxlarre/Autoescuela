# Spec 0054-b — Revisión de accesibilidad con axe en el barrido e2e

> **Status:** done (2026-10-20; ver acceptance.md)
> **Created:** 2026-10-20
> **Owner:** Benjamín
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** `ASG-i-065`. Hoy ningún test revisa accesibilidad. En la QA de fix-057-i se corrió
axe-core a mano y encontró problemas reales de contraste: el gris `text-text-muted` (#a1a1aa) sobre
blanco tiene 2.56:1 y WCAG AA pide 4.5:1, y se usa en micro-labels de toda la app. El objetivo es que
axe corra en el barrido e2e existente (`e2e/barrido-rutas.spec.ts`: todas las rutas × rol × ancho ×
tema) para detectar estos problemas sin revisión manual.

Cambia el proceso del equipo: el barrido no debe empezar a fallar sin acordarlo. Por eso la etapa 2
queda lista pero apagada por defecto.

## 2. User Stories

- Como **equipo**, quiero un reporte de las violaciones de accesibilidad WCAG 2 A/AA de cada pantalla,
  para saber cuántas hay y dónde.
- Como **equipo**, quiero que el barrido pueda fallar solo con violaciones graves **nuevas**, para no
  empeorar sin bloquear por las que ya existen.

## 3. Acceptance Criteria

- **AC1:** el barrido corre axe (reglas `wcag2a` + `wcag2aa`) en cada celda (ancho × tema, claro y
  oscuro) de cada ruta × rol y adjunta al test un JSON con las violaciones (regla, impacto, cantidad
  de nodos, ejemplos de selectores).
- **AC2 (etapa 1, por defecto):** las violaciones no hacen fallar el barrido; la anotación del test
  resume cuántas hay por impacto.
- **AC3 (línea base):** con `E2E_A11Y_WRITE_BASELINE=1` se escribe la línea base por ruta × rol en
  `e2e/a11y-baseline/` (clave: tema + regla), un archivo por test para que el modo paralelo no choque.
- **AC4 (etapa 2, opt-in):** con `E2E_A11Y_STRICT=1` el barrido falla si aparece una regla de impacto
  `serious` o `critical` que no está en la línea base de esa ruta × rol × tema.
- **AC5:** el skill `/verify` incluye un paso de axe para revisar cada componente nuevo.
- **AC-E1:** si axe no puede correr en una celda (error), se anota y no tumba el resto del barrido.

## 4. Fuera de alcance

- Corregir las violaciones encontradas (cada una va a su fix).
- Cambiar el token `--color-text-muted` del DS (conversarlo con quien mantiene el diseño).
- Navegación por teclado, foco y lectores de pantalla (axe no los cubre).
- Encender la etapa 2 por defecto (decisión del equipo).

## 5. Notas / decisiones

- `@axe-core/playwright@4.13.0` como devDependency (la 4.14.0 tiene menos de 2 semanas).
- La comparación es por regla, no por selector: los selectores cambian con cualquier ajuste de diseño.
