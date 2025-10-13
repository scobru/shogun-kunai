/**
 * Type definitions for Yumi and Yari
 */

export interface YumiOptions {
  seed?: string;
  announce?: string[];
  timeout?: number;
  heartbeat?: number | boolean;
  gun?: any;
  keyPair?: any;
  localStorage?: boolean;
  radisk?: boolean;
  wire?: boolean;
  axe?: boolean;
  webrtc?: boolean;
  localOnly?: boolean;
  ws?: boolean;
  rtc?: boolean;
}

export interface PeerInfo {
  pk: string;
  ek: string;
  last: number;
}

export interface MessagePacket {
  t: number;
  i: string;
  pk: string;
  ek: string;
  n: string;
  y: string;
  v?: string;
  c?: string;
  a?: string;
  rn?: any;
  rr?: string;
}

export interface SignedPacket {
  s: string;
  p: string;
}

export interface EncryptedPacket {
  n: string;
  ek: string;
  e: string;
}

export type RPCCallback = (result: any) => void;
export type APIFunction = (address: string, args: any, callback: RPCCallback) => void;

export interface SEAKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

export interface YariPeerInfo {
  pub: string;
  epub: string;
}

// Legacy aliases for backward compatibility
export type BugoutOptions = YumiOptions;
export type BugoffPeerInfo = YariPeerInfo;

export interface DecryptedMessage {
  address: string;
  pubkeys: YariPeerInfo;
  message: any;
}

