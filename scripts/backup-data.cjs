/**
 * 打包 data/（wenap.db + history 等）到 backups/ 目录。
 * Render Free 部署前可下载此包留底。
 * 用法：npm run backup:data
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const outDir = path.join(root, 'backups');

if (!fs.existsSync(dataDir)) {
  console.error('无 data/ 目录，请先运行过服务或 seed。');
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const archive = path.join(outDir, `wenap-data-${stamp}.tar.gz`);

fs.mkdirSync(outDir, { recursive: true });

const isWin = process.platform === 'win32';
if (isWin) {
  const zipPath = archive.replace(/\.tar\.gz$/, '.zip');
  try {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${dataDir}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' },
    );
    console.log('已写入:', zipPath);
  } catch (e) {
    console.error('备份失败:', e.message);
    process.exit(1);
  }
} else {
  execSync(`tar -czf "${archive}" -C "${root}" data`, { stdio: 'inherit' });
  console.log('已写入:', archive);
}
