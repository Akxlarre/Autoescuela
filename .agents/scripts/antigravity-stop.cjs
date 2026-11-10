const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
process.chdir(repoRoot);

let inputRaw = '';
process.stdin.on('data', chunk => (inputRaw += chunk));
process.stdin.on('end', () => {
  try {
    const hotfixPath = path.join(repoRoot, '.claude', 'hooks', 'sdd', 'hotfix-autoclose.js');
    if (fs.existsSync(hotfixPath)) {
      spawnSync(process.execPath, [hotfixPath], {
        input: '{}',
        cwd: repoRoot,
        encoding: 'utf8'
      });
    }
  } catch {
    // Silently skip
  }
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
});
