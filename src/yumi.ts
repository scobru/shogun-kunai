/**
 * Yumi (弓) - Multi-party P2P channels on GunDB
 * TypeScript implementation
 * 
 * Yumi = "bow" in Japanese - launches messages across the decentralized network
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import bs58check from "bs58check";
import { EventEmitter } from "events";

// Browser-safe debug function
let debug: any;
try {
  // @ts-ignore - debug might not be available in browser
  const Debug = require('debug');
  debug = Debug("yumi");
} catch (e) {
  // Browser fallback - noop function
  debug = () => {};
}
import {
  BugoutOptions,
  PeerInfo,
  MessagePacket,
  SignedPacket,
  EncryptedPacket,
  RPCCallback,
  APIFunction,
} from "./types";
import {
  isNode,
  now,
  toHex,
  fromHex,
  toBuffer,
  toString,
  toBase64,
  fromBase64,
  ripemd160Hash,
} from "./utils";

// Import ShogunCore for Node.js, but handle browser case
let ShogunCore: any;
try {
  const shogunModule = require('shogun-core');
  ShogunCore = shogunModule.ShogunCore;
} catch (e) {
  // Browser: will use global Gun instead
  ShogunCore = null;
}

const PEERTIMEOUT = 5 * 60 * 1000;
const SEEDPREFIX = "490a";
const ADDRESSPREFIX = "55";

function hexToBytes(hex: string): Uint8Array | Buffer {
  return fromHex(hex);
}

function bs58Encode(data: Uint8Array | Buffer): string {
  return bs58.encode(toBuffer(data));
}

function bs58checkEncode(data: Uint8Array | Buffer): string {
  if (isNode) {
    return bs58check.encode(toBuffer(data));
  }
  // Browser: implement bs58check manually
  const payload = toBuffer(data);
  const checksum = nacl.hash(nacl.hash(payload)).slice(0, 4);
  const combined = new Uint8Array(payload.length + 4);
  combined.set(payload);
  combined.set(checksum, payload.length);
  return bs58.encode(combined);
}

function bs58checkDecode(string: string): Uint8Array | Buffer {
  if (isNode) {
    return bs58check.decode(string);
  }
  // Browser: implement bs58check manually
  const buffer = bs58.decode(string);
  const payload = buffer.slice(0, -4);
  const checksum = buffer.slice(-4);
  const hash = nacl.hash(nacl.hash(payload)).slice(0, 4);
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== hash[i]) throw new Error("Invalid checksum");
  }
  return payload;
}

/**
 * Yumi (弓) - Multi-party data channels on GunDB
 */
export class Yumi extends EventEmitter {
  announce: string[];
  nacl: typeof nacl;
  seed: string;
  timeout: number;
  keyPair: nacl.SignKeyPair;
  keyPairEncrypt: nacl.BoxKeyPair;
  pk: string;
  ek: string;
  identifier: string;
  peers: Record<string, PeerInfo>;
  seen: Record<string, number>;
  lastpeercount: number;
  api: Record<string, APIFunction>;
  callbacks: Record<string, RPCCallback>;
  serveraddress: string | null;
  heartbeattimer: any;
  gun: any;
  channel: any;
  messages: any;
  presence: any;
  shogun: ShogunCore;

  constructor(identifier?: string | BugoutOptions, opts?: BugoutOptions) {
    super();

    // Handle overloaded constructor
    if (identifier && typeof identifier === "object") {
      opts = identifier;
      identifier = undefined;
    }
    opts = opts || {};

    this.announce = opts.announce || [
      "http://peer.wallie.io/gun",
      "https://relay.shogun-eco.xyz/gun",
      "https://v5g5jseqhgkp43lppgregcfbvi.srv.us/gun",
      "https://gun.defucc.me/gun",
      "https://a.talkflow.team/gun",
    ];

    this.nacl = nacl;

    if (opts.seed) {
      this.seed = opts.seed;
    } else {
      this.seed = this.encodeseed(nacl.randomBytes(32));
    }

    this.timeout = opts.timeout || PEERTIMEOUT;
    const seedDecoded = bs58checkDecode(this.seed);
    const seedBytes = seedDecoded.slice(2);
    this.keyPair = opts.keyPair || nacl.sign.keyPair.fromSeed(seedBytes);
    // ephemeral encryption key only used for this session
    this.keyPairEncrypt = nacl.box.keyPair();

    this.pk = bs58Encode(this.keyPair.publicKey);
    this.ek = bs58Encode(this.keyPairEncrypt.publicKey);

    this.identifier = (identifier as string) || this.address();
    this.peers = {};
    this.seen = {};
    this.lastpeercount = 0;

    // rpc api functions and pending callback functions
    this.api = {};
    this.callbacks = {};
    this.serveraddress = null;
    this.heartbeattimer = null;

    debug("address", this.address());
    debug("identifier", this.identifier);
    debug("public key", this.pk);
    debug("encryption key", this.ek);

    // Initialize Gun based on environment
    if (opts.gun) {
      // Use provided Gun instance
      this.gun = opts.gun;
      this.shogun = null as any;
    } else if (typeof window !== 'undefined' && (window as any).Gun) {
      // Browser: use global Gun
      const GunGlobal = (window as any).Gun;
      this.gun = GunGlobal({
        peers: this.announce,
        localStorage: opts.localStorage !== undefined ? opts.localStorage : false,
        radisk: opts.radisk !== undefined ? opts.radisk : true,
      });
      this.shogun = null as any;
    } else if (ShogunCore) {
      // Node.js: use ShogunCore
      const config = {
        gunOptions: {
          peers: this.announce,
          localStorage: opts.localStorage !== undefined ? opts.localStorage : false,
          radisk: opts.radisk !== undefined ? opts.radisk : true,
          wire: opts.wire !== undefined ? opts.wire : true,
          axe: opts.axe !== undefined ? opts.axe : true,
          webrtc: opts.webrtc !== undefined ? opts.webrtc : true,
        },
        disableAutoRecall: true,
        silent: true,
      };
      this.shogun = new ShogunCore(config);
      this.gun = this.shogun.gun;
    } else {
      throw new Error('No Gun instance available. Provide gun option or ensure Gun is loaded.');
    }

    // Create channel for this identifier
    this.channel = this.gun.get("bugout-" + this.identifier);
    this.messages = this.channel.get("messages");
    this.presence = this.channel.get("presence");

    // Setup message listener
    this._setupMessageListener();

    // Setup presence/peer discovery
    this._setupPresence();

    // Announce ourselves
    setTimeout(() => {
      this._announcePresence();
      this.emit("ready");
    }, 100);

    if (opts.heartbeat) {
      this.heartbeat(opts.heartbeat as number);
    }
  }

  _setupMessageListener(): void {
    const self = this;

    // Listen for new messages
    this.messages.map().on((data: any, key: string) => {
      if (data && data.m && data.t) {
        // Reconstruct message buffer
        const message = fromBase64(data.m);

        // Process message
        setTimeout(() => {
          onMessage(self, self.identifier, message);
        }, 0);
      }
    });
  }

  _setupPresence(): void {
    const self = this;

    // Listen for peer presence announcements
    this.presence.map().on((data: any, key: string) => {
      if (data && data.pk && data.ek && data.t) {
        const pk = data.pk;
        const ek = data.ek;
        const address = self.address(pk);

        // Don't track ourselves
        if (address !== self.address()) {
          const t = now();
          const wasNew = !self.peers[address];

          self.peers[address] = {
            pk: pk,
            ek: ek,
            last: t,
          };

          if (wasNew) {
            debug("peer joined", address);
            self.emit("seen", address);
            self._updateConnections();
          }
        }
      }
    });
  }

  _announcePresence(): void {
    const presenceData = {
      pk: this.pk,
      ek: this.ek,
      t: now(),
    };

    // Use our address as the key for our presence
    this.presence.get(this.address()).put(presenceData);
    debug("announced presence", this.address());
  }

  _updateConnections(): void {
    const peerCount = Object.keys(this.peers).length;
    if (peerCount !== this.lastpeercount) {
      this.lastpeercount = peerCount;
      this.emit("connections", peerCount);
    }
  }

  encodeseed(material: Uint8Array): string {
    const prefix = hexToBytes(SEEDPREFIX);
    const combined = new Uint8Array(prefix.length + material.length);
    combined.set(prefix);
    combined.set(material, prefix.length);
    return bs58checkEncode(combined);
  }

  encodeaddress(material: Uint8Array | Buffer): string {
    const hash = nacl.hash(toBuffer(material));
    const ripemd = ripemd160Hash(hash);
    const prefix = hexToBytes(ADDRESSPREFIX);
    const combined = new Uint8Array(prefix.length + ripemd.length);
    combined.set(prefix);
    combined.set(ripemd as Uint8Array, prefix.length);
    return bs58checkEncode(combined);
  }

  heartbeat(interval?: number): void {
    interval = interval || 30000;
    this.heartbeattimer = setInterval(() => {
      // re-announce our presence
      this._announcePresence();

      // broadcast a 'ping' message
      this.ping();

      const t = now();
      // remove any 'peers' entries with timestamps older than timeout
      for (const p in this.peers) {
        const address = p;
        const last = this.peers[p].last;
        if (last + this.timeout < t) {
          delete this.peers[p];
          this.emit("timeout", address);
          this.emit("left", address);
        }
      }
      this._updateConnections();
    }, interval);
  }

  destroy(cb?: () => void): void {
    clearInterval(this.heartbeattimer);

    // Send leave message
    const packet = makePacket(this, { y: "x" });
    sendRaw(this, packet);

    // Clean up Gun subscriptions
    if (this.messages && this.messages.off) {
      this.messages.off();
    }
    if (this.presence && this.presence.off) {
      this.presence.off();
    }

    if (cb) cb();
  }

  close(cb?: () => void): void {
    this.destroy(cb);
  }

  connections(): number {
    return Object.keys(this.peers).length;
  }

  address(pk?: string | Uint8Array): string {
    if (pk && typeof pk === "string" && pk.length > 40) {
      // Already a base58 encoded key
      try {
        pk = bs58.decode(pk);
      } catch (e) {
        // If decode fails, assume it's already decoded or invalid
      }
    } else if (!pk) {
      pk = this.keyPair.publicKey;
    }
    return this.encodeaddress(pk as Uint8Array);
  }

  ping(): void {
    // send a ping out so they know about us too
    const packet = makePacket(this, { y: "p" });
    sendRaw(this, packet);
  }

  send(address?: string | any, message?: any): void {
    if (!message) {
      message = address;
      address = null;
    }
    const packet = makePacket(this, { y: "m", v: JSON.stringify(message) });
    if (address) {
      if (this.peers[address]) {
        const encryptedPacket = encryptPacket(
          this,
          this.peers[address].pk,
          packet
        );
        sendRaw(this, encryptedPacket);
      } else {
        throw new Error(address + " not seen - no public key.");
      }
    } else {
      sendRaw(this, packet);
    }
  }

  register(call: string, fn: APIFunction, docstring?: string): void {
    this.api[call] = fn;
    (this.api[call] as any).docstring = docstring;
  }

  rpc(
    address: string,
    call: string | any,
    args?: any,
    callback?: RPCCallback
  ): void {
    // Handle overloaded signatures
    if (this.serveraddress && typeof args === "function") {
      callback = args;
      args = call;
      call = address;
      address = this.serveraddress;
    }
    if (this.peers[address]) {
      const pk = this.peers[address].pk;
      const callnonce = nacl.randomBytes(8);
      this.callbacks[toHex(callnonce)] = callback!;
      makeEncryptSendPacket(this, pk, {
        y: "r",
        c: call,
        a: JSON.stringify(args),
        rn: callnonce,
      });
    } else {
      throw new Error(address + " not seen - no public key.");
    }
  }

  static encodeseed = Yumi.prototype.encodeseed;
  static encodeaddress = Yumi.prototype.encodeaddress;
}

// Helper functions

function makePacket(bugout: Yumi, params: Partial<MessagePacket>): string {
  const p: any = {
    t: now(),
    i: bugout.identifier,
    pk: bugout.pk,
    ek: bugout.ek,
    n: toHex(nacl.randomBytes(8)),
    ...params,
  };
  const pe = JSON.stringify(p);
  const peBytes = toBuffer(pe);
  const signature = nacl.sign.detached(peBytes, bugout.keyPair.secretKey);

  const signedPacket: SignedPacket = {
    s: toHex(signature),
    p: pe,
  };
  
  return JSON.stringify(signedPacket);
}

function encryptPacket(bugout: Yumi, pk: string, packet: string): string {
  const address = bugout.address(pk);
  if (bugout.peers[address]) {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ekBytes = bs58.decode(bugout.peers[address].ek);
    const packetBytes = toBuffer(packet);
    const encrypted = nacl.box(
      packetBytes,
      nonce,
      ekBytes,
      bugout.keyPairEncrypt.secretKey
    );

    const encryptedPacket: EncryptedPacket = {
      n: toHex(nonce),
      ek: bugout.ek,
      e: toHex(encrypted),
    };
    
    return JSON.stringify(encryptedPacket);
  } else {
    throw new Error(bugout.address(pk) + " not seen - no encryption key.");
  }
}

function sendRaw(bugout: Yumi, message: string): void {
  // Convert message to base64 for Gun storage
  const messageBuffer = toBuffer(message);
  const messageData = {
    m: toBase64(messageBuffer),
    t: now(),
    k: toHex(nacl.hash(messageBuffer).slice(16)), // message hash as key
  };

  // Store message in Gun
  const hash = messageData.k;
  bugout.messages.get(hash).put(messageData);

  // Mark as seen
  bugout.seen[hash] = now();

  debug("sent", hash);
}

function makeEncryptSendPacket(
  bugout: Yumi,
  pk: string,
  params: any
): void {
  const packet = makePacket(bugout, params);
  const encrypted = encryptPacket(bugout, pk, packet);
  sendRaw(bugout, encrypted);
}

function onMessage(
  bugout: Yumi,
  identifier: string,
  message: Uint8Array | Buffer
): void {
  // hash to reference incoming message
  const hash = toHex(nacl.hash(message).slice(16));
  const t = now();
  debug("raw message", identifier, message.length, hash);

  if (bugout.seen[hash]) {
    debug("already seen", hash);
    return;
  }

  bugout.seen[hash] = t;

  try {
    const messageString = toString(message);
    let unpacked: SignedPacket | EncryptedPacket | null = JSON.parse(messageString);

    // if this is an encrypted packet first try to decrypt it
    if (unpacked && 'e' in unpacked && 'n' in unpacked && 'ek' in unpacked) {
      // Type narrowing: unpacked is EncryptedPacket
      const encryptedPkt = unpacked as EncryptedPacket;
      const ek = encryptedPkt.ek;
      debug("message encrypted by", ek);
      const ekBytes = bs58.decode(ek);
      const nonceBytes = fromHex(encryptedPkt.n);
      const encryptedBytes = fromHex(encryptedPkt.e);

      const decrypted = nacl.box.open(
        encryptedBytes,
        nonceBytes,
        ekBytes,
        bugout.keyPairEncrypt.secretKey
      );
      if (decrypted) {
        const decryptedString = toString(decrypted);
        unpacked = JSON.parse(decryptedString) as SignedPacket;
      } else {
        unpacked = null;
      }
    }

    // if there's no data decryption failed
    if (unpacked && 'p' in unpacked) {
      // Type narrowing: unpacked is SignedPacket
      const signedPkt = unpacked as SignedPacket;
      debug("unpacked message", signedPkt);
      const packet = JSON.parse(signedPkt.p);
      const pk = packet.pk;
      const id = packet.i;

      // Verify signature
      const sigBytes = fromHex(signedPkt.s);
      const pkBytes = bs58.decode(pk);
      const peBytes = toBuffer(signedPkt.p);
      const checksig = nacl.sign.detached.verify(peBytes, sigBytes, pkBytes);
      const checkid = id === identifier;
      const checktime = packet.t + bugout.timeout > t;

      debug(
        "packet",
        packet,
        "checksig:",
        checksig,
        "checkid:",
        checkid,
        "checktime:",
        checktime
      );

      if (checksig && checkid && checktime) {
        // message is authenticated
        const ek = packet.ek;
        sawPeer(bugout, pk, ek, identifier);

        // check packet types
        if (packet.y === "m") {
          debug("message", identifier, packet);
          const messagestring = packet.v;
          let messagejson = null;
          try {
            messagejson = JSON.parse(messagestring);
          } catch (e) {
            debug("Malformed message JSON: " + messagestring);
          }
          if (messagejson) {
            bugout.emit("message", bugout.address(pk), messagejson, packet);
          }
        } else if (packet.y === "r") {
          // rpc call
          debug("rpc", identifier, packet);
          const call = packet.c;
          const argsstring = packet.a || "null";
          let args = null;
          try {
            args = JSON.parse(argsstring);
          } catch (e) {
            debug("Malformed args JSON: " + argsstring);
          }
          const nonce = packet.rn;
          bugout.emit("rpc", bugout.address(pk), call, args, nonce);
          // make the API call and send back response
          rpcCall(bugout, pk, call, args, nonce);
        } else if (packet.y === "rr") {
          // rpc response
          const nonce = packet.rn;
          if (bugout.callbacks[nonce]) {
            const responsestring = packet.rr || "null";
            let responsestringstruct = null;
            try {
              responsestringstruct = JSON.parse(responsestring);
            } catch (e) {
              debug("Malformed response JSON: " + responsestring);
            }
            if (bugout.callbacks[nonce] && responsestringstruct) {
              debug(
                "rpc-response",
                bugout.address(pk),
                nonce,
                responsestringstruct
              );
              bugout.emit(
                "rpc-response",
                bugout.address(pk),
                nonce,
                responsestringstruct
              );
              bugout.callbacks[nonce](responsestringstruct);
              delete bugout.callbacks[nonce];
            } else {
              debug("RPC response nonce not known:", nonce);
            }
          } else {
            debug("dropped response with no callback.", nonce);
          }
        } else if (packet.y === "p") {
          const address = bugout.address(pk);
          debug("ping from", address);
          bugout.emit("ping", address);
        } else if (packet.y === "x") {
          const address = bugout.address(pk);
          debug("got left from", address);
          delete bugout.peers[address];
          bugout.emit("left", address);
        } else {
          debug("unknown packet type");
        }
      } else {
        debug("dropping bad packet", hash, checksig, checkid, checktime);
      }
    } else {
      debug("skipping packet with no payload", hash);
    }
  } catch (e) {
    debug("error processing message", e);
  }
}

function rpcCall(
  bugout: Yumi,
  pk: string,
  call: string,
  args: any,
  nonce: any
): void {
  const packet: any = { y: "rr", rn: nonce };
  if (bugout.api[call]) {
    bugout.api[call](bugout.address(pk), args, (result: any) => {
      packet["rr"] = JSON.stringify(result);
      makeEncryptSendPacket(bugout, pk, packet);
    });
  } else {
    packet["rr"] = JSON.stringify({ error: "No such API call." });
    makeEncryptSendPacket(bugout, pk, packet);
  }
}

function sawPeer(
  bugout: Yumi,
  pk: string,
  ek: string,
  identifier: string
): void {
  debug("sawPeer", bugout.address(pk), ek);
  const t = now();
  const address = bugout.address(pk);

  // ignore ourself
  if (address !== bugout.address()) {
    // if we haven't seen this peer for a while
    if (
      !bugout.peers[address] ||
      bugout.peers[address].last + bugout.timeout < t
    ) {
      bugout.peers[address] = {
        ek: ek,
        pk: pk,
        last: t,
      };
      debug("seen", bugout.address(pk));
      bugout.emit("seen", bugout.address(pk));

      if (bugout.address(pk) === bugout.identifier) {
        bugout.serveraddress = address;
        debug("seen server", bugout.address(pk));
        bugout.emit("server", bugout.address(pk));
      }

      bugout._updateConnections();
    } else {
      bugout.peers[address].ek = ek;
      bugout.peers[address].last = t;
    }
  }
}

export default Yumi;

// Legacy aliases for backward compatibility
export { Yumi as BugoutGun };
