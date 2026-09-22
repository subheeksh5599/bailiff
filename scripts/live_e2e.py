#!/usr/bin/env python3
"""
One whole run of the product against the deployed backend.

Two calls, chosen to put the two rules that matter on either side of the line:

  pass    a call whose only claim is a promise. A promise is checked against our own
          recording of the call, so it can pass - and a passing grade is the only thing
          that releases the charge.

  refuse  a call that asserts something about the counterparty's own behaviour. That
          cannot be confirmed from a recording of us talking, so it must stay unverified
          no matter how confidently it was said - and the charge must not move.

Nothing here is simulated: the case is opened through the app's own mutation, the call
arrives through the real webhook with the real shared secret, and the pipeline runs on
the deployment. The output is what the deployment returned.
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent


def read_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for name in (".env.local", ".env.deployment"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values.setdefault(key.strip(), value.strip())
    return values


ENV = read_env()
SITE = ENV.get("CONVEX_SITE_URL", "https://aware-jellyfish-285.convex.site")
SECRET = ENV.get("VAPI_WEBHOOK_SECRET", "")
NOISE = ("npm notice", "localStorage", "trace-warnings", "npm warn")


def run(function: str, args: dict) -> str:
    """Run an internal function on the deployment and return what it returned."""
    proc = subprocess.run(
        ["npx", "convex", "run", function, json.dumps(args)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        env={**os.environ, "CONVEX_DEPLOY_KEY": ENV.get("CONVEX_DEPLOY_KEY", "")},
    )
    lines = [
        line
        for line in (proc.stdout + proc.stderr).splitlines()
        if line.strip() and not any(noise in line for noise in NOISE)
    ]
    return "\n".join(lines).strip()


def post(path: str, payload: dict) -> tuple[int, str]:
    request = urllib.request.Request(
        f"{SITE}{path}",
        data=json.dumps(payload).encode(),
        headers={
            "content-type": "application/json",
            # each hook checks its own shared secret, and both are fail-closed
            "x-vapi-secret": SECRET,
            "x-webhook-secret": ENV.get("RESEND_WEBHOOK_SECRET", ""),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, response.read().decode()[:400]
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()[:400]


def call_ended(call_ref: str, case_ref: str, transcript: str, analysis: dict) -> tuple[int, str]:
    return post(
        "/hooks/call-ended",
        {
            "message": {
                "type": "end-of-call-report",
                "call": {
                    "id": call_ref,
                    "startedAt": "2026-09-22T09:00:00.000Z",
                    "endedAt": "2026-09-22T09:04:00.000Z",
                    "metadata": {"caseRef": case_ref},
                },
                "artifact": {"transcript": transcript},
                "analysis": {"structuredData": analysis},
                "endedReason": "assistant-ended-call",
            }
        },
    )


def post_email(case_ref: str, body: str) -> tuple[int, str]:
    """A reply from the counterparty, forwarded by the mail provider."""
    return post(
        "/hooks/inbound-email",
        {
            "caseRef": case_ref,
            "from": "billing@northwind.example",
            "subject": f"Re: your refund enquiry [{case_ref}]",
            "text": body,
        },
    )


def scenario_close(case_ref: str) -> None:
    """A case that closes, because what the requirement asked for was read back."""
    print(f"\n{'=' * 78}\nCLOSE: a reply from the counterparty, read back after the case opened\n{'=' * 78}")

    print("\n-- open the case")
    opened = run("cases:openCase", {
        "ref": case_ref,
        "customerRef": "owner",
        "counterpartyName": "Northwind Utilities",
        "counterpartyDomain": "example.com",
        "channel": "phone",
        "currency": "GBP",
        "amountClaimedUnits": 4120,
    })
    print(opened)
    try:
        case_id_value = json.loads(opened)["caseId"]
    except Exception:
        print("could not read the case id back; stopping this scenario")
        return

    print("\n-- freeze what has to be true for this case to close")
    print(run("cases:freezeRequirements", {
        "caseId": case_id_value,
        "requirements": [{
            "key": "their_reply",
            "label": "their own reply says the refund moved",
            "kind": "email_reply",
        }],
        "actor": "live test",
    }))

    print("\n-- try to close it before anything has been read back")
    print(run("cases:attemptClose", {"caseId": case_id_value, "actor": "live test"}))

    print("\n-- their reply arrives on the mail webhook")
    status, body = post_email(case_ref, "Confirmed: the refund of GBP 41.20 was issued today, ref NW-88213.")
    print(f"HTTP {status} {body}")

    print("\n-- try again")
    print(run("cases:attemptClose", {"caseId": case_id_value, "actor": "live test"}))

    print("\n-- what the case says now")
    final = run("cases:get", {"ref": case_ref})
    try:
        snapshot = json.loads(final)
        print("state:", snapshot["case"]["state"])
        print("requirements:", json.dumps(
            [{k: r.get(k) for k in ("key", "satisfied", "satisfiedByEvidenceId")} for r in snapshot.get("requirements", [])]))
        print("audit:", json.dumps([a.get("action") for a in snapshot.get("audit", [])]))
    except Exception:
        print(final[:1200])


def scenario(name: str, case_ref: str, call_ref: str, transcript: str, analysis: dict,
             requirements: list[dict]) -> None:
    print(f"\n{'=' * 78}\n{name}\n{'=' * 78}")

    print("\n-- open the case")
    opened = run("cases:openCase", {
        "ref": case_ref,
        "customerRef": "owner",
        "counterpartyName": "Northwind Utilities",
        "counterpartyDomain": "example.com",
        "channel": "phone",
        "currency": "GBP",
        "amountClaimedUnits": 4120,
    })
    print(opened)

    try:
        case_id_value = json.loads(opened)["caseId"]
    except Exception:
        print("could not read the case id back; stopping this scenario")
        return

    print("\n-- freeze what has to be true for this case to close")
    print(run("cases:freezeRequirements", {
        "caseId": case_id_value,
        "requirements": requirements,
        "actor": "live test",
    }))

    print("\n-- the call arrives on the real webhook")
    status, body = call_ended(call_ref, case_ref, transcript, analysis)
    print(f"HTTP {status} {body}")

    print("\n-- run the pipeline")
    print(run("orchestrator:resolveCall", {"caseRef": case_ref, "callRef": call_ref}))

    print("\n-- try to close it")
    print(run("cases:attemptClose", {"caseId": case_id_value, "actor": "live test"}))

    print("\n-- what the case says now")
    final = run("cases:get", {"ref": case_ref})
    try:
        snapshot = json.loads(final)
        print("state:", snapshot["case"]["state"])
        print("requirements:", json.dumps(snapshot.get("requirements", []), indent=2)[:500])
        print("billing rows:", json.dumps(snapshot.get("billing", []), indent=2)[:400])
        print("audit:", json.dumps([a.get("action") for a in snapshot.get("audit", [])], indent=0)[:400])
    except Exception:
        print(final[:1200])


def main() -> int:
    import datetime

    run_id = datetime.datetime.now().strftime("%H%M%S")
    if not SECRET:
        print("no webhook secret in .env.local; the hook would refuse")
        return 1
    print(f"target: {SITE}")

    scenario(
        "PASS: a call that promised something, and nothing else",
        f"live-pass-{run_id}",
        f"call-pass-{run_id}",
        "agent: I have raised the refund for 41.20 and it will be with you by Friday.\n"
        "caller: thank you, that is all I needed.",
        {
            "caller_wanted": "the refund to move",
            "resolved": True,
            "promises": [{"text": "the refund of 41.20 will arrive by Friday", "promised_when": "Friday"}],
            "facts": [],
        },
        [{"key": "refund_promised", "label": "a commitment was made about the refund", "kind": "promise"}],
    )

    scenario(
        "REFUSE: a call that asserted what the counterparty had already done",
        f"live-refuse-{run_id}",
        f"call-refuse-{run_id}",
        "agent: that refund was issued on the 20th, so it is already on its way.\n"
        "caller: I have not seen it.",
        {
            "caller_wanted": "the refund to move",
            "resolved": False,
            "promises": [],
            "facts": [{"text": "the refund was issued on the 20th", "subject": "refund"}],
        },
        [{"key": "refund_moved", "label": "their record shows the refund moved", "kind": "counterparty_record"}],
    )

    scenario_close(f"live-close-{run_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
