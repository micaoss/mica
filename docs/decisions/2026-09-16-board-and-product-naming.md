# Naming: what is a board, what is a product, what is an image kind

- **date**: 2026-09-16
- **kind**: engineering decision
- **owner**: `mica-boards` (board names and their directories) and `mica-build` (product names and image kinds); the contract text is `docs/boards/contract.md` section 1.1
- **review sunset**: 2027-03-16
- **status**: accepted (user, 2026-09-16); written so a new variant does not need a fresh discussion; the two renames it builds on are `docs/decisions/2026-09-16-generic-systems-named-by-firmware.md` and `docs/decisions/2026-09-16-minimal-products-removed.md`

## Decision

### 1. Two classes of board

- **Generic systems** are named by firmware class and architecture:
  `uefi-x64`, `uefi-arm64`. One image serves every machine of that class, and
  QEMU is one such machine rather than the thing the board is named after.
- **Hardware-specific boards** are named by their hardware: `cx3576`,
  `s905x5m`.

### 2. When a variant is a board, and when it is not

The kernel, the loader and the partition layout belong to a **board**; the
root composition belongs to a **product**; the file the user downloads belongs
to `images.tsv`. So:

| The variant changes | It is | Example |
|---|---|---|
| the kernel, the loader or the disk layout | a new **board** | a slim virtio-only guest kernel: `qemu-x64`, `qemu-arm64` — not a product |
| only what is installed in the root | a **product** on an existing board | a cloud image with its guest agents |
| only the file format that is downloaded | an **image kind** in `images.tsv`, selected per product | `qcow2` or `vmdk` beside `disk` |

### 3. Name forms

- A board is `[a-z0-9][a-z0-9-]*` and **never contains a dot**. Both
  repositories enforce it, and the dot tag form depends on it
  (`docs/decisions/2026-09-16-scoped-tags-use-a-dot.md`).
- A product is `<board>-<variant>`, where the variant says what the image is
  for: `dev`, `prod`, and later for example `cloud`.
- A board package is `mica-board-<board>`.
- A platform-specific guest board is `<platform>-<arch>`.

### 4. Tags and artefacts follow the names

| Kind | Form |
|---|---|
| board release | `<board>.<YYYYMMDD-HHMM>` |
| `mica-build` scoped release | `<scope>.<YYYYMMDD-HHMM>` (a board or a product) |
| version index | `mica.<YYYYMMDD-HHMM>` |
| OCI pool | `pool.<board>.<arch>.<release>` |
| OCI board component | `<component>.<board>.<release>` |
| OCI product bundles | `image.<product>.<release>`, `update.<product>.<release>` |
| release assets | `mica-<product>-<release>.<suffix>` |

### 5. The product set after today

`uefi-x64-dev`, `uefi-x64-prod`, `uefi-arm64-dev`, `uefi-arm64-prod`,
`cx3576-dev`, `cx3576-prod`, `s905x5m-dev`. There are no minimal products
(`docs/decisions/2026-09-16-minimal-products-removed.md`).

## History

Names published before 2026-09-16 — the boards `x64` and `virt-arm64`, their
products, the minimal products and the slash tag form — are history. They stay
as they were published and are not rewritten.

## Rationale

Every variant that appeared so far raised the same three questions: is this a
board, a product or a file format, and what is it called. The answer follows
from what the variant changes, because that is what decides which build stage
owns it: a different kernel or layout cannot be a root composition, and a
different root cannot be a kernel. Writing the rule down makes the next
variant a lookup instead of a discussion.

## Removal condition

Revisited if a variant appears that changes none of the three (kernel/loader/
layout, root composition, output format) and still needs its own name.
