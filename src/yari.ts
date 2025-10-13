/**
 * Yari (槍) - Encrypted P2P messaging with Gun SEA
 * TypeScript implementation
 * 
 * Yari = "spear" in Japanese - direct, precise, and protected messaging
 * Wrapper around Yumi that adds automatic end-to-end encryption
 * using Gun's SEA (Security, Encryption, Authorization) via Shogun Core.
 */

import { Yumi } from './yumi.js';
import { YumiOptions, SEAKeyPair, YariPeerInfo, DecryptedMessage } from './types.js';
import { sha256 } from './utils.js';
import { EventEmitter } from 'events';
import { SEA as SHOGUN_SEA } from 'shogun-core';

/**
 * Yari (槍) - Encrypted P2P messaging
 */
export class Yari {
  events: EventEmitter;
  ID: string;
  identifier: string;
  opts: YumiOptions;
  yumi: Yumi;
  address: string;
  peers: Record<string, YariPeerInfo>;
  sea: SEAKeyPair | null;
  
  // Message deduplication
  private processedMessages: Set<string> = new Set();
  
  // Cleanup timer
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Bound methods from Yumi
  on: Yumi['on'];
  register: Yumi['register'];
  rpc: Yumi['rpc'];
  heartbeat: Yumi['heartbeat'];

  constructor(identifier: string, opts?: YumiOptions) {
    this.events = new EventEmitter();
    this.ID = sha256(identifier);
    this.identifier = this.ID;
    this.opts = opts || {};

    // Initialize Yumi
    this.yumi = new Yumi(identifier, opts);
    this.address = this.yumi.address();
    this.peers = {};
    this.sea = null;

    // Bind Yumi methods
    this.on = this.yumi.on.bind(this.yumi);
    this.register = this.yumi.register.bind(this.yumi);
    this.rpc = this.yumi.rpc.bind(this.yumi);
    this.heartbeat = this.yumi.heartbeat.bind(this.yumi);

    // Internal: handle encoded messages
    this.events.on('encoded', (encrypted: [string, any]) => {
      if (Array.isArray(encrypted) && encrypted.length === 2) {
        // Direct message: [address, encrypted_data]
        this.yumi.send(encrypted[0], encrypted[1]);
      } else {
        console.warn('Invalid encrypted format:', encrypted);
      }
    });

    // Internal: decrypt incoming messages and emit 'decrypted'
    this.yumi.on('message', async (address: string, message: any, msgId?: string) => {
      // Generate message ID if not provided
      const messageId = msgId || `${Date.now()}-${address}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Check for duplicate messages
      if (this.processedMessages.has(messageId)) {
        console.log('🔄 Duplicate message ignored:', messageId.slice(0, 12) + '...');
        return;
      }
      this.processedMessages.add(messageId);

      console.log('🔒 Encrypted message received from:', address.slice(0, 12) + '...');
      console.log('   Message ID:', messageId.slice(0, 12) + '...');
      console.log('   Encrypted data:', typeof message, JSON.stringify(message).slice(0, 60) + '...');

      try {
        const decrypted = await this.decrypt(address, message);
        if (decrypted) {
          console.log('✅ Decryption successful!');

          // Emit decrypted message with message ID
          this.yumi.emit('decrypted', decrypted.address, decrypted.pubkeys, decrypted.message, messageId);
          this.events.emit('decrypted', decrypted.address, decrypted.pubkeys, decrypted.message, messageId);
        } else {
          console.log('❌ Decryption returned null');
        }
      } catch (e) {
        console.error('❌ Decryption error for peer', address.slice(0, 12) + '...:', e);
      }
    });

    // Register RPC for peer key exchange
    this.register('peer', (address: string, sea: YariPeerInfo, cb: (result: any) => void) => {
      if (sea && sea.pub && sea.epub) {
        this.peers[address] = {
          pub: sea.pub,
          epub: sea.epub
        };

        console.log('🔐 Peer keys registered:', address.slice(0, 12) + '...');
        this.events.emit('newPeer', this.peers);

        if (cb) cb({ success: true });
      } else {
        console.error('Invalid SEA keys from peer:', address);
        if (cb) cb({ success: false, error: 'Invalid keys' });
      }
    });

    // Automatically exchange keys when seeing a new peer
    this.yumi.on('seen', async (address: string) => {
      // Make sure we have our own keys
      if (!this.sea) {
        await this.SEA();
      }

      // Send our public keys to the peer
      this.rpc(address, 'peer', {
        pub: this.sea!.pub,
        epub: this.sea!.epub
      }, (response: any) => {
        if (response && response.success) {
          console.log('🔑 Keys exchanged with:', address.slice(0, 12) + '...');
        }
      });
    });

    // Initialize SEA keys
    this.SEA().then(() => {
      console.log('✅ Yari initialized (encrypted mode)');
      console.log('   Address:', this.address);
      console.log('   SEA pub:', this.sea!.pub.slice(0, 20) + '...');
      
      // Start cleanup timer (every 5 minutes)
      this.cleanupInterval = setInterval(() => {
        this.cleanupProcessedMessages();
      }, 5 * 60 * 1000);
    }).catch((e) => {
      console.error('Failed to initialize SEA:', e);
    });
  }

  /**
   * Initialize or set SEA key pair
   */
  async SEA(pair?: SEAKeyPair): Promise<SEAKeyPair> {
    if (pair) {
      this.sea = pair;
      return this.sea!;
    }
    this.sea = await SHOGUN_SEA.pair();
    return this.sea!;
  }

  /**
   * Send encrypted message
   */
  async send(address?: string | any, message?: any): Promise<void> {
    // Wait for at least one peer to be ready
    if (Object.keys(this.peers).length === 0) {
      await new Promise<void>((resolve) => {
        this.events.once('newPeer', () => resolve());
      });
    }

    // Generate unique message ID for tracking
    const msgId = `${Date.now()}-${this.address}-${Math.random().toString(36).substring(2, 9)}`;

    if (!message) {
      // Broadcast message
      const msg = address;
      console.log('📡 Broadcasting encrypted message:', msgId.slice(0, 12) + '...');

      const promises = Object.keys(this.peers).map(async (peer) => {
        try {
          const secret = await SHOGUN_SEA.secret(this.peers[peer].epub, this.sea!) as string;
          const enc = await SHOGUN_SEA.encrypt(msg, secret);
          this.events.emit('encoded', [peer, enc, msgId]);
          console.log('✅ Message encrypted for peer:', peer.slice(0, 12) + '...');
        } catch (e) {
          console.error('❌ Encryption error for peer', peer.slice(0, 12) + '...:', e);
        }
      });

      await Promise.all(promises);
    } else {
      // Direct message
      if (!this.peers[address]) {
        throw new Error('Peer not found: ' + address);
      }

      console.log('📤 Sending direct encrypted message to:', address.slice(0, 12) + '...');

      try {
        const secret = await SHOGUN_SEA.secret(this.peers[address].epub, this.sea!) as string;
        const enc = await SHOGUN_SEA.encrypt(message, secret);
        this.events.emit('encoded', [address, enc, msgId]);
        console.log('✅ Direct message encrypted and sent');
      } catch (e) {
        console.error('❌ Encryption error for direct message:', e);
        throw e;
      }
    }
  }

  /**
   * Decrypt message from peer
   */
  private async decrypt(address: string, message: any): Promise<DecryptedMessage | null> {
    const pubkeys = this.peers[address];

    if (!pubkeys) {
      console.warn('⚠️ Unknown peer for decryption:', address.slice(0, 12) + '...');
      return null;
    }

    if (!this.sea) {
      console.error('❌ No SEA keypair available for decryption');
      return null;
    }

    try {
      const secret = await SHOGUN_SEA.secret(this.peers[address].epub, this.sea) as string;
      const decrypted = await SHOGUN_SEA.decrypt(message, secret) as string;

      console.log('🔓 Message decrypted successfully for peer:', address.slice(0, 12) + '...');

      return {
        address: address,
        pubkeys: pubkeys,
        message: decrypted
      };
    } catch (e) {
      console.error('❌ Decryption error for peer', address.slice(0, 12) + '...:', e);
      return null;
    }
  }

  /**
   * Clean up processed messages (call periodically to prevent memory leaks)
   */
  cleanupProcessedMessages(): void {
    // Keep only last 1000 messages to prevent memory leaks
    if (this.processedMessages.size > 1000) {
      const messagesArray = Array.from(this.processedMessages);
      this.processedMessages.clear();
      // Keep the most recent 500 messages
      messagesArray.slice(-500).forEach(msg => this.processedMessages.add(msg));
      console.log('🧹 Cleaned up old processed messages');
    }
  }

  /**
   * Enhanced destroy method with cleanup
   */
  destroy(): void {
    // Clear cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clear processed messages
    this.processedMessages.clear();
    
    // Call original destroy
    this.yumi.destroy();
    
    console.log('🔚 Yari destroyed and cleaned up');
  }

}

export default Yari;

// Legacy alias for backward compatibility
export { Yari as Bugoff };

