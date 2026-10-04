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
  /** The locale this dictionary is, for wording kept in data files. */
  locale: 'zh' as 'zh' | 'en',
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
      { board: 'uefi-x64', hw: '通用 amd64 系统，UEFI', status: 'bring-up，QEMU 基线' },
      { board: 'uefi-arm64', hw: '通用 arm64 系统，UEFI', status: 'bring-up，QEMU 参考' },
      { board: 'cx3576', hw: 'Rockchip RK3576', status: 'bring-up，镜像可构建，实机测试待做' },
      { board: 's905x5m', hw: 'Amlogic S7D（BM201）', status: 'bring-up，镜像可构建，实机测试待做' },
      { board: 'mini-x64', hw: '小型 amd64 系统，UEFI，128 MB 闪存', status: 'bring-up，QEMU' },
    ],
    more: '全部板卡与支持等级',
    request: '请求支持新板卡',
  },
  download: {
    title: '下载',
    lead: '先选板卡，板卡页里是它的系统镜像、升级包与固件包。本仓库不发布公开下载列表：镜像从源码构建，或由集成方连同校验材料一起交付。',
    boardsHeading: '选择板卡',
    boardHref: '查看下载',
    backToBoards: '全部板卡',
    boardLead: '这块板卡的系统镜像、引导加载器与升级包，默认显示每个产品最新一次发布的文件。',
    filters: {
      board: '板卡',
      profile: '变体',
      query: '版本或部署 ID',
      all: '全部',
    },
    cols: {
      board: '板卡',
      profile: '变体',
      kind: '形态',
      version: '版本',
      released: '发布',
      deployment: '部署 ID',
      size: '大小',
      download: '下载',
    },
    empty: '这块板卡当前没有已发布的下载。镜像从源码构建，或向集成方索取。',
    loading: '正在读取发布目录……',
    history: '显示历史版本',
    historyHide: '只看最新版本',
    sample: '以下为示例数据，用于展示筛选，不是真实发布。',
    latest: '最新',
    nothingYet: '暂无发布',
    unlisted: '目录里还有本站尚未列出的板卡：',
    guides: {
      heading: '这块板卡怎么用',
      quickstart: { title: '快速上手', body: '构建一份镜像并把它启动起来。' },
      install: { title: '刷机指南', body: '把镜像写到板子上，直到第一次启动起来。' },
      firstRun: { title: '首次配置', body: '离线装机，然后把设备配成你要的样子。' },
      flashing: { title: '写入镜像', body: '按板卡把发布镜像写进设备，以及哪些步骤尚未验证。' },
      update: { title: '升级与回滚', body: '签名的 A/B 部署、健康确认，以及失败时退回上一份。' },
      recovery: { title: '恢复', body: '设备起不来时怎么办，以及恢复的代价。' },
      trouble: { title: '出问题的时候', body: '怎么接进去、该读哪些证据、系统的拒绝信息怎么解读。' },
      board: { title: '板卡页', body: '这块板卡的硬件、刷写与恢复途径，以及已经证明了什么。' },
      source: { title: '板卡源码', body: '这块板卡的内核、加载器与软件包，在 mica-build 里。' },
    },
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
    sub: '架构、指南、硬件、安全、参考、发布与决策：Mica OS 是什么，设备如何表现。',
    empty: '没有匹配的文档。',
    quickTitle: '从这里开始',
    quick: [
      { title: '快速上手', body: '构建一份镜像并把它启动起来。', path: 'docs/start/quickstart.md' },
      { title: '首次配置', body: '离线装机，然后把设备配成你要的样子。', path: 'docs/start/first-run.md' },
      { title: '跑我的应用', body: '原生应用随系统更新，或以自包含包、OCI 容器独立发布。', path: 'docs/integrate/applications.md' },
    ],
    sections: [
      { no: '01', title: '架构', body: '系统各部分如何拼在一起。', path: 'docs/architecture.md' },
      { no: '02', title: '指南', body: '拿到镜像并启动、运维一台设备、在它上面做产品。', path: 'docs/start/ · docs/operate/ · docs/integrate/' },
      { no: '03', title: '硬件', body: '支持的板卡、支持等级，以及每块板如何刷机与恢复。', path: 'docs/hardware/' },
      { no: '04', title: '安全', body: '安全姿态、威胁模型与信任链。', path: 'docs/security/' },
      { no: '05', title: '参考', body: '设备行为的契约：更新、存储、启动、访问。', path: 'docs/reference/' },
      { no: '06', title: '发布', body: '发布版如何标识、制作、分发与支持。', path: 'docs/releases/' },
      { no: '07', title: '决策', body: '已定下的选择，带上理由与复核日期。', path: 'docs/decisions/' },
    ],
    groups: {
      start: '快速开始',
      hardware: '支持硬件',
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
