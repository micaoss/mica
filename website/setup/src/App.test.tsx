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
import { isIos, mergeNetworks } from './util'

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

async function claimAndReachPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '连接设备' }))
  await find('设置管理员')
  await user.type(screen.getByLabelText('管理员密码（至少 8 位）'), 'admin-pass-1')
  await user.type(screen.getByLabelText('再次输入密码'), 'admin-pass-1')
  await user.type(screen.getByLabelText('主机名（可选）'), 'quay-7')
  await user.click(screen.getByRole('button', { name: '下一步' }))
  await find('当前状态')
  await user.click(screen.getByRole('button', { name: '配置 Wi-Fi' }))
  await find('设备当前为 Wi-Fi 接入点模式，不能扫描，请输入网络名称。')
}

async function enterNetwork(user: ReturnType<typeof userEvent.setup>, ssid: string, psk: string) {
  await user.type(screen.getByLabelText('网络名称'), ssid)
  await user.click(screen.getByRole('button', { name: '下一步' }))
  await find(`连接 ${ssid}`)
  if (psk)
    await user.type(screen.getByLabelText('Wi-Fi 密码（开放网络留空）'), psk)
  await user.click(screen.getByRole('button', { name: '连接' }))
}

describe('the provisioning page', () => {
  it('step 0: without Web Bluetooth it sends the user to hotspot setup', () => {
    render(<App bluetooth={undefined} ios initialLang="zh" />)
    expect(screen.getByRole('alert')).toHaveTextContent('请使用 Android 手机，或使用设备热点配网')
    expect(screen.getByText('iPhone 和 iPad 上的浏览器都不支持网页蓝牙。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '连接设备' })).toBeNull()
    expect(screen.getByText(new RegExp(SETUP_HOST))).toBeInTheDocument()
  })

  it('steps 1-9 on an unclaimed device in access-point mode, apPsk shown once', async () => {
    const { mock, user } = setup()
    await claimAndReachPassword(user)
    await user.type(screen.getByLabelText('网络名称'), 'Harbour')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(await find('设备将关闭热点并连接 Harbour，连着设备热点的终端会断开')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Wi-Fi 密码（开放网络留空）'), 'harbour-wifi-1')
    await user.click(screen.getByRole('button', { name: '连接' }))
    expect(await find('已连接 Harbour，IP：192.168.8.41')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '完成配网' }))
    expect(await find('请确认手机已连接到 Harbour，然后打开 http://192.168.8.41（备用 http://quay-7.local）')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '打开控制台' })).toHaveAttribute('href', 'http://192.168.8.41')
    expect(screen.getByText('harbour-ap-key-7f3a')).toBeInTheDocument()
    expect(mock.claimed).toBe(true)
    expect(mock.commands.find(c => c.op === 'claim')).toEqual({ id: 1, op: 'claim', password: 'admin-pass-1', hostname: 'quay-7' })
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
    await claimAndReachPassword(user)
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

  it('step 4 checks the password twice and the hostname', async () => {
    const { user, mock } = setup()
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

  it('a claimed device: password, scan list merged by name, connect, finish', async () => {
    const { user, mock } = setup({ claimed: true, auth: 'password', secret: 'harbour-pw-1', wifiMode: 'client' })
    await user.click(screen.getByRole('button', { name: '连接设备' }))
    await user.type(await screen.findByLabelText('管理员密码'), 'wrong-pw-1')
    await user.click(screen.getByRole('button', { name: '验证' }))
    expect(await find('密码错误')).toBeInTheDocument()
    await user.type(screen.getByLabelText('管理员密码'), 'harbour-pw-1')
    await user.click(screen.getByRole('button', { name: '验证' }))
    await find('当前状态')
    expect(screen.queryByText('设置管理员')).toBeNull()
    await user.click(screen.getByRole('button', { name: '配置 Wi-Fi' }))
    await find('选择网络')
    const items = screen.getAllByRole('listitem').map(li => li.textContent)
    expect(items).toEqual(['Harbourwpa2-psk · -48 dBm', 'Marina Guest开放 · -70 dBm'])
    await user.click(screen.getByRole('button', { name: /Harbour/ }))
    expect(screen.queryByText(/设备将关闭热点/)).toBeNull()
    await user.type(screen.getByLabelText('Wi-Fi 密码（开放网络留空）'), 'harbour-wifi-1')
    await user.click(screen.getByRole('button', { name: '连接' }))
    await user.click(await screen.findByRole('button', { name: '完成配网' }, { timeout: 4000 }))
    expect(await find('请确认手机已连接到 Harbour，然后打开 http://192.168.8.41（备用 http://mica-a4e2e69e.local）')).toBeInTheDocument()
    expect(screen.queryByText('设备热点的新密码')).toBeNull()
    expect(mock.commands.some(c => c.op === 'claim')).toBe(false)
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

  it('step 9: already_claimed ends the flow', async () => {
    const { user } = setup({ claimedElsewhere: true })
    await claimAndReachPassword(user)
    await enterNetwork(user, 'Harbour', 'harbour-wifi-1')
    await user.click(await screen.findByRole('button', { name: '完成配网' }, { timeout: 4000 }))
    expect(await find('设备已被其他方式认领')).toBeInTheDocument()
  })

  it('a dropped link on an unclaimed device restarts from authentication', async () => {
    const { user, mock } = setup()
    await claimAndReachPassword(user)
    await mock.close('idle')
    expect(await find(/2 分钟无操作，设备断开了蓝牙。.*暂存的管理员设置已丢弃/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重新连接' }))
    expect(await find('设置管理员')).toBeInTheDocument()
  })

  it('a cancelled chooser explains when devices are visible', async () => {
    const { user } = setup({}, 'zh', () => false)
    await user.click(screen.getByRole('button', { name: '连接设备' }))
    expect(await find(/没有选择设备/)).toBeInTheDocument()
  })

  it('speaks English', async () => {
    const { user } = setup({}, 'en')
    await user.click(screen.getByRole('button', { name: 'Connect to device' }))
    expect(await find('Set up the administrator')).toBeInTheDocument()
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
