// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fromHex, toBase64, toBigInt, toHex, utf8 } from './bytes'
import { ConfirmationError, ID_PROVER, ID_VERIFIER, pbkdfInput, RecordCipher, spakeExchange, spakeProver, spakeScalars, spakeSecret, x25519Start } from './crypto'
import { fragment, Reassembler } from './fragments'

const big = (hex: string) => toBigInt(fromHex(hex))

describe('sPAKE2+ against RFC 9383 Appendix C (P256-SHA256-HKDF-SHA256-HMAC-SHA256)', () => {
  it('reproduces every Prover value', async () => {
    const prover = spakeProver({
      context: 'SPAKE2+-P256-SHA256-HKDF-SHA256-HMAC-SHA256 Test Vectors',
      idProver: 'client',
      idVerifier: 'server',
      w0: big('bb8e1bbcf3c48f62c08db243652ae55d3e5586053fca77102994f23ad95491b3'),
      w1: big('7e945f34d78785b8a3ef44d0df5a1a97d6b3b460409a345ca7830387a74b1dba'),
      x: big('d1232c8e8693d02368976c174e2088851b8365d0d79a9eee709c6a05a2fad539'),
    })
    expect(toHex(prover.shareP)).toBe('04ef3bd051bf78a2234ec0df197f7828060fe9856503579bb1733009042c15c0c1de127727f418b5966afadfdd95a6e4591d171056b333dab97a79c7193e341727')
    const t = await prover.transcript(fromHex('04c0f65da0d11927bdf5d560c69e1d7d939a05b0e88291887d679fcadea75810fb5cc1ca7494db39e82ff2f50665255d76173e09986ab46742c798a9a68437b048'))
    expect(toHex(t.Z)).toBe('04bbfce7dd7f277819c8da21544afb7964705569bdf12fb92aa388059408d50091a0c5f1d3127f56813b5337f9e4e67e2ca633117a4fbd559946ab474356c41839')
    expect(toHex(t.V)).toBe('0458bf27c6bca011c9ce1930e8984a797a3419797b936629a5a937cf2f11c8b9514b82b993da8a46e664f23db7c01edc87faa530db01c2ee405230b18997f16b68')
    expect(toHex(t.Kmain)).toBe('4c59e1ccf2cfb961aa31bd9434478a1089b56cd11542f53d3576fb6c2a438a29')
    expect(toHex(t.KconfirmP)).toBe('871ae3f7b78445e34438fb284504240239031c39d80ac23eb5ab9be5ad6db58a')
    expect(toHex(t.KconfirmV)).toBe('ccd53c7c1fa37b64a462b40db8be101cedcf838950162902054e644b400f1680')
    expect(toHex(t.confirmP)).toBe('926cc713504b9b4d76c9162ded04b5493e89109f6d89462cd33adc46fda27527')
    expect(toHex(t.confirmV)).toBe('9747bcc4f8fe9f63defee53ac9b07876d907d55047e6ff2def2e7529089d3e68')
    expect(toHex(t.Kshared)).toBe('0c5f8ccd1413423a54f6c1fb26ff01534a87f893779c6e68666d772bfd91f3e7')
  })

  it('refuses a share that is not a P-256 point', async () => {
    const prover = spakeProver({ context: 'c', idProver: 'a', idVerifier: 'b', w0: 5n, w1: 7n, x: 11n })
    const bad = new Uint8Array(65)
    bad[0] = 4
    await expect(prover.transcript(bad)).rejects.toThrow()
    await expect(prover.transcript(prover.shareP.subarray(0, 33))).rejects.toThrow()
  })
})

// mica-core:docs/ble-provisioning.md, "Test vectors" (protocol 1).
const SPAKE_VECTORS = {
  'password': {
    pw: 'harbour-pw-1',
    salt: '000102030405060708090a0b0c0d0e0f',
    input: '0c00000000000000686172626f75722d70772d3117000000000000006d6963612d70726f766973696f6e696e672070686f6e6518000000000000006d6963612d70726f766973696f6e696e6720646576696365',
    w0: '947235c6a07ca203da652ef5f3654578849ab4e5f1ae01698be30fae331fc46f',
    w1: '9977060784f931e0805507725efa9e5d1e5fd6bb8dc8e37e70ef687788d5b2fd',
    x: '50ec4dec9740817c464fbd565f6a4ce13d6759645b17410600f88cb76b015cde',
    shareP: '04af6f17b97250531ab4e9667201b97c0781c6c7202576c5d774448f5bf52be47ff2839b992774593ec43b4ef43535e79a029e9597a3b05c23244de683ea2a085d',
    shareV: '04e0f08c16f158714530c1ff822a6b6c2c46a608c58ba1c616a2d42994a9cbdae2199796a5269bfc0922512c25aac4a0063a117f657b7d0dccc4fb5aaabefc3c79',
    Z: '04eacd194cd154026f0ee0bfa29c9f1507a16e2b64b16e8c38c2d939070994392058079d5a0812f96341387e72def06adbe618b6ff801dff32c0cd44578f55cbd1',
    V: '0407d56c28093d9d584d43c164b45e865da99d25d8ba5dc4dae8e95304be506180d6812c78d572b7e8c23e7658d63d857a85d5162c6abf0fc256f6cb03e1fdf11a',
    Kmain: '3251ce103117be1b45bf068549eb845cbc082fd374cc13fd9a791b412caf4a7f',
    confirmV: 'f13f912ed43d74d959acfda95a39fa255235fadaa444b6005a50db4f06c9e6ef',
    confirmP: '920c9a30aacc3a02db9a39841a9d5fcca698c5e0c8b524e2417c94cf05f8ea5c',
    Kshared: '96ea68a8bb6ab8b4ee86510720d8376153ef50292978fcd0d6f6c1765c187adb',
    TT: '1c000000000000006d6963612d70726f766973696f6e696e672f312070617373776f726417000000000000006d6963612d70726f766973696f6e696e672070686f6e6518000000000000006d6963612d70726f766973696f6e696e6720646576696365410000000000000004886e2f97ace46e55ba9dd7242579f2993b64e16ef3dcab95afd497333d8fa12f5ff355163e43ce224e0b0e65ff02ac8e5c7be09419c785e0ca547d55a12e2d20410000000000000004d8bbd6c639c62937b04d997f38c3770719c629d7014d49a24b4f98baa1292b4907d60aa6bfade45008a636337f5168c64d9bd36034808cd564490b1e656edbe7410000000000000004af6f17b97250531ab4e9667201b97c0781c6c7202576c5d774448f5bf52be47ff2839b992774593ec43b4ef43535e79a029e9597a3b05c23244de683ea2a085d410000000000000004e0f08c16f158714530c1ff822a6b6c2c46a608c58ba1c616a2d42994a9cbdae2199796a5269bfc0922512c25aac4a0063a117f657b7d0dccc4fb5aaabefc3c79410000000000000004eacd194cd154026f0ee0bfa29c9f1507a16e2b64b16e8c38c2d939070994392058079d5a0812f96341387e72def06adbe618b6ff801dff32c0cd44578f55cbd141000000000000000407d56c28093d9d584d43c164b45e865da99d25d8ba5dc4dae8e95304be506180d6812c78d572b7e8c23e7658d63d857a85d5162c6abf0fc256f6cb03e1fdf11a2000000000000000947235c6a07ca203da652ef5f3654578849ab4e5f1ae01698be30fae331fc46f',
    kPhoneToDevice: 'bd808aa6a273ae78a8fb53434d5cf43320d2b9f3a34edb6de4afd62d243747f6',
    kDeviceToPhone: '794e4eceb4a026ee4ac2b6441dda6895ace89e4d7e4f34052daf56fca4e0773c',
    shareMessage: '{"t":"share","shareP":"BK9vF7lyUFMatOlmcgG5fAeBxscgJXbF13REj1v1K+R/8oObmSd0WT7EO070NTXnmgKelZejsFwjJE3mg+oqCF0="}',
    confirmMessage: '{"t":"confirm","confirmP":"kgyaMKrMOgLbmjmEGp1fzKaYxeDItSTiQXyUzwX46lw="}',
  },
  'temp-code': {
    pw: '40718263',
    salt: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
    input: '0800000000000000343037313832363317000000000000006d6963612d70726f766973696f6e696e672070686f6e6518000000000000006d6963612d70726f766973696f6e696e6720646576696365',
    w0: '1b91176fc9da89e1238ccc240b5a22c55fc6410f398b0f3381f75658dc2df0cf',
    w1: '41e4920f9b751cd92cf8ec0825b96cfe2687b77b0db966f149c21bec7e8dfd52',
    x: 'dc299dff456bea2a25517e4eda26c6352c886a4c04ac502e847fb636e1a6a16d',
    shareP: '04f62312658aabab90930d2008392075f21ed191aadec00ee3d6eba55f6bb4c40a676db2d178f81799ed7032d608103ea0fc50076af603e196ee508e13b11722bc',
    shareV: '049416ad76ad99039d5a9096f8c3ce645b4ed308f40f063214f7381bb2f83d1d43ab8381df8488828feb60c71e60a04f4d3a29cc997e9909b7424fc467ac157aef',
    Z: '04911bc2c8c7af85dc23e55b4154d62ec33be965fba6baa41172e80c0033d4b01642dcfbf9962b7b8c88b858d5e14abab65b723ec3b1ca61d4224bdc068c89bae8',
    V: '04b1846a1dcaa80eef5c5851e0aa5b4923969dd76ad7070440450f52bafd3ce20dc14262d62693ac7ee0a674e5b725d51d69ff3e619f8b78ea27b547dfb54cba69',
    Kmain: 'b248f86fb4ed954d6944c67d337cc7c06145940d896a4e2ff4f878c762ede910',
    confirmV: '7b4db62eedf3261819e6585f8b9332d1858e4f2aff720b7d9e4208b55058f91c',
    confirmP: '29582fa90d5017750f2b65b0d9c0386eaf85de569a59cdbb97ba24c451ffde9d',
    Kshared: 'b767cd082d4c292f152b856efab81d1ec90d3be4e3fe5edc53695753e214d86e',
    TT: '1d000000000000006d6963612d70726f766973696f6e696e672f312074656d702d636f646517000000000000006d6963612d70726f766973696f6e696e672070686f6e6518000000000000006d6963612d70726f766973696f6e696e6720646576696365410000000000000004886e2f97ace46e55ba9dd7242579f2993b64e16ef3dcab95afd497333d8fa12f5ff355163e43ce224e0b0e65ff02ac8e5c7be09419c785e0ca547d55a12e2d20410000000000000004d8bbd6c639c62937b04d997f38c3770719c629d7014d49a24b4f98baa1292b4907d60aa6bfade45008a636337f5168c64d9bd36034808cd564490b1e656edbe7410000000000000004f62312658aabab90930d2008392075f21ed191aadec00ee3d6eba55f6bb4c40a676db2d178f81799ed7032d608103ea0fc50076af603e196ee508e13b11722bc4100000000000000049416ad76ad99039d5a9096f8c3ce645b4ed308f40f063214f7381bb2f83d1d43ab8381df8488828feb60c71e60a04f4d3a29cc997e9909b7424fc467ac157aef410000000000000004911bc2c8c7af85dc23e55b4154d62ec33be965fba6baa41172e80c0033d4b01642dcfbf9962b7b8c88b858d5e14abab65b723ec3b1ca61d4224bdc068c89bae8410000000000000004b1846a1dcaa80eef5c5851e0aa5b4923969dd76ad7070440450f52bafd3ce20dc14262d62693ac7ee0a674e5b725d51d69ff3e619f8b78ea27b547dfb54cba6920000000000000001b91176fc9da89e1238ccc240b5a22c55fc6410f398b0f3381f75658dc2df0cf',
    kPhoneToDevice: '6306c5ec03561990cfc20c5fe35f58fc5989cc2e6f0d7c832e389b14fa4ff9c8',
    kDeviceToPhone: 'c4ebe7b4f1cc19323117793857779e4ed38319a58c46b6715b960b9cb265e5a6',
    shareMessage: '{"t":"share","shareP":"BPYjEmWKq6uQkw0gCDkgdfIe0ZGq3sAO49brpV9rtMQKZ22y0Xj4F5ntcDLWCBA+oPxQB2r2A+GW7lCOE7EXIrw="}',
    confirmMessage: '{"t":"confirm","confirmP":"KVgvqQ1QF3UPK2Ww2cA4bq+F3laaWc27l7okxFH/3p0="}',
  },
} as const

describe.each(Object.entries(SPAKE_VECTORS))('protocol 1 vector, auth %s', (mode, v) => {
  const m = mode as 'password' | 'temp-code'

  it('derives the PBKDF2 input, w0 and w1', async () => {
    expect(toHex(pbkdfInput(v.pw))).toBe(v.input)
    const { w0, w1 } = await spakeScalars(v.pw, fromHex(v.salt), 600000)
    expect(w0).toBe(big(v.w0))
    expect(w1).toBe(big(v.w1))
  })

  it('runs the Prover to the vector\'s transcript', async () => {
    const prover = spakeProver({ context: `mica-provisioning/1 ${m}`, idProver: ID_PROVER, idVerifier: ID_VERIFIER, w0: big(v.w0), w1: big(v.w1), x: big(v.x) })
    expect(toHex(prover.shareP)).toBe(v.shareP)
    const t = await prover.transcript(fromHex(v.shareV))
    for (const k of ['Z', 'V', 'TT', 'Kmain', 'confirmV', 'confirmP', 'Kshared'] as const)
      expect(toHex(t[k]), k).toBe(v[k])
  })

  it('makes the vector\'s session messages and keys', async () => {
    let sent = ''
    const out = await spakeExchange(m, v.pw, fromHex(v.salt), 600000, async (shareP) => {
      sent = JSON.stringify({ t: 'share', shareP: toBase64(shareP) })
      return { shareV: fromHex(v.shareV), confirmV: fromHex(v.confirmV) }
    }, big(v.x))
    expect(sent).toBe(v.shareMessage)
    expect(JSON.stringify({ t: 'confirm', confirmP: toBase64(out.confirmP) })).toBe(v.confirmMessage)
    const keys = await out.keys()
    expect(toHex(keys.phoneToDevice)).toBe(v.kPhoneToDevice)
    expect(toHex(keys.deviceToPhone)).toBe(v.kDeviceToPhone)
  })
})

describe('sPAKE2+ exchange', () => {
  it('stops on a confirmV that does not match', async () => {
    const v = SPAKE_VECTORS.password
    const bad = fromHex(v.confirmV)
    bad[0] ^= 1
    await expect(spakeExchange('password', v.pw, fromHex(v.salt), 600000, async () => ({ shareV: fromHex(v.shareV), confirmV: bad }), big(v.x)))
      .rejects
      .toBeInstanceOf(ConfirmationError)
  })

  it('refuses iteration counts outside 10000..10000000', async () => {
    const never = async () => {
      throw new Error('sent a share')
    }
    await expect(spakeExchange('password', 'x', new Uint8Array(16), 9999, never)).rejects.toThrow(/9999/)
    await expect(spakeExchange('password', 'x', new Uint8Array(16), 10000001, never)).rejects.toThrow(/10000001/)
  })

  it('takes a temp-code without spaces and dashes, and a password as typed', () => {
    expect(spakeSecret('temp-code', '4071 8263')).toBe('40718263')
    expect(spakeSecret('temp-code', '4071-8263')).toBe('40718263')
    expect(spakeSecret('password', ' pass word ')).toBe(' pass word ')
  })
})

describe('auth none (X25519), the protocol 1 vector', () => {
  it('derives the vector\'s public key and session keys', async () => {
    const x = x25519Start(fromHex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a'))
    expect(toHex(x.pub)).toBe('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a')
    expect(JSON.stringify({ t: 'start', auth: 'none', pub: toBase64(x.pub) })).toBe('{"t":"start","auth":"none","pub":"hSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo="}')
    const keys = await x.finish(fromHex('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f'))
    expect(toHex(keys.phoneToDevice)).toBe('6adbb833f44b333ea6f2b1a438110f6f65af3176a3769bf3d0c77d04166ed39b')
    expect(toHex(keys.deviceToPhone)).toBe('3f0fec7695564ebbc285bd66124daf461b74a1136fc4e67eb98d086140285f8c')
  })

  it('refuses an all-zero shared secret', async () => {
    await expect(x25519Start().finish(new Uint8Array(32))).rejects.toThrow()
  })
})

describe('records, the protocol 1 vector', () => {
  const kPhoneToDevice = fromHex(SPAKE_VECTORS.password.kPhoneToDevice)
  const kDeviceToPhone = fromHex(SPAKE_VECTORS.password.kDeviceToPhone)
  const record1 = 'a9b30b71223021559fb962ba91e96de295db688d93a2a506effcd08978e73840643c7973b4ed164e8d'

  it('seals commands with counters 0 and 1', async () => {
    const c = await RecordCipher.create(kPhoneToDevice)
    expect(toHex(await c.seal(utf8('{"id":1,"op":"getStatus"}')))).toBe(record1)
    expect(toHex(await c.seal(utf8('{"id":2,"op":"scanWifi"}')))).toBe('2587a01eef7e85a702b0c774d68abd435dcec37814e9c80ce74a5b30023adce54fbe34bb23c755c2')
  })

  it('opens the event record, and refuses it under the wrong counter', async () => {
    const event = fromHex('dae2e332138cc8c0b253e5c0718ce3cf6387f53731b49b2105dff0ea4e074019966babd560829e8f74ccff39310ea6fc57841635a5f3f7bd29df8f84794ca4cad0f320bdfd5e023e659406893a6fcc5386a0fcb6cbbf890254a11aef28bccb2520')
    const o = await RecordCipher.create(kDeviceToPhone)
    expect(new TextDecoder().decode(await o.open(event))).toBe('{"id":1,"event":"status","wifiMode":"ap","connected":false,"ssid":null,"ip":null}')
    await expect(o.open(event)).rejects.toThrow()
  })

  it('splits the first command record into the vector\'s 20-byte fragments', () => {
    const frags = fragment(fromHex(record1), 20).map(toHex)
    expect(frags).toEqual([
      '000000a9b30b71223021559fb962ba91e96de295',
      '000100db688d93a2a506effcd08978e73840643c',
      '0002017973b4ed164e8d',
    ])
    const r = new Reassembler()
    expect(r.push(fromHex(frags[0]))).toBeNull()
    expect(r.push(fromHex(frags[1]))).toBeNull()
    expect(toHex(r.push(fromHex(frags[2]))!)).toBe(record1)
  })
})

describe('fragments', () => {
  it('sends a short message as one fragment with header 0000 01', () => {
    expect(fragment(utf8('{}'), 182).map(toHex)).toEqual(['0000017b7d'])
    expect(fragment(new Uint8Array(0), 20).map(toHex)).toEqual(['000001'])
  })

  it('fills each fragment to the write size', () => {
    const msg = new Uint8Array(400).fill(7)
    const frags = fragment(msg, 182)
    expect(frags.map(f => f.length)).toEqual([182, 182, 45])
    expect(frags.map(f => f[2])).toEqual([0, 0, 1])
    expect(frags.map(f => (f[0] << 8) | f[1])).toEqual([0, 1, 2])
  })

  it('refuses out-of-order, malformed and oversized streams, then starts afresh', () => {
    const r = new Reassembler()
    expect(() => r.push(fromHex('000100aa'))).toThrow(/out of order/)
    expect(() => r.push(fromHex('000003aa'))).toThrow(/malformed/)
    expect(() => r.push(fromHex('0000'))).toThrow(/malformed/)
    expect(() => fragment(new Uint8Array(16385), 512)).toThrow(/too long/)
    expect(() => {
      for (let seq = 0; seq < 40; seq++) {
        const f = new Uint8Array(512)
        f[0] = seq >> 8
        f[1] = seq & 255
        r.push(f)
      }
    }).toThrow(/too long/)
    expect(toHex(r.push(fromHex('0000017b7d'))!)).toBe('7b7d')
  })
})
