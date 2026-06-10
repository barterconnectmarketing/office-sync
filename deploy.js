const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs   = require('fs');

const ssh = new NodeSSH();

const CONFIG = {
  host:     '76.13.185.201',
  username: 'root',
  password: process.env.SSH_PASS,
};

const REMOTE_BASE  = '/var/www/office-barterconnect';
const LOCAL_DIST   = path.join(__dirname, 'client', 'dist');
const LOCAL_SERVER = path.join(__dirname, 'server');
const LOCAL_SCHEMA = path.join(__dirname, 'schema.sql');
const LOCAL_NGINX  = path.join(__dirname, 'nginx.conf');

async function run(label, cmd) {
  process.stdout.write(`  → ${label} ... `);
  const r = await ssh.execCommand(cmd);
  if (r.code !== 0 && r.stderr && !r.stderr.includes('already exists') && !r.stderr.includes('NOTICE')) {
    console.log('FAIL');
    console.error('    ' + r.stderr.trim());
    process.exit(1);
  }
  console.log('ok');
  if (r.stdout.trim()) console.log('    ' + r.stdout.trim().split('\n').slice(0, 3).join('\n    '));
}

async function main() {
  console.log('\n🔌 Connecting to VPS...');
  await ssh.connect({ ...CONFIG, readyTimeout: 15000 });
  console.log('   Connected to', CONFIG.host);

  // 1. สร้าง directories
  console.log('\n📁 Creating directories...');
  await run('mkdir dist',   `mkdir -p ${REMOTE_BASE}/dist`);
  await run('mkdir server', `mkdir -p ${REMOTE_BASE}/server`);

  // 2. อัปโหลด dist/
  console.log('\n📦 Uploading client build...');
  await ssh.putDirectory(LOCAL_DIST, `${REMOTE_BASE}/dist`, {
    recursive: true,
    concurrency: 5,
    tick(local, remote, err) {
      if (err) console.error('  ✗', path.basename(local));
    },
  });
  console.log('  → dist/ uploaded ok');

  // 3. อัปโหลด server/
  console.log('\n🖥️  Uploading server...');
  const serverFiles = fs.readdirSync(LOCAL_SERVER)
    .filter(f => f !== 'node_modules' && f !== '.env');
  for (const f of serverFiles) {
    await ssh.putFile(
      path.join(LOCAL_SERVER, f),
      `${REMOTE_BASE}/server/${f}`
    );
  }
  console.log('  → server files uploaded ok');

  // 4. อัปโหลด schema + nginx
  console.log('\n📄 Uploading config files...');
  await ssh.putFile(LOCAL_SCHEMA, `${REMOTE_BASE}/schema.sql`);
  await ssh.putFile(LOCAL_NGINX, `/etc/nginx/sites-available/office.barterconnect.io`);
  console.log('  → schema.sql ok');
  console.log('  → nginx config ok');

  // 5. ตั้งค่า .env บน server
  console.log('\n⚙️  Writing .env...');
  const envContent = [
    'DB_HOST=localhost',
    'DB_PORT=5432',
    'DB_NAME=office_management',
    'DB_USER=postgres',
    'DB_PASSWORD=',
    'PORT=3001',
  ].join('\n');
  await ssh.execCommand(`cat > ${REMOTE_BASE}/server/.env << 'ENVEOF'\n${envContent}\nENVEOF`);
  console.log('  → .env ok');

  // 6. ติดตั้ง Node.js dependencies ของ server
  console.log('\n📦 Installing server dependencies...');
  await run('npm install', `cd ${REMOTE_BASE}/server && npm install --omit=dev`);

  // 7. สร้าง PostgreSQL database + table
  console.log('\n🗄️  Setting up database...');
  await run('create db',    `sudo -u postgres psql -c "CREATE DATABASE office_management;" 2>&1 || true`);
  await run('create table', `sudo -u postgres psql -d office_management -f ${REMOTE_BASE}/schema.sql`);

  // 8. ติดตั้ง PM2 + start server
  console.log('\n🚀 Starting Express server with PM2...');
  await run('install pm2',  `npm install -g pm2 2>&1 | tail -1`);
  await run('stop old',     `pm2 delete office-api 2>&1 || true`);
  await run('start server', `cd ${REMOTE_BASE}/server && pm2 start index.js --name office-api`);
  await run('pm2 save',     `pm2 save`);
  await run('pm2 startup',  `pm2 startup systemd -u root --hp /root 2>&1 | tail -2`);

  // 9. ตั้งค่า Nginx
  console.log('\n🌐 Configuring Nginx...');
  await run('enable site',  `ln -sf /etc/nginx/sites-available/office.barterconnect.io /etc/nginx/sites-enabled/`);
  await run('nginx test',   `nginx -t`);
  await run('nginx reload', `systemctl reload nginx`);

  // 10. ตรวจสอบสุดท้าย
  console.log('\n✅ Verifying...');
  await run('pm2 status', `pm2 list | grep office-api`);
  await run('port 3001',  `ss -tlnp | grep 3001 | head -1`);

  ssh.dispose();
  console.log('\n🎉 Deploy สำเร็จ! เปิด http://office.barterconnect.io ได้เลย\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  ssh.dispose();
  process.exit(1);
});
