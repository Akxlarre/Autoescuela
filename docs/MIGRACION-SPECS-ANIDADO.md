# Migración: `specs/` anidado por tipo

> **Estado: APLICADA — 2026-07-29.** Los pasos 1, 2 y 3 están hechos y verificados.
> El paso 4 (quitar los fallback de los hooks) queda opcional y pendiente.
>
> Los hooks se editaron con autorización explícita del dueño del repo, que es quien
> configuró el File Protector. El cambio no desactiva ningún gate — solo les enseña
> dónde quedaron los archivos.
>
> Este documento se conserva como registro de qué se cambió y por qué. Los ejemplos
> de "antes" describen el estado previo a propósito.
>
> Contexto: conversación de auditoría del sistema SDD, 2026-07-29.

## Resultado

| | Antes | Después |
|---|---|---|
| Entradas en la raíz de `specs/` | 181 | **7** |
| Ubicación de un spec | `specs/0033-b-slug/` | `specs/specs/0033-b-slug/` |
| Ubicación de un fix | `specs/fix-068-b-slug/` | `specs/fixes/fix-068-b-slug/` |
| Ubicación de un hotfix | `specs/fixes/hotfixes/hotfix-036-b-slug/` | `specs/hotfixes/hotfix-036-b-slug/` |
| `specs/fixes/` contiene | 0 fixes (solo `hotfixes/`) | los 142 fixes |

Los 266 tracks se movieron con `git mv` (historial preservado). Verificado con
`npm run assignments:audit` en 0 y con los hooks reales ejecutados contra la
estructura nueva.

## Por qué

Hoy los tres tipos de track viven a tres profundidades distintas:

```
spec:    specs/0033-b-slug/                        ← nivel 1
fix:     specs/fix-068-b-slug/                     ← nivel 1
hotfix:  specs/fixes/hotfixes/hotfix-036-b-slug/   ← nivel 3
```

Y `specs/fixes/` no contiene **ningún** fix track — su único hijo es `hotfixes/`.
Los 142 fixes reales están en la raíz. Es nombre engañoso, no estética: hizo
subcontar el corpus en 35% durante la auditoría, con el repo abierto y grep
disponible.

Además la raíz tiene 181 entradas y crece ~93/mes. Anidar por tipo la deja fija
en ~7 entradas para siempre, y deja listo el punto de partición futuro
(`specs/hotfixes/2026/`) sin otra migración.

## Estado destino

```
specs/
├── specs/0033-b-slug/
├── fixes/fix-068-b-slug/
├── hotfixes/hotfix-036-b-slug/
├── assignments/ASG-b-052-slug.md
├── ASSIGNMENTS.md · ROADMAP.md · AUTHORS.md · .active
```

## Orden de ejecución (importante)

Los hooks van **primero, con fallback**. Si se mueven las carpetas antes de tocar
los hooks, el Spec Gate deja de encontrar los tracks y **bloquea toda escritura de
código de producción para los 3 devs** hasta que se arregle. Con el fallback, en
ningún momento hay una ventana rota y la migración es reversible.

---

### Paso 1 — Hooks (HUMANO: archivos protegidos)

Cada cambio acepta la ruta nueva **y** la vieja. Se puede aplicar y commitear solo,
sin mover nada todavía: no cambia el comportamiento actual.

#### `.claude/hooks/sdd/spec-gate.js`

```js
// ~línea 103 — hotfix
-const hotfixMd = path.join(specsDir, 'fixes', 'hotfixes', activeId, 'hotfix.md');
+const hotfixMd =
+  [
+    path.join(specsDir, 'hotfixes', activeId, 'hotfix.md'),
+    path.join(specsDir, 'fixes', 'hotfixes', activeId, 'hotfix.md'), // legacy
+  ].find((p) => fs.existsSync(p)) ||
+  path.join(specsDir, 'hotfixes', activeId, 'hotfix.md');

// ~línea 119 — fix
-const fixDir = path.join(specsDir, activeId);
+const fixDir =
+  [path.join(specsDir, 'fixes', activeId), path.join(specsDir, activeId)].find((d) =>
+    fs.existsSync(path.join(d, 'fix.md')),
+  ) || path.join(specsDir, 'fixes', activeId);

// ~línea 135 — spec
-const specDir = path.join(specsDir, activeId);
+const specDir =
+  [path.join(specsDir, 'specs', activeId), path.join(specsDir, activeId)].find((d) =>
+    fs.existsSync(path.join(d, 'spec.md')),
+  ) || path.join(specsDir, 'specs', activeId);
```

#### `.claude/hooks/sdd/hotfix-autoclose.js`

```js
// ~línea 31
-const hotfixDir = path.join(specsDir, 'fixes', 'hotfixes', activeId);
+const hotfixDir =
+  [
+    path.join(specsDir, 'hotfixes', activeId),
+    path.join(specsDir, 'fixes', 'hotfixes', activeId), // legacy
+  ].find((d) => fs.existsSync(path.join(d, 'hotfix.md'))) ||
+  path.join(specsDir, 'hotfixes', activeId);
```

#### `.claude/hooks/sdd/plan-injector.js`

```js
// ~línea 66
-const itemDir = path.join(specsDir, activeId);
+const subdir = activeId.startsWith('hotfix-')
+  ? 'hotfixes'
+  : activeId.startsWith('fix-')
+    ? 'fixes'
+    : 'specs';
+const itemDir =
+  [
+    path.join(specsDir, subdir, activeId),
+    path.join(specsDir, activeId), // legacy spec/fix
+    path.join(specsDir, 'fixes', 'hotfixes', activeId), // legacy hotfix
+  ].find((d) => fs.existsSync(d)) || path.join(specsDir, subdir, activeId);
```

> **Bonus:** este cambio arregla un bug preexistente. Hoy `plan-injector` calcula
> `itemDir = specs/<id>`, que para un hotfix **nunca existe** → sale temprano y los
> hotfix tracks jamás recibieron inyección de contexto. Con el `subdir` empiezan a
> recibirla.

---

### Paso 2 — Mover las carpetas (agente)

```bash
mkdir -p specs/specs specs/hotfixes
git mv specs/[0-9]*-*/          specs/specs/     # 34 specs
git mv specs/fixes/hotfixes/*/  specs/hotfixes/  # 90 hotfixes
rmdir specs/fixes/hotfixes                       # queda vacío
git mv specs/fix-*/             specs/fixes/     # 142 fixes
```

Orden importante: los fixes van **al final**, porque `specs/fixes/` debe existir
como directorio con los hotfixes ya fuera antes de recibirlos.

### Paso 3 — Actualizar referencias (agente)

- `scripts/assignments-audit.js` → `SPECS_DIR`/`HOTFIX_DIR`, los `listDirs` y el
  filtro `dir === 'fixes'`.
- `scripts/assignments-sync.js` → `locateTrack()` (los 3 candidatos y el `linkPath`).
- `specs/ROADMAP.md` → los 33 links `./NNNN-…` pasan a `./specs/NNNN-…`.
- `.claude/commands/*.md` → rutas en `spec-new`, `fix-new`, `hotfix`, `assign-claim`,
  `spec-activate`, `fix-close`.
- `.claude/skills/sdd/SKILL.md` → el árbol de directorios documentado.
- `CLAUDE.md` / `.claude/CLAUDE.md` → tabla de los 3 tracks.

Verificar con `npm run assignments:audit` (valida naming, colisiones, refs y links
muertos) — debe salir en 0.

### Paso 4 — Quitar los fallback (HUMANO, opcional)

Una vez verde y commiteado, se pueden simplificar los hooks dejando solo la ruta
nueva. No es urgente: el fallback es barato y protege ante un clone viejo.

---

## Nota aparte: `.claude/settings.json`

El prompt del Stop hook de asignaciones menciona `specs/assignments/ASG-NNN-*.md`.
Tras la migración del contador por autor (2026-07-29) el patrón real es
`ASG-<autor>-NNN-*.md`. Es prosa para un checker LLM, así que sigue funcionando,
pero conviene actualizarlo cuando se toque el archivo (también protegido).
