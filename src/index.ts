/**
 * Yumi (弓) & Yari (槍) - P2P networking on GunDB
 * Main export file
 */

export { Yumi, BugoutGun } from './yumi.js';
export { Yari, Bugoff } from './yari.js';
export * from './types.js';

// Default exports
import { Yumi } from './yumi.js';
import { Yari } from './yari.js';

export default {
  Yumi,
  Yari,
  // Legacy aliases
  BugoutGun: Yumi,
  Bugoff: Yari
};

