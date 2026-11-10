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
    const command = args.CommandLine || args.command || '';

    const claudePayload = {
      tool_name: 'Bash',
      tool_input: {
        command: command
      }
    };

    const guardPath = path.join(repoRoot, '.claude', 'hooks', 'bash-guard.js');
    if (fs.existsSync(guardPath)) {
      const res = spawnSync(process.execPath, [guardPath], {
        input: JSON.stringify(claudePayload),
        cwd: repoRoot,
        encoding: 'utf8'
      });

      if (res.status === 2 || (res.status !== 0 && res.status !== null)) {
        const reason = (res.stderr || res.stdout || 'Comando bloqueado por Bash Guard').trim();
        console.log(JSON.stringify({
          decision: 'deny',
          reason: reason
        }));
        process.exit(0);
      }
    }

    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  } catch {
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }
});
