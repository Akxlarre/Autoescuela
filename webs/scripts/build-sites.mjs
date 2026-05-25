import { execSync } from 'child_process';

console.log('🚀 Starting Multi-Site Astro Build for Autoescuelas Chillán...\n');

try {
  // Build Brand: Azul
  console.log('🔵 Building Brand: AZUL (Autoescuela Chillán)...');
  execSync('npx astro build', {
    env: {
      ...process.env,
      BRAND: 'azul',
    },
    stdio: 'inherit',
  });
  console.log('✅ Azul brand built successfully!\n');

  // Build Brand: Roja
  console.log('🔴 Building Brand: ROJA (Conductores Chillán)...');
  execSync('npx astro build', {
    env: {
      ...process.env,
      BRAND: 'roja',
    },
    stdio: 'inherit',
  });
  console.log('✅ Roja brand built successfully!\n');

  console.log('🎉 Multi-site build completed! Compiled folders are located at:');
  console.log('   - webs/dist/azul/  --> Upload to autoescuelachillan.cl');
  console.log('   - webs/dist/roja/  --> Upload to conductoreschillan.cl');
} catch (error) {
  console.error('\n❌ Build execution failed:', error);
  process.exit(1);
}
