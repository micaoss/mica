import type { MockOptions } from '../test/mock-device'
import type { Lang } from './i18n'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MockDevice } from '../test/mock-device'
import { fakeBluetooth } from '../test/mock-gatt'
import { referenceVerifier } from '../test/reference-verifier'
import { App } from './App'
import { SETUP_HOST } from './config'
import { detectLang } from './i18n'
import { httpsRedirect, isIos, mergeNetworks } from './util'

const ROUTERS = { Harbour: { psk: 'harbour-wifi-1', ip: '192.168.8.41' } }
const NETWORKS = [
  { ssid: 'Harbour', signalDbm: -61, security: 'wpa2-psk', channel: 6 },
  { ssid: 'Harbour', signalDbm: -48, security: 'wpa2-psk', channel: 36 },
  { ssid: 'Marina Guest', signalDbm: -70, security: 'open', channel: 11 },
  { ssid: '', signalDbm: -40, security: 'wpa2-psk', channel: 1 },
]

function setup(opts: MockOptions = {}, lang: Lang = 'zh', pick = () => true) {
  const mock = new MockDevice({ spake: referenceVerifier(), routers: ROUTERS, networks: NETWORKS, ...opts })
  const bluetooth = fakeBluetooth(mock, pick)
  const user = userEvent.setup()
  render(<App bluetooth={bluetooth} ios={false} initialLang={lang} />)
  return { mock, bluetooth, user }
}

const find = (text: string | RegExp) => screen.findByText(text, {}, { timeout: 4000 })

type User = ReturnType<typeof userEvent.setup>

/** A device on the current protocol: no claim, straight to the status. */
async function reachStatus(user: User) {
  await user.click(screen.getByRole('button', { name: '连接设备' }))
  await find('当前状态')
}

async function reachSsid(user: User) {
  await reachStatus(user)
  await user.click(screen.getByRole('button', { name: '配置 Wi-Fi' }))
  await find('设备当前为 Wi-Fi 接入点模式，不能扫描，请输入网络名称。')
}

/** A core 0.0.3 device: the administrator step comes first. */
async function claimAndReachStatus(user: User) {
  await user.click(screen.getByRole('button', { name: '连接设备' }))
  await find('设置管理员')
  await user.type(screen.getByLabelText('管理员密码（至少 8 位）'), 'admin-pass-1')
  await user.type(screen.getByLabelText('再次输入密码'), 'admin-pass-1')
  await user.type(screen.getByLabelText('主机名（可选）'), 'quay-7')
  await user.click(screen.getByRole('button', { name: '下一步' }))
  await find('当前状态')
}

async function enterNetwork(user: User, ssid: string, psk: string) {
  await user.type(screen.getByLabelText('网络名称'), ssid)
  await user.click(screen.getByRole('button', { name: '下一步' }))
  await find(`连接 ${ssid}`)
  if (psk)
    await user.type(screen.getByLabelText('Wi-Fi 密码（开放网络留空）'), psk)
  await user.click(screen.getByRole('button', { name: '连接' }))
}

const SET_PASSWORD = /^打开控制台设置管理员密码：/
const DEVICE_CODE = '控制台会要求输入设备标签上印的设备码。'
const AP_ON = '设备热点仍然开着，在控制台完成认领之前，用的是标签上的密码。'

describe('the provisioning page', () => {
  it('step 0: without Web Bluetooth it sends the user to hotspot setup', () => {
    render(<App bluetooth={undefined} ios initialLang="zh" />)
    expect(screen.getByRole('alert')).toHaveTextContent('请使用 Android 手机，或使用设备热点配网')
    expect(screen.getByText('iPhone 和 iPad 上的浏览器都不支持网页蓝牙。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '连接设备' })).toBeNull()
    expect(screen.getByText(new RegExp(SETUP_HOST))).toBeInTheDocument()
  })

  it('an unclaimed device over Wi-Fi: no password, no hostname, the console claims it', async () => {
    const { mock, user } = setup()
    await reachSsid(user)
    expect(screen.queryByText('设置管理员')).toBeNull()
    await user.type(screen.getByLabelText('网络名称'), 'Harbour')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(await find('设备将关闭热点并连接 Harbour，连着设备热点的终端会断开')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Wi-Fi 密码（开放网络留空）'), 'harbour-wifi-1')
    await user.click(screen.getByRole('button', { name: '连接' }))
    expect(await find('已连接 Harbour，IP：192.168.8.41')).toBeInTheDocument()
    // The hostname is set with the console's claim, not here.
    expect(screen.queryByLabelText('主机名（可选）')).toBeNull()
    await user.click(screen.getByRole('button', { name: '完成配网' }))
    expect(await find('已连接。Wi-Fi 192.168.8.41。')).toBeInTheDocument()
    expect(screen.getByText(SET_PASSWORD)).toHaveTextContent('打开控制台设置管理员密码：http://192.168.8.41:8080 或 http://mica-a4e2e69e.local:8080')
    expect(screen.getByRole('link', { name: 'http://192.168.8.41:8080' })).toHaveAttribute('href', 'http://192.168.8.41:8080')
    expect(screen.getByRole('link', { name: 'http://mica-a4e2e69e.local:8080' })).toHaveAttribute('href', 'http://mica-a4e2e69e.local:8080')
    expect(screen.getByText(DEVICE_CODE)).toBeInTheDocument()
    // After setWifi the access point is off.
    expect(screen.queryByText(AP_ON)).toBeNull()
    expect(mock.claimed).toBe(false)
    expect(mock.commands.map(c => c.op)).toEqual(['getStatus', 'setWifi', 'finish'])
    // finish carries no member but op and id.
    expect(mock.commands.at(-1)).toEqual({ id: 3, op: 'finish' })
  })

  it.each([
    ['wrong_password', 'Harbour', 'not-the-key', 'Wi-Fi 密码错误', 7],
    ['ssid_not_found', 'Nowhere', 'whatever-1', '未找到该网络，请检查名称或靠近路由器', 6],
    ['dhcp_timeout', 'Marina', 'marina-key-1', '已连接但未获得 IP，请检查路由器', 7],
    ['unsupported_security', 'Corp', 'corp-key-12', '设备不支持该网络的加密方式', 6],
    ['busy', 'Busy', 'busy-key-12', '设备忙，请稍候重试', 7],
  ])('step 8: %s shows its text and returns to its step', async (_reason, ssid, psk, text, back) => {
    const { user } = setup({
      routers: {
        ...ROUTERS,
        Marina: { psk: 'marina-key-1', fail: 'dhcp_timeout' },
        Corp: { psk: 'corp-key-12', fail: 'unsupported_security' },
        Busy: { psk: 'busy-key-12', fail: 'busy' },
      },
    })
    await reachSsid(user)
    await enterNetwork(user, ssid, psk)
    expect(await find(text)).toBeInTheDocument()
    if (back === 7) {
      expect(screen.getByRole('heading', { name: `连接 ${ssid}` })).toBeInTheDocument()
      expect(screen.getByLabelText('Wi-Fi 密码（开放网络留空）')).toHaveValue('')
    }
    else {
      // Back at the network step; the device left access-point mode, so it scanned.
      expect(screen.getByRole('heading', { name: '选择网络' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Harbour/ })).toBeInTheDocument()
    }
  })

  it('the wired port over DHCP: the hotspot stays on with the label key until the console claim', async () => {
    const { user, mock } = setup()
    await reachStatus(user)
    expect(screen.getByText('有线 · 已插网线')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '配置有线网络' }))
    await find('有线网络')
    expect(screen.getByLabelText('网口')).toHaveValue('eth0')
    expect(screen.getByLabelText('自动获取（DHCP）')).toBeChecked()
    await user.click(screen.getByRole('button', { name: '应用' }))
    expect(await find('eth0 已配置，地址：192.168.1.40/24')).toBeInTheDocument()
    expect(mock.commands.find(c => c.op === 'setNetwork')).toEqual({ id: 1, op: 'setNetwork', interface: 'eth0', dhcp: true })
    await user.click(screen.getByRole('button', { name: '完成配网' }))
    expect(await find('已连接。有线 192.168.1.40。')).toBeInTheDocument()
    expect(screen.getByText(SET_PASSWORD)).toHaveTextContent('打开控制台设置管理员密码：http://192.168.1.40:8080 或 http://mica-a4e2e69e.local:8080')
    expect(screen.getByText(DEVICE_CODE)).toBeInTheDocument()
    expect(screen.getByText(AP_ON)).toBeInTheDocument()
    expect(mock.claimed).toBe(false)
  })

  it('links https consoleUrls as the device sends them', async () => {
    const { user } = setup({ web: { scheme: 'https', port: 443 } })
    await reachSsid(user)
    await enterNetwork(user, 'Harbour', 'harbour-wifi-1')
    await user.click(await screen.findByRole('button', { name: '完成配网' }, { timeout: 4000 }))
    expect(await find(SET_PASSWORD)).toHaveTextContent('打开控制台设置管理员密码：https://192.168.8.41 或 https://mica-a4e2e69e.local')
    expect(screen.getByRole('link', { name: 'https://192.168.8.41' })).toHaveAttribute('href', 'https://192.168.8.41')
  })

  it('says the console is not on the network when consoleUrls is empty', async () => {
    const { user } = setup({ web: null })
    await reachSsid(user)
    await enterNetwork(user, 'Harbour', 'harbour-wifi-1')
    await user.click(await screen.findByRole('button', { name: '完成配网' }, { timeout: 4000 }))
    expect(await find('已连接。Wi-Fi 192.168.8.41。')).toBeInTheDocument()
    expect(screen.getByText('这台设备的控制台没有在网络上开放，无法从网络打开。')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(SET_PASSWORD)).toBeNull()
  })

  it('a static address is checked on the page, then sent as the doc shapes it', async () => {
    const { user, mock } = setup()
    await reachStatus(user)
    await user.click(screen.getByRole('button', { name: '配置有线网络' }))
    await user.click(await screen.findByLabelText('静态地址'))
    const apply = () => user.click(screen.getByRole('button', { name: '应用' }))
    await user.type(screen.getByLabelText('地址/前缀（如 192.168.1.40/24）'), '10.0.0.5')
    await apply()
    expect(screen.getByRole('alert')).toHaveTextContent('地址应为 IPv4 地址加前缀，如 192.168.1.40/24')
    await user.type(screen.getByLabelText('地址/前缀（如 192.168.1.40/24）'), '/24')
    await user.type(screen.getByLabelText('网关（可选）'), '10.0.0.300')
    await apply()
    expect(screen.getByRole('alert')).toHaveTextContent('网关应为 IPv4 地址')
    await user.clear(screen.getByLabelText('网关（可选）'))
    await user.type(screen.getByLabelText('网关（可选）'), '10.0.0.1')
    await user.type(screen.getByLabelText('DNS 服务器（可选，用空格或逗号分隔）'), '10.0.0.1, nope')
    await apply()
    expect(screen.getByRole('alert')).toHaveTextContent('DNS 服务器应为 IP 地址')
    expect(mock.commands.some(c => c.op === 'setNetwork')).toBe(false)
    await user.clear(screen.getByLabelText('DNS 服务器（可选，用空格或逗号分隔）'))
    await user.type(screen.getByLabelText('DNS 服务器（可选，用空格或逗号分隔）'), '10.0.0.1, 2001:db8::53')
    await apply()
    expect(await find('eth0 已配置，地址：10.0.0.5/24')).toBeInTheDocument()
    expect(mock.commands.find(c => c.op === 'setNetwork')).toEqual({
      id: 1,
      op: 'setNetwork',
      interface: 'eth0',
      static: { address: '10.0.0.5/24', gateway: '10.0.0.1', dns: ['10.0.0.1', '2001:db8::53'] },
    })
  })

  it.each([
    [{ ports: [{ name: 'eth0', kind: 'ethernet' as const, carrier: false, address: null }] }, '没有插网线。设置已保存，插上网线后生效'],
    [{ lease: null }, '已连接但未获得 IP，请检查路由器'],
    [{ wiredFail: 'address_overlap' }, '该子网与设备另一个接口的子网重叠'],
  ])('a wired failure (%o) shows its text and returns to the form', async (opts, text) => {
    const { user } = setup(opts)
    await reachStatus(user)
    await user.click(screen.getByRole('button', { name: '配置有线网络' }))
    await user.click(await screen.findByRole('button', { name: '应用' }))
    expect(await find(text)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '有线网络' })).toBeInTheDocument()
  })

  it('offers no wired port when the device does not list setNetwork', async () => {
    const { user } = setup({ ops: ['getStatus', 'scanWifi', 'setWifi', 'finish'] })
    await reachStatus(user)
    expect(screen.queryByRole('button', { name: '配置有线网络' })).toBeNull()
    expect(screen.getByRole('button', { name: '配置 Wi-Fi' })).toBeInTheDocument()
  })

  it('a claimed device: password, scan list merged by name, connect, finish', async () => {
    const { user, mock } = setup({ claimed: true, auth: 'password', secret: 'harbour-pw-1', wifiMode: 'client' })
    await user.click(screen.getByRole('button', { name: '连接设备' }))
    await user.type(await screen.findByLabelText('管理员密码'), 'wrong-pw-1')
    await user.click(screen.getByRole('button', { name: '验证' }))
    expect(await find('密码错误')).toBeInTheDocument()
    await user.type(screen.getByLabelText('管理员密码'), 'harbour-pw-1')
    await user.click(screen.getByRole('button', { name: '验证' }))
    await find('当前状态')
    await user.click(screen.getByRole('button', { name: '配置 Wi-Fi' }))
    await find('选择网络')
    const items = screen.getAllByRole('listitem').map(li => li.textContent)
    expect(items).toEqual(['Harbourwpa2-psk · -48 dBm', 'Marina Guest开放 · -70 dBm'])
    await user.click(screen.getByRole('button', { name: /Harbour/ }))
    expect(screen.queryByText(/设备将关闭热点/)).toBeNull()
    await user.type(screen.getByLabelText('Wi-Fi 密码（开放网络留空）'), 'harbour-wifi-1')
    await user.click(screen.getByRole('button', { name: '连接' }))
    await user.click(await screen.findByRole('button', { name: '完成配网' }, { timeout: 4000 }))
    expect(await find('已连接。Wi-Fi 192.168.8.41。')).toBeInTheDocument()
    // Claimed already: the console is just the console.
    expect(screen.getByText(/^打开控制台：/)).toHaveTextContent('打开控制台：http://192.168.8.41:8080 或 http://mica-a4e2e69e.local:8080')
    expect(screen.queryByText(DEVICE_CODE)).toBeNull()
    expect(screen.queryByText(/^设备热点/)).toBeNull()
    // The status came with `ready`: the one getStatus is the network step's.
    expect(mock.commands.filter(c => c.op === 'getStatus')).toHaveLength(1)
  })

  it('a wrong password shows the attempts left when the device sends them', async () => {
    const { user } = setup({ claimed: true, auth: 'password', secret: 'harbour-pw-1', attemptsInShare: true })
    await user.click(screen.getByRole('button', { name: '连接设备' }))
    await user.type(await screen.findByLabelText('管理员密码'), 'wrong-pw-1')
    await user.click(screen.getByRole('button', { name: '验证' }))
    expect(await find('密码错误，还可尝试 4 次')).toBeInTheDocument()
  })

  it('a temp-code window shows the code field and the remaining attempts', async () => {
    const { user } = setup({ claimed: true, auth: 'temp-code', secret: '40718263' })
    await user.click(screen.getByRole('button', { name: '连接设备' }))
    expect(await screen.findByLabelText('临时配网码')).toBeInTheDocument()
    await user.type(screen.getByLabelText('临时配网码'), '4071 8263')
    await user.click(screen.getByRole('button', { name: '验证' }))
    expect(await find('当前状态')).toBeInTheDocument()
  })

  it('a locked device says when to retry', async () => {
    const { user } = setup({ claimed: true, auth: 'password', secret: 'harbour-pw-1', attemptsLeft: 0 })
    await user.click(screen.getByRole('button', { name: '连接设备' }))
    await user.type(await screen.findByLabelText('管理员密码'), 'harbour-pw-1')
    await user.click(screen.getByRole('button', { name: '验证' }))
    expect(await find('错误次数过多，设备已锁定，请在 10 分钟 后重试')).toBeInTheDocument()
  })

  it.each([
    [{ protocol: 2 }, '请刷新页面或升级设备'],
    [{ claimed: true, auth: 'password-unavailable' as const }, '请先登录一次控制台以启用蓝牙恢复'],
    [{ busy: true }, '设备忙，请稍候重试'],
  ])('step 2 stops on %o', async (opts, text) => {
    const { user } = setup(opts)
    await user.click(screen.getByRole('button', { name: '连接设备' }))
    expect(await find(text)).toBeInTheDocument()
  })

  it('a device claimed in the console meanwhile ends the flow', async () => {
    const { user } = setup({ claimedElsewhere: true })
    await reachSsid(user)
    await enterNetwork(user, 'Harbour', 'harbour-wifi-1')
    expect(await find('设备已被其他方式认领')).toBeInTheDocument()
  })

  it('a dropped link on an unclaimed device reconnects to the status', async () => {
    const { user, mock } = setup()
    await reachSsid(user)
    await mock.close('idle')
    expect(await find('2 分钟无操作，设备断开了蓝牙。 蓝牙已断开，重新连接后继续。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重新连接' }))
    expect(await find('当前状态')).toBeInTheDocument()
  })

  it('a cancelled chooser explains when devices are visible', async () => {
    const { user } = setup({}, 'zh', () => false)
    await user.click(screen.getByRole('button', { name: '连接设备' }))
    expect(await find(/没有选择设备/)).toBeInTheDocument()
  })

  it('speaks English', async () => {
    const { user } = setup({}, 'en')
    await user.click(screen.getByRole('button', { name: 'Connect to device' }))
    expect(await find('Current state')).toBeInTheDocument()
  })
})

describe('a core 0.0.3 device (info.ops lists claim)', () => {
  it('claims in the session as before; no hostname field at finish, no key shown', async () => {
    const { mock, user } = setup({ legacy: true })
    await claimAndReachStatus(user)
    expect(screen.queryByRole('button', { name: '配置有线网络' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '配置 Wi-Fi' }))
    await find('设备当前为 Wi-Fi 接入点模式，不能扫描，请输入网络名称。')
    await enterNetwork(user, 'Harbour', 'harbour-wifi-1')
    await find('已连接 Harbour，IP：192.168.8.41')
    expect(screen.queryByLabelText('主机名（可选）')).toBeNull()
    await user.click(screen.getByRole('button', { name: '完成配网' }))
    // 0.0.3's finished names no console: the page falls back to the hostname.
    expect(await find(/^打开控制台：/)).toHaveTextContent('打开控制台：http://quay-7.local:8080')
    expect(screen.getByText('设备热点已关闭。以后如需打开，请在控制台（Wi-Fi 页面）设置它的密码。')).toBeInTheDocument()
    expect(screen.queryByText('harbour-ap-key-7f3a')).toBeNull()
    expect(screen.queryByText(DEVICE_CODE)).toBeNull()
    expect(mock.claimed).toBe(true)
    expect(mock.commands.find(c => c.op === 'claim')).toEqual({ id: 1, op: 'claim', password: 'admin-pass-1', hostname: 'quay-7' })
  })

  it('step 4 checks the password twice and the hostname', async () => {
    const { user, mock } = setup({ legacy: true })
    await user.click(screen.getByRole('button', { name: '连接设备' }))
    await find('设置管理员')
    const next = () => user.click(screen.getByRole('button', { name: '下一步' }))
    await user.type(screen.getByLabelText('管理员密码（至少 8 位）'), 'short')
    await next()
    expect(screen.getByRole('alert')).toHaveTextContent('密码至少 8 位')
    await user.type(screen.getByLabelText('管理员密码（至少 8 位）'), '-but-now-long')
    await user.type(screen.getByLabelText('再次输入密码'), 'different-one')
    await next()
    expect(screen.getByRole('alert')).toHaveTextContent('两次输入的密码不一致')
    await user.clear(screen.getByLabelText('再次输入密码'))
    await user.type(screen.getByLabelText('再次输入密码'), 'short-but-now-long')
    await user.type(screen.getByLabelText('主机名（可选）'), '-bad-')
    await next()
    expect(screen.getByRole('alert')).toHaveTextContent('主机名只能包含字母、数字和连字符')
    expect(mock.commands.some(c => c.op === 'claim')).toBe(false)
  })

  it('a dropped link restarts from the administrator step', async () => {
    const { user, mock } = setup({ legacy: true })
    await claimAndReachStatus(user)
    await mock.close('idle')
    expect(await find(/2 分钟无操作，设备断开了蓝牙。.*暂存的管理员设置已丢弃/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重新连接' }))
    expect(await find('设置管理员')).toBeInTheDocument()
  })
})

describe('helpers', () => {
  it('merges scan results by name, strongest first, without hidden ones', () => {
    expect(mergeNetworks(NETWORKS).map(n => [n.ssid, n.signalDbm])).toEqual([['Harbour', -48], ['Marina Guest', -70]])
  })

  it('recognises iOS and iPadOS', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isIos('Mozilla/5.0 (Linux; Android 15)', 5)).toBe(false)
  })

  it('sends plain http on the page\'s host to https, where Web Bluetooth exists', () => {
    expect(httpsRedirect({ protocol: 'http:', hostname: SETUP_HOST, href: `http://${SETUP_HOST}/?lang=en` }))
      .toBe(`https://${SETUP_HOST}/?lang=en`)
    expect(httpsRedirect({ protocol: 'https:', hostname: SETUP_HOST, href: `https://${SETUP_HOST}/` })).toBeNull()
    expect(httpsRedirect({ protocol: 'http:', hostname: '127.0.0.1', href: 'http://127.0.0.1:5199/' })).toBeNull()
  })

  it('picks the language from ?lang, then the browser', () => {
    expect(detectLang(['en-GB'], '?lang=zh')).toBe('zh')
    expect(detectLang(['zh-CN', 'en'], '')).toBe('zh')
    expect(detectLang(['el-GR', 'zh'], '')).toBe('en')
  })

  it('deploys to the host the page names', () => {
    const wrangler = readFileSync('wrangler.setup.jsonc', 'utf8')
    expect(wrangler).toContain(`{ "pattern": "${SETUP_HOST}", "custom_domain": true }`)
  })
})
