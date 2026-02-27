export interface Author {
  authorId: string;
  name: string;
}

export interface Paper {
  paperId: string;
  title: string;
  authors: Author[];
  year: number;
  venue: string;
  externalIds: {
    DOI?: string;
    PubMed?: string;
    CorpusId?: string;
  };
  abstract: string;
  openAccessPdf?: {
    url: string;
    status: string;
  };
  citationCount: number;
  publicationTypes?: string[];
  relevance?: number; // Calculated or returned by API
}

export interface Filters {
  yearStart?: number;
  yearEnd?: number;
  authors?: string[];
  publicationTypes?: string[];
  excludeKeywords?: string[];
  includeKeywords?: string[];
  onlyOA?: boolean;
  sortBy?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  appliedFilters?: string; // Short description of filters applied
}

export interface SearchState {
  query: string;
  pool: Paper[];
  filters: Filters;
  selection: Set<string>;
  isSearching: boolean;
  error: string | null;
}
