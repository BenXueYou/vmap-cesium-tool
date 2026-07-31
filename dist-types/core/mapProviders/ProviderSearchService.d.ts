import type { BaseMapConfig, BaseMapProviderId, MapAuthConfig, MapServiceValidationCode } from './types';
import type { ProviderSearchOptions, SearchResult } from '../types';
import { normalizeMapAuth, type ResolvedMapService } from './mapService';
export declare class ProviderSearchError extends Error {
    readonly provider: BaseMapProviderId;
    readonly code: MapServiceValidationCode;
    readonly status?: number;
    readonly retryable: boolean;
    constructor(provider: BaseMapProviderId, code: MapServiceValidationCode, message: string, options?: {
        status?: number;
        retryable?: boolean;
        cause?: unknown;
    });
}
export declare function createAmapSignature(params: Record<string, string>, securityKey: string): string;
export declare class ProviderSearchService {
    private options;
    constructor(options?: ProviderSearchOptions);
    search(query: string, service: ResolvedMapService): Promise<SearchResult[]>;
    search(query: string, baseMap: BaseMapConfig, mapAuth?: MapAuthConfig): Promise<SearchResult[]>;
    private resolveService;
    private buildRequest;
    private normalizeResults;
}
export { normalizeMapAuth };
