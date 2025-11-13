/**
 * Repository System Exports
 * Clean Supabase-only data access layer
 */

// Main service
export { repositoryService, RepositoryService } from './RepositoryService';

// Repository classes
export { CalendarRepository } from './repositories/CalendarRepository';
export { TradeRepository } from './repositories/TradeRepository';
export { EconomicEventRepository } from './repositories/EconomicEventRepository';
export { ShareRepository, shareRepository } from './repositories/ShareRepository';
export { AbstractBaseRepository } from './repositories/BaseRepository';

// Types and interfaces
export type {
  RepositoryResult,
  RepositoryConfig,
  BaseRepository
} from './repositories/BaseRepository';

export type {
  PaginationOptions,
  PaginatedResult,
  EconomicEventFilters
} from './repositories/EconomicEventRepository';

 
