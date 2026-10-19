# Mica OS product documentation: the documents under docs/, the checks that
# hold them to the tree and to the other repositories, and the website.
#
# There are two gates and the split is deliberate:
#
#   make docs-verify        offline and hermetic. tools/docs/record.sh runs it
#                           before every commit, so it never depends on the
#                           network.
#   make docs-verify-world  the one that reaches other repositories. It holds
#                           standing claims only (docs/world-claims.tsv) and
#                           runs as its own CI job, red when a claim drifts.
#
# `make docs-verify-test` is offline as well, verify-world-test.sh included:
# that test drives the checker through an injectable reader and touches no
# network.
#
# Start a new checker from tools/docs/verify-board.sh and its test, and keep
# these properties:
#
#   - assert nothing until the set being checked is non-empty: a check over
#     an empty set reports green without having checked anything;
#   - keep a positive control, so a red case is known to be the mutation and
#     not the fixture;
#   - drive one refusal per enforcement clause, each failing with its own
#     message;
#   - refuse, never pass, when the checker cannot reach what it checks;
#   - the checker's own parsing must not be able to read a pass as a fail;
#   - a refused fixture breaks exactly the rule it names: one that two rules
#     could refuse tests neither.
.PHONY: help docs-verify docs-verify-test docs-verify-world website website-deploy
help:
	@echo "  docs-verify         assert the docs catalog, links, truth-status lines and board dossiers"
	@echo "  docs-verify-test    prove those assertions actually fail on fixtures where their facts are false, and lint the scripts"
	@echo "  docs-verify-world   check the claims and the <repository>:<path> citations these documents make about other repositories (needs the network)"
	@echo "  (a records change)  bash tools/docs/record.sh --edit <script> --message <file> -- <path>..."
	@echo "  website             build the site into website/dist, publishing the documents website/ allowlists"
	@echo "  website-deploy      build, then upload website/dist to Cloudflare Workers"

docs-verify:
	bash tools/docs/verify-index.sh
	bash tools/docs/verify-links.sh
	bash tools/docs/verify-status.sh
	bash tools/docs/verify-coverage.sh
	bash tools/docs/verify-board.sh

docs-verify-world:
	bash tools/docs/verify-world.sh
	bash tools/docs/verify-citations.sh

docs-verify-test:
	bash tools/docs/verify-index-test.sh
	bash tools/docs/verify-links-test.sh
	bash tools/docs/verify-status-test.sh
	bash tools/docs/verify-coverage-test.sh
	bash tools/docs/verify-board-test.sh
	bash tools/docs/verify-world-test.sh
	bash tools/docs/verify-citations-test.sh
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
