# Autoescuela — Koa Agent Blueprint v5.1

> Si usas **Claude Code CLI**, las reglas completas están en `.claude/CLAUDE.md` y se cargan automáticamente.
> Si usas **Claude.ai Projects**, sube este archivo junto con `docs/` e `indices/` al Project Knowledge.

@.claude/CLAUDE.md

---

<!-- Reglas completas a continuación para compatibilidad con Claude.ai Projects -->

## SISTEMA DE HOOKS (solo Claude Code CLI)

Si estás en Claude Code, este proyecto tiene **guardrails automáticos** que te bloquean
si intentas violar las reglas. No necesitas que el humano te lo recuerde:

- **Discovery Gate**: No puedes escribir código sin leer primero los índices
- **Architect Guard**: Cada Edit/Write se valida contra las reglas arquitectónicas
- **Sync Check**: Al terminar, se verifica si actualizaste los índices

Detalle completo: `docs/HOOKS-SYSTEM.md`

## FLUJO DE TRABAJO OBLIGATORIO (5 PASOS)

Para cada solicitud que implique escribir código o ensamblar UI:

1. **DESCUBRIR:** Revisa `indices/COMPONENTS.md`, `indices/SERVICES.md`, `indices/DIRECTIVES.md` y `indices/DATABASE.md`. ¿Ya existe algo que resuelva parcial o totalmente el problema? Úsalo. **En Claude Code, el Discovery Gate te bloqueará si no lo haces.**
2. **PLANIFICAR:** Define qué vas a tocar sin violar las reglas de Arquitectura y UI (ver abajo).
3. **EJECUTAR:** Escribe el código. Prioriza reutilizar. Los hooks validarán cada escritura en tiempo real.
4. **VALIDAR:** Corre `npm run lint:arch` para una auditoría completa.
5. **SINCRONIZAR:** Actualiza `indices/*.md` con los componentes/servicios creados.

## LÍMITES Y CAPACIDADES DEL AGENTE

- **NO tienes QA Visual:** Eres ciego a la UI renderizada. Dependes de escribir código HTML/CSS semántico perfecto según `BRAND_GUIDELINES.md` y esperar que el Humano lo revise.
- **Project Knowledge:** Tu contexto de 200k tokens te permite leer este documento y toda la carpeta `docs/` y `skills/` al instante. Usa esto a tu favor. No alucines, consulta los archivos.

## ESTRUCTURA DE CARPETAS CANÓNICA (Skeleton Architecture)

Debes respetar esta jerarquía estrictamente. Nunca inventes carpetas fuera de este estándar:

```text
src/
├── app/
│   ├── core/              # Facades, Guards, Interceptors, Modelos e Interfaces.
│   ├── features/          # Smart Components (Páginas completas, ej: Dashboard).
│   ├── shared/            # Dumb Components (UI presentacional, ej: kpi-card, modales).
│   └── layout/            # Sidebar, Topbar, Shell de la app.
├── styles/
│   ├── tokens/            # SCSS variables (var(--ds-brand)). NUNCA hardcodear en componentes.
│   └── vendors/           # PrimeNG overrides y librerías externas.
supabase/
└── migrations/            # Scripts SQL idempotentes numerados. NUNCA alterar BD manualmente.
```

## REGLAS ARQUITECTÓNICAS CRÍTICAS

- **Patrón Facade Estricto:** La UI (Angular Components) **NUNCA** inyecta clientes REST/Supabase directamente. Siempre pasa por un Servicio/Facade que centraliza el estado.
- **Detección de Cambios (OnPush):** Todo componente de UI debe usar `changeDetection: ChangeDetectionStrategy.OnPush`.
- **Estado y Errores:** Usa `signal()` para estado sincrónico y `RxJS` para asíncronos en Servicios (expuestos con `toSignal()`). Captura siempre los errores (`catchError`) en el Facade y expón un Signal de error manejable.
- **Tipados Strictos:** Las interfaces globales deben vivir en `core/models/`. No crees interfaces regadas o duplicadas dentro de los componentes UI.
- **Data Model (Supabase):** Los cambios a BD se hacen vía migraciones SQL. Todo esquema nuevo y sus FKs deben auto-documentarse en `indices/DATABASE.md`.

## REGLAS VISUALES Y COMPONENTES (PrimeNG & Atomic Design)

- **Prioridad de UI:** 1. Boilerplate Local (`indices/COMPONENTS.md`) -> 2. `PrimeNG` -> 3. Componentes custom desde cero.
- **PROHIBIDO Tailwind Arbitrario:** **NUNCA** uses colores como `text-red-500` o `bg-[#ff0000]`. Siempre usa nuestros Tokens Semánticos (`var(--ds-brand)`, `text-primary`, `bg-brand-muted`).
- **Grillas y Layout:** Este proyecto utiliza **Bento Grid**. No hagas Grids arbitrarios; utiliza nuestras reglas canónicas.
- Lee los detalles en `docs/TECH-STACK-RULES.md` y `docs/BRAND_GUIDELINES.md`.

## Tu Auto-Mantenimiento (Autonomía)

Siempre concluye las tareas que alteren la estructura del proyecto actualizando tú mismo los archivos `.md` correspondientes en la carpeta `indices/` mediante tus roles de escritura. Solo si tu entorno te niega el permiso de escritura a los archivos, puedes imprimir:

```xml
<memory_update>
  ✅ TAREA COMPLETADA
  (Imprimiendo tabla obligatoria aquí para que el humano la copie porque me denegaron acceso)
</memory_update>
```
