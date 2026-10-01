import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./LandingLayout.astro', import.meta.url)),
  'utf8',
);

// hotfix-008-i (ASG-i-040): la hidratación de la landing recibe textos editables desde
// Configuración web. Asignarlos con innerHTML permitía inyectar código (XSS almacenado).
describe('LandingLayout — hidratación sin XSS (hotfix-008-i)', () => {
  const innerHtmlAssignments = [...source.matchAll(/\.innerHTML\s*=\s*([^;]*);/g)].map((m) => m[1]);

  it('encuentra las asignaciones a innerHTML (la guarda no queda vacía)', () => {
    expect(innerHtmlAssignments.length).toBeGreaterThan(0);
  });

  it('ninguna asignación a innerHTML interpola datos de la configuración', () => {
    const datosEditables = /\$\{|\bconfig\b|\bitem\b|\binc\b|\bcourse\b|currentBrandName|\btargetCopyright\b/;

    for (const expr of innerHtmlAssignments) {
      expect(expr, `innerHTML con dato editable: ${expr.slice(0, 80)}`).not.toMatch(datosEditables);
    }
  });

  it('los textos editables se asignan con textContent o setAttribute', () => {
    expect(source).toContain('newTrustText.textContent = config.hero.trustBadge.text');
    expect(source).toContain('incText.textContent = inc');
    expect(source).toContain('emojiSpan.textContent = item.icon');
    expect(source).toContain("lucideEl.setAttribute('data-lucide', item.icon)");
    expect(source).toContain("newLogoImg.setAttribute('src', config.brand.logo)");
    expect(source).toContain('copyrightEl.textContent = targetCopyright');
  });
});
