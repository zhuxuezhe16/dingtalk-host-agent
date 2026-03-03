'use strict';

const si = require('systeminformation');
const { sendMarkdown } = require('../bot/sender');
const { formatBytes, progressBar, mdHeader, mdKV, mdDivider } = require('../utils/format');

/**
 * /info - 系统总览
 */
async function handleInfo(webhook) {
  const [cpu, mem, osInfo, load, disk] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.currentLoad(),
    si.fsSize(),
  ]);

  const memUsedPct = (mem.active / mem.total) * 100;
  const diskMain = disk.find((d) => d.mount === '/' || d.mount === 'C:\\') || disk[0] || {};

  let text = mdHeader('系统总览', '🖥️');
  text += mdKV('系统', `${osInfo.distro} ${osInfo.release} (${osInfo.arch})`);
  text += mdKV('主机名', osInfo.hostname);
  text += mdKV('CPU', `${cpu.manufacturer} ${cpu.brand} @ ${cpu.speed} GHz × ${cpu.physicalCores} 核`);
  text += mdKV('CPU 负载', progressBar(load.currentLoad));
  text += mdDivider();
  text += mdKV('内存', `${formatBytes(mem.active)} / ${formatBytes(mem.total)}`);
  text += mdKV('内存占用', progressBar(memUsedPct));

  if (diskMain.size) {
    const diskUsedPct = (diskMain.used / diskMain.size) * 100;
    text += mdDivider();
    text += mdKV('磁盘 (主分区)', `${formatBytes(diskMain.used)} / ${formatBytes(diskMain.size)}`);
    text += mdKV('磁盘占用', progressBar(diskUsedPct));
  }

  await sendMarkdown(webhook, '系统总览', text);
}

/**
 * /cpu - CPU 详细信息
 */
async function handleCpu(webhook) {
  const [cpu, load] = await Promise.all([si.cpu(), si.currentLoad()]);

  let text = mdHeader('CPU 使用率', '⚙️');
  text += mdKV('型号', `${cpu.manufacturer} ${cpu.brand}`);
  text += mdKV('主频', `${cpu.speed} GHz`);
  text += mdKV('物理核心 / 逻辑核心', `${cpu.physicalCores} / ${cpu.cores}`);
  text += mdDivider();
  text += mdKV('整体负载', progressBar(load.currentLoad));
  text += mdKV('用户态', `${load.currentLoadUser.toFixed(1)}%`);
  text += mdKV('系统态', `${load.currentLoadSystem.toFixed(1)}%`);
  text += mdDivider();

  // 各核心负载
  if (load.cpus && load.cpus.length > 0) {
    text += '**各核心负载:**\n\n';
    load.cpus.forEach((core, i) => {
      text += `- 核心 ${i + 1}: ${progressBar(core.load, 10)}\n`;
    });
  }

  await sendMarkdown(webhook, 'CPU 使用率', text);
}

/**
 * /mem - 内存使用情况
 */
async function handleMem(webhook) {
  const mem = await si.mem();
  const usedPct = (mem.active / mem.total) * 100;
  const swapPct = mem.swaptotal > 0 ? (mem.swapused / mem.swaptotal) * 100 : 0;

  let text = mdHeader('内存使用', '💾');
  text += mdKV('总内存', formatBytes(mem.total));
  text += mdKV('已使用 (活跃)', formatBytes(mem.active));
  text += mdKV('可用', formatBytes(mem.available));
  text += mdKV('缓存/Buffer', formatBytes(mem.buffcache));
  text += mdKV('使用率', progressBar(usedPct));

  if (mem.swaptotal > 0) {
    text += mdDivider();
    text += mdKV('Swap 总量', formatBytes(mem.swaptotal));
    text += mdKV('Swap 已用', formatBytes(mem.swapused));
    text += mdKV('Swap 使用率', progressBar(swapPct));
  }

  await sendMarkdown(webhook, '内存使用', text);
}

/**
 * /disk - 磁盘使用情况
 */
async function handleDisk(webhook) {
  const disks = await si.fsSize();

  let text = mdHeader('磁盘使用', '💿');

  for (const disk of disks) {
    if (!disk.size) continue;
    const usedPct = (disk.used / disk.size) * 100;
    text += `**挂载点: \`${disk.mount}\`** (${disk.type})\n`;
    text += `- 容量: ${formatBytes(disk.size)}  |  已用: ${formatBytes(disk.used)}  |  可用: ${formatBytes(disk.available)}\n`;
    text += `- ${progressBar(usedPct)}\n\n`;
  }

  await sendMarkdown(webhook, '磁盘使用', text);
}

module.exports = { handleInfo, handleCpu, handleMem, handleDisk };
