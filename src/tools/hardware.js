// Hardware Awareness — system info and adaptive behavior

import { execSync } from 'child_process';
import { cpus, totalmem, freemem, platform, arch, hostname, uptime, loadavg } from 'os';

export function getSystemInfo() {
  const cpu = cpus();
  const totalMem = (totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const freeMem = (freemem() / 1024 / 1024 / 1024).toFixed(1);
  const usedMem = (totalMem - freeMem).toFixed(1);
  const memPercent = ((usedMem / totalMem) * 100).toFixed(0);
  const load = loadavg();
  const uptimeHrs = (uptime() / 3600).toFixed(1);

  const info = [
    `Host: ${hostname()}`,
    `OS: ${platform()} ${arch()}`,
    `CPU: ${cpu[0]?.model || 'Unknown'} (${cpu.length} cores)`,
    `Memory: ${usedMem}GB / ${totalMem}GB (${memPercent}% used)`,
    `Free Memory: ${freeMem}GB`,
    `Load Average: ${load.map(l => l.toFixed(2)).join(', ')} (1m, 5m, 15m)`,
    `Uptime: ${uptimeHrs} hours`,
  ];

  // macOS specific
  if (platform() === 'darwin') {
    try {
      const battery = execSync('pmset -g batt 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
      const battMatch = battery.match(/(\d+)%/);
      if (battMatch) info.push(`Battery: ${battMatch[1]}%`);
    } catch {}

    try {
      const thermal = execSync('sudo powermetrics --samplers smc -n 1 2>/dev/null | head -5 || true', { encoding: 'utf-8', timeout: 5000 });
      if (thermal.includes('CPU')) info.push(`Thermal: ${thermal.trim().substring(0, 100)}`);
    } catch {}
  }

  return info.join('\n');
}

export function getResourceUsage() {
  const totalMem = totalmem() / 1024 / 1024 / 1024;
  const freeMem = freemem() / 1024 / 1024 / 1024;
  const memPercent = ((totalMem - freeMem) / totalMem) * 100;
  const load = loadavg()[0];
  const cpuCount = cpus().length;
  const loadPercent = (load / cpuCount) * 100;

  const status = {
    memory: memPercent > 90 ? 'critical' : memPercent > 75 ? 'high' : 'ok',
    cpu: loadPercent > 90 ? 'critical' : loadPercent > 75 ? 'high' : 'ok',
  };

  let recommendation = '';
  if (status.memory === 'critical' || status.cpu === 'critical') {
    recommendation = '\n\nSystem is under heavy load. Consider:\n- Using a smaller model\n- Closing other applications\n- Reducing context window size';
  } else if (status.memory === 'high' || status.cpu === 'high') {
    recommendation = '\n\nSystem load is elevated. Performance may be slower than usual.';
  }

  return `CPU: ${loadPercent.toFixed(0)}% (${status.cpu})\nMemory: ${memPercent.toFixed(0)}% (${status.memory})${recommendation}`;
}

export function getDiskUsage() {
  try {
    const df = execSync('df -h . 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
    return df.trim();
  } catch {
    return 'Could not determine disk usage.';
  }
}

export function getNetworkInfo() {
  try {
    const result = execSync(
      platform() === 'darwin'
        ? 'ifconfig | grep "inet " | grep -v 127.0.0.1'
        : 'ip addr show | grep "inet " | grep -v 127.0.0.1',
      { encoding: 'utf-8', timeout: 3000 }
    );
    return result.trim() || 'No network interfaces found.';
  } catch {
    return 'Could not determine network info.';
  }
}

export function shouldReduceLoad() {
  const freeMem = freemem() / 1024 / 1024 / 1024;
  const load = loadavg()[0];
  const cpuCount = cpus().length;
  return freeMem < 1.0 || (load / cpuCount) > 0.9;
}
