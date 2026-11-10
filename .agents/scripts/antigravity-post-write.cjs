const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
process.chdir(repoRoot);

let inputRaw = '';
process.stdin.on('data', chunk => (inputRaw += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputRaw);
    const toolCall = input.toolCall || {};
    const args = toolCall.args || {};
    const filePath = args.Path || args.path || '';

    const claudePayload = {
      tool_input: {
        file_path: filePath
      }
    };

    const postEditPath = path.join(repoRoot, '.claude', 'scripts', 'post-edit.js');
    if (fs.existsSync(postEditPath)) {
      spawnSync(process.execPath, [postEditPath], {
        input: JSON.stringify(claudePayload),
        cwd: repoRoot,
        encoding: 'utf8'
      });
    }
  } catch {
    // Silently skip
  }
  console.log('{}');
  process.exit(0);
});
