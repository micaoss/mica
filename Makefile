# Mica OS project management and documentation: the records under docs/ and
# the gates that keep them honest. `make docs-verify` is the one gate; the
# code lives in micaoss/mica-build and the package repositories.
.PHONY: help docs-verify docs-verify-test website website-deploy
help:
	@echo "  docs-verify         assert the docs catalog, links, truth-status lines, board dossiers, tracking records, stale terms and the release-lock vectors"
	@echo "  docs-verify-test    prove those assertions actually fail on fixtures where their facts are false"
	@echo "  website             build the site into website/dist, publishing the documents website/ allowlists"
	@echo "  website-deploy      build, then upload website/dist to Cloudflare Workers"

docs-verify:
	bash tools/docs/verify-index.sh
	bash tools/docs/verify-links.sh
	bash tools/docs/verify-status.sh
	bash tools/docs/verify-coverage.sh
	bash tools/docs/verify-board.sh
	bash tools/docs/verify-tracking.sh
	bash tools/docs/verify-terms.sh
	bash tools/docs/verify-release-lock.sh

docs-verify-test:
	bash tools/docs/verify-index-test.sh
	bash tools/docs/verify-links-test.sh
	bash tools/docs/verify-status-test.sh
	bash tools/docs/verify-coverage-test.sh
	bash tools/docs/verify-board-test.sh
	bash tools/docs/verify-tracking-test.sh

# The site is built from docs/, but only the documents allowlisted in
# website/src/shared/docs/published.ts are published.
website:
	cd website && bun install --frozen-lockfile && bun run build

# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or a wrangler login.
website-deploy: website
	cd website && bunx wrangler@latest deploy
