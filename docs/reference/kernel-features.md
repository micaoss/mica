# Kernel features

Every board's kernel is built from a floor shared by all boards plus the
kernel features its `board.env` names in `KERNEL_FEATURES`. Each feature is a
fragment in `mica-build:common/kernel/fragments/`, merged before `olddefconfig`
resolves the configuration. This page says what each feature turns on and
which board has it, from `mica-build` `main`.

## What each feature is

| Feature | What it enables |
|---|---|
| `core` (every board) | the verified root and the overlays composed over it; built in, since a dm-verity boot without an initramfs cannot load modules |
| `storage-gpt` | the GPT storage model: SYSTEM and DATA as ext4 partitions of one disk, the root mapped from a file on SYSTEM through a loop device under dm-verity |
| `storage-ubi` | the UBI storage model: SYSTEM and DATA as UBIFS volumes, every large object a static UBI volume opened through ubiblock under dm-verity, MTD partitions from the command line |
| `init-systemd` | what systemd as PID 1 mounts and what its unit keys reach (hugetlbfs, tracefs, …); an OpenRC product needs none of it |
| `netdev` | the virtual network devices networkd configures (VLANs, bridges, VRFs) and the bridge containers use |
| `firewall` | the kernel side of nftables, with `iptables-nft` as the reference |
| `containers` | what the container engine programs on the kernel, on top of the firewall and bridge; also puts BPF in the LSM list |
| `wireguard` | the WireGuard netdev for the remote-management tunnel |
| `selinux` | SELinux and audit; permissive (`SECURITY_SELINUX_DEVELOP=y`) |
| `dm-crypt` | the crypt target and the cipher LUKS2 asks for (DATA encryption) |
| `tpm2` | a built-in TPM 2.0 driver, for the sealed DATA key and the measured boot a Shielded VM's vTPM reports |
| `module-signing` | every module signed; a prod image loads only modules signed by a key in the builtin keyring and runs locked down in integrity mode |
| `owner-keyring` | owner enrolment: a root hash signed by an enrolled owner CA opens; the runkit seals the keyring before it maps a driver extension ([boot](boot.md)) |
| `drivers-amd64`, `drivers-arm64` | common driver classes of the generic kernels as modules in `support.img`: USB serial (NMEA 0183, GNSS, consoles), CAN (NMEA 2000, J1939), USB and cellular network adapters, PCIe Ethernet, Wi-Fi, USB storage; values follow Debian's 6.12 kernel |

## Which board has which

| Feature | uefi-x64 | uefi-arm64 | mini-x64 | cx3576 | s905x5m | qemu-armhf |
|---|---|---|---|---|---|---|
| `storage-gpt` | yes | yes | yes | yes | yes | — |
| `storage-ubi` | — | — | — | — | — | yes |
| `init-systemd` | yes | yes | yes | yes | yes | — |
| `netdev` | yes | yes | yes | yes | yes | yes |
| `firewall` | yes | yes | yes | yes | yes | yes |
| `containers` | yes | yes | yes | yes | yes | — |
| `wireguard` | yes | yes | yes | yes | yes | yes |
| `selinux` | yes | yes | yes | yes | yes | — |
| `dm-crypt` | yes | yes | yes | yes | yes | — |
| `tpm2` | yes | yes | yes | — | — | — |
| `module-signing` | yes | yes | yes | — | — | — |
| `owner-keyring` | yes | yes | yes | — | — | yes |
| `drivers-amd64` / `drivers-arm64` | amd64 | arm64 | — | — | — | — |

So:

- **Driver extensions and owner certificates** work only where the kernel has
  `owner-keyring`: uefi-x64, uefi-arm64, mini-x64 and qemu-armhf. On cx3576
  and s905x5m every driver is built into the board kernel.
- **Plug-in USB and PCIe hardware** (serial adapters, CAN adapters, cellular
  modems, extra NICs, USB storage) is covered by the generic kernels'
  `drivers-*` modules on uefi-x64 and uefi-arm64; mini-x64 and the board
  kernels carry what their hardware has.
- **DATA encryption with a TPM** is possible where `tpm2` and `dm-crypt` are
  both present; no released product turns it on.
- **Containers** need `containers`, `netdev` and `firewall`; qemu-armhf has no
  container support.

## Reading a kernel's real configuration

On the UEFI boards the committed `kernel/config/<board>.config` in
`mica-build` is the resolved configuration, checked at build. On the FIT boards
(cx3576, s905x5m) the committed file is the vendor's input, and the resolved
answer is in the published kernel component: `kernel/dev/config` and
`kernel/prod/config` of `kernel.<board>.<release>`, at the digest the board's
release lock names (`mica-build:boards/README.md`). On a running device:

| Check | Expect |
|---|---|
| `uname -r` | the kernel release of the running deployment |
| `cat /run/mica/boot.json` | the running `kernelId` |
