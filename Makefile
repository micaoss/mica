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
#
# START A NEW CHECKER FROM tools/docs/verify-board.sh AND ITS TEST, and take
# the four properties with it rather than only the shape: assert nothing until
# the set being checked is non-empty (a check over an empty set reports green
# without having checked anything); keep a positive control so a red case is
# known to be the mutation and not the fixture; drive one refusal per
# enforcement clause, each failing with its own message; and refuse -- never
# pass -- when the checker cannot reach what it checks.
#
# The naming is deliberate. Every checker here after the first got its
# empty-set refusal by IMITATION, not by anyone reading a rule, which is how
# this workspace's standards actually travel -- and imitation has no quality
# filter: a sloppy first file would have propagated just as fast and just as
# invisibly, and nobody could have pointed at the decision that caused it. So
# the file to copy is named instead of left to whichever one is open.
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
