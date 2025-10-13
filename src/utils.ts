/**
 * Utility functions for BugoutGun
 */

import nacl from 'tweetnacl';

export const isNode = typeof module === 'object' && typeof module.exports === 'object';

export function now(): number {
  return Date.now();
}

export function toHex(arr: Uint8Array | Buffer): string {
  if (isNode && Buffer.isBuffer(arr)) {
    return arr.toString('hex');
  }
  return Array.from(arr, (b: number) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array | Buffer {
  if (isNode) {
    return Buffer.from(hex, 'hex');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export function toBuffer(data: any): Uint8Array | Buffer {
  if (isNode && Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return isNode ? Buffer.from(data) : data;
  if (typeof data === 'string') {
    return isNode ? Buffer.from(data) : new TextEncoder().encode(data);
  }
  return isNode ? Buffer.from(data) : new Uint8Array(data);
}

export function toString(data: Uint8Array | Buffer): string {
  if (isNode && Buffer.isBuffer(data)) {
    return data.toString();
  }
  return new TextDecoder().decode(data);
}

export function toBase64(data: Uint8Array | Buffer): string {
  if (isNode && Buffer.isBuffer(data)) {
    return data.toString('base64');
  }
  return btoa(String.fromCharCode.apply(null, Array.from(data)));
}

export function fromBase64(base64: string): Uint8Array | Buffer {
  if (isNode) {
    return Buffer.from(base64, 'base64');
  }
  const binary = atob(base64);
  return Uint8Array.from(binary, (c: string) => c.charCodeAt(0));
}

export function sha256(input: any): string {
  if (isNode) {
    const crypto = require('crypto');
    return crypto.createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
  } else {
    // Browser: simple string hash as fallback
    const str = JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

export function ripemd160Hash(data: Uint8Array | Buffer): Uint8Array | Buffer {
  if (isNode) {
    try {
      const RIPEMD160 = require('ripemd160');
      return new RIPEMD160().update(toBuffer(data)).digest();
    } catch (e) {
      // Fallback to nacl hash
      return nacl.hash(toBuffer(data)).slice(0, 20);
    }
  }
  // Browser: use first 20 bytes of hash as simplified RIPEMD160
  return nacl.hash(toBuffer(data)).slice(0, 20);
}

