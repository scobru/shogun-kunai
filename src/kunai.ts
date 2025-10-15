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

const CHUNK_SIZE = 10000; // 16KB chunks for GunDB compatibility
const CLEANUP_DELAY = 5000; // 5 seconds
const TRANSFER_TIMEOUT = 1 * 10 * 1000; // 10 second

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
  
  // Chunk cache for retransmission
  private chunkCache: Map<string, { chunks: Map<number, string>, metadata: any, timestamp: number }> = new Map();
  private CACHE_RETENTION = 5 * 60 * 1000; // Keep chunks for 5 minutes

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
    this.setupChunkRetransmission();
    this.startCacheCleanup();
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
   * Setup RPC handlers for chunk retransmission
   */
  private setupChunkRetransmission(): void {
    // Handle request for missing chunks
    this.yumi.register('request-chunks', (address: string, args: any, callback: (result: any) => void) => {
      const { fileId, missingChunks } = args;
      
      console.log(`📨 Received request for ${missingChunks.length} missing chunks from ${address.slice(0, 12)}...`);
      
      const cached = this.chunkCache.get(fileId);
      if (!cached) {
        console.log(`❌ No cached chunks for ${fileId}`);
        callback({ success: false, error: 'File not in cache' });
        return;
      }
      
      // Collect requested chunks
      const chunks: { index: number, data: string }[] = [];
      for (const index of missingChunks) {
        const chunkData = cached.chunks.get(index);
        if (chunkData) {
          chunks.push({ index, data: chunkData });
        }
      }
      
      console.log(`✅ Sending ${chunks.length} chunks to ${address.slice(0, 12)}...`);
      
      callback({
        success: true,
        fileId,
        chunks
      });
    });

    // Handle completion confirmation
    this.yumi.register('transfer-confirmed', (address: string, args: any, callback: (result: any) => void) => {
      const { fileId } = args;
      
      console.log(`✅ Transfer confirmed by ${address.slice(0, 12)}... for ${fileId}`);
      
      // Remove from cache
      this.chunkCache.delete(fileId);
      
      callback({ success: true });
    });
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const toDelete: string[] = [];
      
      for (const [fileId, cached] of this.chunkCache.entries()) {
        if (now - cached.timestamp > this.CACHE_RETENTION) {
          toDelete.push(fileId);
        }
      }
      
      for (const fileId of toDelete) {
        console.log(`🗑️ Cleaning up cached chunks for ${fileId}`);
        this.chunkCache.delete(fileId);
      }
    }, 60000); // Check every minute
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
          
          // Before reassembling, perform a comprehensive final sweep to catch any missed chunks
          console.log(`🔍 Performing final sweep for missing chunks...`);
          
          // Do multiple passes to ensure we get everything (GunDB can be slow/async)
          let sweepAttempts = 0;
          const maxSweeps = 5; // More sweeps = better chance to find missing chunks
          
          const performSweep = () => {
            sweepAttempts++;
            const missingBefore = metadata.totalChunks - collectedChunks;
            
            this.yumi.gun.get('chunks').get(fileId).map().once((chunk: any, chunkId: any) => {
              if (chunk && typeof chunk.index !== 'undefined' && chunk.data && !receivedChunks[chunk.index]) {
                receivedChunks[chunk.index] = chunk.data;
                collectedChunks++;
              }
            });
            
            setTimeout(() => {
              const missingAfter = metadata.totalChunks - collectedChunks;
              const foundInSweep = missingBefore - missingAfter;
              
              if (foundInSweep > 0) {
                console.log(`🔄 Sweep ${sweepAttempts}: Found ${foundInSweep} more chunks, ${missingAfter} still missing.`);
              } else {
                console.log(`🔍 Sweep ${sweepAttempts}: No new chunks found, ${missingAfter} still missing.`);
              }
              
              // Always do all sweeps, even if we're not finding chunks (GunDB can be slow)
              if (missingAfter > 0 && sweepAttempts < maxSweeps) {
                console.log(`🔄 Continuing sweep ${sweepAttempts + 1}/${maxSweeps}...`);
                performSweep();
              } else {
                // Final reassembly attempt
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
                  console.log(`🎉 All chunks available after ${sweepAttempts} sweep(s), reassembling ${metadata.name}...`);
                  this.reassembleFile(base64String, metadata, fileId);
                } else {
                  console.log(`❌ Cannot reassemble ${metadata.name} - still missing ${missingChunks.length} chunks after ${sweepAttempts} sweeps.`);
                  console.log(`Missing chunk indices: ${missingChunks.slice(0, 10).join(', ')}${missingChunks.length > 10 ? '...' : ''}`);
                  isProcessing = false;
                }
              }
            }, 2000); // 2 second delay between sweeps to give GunDB time
          };
          
          performSweep();
        }
      });
      
      // Set timeout to force completion if chunks are missing
      // With 5ms per chunk upload, expect completion within chunks * 5ms + network latency
      // Give it 3x the expected time to account for network delays
      const expectedDuration = metadata.totalChunks * 5; // 5ms per chunk
      const timeoutDuration = Math.max(15000, expectedDuration * 3); // At least 15s, or 3x expected duration
      timeoutId = setTimeout(() => {
        if (!isProcessing && collectedChunks > 0) {
          console.log(`⏰ Timeout reached for ${metadata.name}. Attempting reassembly with ${collectedChunks}/${metadata.totalChunks} chunks...`);
          isProcessing = true;
          
          // CRITICAL: Detach this chunk listener on timeout as well
          if (chunkListener && typeof chunkListener.off === 'function') {
            chunkListener.off();
          }

          // On timeout, perform comprehensive sweeps to recover missing chunks
          console.log(`🔍 Timeout: Performing final sweeps for ${metadata.totalChunks - collectedChunks} missing chunks...`);
          
          let sweepAttempts = 0;
          const maxSweeps = 5; // More sweeps = better chance to find missing chunks
          
          const performTimeoutSweep = () => {
            sweepAttempts++;
            const missingBefore = metadata.totalChunks - collectedChunks;
            
            this.yumi.gun.get('chunks').get(fileId).map().once((chunk: any, chunkId: any) => {
              if (chunk && typeof chunk.index !== 'undefined' && chunk.data && !receivedChunks[chunk.index]) {
                receivedChunks[chunk.index] = chunk.data;
                collectedChunks++;
              }
            });
            
            setTimeout(async () => {
              const missingAfter = metadata.totalChunks - collectedChunks;
              const foundInSweep = missingBefore - missingAfter;
              
              if (foundInSweep > 0) {
                console.log(`🔄 Timeout sweep ${sweepAttempts}: Found ${foundInSweep} more chunks, ${missingAfter} still missing.`);
              } else {
                console.log(`🔍 Timeout sweep ${sweepAttempts}: No new chunks found, ${missingAfter} still missing.`);
              }
              
              // Always do all sweeps, even if we're not finding chunks (GunDB can be slow)
              if (missingAfter > 0 && sweepAttempts < maxSweeps) {
                console.log(`🔄 Continuing timeout sweep ${sweepAttempts + 1}/${maxSweeps}...`);
                performTimeoutSweep();
              } else {
                // After all sweeps, check if we still have missing chunks
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
                  console.log(`✅ All chunks recovered after ${sweepAttempts} timeout sweep(s), reassembling ${metadata.name}...`);
                  this.reassembleFile(base64String, metadata, fileId);
                  
                  // Notify sender of successful transfer
                  if (metadata.sender) {
                    this.yumi.rpc(metadata.sender, 'transfer-confirmed', { fileId }, () => {});
                  }
                } else {
                  // Try to request missing chunks from sender via RPC
                  console.log(`🔄 Requesting ${missingChunks.length} missing chunks from sender...`);
                  
                  if (metadata.sender && this.yumi.peers[metadata.sender]) {
                    try {
                      await this.requestMissingChunks(metadata.sender, fileId, missingChunks, receivedChunks, metadata);
                    } catch (error) {
                      console.log(`❌ Failed to request chunks: ${(error as Error).message}`);
                      console.log(`❌ Cannot complete transfer after timeout`);
                      isProcessing = false;
                    }
                  } else {
                    console.log(`❌ Sender not available for chunk retransmission`);
                    console.log(`❌ Missing ${missingChunks.length} chunks for ${metadata.name}: ${missingChunks.slice(0, 10).join(', ')}${missingChunks.length > 10 ? '...' : ''}`);
                    console.log(`❌ Cannot complete transfer after timeout`);
                    isProcessing = false;
                  }
                }
              }
            }, 2000); // 2 second delay between sweeps to give GunDB time
          };
          
          performTimeoutSweep();
        }
      }, timeoutDuration);
    });
  }


  /**
   * Request missing chunks from sender
   */
  private async requestMissingChunks(
    senderAddress: string,
    fileId: string,
    missingChunks: number[],
    receivedChunks: { [key: number]: string },
    metadata: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`📨 Requesting ${missingChunks.length} chunks from ${senderAddress.slice(0, 12)}...`);
      
      this.yumi.rpc(senderAddress, 'request-chunks', 
        { fileId, missingChunks },
        (response: any) => {
          if (!response.success) {
            reject(new Error(response.error || 'Failed to get chunks'));
            return;
          }
          
          console.log(`📥 Received ${response.chunks.length} missing chunks`);
          
          // Add missing chunks to received chunks
          for (const chunk of response.chunks) {
            receivedChunks[chunk.index] = chunk.data;
          }
          
          // Check if we now have all chunks
          let allChunksPresent = true;
          let base64String = '';
          const stillMissing: number[] = [];
          
          for (let i = 0; i < metadata.totalChunks; i++) {
            if (receivedChunks[i]) {
              base64String += receivedChunks[i];
            } else {
              stillMissing.push(i);
              allChunksPresent = false;
            }
          }
          
          if (allChunksPresent) {
            console.log(`✅ All chunks received after retransmission! Reassembling ${metadata.name}...`);
            this.reassembleFile(base64String, metadata, fileId);
            
            // Notify sender of successful transfer
            this.yumi.rpc(senderAddress, 'transfer-confirmed', { fileId }, () => {});
            
            resolve();
          } else {
            reject(new Error(`Still missing ${stillMissing.length} chunks: ${stillMissing.slice(0, 10).join(', ')}`));
          }
        }
      );
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

    // 2. Cache chunks for retransmission
    const chunksMap = new Map<number, string>();

    // 3. Save all the chunks (batch processing to avoid stack overflow)
    const fileChunksNode = this.yumi.gun.get('chunks').get(fileId);
    const batchSize = 1; // MUST be 1 to prevent GunDB stack overflow
    const batchDelay = 5; // 5ms delay between chunks (fast enough, prevents stack overflow)
    
    for (let batchStart = 0; batchStart < totalChunks; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalChunks);
      
      // Process chunks in this batch
      for (let i = batchStart; i < batchEnd; i++) {
        const chunk = base64Data.slice(i * this.chunkSize, (i + 1) * this.chunkSize);
        
        // Store in cache for retransmission
        chunksMap.set(i, chunk);
        
        const chunkData = {
          index: i,
          data: chunk,
          timestamp: Date.now(),
          fileId: fileId // Include fileId for reference
        };
        
        // Use .set() so .map() can find it, but we control flow with batching
        fileChunksNode.set(chunkData);
      }
      
      // Show progress every 10% or every 100 chunks
      if (batchEnd % Math.max(1, Math.floor(totalChunks / 10)) === 0 || 
          batchEnd % 100 === 0 || 
          batchEnd === totalChunks) {
        const progress = Math.round((batchEnd / totalChunks) * 100);
        console.log(`📤 Upload progress: ${progress}% (${batchEnd}/${totalChunks} chunks)`);
      }
      
      // Critical delay to prevent GunDB stack overflow - allows event loop to clear
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }

    // 4. Store in cache for retransmission requests
    this.chunkCache.set(fileId, {
      chunks: chunksMap,
      metadata,
      timestamp: Date.now()
    });

    console.log(`✅ File uploaded to GunDB: ${fileId}`);
    console.log(`💾 Cached ${chunksMap.size} chunks for retransmission (retention: ${this.CACHE_RETENTION / 60000} min)`);
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
   * Send simple message (uses Yari if encrypted, Yumi if plain)
   */
  async send(message: any): Promise<void>;
  async send(address: string, message: any): Promise<void>;
  async send(addressOrMessage: string | any, message?: any): Promise<void> {
    if (this.encrypted && this.yari) {
      // Use Yari for encrypted messaging
      if (message === undefined) {
        // Broadcast encrypted message
        await this.yari.send(addressOrMessage);
      } else {
        // Direct encrypted message
        await this.yari.send(addressOrMessage, message);
      }
    } else {
      // Use Yumi for plain messaging
      if (message === undefined) {
        // Broadcast message
        this.yumi.send(addressOrMessage);
      } else {
        // Direct message
        this.yumi.send(addressOrMessage, message);
      }
    }
  }

  /**
   * Listen for messages (uses appropriate event based on encryption)
   */
  onMessage(callback: (address: string, message: any) => void): void {
    if (this.encrypted && this.yari) {
      // Listen for decrypted messages
      this.yari.on('decrypted', (address: string, _pubkeys: any, message: any) => {
        callback(address, message);
      });
    } else {
      // Listen for plain messages
      this.yumi.on('message', (address: string, message: any) => {
        callback(address, message);
      });
    }
  }

  /**
   * Get peer count
   */
  connections(): number {
    return this.yumi.connections();
  }

  /**
   * Ping peers
   */
  ping(): void {
    this.yumi.ping();
  }

  /**
   * Register RPC function
   */
  register(name: string, fn: (address: string, args: any, callback: (result: any) => void) => void, docstring?: string): void {
    this.yumi.register(name, fn, docstring);
  }

  /**
   * Call RPC function on peer
   */
  rpc(address: string, call: string, args: any, callback: (result: any) => void): void {
    this.yumi.rpc(address, call, args, callback);
  }

  /**
   * Destroy and cleanup
   */
  destroy(cb?: () => void): void {
    // Clear chunk cache
    this.chunkCache.clear();
    
    // Destroy Yumi (or Yari, which will destroy Yumi)
    if (this.yari) {
      this.yari.destroy();
    } else {
      this.yumi.destroy(cb);
    }
  }
}

export default Kunai;