import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "paisapulse:install-dismissed";

export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !promptEvent) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-float">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-card-foreground">
            Install PaisaPulse
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add it to your home screen for one-tap access.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={install}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground active:scale-95"
          >
            <Download className="h-4 w-4" />
            Install
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss install banner"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
