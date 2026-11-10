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
    const name = toolCall.name || '';
    const args = toolCall.args || {};
    const conversationId = input.conversationId || 'default';

    const filePath = args.Path || args.path || '';
    const newContent = args.Content !== undefined ? args.Content : (args.Replacement !== undefined ? args.Replacement : '');
    const oldContent = args.Target !== undefined ? args.Target : '';

    const claudePayload = {
      tool_name: name === 'write_file' ? 'Write' : 'Edit',
      tool_input: {
        file_path: filePath,
        content: newContent,
        new_string: newContent,
        old_string: oldContent
      }
    };

    const payloadStr = JSON.stringify(claudePayload);
    const childEnv = {
      ...process.env,
      CLAUDE_SESSION_ID: conversationId
    };

    // 1. SDD Spec Gate
    // 2. Pre-Write Guard (Discovery Gate + Architect Guard + File Protection)
    // 3. Harness Gate
    const guards = [
      path.join(repoRoot, '.claude', 'hooks', 'sdd', 'spec-gate.js'),
      path.join(repoRoot, '.claude', 'hooks', 'pre-write-guard.js'),
      path.join(repoRoot, '.claude', 'hooks', 'harness-gate.js')
    ];

    for (const guardPath of guards) {
      if (!fs.existsSync(guardPath)) continue;

      const res = spawnSync(process.execPath, [guardPath], {
        input: payloadStr,
        env: childEnv,
        cwd: repoRoot,
        encoding: 'utf8'
      });

      if (res.status === 2 || (res.status !== 0 && res.status !== null)) {
        const reason = (res.stderr || res.stdout || 'Operación bloqueada por guardrail de arquitectura').trim();
        console.log(JSON.stringify({
          decision: 'deny',
          reason: reason
        }));
        process.exit(0);
      }
    }

    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  } catch (err) {
    // Fail-open si hay un error inesperado en el adaptador
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }
});
