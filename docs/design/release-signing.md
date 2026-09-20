# Signed component trust and rotation

The current contract authenticates three independent surfaces. An authenticated
bootloader accepts the UKI/FIT; that kernel carries content and metadata anchors;
`mica-init` authenticates deployment metadata and opens signed root/support
mappings. No earlier update format or mutable command-line trust input is read.

## Artifacts and signing owners

| Artifact | Signed binding | Consumer |
|---|---|---|
| UKI/FIT | Kernel, initramfs, fixed policy, and DTB where applicable | UEFI or the required-signature U-Boot control FDT |
| Root/support image | PKCS#7 signature over the root hash; signed metadata binds full geometry, hash, length and signature bytes | Kernel dm-verity and native metadata verifier |
| Deployment | `mica/deployment/v2` (replaces v1), product/board/arch/generation/version and complete kernel/root identities; the signed `product` field (such as `uefi-x64-dev`) is required, and a device of another product refuses it | Factory assembler, early init and installer |
| Catalog | `mica/catalog/v2` (replaces v1), revision, validity interval, deployment associations and channel heads `{board, product, channel, releaseId, generation}` keyed by board, product and channel | Acquisition client |
| Firmware | `mica/firmware/v1`, board/arch/generation/artifact and fixed write destination | Separate firmware publisher, offline maintainer and native readback |

The components themselves are `mica/kernel/v1` and `mica/rootfs/v2`, and a
published update travels in a `mica/update-envelope/v1` envelope.

**These payloads are addition-closed for readers already deployed, and the
ordering that follows is the opposite of the producer-first instinct**
*(measured in `mica-core`'s reader, 2026-09-20; read back here)*. **Every
deserialised struct** in `mica-core:crates/mica-deploy/src/components.rs`
carries `#[serde(deny_unknown_fields)]` — all nine that derive `Deserialize`,
`BootArtifact` being exactly `format` and `artifact` and `KernelComponent`
exactly its eight. The file's two other structs, `ContractError` and
`DeploymentPaths`, derive `Debug` alone and are never parsed from a payload,
so **the constraint has no exception and there is no permissive struct a field
could be added to**: adding one does not degrade gracefully, **a device
running today's `mica-deploy` refuses the whole record.** A new field therefore travels in this order, and only this one:

1. the reader changes in `mica-core` and accepts the field;
2. that lands in a `mica-core` release;
3. **the release reaches the devices**;
4. only then may `mica-build` emit the field.

**Anybody reasoning from *the producer owns the format* gets this backwards**,
and backwards means publishing a record deployed devices reject. *(The cost of
step 3 is a question about whether there is a fleet, which is open with the
user; this section states the ordering, which is correct either way — **it is
expensive the day there are devices**. If a fleet exists, that sentence is
already operational.)*
`mica/rootfs/v2` replaces v1 without its `version` field, so a release that
changes nothing in the root keeps its rootfs identity; the release identity
is only in the signed deployment's `version`, `generation` and `product`
(decided 2026-09-15, `docs/decisions/2026-09-15-stable-component-ids.md`;
implemented in `mica-core` since its release `20260915-1135`, which refuses v1
or a `version` field, and written by `mica-build` since `fe3ad07`). `mica/deployment/v2` and `mica/catalog/v2` were decided on
2026-09-15 (`docs/decisions/2026-09-15-update-packages.md`) and implemented
in `mica-core` since its release `20260915-0728` (`2a4c98d`,
`mica-core:docs/task/20260915-0657-update-packages.md`); `mica-build` writes
them since `0094a097` (not released yet).

The Ed25519 envelope format is shared by Rust and Bun: its keys are ordered
`schema`, `keyId`, `payload`, `signature`, and `keyId` is the hex SHA-256 of
the Ed25519 public key. Parsing rejects unknown fields, ambiguous/noncanonical
content, mismatched component IDs, unexpected paths and invalid bounds.
Offline archives (extension `.micaupd`) start with the eight-byte magic
`MICAUPD1`, then the descriptor length (u32, big-endian), the signed
descriptor, the object count, and for each object its digest, size and bytes;
they reuse the deployment signature and carry only bounded
digest/length-addressed objects. The layout is unchanged by the 2026-09-15
decision, but the object count may be anything from 0 to the descriptor's
object count: every object the archive omits must already be present in the
store, and an archive is no longer refused for an object count that differs
from the descriptor's. One signed deployment therefore ships as `full`,
`root` and `kernel` archives with the same descriptor.

Metadata trust resides in authenticated kernel policy. Public factory update
settings select a source/channel and policy; they cannot replace anchors.
Installed boot does not depend on downloading an unexpired catalog. Catalog
freshness and monotonic revision checks apply when acquiring a new release.

## Content verification

The kernel requires a signed root hash for both root and support mappings. The
support image owns modules for exactly its kernel release, firmware and the
wireless regulatory database where required. Root owns userspace and empty
support mountpoints. The early loader verifies selected descriptor associations
before binding support and starting systemd.

Signature verification authenticates the verity root, and subsequent reads are
verified per block. It does not pre-read every image block at boot. Installation
and offline verification additionally hash complete artifacts against signed
length/digest declarations. Latent corruption is detected when the affected
block is read; no claim is made that an unread block was checked during boot.

Measured kernel integration accepts the compiled content certificate outside
its X.509 validity window and refuses root's attempt to revoke the built-in
anchor. Time expiry and runtime revocation are therefore not withdrawal
procedures. Replace the accepting kernel to remove a content key.

## Rotation

1. Introduce boot/content/metadata overlap in the relevant accepting artifact.
2. Verify intended old and new signatures, including a retained bootable record.
3. Publish new components and observe boot and health confirmation.
4. Remove the old anchor in a subsequent accepting artifact and verify refusal
   of its signatures with a working fallback.

The update server authenticates its persisted catalog and published deployment
and firmware manifests at startup. It refuses metadata-key removal while
published artifacts still depend on that key. Withdrawal and a newly signed
catalog precede removal.

Firmware publication is separate from the normal OS catalog. Offline EFI
maintenance saves the authenticated previous loader outside the ESP, writes and
syncs the replacement and verifies readback. RockUSB maintenance saves and
compares the entire reserved partition, writes only the fixed loader range and
never resets the device. Neither OS root nor kernel installation writes loader
bytes or enrolls platform keys.

## Evidence limits

Actual QEMU Secure Boot proves UKI enforcement, EFI loader replacement,
restoration and key removal. Production U-Boot control FDT extraction and FIT
signature tests prove its configured signer policy. Native readback and IO
fault tests cover software transactions. Board dossiers record per-board results
([support tiers](../boards/support-tiers.md#current-boards)). Physical cx3576 ROM/SPL trust, watchdog
handoff, USB maintenance and storage power-cut durability remain separate bench
acceptance gates. Development keys are explicitly development grade.
