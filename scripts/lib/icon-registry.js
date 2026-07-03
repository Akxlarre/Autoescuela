/**
 * icon-registry.js — Cross-reference de íconos Lucide (spec 0020)
 *
 * Un ícono usado en template (<app-icon name="x">) o en config TS (icon: 'x')
 * que no esté registrado en LucideAngularModule.pick() de app.config.ts
 * revienta EN RUNTIME. Este módulo permite detectarlo en lint time.
 */

/** `trending-up` → `TrendingUp`, `trash-2` → `Trash2`, `rotate-ccw` → `RotateCcw` */
export function kebabToPascal(name) {
  return name
    .split('-')
    .map(seg => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
}

/**
 * Recolecta usos de íconos en el contenido de un archivo (.ts con template inline,
 * .html, o configs TS con `icon: '...'`).
 * Devuelve { statics: string[], ternaryLiterals: string[], dynamicCount: number }.
 */
export function collectUsedIcons(content) {
  const statics = [];
  const ternaryLiterals = [];
  let dynamicCount = 0;

  // Tags <app-icon ...> / <lucide-icon ...> — pueden abarcar varias líneas
  const tagRe = /<(?:app-icon|lucide-icon)\b([^>]*)>/g;
  let tag;
  while ((tag = tagRe.exec(content)) !== null) {
    const attrs = tag[1];

    const staticName = attrs.match(/(?<!\[)\bname\s*=\s*"([^"]+)"/);
    if (staticName) {
      statics.push(staticName[1]);
      continue;
    }

    const binding = attrs.match(/\[name\]\s*=\s*"([^"]+)"/);
    if (binding) {
      // Ternario de literales resoluble: cond ? 'a' : 'b' (los literales de la
      // condición quedan fuera porque se matchea desde el '?')
      const ternary = binding[1].match(/\?\s*'([a-z0-9-]+)'\s*:\s*'([a-z0-9-]+)'/);
      if (ternary) {
        ternaryLiterals.push(ternary[1], ternary[2]);
      } else {
        dynamicCount++;
      }
    }
  }

  // Configs TS: icon: 'kebab-name' (menús, KPIs, tablas de estado, etc.)
  const configRe = /\bicon\s*:\s*'([a-z][a-z0-9-]*)'/g;
  let cfg;
  while ((cfg = configRe.exec(content)) !== null) {
    // Excluir clases PrimeNG ('pi pi-x' no matchea por el espacio; 'pi-x' sí podría)
    if (!cfg[1].startsWith('pi-')) statics.push(cfg[1]);
  }

  return { statics, ternaryLiterals, dynamicCount };
}

/**
 * Extrae el set de íconos registrados (claves del ObjectLiteral de
 * LucideAngularModule.pick) desde el fuente de app.config.ts. AST real.
 */
export function parseRegisteredIcons(appConfigSrc, ts) {
  const sf = ts.createSourceFile('app.config.ts', appConfigSrc, ts.ScriptTarget.Latest, true);
  const registered = new Set();

  function walk(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'pick' &&
      node.expression.expression.getText(sf) === 'LucideAngularModule' &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const prop of node.arguments[0].properties) {
        // Shorthand { ArrowLeft } o alias { CircleAlert: AlertCircle } → cuenta la CLAVE
        const key = prop.name?.getText(sf);
        if (key) registered.add(key);
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);
  return registered;
}
