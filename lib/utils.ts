export function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function dateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return dateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

export function fmtDate(str: string): string {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function fmtHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return hr + " " + ampm;
}

export function money(n: number | undefined | null): string {
  return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function weekDaysFor(offset: number): string[] {
  const t0 = todayStr();
  const base = new Date(t0 + "T00:00:00");
  base.setDate(base.getDate() - base.getDay() + offset * 7);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(dateStr(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return days;
}

