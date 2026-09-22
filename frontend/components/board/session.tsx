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
  adopt: (token: string) => void;
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

  const adopt = useCallback((next: string) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setToken(next);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      token,
      signedIn: Boolean(token) && (state?.signedIn ?? true),
      ready,
      signIn,
      signOut,
      adopt,
      error,
    }),
    [token, state, ready, signIn, signOut, adopt, error]
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
  const deployment = useQuery(api.authState, {});
  if (!ready) return null;
  if (!signedIn) {
    if (deployment === undefined) return null;
    // No operator yet: the first visitor sets the passphrase, from the browser.
    return deployment.claimable ? <ClaimForm /> : <SignIn />;
  }
  return <>{children}</>;
}

/**
 * The way in, wearing the landing page's own material.
 *
 * Both screens that ask for a passphrase sit outside the board's shell, so without this
 * they would inherit the pale marketing surface and read as a different product - a white
 * page bolted onto a dark app. The plate is the artwork the landing opens with, blurred
 * behind its own deep-sea gradient so the screen still looks right before the image
 * arrives, and a scrim keeps the panel legible.
 */
function AuthScreen({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "linear-gradient(180deg, #17333e 0%, #0f4a52 58%, #0b2129 100%)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decoration behind a
          form; it must not be deferred, resized or swapped by the image pipeline. */}
      <img
        src="/fold-mosaic.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-75 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          // Light enough that the plate's own colours survive, dark enough that the
          // panel and its small type stay legible on top of them.
          background:
            "radial-gradient(115% 85% at 50% 12%, rgba(8,9,11,0.10) 0%, rgba(8,9,11,0.55) 58%, rgba(8,9,11,0.92) 100%)",
        }}
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}

/**
 * The first thing a new deployment shows.
 *
 * A self-hosted board should not need a terminal to become usable, so a deployment with
 * no passphrase at all lets the first person to open it set one. That is the only moment
 * the board is open, and it closes for good the moment this succeeds.
 */
export function ClaimForm(): ReactNode {
  const { adopt } = useSession();
  const claim = useMutation(api.claim);
  const [passphrase, setPassphrase] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    setProblem(null);
    if (passphrase.trim().length < 8) {
      setProblem("At least eight characters.");
      return;
    }
    if (passphrase !== again) {
      setProblem("Those do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await claim({ passphrase, label: "claimed from the board" });
      adopt(result.token);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "that did not work");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <Panel className="p-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">bailiff</p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-white">
          This deployment has no operator yet.
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-neutral-400">
          The reads are already public: <span className="data">/health</span>,{" "}
          <span className="data">/selftest</span>, <span className="data">/cases</span> and any case
          as JSON. Everything that changes a case — closing it, releasing a charge, spending a call,
          taking a file — waits behind one passphrase. Set it here and this board is yours; only the
          hash is stored, and once it exists this form cannot be used again.
        </p>
        <div className="mt-6 space-y-3">
          <Input
            type="password"
            autoFocus
            value={passphrase}
            placeholder="choose a passphrase"
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <Input
            type="password"
            value={again}
            placeholder="same again"
            onChange={(e) => setAgain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          <Button
            disabled={busy || !passphrase.trim() || !again.trim()}
            onClick={() => void submit()}
          >
            {busy ? "Setting…" : "Set the passphrase and sign in"}
          </Button>
          {problem && <p className="text-[12px] leading-relaxed text-[#f0a8a8]">{problem}</p>}
        </div>
      </Panel>
    </AuthScreen>
  );
}

/**
 * Where the passphrase is changed, for as long as the operator is signed in. A new one
 * ends every other session, because changing a passphrase is also a revocation.
 */
export function ChangePassphrase(): ReactNode {
  const { token } = useSession();
  const change = useMutation(api.changePassphrase);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <div className="mt-6 border-t border-white/[0.06] pt-5">
      <p className="text-[13px] font-medium text-neutral-200">The operator&rsquo;s passphrase</p>
      <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
        Only its hash is stored. Changing it ends every other signed-in session, which is what makes
        it a revocation as well as a change.
      </p>
      <div className="mt-3 grid gap-2.5">
        <Input
          type="password"
          value={current}
          placeholder="current passphrase"
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          type="password"
          value={next}
          placeholder="new passphrase"
          onChange={(e) => setNext(e.target.value)}
        />
        <Button
          disabled={busy || !current.trim() || !next.trim()}
          onClick={() => {
            setBusy(true);
            setNote(null);
            setProblem(null);
            void change({ token: token ?? undefined, current, next })
              .then((result) => {
                setNote(
                  result.otherSessionsEnded > 0
                    ? `Changed. ${result.otherSessionsEnded} other session(s) ended.`
                    : "Changed."
                );
                setCurrent("");
                setNext("");
              })
              .catch((err) =>
                setProblem(err instanceof Error ? err.message : "that did not work")
              )
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Changing…" : "Change it"}
        </Button>
        {note && <p className="text-[12px] text-neutral-400">{note}</p>}
        {problem && <p className="text-[12px] leading-relaxed text-[#f0a8a8]">{problem}</p>}
      </div>
    </div>
  );
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
    <AuthScreen>
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
    </AuthScreen>
  );
}
