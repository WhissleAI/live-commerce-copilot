import { Kbd } from "./primitives";

const ROWS: [string, string][] = [
  ["J / ↓", "focus next proposal"],
  ["K / ↑", "focus previous proposal"],
  ["Enter", "send the focused proposal"],
  ["E", "edit the focused proposal inline"],
  ["⌘/Ctrl + Enter", "send while editing"],
  ["Escape", "cancel edit / close palette"],
  ["X", "dismiss the focused proposal"],
  ["R", "regenerate the focused proposal"],
  ["A", "approve the top pending action"],
  ["U", "undo the most recent committed action"],
  ["⌘/Ctrl + K", "command bar — go anywhere, run anything"],
  ["⌘/Ctrl + J", "research a product"],
  ["⌘/Ctrl + 1…6", "jump to a section of the rail"],
  ["?", "toggle this overlay"],
];

export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-canvas/80"
      onClick={onClose}
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-in w-[440px] max-w-[92vw] rounded-md border border-hairline-strong bg-panel"
      >
        <div className="section-header border-b border-hairline px-3 py-2">Keyboard</div>
        <ul className="p-2">
          {ROWS.map(([k, d]) => (
            <li key={k} className="flex items-center justify-between px-1 py-1 text-[12px]">
              <span className="text-text-secondary">{d}</span>
              <Kbd className="px-1.5">{k}</Kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
