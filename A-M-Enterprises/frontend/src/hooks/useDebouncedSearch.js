import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash.debounce";

function isCanceled(error) {
  return (
    error?.name === "CanceledError" ||
    error?.code === "ERR_CANCELED" ||
    error?.message === "canceled"
  );
}

export default function useDebouncedSearch({
  query,
  searchFn,
  delay = 300,
  minLength = 1,
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(
    async (term) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;
      setLoading(true);

      try {
        const data = await searchFn(term, controller.signal);
        if (requestId !== requestIdRef.current) return;
        setResults(Array.isArray(data) ? data : []);
      } catch (error) {
        if (controller.signal.aborted || isCanceled(error)) return;
        if (requestId === requestIdRef.current) {
          setResults([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [searchFn]
  );

  const debouncedSearch = useMemo(
    () => debounce(runSearch, delay),
    [runSearch, delay]
  );

  useEffect(() => {
    const term = String(query || "").trim();
    if (term.length < minLength) {
      debouncedSearch.cancel();
      if (abortRef.current) {
        abortRef.current.abort();
      }
      setResults([]);
      setLoading(false);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    debouncedSearch(term);
    return () => debouncedSearch.cancel();
  }, [query, minLength, debouncedSearch]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [debouncedSearch]);

  return { results, loading };
}
