import type { BaseMapConfig, MapAuthConfig } from './types';
import type { ProviderSearchOptions, SearchResult } from '../types';
export declare function normalizeMapAuth(mapAuth?: MapAuthConfig): MapAuthConfig | undefined;
export declare function createAmapSignature(params: Record<string, string>, securityKey: string): string;
export declare class ProviderSearchService {
    private options;
    constructor(options?: ProviderSearchOptions);
    search(query: string, baseMap: BaseMapConfig, mapAuth?: MapAuthConfig): Promise<SearchResult[]>;
    private buildUrl;
    private normalizeResults;
}
