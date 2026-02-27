import type { ReactNode } from "react";

interface Props {
  iconRail: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
}

export default function AppShell({ iconRail, sidebar, main }: Props) {
  return (
    <div className="grid h-screen grid-cols-[48px_260px_1fr] overflow-hidden">
      {iconRail}
      {sidebar}
      {main}
    </div>
  );
}
