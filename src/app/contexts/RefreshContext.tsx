import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

interface RefreshContextValue {
  refreshCounter: number;
  nextRefreshSeconds: number;
  forceRefresh: () => void;
  isRefreshing: boolean;
}

const RefreshContext = createContext<RefreshContextValue | undefined>(
  undefined,
);

const REFRESH_INTERVAL_SECONDS = 30;
const REFRESH_ANIMATION_MS = 700;
const IDLE_REFRESH_GRACE_MS = 5000;

function hasActiveFocus() {
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }

  const tagName = activeElement.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    activeElement.isContentEditable ||
    (activeElement !== document.body &&
      activeElement !== document.documentElement)
  );
}

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [nextRefreshSeconds, setNextRefreshSeconds] = useState(
    REFRESH_INTERVAL_SECONDS,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastInteractionAtRef = useRef(Date.now());

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
      "focusin",
      "mousemove",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, markInteraction, { passive: true });
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, markInteraction);
      });
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNextRefreshSeconds((prev) => {
        if (prev <= 1) {
          setRefreshCounter((current) => current + 1);
          setIsRefreshing(true);
          return REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (refreshCounter === 0) {
      return;
    }

    if (window.location.pathname === "/login") {
      return;
    }

    if (hasActiveFocus()) {
      return;
    }

    if (Date.now() - lastInteractionAtRef.current < IDLE_REFRESH_GRACE_MS) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.location.reload();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [refreshCounter]);

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsRefreshing(false);
    }, REFRESH_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [isRefreshing]);

  const forceRefresh = () => {
    setRefreshCounter((current) => current + 1);
    setNextRefreshSeconds(REFRESH_INTERVAL_SECONDS);
    setIsRefreshing(true);
  };

  return (
    <RefreshContext.Provider
      value={{ refreshCounter, nextRefreshSeconds, forceRefresh, isRefreshing }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error("useRefresh must be used within a RefreshProvider");
  }
  return context;
}
