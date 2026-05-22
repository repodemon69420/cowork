export interface KillSwitchResult {
  active: boolean;
  reason?: string;
}

export function checkKillSwitch(content: string): KillSwitchResult {
  const match = content.match(/^# Status:\s*(.+)/im);

  if (!match) {
    return { active: true };
  }

  const value = match[1].trim();

  if (value.toLowerCase() === 'off') {
    return { active: false, reason: 'Status set to OFF' };
  }

  return { active: true };
}
