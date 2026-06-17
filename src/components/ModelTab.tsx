import ModelSelectPanel from "./ModelSelectPanel";

interface Props {
  systems: string[];
  draft: Record<string, any>;
  onSysChange: (sys: string) => void;
  onDraftChange: (patch: Record<string, any>) => void;
}

export default function ModelTab({ systems, draft, onSysChange, onDraftChange }: Props) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden box-border px-4 py-3 min-w-0 min-h-0">
      <ModelSelectPanel
        systems={systems}
        draft={draft}
        onSysChange={onSysChange}
        onDraftChange={onDraftChange}
      />
    </div>
  );
}
