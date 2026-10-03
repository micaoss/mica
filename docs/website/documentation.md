# Page brief: Documentation

- **Purpose**: be the portal from the website into the user documentation set.
  This page mirrors the navigation of the guides; it adds no content of its
  own, so it can never contradict what it links to.
- **Audience**: everyone who arrives with a task — install, configure,
  update, recover, troubleshoot — rather than an evaluation question.
- **Navigation position**: page 5. Every other site page deep-links into the
  sections below; this page is the complete map.

## Content outline

1. One paragraph on how the documentation is organised and versioned.
2. The navigation groups, mirroring `docs/README.md` exactly.
3. Pointer to the engineering design record for rationale.

## Draft copy

### How the documentation is organised

The user documentation is the versioned, customer-facing contract for
operating a Mica OS device: it describes current supported behaviour, labels
anything not yet shipped, and links back to the engineering design record for
rationale. Its own rules — versioning, truth labels, English/Chinese coverage
— are stated in the documentation contract, which governs this portal too.

The portal navigation mirrors the guides one-to-one; a group below exists
because the corresponding user page exists.

### Getting started

- [Quickstart](../start/quickstart.md) — the shortest path to a running device.
- [Download](../start/download.md) — selecting a release, board and profile.
- [Install](../start/install.md) — flashing media and installing on hardware.
- [First run](../start/first-run.md) — first boot, claiming the device,
  initial credentials.

### Operating

- [Configuration](../operate/configuration.md) — the settings tree: network,
  Wi-Fi, SSH, time, and how settings persist.
- [Applications](../integrate/applications.md) — native packages and containers:
  the two supported delivery paths.
- [Update and rollback](../operate/updates.md) — A/B updates, health
  gates, and going back.
- [Storage](../operate/storage.md) — the storage tiers and what happens if each
  is lost.

### When something goes wrong

- [Troubleshooting](../operate/troubleshooting.md) — symptoms to causes,
  decision-tree first.
- [Recovery](../operate/recovery.md) — deployment fallback, reflash, and the recovery
  ladder per board.

### Reference

- [Documentation contract](../contributing.md) — the rules this set is
  written and versioned under.
- [Security](../security/overview.md) — the operator-facing security model.
- [API](../operate/api.md) — the HTTPS management API reference.
- [Release notes](../releases/release-notes.md) — what changed per release.
- [Support](../releases/support.md) — lifecycle, tiers, how to file a case.

### For engineers

The design record under [../README.md](../README.md) is the authoritative
engineering source the user documentation is derived from; start at the
[architecture map](../architecture.md). Integrators porting a new board start
at [`mica-build:boards/README.md`](https://github.com/micaoss/mica-build/blob/main/boards/README.md) instead.

> status: shipped — evidence: `docs/architecture.md`, `docs/README.md`
