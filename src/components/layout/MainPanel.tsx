import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function MainPanel({ children }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-elevated/72">
      {children}
    </div>
  );
}
