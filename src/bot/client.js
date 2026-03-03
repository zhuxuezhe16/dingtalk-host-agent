'use strict';

const { DWClient, TOPIC_ROBOT } = require('dingtalk-stream');
const { handleMessage } = require('../handlers/message');

/**
 * 创建并启动 DingTalk Stream 客户端
 * 使用 WebSocket 长连接，无需公网 IP
 * AK = DINGTALK_APP_KEY (clientId), SK = DINGTALK_APP_SECRET (clientSecret)
 */
function createClient() {
  const appKey = process.env.DINGTALK_APP_KEY;
  const appSecret = process.env.DINGTALK_APP_SECRET;

  if (!appKey || !appSecret) {
    console.error('❌ 缺少 DINGTALK_APP_KEY 或 DINGTALK_APP_SECRET，请检查 .env 文件');
    process.exit(1);
  }

  const client = new DWClient({
    clientId: appKey,
    clientSecret: appSecret,
  });

  // 注册机器人消息回调（CALLBACK 类型，topic = TOPIC_ROBOT）
  client.registerCallbackListener(TOPIC_ROBOT, async (message) => {
    const { headers, data } = message;

    try {
      // data 是 JSON 字符串，需要解析
      const msgData = typeof data === 'string' ? JSON.parse(data) : data;
      await handleMessage(msgData);
    } catch (err) {
      console.error('[Bot] 消息处理异常:', err);
    }

    // 通知 DingTalk 服务器消息已处理（避免 60s 内重试）
    client.socketCallBackResponse(headers.messageId, { success: true });
  });

  return client;
}

module.exports = { createClient };
