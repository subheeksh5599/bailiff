#!/usr/bin/env python3
"""Rewrite product copy in the imported design: health/clinical wording -> our domain.

Run from the repo root. Idempotent: re-running changes nothing after the first pass.
The map is explicit and ordered (longest / most specific first) so the diff stays reviewable.
No markup structure, class layout, spacing or SVG geometry is touched — only strings.
"""
import re
import sys
from pathlib import Path

# --- ordered replacements: (pattern, replacement) -------------------------------------------
RULES = [
    # whole elements / long phrases first
    (r'<a href="mailto:hello@sentry\.care">hello@sentry\.care</a>', '<a href="#demo">Watch the demo</a>'),
    (r'SEAL OF COMPLIANCE', 'EVIDENCE SEAL'),
    (r'HIPAA Compliant', 'Signed receipts'),
    (r'Healthcare operations', 'Every claim sourced'),
    (r'Sentry is built to handle protected health information under a HIPAA-aligned data model\. '
     r'Compliance certifications shown here are targets for the production service, not audited claims\.',
     'Bailiff records where every claim on a case came from, and signs the run that closed it. '
     'The seal shown is our own receipt for a case, not an audit certification.'),
    (r'receiving clinic confirmation', "other side's own record"),
    (r'receiving clinic', 'other side'),
    (r'Care navigation', 'Support desks'),
    (r'care navigation', 'support desk'),
    (r'care navigator', 'ops lead'),
    (r'Referring clinics', 'Customers owed'),
    (r'Referring', 'Opened by'),
    (r'Regional Health Plan', 'Example Corp'),
    (r'Mesa Vista Family Care', 'Example Org'),
    (r'Prior auth</span><span>Clinical notes</span><span>Imaging', 'Delivery proof</span><span>Order reference</span><span>Refund receipt'),
    (r'PATIENT', 'CUSTOMER'),
    (r'HANDOFF STATUS', 'CASE STATUS'),
    (r'the referral gap', 'the chase'),
    (r'referral gap', 'the chase'),
    (r'Referral verification for clinics, payers and specialist intake teams\.', 'Verified resolution for anyone owed something.'),
    (r'referral verification', 'outcome verification'),
    (r'Referral intake, any format', 'Case intake, any format'),
    (r'Referral intake', 'Case intake'),
    # data keys / identifiers
    (r'patientDisplayName', 'counterpartyDisplayName'),
    (r'patient_name', 'customer_name'),
    (r'referring_clinic', 'case_sender'),
    (r'requested_specialty', 'requested_outcome'),
    (r'insurance_provider', 'counterparty'),
    (r'integrationHealth', 'integrationStatus'),
    (r'sentry\.convexUrl', 'bailiff.convexUrl'),
    (r'sentry\.session', 'bailiff.session'),
    (r'class="health"', 'class="status"'),
    (r'class="health ', 'class="status '),
    (r'\.health\{', '.status{'),
    (r'id="health"', 'id="status"'),
    (r'\$\("health"\)', '$("status")'),
    (r'"health"', '"status"'),
    # brand
    (r'Sentry', 'Bailiff'),
    (r'\bsentry\b', 'bailiff'),
    # clinical nouns, generic last
    (r'Healthcare', 'Business'),
    (r'healthcare', 'business'),
    (r'clinical', 'evidentiary'),
    (r'Clinical', 'Evidentiary'),
    (r'clinics', 'companies'),
    (r'Clinics', 'Companies'),
    (r'clinic', 'company'),
    (r'Clinic', 'Company'),
    (r'patients', 'customers'),
    (r'Patients', 'Customers'),
    (r'patient', 'customer'),
    (r'Patient', 'Customer'),
    (r'referrals', 'cases'),
    (r'Referrals', 'Cases'),
    (r'referral', 'case'),
    (r'Referral', 'Case'),
    (r'doctors', 'reviewers'),
    (r'doctor', 'reviewer'),
    (r'medical', 'purchase'),
    (r'nurse', 'operator'),
]

FILES = ["site/index.html", "site/app.html"]
LEFTOVER = re.compile(r'impilo|doctor|patient|clinic|health|medical|nurse|clinical|\bcare\b|referral|hipaa|sentry', re.I)


def main() -> int:
    total = 0
    for name in FILES:
        p = Path(name)
        src = p.read_text(encoding="utf-8")
        out = src
        for pat, rep in RULES:
            out = re.sub(pat, rep, out)
        n = sum(1 for a, b in zip(src.splitlines(), out.splitlines()) if a != b)
        p.write_text(out, encoding="utf-8")
        total += n
        print(f"{name}: {n} lines rewritten, {len(out)} bytes")
    print(f"\nleftover health/brand strings: {len(LEFTOVER.findall(Path(FILES[0]).read_text() + Path(FILES[1]).read_text()))}")
    for name in FILES:
        for i, line in enumerate(Path(name).read_text(encoding="utf-8").splitlines(), 1):
            if LEFTOVER.search(line):
                print(f"  {name}:{i}: {line.strip()[:150]}")
    print(f"\ntotal lines rewritten: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
