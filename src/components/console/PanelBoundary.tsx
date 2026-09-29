import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { operatorMessage } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * One panel failing must not take the show with it.
 *
 * The only boundary in this app was TanStack's route-level `errorComponent`, so
 * a render error anywhere in the console replaced the whole page with "This page
 * didn't load". For a seller who is live on air that means the buyer chat, the
 * proposal queue, the pinned lot, the action approvals and the audit log all
 * disappear because one of them threw — and the thing they were in the middle of
 * is answering a person who is waiting.
 *
 * The console renders a live stream of data much of which is shaped by scraped
 * third-party content, against a type contract that lives in another repo. A
 * field that is null where a string was promised throws during render. That is
 * not hypothetical here: closing the null-vs-zero class across this wire took
 * eight separate fixes.
 *
 * So: a boundary per panel. The panel that failed says so in its own space and
 * offers to try again; everything beside it keeps working. Same reasoning as the
 * backend's `unhandledRejection` handler — a fault in one place should cost that
 * place, not the session.
 */
interface Props {
  /** What this panel is, in the words the operator sees elsewhere for it. */
  name: string;
  /**
   * The classes the wrapper this replaces was carrying.
   *
   * The boundary IS the panel's layout box rather than a wrapper inside it —
   * an extra flex child between a column and its panel is how the empty-catalog
   * notice broke this layout once already.
   */
  className?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class PanelBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Reported with the panel's name, because "the console threw" is the report
    // this already produced and it never said which part.
    reportLovableError(error, {
      boundary: "console_panel",
      panel: this.props.name,
      componentStack: info.componentStack?.slice(0, 2000),
    });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return <div className={this.props.className}>{this.props.children}</div>;

    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center gap-2 overflow-hidden rounded-md bg-panel p-4 text-center",
          this.props.className,
        )}
      >
        <AlertTriangle className="size-4 text-bad" aria-hidden />
        <p className="text-[13px] font-medium text-text">{this.props.name} stopped drawing</p>
        {/* The seller's first question is whether the rest still works. Answer it
            before anything else, because the alternative is that they reload and
            lose a session that is on air. */}
        <p className="max-w-[34ch] text-[12px] leading-snug text-text-muted">
          The rest of the console is still live and your session is untouched.{" "}
          {operatorMessage(error)}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-1 rounded-sm bg-elevated px-2 py-1 text-[12px] text-text hover:bg-elevated/80"
        >
          Draw it again
        </button>
      </div>
    );
  }
}
