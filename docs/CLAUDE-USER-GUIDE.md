# Guia del Usuario: Como Operar a Claude

Bienvenido a tu nuevo Workspace orquestado por **Koa Agent System Blueprint v5.1**.
Este documento es para **TI (el humano)**. Te enseñara a extraer el maximo rendimiento de la inteligencia artificial de este repositorio.

---

> **Si inicias una sesion nueva con Claude**, dile esto al principio:
>
> *"Este proyecto usa Spec-Driven Development (3 tracks: spec, fix, hotfix) con gates en hooks que bloquean codigo sin spec activa. El track activo esta en `specs/.active`. Tambien usa TDD con Vitest — todo facade, service, util y smart component con `computed()` necesita su `.spec.ts`. Lee `docs/CLAUDE-USER-GUIDE.md` para el flujo completo."*

---

## 1. El Sistema de Hooks (Guardrails Automaticos)

A partir de v5.1, este proyecto incluye un **sistema de hooks** que controla a Claude
automaticamente. Ya no necesitas recordarle las reglas en cada prompt.

### Que hacen los hooks por ti

| Hook | Que resuelve | Tu antes | Tu ahora |
|------|-------------|----------|----------|
| Discovery Gate | Claude no leia los indices | "Recuerda leer COMPONENTS.md" | Automatico: bloqueado hasta que lea |
| Architect Guard | Claude violaba reglas de codigo | "Usa @if, no *ngIf" | Automatico: bloqueado si viola regla |
| **Spec Gate** | **Claude codificaba sin spec aprobada** | **"Crea la spec primero"** | **Automatico: bloqueado si no hay track activo con plan** |
| **AC Verifier** | **Claude terminaba sin cumplir los ACs** | **"Revisa los criterios de aceptacion"** | **Automatico: bloquea el turno si quedan ACs abiertos** |
| **Plan Injector** | **Claude olvidaba el plan de la spec** | **"Revisa spec.md antes de editar"** | **Automatico: inyecta el plan al editar codigo** |
| Bash Guard | Claude creaba archivos por Bash | "Usa Edit, no cat >" | Automatico: bloqueado |
| Compact Recovery | Claude perdia contexto al compactar | Reiniciar y re-explicar | Automatico: indices re-inyectados |
| Sync Check | Claude olvidaba actualizar indices | "Ejecuta /sync-indices" | Automatico: se le recuerda al terminar |
| Prettier | Formato inconsistente | "Formatea el archivo" | Automatico: post-edit |

### Que NO resuelven los hooks

- **Ceguera UI**: Claude sigue sin poder ver la UI renderizada. Tu debes revisar visualmente.
- **Juicio de diseno**: Si Claude decide crear un componente nuevo en vez de reutilizar uno existente, los hooks no pueden evaluarlo. El Discovery Gate obliga a leer los indices, lo que reduce drasticamente este problema, pero no lo elimina.

### Como ver los hooks activos

En Claude Code, ejecuta `/hooks` para ver la lista completa y desactivar hooks individuales.

## 2. Spec-Driven Development (SDD) — El Flujo de Trabajo

A partir de v5.1, **todo codigo de produccion requiere una Spec o Fix activa**. Claude no puede escribir en `src/`, `supabase/migrations/` ni similares sin un track activo con plan aprobado.

### Los 3 Tracks

| Track | Cuando usarlo | Formato ID | Archivo contrato |
|-------|--------------|------------|-----------------|
| **Spec** | Feature nueva o modulo completo | `NNNN-kebab-slug` (ej: `0001-flujo-pago`) | `specs/<id>/spec.md` |
| **Fix** | Bug o regresion con ACs afectados | `fix-NNN-slug` (ej: `fix-001-calculo-mora`) | `specs/<id>/fix.md` |
| **Hotfix** | Fix urgente en produccion, sin ACs complejos | `hotfix-NNN-slug` | Auto-cerrado por hook |

### Slash Commands (globales en `~/.claude/`)

| Comando | Que hace |
|---------|---------|
| `/spec-new` | Crea carpeta `specs/<id>/` con `spec.md` en blanco |
| `/spec-activate <id>` | Escribe el ID en `specs/.active` — activa el gate |
| `/spec-plan` | Claude analiza la spec activa y genera `specs/<id>/plan.md` |
| `/spec-tasks` | Claude desglosa el plan en tareas atomicas |
| `/spec-verify` | Claude revisa cuales ACs quedan abiertos |
| `/fix-new <descripcion>` | Crea `specs/fix-NNN-slug/fix.md` con ACs afectados |
| `/fix-close` | Cierra el track fix tras verificar el test de regresion |

### Flujo tipico para una Feature nueva

```
1. /spec-new            → Claude crea specs/0002-mi-feature/spec.md
2. (Editas spec.md con los ACs)
3. /spec-activate 0002-mi-feature
4. /spec-plan           → Claude genera plan.md
5. (Revisas y apruebas plan.md)
6. Claude implementa    → Spec Gate inyecta el plan en cada escritura
7. Al terminar turno    → AC Verifier verifica que todos los ACs esten cumplidos
```

### Flujo tipico para un Bug Fix

```
1. /fix-new "calculo de mora incorrecto"
   → Crea specs/fix-001-calculo-mora/fix.md con ACs afectados
2. /spec-activate fix-001-calculo-mora
3. Claude corrige el codigo
4. npm run test:ci      → Verifica test de regresion en verde
5. /fix-close           → Cierra el track
```

### Paths EXENTOS del Spec Gate

El gate **no bloquea** escrituras en:
- `specs/`, `indices/`, `docs/`, `.claude/`, `scripts/`
- Archivos de test (`*.spec.ts`, `*.test.ts`)
- Configs (`.md`, `.json`, `.yaml`, `.yml`)

### El archivo `specs/.active`

Contiene **una sola linea** con el ID del track activo (ej: `0002-mi-feature`).
Para desactivar manualmente: borra el contenido o escribe `--bypass` (uso excepcional).
El estado del roadmap se mantiene en `specs/ROADMAP.md`.

---

## 3. TDD con Vitest — Tests Automaticos

Este proyecto usa **Vitest** como test runner (integrado con Angular 21+).

### Comandos

| Comando | Uso |
|---------|-----|
| `npm run test` | Watch mode interactivo |
| `npm run test:ci` | Sin watch, verbose — **usa esto para auto-validacion** |
| `npm run test:coverage` | Reporte de cobertura en `coverage/` |

### Que DEBES testear (obligatorio)

| Capa | Tests | Por que |
|------|-------|---------|
| `core/facades/` | SI | Estado reactivo + logica de negocio |
| `core/services/` | SI | Logica transversal |
| `core/utils/` | SI | Funciones puras — las mas faciles y valiosas |
| `features/` (Smart) | SI | Coordinan facades, tienen `computed()` con logica |
| `shared/` con `computed()` | SI | Logica derivada que puede fallar |
| `shared/` sin logica | NO | Solo inputs/outputs — no hay decisiones que verificar |

### Regla de oro: testea decisiones, no bindings

```typescript
// SIN logica → test opcional
value = input.required<number>();

// CON logica → test OBLIGATORIO
formattedValue = computed(() =>
  this.value() > 1000 ? `${(this.value() / 1000).toFixed(1)}K` : String(this.value())
);
```

### Mocking (Vitest, NO Jasmine)

```typescript
// Crear mock function
const mockFn = vi.fn();
mockFn.mockReturnValue('valor');
mockFn.mockResolvedValue({ data: [] });

// Espiar metodo existente
vi.spyOn(service, 'metodo').mockImplementation(() => 'fake');

// Mock completo de modulo
vi.mock('@core/services/supabase.service');
```

### Advertencia: Claude debe auto-validar con `npm run test:ci`

El flujo TDD es:
1. Escribir el `.spec.ts` primero (contrato)
2. Implementar la logica hasta que pasen los tests
3. **Correr `npm run test:ci`** — Claude no puede declarar exito sin hacerlo
4. Corregir y repetir hasta `PASS`

---

## 4. El Concepto de "Project Knowledge"

Si usas Claude.ai (Pro), debes subir toda la carpeta `/docs`, `/indices` y `CLAUDE.md` a la seccion de **Project Knowledge**.
Al hacerlo, Claude tendra en todo momento el contexto arquitectonico de tu app sin que tengas que explicarselo.

Si usas **Claude Code CLI**, el agente leera automaticamente `CLAUDE.md` y los hooks se activaran al instante.

## 5. Prompts Recomendados

Con el sistema de hooks, ya no necesitas ser dictatorial. Los hooks se encargan de las reglas.
Ahora puedes enfocarte en **QUE** quieres construir:

### A. Para Crear una Feature (con SDD)

```
1. Primero activa la spec: /spec-activate 0003-nueva-feature
2. Luego: "Implementa el Facade y el Smart Component segun el plan de la spec activa."
```

### B. Para un Bug Fix

```
1. /fix-new "descripcion del bug"
2. /spec-activate fix-002-descripcion
3. "Corrige el bug y corre npm run test:ci para verificar."
```

### C. Para Crear Componentes (feature activa)

> "Crea un componente de estadisticas en `features/dashboard` que muestre 4 KPI cards."

Claude automaticamente: leera los indices (Discovery Gate lo obliga), usara OnPush (Architect Guard lo valida), usara tokens semanticos (Guard bloquea hardcoded colors), y actualizara los indices al terminar (Sync Check se lo recuerda).

### D. Para Debugging

> "El proyecto dejo de compilar. Revisa que archivos tocaste y corrige el error."

### E. Para Auditoria Completa

> "Ejecuta `npm run lint:arch` y corrige todos los errores."

El linter arquitectonico (v2.0) valida 8 reglas via AST: Facade pattern, OnPush, TDD, directivas deprecadas, colores hardcodeados, animaciones, y mas.

## 6. Limites Actuales y Como Mitigarlos

1. **Ceguera UI:** Claude no puede ver si la pagina quedo fea o descuadrada.
   - **Solucion:** Dale instrucciones layout precisas: "El componente padre debe ser bento-feature y contener a su derecha dos bento-square apilados".

2. **Amnesia de Sesion:** Si inicias un chat nuevo, Claude olvidara los cambios recientes.
   - **Mitigado por**: Discovery Gate (obliga a leer indices), Compact Recovery (re-inyecta tras compactacion), Sync Check (recuerda actualizar al terminar).
   - **Tu responsabilidad**: Si usas Claude.ai (no Code CLI), debes copiar/pegar las actualizaciones de indices manualmente.

## 7. Evolucion del Sistema

A medida que tu app escale:
1. Agrega mas skills en `.claude/skills/` (ej: `testing-cypress.md` o `ngrx-rules.md`).
2. Actualiza `.claude/rules/visual-system.md` si cambias tu esquema visual base.
3. Agrega reglas nuevas al Architect Guard en `.claude/hooks/pre-write-guard.js`.
4. Expande el linter AST en `scripts/architect.js` para reglas que requieran analisis profundo.

Detalle tecnico completo del sistema de hooks: `docs/HOOKS-SYSTEM.md`

**Eres el Arquitecto. Claude es tu Teclado Ultra-rapido — ahora con guardrails.**
