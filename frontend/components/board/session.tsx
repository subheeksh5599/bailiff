"use client";

/**
 * The board's session.
 *
 * The reads are public on purpose — /health, /cases, /case?ref= and /selftest are how
 * anyone checks this product without an account. But the things that change a case,
 * spend a call, or take a file are not public, so the board asks for the operator's
 * passphrase once, keeps the token it gets back in this browser, and hands it to every
 * action that needs one.
 *
 * The token is only ever stored as a hash on the deployment, and it expires on its own.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/backend";
import { Button, Input, Panel } from "@/components/fabric/ui";

const STORAGE_KEY = "bailiff.operator.session";

type SessionValue = {
  token: string | null;
  signedIn: boolean;
  ready: boolean;
  signIn: (passphrase: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): ReactNode {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInMutation = useMutation(api.signIn);
  const signOutMutation = useMutation(api.signOut);
  const state = useQuery(api.session, token ? { token } : {});

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setToken(stored);
    setReady(true);
  }, []);

  // A token the deployment no longer honours is dropped rather than retried forever.
  useEffect(() => {
    if (token && state && state.signedIn === false) {
      window.localStorage.removeItem(STORAGE_KEY);
      setToken(null);
    }
  }, [token, state]);

  const signIn = useCallback(
    async (passphrase: string) => {
      setError(null);
      try {
        const result = await signInMutation({ passphrase, label: "board" });
        window.localStorage.setItem(STORAGE_KEY, result.token);
        setToken(result.token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "that did not work");
      }
    },
    [signInMutation]
  );

  const signOut = useCallback(() => {
    const current = token;
    window.localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    if (current) void signOutMutation({ token: current }).catch(() => {});
  }, [token, signOutMutation]);

  const value = useMemo<SessionValue>(
    () => ({
      token,
      signedIn: Boolean(token) && (state?.signedIn ?? true),
      ready,
      signIn,
      signOut,
      error,
    }),
    [token, state, ready, signIn, signOut, error]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside its provider");
  return value;
}

export function SignInGate({ children }: { children: ReactNode }): ReactNode {
  const { signedIn, ready } = useSession();
  if (!ready) return null;
  if (!signedIn) return <SignIn />;
  return <>{children}</>;
}

/**
 * The one screen that is not public. It says what it is for rather than just asking
 * for a secret: the reads are open, the actions are not, and that is a deliberate
 * split rather than a general-purpose login.
 */
function SignIn(): ReactNode {
  const { signIn, error } = useSession();
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <Panel className="p-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">bailiff</p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-white">
          This board is the operator&rsquo;s.
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-neutral-400">
          Everything that reads is public: <span className="data">/health</span>,{" "}
          <span className="data">/selftest</span>, <span className="data">/cases</span> and any case
          as JSON. Closing a case, releasing a charge, spending a call and taking a file are not —
          those need the passphrase this deployment was configured with.
        </p>
        <div className="mt-6 space-y-3">
          <Input
            type="password"
            autoFocus
            value={passphrase}
            placeholder="operator passphrase"
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && passphrase.trim()) {
                setBusy(true);
                void signIn(passphrase).finally(() => setBusy(false));
              }
            }}
          />
          <Button
            disabled={busy || !passphrase.trim()}
            onClick={() => {
              setBusy(true);
              void signIn(passphrase).finally(() => setBusy(false));
            }}
          >
            {busy ? "Checking…" : "Sign in"}
          </Button>
          {error && <p className="text-[12px] leading-relaxed text-[#f0a8a8]">{error}</p>}
        </div>
        <p className="mt-6 text-[11px] leading-relaxed text-neutral-500">
          Sessions last a working day and the deployment stores only their hashes. The public reads
          above stay open with no session at all.
        </p>
      </Panel>
    </div>
  );
}
