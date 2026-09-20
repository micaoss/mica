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

## Dependencies

- **blocked by**: the three-repository proposal
- **blocks**: nothing
