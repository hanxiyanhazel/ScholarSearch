import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  RotateCcw, 
  Search, 
  Download, 
  X, 
  ChevronRight, 
  FileText, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  ArrowUpDown,
  Copy,
  Plus,
  Minus
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';

import { Paper, Filters, Message, SearchState } from './types';
import { parseQuery, summarizePaper } from './services/gemini';
import { searchPapers, downloadZip } from './services/api';
import { applyFilters } from './utils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [state, setState] = useState<SearchState>({
    query: '',
    pool: [],
    filters: {},
    selection: new Set(),
    isSearching: false,
    error: null,
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your Literature Assistant. Ask me to find papers on any topic, and I'll help you filter and download them. \n\nExample: *'Find papers on CRISPR methods in the last 5 years'*",
      timestamp: Date.now(),
    }
  ]);

  const [input, setInput] = useState('');
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Paper; direction: 'asc' | 'desc' }>({
    key: 'year',
    direction: 'desc'
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredPapers = useMemo(() => {
    let result = applyFilters(state.pool, state.filters);
    
    // Sorting
    result.sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA === undefined || valB === undefined) return 0;
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [state.pool, state.filters, sortConfig]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setState(prev => ({ ...prev, isSearching: true, error: null }));

    try {
      const { searchQuery, newFilters, explanation } = await parseQuery(text, state.filters);
      
      let newPool = state.pool;
      if (searchQuery && searchQuery !== state.query) {
        newPool = await searchPapers(searchQuery);
      }

      setState(prev => ({
        ...prev,
        query: searchQuery || prev.query,
        pool: newPool,
        filters: newFilters,
        isSearching: false
      }));

      if (newFilters.sortBy) {
        setSortConfig({ key: newFilters.sortBy as any, direction: 'desc' });
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: explanation,
        timestamp: Date.now(),
        appliedFilters: explanation
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (err: any) {
      setState(prev => ({ ...prev, isSearching: false, error: err.message }));
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error processing your request.",
        timestamp: Date.now()
      }]);
    }
  };

  const toggleSelection = (id: string) => {
    setState(prev => {
      const next = new Set(prev.selection);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, selection: next };
    });
  };

  const selectAllDownloadable = () => {
    const downloadable = filteredPapers.filter(p => p.openAccessPdf?.url).map(p => p.paperId);
    setState(prev => ({ ...prev, selection: new Set(downloadable) }));
  };

  const handleDownload = async () => {
    const selectedPapers = state.pool.filter(p => state.selection.has(p.paperId) && p.openAccessPdf?.url);
    if (selectedPapers.length === 0) return;

    setIsDownloading(true);
    try {
      await downloadZip(selectedPapers.map(p => ({
        title: p.title,
        pdfUrl: p.openAccessPdf!.url
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  const removeFilter = (key: keyof Filters, value?: any) => {
    setState(prev => {
      const nextFilters = { ...prev.filters } as any;
      if (Array.isArray(nextFilters[key])) {
        nextFilters[key] = nextFilters[key].filter((v: any) => v !== value);
        if (nextFilters[key].length === 0) delete nextFilters[key];
      } else {
        delete nextFilters[key];
      }
      return { ...prev, filters: nextFilters as Filters };
    });
  };

  const resetSession = () => {
    setState({
      query: '',
      pool: [],
      filters: {},
      selection: new Set(),
      isSearching: false,
      error: null,
    });
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: "Session reset. How can I help you today?",
      timestamp: Date.now(),
    }]);
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      {/* Left Panel: Chat */}
      <div className="w-[35%] border-r border-slate-200 flex flex-col h-full bg-slate-50/30">
        <div className="p-4 border-bottom border-slate-200 flex justify-between items-center bg-white">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Literature Chat
            </h1>
            <p className="text-xs text-slate-500">Pool: {state.pool.length} papers</p>
          </div>
          <button 
            onClick={resetSession}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            title="Reset Session"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "max-w-[85%] p-3 rounded-xl text-sm leading-relaxed",
                  msg.role === 'user' 
                    ? "ml-auto bg-slate-200 text-slate-800" 
                    : "mr-auto bg-white border border-slate-200 shadow-sm"
                )}
              >
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.appliedFilters && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-indigo-600 font-medium italic">
                    {msg.appliedFilters}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
            {["Only OA", "Only Reviews", "Exclude Animal", "Sort by Citations"].map(chip => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                className="whitespace-nowrap px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full transition-colors border border-slate-200"
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask for papers..."
              className="w-full p-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-sm min-h-[80px]"
            />
            <button
              onClick={() => handleSend()}
              disabled={state.isSearching || !input.trim()}
              className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Query Summary Bar */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">Query:</span>
              <span className="font-medium">{state.query || 'None'}</span>
            </div>
            <div className="h-4 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">Range:</span>
              <span className="font-medium">
                {state.filters.yearStart || 'Any'} – {state.filters.yearEnd || 'Any'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button 
              onClick={() => handleSend(state.query)}
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-100 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* Filter Chips Row */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-2 min-h-[40px] items-center">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {Object.entries(state.filters).map(([key, value]) => {
            if (key === 'sortBy') return null;
            if (Array.isArray(value)) {
              return value.map(v => (
                <FilterChip key={`${key}-${v}`} label={`${key}: ${v}`} onRemove={() => removeFilter(key as any, v)} />
              ));
            }
            if (typeof value === 'boolean' && value) {
              return <FilterChip key={key} label={key} onRemove={() => removeFilter(key as any)} />;
            }
            if (typeof value === 'number') {
              return <FilterChip key={key} label={`${key}: ${value}`} onRemove={() => removeFilter(key as any)} />;
            }
            return null;
          })}
          {Object.keys(state.filters).length === 0 && (
            <span className="text-xs text-slate-400 italic">No active filters</span>
          )}
        </div>

        {/* Table Toolbar */}
        <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search in results..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={state.filters.onlyOA}
                  onChange={(e) => setState(prev => ({ ...prev, filters: { ...prev.filters, onlyOA: e.target.checked } }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                />
                Only OA
              </label>
              <button 
                onClick={selectAllDownloadable}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Select all downloadable
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Sort:</span>
            <select 
              value={`${sortConfig.key}-${sortConfig.direction}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split('-');
                setSortConfig({ key: key as any, direction: dir as any });
              }}
              className="text-xs border-none focus:ring-0 font-medium text-slate-600 cursor-pointer bg-transparent"
            >
              <option value="year-desc">Year (Newest)</option>
              <option value="year-asc">Year (Oldest)</option>
              <option value="citationCount-desc">Citations</option>
              <option value="title-asc">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto">
          {state.isSearching ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="w-5 h-5 bg-slate-100 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPapers.length > 0 ? (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) {
                          setState(prev => ({ ...prev, selection: new Set(filteredPapers.map(p => p.paperId)) }));
                        } else {
                          setState(prev => ({ ...prev, selection: new Set() }));
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                    />
                  </th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3 w-20">Year</th>
                  <th className="px-4 py-3 w-40">Venue</th>
                  <th className="px-4 py-3 w-40">First Author</th>
                  <th className="px-4 py-3 w-24 text-center">OA</th>
                  <th className="px-4 py-3 w-24 text-right">Citations</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filteredPapers.map((paper) => (
                  <tr 
                    key={paper.paperId} 
                    className={cn(
                      "hover:bg-indigo-50/30 transition-colors cursor-default group",
                      state.selection.has(paper.paperId) && "bg-indigo-50/50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        checked={state.selection.has(paper.paperId)}
                        onChange={() => toggleSelection(paper.paperId)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => setSelectedPaper(paper)}
                        className="text-left font-medium text-slate-900 hover:text-indigo-600 transition-colors line-clamp-2"
                      >
                        {paper.title}
                      </button>
                      <div className="flex gap-2 mt-1">
                        {paper.externalIds.DOI && (
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            DOI: {paper.externalIds.DOI} <Copy className="w-2.5 h-2.5 cursor-pointer hover:text-slate-600" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-medium">{paper.year}</td>
                    <td className="px-4 py-3 text-slate-500 italic truncate max-w-[160px]">{paper.venue || 'N/A'}</td>
                    <td className="px-4 py-3 text-slate-600">{paper.authors[0]?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-center">
                      {paper.openAccessPdf?.url ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-tighter border border-green-100">
                          <CheckCircle2 className="w-3 h-3" /> OA PDF
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-tighter border border-slate-100">
                          <X className="w-3 h-3" /> Not OA
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{paper.citationCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium text-slate-500">No results found</p>
              <p className="text-sm max-w-xs mt-2">Try adjusting your filters or ask me to search for something else in the chat.</p>
              <div className="mt-6 flex gap-2">
                <button 
                  onClick={() => setState(prev => ({ ...prev, filters: {} }))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Download Bar */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected</span>
              <span className="text-xl font-bold text-indigo-600">{state.selection.size}</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Downloadable</span>
              <span className="text-xl font-bold text-emerald-600">
                {Array.from(state.selection).filter(id => state.pool.find(p => p.paperId === id)?.openAccessPdf?.url).length}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setState(prev => ({ ...prev, selection: new Set() }))}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Clear Selection
            </button>
            <button 
              onClick={handleDownload}
              disabled={isDownloading || state.selection.size === 0}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Zipping...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download & Zip
                </>
              )}
            </button>
          </div>
        </div>

        {/* Paper Detail Drawer */}
        <AnimatePresence>
          {selectedPaper && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPaper(null)}
                className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-30"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 bottom-0 w-[450px] bg-white shadow-2xl z-40 flex flex-col border-l border-slate-200"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                  <div className="pr-8">
                    <h2 className="text-xl font-bold leading-tight text-slate-900">{selectedPaper.title}</h2>
                    <p className="mt-2 text-sm text-slate-500 italic">
                      {selectedPaper.authors.map(a => a.name).join(', ')}
                    </p>
                    <div className="mt-2 flex gap-3 text-xs font-medium text-slate-400">
                      <span>{selectedPaper.venue}</span>
                      <span>•</span>
                      <span>{selectedPaper.year}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedPaper(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <section>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Abstract</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {selectedPaper.abstract || 'No abstract available.'}
                    </p>
                  </section>

                  <section className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">AI Summary</h3>
                    <PaperSummary paper={selectedPaper} />
                  </section>

                  <section>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identifiers & Links</h3>
                    <div className="space-y-2">
                      {selectedPaper.externalIds.DOI && (
                        <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-xs">
                          <span className="text-slate-500">DOI</span>
                          <span className="font-mono text-slate-900">{selectedPaper.externalIds.DOI}</span>
                        </div>
                      )}
                      {selectedPaper.externalIds.PubMed && (
                        <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-xs">
                          <span className="text-slate-500">PMID</span>
                          <span className="font-mono text-slate-900">{selectedPaper.externalIds.PubMed}</span>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-3">
                  {selectedPaper.openAccessPdf?.url ? (
                    <a 
                      href={selectedPaper.openAccessPdf.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-center hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </a>
                  ) : (
                    <div className="w-full py-3 bg-slate-200 text-slate-500 rounded-xl font-bold text-center cursor-not-allowed">
                      PDF Not Available
                    </div>
                  )}
                  <button 
                    onClick={() => toggleSelection(selectedPaper.paperId)}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold transition-all border-2",
                      state.selection.has(selectedPaper.paperId)
                        ? "bg-white border-indigo-600 text-indigo-600"
                        : "bg-indigo-600 border-indigo-600 text-white"
                    )}
                  >
                    {state.selection.has(selectedPaper.paperId) ? 'Remove from Selection' : 'Add to Selection'}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 shadow-sm">
      {label}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function PaperSummary({ paper }: { paper: Paper }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function getSummary() {
      setLoading(true);
      try {
        const s = await summarizePaper(paper);
        setSummary(s);
      } catch (err) {
        setSummary("Failed to generate summary.");
      } finally {
        setLoading(false);
      }
    }
    if (paper) getSummary();
  }, [paper]);

  if (loading) return <div className="h-12 flex items-center justify-center"><div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>;
  return <p className="text-sm text-indigo-900 leading-relaxed italic">{summary}</p>;
}

