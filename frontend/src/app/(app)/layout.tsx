import { NetworkProvider } from "@/lib/NetworkContext";
import { AppProvider } from "@/lib/AppContext";
import AppShell from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NetworkProvider>
      <AppProvider>
        <AppShell>{children}</AppShell>
      </AppProvider>
    </NetworkProvider>
  );
}
