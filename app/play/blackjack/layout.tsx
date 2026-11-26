import { TableChatDock } from "@/components/blackjack/TableChat";

/** Shared by solo blackjack and the tables, so the table chat stays open between them (ADR 0041). */
export default function BlackjackLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TableChatDock />
    </>
  );
}
