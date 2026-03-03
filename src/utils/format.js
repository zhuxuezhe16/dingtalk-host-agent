'use strict';

// 清理 ANSI 转义序列（终端颜色/控制字符）
// 使用正则替代 strip-ansi，避免 ESM 兼容问题
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g;

function stripAnsi(str) {
  return str.replace(ANSI_REGEX, '');
}

/**
 * 将字节数格式化为可读字符串
 */
function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * 生成进度条字符串
 */
function progressBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent.toFixed(1)}%`;
}

/**
 * 将终端输出包装为钉钉代码块消息
 * 如果内容超过 maxLen，自动分割
 */
function wrapAsCodeBlocks(text, maxLen = 3000) {
  const cleaned = stripAnsi(text);
  const chunks = [];
  let remaining = cleaned;

  while (remaining.length > 0) {
    const chunk = remaining.slice(0, maxLen);
    remaining = remaining.slice(maxLen);
    chunks.push('```\n' + chunk + '\n```');
  }

  return chunks;
}

/**
 * 构建 Markdown 格式的 header 行
 */
function mdHeader(title, emoji = '🖥️') {
  return `**${emoji} ${title}**\n\n`;
}

/**
 * 构建 key-value 行
 */
function mdKV(key, value) {
  return `- **${key}**: ${value}\n`;
}

/**
 * 构建分隔线
 */
function mdDivider() {
  return '\n---\n';
}

module.exports = {
  stripAnsi,
  formatBytes,
  progressBar,
  wrapAsCodeBlocks,
  mdHeader,
  mdKV,
  mdDivider,
};
