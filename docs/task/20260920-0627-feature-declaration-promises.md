# 20260920-0627-feature-declaration-promises What a feature declaration promises, and the symbols that would keep it

- **status**: waiting — the three-repository mapping is authorised elsewhere and
  has not landed; this record exists so its home is not held in one head
- **priority**: P2
- **owner**: `mica` (the record); the mapping is `mica-podman`, `mica-build`
  and `mica-boards`
- **createdAt**: 2026-09-20 06:27

## Description

`mica-boards` measured what a kernel floor serving the declared features would
cost, with a **control build that reproduces the published `bzImage` byte for
byte**, and found a gap nobody had asked about: `CONFIG_CFS_BANDWIDTH` is
missing on both UEFI boards, so **a CPU quota cannot be enforced there**.

A mapping from *feature* to *symbols* is authorised as a proposal across three
repositories: `mica-podman` states what the engine calls, `mica-build` states
what a feature declaration promises, and `mica-boards` turns requirements into
symbols. Its home when it lands is here.

## What this record is for

The mapping is the deliverable; **the sentence worth writing down is the one
underneath it: a feature declaration had never been defined as promising
anything, which is why nothing could check it.** A declaration that promises
nothing cannot be violated, so no gate can exist for it, and the gap is found
only when someone measures a kernel — which is how `CONFIG_CFS_BANDWIDTH`
survived. That is a property of the definition, not of the boards.

Whether it belongs in `docs/design/` beside the build contract or in a
decision with the mapping's own shape is decided when the proposal exists.
Nothing is pre-empted here, and no mapping is written in this repository.

## The limit the mechanism states about itself

`mica-boards` wrote the limit of its own capability mechanism into the
proposal before anyone could hit it: **a capability row is a necessary
condition, not a proof of function.** `uefi-x64` is the worked example — the
symbols for a framebuffer console are set and it still may not render on real
hardware, because `DRM_FBDEV_EMULATION` is absent while `i915` is built in.
Its reason is the general one and is about checks rather than about kernels:
*if that sentence is not in the mechanism from the start, the first surprise
will be read as the check lying.*

One instance so far, so it lives here at its point of use rather than as a
rule of its own. If a second arrives, that is when to look for the third.

**Considered and not counted**: `mica-build`'s drops gate reports 703 paths
and refuses none, so it too is a necessary condition rather than a proof. It
belongs to the *gate reports before it refuses* rule
([harness](../design/build-harness.md) section 4), where that sentence now
sits, rather than being a second instance of this one. Counting it here would
be the failure mode already recorded next door: an instance spent twice
inflates both.

## Dependencies

- **blocked by**: the three-repository proposal
- **blocks**: nothing
