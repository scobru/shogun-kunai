/**
 * Yumi (弓) & Yari (槍) & Kunai (苦無) - P2P networking on GunDB
 * Main export file
 */

export { Yumi } from './yumi.js';
export { Yari } from './yari.js';
export { Kunai } from './kunai.js';
export * from './types.js';

// Default exports
import { Yumi } from './yumi.js';
import { Yari } from './yari.js';
import { Kunai } from './kunai.js';

export default {
  Yumi,
  Yari,
  Kunai,
  // Legacy aliases
  BugoutGun: Yumi,
  Bugoff: Yari
};

