/**
 * Kunai (苦無) - Ephemeral File Transfer
 * TypeScript implementation
 * 
 * Kunai = ninja throwing knife in Japanese - fast, precise, ephemeral transfers
 * Uses Yumi for signaling, streams files without GunDB persistence
 */

import { Yumi } from './yumi.js';
import { Yari } from './yari.js';
import { YumiOptions } from './types.js';

import pkg from 'peerjs';
const { Peer } = pkg;

// WebRTC will be loaded dynamically in the constructor

// WebRTC types for browser compatibility
interface RTCDataChannel {
  send(data: string | ArrayBuffer | Blob): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: any) => void) | null;
  readyState: string;
  close(): void;
}

interface RTCPeerConnection {
  createDataChannel(label: string, options?: any): RTCDataChannel;
  createOffer(): Promise<any>;
  setLocalDescription(description: any): Promise<void>;
  setRemoteDescription(description: any): Promise<void>;
  createAnswer(): Promise<any>;
  addIceCandidate(candidate: any): Promise<void>;
  onicecandidate: ((event: any) => void) | null;
  onconnectionstatechange: ((event: any) => void) | null;
  connectionState: string;
  close(): void;
}

interface RTCConfiguration {
  iceServers: Array<{ urls: string }>;
}
import { EventEmitter } from 'events';

const CHUNK_SIZE = 256 * 1024; // 256KB chunks for efficient transfer
const ENCRYPTED_CHUNK_SIZE = 16 * 1024; // 16KB chunks for encrypted mode (larger now that toBase64 is fixed)
const MIN_CHUNK_SIZE = 512; // 512 bytes minimum chunk size
const WEBRTC_THRESHOLD = 1024; // Use WebRTC for files > 1KB, GunDB for signaling only
const CLEANUP_DELAY = 5000; // 5 seconds
const TRANSFER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export interface KunaiOptions extends YumiOptions {
  chunkSize?: number;
  cleanupDelay?: number;
  transferTimeout?: number;
  encrypted?: boolean;  // Use Yari for E2E encryption
  channel?: string;     // Custom channel (like identifier in Yumi/Yari)
  useWebRTC?: boolean;  // Force WebRTC for all files
}

export interface FileOffer {
  transferId: string;
  filename: string;
  size: number;
  chunks: number;
}

export interface TransferInfo {
  filename: string;
  size: number;
  chunks: number;
  status: 'waiting' | 'sending' | 'receiving' | 'complete';
  progress?: number;
}

/**
 * Kunai (苦無) - Ephemeral File Transfer
 */
export class Kunai extends EventEmitter {
  private yumi: Yumi;
  private yari: Yari | null = null;
  private encrypted: boolean;
  private channel: string;
  private transfers: Map<string, any> = new Map();
  private receivedChunks: Map<string, any> = new Map();
  private processedMessages: Set<string> = new Set(); // Deduplication
  private chunkSize: number;
  private cleanupDelay: number;
  private transferTimeout: number;
  
  // WebRTC properties
  private webrtcConnections: Map<string, any> = new Map();
  private webrtcDataChannels: Map<string, any> = new Map();
  private pendingWebRTCOffers: Map<string, any> = new Map();
  private RTCPeerConnection: any = null;
  private RTCDataChannel: any = null;
  
  // Chunk retry mechanism
  private chunkTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private chunkRequestTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private maxChunkRetries: number = 3;
  private chunkRequestDelay: number = 2000; // 2 seconds
  private transferRetentionTime: number = 30000; // 30 seconds to keep transfers for retry
  
  // Peer cleanup mechanism
  private peerCleanupInterval: NodeJS.Timeout | null = null;
  private peerTimeout: number = 60000; // 60 seconds to consider peer offline

  constructor(identifier?: string, opts?: KunaiOptions) {
    super();
    
    // Load WebRTC for Node.js (only once)
    this.loadWebRTC();
    
    // Default identifier or custom channel
    this.channel = opts?.channel || identifier || 'kunai-transfer';
    this.encrypted = opts?.encrypted || false;
    this.chunkSize = opts?.chunkSize || CHUNK_SIZE;
    this.cleanupDelay = opts?.cleanupDelay || CLEANUP_DELAY;
    this.transferTimeout = opts?.transferTimeout || TRANSFER_TIMEOUT;

    // Initialize Yumi or Yari based on encryption setting
    if (this.encrypted) {
      console.log('🔐 Kunai initialized with encryption (Yari)');
      console.log('📡 Using channel:', this.channel);
      this.yari = new Yari(this.channel, opts);
      this.yumi = this.yari.yumi;
    } else {
      console.log('🥷 Kunai initialized without encryption (Yumi)');
      console.log('📡 Using channel:', this.channel);
      this.yumi = new Yumi(this.channel, opts);
    }

    this.setupHandlers();
    
    // Start peer cleanup interval
    this.startPeerCleanup();
  }

  private loadWebRTC(): void {
    try {
      // Try to load native WebRTC for Node.js
      if (typeof window === 'undefined') {
        // Node.js environment
        try {
          const wrtc = require('wrtc');
          this.RTCPeerConnection = wrtc.RTCPeerConnection;
          this.RTCDataChannel = wrtc.RTCDataChannel;
          console.log('🌐 Native WebRTC loaded for Node.js (wrtc)');
          return;
        } catch (e) {
          console.log('⚠️ wrtc not available, trying node-webrtc...');
        }
        
        try {
          const webrtc = require('node-webrtc');
          this.RTCPeerConnection = webrtc.RTCPeerConnection;
          this.RTCDataChannel = webrtc.RTCDataChannel;
          console.log('🌐 Native WebRTC loaded for Node.js (node-webrtc)');
          return;
        } catch (e) {
          console.log('⚠️ node-webrtc not available, trying PeerJS...');
        }
        
        // Fallback to PeerJS
        try {
          console.log('🔍 Attempting to load PeerJS...');
          this.RTCPeerConnection = Peer;
          console.log('🌐 PeerJS loaded for Node.js (fallback)');
        } catch (peerError) {
          console.log('❌ PeerJS also failed:', peerError instanceof Error ? peerError.message : String(peerError));
          this.RTCPeerConnection = null;
        }
      } else {
        // Browser environment - use native WebRTC
        this.RTCPeerConnection = window.RTCPeerConnection;
        this.RTCDataChannel = window.RTCDataChannel;
        console.log('🌐 Native WebRTC available in browser');
      }
    } catch (error) {
      console.log('❌ WebRTC loading failed:', error instanceof Error ? error.message : String(error));
      console.log('🌐 WebRTC not available, using GunDB fallback');
      this.RTCPeerConnection = null;
    }
  }

  private setupHandlers(): void {
    this.yumi.on('ready', () => {
      this.emit('ready');
    });

    this.yumi.on('connections', (count: number) => {
      this.emit('connections', count);
    });

    // Listen for messages - use 'decrypted' event if encrypted mode
    if (this.encrypted && this.yari) {
      console.log('🔐 Listening for encrypted Kunai messages (via Yari decrypted)');
      
      // Listen to Yari's decrypted messages on yumi (this works)
      this.yumi.on('decrypted', (address: string, pubkeys: any, msg: any, messageId?: string) => {
        console.log('🔓 Kunai decrypted (yumi):', msg?.type || msg);
        if (msg && msg.type) {
          this.handleMessage(address, msg);
        }
      });

      // Also listen to plain messages (fallback for large chunks)
      this.yumi.on('message', (address: string, msg: any) => {
        // Check if this is a Kunai message (has type field)
        if (msg && typeof msg === 'object' && msg.type) {
          console.log('📨 Kunai plain message (fallback):', msg.type, 'from:', address.slice(0, 12) + '...');
          this.handleMessage(address, msg);
        } else {
          console.log('🔒 Kunai saw encrypted message from:', address.slice(0, 12) + '...');
          console.log('   Message type:', typeof msg);
          console.log('   Message content:', JSON.stringify(msg).slice(0, 100) + '...');
          console.log('   Will be decrypted by Yari...');
        }
      });

      // Debug: listen to all Yari events
      this.yari.events.on('*', (...args: any[]) => {
        console.log('🔍 Yari event:', args[0], args.slice(1));
      });
    } else {
      console.log('🏹 Listening for plain Kunai messages (Yumi)');
      
      // Plain mode: listen to regular messages
      this.yumi.on('message', (address: string, msg: any) => {
        console.log('📨 Kunai plain message:', msg?.type || msg);
        this.handleMessage(address, msg);
      });
    }
    
    // Listen for WebRTC signaling messages
    this.yumi.on('message', (address: string, msg: any) => {
      if (msg && typeof msg === 'object' && (msg.type === 'webrtc-offer' || msg.type === 'webrtc-answer' || msg.type === 'webrtc-ice')) {
        this.handleWebRTCSignaling(address, msg);
      }
    });
  }

  private handleMessage(address: string, msg: any): void {
    // Create unique message ID for deduplication
    const msgId = `${address}-${msg.type}-${JSON.stringify(msg).slice(0, 50)}`;
    
    // Check for duplicates
    if (this.processedMessages.has(msgId)) {
      console.log('🔄 Duplicate message ignored:', msg.type);
      return;
    }
    this.processedMessages.add(msgId);
    
    // Cleanup old messages to prevent memory leaks (keep last 1000)
    if (this.processedMessages.size > 1000) {
      const messagesArray = Array.from(this.processedMessages);
      const toDelete = messagesArray.slice(0, messagesArray.length - 500);
      toDelete.forEach(id => this.processedMessages.delete(id));
    }

    switch (msg.type) {
      case 'file-offer':
        this.handleFileOffer(address, msg);
        break;
      case 'file-accept':
        this.handleFileAccept(address, msg);
        break;
      case 'file-chunk':
        this.handleFileChunk(address, msg);
        break;
      case 'transfer-complete':
        this.handleTransferComplete(address, msg);
        break;
      case 'chunk-request':
        this.handleChunkRequest(address, msg);
        break;
    }
  }

  private handleWebRTCSignaling(address: string, msg: any): void {
    console.log('🌐 WebRTC signaling:', msg.type, 'from:', address.slice(0, 12) + '...');
    
    switch (msg.type) {
      case 'webrtc-offer':
        this.handleWebRTCOffer(address, msg);
        break;
      case 'webrtc-answer':
        this.handleWebRTCAnswer(address, msg);
        break;
      case 'webrtc-ice':
        this.handleWebRTCIce(address, msg);
        break;
    }
  }

  // WebRTC Methods
  private async handleWebRTCOffer(address: string, msg: any): Promise<void> {
    console.log('🌐 Received WebRTC offer from:', address.slice(0, 12) + '...');
    
    if (this.RTCPeerConnection === null) {
      console.log('❌ WebRTC not available, ignoring offer');
      return;
    }
    
    try {
      // Create PeerJS instance for receiving
      const peer = new this.RTCPeerConnection(`kunai-receiver-${Date.now()}`);
      
      this.webrtcConnections.set(address, peer);
      
      // Handle incoming connections
      peer.on('connection', (conn: any) => {
        console.log('🌐 PeerJS connection received from:', address.slice(0, 12) + '...');
        
        conn.on('data', (data: any) => {
          this.handleWebRTCData(address, data);
        });
        
        conn.on('open', () => {
          console.log('🌐 PeerJS data channel opened with:', address.slice(0, 12) + '...');
        });
        
        conn.on('error', (error: any) => {
          console.error('❌ PeerJS connection error:', error);
        });
      });
      
      peer.on('error', (error: any) => {
        console.error('❌ PeerJS peer error:', error);
      });
      
      // Send answer back
      await this.sendMessage({
        type: 'webrtc-answer',
        transferId: msg.transferId,
        peerId: peer.id
      }, address);
      
    } catch (error) {
      console.error('❌ WebRTC offer handling failed:', error);
    }
  }

  private async handleWebRTCAnswer(address: string, msg: any): Promise<void> {
    console.log('🌐 Received WebRTC answer from:', address.slice(0, 12) + '...');
    
    const peer = this.webrtcConnections.get(address);
    if (peer) {
      try {
        // Connect to the peer using their ID
        const conn = peer.connect(msg.peerId);
        
        conn.on('open', () => {
          console.log('🌐 PeerJS connected to:', address.slice(0, 12) + '...');
          this.startWebRTCFileTransfer(address, msg.transferId);
        });
        
        conn.on('data', (data: any) => {
          this.handleWebRTCData(address, data);
        });
        
        this.webrtcDataChannels.set(address, conn);
      } catch (error) {
        console.error('❌ WebRTC answer handling failed:', error);
      }
    }
  }

  private async handleWebRTCIce(address: string, msg: any): Promise<void> {
    console.log('🌐 Received WebRTC ICE candidate from:', address.slice(0, 12) + '...');
    // PeerJS handles ICE automatically, no manual handling needed
  }

  private handleWebRTCData(address: string, data: any): void {
    console.log('🌐 Received WebRTC data from:', address.slice(0, 12) + '...');
    
    if (data instanceof ArrayBuffer) {
      // Handle file chunk data
      const transferId = this.findTransferByPeer(address);
      if (transferId) {
        this.handleWebRTCChunk(transferId, data);
      }
    } else {
      // Handle control messages
      try {
        const message = JSON.parse(data);
        this.handleWebRTCControlMessage(address, message);
      } catch (error) {
        console.error('❌ Failed to parse WebRTC control message:', error);
      }
    }
  }

  private handleWebRTCChunk(transferId: string, chunkData: ArrayBuffer): void {
    const transfer = this.receivedChunks.get(transferId);
    if (!transfer) return;
    
    // Add chunk to transfer
    transfer.chunks.push(chunkData);
    transfer.receivedCount++;
    
    this.emit('receive-progress', {
      transferId,
      received: transfer.receivedCount,
      total: transfer.totalChunks,
      progress: (transfer.receivedCount / transfer.totalChunks) * 100
    });
    
    // Check if complete
    if (transfer.receivedCount >= transfer.totalChunks) {
      this.assembleFile(transferId);
    }
  }

  private handleWebRTCControlMessage(address: string, message: any): void {
    console.log('🌐 WebRTC control message:', message.type, 'from:', address.slice(0, 12) + '...');
    
    switch (message.type) {
      case 'chunk-request':
        this.sendWebRTCChunk(address, message.transferId, message.chunkIndex);
        break;
      case 'transfer-complete':
        this.handleTransferComplete(address, message);
        break;
    }
  }

  private findTransferByPeer(address: string): string | null {
    for (const [transferId, transfer] of this.receivedChunks) {
      if (transfer.peerId === address) {
        return transferId;
      }
    }
    return null;
  }

  private async sendWebRTCChunk(address: string, transferId: string, chunkIndex: number): Promise<void> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;
    
    const dataChannel = this.webrtcDataChannels.get(address);
    if (!dataChannel || (dataChannel.readyState && dataChannel.readyState !== 'open')) return;
    
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(start + this.chunkSize, transfer.file.size);
    const chunk = transfer.file.slice(start, end);
    
    const arrayBuffer = await this.fileToArrayBuffer(chunk);
    dataChannel.send(arrayBuffer);
    
    console.log(`🌐 Sent WebRTC chunk ${chunkIndex} to:`, address.slice(0, 12) + '...');
  }

  private fileToArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private async initiateWebRTCConnection(address: string, transferId: string): Promise<void> {
    if (this.RTCPeerConnection === null) {
      console.log('❌ WebRTC not available in Node.js, falling back to GunDB');
      // Fallback to GunDB streaming
      const transfer = this.transfers.get(transferId);
      if (transfer) {
        if (transfer.data) {
          this.streamData(transferId, transfer.data);
        } else if (transfer.file) {
          this.streamFile(transferId, transfer.file);
        }
      }
      return;
    }
    
    try {
      console.log('🌐 Creating PeerJS connection to:', address.slice(0, 12) + '...');
      
      // Create PeerJS instance for sending
      const peer = new this.RTCPeerConnection(`kunai-sender-${Date.now()}`);
      
      this.webrtcConnections.set(address, peer);
      
      // Handle connection events
      peer.on('open', (id: string) => {
        console.log('🌐 PeerJS opened with ID:', id);
        
        // Send offer with our peer ID
        this.sendMessage({
          type: 'webrtc-offer',
          transferId: transferId,
          peerId: id
        }, address);
      });
      
      peer.on('error', (error: any) => {
        console.error('❌ PeerJS error:', error);
      });
      
      console.log('🌐 PeerJS offer sent to:', address.slice(0, 12) + '...');
      
    } catch (error) {
      console.error('❌ Failed to initiate WebRTC connection:', error);
      // Fallback to GunDB streaming
      const transfer = this.transfers.get(transferId);
      if (transfer) {
        if (transfer.data) {
          this.streamData(transferId, transfer.data);
        } else if (transfer.file) {
          this.streamFile(transferId, transfer.file);
        }
      }
    }
  }

  private async startWebRTCFileTransfer(address: string, transferId: string): Promise<void> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;
    
    console.log('🌐 Starting WebRTC file transfer...');
    
    const totalChunks = Math.ceil(transfer.file.size / transfer.chunkSize);
    
    // Send chunks via WebRTC
    for (let i = 0; i < totalChunks; i++) {
      const start = i * transfer.chunkSize;
      const end = Math.min(start + transfer.chunkSize, transfer.file.size);
      const chunk = transfer.file.slice(start, end);
      
      const arrayBuffer = await this.fileToArrayBuffer(chunk);
      
      const conn = this.webrtcDataChannels.get(address);
      if (conn && conn.open) {
        conn.send(arrayBuffer);
        
        transfer.sent++;
        this.emit('send-progress', {
          transferId,
          sent: transfer.sent,
          total: totalChunks,
          progress: (transfer.sent / totalChunks) * 100
        });
        
        console.log(`🌐 Sent PeerJS chunk ${i + 1}/${totalChunks}`);
      } else {
        console.error('❌ PeerJS connection not open');
        break;
      }
    }
    
    // Send transfer complete
    const conn = this.webrtcDataChannels.get(address);
    if (conn && conn.open) {
      conn.send(JSON.stringify({
        type: 'transfer-complete',
        transferId: transferId
      }));
    }
    
    // Also send via GunDB for confirmation
    await this.sendMessage({
      type: 'transfer-complete',
      transferId: transferId
    }, address);
    
    console.log('🏁 WebRTC transfer complete!');
    this.emit('transfer-complete', transferId);
  }

  /**
   * Send message (encrypted if Yari, plain if Yumi)
   */
  private async sendMessage(message: any, address?: string): Promise<void> {
    if (this.encrypted && this.yari) {
      // Encrypted mode: use Yari
      console.log('🔐 Sending encrypted Kunai message:', message.type);
      
      try {
        // Yari.send expects (address, message) or (message) for broadcast
        if (address) {
          console.log('🔐 Sending to specific peer:', address.slice(0, 12) + '...');
          await this.yari.send(address, message);
        } else {
          // Broadcast to all peers
          console.log('🔐 Broadcasting to all peers...');
          await this.yari.send(message);
          // Yari.send() returns undefined on success, which is expected
        }
        console.log('✅ Encrypted message sent successfully');
      } catch (error) {
        if (error instanceof RangeError && error.message.includes('Maximum call stack size exceeded')) {
          console.log('⚠️ Message too large for encryption, using fallback method...');
          
          // For file-chunk messages, try to send without encryption as fallback
          if (message.type === 'file-chunk') {
            console.log('🔄 Falling back to plain mode for large chunk...');
            // Send as plain message (no encryption)
            if (address) {
              this.yumi.send(address, message);
            } else {
              this.yumi.send(message);
            }
            console.log('✅ Fallback message sent successfully');
            return;
          }
        }
        
        console.error('❌ Failed to send encrypted message:', error);
        throw error;
      }
    } else {
      // Plain mode: use Yumi
      if (address) {
        this.yumi.send(address, message);
      } else {
        this.yumi.send(message);
      }
    }
  }

  /**
   * Generate wormhole-style transfer code
   */
  private generateCode(): string {
    const words = [
      'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot',
      'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima',
      'ninja', 'samurai', 'shogun', 'katana', 'sakura', 'tokyo'
    ];
    
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(Math.random() * 100);
    
    return `${num}-${word1}-${word2}`;
  }

  /**
   * Send file offer
   */
  async sendOffer(file: File | { name: string; size: number }, data?: ArrayBuffer | Uint8Array): Promise<string> {
    const transferId = this.generateCode();
    
    // Choose transfer method: GunDB for reliable transfer, WebRTC as optional enhancement
    const webRTCAvailable = this.RTCPeerConnection !== null;
    const useWebRTC = false; // Disable WebRTC for now, focus on reliable GunDB transfer
    const chunkSize = this.encrypted ? ENCRYPTED_CHUNK_SIZE : this.chunkSize;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    console.log(`📊 File size: ${(file.size / 1024).toFixed(1)}KB`);
    console.log(`🌐 WebRTC available: ${webRTCAvailable ? '✅ Yes' : '❌ No (Node.js)'}`);
    console.log(`🔧 Transfer method: ${useWebRTC ? 'WebRTC Direct' : 'GunDB Chunks'}`);
    console.log(`📦 Chunk size: ${(chunkSize / 1024).toFixed(1)}KB, Total chunks: ${totalChunks}`);

    this.transfers.set(transferId, {
      file,
      data,
      chunks: totalChunks,
      sent: 0,
      status: 'waiting',
      useWebRTC: useWebRTC,
      chunkSize: chunkSize
    });

    // For encrypted mode, wait for at least one peer connection AND key exchange
    if (this.encrypted && this.yari) {
      console.log('🔐 Waiting for peer connections and key exchange...');
      let attempts = 0;
      while (attempts < 30) { // Wait up to 30 seconds
        const connections = this.yumi.connections();
        const encryptedPeers = Object.keys(this.yari.peers).length;
        
        if (connections > 0 && encryptedPeers > 0) {
          console.log(`✅ Found ${connections} peer(s), ${encryptedPeers} with keys, proceeding with encrypted send`);
          break;
        }
        
        console.log(`⏳ Waiting for peers (${connections}) and keys (${encryptedPeers})... (${attempts + 1}/30)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (attempts >= 30) {
        console.warn('⚠️ No peers with keys found after 30s, sending anyway (may fail)');
      } else {
        // Extra delay to ensure key exchange is complete
        console.log('⏳ Waiting 2s for key exchange to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Send offer (encrypted if Yari, plain if Yumi)
    try {
      await Promise.race([
        this.sendMessage({
          type: 'file-offer',
          transferId,
          filename: file.name,
          size: file.size,
          chunks: totalChunks,
          useWebRTC: useWebRTC,
          chunkSize: chunkSize
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Send timeout after 10s')), 10000)
        )
      ]);
      
      // If using WebRTC, wait for file-accept and then initiate WebRTC connection
      if (useWebRTC) {
        console.log('🌐 WebRTC transfer initiated, waiting for file-accept...');
        // The WebRTC connection will be established when we receive file-accept
      }
    } catch (error) {
      console.error('❌ Failed to send file offer:', error instanceof Error ? error.message : String(error));
      this.emit('error', error);
      return transferId; // Return code anyway for user reference
    }

    this.emit('offer-sent', {
      transferId,
      filename: file.name,
      size: file.size,
      chunks: totalChunks
    });

    // Timeout
    setTimeout(() => {
      const transfer = this.transfers.get(transferId);
      if (transfer && transfer.status === 'waiting') {
        this.emit('transfer-timeout', transferId);
        this.transfers.delete(transferId);
      }
    }, this.transferTimeout);

    return transferId;
  }

  /**
   * Handle file offer
   */
  private handleFileOffer(address: string, msg: any): void {
    const { transferId, filename, size, chunks, useWebRTC, chunkSize } = msg;

    console.log(`📥 Received file offer: ${filename} (${(size / 1024).toFixed(1)}KB)`);
    console.log(`🔧 Transfer method: ${useWebRTC ? 'WebRTC Direct' : 'GunDB Chunks'}`);

    this.receivedChunks.set(transferId, {
      filename,
      size,
      chunks: [],
      totalChunks: chunks,
      receivedCount: 0,
      useWebRTC: useWebRTC || false,
      chunkSize: chunkSize || this.chunkSize,
      peerId: address, // Store peer ID for WebRTC
      senderAddress: address // Store sender address for chunk requests
    });

    this.emit('file-offer', {
      transferId,
      filename,
      size,
      chunks,
      from: address
    });

    // Auto-accept (can be overridden by listening to 'file-offer')
    this.acceptTransfer(transferId);
  }

  /**
   * Accept incoming transfer
   */
  async acceptTransfer(transferId: string): Promise<void> {
    const transfer = this.receivedChunks.get(transferId);
    if (!transfer) return;
    
    await this.sendMessage({
      type: 'file-accept',
      transferId
    });

    this.emit('transfer-accepted', transferId);
    
    // If this is a WebRTC transfer, prepare for WebRTC connection
    if (transfer.useWebRTC) {
      console.log('🌐 Preparing for WebRTC transfer...');
      // The WebRTC connection will be established when we receive the offer
    }
  }

  /**
   * Handle transfer acceptance
   */
  private handleFileAccept(address: string, msg: any): void {
    const { transferId } = msg;
    const transfer = this.transfers.get(transferId);

    if (!transfer) return;

    transfer.status = 'sending';
    this.emit('transfer-started', transferId);

    // Check if this is a WebRTC transfer
    if (transfer.useWebRTC) {
      console.log('🌐 Initiating WebRTC connection for transfer:', transferId);
      this.initiateWebRTCConnection(address, transferId);
    } else {
      // Start streaming via GunDB
      if (transfer.data) {
        this.streamData(transferId, transfer.data);
      } else if (transfer.file) {
        this.streamFile(transferId, transfer.file);
      }
    }
  }

  /**
   * Stream ArrayBuffer/Uint8Array data
   */
  private async streamData(transferId: string, data: ArrayBuffer | Uint8Array): Promise<void> {
    const transfer = this.transfers.get(transferId);
    const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    
    let offset = 0;
    let chunkIndex = 0;

    console.log(`📦 Starting to stream ${transfer.chunks} chunks from ArrayBuffer...`);
    console.log(`🔧 Debug: this.chunkSize=${this.chunkSize}, transfer.chunkSize=${transfer.chunkSize}, buffer.length=${buffer.length}`);

    while (offset < buffer.length) {
      // Use the transfer's chunk size, not the instance chunk size
      const actualChunkSize = transfer.chunkSize || this.chunkSize;
      const chunkEnd = Math.min(offset + actualChunkSize, buffer.length);
      const chunk = buffer.slice(offset, chunkEnd);
      
      console.log(`📤 Sending chunk ${chunkIndex + 1}/${transfer.chunks} (${chunk.length} bytes)`);
      console.log(`🔍 Loop state: offset=${offset}, chunkEnd=${chunkEnd}, actualChunkSize=${actualChunkSize}, buffer.length=${buffer.length}`);
      
      try {
        await this.sendChunk(transferId, chunkIndex, chunk, transfer.chunks);
        console.log(`✅ Chunk ${chunkIndex + 1} sent successfully`);
      } catch (error) {
        console.error(`❌ Failed to send chunk ${chunkIndex + 1}:`, error);
        throw error;
      }
      
      offset = chunkEnd;
      chunkIndex++;
      
      console.log(`🔄 After chunk ${chunkIndex}: offset=${offset}, chunkIndex=${chunkIndex}, buffer.length=${buffer.length}`);

      // Add small delay between chunks for encrypted mode to prevent overwhelming
      if (this.encrypted && chunkIndex < transfer.chunks) {
        console.log(`⏳ Adding delay before next chunk...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`🏁 All ${transfer.chunks} chunks sent, sending transfer-complete...`);

    // Complete
    await this.sendMessage({
      type: 'transfer-complete',
      transferId
    });

    this.emit('transfer-complete', transferId);
    
    // Keep transfer in memory for retry requests, but mark as completed
    const currentTransfer = this.transfers.get(transferId);
    if (currentTransfer) {
      currentTransfer.completed = true;
      currentTransfer.completedAt = Date.now();
      
      // Schedule cleanup after retention time
      setTimeout(() => {
        const transferToCleanup = this.transfers.get(transferId);
        if (transferToCleanup) {
          // Clear saved chunks to free memory
          if (transferToCleanup.chunks) {
            transferToCleanup.chunks.clear();
          }
          this.transfers.delete(transferId);
          console.log(`🧹 Cleaned up completed transfer ${transferId.slice(0, 8)}...`);
        }
      }, this.transferRetentionTime);
    }
  }

  /**
   * Stream File (browser)
   */
  private async streamFile(transferId: string, file: File): Promise<void> {
    const transfer = this.transfers.get(transferId);
    let offset = 0;
    let chunkIndex = 0;

    console.log(`📦 Starting to stream ${transfer.chunks} chunks...`);
    console.log(`🔧 Debug: this.chunkSize=${this.chunkSize}, transfer.chunkSize=${transfer.chunkSize}, file.size=${file.size}`);

    while (offset < file.size) {
      // Use the transfer's chunk size, not the instance chunk size
      const actualChunkSize = transfer.chunkSize || this.chunkSize;
      const chunk = file.slice(offset, offset + actualChunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log(`📤 Sending chunk ${chunkIndex + 1}/${transfer.chunks} (${uint8Array.length} bytes)`);
      console.log(`🔍 Loop state: offset=${offset}, actualChunkSize=${actualChunkSize}, file.size=${file.size}`);
      
      try {
        await this.sendChunk(transferId, chunkIndex, uint8Array, transfer.chunks);
        console.log(`✅ Chunk ${chunkIndex + 1} sent successfully`);
      } catch (error) {
        console.error(`❌ Failed to send chunk ${chunkIndex + 1}:`, error);
        throw error;
      }

      offset += actualChunkSize;
      chunkIndex++;

      // Progress
      this.emit('send-progress', {
        transferId,
        sent: chunkIndex,
        total: transfer.chunks,
        percent: (chunkIndex / transfer.chunks * 100).toFixed(1)
      });

      // Add small delay between chunks for encrypted mode to prevent overwhelming
      if (this.encrypted && chunkIndex < transfer.chunks) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`🏁 All ${transfer.chunks} chunks sent, sending transfer-complete...`);

    // Complete
    await this.sendMessage({
      type: 'transfer-complete',
      transferId
    });

    this.emit('transfer-complete', transferId);
    
    // Keep transfer in memory for retry requests, but mark as completed
    const currentTransfer = this.transfers.get(transferId);
    if (currentTransfer) {
      currentTransfer.completed = true;
      currentTransfer.completedAt = Date.now();
      
      // Schedule cleanup after retention time
      setTimeout(() => {
        const transferToCleanup = this.transfers.get(transferId);
        if (transferToCleanup) {
          // Clear saved chunks to free memory
          if (transferToCleanup.chunks) {
            transferToCleanup.chunks.clear();
          }
          this.transfers.delete(transferId);
          console.log(`🧹 Cleaned up completed transfer ${transferId.slice(0, 8)}...`);
        }
      }, this.transferRetentionTime);
    }
  }

  /**
   * Send single chunk (ephemeral)
   */
  private async sendChunk(
    transferId: string, 
    index: number, 
    chunk: Uint8Array, 
    total: number
  ): Promise<void> {
    try {
      console.log(`🔧 sendChunk called: index=${index}, chunk.length=${chunk.length}, total=${total}`);
      
      // Save chunk in transfer for potential retry
      const transfer = this.transfers.get(transferId);
      if (transfer) {
        if (!transfer.chunks) {
          transfer.chunks = new Map();
        }
        transfer.chunks.set(index, new Uint8Array(chunk)); // Store copy of chunk
        console.log(`💾 Saved chunk ${index} in transfer for retry (${chunk.length} bytes)`);
      }
      
      const base64 = this.arrayBufferToBase64(chunk);
      
      console.log(`🔐 Sending chunk ${index + 1}/${total} (${chunk.length} bytes, base64: ${base64.length} chars)`);

      await this.sendMessage({
        type: 'file-chunk',
        transferId,
        index,
        data: base64,
        total
      });

      console.log(`✅ Chunk ${index + 1} message sent successfully`);

      // Schedule cleanup
      this.scheduleChunkCleanup(transferId, index);
      
      console.log(`🏁 sendChunk completed for index ${index}`);
    } catch (error) {
      if (error instanceof RangeError && error.message.includes('Maximum call stack size exceeded')) {
        console.log(`⚠️ Chunk too large for encryption, splitting chunk ${index}...`);
        
        // Split chunk into smaller pieces
        const subChunkSize = Math.min(MIN_CHUNK_SIZE, Math.floor(chunk.length / 8)); // Split into 8 parts or 512 bytes
        for (let i = 0; i < chunk.length; i += subChunkSize) {
          const subChunk = chunk.slice(i, i + subChunkSize);
          const subIndex = `${index}-${Math.floor(i / subChunkSize)}`;
          
          try {
            const base64 = this.arrayBufferToBase64(subChunk);
            await this.sendMessage({
              type: 'file-chunk',
              transferId,
              index: subIndex,
              data: base64,
              total: `${total}-split`
            });
          } catch (subError) {
            if (subError instanceof RangeError && subError.message.includes('Maximum call stack size exceeded')) {
              console.log(`⚠️ Sub-chunk still too large, using micro-chunks (256 bytes)...`);
              
              // Final fallback: 256 byte chunks
              const microChunkSize = 256;
              for (let j = 0; j < subChunk.length; j += microChunkSize) {
                const microChunk = subChunk.slice(j, j + microChunkSize);
                const microIndex = `${subIndex}-${Math.floor(j / microChunkSize)}`;
                
                try {
                  const base64 = this.arrayBufferToBase64(microChunk);
                  await this.sendMessage({
                    type: 'file-chunk',
                    transferId,
                    index: microIndex,
                    data: base64,
                    total: `${total}-micro`
                  });
                  console.log(`✅ Sent micro-chunk ${microIndex}`);
                } catch (microError) {
                  console.error(`❌ Failed to send micro-chunk ${microIndex}:`, microError);
                }
              }
            } else {
              console.error(`❌ Failed to send sub-chunk ${subIndex}:`, subError);
            }
          }
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Schedule chunk cleanup (auto-delete from GunDB)
   */
  private scheduleChunkCleanup(transferId: string, index: number): void {
    setTimeout(() => {
      const chunkId = `${transferId}-chunk-${index}`;
      // Remove from Gun graph (ephemeral)
      this.yumi.gun
        .get('kunai-chunks')
        .get(chunkId)
        .put(null);
    }, this.cleanupDelay);
  }

  /**
   * Handle incoming chunk
   */
  private handleFileChunk(address: string, msg: any): void {
    const { transferId, index, data, total } = msg;
    const transfer = this.receivedChunks.get(transferId);

    console.log('📦 Received file chunk:', {
      transferId: transferId?.slice(0, 8) + '...',
      index,
      dataSize: data?.length || 0,
      total,
      from: address.slice(0, 12) + '...'
    });

    console.log(`📥 Processing chunk ${index + 1}/${total} for transfer ${transferId?.slice(0, 8)}...`);

    if (!transfer) {
      console.log('❌ No transfer found for chunk:', transferId?.slice(0, 8) + '...');
      return;
    }

    // Handle split chunks (e.g., "0-0", "0-1", "0-2", "0-3")
    if (typeof index === 'string' && index.includes('-') && total.includes('-split')) {
      const [mainIndex, subIndex] = index.split('-');
      if (!transfer.chunks[mainIndex]) {
        transfer.chunks[mainIndex] = [];
      }
      transfer.chunks[mainIndex][parseInt(subIndex)] = this.base64ToArrayBuffer(data);
      
      // Check if all sub-chunks for this main chunk are received
      const subChunks = transfer.chunks[mainIndex];
      if (Array.isArray(subChunks) && subChunks.every(chunk => chunk !== undefined)) {
        // Reassemble the main chunk
        const isNodeEnv = typeof process !== 'undefined' && process.versions && process.versions.node;
        if (isNodeEnv) {
          transfer.chunks[mainIndex] = Buffer.concat(subChunks);
        } else {
          transfer.chunks[mainIndex] = new Uint8Array(subChunks.reduce((acc, chunk) => acc + chunk.length, 0));
          let offset = 0;
          subChunks.forEach(chunk => {
            transfer.chunks[mainIndex].set(chunk, offset);
            offset += chunk.length;
          });
        }
        transfer.receivedCount++;
      }
    } else {
      // Regular chunk
      transfer.chunks[index] = this.base64ToArrayBuffer(data);
      transfer.receivedCount++;
    }

    const actualTotal = (typeof total === 'string' && total.includes('-split')) ? parseInt(total.split('-')[0]) : total;
    
    console.log(`📊 Progress: ${transfer.receivedCount}/${actualTotal} chunks received (${(transfer.receivedCount / actualTotal * 100).toFixed(1)}%)`);
    
    this.emit('receive-progress', {
      transferId,
      received: transfer.receivedCount,
      total: actualTotal,
      percent: (transfer.receivedCount / actualTotal * 100).toFixed(1)
    });

    if (transfer.receivedCount === actualTotal) {
      console.log(`🎉 All ${actualTotal} chunks received! Assembling file...`);
      this.cleanupChunkTimeouts(transferId);
      this.assembleFile(transferId);
    } else {
      // Set timeout for missing chunks
      this.scheduleChunkTimeout(transferId, actualTotal);
    }
  }

  /**
   * Assemble received chunks into file
   */
  private assembleFile(transferId: string): void {
    const transfer = this.receivedChunks.get(transferId);
    
    if (!transfer) {
      console.error('❌ Transfer not found:', transferId);
      return;
    }

    console.log('📦 Assembling file:', transfer.filename);
    console.log('   Total chunks:', transfer.totalChunks);
    console.log('   Received count:', transfer.receivedCount);
    console.log('   Chunks array length:', transfer.chunks.filter((c: any) => c).length);
    
    // Filter out empty slots in sparse array
    const validChunks = transfer.chunks.filter((c: any) => c !== undefined && c !== null);
    
    console.log('   Valid chunks:', validChunks.length);
    
    // Check if we're in Node.js or Browser
    const isNodeEnv = typeof process !== 'undefined' && process.versions && process.versions.node;
    
    if (isNodeEnv) {
      // Node.js: create Buffer
      try {
        console.log('🔧 Node.js detected - creating Buffer');
        
        // Convert ArrayBuffers to Buffers
        const buffers = validChunks.map((chunk: ArrayBuffer) => {
          if (Buffer.isBuffer(chunk)) {
            console.log('  Chunk is already Buffer');
            return chunk;
          }
          console.log('  Converting ArrayBuffer to Buffer');
          return Buffer.from(chunk);
        });
        
        const buffer = Buffer.concat(buffers);
        
        console.log('✅ File assembled:', buffer.length, 'bytes');
        
        this.emit('file-received', {
          transferId,
          filename: transfer.filename,
          size: transfer.size,
          buffer
        });
      } catch (e) {
        console.error('❌ Error assembling file:', e);
      }
    } else {
      // Browser: create Blob
      console.log('🌐 Browser detected - creating Blob');
      const blob = new Blob(validChunks);
      
      this.emit('file-received', {
        transferId,
        filename: transfer.filename,
        size: transfer.size,
        blob
      });
    }

    this.receivedChunks.delete(transferId);
  }

  /**
   * Handle transfer complete
   */
  private handleTransferComplete(address: string, msg: any): void {
    const { transferId } = msg;
    console.log('🏁 Sender confirmed transfer complete');
    
    // Check if we have all chunks before considering complete
    const transfer = this.receivedChunks.get(transferId);
    if (transfer) {
      const missingChunks = this.getMissingChunks(transferId);
      if (missingChunks.length > 0) {
        console.log(`⚠️ Transfer marked complete but missing ${missingChunks.length} chunks:`, missingChunks);
        console.log('🔄 Requesting missing chunks...');
        this.requestMissingChunks(transferId, missingChunks);
      } else {
        console.log('✅ All chunks received, transfer truly complete');
        this.emit('sender-confirmed', transferId);
      }
    } else {
      this.emit('sender-confirmed', transferId);
    }
  }

  /**
   * Get list of missing chunks for a transfer
   */
  private getMissingChunks(transferId: string): number[] {
    const transfer = this.receivedChunks.get(transferId);
    if (!transfer) return [];

    const missingChunks: number[] = [];
    for (let i = 0; i < transfer.totalChunks; i++) {
      if (!transfer.chunks[i]) {
        missingChunks.push(i);
      }
    }
    return missingChunks;
  }

  /**
   * Request missing chunks from sender
   */
  private async requestMissingChunks(transferId: string, missingChunks: number[]): Promise<void> {
    console.log(`🔍 Requesting ${missingChunks.length} missing chunks for transfer ${transferId.slice(0, 8)}...`);
    
    // Find the sender address for this transfer
    const transfer = this.receivedChunks.get(transferId);
    if (!transfer || !transfer.senderAddress) {
      console.log('❌ No sender address found for transfer');
      return;
    }

    // Send chunk request message
    const message = {
      type: 'chunk-request',
      transferId,
      missingChunks
    };

    try {
      await this.sendMessage(message, transfer.senderAddress);
      console.log(`📤 Sent chunk request for ${missingChunks.length} chunks`);
      
      // Set timeout for chunk request
      const timeoutKey = `${transferId}-request`;
      if (this.chunkRequestTimeouts.has(timeoutKey)) {
        clearTimeout(this.chunkRequestTimeouts.get(timeoutKey)!);
      }
      
      this.chunkRequestTimeouts.set(timeoutKey, setTimeout(() => {
        console.log(`⏰ Chunk request timeout for transfer ${transferId.slice(0, 8)}...`);
        this.handleChunkRequestTimeout(transferId);
      }, this.chunkRequestDelay * 2));
      
    } catch (error) {
      console.error('❌ Failed to send chunk request:', error);
    }
  }

  /**
   * Handle chunk request timeout
   */
  private handleChunkRequestTimeout(transferId: string): void {
    const transfer = this.receivedChunks.get(transferId);
    if (!transfer) return;

    const missingChunks = this.getMissingChunks(transferId);
    if (missingChunks.length > 0) {
      console.log(`❌ Transfer ${transferId.slice(0, 8)}... failed - ${missingChunks.length} chunks still missing`);
      this.emit('transfer-failed', {
        transferId,
        reason: 'missing-chunks',
        missingChunks,
        filename: transfer.filename
      });
      
      // Clean up
      this.receivedChunks.delete(transferId);
      this.cleanupChunkTimeouts(transferId);
    }
  }

  /**
   * Handle incoming chunk request
   */
  private handleChunkRequest(address: string, msg: any): void {
    const { transferId, missingChunks } = msg;
    console.log(`📥 Received chunk request for transfer ${transferId.slice(0, 8)}...`);
    console.log(`   Missing chunks: ${missingChunks.join(', ')}`);

    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      console.log('❌ Transfer not found for chunk request');
      return;
    }

    if (transfer.completed) {
      console.log(`✅ Transfer completed, resending ${missingChunks.length} chunks...`);
    } else {
      console.log(`🔄 Transfer still active, resending ${missingChunks.length} chunks...`);
    }

    // Resend requested chunks
    this.resendChunks(transferId, missingChunks, address);
  }

  /**
   * Resend specific chunks
   */
  private async resendChunks(transferId: string, chunkIndices: number[], address: string): Promise<void> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;

    console.log(`🔄 Resending ${chunkIndices.length} chunks for transfer ${transferId.slice(0, 8)}...`);

    for (const chunkIndex of chunkIndices) {
      // Check if chunk is available in the saved chunks map
      const chunkData = transfer.chunks?.get(chunkIndex);
      if (chunkData) {
        try {
          const base64 = this.arrayBufferToBase64(chunkData);
          
          await this.sendMessage({
            type: 'file-chunk',
            transferId,
            index: chunkIndex,
            data: base64,
            total: transfer.chunks
          }, address);

          console.log(`✅ Resent chunk ${chunkIndex + 1}/${transfer.chunks} (${chunkData.length} bytes)`);
          
          // Small delay between chunks
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`❌ Failed to resend chunk ${chunkIndex}:`, error);
        }
      } else {
        console.log(`⚠️ Chunk ${chunkIndex} not available for resending`);
      }
    }
  }

  /**
   * Schedule timeout for missing chunks
   */
  private scheduleChunkTimeout(transferId: string, totalChunks: number): void {
    const timeoutKey = `${transferId}-chunk`;
    
    // Clear existing timeout
    if (this.chunkTimeouts.has(timeoutKey)) {
      clearTimeout(this.chunkTimeouts.get(timeoutKey)!);
    }
    
    // Set new timeout
    this.chunkTimeouts.set(timeoutKey, setTimeout(() => {
      const transfer = this.receivedChunks.get(transferId);
      if (!transfer) return;
      
      const missingChunks = this.getMissingChunks(transferId);
      if (missingChunks.length > 0) {
        console.log(`⏰ Chunk timeout for transfer ${transferId.slice(0, 8)}... - missing ${missingChunks.length} chunks`);
        console.log(`   Missing chunks: ${missingChunks.join(', ')}`);
        
        // Request missing chunks
        this.requestMissingChunks(transferId, missingChunks);
      }
    }, this.chunkRequestDelay));
  }

  /**
   * Clean up chunk timeouts for a transfer
   */
  private cleanupChunkTimeouts(transferId: string): void {
    // Clear chunk timeouts
    const chunkTimeoutKey = `${transferId}-chunk`;
    if (this.chunkTimeouts.has(chunkTimeoutKey)) {
      clearTimeout(this.chunkTimeouts.get(chunkTimeoutKey)!);
      this.chunkTimeouts.delete(chunkTimeoutKey);
    }

    // Clear request timeouts
    const requestTimeoutKey = `${transferId}-request`;
    if (this.chunkRequestTimeouts.has(requestTimeoutKey)) {
      clearTimeout(this.chunkRequestTimeouts.get(requestTimeoutKey)!);
      this.chunkRequestTimeouts.delete(requestTimeoutKey);
    }
  }

  /**
   * Start peer cleanup interval
   */
  private startPeerCleanup(): void {
    // Clean up offline peers every 30 seconds
    this.peerCleanupInterval = setInterval(() => {
      this.cleanupOfflinePeers();
    }, 30000);
  }

  /**
   * Clean up offline peers from GunDB
   */
  private cleanupOfflinePeers(): void {
    const now = Date.now();
    const peers = this.yumi.peers;
    const offlinePeers: string[] = [];

    // Check for peers that haven't been seen recently
    for (const [address, peerInfo] of Object.entries(peers)) {
      if (now - peerInfo.last > this.peerTimeout) {
        offlinePeers.push(address);
      }
    }

    if (offlinePeers.length > 0) {
      console.log(`🧹 Cleaning up ${offlinePeers.length} offline peers...`);
      
      // Remove offline peers from GunDB
      for (const address of offlinePeers) {
        // Remove from Gun graph
        this.yumi.gun
          .get('kunai-peers')
          .get(address)
          .put(null);
        
        // Remove from local peers map
        delete this.yumi.peers[address];
        
        console.log(`   Removed offline peer: ${address.slice(0, 12)}...`);
      }
      
      // Update connections count
      this.yumi._updateConnections();
    }
  }

  /**
   * Utility: ArrayBuffer to Base64 (Node.js compatible)
   */
  private arrayBufferToBase64(buffer: Uint8Array | ArrayBuffer): string {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    
    // Check if we're in Node.js environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      // Node.js: use Buffer
      return Buffer.from(bytes).toString('base64');
    } else {
      // Browser: use btoa
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }
  }

  /**
   * Utility: Base64 to ArrayBuffer (Node.js compatible)
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Check if we're in Node.js environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      // Node.js: use Buffer
      const buffer = Buffer.from(base64, 'base64');
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } else {
      // Browser: use atob
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }
  }

  /**
   * Get Yumi address
   */
  address(): string {
    return this.yumi.address();
  }

  /**
   * Destroy and cleanup
   */
  destroy(cb?: () => void): void {
    // Clear all timeouts
    this.chunkTimeouts.forEach(timeout => clearTimeout(timeout));
    this.chunkRequestTimeouts.forEach(timeout => clearTimeout(timeout));
    this.chunkTimeouts.clear();
    this.chunkRequestTimeouts.clear();

    // Clear peer cleanup interval
    if (this.peerCleanupInterval) {
      clearInterval(this.peerCleanupInterval);
      this.peerCleanupInterval = null;
    }

    // Clear all transfers
    this.transfers.clear();
    this.receivedChunks.clear();

    // Destroy Yumi
    this.yumi.destroy(cb);
  }
}

export default Kunai;

