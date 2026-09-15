// Copy transcribed from the design handoff bundle — see zh.ts.

import type { zh } from './zh'

export const en: typeof zh = {
  label: 'English',
  meta: {
    htmlLang: 'en',
    title: 'Mica OS — Build the product, not the OS.',
  },
  nav: {
    download: 'Download',
    docs: 'Docs',
    themeLabel: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeAuto: 'Auto',
    menu: 'Menu',
    close: 'Close',
    langLabel: 'Language',
  },
  hero: {
    title: 'Build the product, not the OS.',
    sub: 'A minimal Linux for devices and fleets: the system updates as versioned releases; one API manages it locally or from the cloud — so the product ships sooner.',
    cta1: 'Quickstart',
    cta2: 'Get an image',
  },
  why: {
    heading: 'Five layers, clear boundaries',
  },
  arch: {
    layers: [
      {
        no: '05',
        name: 'One management plane owns the device',
        impl: 'micad + apid',
        points: [
          'API first: network, services, applications and configuration all go through one authenticated API — the web UI and the cloud console are both clients of it',
          'Cloud fleet management: configuration and signed deployments go out in bulk, with state and versions visible centrally — one device and a thousand are the same operation',
          'Offline-capable, cloud-optional: install offline, keep running disconnected, reconcile to the target version once connected',
        ],
      },
      {
        no: '04',
        name: 'Applications ride on top, not inside',
        impl: 'Self-contained packages · OCI containers',
        desc: 'Native applications update with the system; user applications ship as self-contained packages or OCI containers, update on their own cadence, and can be started or stopped at any time.',
      },
      {
        no: '03',
        name: 'A read-only, integrity-verified root',
        impl: 'squashfs + dm-verity',
        desc: 'Each system image is a squashfs sealed by a dm-verity hash tree; every block read at runtime is checked against a root hash fixed at build time.',
      },
      {
        no: '02',
        name: 'Authenticated deployments that fall back on failure',
        impl: 'A/B · health gate',
        desc: 'Components install independently; objects are verified before they land, the health gate confirms a successful boot, and a failed candidate gets three attempts before the retained deployment is selected.',
      },
      {
        no: '01',
        name: 'Hardware differences end at the board contract',
        impl: 'mica-boards + mica-build',
        desc: 'The contract fixes what the system needs from the hardware, and BSPs, kernels and board packages are filed per board; images are composed, signed and tested from pinned versions. Bringing up a new board is a porting job, not a second system.',
      },
    ],
  },
  boards: {
    heading: 'Supported boards',
    cols: { board: 'Board', hw: 'Hardware', status: 'Status' },
    rows: [
      { board: 'x64', hw: 'Generic x86_64, UEFI', status: 'Bring-up, validated in QEMU' },
      { board: 'virt-arm64', hw: 'QEMU ARM64, UEFI', status: 'Bring-up, QEMU reference' },
      { board: 'cx3576', hw: 'Rockchip RK3576', status: 'Bring-up, image builds, physical tests pending' },
      { board: 's905x5m', hw: 'Amlogic S7D (BM201)', status: 'Bring-up, image builds, physical tests pending' },
    ],
    note: 'No board is qualified yet. docs/boards/support-tiers.md is the authoritative, up-to-date table.',
    more: 'All boards and support tiers',
    request: 'Request a new board',
  },
  download: {
    title: 'Downloads',
    lead: 'Pick a signed deployment by board, profile and artifact kind. This repository publishes no public download list: images are built from source, or delivered by the integrator together with what is needed to verify them.',
    filters: {
      board: 'Board',
      profile: 'Profile',
      query: 'Version or deployment ID',
      all: 'All',
    },
    cols: {
      board: 'Board',
      profile: 'Profile',
      version: 'Version',
      released: 'Released',
      deployment: 'Deployment',
      size: 'Size',
      download: 'Download',
    },
    empty: 'No image published yet. Build one from source, or ask your integrator for one.',
    history: 'Show earlier versions',
    historyHide: 'Latest only',
    sample: 'The rows below are sample data shown to demonstrate filtering. They are not a release.',
    obtain: {
      heading: 'How to get an image',
      build: {
        title: 'Build from source',
        body: 'A pinned build container imports the packages, then assembles, signs, verifies and tests one product image.',
        cta: 'Quickstart',
      },
      integrator: {
        title: 'Ask your integrator',
        body: 'The integrator selects the board and owns the application, and ships the image with its manifest, digests and test log.',
        cta: 'Get and identify an image',
      },
    },
    verify: {
      heading: 'Verification',
      body: 'The metadata public key has to come from an independent trusted channel — a checksum served beside the artifact is not authentication. Boot, content and metadata have separate trust anchors.',
      command: 'bash verify/run.sh --verify --board x64 \\\n  --image /path/to/disk.img --public-key /path/to/metadata-public.key',
      note: 'The offline check verifies the authenticated signature record and inspects content, geometry, firmware receipts and root policy.',
    },
  },
  flow: {
    heading: 'From image to the field',
    steps: [
      { no: '01', title: 'Pick the board', body: 'The board contract states what the system needs; BSPs and kernels come from mica-boards.' },
      { no: '02', title: 'Compose the image', body: 'mica-build imports the pinned packages, then composes, signs, verifies and tests a product image.' },
      { no: '03', title: 'Install and first run', body: 'Installation and first configuration need no network and no cloud service; SSH stays off by default.' },
      { no: '04', title: 'Update and roll back', body: 'Signed A/B deployments reach the device; a failed health check returns it to the deployment that last worked.' },
    ],
  },
  start: {
    heading: 'Read the docs, then build',
    body: 'The architecture, the decisions, the board contract and the operating guides all live in the documentation, and they are updated with the code. Start from the quickstart: build an image, boot it, put your application on it.',
  },
  docs: {
    title: 'Mica OS documentation',
    heading: 'Documentation',
    sub: 'Architecture, user docs, boards, design records and decisions. This repository is the project\'s front door — a code change lands together with its record here.',
    empty: 'No documents match.',
    quickTitle: 'Start here',
    quick: [
      { title: 'Quickstart', body: 'Build an image and boot it.', path: 'docs/user/quickstart.md' },
      { title: 'First run', body: 'Install offline, then configure the device to be what you need.', path: 'docs/user/first-run.md' },
      { title: 'Run your application', body: 'Updates with the system, or ships independently as a self-contained package or OCI container.', path: 'docs/user/applications.md' },
    ],
    sections: [
      { no: '01', title: 'Architecture', body: 'How the parts of the system fit together.', path: 'docs/architecture.md' },
      { no: '02', title: 'User documentation', body: 'Quickstart, installation, first run, updates and rollback.', path: 'docs/user/' },
      { no: '03', title: 'Boards', body: 'The board contract, the porting guide and the support tiers.', path: 'docs/boards/' },
      { no: '04', title: 'Design records', body: 'Why the build, the containers and the security model are shaped this way.', path: 'docs/design/' },
      { no: '05', title: 'Decisions', body: 'Settled choices, each with its reasoning and a review date.', path: 'docs/decisions/' },
      { no: '06', title: 'Tasks and plans', body: 'Every change is investigated and proposed before it is implemented.', path: 'docs/task/ · docs/plan/' },
      { no: '07', title: 'Changelog', body: 'What happened, and when.', path: 'docs/changelog.md' },
    ],
    groups: {
      start: 'Getting started',
      operating: 'Operating',
      trouble: 'When something goes wrong',
      reference: 'Reference',
      engineers: 'For engineers',
    },
  },
  footer: {
    repo: 'GitHub',
    license: 'Apache-2.0 licensed',
  },
}
