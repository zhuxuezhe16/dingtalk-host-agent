'use strict';

const si = require('systeminformation');
const { execSync } = require('child_process');
const { sendMarkdown, sendError } = require('../bot/sender');
const { mdHeader, mdKV, mdDivider, formatBytes } = require('../utils/format');

/**
 * /net - 网络接口信息 + 外网 IP
 */
async function handleNet(webhook) {
  const [ifaces, stats, defaultNet] = await Promise.all([
    si.networkInterfaces(),
    si.networkStats(),
    si.networkInterfaceDefault(),
  ]);

  // 外网 IP（通过公共接口查询）
  let publicIp = '获取中...';
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const json = await res.json();
    publicIp = json.ip;
  } catch (_) {
    publicIp = '无法获取（请检查网络）';
  }

  let text = mdHeader('网络状态', '🌐');
  text += mdKV('外网 IP', publicIp);
  text += mdKV('默认网卡', defaultNet);
  text += mdDivider();

  const activeIfaces = (Array.isArray(ifaces) ? ifaces : [ifaces]).filter(
    (i) => i.ip4 && i.ip4 !== '127.0.0.1'
  );

  for (const iface of activeIfaces) {
    const stat = stats.find((s) => s.iface === iface.iface);
    text += `**${iface.iface}** ${iface.iface === defaultNet ? '_(默认)_' : ''}\n`;
    text += `- IPv4: \`${iface.ip4}\`\n`;
    if (iface.ip6) text += `- IPv6: \`${iface.ip6}\`\n`;
    text += `- MAC: \`${iface.mac}\`\n`;
    if (stat) {
      text += `- ↑ 发送: ${formatBytes(stat.tx_bytes)}  ↓ 接收: ${formatBytes(stat.rx_bytes)}\n`;
    }
    text += '\n';
  }

  await sendMarkdown(webhook, '网络状态', text);
}

/**
 * /ping <host> - Ping 检测
 */
async function handlePing(webhook, args) {
  const host = args.trim();
  if (!host) {
    await sendError(webhook, '请提供主机名或 IP，例如: `/ping google.com`');
    return;
  }

  // 简单的主机名校验，防止命令注入
  if (!/^[a-zA-Z0-9.\-_]+$/.test(host)) {
    await sendError(webhook, '非法的主机名格式');
    return;
  }

  await sendMarkdown(webhook, 'Ping 检测', `> ⏳ 正在 ping \`${host}\`...`);

  try {
    const result = execSync(`ping -c 4 ${host} 2>&1`, {
      timeout: 15000,
      encoding: 'utf8',
    });

    let text = mdHeader(`Ping: ${host}`, '📡');
    text += '```\n' + result.trim() + '\n```';
    await sendMarkdown(webhook, `Ping: ${host}`, text);
  } catch (err) {
    const output = err.stdout || err.message;
    await sendMarkdown(
      webhook,
      `Ping: ${host}`,
      mdHeader(`Ping: ${host}`, '📡') + '```\n' + output + '\n```'
    );
  }
}

module.exports = { handleNet, handlePing };
