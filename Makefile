.PHONY: db seed api web demo test record-agent

db:
	docker compose up -d --wait db

seed: db
	@echo "seed: not implemented yet (DEMO-03)"

api:
	cd backend && uv run uvicorn onethread.api:app --port 8000 --reload

web:
	cd frontend && npm run dev -- --port 5173 --strictPort

# One command: DB -> seed -> API + web (Ctrl-C stops both).
demo: seed
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) api & $(MAKE) web & wait

test:
	cd backend && uv run pytest
	cd frontend && npx vitest run

record-agent:
	cd backend && uv run python -m onethread.agent.replay record
