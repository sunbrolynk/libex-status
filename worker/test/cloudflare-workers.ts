/// <reference types="node" />
// Stands in for the Workers runtime when the worker runs under Node in tests

// The store hex-codes with Uint8Array's toHex and fromHex, which Workers has and Node 24 lacks
const proto = Uint8Array.prototype as Uint8Array & { toHex?: () => string }
proto.toHex ??= function (this: Uint8Array) {
  return Buffer.from(this).toString('hex')
}
const U8 = Uint8Array as typeof Uint8Array & { fromHex?: (hex: string) => Uint8Array }
U8.fromHex ??= (hex: string) => new Uint8Array(Buffer.from(hex, 'hex'))

export class DurableObject {
  constructor(
    public ctx: unknown,
    public env: unknown
  ) {}
}
