'use strict';

const axios = require('axios');
const { wrapAsCodeBlocks } = require('../utils/format');

/**
 * 通过 sessionWebhook 发送消息回钉钉
 * DingTalk Stream 模式下，每条消息事件都携带 sessionWebhook，
 * 直接 POST 到该 URL 即可回复（有效期约 30 分钟）
 */

/**
 * 发送 Markdown 格式消息
 * @param {string} webhook - 消息事件中的 sessionWebhook
 * @param {string} title   - 消息标题（仅用于通知栏展示）
 * @param {string} text    - Markdown 正文
 */
async function sendMarkdown(webhook, title, text) {
  await axios.post(webhook, {
    msgtype: 'markdown',
    markdown: { title, text },
  });
}

/**
 * 发送纯文本消息
 * @param {string} webhook
 * @param {string} text
 */
async function sendText(webhook, text) {
  await axios.post(webhook, {
    msgtype: 'text',
    text: { content: text },
  });
}

/**
 * 将终端输出作为代码块发送（自动分割长文本）
 * @param {string} webhook
 * @param {string} rawOutput - 含 ANSI 的原始终端输出
 */
async function sendTerminalOutput(webhook, rawOutput) {
  const blocks = wrapAsCodeBlocks(rawOutput, 2800);
  for (const block of blocks) {
    await sendMarkdown(webhook, '终端输出', block);
  }
}

/**
 * 发送错误消息
 * @param {string} webhook
 * @param {string} message
 */
async function sendError(webhook, message) {
  await sendMarkdown(webhook, '错误', `> ❌ **错误**: ${message}`);
}

module.exports = {
  sendMarkdown,
  sendText,
  sendTerminalOutput,
  sendError,
};
