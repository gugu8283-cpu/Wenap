require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const secret = String(process.env.ADMIN_SECRET || '').trim();
if (!secret) {
  console.log('ADMIN_SECRET 未设置。运行: npm run setup');
  process.exit(1);
}
console.log('管理后台: http://localhost:5173/admin');
console.log('登录密钥在 wenap/.env 的 ADMIN_SECRET（请勿提交到 Git）');
console.log(`密钥长度: ${secret.length} 字符`);
