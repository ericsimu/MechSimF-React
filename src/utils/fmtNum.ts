export function fmtNum(v: number): string {
  if (!isFinite(v)) return String(v);
  const absv = Math.abs(v);
  if (absv === 0) return "0";
  if (absv < 0.001 || absv >= 10000) {
    return v.toExponential().replace("+", "");
  }
  const s = v.toFixed(10);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}
