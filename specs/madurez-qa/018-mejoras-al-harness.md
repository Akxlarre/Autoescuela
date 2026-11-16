# 018 — Mejoras al harness de agentes

> **Origen:** revisión del harness (hooks, reglas, skills, índices) a la luz de los hallazgos de QA.
> **Estado:** la parte de guía y los chequeos nuevos están aplicados en esta rama, sin commitear.
> Quedan dos cambios que solo puede aplicar una persona (archivos protegidos) y cuatro propuestas
> sobre patrones que esperan decisión.

## La idea de fondo

El hallazgo de QA fue que un control que existe pero no corre equivale a no tenerlo: los e2e y los
tests SQL estaban escritos y nadie los ejecutaba. Al mirar el harness con la misma pregunta
apareció el mismo problema: un hook documentado como activo que nunca se conectó, y una
recuperación de contexto que creció hasta inyectar 742 KB sin que nada avisara.

Por eso el primer cambio es que **el harness se comprueba a sí mismo**, en el mismo comando y en
el mismo CI que ya vigilan el código.

---

## Parte 1 — Aplicado

### Reglas nuevas en `npm run lint:arch`

Viven en `scripts/check-qa-guardrails.mjs`, conectado desde `scripts/lint-arch-wrapper.js`.

| Regla | Qué vigila | Tipo | Estado hoy |
| ----- | ---------- | ---- | ---------- |
| ARCH-31 | Hook de `.claude/hooks/` sin conectar, o hook que `CLAUDE.md` presenta como activo sin respaldo en `settings.json` | Error | En cero; una excepción declarada |
| ARCH-32 | Cuánto inyecta `compact-recovery.js` tras compactar | Trinquete | 725 KB; techo provisorio 781 KB; objetivo 59 KB |
| ARCH-33 | Filas de índice de más de 1.200 caracteres | Trinquete | 144 filas en 5 índices, congeladas |
| ARCH-34 | Credencial escrita en un archivo versionado | Error | 11 archivos en línea base, ninguno nuevo permitido |
| ARCH-35 | Tests desactivados, specs excluidos, esperas fijas y saltos de e2e | Trinquete | 7 · 6 · 51 · 31, ninguno puede subir |
| ARCH-36 | Edge function sin guard de autorización compartido | Error | 8 excepciones, cada una con su motivo leído del código |
| ARCH-37 | Migración nueva que cambia permisos sin test SQL que la nombre | Error | Rige desde la próxima migración |

- Un **error** falla siempre. Un **trinquete** avisa en modo normal y falla con `--strict`, que es
  como corre el CI de pull requests.
- Excepciones: `scripts/lib/qa-guardrails.allowlist.json`. Línea base:
  `scripts/lib/qa-guardrails.baseline.json`.
- Cuatro micro-suites nuevas en `scripts/lib/`, que entran solas a `npm run test:scripts`. Una de
  ellas arma un repositorio de mentira y comprueba que cada regla dispara: prueba que el runner
  está conectado, no solo que las funciones calculan bien.

### Guía

| Archivo | Cambio |
| ------- | ------ |
| `.claude/CLAUDE.md` | Sale "Context Guard" de la lista de hooks activos: el archivo existe y nunca se conectó. La lista pasa a nombrar solo lo que corre, y ARCH-31 lo sostiene |
| `.claude/rules/testing-tdd.md` | Sección nueva "Las capas de test fuera de `src/app`": qué se prueba dónde, reglas de tests SQL y de e2e. La regla ahora carga también al tocar `supabase/` y `e2e/` |
| `.claude/rules/database.md` | Una política nueva o cambiada llega con su test SQL |
| `indices/DOMAIN-GOTCHAS.md` | DG-128: no existe una base de desarrollo; `--linked` y el MCP operan sobre la base real |
| `.claude/skills/verify/SKILL.md` | Se quitaron las dos copias de la contraseña de prueba |
| `.claude/skills/sync-indices/SKILL.md` | Un índice describe el estado vigente, no la historia |
| `.claude/skills/sdd/templates/spec.md` | Tabla "Preguntas de calidad" (permisos, carga fallida, dos a la vez, dinero o agenda, terceros, capa del test, producción) |
| `.claude/skills/sdd/templates/fix.md` | Sección "Por qué no se detectó antes" |
| `docs/HOOKS-SYSTEM.md` | Tabla de las reglas ARCH-31 a ARCH-37 |
| `.agents/` | Espejo sincronizado con `npm run agents:sync` |

### Verificación

- `npm run test:scripts`: 19 micro-suites en verde (15 anteriores y 4 nuevas).
- `npm run lint:arch` y `npm run lint:arch:strict`: salen en 0, con las reglas nuevas incluidas.
- `npm run test:ci` no se corrió: este worktree no tiene `node_modules`. Ningún archivo de
  `src/app` cambió.

### Efecto sobre el equipo

Estas reglas corren para Matías e Ignacio en cuanto la rama se mergee. Las que pueden frenarlos:

- **ARCH-33:** agregar texto a una fila de índice que ya es larga deja el PR en rojo. La salida es
  reescribir la fila con el estado vigente.
- **ARCH-37:** una migración con `CREATE POLICY` o `SECURITY DEFINER` exige un test SQL que nombre
  su timestamp, o una excepción con motivo.
- **ARCH-34:** escribir una contraseña en un archivo nuevo deja el PR en rojo.

Conviene avisarles antes del merge.

---

## Parte 2 — Pendiente de una persona (archivos protegidos)

El File Protector no deja que un agente edite `.claude/hooks/` ni `settings.json`.

**Los puntos 2.1 y 2.2 se aplican con un comando**, probado sobre una copia (aplica, es
idempotente y el guard resultante frena `db reset --linked` sin frenar lo demás):

```bash
node scripts/harness/patch-018-compact-recovery-y-base-real.js
```

Con `--dry-run` solo informa. Con `--completo` el guard frena además `db push`, la publicación de
funciones y los secretos. El mismo comando baja el techo de ARCH-32 y corrige la viñeta de
`CLAUDE.md`, así que los pasos manuales de 2.1 quedan cubiertos.

### 2.1 Reemplazar `.claude/hooks/compact-recovery.js`

**Problema:** después de cada compactación inyecta el contenido completo de 7 índices: 742.033
bytes medidos, del orden de 180 mil tokens. No hay tope.

**Cambio:** inyectar un mapa de los índices (tamaño y secciones) en vez de su contenido, con un
tope de 60 KB. Probado fuera del repositorio contra los índices actuales: **18.504 bytes**, los 21
índices listados, con `ANTI-PATTERNS.md` y `DOMAIN-GOTCHAS.md` primero.

Contenido completo del archivo:

```js
#!/usr/bin/env node
/**
 * compact-recovery.js — SessionStart Hook (matcher: "compact")
 *
 * Después de compactar se pierde la memoria de qué índices existen y qué trae cada uno.
 * Este hook devuelve un MAPA de los índices (tamaño y secciones), no su contenido: los índices
 * completos pesan más que una ventana de contexto entera. El contenido se lee con Read cuando
 * hace falta, por sección.
 *
 * stdout → se agrega al contexto de Claude. Presupuesto: MAX_BYTES, que verifica ARCH-32
 * (scripts/check-qa-guardrails.mjs).
 */

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const INDICES_DIR = path.join(cwd, 'indices');

const MAX_BYTES = 60000;
const MAX_HEADINGS_PER_FILE = 40;
const MAX_HEADING_CHARS = 110;

// Primero los que más pesan al escribir código: qué no hacer y qué trampas ya se pisaron.
const FIRST = ['ANTI-PATTERNS.md', 'DOMAIN-GOTCHAS.md'];

function listIndexFiles() {
  if (!fs.existsSync(INDICES_DIR)) return [];
  const names = fs.readdirSync(INDICES_DIR).filter((name) => name.endsWith('.md'));
  const rank = (name) => (FIRST.includes(name) ? FIRST.indexOf(name) : FIRST.length);
  return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function describe(name) {
  const content = fs.readFileSync(path.join(INDICES_DIR, name), 'utf-8');
  const lines = content.split('\n');
  const headings = lines
    .filter((line) => /^#{1,3}\s/.test(line))
    .map((line) => (line.length > MAX_HEADING_CHARS ? `${line.slice(0, MAX_HEADING_CHARS)}…` : line));

  let block = `--- indices/${name} (${Math.round(content.length / 1024)} KB, ${lines.length} lineas) ---\n`;
  block += headings.slice(0, MAX_HEADINGS_PER_FILE).join('\n');
  if (headings.length > MAX_HEADINGS_PER_FILE) {
    block += `\n(+${headings.length - MAX_HEADINGS_PER_FILE} secciones mas: busca con Grep)`;
  }
  return `${block}\n\n`;
}

let output = '';
output += '══════════════════════════════════════════════════════════════\n';
output += ' MAPA DE INDICES (post-compactacion por Koa Hooks)\n';
output += '══════════════════════════════════════════════════════════════\n\n';
output += 'El contexto fue compactado. Esto es el MAPA de los indices del proyecto,\n';
output += 'no su contenido. Antes de crear un componente, servicio, facade o migracion,\n';
output += 'lee con Read la seccion del indice que corresponde.\n\n';

const files = listIndexFiles();
let listed = 0;
const omitted = [];

for (const name of files) {
  const block = describe(name);
  if (Buffer.byteLength(output + block, 'utf-8') > MAX_BYTES - 500) {
    omitted.push(name);
    continue;
  }
  output += block;
  listed++;
}

if (files.length === 0) {
  output += '(No se encontraron archivos de indices en el proyecto)\n';
} else {
  output += '══════════════════════════════════════════════════════════════\n';
  output += `${listed} indices en el mapa.`;
  if (omitted.length > 0) output += ` Sin detalle por presupuesto: ${omitted.join(', ')}.`;
  output += '\n══════════════════════════════════════════════════════════════\n';
}

process.stdout.write(output);
```

**Después de aplicarlo:**

1. En `scripts/lib/qa-guardrails.baseline.json`, bajar `compactRecovery.maxBytes` de `800000` a
   `60000`.
2. Correr `npm run lint:arch:strict`: ARCH-32 tiene que quedar sin aviso.
3. En `.claude/CLAUDE.md`, la viñeta de Compact Recovery pasa a decir que se re-inyecta el mapa de
   los índices, no los índices.

**Si no se aplica:** el techo provisorio deja menos de 60 KB de margen. Cuando los índices crezcan eso,
ARCH-32 pone en rojo el CI de cualquier PR, aunque no tenga relación.

### 2.2 Agregar un bloque a `.claude/hooks/bash-guard.js`

**Problema:** ningún hook distingue un comando contra la base real. `supabase db reset --linked`
no tiene freno.

**Cambio:** un cuarto bloque, antes del `process.exit(0)` final. Los patrones se probaron contra
11 comandos de ejemplo (bloquea los cuatro de abajo; deja pasar `db reset` local,
`db query --linked` de los tests, `functions serve`, `secrets list`, `migration list`).

```js
    // ═══════════════════════════════════════════════════════════════════════
    // 4. BASE REAL — el proyecto enlazado es la base que usan los clientes
    //    (indices/DOMAIN-GOTCHAS.md DG-128)
    // ═══════════════════════════════════════════════════════════════════════
    const linkedDbPatterns = [
      { re: /supabase\s+db\s+reset\b[^;|&]*--(?:linked|db-url)/, msg: 'db reset contra el proyecto enlazado borra la base real' },
      { re: /supabase\s+db\s+push\b/, msg: 'db push aplica migraciones a la base real' },
      { re: /supabase\s+functions\s+(?:deploy|delete)\b/, msg: 'publica o borra una edge function en produccion' },
      { re: /supabase\s+secrets\s+(?:set|unset)\b/, msg: 'cambia un secreto de produccion' },
    ];

    for (const { re, msg } of linkedDbPatterns) {
      if (re.test(command)) {
        process.stderr.write(
          `\u{1F6D1} BASH GUARD: Operacion sobre la base real bloqueada.\n` +
          `Razon: ${msg}\n` +
          `No existe una base de desarrollo (DG-128). Pide al humano que lo ejecute en su terminal.`
        );
        process.exit(2);
      }
    }
```

**Decisión antes de aplicarlo:** la primera línea (`db reset`) no tiene contraindicación. Las otras
tres cambian la forma de trabajar si hoy un agente publica migraciones o funciones por la CLI:
pasaría a pedírselo a una persona. Se pueden dejar fuera.

### 2.3 Opcional: confirmar las escrituras por el MCP de Supabase

El bloque anterior cubre la CLI. Las herramientas `execute_sql` y `apply_migration` del MCP no
pasan por el guard de Bash. Cubrirlas pide un hook nuevo de `PreToolUse` con un matcher sobre esas
herramientas, que deje pasar las lecturas y pida confirmación a la persona para el resto. Requiere
un archivo nuevo en `.claude/hooks/` y una entrada en `settings.json`; antes de escribirlo hay que
confirmar en la documentación de hooks de Claude Code el formato con que un hook pide confirmación
en vez de bloquear. Queda como propuesta, sin código.

### 2.4 Decidir qué hacer con `context-enrichment-guard.js`

Hoy está declarado como excepción en la lista de ARCH-31. Es un guard para un proyecto recién
creado (bloquea si los índices están vacíos) y acá no tendría efecto. Las opciones son borrarlo o
conectarlo; cualquiera de las dos obliga a quitar su entrada de la lista de excepciones.

### 2.5 El Sync Check dispara sin que se haya tocado `src/app`

Al cerrar esta sesión, el hook de cierre pidió actualizar `COMPONENTS.md`, `SERVICES.md` o
`DIRECTIVES.md`. `git status src/` estaba vacío: la sesión solo escribió en `scripts/`, `specs/`,
`docs/`, `.claude/` y una entrada de `DOMAIN-GOTCHAS.md`.

**Causa probable:** el chequeo es un hook de tipo prompt, que decide leyendo la conversación. Una
sesión que nombra muchos archivos `.ts` sin tocarlos se le parece a una que los creó.

**Cambio propuesto:** que la decisión de preguntar sea determinista. El hook de comando que corre
antes ya lleva la lista de lo escrito en la sesión (`.claude/temp/session-writes.json`): el aviso
de índices debería salir solo cuando esa lista trae un archivo de `src/app/`. Es un cambio en
`settings.json`, protegido.

---

## Parte 3 — Los patrones de arquitectura y de front

Pregunta que motivó esta parte: ¿el harness tiene en cuenta las decisiones de patrones que el
equipo fue construyendo, para que el agente las aplique en features futuras?

### Lo que sí funciona

- **Las reglas cargan en cada sesión.** 9 de los 10 archivos de `.claude/rules/` (unos 60 KB) se
  importan desde `CLAUDE.md`: arquitectura, facades, modelos, sistema visual, SWR, fechas,
  notificaciones, legibilidad para agentes y testing. El agente las tiene antes de escribir.
- **Muchas se exigen con mecanismo:** 30 reglas del linter, más el guard de escritura en tiempo
  real.
- **El sistema visual es donde mejor se ve el aprendizaje acumulado:** `visual-system.md` conserva
  el porqué de cada corrección (11 notas atadas al track que la originó).

### Donde la intuición es correcta

| # | Hueco | Evidencia |
| - | ----- | --------- |
| A | **Las lecciones de dominio se cosechan; las de patrón, casi no.** | De 1.209 tracks, `DOMAIN-GOTCHAS.md` cita 146 distintos. Las reglas citan 9 y `ANTI-PATTERNS.md` 6 |
| B | **Las decisiones quedan en el plan de cada spec.** | 94 `plan.md`; 13 tienen una sección de decisiones. No hay registro de decisiones ni catálogo de patrones |
| C | **Al planificar se consulta qué existe, no cómo se decidió construir.** | `/spec-plan` lee 7 índices de inventario. No lee `ANTI-PATTERNS.md` ni `DOMAIN-GOTCHAS.md` |
| D | **La lista de restricciones del plan está incompleta y resumida de más.** | Nombra 8 reglas; faltan `dates.md` y `database.md`. Resume el sistema visual como "tokens, bento grid" y no menciona app-like, que es el default de toda página |
| E | **Las reglas dicen qué está prohibido, no qué copiar.** | No hay un índice "para construir una ficha con tabs, mira este archivo". Los precedentes están sueltos en la prosa (el wizard de matrícula, las tabs de Asistencia B) |
| F | **Tres patrones centrales no tienen ningún guard.** | Cero menciones en guardrails de `createRequestGuard`, de `_initialized`/`refreshSilently` (SWR) y de `fill-screen`/`.bento-fill` (app-like) |
| G | **`ANTI-PATTERNS.md` no está en el paso de descubrir.** | `CLAUDE.md` nombra 4 índices obligatorios; los 18 antipatrones no están entre ellos |
| H | **No hay camino de vuelta al boilerplate.** | "Koa Agent Blueprint" aparece solo como título. Nada marca qué lección es genérica y cuál es de este proyecto |

El hueco A explica la sensación: el equipo aprendió patrones en cientos de tracks, y lo que llegó
a un lugar donde el próximo agente lo lee es una fracción.

### Estado de las propuestas

- **10, 11 y 12: aplicadas.** `indices/PATTERNS.md` existe con 19 arquetipos y sus referencias
  (propuesta inicial, a confirmar por el equipo); `/spec-plan` y la plantilla del plan lo
  consultan junto con antipatrones y gotchas; `/spec-verify` y `/fix-close` preguntan al cerrar
  qué decidió el track. ARCH-38 falla si una ruta del catálogo deja de existir.
- **13 y 14: pendientes.** La 13 son tests guardianes sobre `src/app` y merece su propio track.
  La 14 espera saber si el boilerplate se mantiene para otros proyectos.
- **Causa raíz del hueco A, encontrada al aplicar la 12:** el paso 5.6 de `/fix-close` pedía
  cosechar solo gotchas de dominio y decía explícitamente que un fix visual o de código se
  saltara. Por eso los gotchas citan 146 tracks y los patrones casi ninguno.

### Propuestas

| # | Propuesta | Track | Resuelve |
| - | --------- | ----- | -------- |
| 10 | **`/spec-plan` y la plantilla del plan consultan los patrones.** Leer `ANTI-PATTERNS.md` completo y las secciones pertinentes de `DOMAIN-GOTCHAS.md`; completar la lista de restricciones; sección nueva "Patrones que instancia esta feature" | Guía | C, D, G |
| 11 | **Catálogo de patrones (`indices/PATTERNS.md`).** Una fila por arquetipo: cuándo se usa, implementación de referencia, regla que lo gobierna, guard que lo exige. Arquetipos candidatos: lista app-like con KPIs, ficha con tabs, drawer de dominio, wizard de pantalla completa, formulario en drawer, facade SWR con guard de orden, facade con Realtime, estado de error de carga, edge function con guard, migración con RLS y test | Guía | B, E |
| 12 | **Cosecha al cerrar un track.** Pregunta fija en `/fix-close` y al cerrar una spec: "¿este track decidió algo que la próxima feature debería repetir o evitar?". La respuesta va al catálogo, a un antipatrón o a una regla | Guía | A |
| 13 | **Guards para los tres patrones que hoy son solo prosa.** Tests guardianes al estilo de `unchecked-reads.guard.spec.ts`: facade con sede sin guard de orden; facade con `initialize()` sin la bandera de SWR; página enrutable sin modificador app-like ni entrada en el registro de excepciones | Estructural | F |
| 14 | **Etiqueta de alcance** (genérico o de este proyecto) en reglas y antipatrones, para poder exportar las genéricas | Guía | H |

**Orden sugerido:** 11 primero, porque 10 y 12 necesitan un lugar adonde apuntar. La parte que no
puede hacer un agente solo es elegir la implementación de referencia de cada arquetipo: es una
decisión de quienes conocen qué pantalla quedó mejor.

**Sobre la 14:** depende de si el boilerplate es algo que el equipo mantiene y quiere mejorar para
el próximo proyecto. Si no, sobra.

---

## Trampas de este trabajo

- **Los trinquetes se pueden subir a mano.** `--update-qa-baseline` registra lo que haya. Lo único
  que lo delata es el diff de la línea base en el PR: hay que mirarlo en la revisión.
- **ARCH-36 comprueba que el guard se importa, no que se llama.** Es la mitad barata del chequeo;
  la otra mitad son los tests de manejador de `010`.
- **ARCH-34 detecta por forma.** Una contraseña sin dígitos o sin la palabra "contraseña" en la
  misma línea no la ve.
- **ARCH-37 enlaza por timestamp.** Un test que menciona la migración sin probar el permiso pasa.
  El chequeo asegura que el test existe, no que sea bueno.
