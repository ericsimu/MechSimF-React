import ModelSelectPanel from "./ModelSelectPanel";

interface Props {
  systems: string[];
  draft: Record<string, any>;
  onSysChange: (sys: string) => void;
  onDraftChange: (patch: Record<string, any>) => void;
}

export default function ModelTab({ systems, draft, onSysChange, onDraftChange }: Props) {
  return (
    <div className="edit-right">
      <ModelSelectPanel
        systems={systems}
        draft={draft}
        onSysChange={onSysChange}
        onDraftChange={onDraftChange}
      />
    </div>
  );
}
