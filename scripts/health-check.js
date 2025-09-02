const http = require('http');
const url = process.env.RENDER_SERVICE_URL || 'http://localhost:10000/health';
http.get(url, (res) => {
  if (res.statusCode === 200) { console.log('✅ Health OK'); process.exit(0); }
  console.error('❌ Health status:', res.statusCode); process.exit(1);
}).on('error', (e) => { console.error('🚨 Health error:', e.message); process.exit(1); });
