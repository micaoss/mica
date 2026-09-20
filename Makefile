# Mica OS project management and documentation: the records under docs/ and
# the gates that keep them honest. The code lives in micaoss/mica-build and the
# package repositories.
#
# THERE ARE TWO GATES AND THE SPLIT IS DELIBERATE, so that neither is removed
# as a duplicate of the other:
#
#   make docs-verify        offline and hermetic. tools/docs/record.sh runs it
#                           before every commit, so it must never depend on the
#                           network: a records change cannot be blocked by
#                           GitHub being slow or another repository being
#                           mid-edit.
#   make docs-verify-world  the one that reaches other repositories. It holds
#                           STANDING claims only (docs/world-claims.tsv) and
#                           runs as its own CI job, red when a claim drifts.
#
# `make docs-verify-test` is offline as well, verify-world-test.sh included:
# that test drives the checker through an injectable reader and touches no
# network. A "world" test inside the offline target looks like a violation of
# the rule above and is not one.
.PHONY: help docs-verify docs-verify-test docs-verify-world website website-deploy
help:
	@echo "  docs-verify         assert the docs catalog, links, truth-status lines, board dossiers and the release-lock vectors"
	@echo "  docs-verify-test    prove those assertions actually fail on fixtures where their facts are false, and lint the scripts"
	@echo "  docs-verify-world   check the claims these records make about other repositories against those repositories (needs the network)"
	@echo "  (a records change)  bash tools/docs/record.sh --edit <script> --message <file> -- <path>..."
	@echo "  website             build the site into website/dist, publishing the documents website/ allowlists"
	@echo "  website-deploy      build, then upload website/dist to Cloudflare Workers"

docs-verify:
	bash tools/docs/verify-index.sh
	bash tools/docs/verify-links.sh
	bash tools/docs/verify-status.sh
	bash tools/docs/verify-coverage.sh
	bash tools/docs/verify-board.sh
	bash tools/docs/verify-release-lock.sh

docs-verify-world:
	bash tools/docs/verify-world.sh

docs-verify-test:
	bash tools/docs/verify-index-test.sh
	bash tools/docs/verify-links-test.sh
	bash tools/docs/verify-status-test.sh
	bash tools/docs/verify-coverage-test.sh
	bash tools/docs/verify-board-test.sh
	bash tools/docs/verify-world-test.sh
	bash tools/docs/record-test.sh
	bash tools/docs/shell-lint.sh
	bash tools/docs/shell-lint-test.sh

# The site is built from docs/, but only the documents allowlisted in
# website/published-docs.json are published.
website:
	cd website && bun install --frozen-lockfile && bun run build

# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or a wrangler login.
website-deploy: website
	cd website && bunx wrangler@latest deploy
