import React from "react";

type Props = {
  error: unknown;
};

function formatError(error: unknown): { title: string; details: string } {
  if (error instanceof Error) {
    return {
      title: error.name || "Erreur",
      details: error.stack || error.message || String(error),
    };
  }
  if (typeof error === "string") {
    return { title: "Erreur", details: error };
  }
  try {
    return { title: "Erreur", details: JSON.stringify(error, null, 2) };
  } catch {
    return { title: "Erreur", details: String(error) };
  }
}

export function FatalErrorFallback({ error }: Props) {
  const { title, details } = formatError(error);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h1 className="text-lg font-semibold">MEDICBIKE – {title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          L’application a rencontré une erreur au démarrage. Copiez le détail ci-dessous et envoyez-le au support.
        </p>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-primary">Voir le détail technique</summary>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
{details}
          </pre>
        </details>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Recharger
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm"
            onClick={() => {
              try {
                navigator.clipboard.writeText(details);
              } catch {
                // ignore
              }
            }}
          >
            Copier le détail
          </button>
        </div>
      </div>
    </div>
  );
}
