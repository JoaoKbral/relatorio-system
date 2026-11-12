"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "installHint.dismissed";

/** Chrome/Android's install event (not in the TS DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "other" | null;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** null on the server, when installed, or when the hint was closed. */
function platformSnapshot(): Platform {
  if (isStandalone() || wasDismissed()) return null;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

const subscribeNothing = () => () => {};

/**
 * Suggests installing the app, which is what makes offline use reliable:
 * Android gets an "Instalar" button, iPhone gets the Share → "Adicionar à Tela
 * de Início" steps (Safari has no install button). Hidden once installed.
 */
export default function InstallHint() {
  const platform = useSyncExternalStore(subscribeNothing, platformSnapshot, () => null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setHidden(true);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setHidden(true);
  }

  // Android/desktop: only when the browser offers installation.
  const mode = hidden ? null : platform === "ios" ? "ios" : platform === "other" && prompt ? "android" : null;
  if (!mode) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 flex gap-3">
      <div className="flex-1 flex flex-col gap-2">
        <p className="font-semibold">Instale o app para usar sem internet</p>
        {mode === "ios" ? (
          <p>
            No Safari, toque em <Share className="inline w-4 h-4 -mt-1" aria-label="Compartilhar" /> e depois em{" "}
            <strong>Adicionar à Tela de Início</strong>. Abra o app pelo ícone e entre com seu login uma vez com
            internet.
          </p>
        ) : (
          <>
            <p>Assim o relatório pode ser preenchido mesmo longe do sinal e é enviado depois.</p>
            <Button size="sm" className="self-start" onClick={install}>
              <Download className="w-4 h-4 mr-1" />
              Instalar
            </Button>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Fechar aviso" className="self-start text-blue-700">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
