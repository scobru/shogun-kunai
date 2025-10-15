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
const TRANSFER_TIMEOUT = 1 * 10 * 1000; // 1 second

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
    
    const processedFiles = new Set<string>(); // Track processed files to avoid duplicates
    
    // Listen for all files (not just new ones)
    this.yumi.gun.get('files').map().on((metadata: any, fileId: any) => {
      if (!metadata || metadata.sender === this.address()) return; // Skip own files
      if (processedFiles.has(fileId)) return; // Skip already processed files
      
      processedFiles.add(fileId);
      console.log(`📥 File detected: ${metadata.name} (${metadata.totalChunks} chunks)`);
      
      let receivedChunks: { [key: number]: string } = {};
      let collectedChunks = 0;
      let isProcessing = false;
      let timeoutId: NodeJS.Timeout | null = null;
      const processedChunkIds = new Set<string>(); // Track processed chunks to avoid duplicates
      
      // Listen for chunks of this file using .map() with strict deduplication
      const chunkListener = this.yumi.gun.get('chunks').get(fileId).map().on((chunk: any, chunkId: any) => {
        // Prevent infinite loops and duplicate processing
        if (!chunk || typeof chunk.index === 'undefined' || !chunk.data) return;
        if (isProcessing) return;
        if (processedChunkIds.has(chunkId)) return;
        
        processedChunkIds.add(chunkId);
        
        if (!receivedChunks[chunk.index]) {
          receivedChunks[chunk.index] = chunk.data;
          collectedChunks++;
          
          // Show progress every 10% or every 100 chunks
          if (collectedChunks % Math.max(1, Math.floor(metadata.totalChunks / 10)) === 0 || 
              collectedChunks % 100 === 0) {
            const progress = Math.round((collectedChunks / metadata.totalChunks) * 100);
            console.log(`📦 Progress: ${progress}% (${collectedChunks}/${metadata.totalChunks})`);
          }
        }
        
        // If all chunks received, reassemble file
        if (collectedChunks >= metadata.totalChunks) {
          isProcessing = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // CRITICAL: Detach this chunk listener once complete
          if (chunkListener && typeof chunkListener.off === 'function') {
            chunkListener.off();
          }
          
          // Before reassembling, perform a final check to ensure all chunks are present
          this.yumi.gun.get('chunks').get(fileId).map().once((chunk: any, chunkId: any) => {
            if (chunk && typeof chunk.index !== 'undefined' && chunk.data && !receivedChunks[chunk.index]) {
              receivedChunks[chunk.index] = chunk.data;
              collectedChunks++;
            }
          });

          // Give GunDB a moment to process the .once() request
          setTimeout(() => {
            let base64String = '';
            let allChunksPresent = true;
            const missingChunks: number[] = [];

            for (let i = 0; i < metadata.totalChunks; i++) {
              if (receivedChunks[i]) {
                base64String += receivedChunks[i];
              } else {
                missingChunks.push(i);
                allChunksPresent = false;
              }
            }
            
            if (allChunksPresent) {
              console.log(`🎉 All chunks available, reassembling ${metadata.name}...`);
              this.reassembleFile(base64String, metadata, fileId);
            } else {
              console.log(`❌ Cannot reassemble ${metadata.name} - still missing ${missingChunks.length} chunks after final check.`);
              console.log(`Missing chunk indices: ${missingChunks.slice(0, 10).join(', ')}${missingChunks.length > 10 ? '...' : ''}`);
              isProcessing = false;
            }
          }, 1000); // 1 second delay for .once() to complete
        }
      });
      
      // Set timeout to force completion if chunks are missing (longer timeout for large files)
      // Account for batch delays: 10 chunks per batch × 50ms = ~5s per 1000 chunks
      const timeoutDuration = Math.max(60000, metadata.totalChunks * 100); // At least 60s, or 100ms per chunk
      timeoutId = setTimeout(() => {
        if (!isProcessing && collectedChunks > 0) {
          console.log(`⏰ Timeout reached for ${metadata.name}. Attempting reassembly with ${collectedChunks}/${metadata.totalChunks} chunks...`);
          isProcessing = true;
          
          // CRITICAL: Detach this chunk listener on timeout as well
          if (chunkListener && typeof chunkListener.off === 'function') {
            chunkListener.off();
          }

          // On timeout, perform a final check for all chunks before attempting reassembly
          this.yumi.gun.get('chunks').get(fileId).map().once((chunk: any, chunkId: any) => {
            if (chunk && typeof chunk.index !== 'undefined' && chunk.data && !receivedChunks[chunk.index]) {
              receivedChunks[chunk.index] = chunk.data;
              collectedChunks++;
            }
          });

          setTimeout(() => {
            let base64String = '';
            let missingChunks: number[] = [];
            let allChunksPresent = true;

            for (let i = 0; i < metadata.totalChunks; i++) {
              if (receivedChunks[i]) {
                base64String += receivedChunks[i];
              } else {
                missingChunks.push(i);
                allChunksPresent = false;
              }
            }
            
            if (allChunksPresent) {
              console.log(`✅ All chunks available after timeout recheck, reassembling ${metadata.name}...`);
              this.reassembleFile(base64String, metadata, fileId);
            } else {
              console.log(`❌ Missing ${missingChunks.length} chunks for ${metadata.name}: ${missingChunks.slice(0, 10).join(', ')}${missingChunks.length > 10 ? '...' : ''}`);
              console.log(`❌ Cannot complete transfer after timeout`);
              isProcessing = false;
            }
          }, 1000); // 1 second delay for .once() to complete
        }
      }, timeoutDuration);
    });
  }


  /**
   * Reassemble file from Base64 string
   */
  private reassembleFile(base64String: string, metadata: any, fileId: string): void {
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
      
      console.log(`🎉 File received: ${metadata.name} (${this.formatSize(metadata.size)})`);
    } catch (error) {
      console.error(`❌ Error decoding file ${metadata.name}:`, error);
    }
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
    
    this.yumi.gun.get('files').get(fileId).put(metadata);

    // 2. Save all the chunks (batch processing to avoid stack overflow)
    const fileChunksNode = this.yumi.gun.get('chunks').get(fileId);
    const batchSize = 10; // Small batch size to prevent stack overflow
    const batchDelay = 50; // 50ms delay between batches (prevents stack overflow while keeping transfer fast)
    
    for (let batchStart = 0; batchStart < totalChunks; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalChunks);
      
      // Process chunks in this batch
      const chunkPromises = [];
      for (let i = batchStart; i < batchEnd; i++) {
        const chunk = base64Data.slice(i * this.chunkSize, (i + 1) * this.chunkSize);
        const chunkData = {
          index: i,
          data: chunk,
          timestamp: Date.now(),
          fileId: fileId // Include fileId for reference
        };
        
        // Use .set() so .map() can find it, but we control flow with batching
        fileChunksNode.set(chunkData);
      }
      
      // Show progress
      if (batchEnd % 100 === 0 || batchEnd === totalChunks) {
        const progress = Math.round((batchEnd / totalChunks) * 100);
        console.log(`📤 Upload progress: ${progress}% (${batchEnd}/${totalChunks} chunks)`);
      }
      
      // Delay between batches to prevent stack overflow and allow GunDB to sync
      await new Promise(resolve => setTimeout(resolve, batchDelay));
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
   * Format file size
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
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
    const fileList: any[] = [];
    
    // Use .once() to prevent persistent listeners
    this.yumi.gun.get('files').map().once((metadata: any, fileId: any) => {
      if (metadata && metadata.sender !== this.address()) {
        foundFiles++;
        fileList.push({ metadata, fileId });
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