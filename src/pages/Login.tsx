import { useState } from "react";
import { Input, Button, message } from "antd";
import { ALLOWED_USERS } from "../api/config";

interface Props {
  onLogin: (user: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [name, setName] = useState("");

  function submit() {
    const u = name.trim();
    if (!u) { message.warning("请输入用户名"); return; }
    if (!ALLOWED_USERS.includes(u)) { message.error("无权限"); return; }
    onLogin(u);
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:.6} }
        @keyframes dot-pulse { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.5);opacity:1} }
      `}</style>
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#f5f7fa] to-[#e4ecf7]">
      <div className="w-[340px] bg-white rounded-lg shadow-md border border-[#f0f0f0] p-8 flex flex-col gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#1e3a8a]">MechSim</div>
          <div className="text-[13px] text-[#888] mt-1">机电仿真平台</div>
        </div>
        <Input
          size="large"
          placeholder="请输入6位工号"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={submit}
          autoFocus
        />
        <Button type="primary" size="large" block onClick={submit}>
          登录
        </Button>
      </div>
    </div>
    </>
  );
}
