'use strict';

require('dotenv').config();

const { createClient } = require('./bot/client');
const sessionManager = require('./utils/session');

async function main() {
  console.log('='.repeat(50));
  console.log('  钉钉主机监控 Agent 启动中...');
  console.log('='.repeat(50));

  const client = createClient();

  await client.connect();
  console.log('✅ DingTalk Stream 连接成功，等待消息...');
  console.log(`📋 活跃会话数: ${sessionManager.getActiveSessions()}`);

  // 优雅退出：关闭 WebSocket 连接
  const gracefulShutdown = () => {
    console.log('\n🛑 正在关闭...');
    try {
      client.disconnect();
    } catch (_) {}
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

main().catch((err) => {
  console.error('❌ 启动失败:', err);
  process.exit(1);
});
