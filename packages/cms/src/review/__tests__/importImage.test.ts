import { describe, expect, test } from 'bun:test'

import { assertPublicHost, fetchImage, isWebImage } from '../importImage'

const resolveTo = (address: string) => async () => [{ address }]

describe('isWebImage', () => {
  test('only an object with an http(s) sourceUrl', () => {
    expect(isWebImage({ sourceUrl: 'https://a.example/x.jpg', credit: 'a.example' })).toBe(true)
    expect(isWebImage({ sourceUrl: 'file:///etc/passwd' })).toBe(false)
    expect(isWebImage('https://a.example/x.jpg')).toBe(false)
    expect(isWebImage(12)).toBe(false)
  })
})

describe('assertPublicHost', () => {
  test('refuses loopback, private, link-local and non-web addresses', async () => {
    for (const url of ['http://localhost/x', 'http://127.0.0.1/x', 'http://10.1.2.3/x', 'http://192.168.0.4/x', 'http://169.254.169.254/latest', 'http://[::1]/x', 'ftp://a.example/x']) {
      await expect(assertPublicHost(new URL(url))).rejects.toThrow()
    }
    await expect(assertPublicHost(new URL('https://sneaky.example/x'), resolveTo('172.16.0.9'))).rejects.toThrow('not public')
    await expect(assertPublicHost(new URL('https://ok.example/x'), resolveTo('93.184.216.34'))).resolves.toBeUndefined()
  })
})

describe('fetchImage', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  test('downloads an image and names it from the URL', async () => {
    const fetchStub = (async () => new Response(png, { headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch
    const file = await fetchImage('https://93.184.216.34/media/Jane%20Doe.png?w=800', fetchStub)
    expect(file).toMatchObject({ mimetype: 'image/png', name: 'Jane-Doe.png' })
    expect(file.data.byteLength).toBe(8)
    const optimised = await fetchImage('https://93.184.216.34/_next/image?url=%2Fdelba.jpg&w=828', fetchStub)
    expect(optimised.name).toBe('delba.png')
  })
  test('refuses non-images and redirects into private space', async () => {
    const html = (async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch
    await expect(fetchImage('https://93.184.216.34/x', html)).rejects.toThrow('not an image')
    const redirect = (async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret.png' } })) as unknown as typeof fetch
    await expect(fetchImage('https://93.184.216.34/x', redirect)).rejects.toThrow('not public')
  })
})
