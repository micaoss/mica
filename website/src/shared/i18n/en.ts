// Copy transcribed from the design handoff bundle — see zh.ts.

import type { zh } from './zh'

export const en: typeof zh = {
  /** The locale this dictionary is, for wording kept in data files. */
  locale: 'en' as 'zh' | 'en',
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
        impl: 'mica-build',
        desc: 'The contract fixes what the system needs from the hardware, and BSPs, kernels and board packages are filed per board; images are composed, signed and tested from pinned versions. Bringing up a new board is a porting job, not a second system.',
      },
    ],
  },
  boards: {
    heading: 'Supported boards',
    cols: { board: 'Board', hw: 'Hardware', status: 'Status' },
    more: 'All boards and support tiers',
    request: 'Request a new board',
  },
  download: {
    title: 'Downloads',
    lead: 'Start with a board; its page carries the system images, update packages and firmware packages. This repository publishes no public download list: images are built from source, or delivered by the integrator together with what is needed to verify them.',
    boardsHeading: 'Choose a board',
    boardHref: 'Downloads',
    backToBoards: 'All boards',
    boardLead: 'The system images, boot loaders and update packages for this board: the files of each product\'s newest release.',
    filters: {
      board: 'Board',
      profile: 'Variant',
      query: 'Version or deployment ID',
      all: 'All',
    },
    cols: {
      board: 'Board',
      profile: 'Variant',
      kind: 'Form',
      version: 'Version',
      released: 'Released',
      deployment: 'Deployment',
      size: 'Size',
      download: 'Download',
    },
    empty: 'Nothing published for this board yet. Build an image from source, or ask your integrator for one.',
    loading: 'Reading the release catalogue…',
    recommended: 'Recommended',
    history: 'Show earlier versions',
    historyHide: 'Latest only',
    sample: 'The rows below are sample data shown to demonstrate filtering. They are not a release.',
    latest: 'Latest',
    nothingYet: 'Nothing published yet',
    guides: {
      heading: 'Working with this board',
    },
    app: {
      heading: 'Mica App',
      lead: 'Network setup, first-run setup and management from a phone: over Bluetooth on a device that has it, over the local network on one with neither Bluetooth nor a screen.',
      android: {
        title: 'Android',
        body: 'The newest APK, installed directly; later versions install over it.',
        cta: 'Download APK',
      },
      ios: {
        title: 'iOS',
        body: 'Coming soon.',
      },
    },
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
      body: 'A checksum served beside a file proves only that it arrived intact. What makes an image trustworthy is the signature chain inside it, which the device checks as it boots.',
      command: 'sha256sum -c SHA256SUMS\nawk -F\'\\t\' \'$1 == "asset" && $5 == "<file>" {print $6 "  " $5}\' mica-build.lock \\\n  | sha256sum -c -',
      note: 'SHA256SUMS lists the release lock, and the lock names the sha256 of every file in the release. Download all three from the release; Get and identify an image walks through it.',
    },
  },
  flow: {
    heading: 'From image to the field',
    steps: [
      { no: '01', title: 'Pick the board', body: 'The board contract states what the system needs; BSPs and kernels come from mica-build.' },
      { no: '02', title: 'Compose the image', body: 'mica-build imports the pinned packages, then composes, signs, verifies and tests a product image.' },
      { no: '03', title: 'Install and first run', body: 'Installation and first configuration need no network and no cloud service; SSH stays off by default.' },
      { no: '04', title: 'Update and roll back', body: 'Signed A/B deployments reach the device; a failed health check returns it to the deployment that last worked.' },
    ],
  },
  start: {
    heading: 'Read the docs, then build',
    body: 'The architecture, the board contract and the operating guides all live in the documentation, and they are updated with the code. Start from the quickstart: build an image, boot it, put your application on it.',
  },
  docs: {
    title: 'Mica OS documentation',
    heading: 'Documentation',
    sub: 'Architecture, guides, hardware, security, reference and releases: what Mica OS is and how a device behaves.',
    empty: 'No documents match.',
    quickTitle: 'Start here',
    quick: [
      { title: 'Quickstart', body: 'Build an image and boot it.', path: 'docs/start/quickstart.md' },
      { title: 'First run', body: 'Install offline, then configure the device to be what you need.', path: 'docs/start/first-run.md' },
      { title: 'Run your application', body: 'Updates with the system, or ships independently as a self-contained package or OCI container.', path: 'docs/integrate/applications.md' },
    ],
    sections: [
      { no: '01', title: 'Architecture', body: 'How the parts of the system fit together.', path: 'docs/architecture.md' },
      { no: '02', title: 'Guides', body: 'Getting an image and booting it, running a device, building a product on it.', path: 'docs/start/ · docs/operate/ · docs/integrate/' },
      { no: '03', title: 'Hardware', body: 'The supported boards, their support tiers and how each is flashed and recovered.', path: 'docs/hardware/' },
      { no: '04', title: 'Security', body: 'The security posture, the threat model and the trust chain.', path: 'docs/security/' },
      { no: '05', title: 'Reference', body: 'The contracts of a device\'s behaviour: updates, storage, boot, access.', path: 'docs/reference/' },
      { no: '06', title: 'Releases', body: 'How a release is identified, made, distributed and supported.', path: 'docs/releases/' },
    ],
    groups: {
      start: 'Getting started',
      hardware: 'Supported hardware',
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
