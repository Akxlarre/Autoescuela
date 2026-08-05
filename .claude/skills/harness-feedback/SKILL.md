---
name: harness-feedback
description: >
  Reporte proactivo de fricción con el propio harness (hooks, rules, skills, índices) al
  cerrar una sesión de trabajo. Activar cuando el usuario pida "cierra la sesión", "reporta
  fricción con el harness", "qué te costó de las reglas/hooks", o invoque /harness-feedback
  explícitamente. Distinto de sync-indices (que sincroniza QUÉ se creó): este skill audita
  CÓMO se sintió trabajar con el harness y propone mejoras al harness mismo, no a la app.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Edit, Bash, Glob, Grep
---

# Harness Feedback — Reporte Proactivo de Fricción

Inspirado en el mecanismo de "proactive feedback" de HarnessCompass (arXiv:2608.01918):
los índices y hooks solo ven la trayectoria desde afuera (qué falló, dónde), pero no
saben POR QUÉ te costó usar el harness. Solo tú lo sabes. Este skill te hace reportarlo
en dos pasadas (antes y después de conocer el resultado) y solo conserva lo que la
sesión respalda con evidencia concreta — nunca una queja sin sustento.

## Paso 1 — Reporte ciego (antes de mirar el resultado)

**No corras `npm run lint:arch` ni `npm run test:ci` todavía.** Reflexiona primero, para
evitar racionalizar en retrospectiva a partir de un resultado ya conocido:

- ¿Dónde te frenó el harness esta sesión? (un hook te bloqueó sin dejarte claro cómo
  corregir, una regla de `.claude/rules/` contradecía otra, un índice estaba desactualizado
  y te hizo perder tiempo, el Spec Gate te frenó por un track mal activado, un skill no
  cubría el caso que tenías)
- ¿Qué capacidad hubieras querido que existiera y no existe? (un chequeo que ningún hook
  hace hoy, un índice que falta, un script que tuviste que improvisar a mano)

Anota cada ítem con: `componente` (hook/rule/skill/índice/script afectado), `fricción`
(qué pasó, en 1 frase) y `cambio_deseado` (qué arreglaría esto).

## Paso 2 — Reporte con hindsight (después del resultado real)

Ahora sí, corre las verificaciones reales de la sesión:

```bash
npm run lint:arch 2>&1 | tail -40
npm run test:ci 2>&1 | tail -40
```

Este proyecto no tiene `failure-tracker.js` ni `LESSONS_LEARNED.md` — la señal de
hindsight sale de estos comandos y de los verificadores que ya corrieron solos al cerrar
turnos anteriores: el AC Verifier (Stop hook, revisa `specs/.active`) y el sync-checker de
índices. Si alguno de esos te bloqueó esta sesión, es evidencia directa de fricción.

Con el resultado real a la vista, para cada ítem del Paso 1 asigná una **atribución**:

- `harness` — el hook/regla/índice genuinamente dificultó el trabajo
- `razonamiento_propio` — el harness estaba bien, la dificultad fue mía
- `ambigüedad_tarea` — el pedido del humano era ambiguo, no es un problema del harness
- `entorno` — problema externo (red, dependencia rota, Supabase local caído, etc.)

Descarta cualquier ítem cuya atribución final NO sea `harness`. El objetivo no es
coleccionar quejas — es aislar fricción que el harness puede arreglar.

## Paso 3 — Grounding (solo lo que la sesión respalda)

Para cada ítem que sobrevivió con atribución `harness`, exigite evidencia concreta antes
de seguir:

- Si es fricción con algo que ya existe (`kind=mejorar_existente`): cita el mensaje
  exacto del hook (Spec Gate, Architect Guard, AC Verifier, etc.) o la línea de la regla
  que lo prueba.
- Si es una capacidad que falta (`kind=capacidad_nueva`): no puede estar en el trace
  (todavía no existe), pero señala el hueco concreto que la sesión mostró — qué tuviste
  que hacer a mano que un hook/script debería haber hecho por vos.

Descarta cualquier ítem que no puedas anclar a algo verificable de esta sesión.

## Paso 4 — Enrutamiento (capacidad vs. guía)

Cada ítem sobreviviente va a UNO de dos tracks — nunca mezcles el mecanismo con el consejo:

- **`track=estructural`** — el fix requiere un mecanismo determinista (un nuevo chequeo en
  un hook, un script). Redactalo como código+efecto observable, nunca como "avisarle al
  agente que...". Si implica tocar `.claude/hooks/*.js` (incluido `.claude/hooks/sdd/`),
  esos archivos están protegidos — no los edites: presentá el diff propuesto al humano
  para que lo aplique manualmente (igual que exige `pre-write-guard.js`). Si implica
  `scripts/*.js` no protegidos (`scripts/architect.js` sí lo está), podés editarlo
  directo — pasará por el mismo Placement Guard de `harness-gate.js` que exige que el
  cambio tenga un mecanismo real, no solo un mensaje.
- **`track=guía`** — el fix es una lección de comportamiento. Va en `.claude/rules/*.md`,
  `indices/DOMAIN-GOTCHAS.md` (hechos no obvios de negocio/esquema) o
  `indices/ANTI-PATTERNS.md` (atajos de código). **Cada entrada nueva DEBE incluir un
  criterio de aplicabilidad explícito** ("cuando X, hacer Y"; "Regla: ..."; "NO aplica si...")
  — no una recitación de lo que pasó esta sesión. `harness-gate.js` bloqueará cualquier
  entrada que cite un track (`fix-NNN`/`spec-NNNN`/`hotfix-NNN`) sin ese criterio, así que
  escribilo bien a la primera: el principio primero, la referencia al track como nota al
  pie (opcional) — igual que ya hace `fix-078-b` en `visual-system.md`.

  Mal (recitación): "Esta sesión el Discovery Gate bloqueó porque no leí COMPONENTS.md."
  Bien (criterio): "Regla: antes de escribir en `src/app/`, leé al menos un índice — el
  Discovery Gate no distingue refactors de código nuevo, así que aplica siempre."

  Nota: `specs/**` (spec.md/fix.md/hotfix.md) queda fuera de este chequeo a propósito —
  ahí el track ID ES el contenido legítimo. No confundas un contrato de spec con una
  lección de guía: si la lección es reusable más allá de ese track, va en `rules/` o
  `indices/`, no solo en el spec.

## Paso 5 — Confirmación

Antes de escribir nada, mostrale al humano una tabla resumen:

| Ítem | Track | Componente | Cambio propuesto |
|------|-------|------------|-------------------|
| ... | estructural/guía | hook/script/rule | ... |

Solo aplicá los cambios de `track=guía` directamente (con su criterio de aplicabilidad).
Para `track=estructural` que toque `.claude/hooks/`, dejá el diff propuesto en tu respuesta
para que el humano lo aplique — nunca lo escribas vos mismo ahí.

## Por qué esto importa

Sin este paso, el harness solo aprende de lo que alguien nota a mano y decide escribir en
`rules/`/`DOMAIN-GOTCHAS.md`, o de lo que un hook bloquea explícitamente — nunca de la
fricción que el agente sintió pero nadie preguntó. Con este skill, esa fricción genuina
queda registrada como principio reusable en vez de perderse al cerrar la sesión, y el
Generalization Gate (`harness-gate.js`) garantiza que lo que quede sea conocimiento
transferible, no una respuesta memorizada a esta sesión puntual.
