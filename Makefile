.PHONY: install test typecheck web-install web-dev web-build evidence doctor demo-cards demo-build clean
SHELL := /bin/bash
CASE ?= case-demo-01

install:
	npm install
	cd web && npm install

test:
	npm test

typecheck:
	npm run typecheck

web-install:
	cd web && npm install

web-dev:
	cd web && npm run dev

web-build:
	cd web && npm run build

# Real command output, committed as evidence. Never hand-edited.
evidence:
	mkdir -p docs/evidence
	npm test 2>&1 | tee docs/evidence/tests.txt
	npm run typecheck 2>&1 | tee docs/evidence/typecheck.txt
	cd web && npm run build 2>&1 | tee ../docs/evidence/web-build.txt

# What is actually switched on in this environment.
doctor:
	@echo "integrations:"
	@npx convex run ops:integrationHealth 2>/dev/null || echo "  (backend not running)"
	@echo "keys present:"
	@for k in OPENAI_API_KEY FIRECRAWL_API_KEY SCORECARD_API_KEY AUTUMN_SECRET_KEY RESEND_API_KEY INKEEP_API_KEY VAPI_API_KEY VAPI_WEBHOOK_SECRET; do \
		if [ -n "$${!k}" ]; then echo "  $$k set"; else echo "  $$k missing"; fi; \
	done

# Cards rendered from the live case, for the demo video.
demo-cards:
	@npx convex run ops:caseExport "{\"caseRef\":\"$(CASE)\"}" > demo/export.json
	python3 scripts/demo_cards.py --export demo/export.json --out demo/build/cards

# Assemble the recorded cards and narration into the video.
demo-build:
	./scripts/demo_build.sh

clean:
	rm -rf demo/build demo/export.json web/.next
