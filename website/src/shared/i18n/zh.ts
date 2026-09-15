// Copy transcribed from the design handoff bundle; the facts follow
// micaoss/mica's README.

export interface ArchLayer {
  no: string
  name: string
  /** The components behind the layer, set small and monospaced. */
  impl: string
  /** Omitted where the title and the points already say enough. */
  desc?: string
  /** Omitted where the description carries the layer on its own. */
  points?: string[]
}

export const zh = {
  label: '中文',
  meta: {
    htmlLang: 'zh-CN',
    title: 'Mica OS — 做产品，别做系统。',
  },
  nav: {
    download: '下载',
    docs: '文档',
    themeLabel: '主题',
    themeDark: '深色',
    themeLight: '浅色',
    themeAuto: '自动',
    menu: '菜单',
    close: '关闭',
    langLabel: '语言',
  },
  hero: {
    title: '做产品，别做系统。',
    sub: '面向设备与集群的最小化 Linux：系统版本化更新；一套 API 本地与云端同管，快速产品交付。',
    cta1: '快速上手',
    cta2: '获取镜像',
  },
  why: {
    heading: '五层，职责边界清楚',
  },
  arch: {
    layers: ([
      {
        no: '05',
        name: '统一管理面掌管整台设备',
        impl: 'micad + apid',
        points: [
          'API first：网络、服务、应用与配置都走同一套认证 API，Web 界面与云端控制台都是它的客户端',
          '云端集群管理：配置与签名部署成批下发，状态与版本集中可见——一台和一千台是同一种操作',
          '离线可用，云端可选：离线装机、断网照常运行，连上后再对齐目标版本',
        ],
      },
      {
        no: '04',
        name: '应用在系统之上，不在系统里面',
        impl: '自包含包 · OCI 容器',
        desc: '原生应用随系统一起更新；用户应用以自包含包或 OCI 容器交付，独立更新、随时启停。',
      },
      {
        no: '03',
        name: '只读且逐块校验的 root',
        impl: 'squashfs + dm-verity',
        desc: '每份系统镜像是一份由 dm-verity 哈希树封印的 squashfs，运行时读取的每个块都对照构建期固定的根哈希。',
      },
      {
        no: '02',
        name: '更新认证的部署，失败回退',
        impl: 'A/B · 健康门',
        desc: '模块各自独立安装；对象先校验再落盘，健康门确认启动成功；候选连续三次失败后选回保留的那一份。',
      },
      {
        no: '01',
        name: '硬件差异收敛在板卡合约里',
        impl: 'mica-boards + mica-build',
        desc: '合约写死系统对硬件的要求，BSP、内核与板卡包按板卡归位；镜像按固定版本组装、签名、测试。上一块新板子走的是移植，不是另起一套系统。',
      },
    ] as ArchLayer[]),
  },
  boards: {
    heading: '支持的板卡',
    cols: { board: '板卡', hw: '硬件', status: '状态' },
    rows: [
      { board: 'x64', hw: '通用 x86_64，UEFI', status: 'bring-up，已在 QEMU 验证' },
      { board: 'virt-arm64', hw: 'QEMU ARM64，UEFI', status: 'bring-up，QEMU 参考' },
      { board: 'cx3576', hw: 'Rockchip RK3576', status: 'bring-up，镜像可构建，实机测试待做' },
      { board: 's905x5m', hw: 'Amlogic S7D（BM201）', status: 'bring-up，镜像可构建，实机测试待做' },
    ],
    note: '尚无板卡完成认证。docs/boards/support-tiers.md 是权威且最新的支持等级表。',
    more: '全部板卡与支持等级',
    request: '请求支持新板卡',
  },
  download: {
    title: '下载',
    lead: '按板卡、profile 与产物类型挑出签名部署。本仓库不发布公开下载列表：镜像从源码构建，或由集成方连同校验材料一起交付。',
    filters: {
      board: '板卡',
      profile: 'Profile',
      query: '版本或部署 ID',
      all: '全部',
    },
    cols: {
      board: '板卡',
      profile: 'Profile',
      version: '版本',
      released: '发布',
      deployment: '部署 ID',
      size: '大小',
      download: '下载',
    },
    empty: '当前没有已发布的镜像。镜像从源码构建，或向集成方索取。',
    history: '显示历史版本',
    historyHide: '只看最新版本',
    sample: '以下为示例数据，用于展示筛选，不是真实发布。',
    obtain: {
      heading: '怎么拿到镜像',
      build: {
        title: '从源码构建',
        body: '固定版本的构建容器导入软件包，组装、签名、校验并测试出一份产品镜像。',
        cta: '快速上手',
      },
      integrator: {
        title: '向集成方索取',
        body: '集成方选定板卡、掌握应用，交付镜像时一并给出清单、摘要与测试记录。',
        cta: '获取并识别镜像',
      },
    },
    verify: {
      heading: '校验',
      body: '元数据公钥必须来自独立的可信渠道——与产物放在一起的校验和不构成认证。启动、内容与元数据各有独立的信任锚。',
      command: 'bash verify/run.sh --verify --board x64 \\\n  --image /path/to/disk.img --public-key /path/to/metadata-public.key',
      note: '离线校验认证签名记录，并检查内容、几何、固件回执与根策略。',
    },
  },
  flow: {
    heading: '从镜像到现场',
    steps: [
      { no: '01', title: '选板卡', body: '板卡合约说明系统对硬件的要求；BSP 与内核来自 mica-boards。' },
      { no: '02', title: '组装镜像', body: 'mica-build 导入固定版本的包，组合、签名、校验并测试出一份产品镜像。' },
      { no: '03', title: '安装与首次配置', body: '离线装机与首次配置，不依赖网络或云服务；SSH 默认关闭。' },
      { no: '04', title: '更新与回滚', body: '签名的 A/B 部署推送到设备，健康检查不通过就自动退回上一份可用部署。' },
    ],
  },
  start: {
    heading: '先读文档，再动手',
    body: '架构、决策、板卡合约与运维手册全在文档里，并与代码一起更新。从快速上手开始：构一份镜像、引起来、把应用放上去。',
  },
  docs: {
    title: 'Mica OS 文档',
    /** The portal's own h1; the title above stays the page and site title. */
    heading: '文档',
    sub: '架构、用户文档、板卡、设计记录与决策。文档仓是项目的正门，每次代码改动都带着它的记录一起落地。',
    empty: '没有匹配的文档。',
    quickTitle: '从这里开始',
    quick: [
      { title: '快速上手', body: '构建一份镜像并把它启动起来。', path: 'docs/user/quickstart.md' },
      { title: '首次配置', body: '离线装机，然后把设备配成你要的样子。', path: 'docs/user/first-run.md' },
      { title: '跑我的应用', body: '原生应用随系统更新，或以自包含包、OCI 容器独立发布。', path: 'docs/user/applications.md' },
    ],
    sections: [
      { no: '01', title: '架构', body: '系统各部分如何拼在一起。', path: 'docs/architecture.md' },
      { no: '02', title: '用户文档', body: '快速上手、安装、首次配置、更新与回滚。', path: 'docs/user/' },
      { no: '03', title: '板卡', body: '板卡合约、移植指南与支持等级表。', path: 'docs/boards/' },
      { no: '04', title: '设计记录', body: '构建、容器与安全模型为什么长成这样。', path: 'docs/design/' },
      { no: '05', title: '决策', body: '已定下的选择，带上理由与复核日期。', path: 'docs/decisions/' },
      { no: '06', title: '任务与计划', body: '每项改动在实现之前先被调查与提案。', path: 'docs/task/ · docs/plan/' },
      { no: '07', title: '变更日志', body: '发生过什么，什么时候发生的。', path: 'docs/changelog.md' },
    ],
    groups: {
      start: '快速开始',
      operating: '日常运维',
      trouble: '出问题的时候',
      reference: '参考',
      engineers: '给工程师',
    },
  },
  footer: {
    repo: 'GitHub',
    license: 'Apache-2.0 许可',
  },
}
