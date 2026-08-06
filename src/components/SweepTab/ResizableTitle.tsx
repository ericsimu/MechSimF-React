import type { ResizeCallbackData } from "react-resizable";
import { Resizable } from "react-resizable";

const style = `
.react-resizable{position:relative}
.react-resizable-handle-e,.react-resizable-handle-w{
  position:absolute!important;right:-5px!important;top:0!important;bottom:0!important;
  width:10px!important;cursor:col-resize!important;z-index:1!important;
  background:none!important;border:none!important;outline:none!important;
  padding:0!important;transform:none!important
}
.react-resizable-handle-e::after,.react-resizable-handle-w::after{
  content:"";position:absolute;left:50%;top:4px;bottom:4px;width:1px;
  background:transparent;transition:background .15s
}
.react-resizable-handle-e:hover::after,.react-resizable-handle-w:hover::after{background:#d9d9d9}
`;

export function ResizableTitle(props: {
  onResize: (e: React.SyntheticEvent, data: ResizeCallbackData) => void;
  width: number; children: React.ReactNode;
}) {
  const { onResize, width, children, ...rest } = props;
  return (
    <>
      <style>{style}</style>
      <Resizable width={width} height={0} axis="x" onResize={onResize} draggableOpts={{ enableUserSelectHack: false }}>
        <div {...rest} style={{ width, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {children}
        </div>
      </Resizable>
    </>
  );
}
