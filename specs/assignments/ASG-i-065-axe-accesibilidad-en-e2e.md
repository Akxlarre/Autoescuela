# Asignación ASG-i-065 — Revisión de accesibilidad con axe en los tests e2e

> **status:** reclamada
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-10-17
> **created_by:** i
> **claimed_by:** b
> **claimed_at:** 2026-10-20
> **resulting_track:** 0054-b-axe-accesibilidad-en-e2e

---

## Contexto / Objetivo

Hoy ningún test revisa accesibilidad. En la QA de fix-057-i se corrió axe-core a mano desde
Playwright MCP y encontró problemas reales de contraste: el gris de texto secundario
`text-text-muted` (#a1a1aa) sobre blanco tiene 2.56:1 y WCAG AA pide 4.5:1, y se usa en
micro-labels de toda la app ("RESUMEN FINANCIERO", "DESCUENTOS" del paso Pago). El objetivo es que
axe corra en el barrido e2e existente (`e2e/barrido-rutas.spec.ts`, todas las rutas × rol × ancho
× tema) para detectar estos problemas en todas las pantallas sin revisión manual.

No es parte de ningún fix: es una mejora de las herramientas de prueba, a tomar cuando el equipo
decida (idealmente antes de abrir el sistema a más usuarios).

## Alcance sugerido

- Agregar `@axe-core/playwright` (devDependency) y un chequeo C7 "accesibilidad" en
  `barrido-rutas.spec.ts`, con reglas WCAG 2 A/AA, en claro y oscuro.
- **Etapa 1 — solo reporte:** guardar las violaciones por ruta/celda como adjunto del test, sin
  fallar. Sirve para medir cuántas hay (PrimeNG seguro trae varias).
- **Etapa 2 — línea base:** registrar las existentes (como los otros ratchets del proyecto) y
  fallar solo con violaciones **nuevas** de impacto `serious`/`critical`.
- Sumar un probe de axe al skill `/verify` para revisar cada componente nuevo al terminarlo.
- Decidir aparte si se corrige el token `--color-text-muted` del DS (cambia el gris en toda la
  app: conversarlo con quien mantiene el diseño antes de tocarlo).
- Fuera de alcance: navegación por teclado, foco y lectores de pantalla (axe no los cubre; siguen
  siendo revisión manual).

## Referencias

- `specs/fixes/fix-057-i-matricula-becada-100/fix.md` § Verificación (primer uso de axe, contraste
  2.56:1 vs 7.73:1 de `text-text-secondary`).
- `e2e/barrido-rutas.spec.ts` (fix-190-b) — barrido actual: consola, red, scroll, app-like.
- `.claude/skills/verify/SKILL.md`.

## Archivos involucrados (opcional, para detectar solapes)

- `e2e/barrido-rutas.spec.ts`
- `package.json`
- `.claude/skills/verify/SKILL.md`

## Notas para quien la reclame

- Para probar sin instalar nada, axe se puede inyectar en la página con
  `page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' })`
  y `axe.run(elemento, { runOnly: ['wcag2a', 'wcag2aa'] })` (así se hizo en fix-057-i).
- Cambia el proceso de todo el equipo: acordarlo antes de que el barrido empiece a fallar.
