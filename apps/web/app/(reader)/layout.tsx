import type { ReactNode } from "react";
import { Shell } from "../../components/shell";
import { SessionProvider } from "../../lib/session";

export default function ReaderLayout({ children }: { children: ReactNode }) {
  return <SessionProvider><Shell>{children}</Shell></SessionProvider>;
}
