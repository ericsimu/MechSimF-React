import { useState, useCallback, useRef } from "react";

const defaultWidths: Record<string, number> = {
  id: 70, name: 160, sys_name: 100, model_name: 100, sim_duration: 110,
  model_version: 70, model_productivity: 80, status: 90,
  param_diff: 90, create_time: 160, actions: 120,
};

export function useColumnResize() {
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (key: string, currentWidth: number) =>
      (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        resizeRef.current = { key, startX: e.clientX, startWidth: currentWidth };
        document.body.classList.add("col-resizing");
        const onMove = (ev: MouseEvent) => {
          if (!resizeRef.current) return;
          setColWidths(prev => ({ ...prev, [resizeRef.current!.key]: Math.max(50, resizeRef.current!.startWidth + ev.clientX - resizeRef.current!.startX) }));
        };
        const onUp = () => {
          resizeRef.current = null;
          document.body.classList.remove("col-resizing");
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      },
    [],
  );

  function colW(key: string) { return colWidths[key] ?? defaultWidths[key] ?? 100; }
  function resizeHeaderCell(key: string) {
    const w = colW(key);
    return { width: w, onMouseDown: handleResizeStart(key, w), className: "col-resizable-header" };
  }

  return { colW, resizeHeaderCell };
}
