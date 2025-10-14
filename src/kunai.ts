/**
 * Kunai (苦無) - GunDB File Transfer
 * TypeScript implementation
 * 
 * Kunai = ninja throwing knife in Japanese - fast, precise file transfers
 * Uses GunDB for decentralized file transfer with chunking
 */

import { Yumi } from './yumi.js';
import { Yari } from './yari.js';
import { YumiOptions } from './types.js';
import { EventEmitter } from 'events';

const CHUNK_SIZE = 16000; // 16KB chunks for GunDB compatibility
const CLEANUP_DELAY = 5000; // 5 seconds
const TRANSFER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export interface KunaiOptions extends YumiOptions {
  chunkSize?: number;
  cleanupDelay?: number;
  transferTimeout?: number;
  encrypted?: boolean;  // Use Yari for E2E encryption
  channel?: string;     // Custom channel (like identifier in Yumi/Yari)
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
 * Kunai (苦無) - GunDB File Transfer
 */
export class Kunai extends EventEmitter {
  private yumi: Yumi;
  private yari: Yari | null = null;
  private encrypted: boolean;
  private channel: string;
  private chunkSize: number;
  private cleanupDelay: number;
  private transferTimeout: number;

  constructor(identifier?: string, opts?: KunaiOptions) {
    super();
    
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
  }

  private setupHandlers(): void {
    this.yumi.on('ready', () => {
      this.emit('ready');
      
      // Setup GunDB file transfer listeners
      this.setupGunDBFileListeners();
    });

    this.yumi.on('connections', (count: number) => {
      this.emit('connections', count);
    });
  }

  /**
   * Setup GunDB file transfer listeners
   */
  private setupGunDBFileListeners(): void {
    console.log('📁 Setting up GunDB file transfer listeners...');
    
    // Listen for all files (not just new ones)
    this.yumi.gun.get('files').map().on((metadata: any, fileId: any) => {
      if (!metadata || metadata.sender === this.address()) return; // Skip own files
      
      console.log(`📥 File detected: ${metadata.name} (${metadata.totalChunks} chunks)`);
      
      // Check if we already processed this file
      const processedKey = `processed-${fileId}`;
      if (this.yumi.gun.get(processedKey).put) {
        this.yumi.gun.get(processedKey).put(true);
      }
      
      let receivedChunks: { [key: number]: string } = {};
      let collectedChunks = 0;
      let isProcessing = false;
      
      // Listen for chunks of this file
      this.yumi.gun.get('chunks').get(fileId).map().on((chunk: any) => {
        if (chunk && typeof chunk.index !== 'undefined' && chunk.data && !isProcessing) {
          if (!receivedChunks[chunk.index]) {
            receivedChunks[chunk.index] = chunk.data;
            collectedChunks++;
            
            console.log(`📦 Received chunk ${chunk.index + 1}/${metadata.totalChunks} for ${metadata.name}`);
          }
          
          // If all chunks received, reassemble file
          if (collectedChunks === metadata.totalChunks) {
            isProcessing = true;
            console.log(`✅ All chunks received for ${metadata.name}. Reassembling...`);
            
            // Rebuild the Base64 string in correct order
            let base64String = '';
            let allChunksPresent = true;
            for (let i = 0; i < metadata.totalChunks; i++) {
              if (receivedChunks[i]) {
                base64String += receivedChunks[i];
              } else {
                console.log(`❌ Missing chunk ${i} for ${metadata.name}`);
                allChunksPresent = false;
                break;
              }
            }
            
            if (!allChunksPresent) {
              console.log(`❌ Cannot reassemble ${metadata.name} - missing chunks`);
              isProcessing = false;
              return;
            }
            
            try {
              // Convert back to ArrayBuffer (Node.js compatible)
              let bytes: Uint8Array;
              if (typeof process !== 'undefined' && process.versions && process.versions.node) {
                // Node.js: use Buffer
                bytes = new Uint8Array(Buffer.from(base64String, 'base64'));
              } else {
                // Browser: use atob
                const binaryString = atob(base64String);
                bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
              }
              
              // Emit file received event
              this.emit('file-received', {
                filename: metadata.name,
                size: metadata.size,
                data: bytes.buffer,
                fileId: fileId
              });
              
              console.log(`🎉 File received successfully: ${metadata.name} (${metadata.size} bytes)`);
            } catch (error) {
              console.error(`❌ Error decoding file ${metadata.name}:`, error);
            }
          }
        }
      });
    });
  }

  /**
   * Send file via GunDB (decentralized approach)
   */
  async sendFile(file: File | { name: string; size: number }, data?: ArrayBuffer | Uint8Array): Promise<string> {
    if (!data) {
      throw new Error('File data is required for GunDB transfer');
    }

    const fileId = this.generateTransferCode();
    const base64Data = this.arrayBufferToBase64(data);
    const totalChunks = Math.ceil(base64Data.length / this.chunkSize);

    console.log(`📤 Sending file via GunDB: ${file.name} (${totalChunks} chunks)`);

    // 1. Save metadata first
    const metadata = {
      name: file.name,
      type: (file as any).type || 'application/octet-stream',
      size: file.size,
      totalChunks: totalChunks,
      timestamp: Date.now(),
      sender: this.address()
    };
    
    console.log('💾 Saving metadata to GunDB:', metadata);
    this.yumi.gun.get('files').get(fileId).put(metadata);

    // 2. Save all the chunks
    const fileChunksNode = this.yumi.gun.get('chunks').get(fileId);
    for (let i = 0; i < totalChunks; i++) {
      const chunk = base64Data.slice(i * this.chunkSize, (i + 1) * this.chunkSize);
      const chunkData = {
        index: i,
        data: chunk,
        timestamp: Date.now()
      };
      
      console.log(`💾 Saving chunk ${i + 1}/${totalChunks} (${chunk.length} chars)`);
      fileChunksNode.set(chunkData);
    }

    console.log(`✅ File uploaded to GunDB: ${fileId}`);
    this.emit('transfer-complete', fileId);
    
    return fileId;
  }

  /**
   * Generate transfer code
   */
  private generateTransferCode(): string {
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
   * Get Yumi address
   */
  address(): string {
    return this.yumi.address();
  }

  /**
   * Force check for existing files
   */
  checkExistingFiles(): void {
    console.log('🔍 Checking for existing files...');
    let foundFiles = 0;
    
    this.yumi.gun.get('files').map().on((metadata: any, fileId: any) => {
      if (metadata && metadata.sender !== this.address()) {
        foundFiles++;
        console.log(`📁 Found existing file: ${metadata.name} (${metadata.totalChunks} chunks) - ID: ${fileId}`);
      }
    });
    
    // After a short delay, show summary
    setTimeout(() => {
      if (foundFiles === 0) {
        console.log('📭 No existing files found');
      } else {
        console.log(`📊 Total files found: ${foundFiles}`);
      }
    }, 1000);
  }

  /**
   * Destroy and cleanup
   */
  destroy(cb?: () => void): void {
    // Destroy Yumi
    this.yumi.destroy(cb);
  }
}

export default Kunai;