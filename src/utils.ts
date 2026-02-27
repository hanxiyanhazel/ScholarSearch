import { Paper, Filters } from "./types";

export function applyFilters(papers: Paper[], filters: Filters): Paper[] {
  return papers.filter(paper => {
    // Year filter
    if (filters.yearStart && paper.year < filters.yearStart) return false;
    if (filters.yearEnd && paper.year > filters.yearEnd) return false;

    // OA filter
    if (filters.onlyOA && !paper.openAccessPdf?.url) return false;

    // Publication Type filter
    if (filters.publicationTypes && filters.publicationTypes.length > 0) {
      const types = paper.publicationTypes || [];
      if (!filters.publicationTypes.some(t => types.includes(t))) return false;
    }

    // Author filter
    if (filters.authors && filters.authors.length > 0) {
      const authorNames = paper.authors.map(a => a.name.toLowerCase());
      if (!filters.authors.some(a => authorNames.some(name => name.includes(a.toLowerCase())))) return false;
    }

    // Exclude keywords
    if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
      const text = (paper.title + " " + paper.abstract).toLowerCase();
      if (filters.excludeKeywords.some(k => text.includes(k.toLowerCase()))) return false;
    }

    // Include keywords
    if (filters.includeKeywords && filters.includeKeywords.length > 0) {
      const text = (paper.title + " " + paper.abstract).toLowerCase();
      if (!filters.includeKeywords.every(k => text.includes(k.toLowerCase()))) return false;
    }

    return true;
  });
}
