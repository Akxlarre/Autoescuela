# Guia del Usuario: Como Operar a Claude

Bienvenido a tu nuevo Workspace orquestado por **Koa Agent System Blueprint v5.1**.
Este documento es para **TI (el humano)**. Te enseñara a extraer el maximo rendimiento de la inteligencia artificial de este repositorio.

## 1. El Sistema de Hooks (Guardrails Automaticos)

A partir de v5.1, este proyecto incluye un **sistema de hooks** que controla a Claude
automaticamente. Ya no necesitas recordarle las reglas en cada prompt.

### Que hacen los hooks por ti

| Hook | Que resuelve | Tu antes | Tu ahora |
|------|-------------|----------|----------|
| Discovery Gate | Claude no leia los indices | "Recuerda leer COMPONENTS.md" | Automatico: bloqueado hasta que lea |
| Architect Guard | Claude violaba reglas de codigo | "Usa @if, no *ngIf" | Automatico: bloqueado si viola regla |
| Bash Guard | Claude creaba archivos por Bash | "Usa Edit, no cat >" | Automatico: bloqueado |
| Compact Recovery | Claude perdia contexto al compactar | Reiniciar y re-explicar | Automatico: indices re-inyectados |
| Sync Check | Claude olvidaba actualizar indices | "Ejecuta /sync-indices" | Automatico: se le recuerda al terminar |
| Prettier | Formato inconsistente | "Formatea el archivo" | Automatico: post-edit |

### Que NO resuelven los hooks

- **Ceguera UI**: Claude sigue sin poder ver la UI renderizada. Tu debes revisar visualmente.
- **Juicio de diseno**: Si Claude decide crear un componente nuevo en vez de reutilizar uno existente, los hooks no pueden evaluarlo. El Discovery Gate obliga a leer los indices, lo que reduce drasticamente este problema, pero no lo elimina.

### Como ver los hooks activos

En Claude Code, ejecuta `/hooks` para ver la lista completa y desactivar hooks individuales.

## 2. El Concepto de "Project Knowledge"

Si usas Claude.ai (Pro), debes subir toda la carpeta `/docs`, `/indices` y `CLAUDE.md` a la seccion de **Project Knowledge**.
Al hacerlo, Claude tendra en todo momento el contexto arquitectonico de tu app sin que tengas que explicarselo.

Si usas **Claude Code CLI**, el agente leera automaticamente `CLAUDE.md` y los hooks se activaran al instante.

## 3. Prompts Recomendados

Con el sistema de hooks, ya no necesitas ser dictatorial. Los hooks se encargan de las reglas.
Ahora puedes enfocarte en **QUE** quieres construir:

### A. Para Crear Componentes
> "Crea un componente de estadisticas en `features/dashboard` que muestre 4 KPI cards."

Claude automaticamente: leera los indices (Discovery Gate lo obliga), usara OnPush (Architect Guard lo valida), usara tokens semanticos (Guard bloquea hardcoded colors), y actualizara los indices al terminar (Sync Check se lo recuerda).

### B. Para Debugging
> "El proyecto dejo de compilar. Revisa que archivos tocaste y corrige el error."

### C. Para Auditoria Completa
> "Ejecuta `npm run lint:arch` y corrige todos los errores."

El linter arquitectonico (v2.0) valida 8 reglas via AST: Facade pattern, OnPush, TDD, directivas deprecadas, colores hardcodeados, animaciones, y mas.

## 4. Limites Actuales y Como Mitigarlos

1. **Ceguera UI:** Claude no puede ver si la pagina quedo fea o descuadrada.
   - **Solucion:** Dale instrucciones layout precisas: "El componente padre debe ser bento-feature y contener a su derecha dos bento-square apilados".

2. **Amnesia de Sesion:** Si inicias un chat nuevo, Claude olvidara los cambios recientes.
   - **Mitigado por**: Discovery Gate (obliga a leer indices), Compact Recovery (re-inyecta tras compactacion), Sync Check (recuerda actualizar al terminar).
   - **Tu responsabilidad**: Si usas Claude.ai (no Code CLI), debes copiar/pegar las actualizaciones de indices manualmente.

## 5. Evolucion del Sistema

A medida que tu app escale:
1. Agrega mas skills en `.claude/skills/` (ej: `testing-cypress.md` o `ngrx-rules.md`).
2. Actualiza `.claude/rules/visual-system.md` si cambias tu esquema visual base.
3. Agrega reglas nuevas al Architect Guard en `.claude/hooks/pre-write-guard.js`.
4. Expande el linter AST en `scripts/architect.js` para reglas que requieran analisis profundo.

Detalle tecnico completo del sistema de hooks: `docs/HOOKS-SYSTEM.md`

**Eres el Arquitecto. Claude es tu Teclado Ultra-rapido — ahora con guardrails.**
