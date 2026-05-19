/**
 * 同时启动 Express（3002）与 Vite（5173），避免只开前端导致 /api 代理失败。
 * 用法：在 wenap 目录执行 npm run dev:full
 *
 * Windows：两个子进程若同时对父终端 stdout/stderr 使用 inherit，可能互相干扰，
 * 表现为后端刚打印完监听日志就立刻以 code=0 退出。改为 pipe 并转发到父进程。
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(path.join(root, 'server.cjs'))) {
  console.error('[dev:full] 请在 wenap 目录下运行（找不到 server.cjs）');
  process.exit(1);
}
if (!fs.existsSync(viteCli)) {
  console.error('[dev:full] 找不到 Vite，请先执行 npm install');
  process.exit(1);
}

const inheritedOut = ['ignore', 'pipe', 'pipe'];

function pipeToParent(child, label) {
  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
    });
  }
  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });
  }
  child.on('error', (err) => {
    console.error(`[dev:full] ${label} 无法启动:`, err.message);
    process.exit(1);
  });
}

const api = spawn(process.execPath, ['server.cjs'], {
  cwd: root,
  stdio: inheritedOut,
  env: process.env,
});
pipeToParent(api, '后端');

let web = null;

function startWeb() {
  web = spawn(process.execPath, [viteCli], {
    cwd: root,
    stdio: inheritedOut,
    env: process.env,
  });
  pipeToParent(web, '前端');

  web.on('exit', (code, signal) => {
    if (!exiting) {
      exiting = true;
      console.error(`[dev:full] 前端已退出 code=${code} signal=${signal ?? ''}`);
      try {
        api.kill('SIGTERM');
      } catch (_) {
        /* ignore */
      }
      process.exit(code === null ? 1 : code);
    }
  });
}

if (process.platform === 'win32') {
  setTimeout(startWeb, 450);
} else {
  startWeb();
}

let exiting = false;

function killChildren() {
  if (exiting) return;
  exiting = true;
  try {
    api.kill('SIGTERM');
  } catch (_) {
    /* ignore */
  }
  try {
    if (web) web.kill('SIGTERM');
  } catch (_) {
    /* ignore */
  }
}

['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    killChildren();
    process.exit(0);
  });
});

api.on('exit', (code, signal) => {
  if (!exiting) {
    exiting = true;
    console.error(`[dev:full] 后端已退出 code=${code} signal=${signal ?? ''}`);
    try {
      if (web) web.kill('SIGTERM');
    } catch (_) {
      /* ignore */
    }
    process.exit(code === null ? 1 : code);
  }
});
