import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import {
  AppWindow, ArrowUpRight, Building2, ChartNoAxesCombined, CircleGauge,
  Compass, Database, Film, Layers3, LayoutDashboard, MessageCircle,
  MousePointerClick, Network, Route, Search, ShieldCheck, Smartphone,
  Sparkles, Target, UsersRound, Workflow,
} from "lucide-react";
import { career, chapters, profile, projects, systemModules, vibeProjects, works } from "./data.js";
import { ProfileBadge } from "./ProfileBadge.jsx";
import DriftWall from "./components/DriftWall.jsx";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const FRAME_COUNTS = [240, 240, 240, 240, 240];
const FRAME_CACHE_NAME = "tang-portfolio-frames-v1";
const framePath = (segment, frameIndex) => (
  `/frames/scroll-0${segment + 1}/frame-${String(frameIndex + 1).padStart(4, "0")}.webp`
);
const ALL_FRAME_URLS = FRAME_COUNTS.flatMap((count, segment) => (
  Array.from({ length: count }, (_, frameIndex) => framePath(segment, frameIndex))
));

// Enter after only the frames that make the first view feel alive. The other
// 1,193 frames are requested naturally as visitors move through the story;
// blocking first paint on the entire film made cold starts unnecessarily slow.
const CRITICAL_FRAME_URLS = [
  framePath(0, 0),
  framePath(0, 1),
  framePath(0, 2),
  framePath(1, 0),
  framePath(2, 0),
  framePath(3, 0),
  framePath(4, 0),
];
const FRAME_ENTRY_URLS = Array.from(
  { length: 48 },
  (_, frameIndex) => FRAME_COUNTS.map((_, segment) => framePath(segment, frameIndex)),
).flat();
const FRAME_ENTRY_URL_SET = new Set(FRAME_ENTRY_URLS);
const FRAME_WARMUP_URLS = [
  // Make every chapter's entrance available first, then fill the remaining
  // film in natural scene order while the visitor is already browsing.
  ...FRAME_ENTRY_URLS,
  ...ALL_FRAME_URLS.filter((url) => !FRAME_ENTRY_URL_SET.has(url)),
];

let criticalFramePromise = null;
let backgroundFrameWarmupPromise = null;
const framePreloadListeners = new Set();
const emitFrameProgress = (value) => framePreloadListeners.forEach((listener) => listener(value));

async function cacheCriticalFrames() {
  if (criticalFramePromise) return criticalFramePromise;

  criticalFramePromise = (async () => {
    if (!("caches" in window)) throw new Error("CACHE_UNAVAILABLE");
    const cache = await caches.open(FRAME_CACHE_NAME);
    let completed = 0;
    const update = () => emitFrameProgress(Math.round((completed / CRITICAL_FRAME_URLS.length) * 100));
    const queue = [...CRITICAL_FRAME_URLS];
    const worker = async () => {
      while (queue.length) {
        const url = queue.shift();
        const existing = await cache.match(url);
        if (!existing) {
          let response;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              response = await fetch(url, { cache: "force-cache" });
              if (!response.ok) throw new Error(`FRAME_${response.status}`);
              await cache.put(url, response.clone());
              break;
            } catch (error) {
              if (attempt === 2) throw error;
            }
          }
        }
        completed += 1;
        update();
      }
    };

    emitFrameProgress(0);
    await Promise.all(Array.from({ length: 3 }, worker));
    emitFrameProgress(100);
  })().catch((error) => {
    criticalFramePromise = null;
    throw error;
  });

  return criticalFramePromise;
}

function warmFrameCacheInBackground() {
  if (backgroundFrameWarmupPromise || !("caches" in window)) return backgroundFrameWarmupPromise;

  backgroundFrameWarmupPromise = (async () => {
    const cache = await caches.open(FRAME_CACHE_NAME);
    const queue = [...FRAME_WARMUP_URLS];
    const worker = async () => {
      while (queue.length) {
        const url = queue.shift();
        if (!url || await cache.match(url)) continue;
        try {
          const response = await fetch(url, { cache: "force-cache" });
          if (response.ok) await cache.put(url, response.clone());
        } catch {
          // Individual frames are still retried by the live backdrop when
          // needed; a warm-up failure must never interrupt browsing.
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  })().catch(() => {
    backgroundFrameWarmupPromise = null;
  });
  return backgroundFrameWarmupPromise;
}

function useFrameBootloader() {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const run = useCallback(() => {
    setError(false);
    cacheCriticalFrames().then(() => {
      setReady(true);
      // Let the first view paint before using the connection for the rest of
      // the film. Four fetch workers keep scroll continuity without starving
      // the UI or primary assets.
      window.setTimeout(warmFrameCacheInBackground, 250);
    }).catch(() => setError(true));
  }, []);

  useEffect(() => {
    framePreloadListeners.add(setProgress);
    run();
    return () => framePreloadListeners.delete(setProgress);
  }, [run]);

  useEffect(() => {
    document.documentElement.classList.toggle("is-loading", !ready);
    return () => document.documentElement.classList.remove("is-loading");
  }, [ready]);

  return { progress, ready, error, retry: run };
}

function LoadingScreen({ progress, ready, error, onRetry }) {
  const loadingNotes = [
    "正在冲洗开场三秒，故事马上开机。",
    "把重资源留到后台，先让你进来逛。",
    "灵感已通电，请系好创意安全带。",
  ];
  const [noteIndex, setNoteIndex] = useState(0);

  useEffect(() => {
    if (ready || error) return undefined;
    const timer = window.setInterval(() => setNoteIndex((index) => (index + 1) % loadingNotes.length), 2200);
    return () => window.clearInterval(timer);
  }, [ready, error, loadingNotes.length]);

  return (
    <section className={ready ? "lab-loader is-leaving" : "lab-loader"} aria-live="polite" aria-label="正在加载设计实验室">
      <div className="lab-loader__backdrop" />
      <div className="lab-loader__grain" />
      <div className="lab-loader__mark" aria-hidden="true"><i /><i /><i /></div>
      <div className="lab-loader__content">
        <p className="lab-loader__eyebrow">TANG QIDONG / DESIGN LAB</p>
        <h1>开场已就位，<br />马上进入设计现场。</h1>
        <div className="lab-loader__meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
          <span style={{ "--loader-progress": `${progress}%` }} />
        </div>
        <div className="lab-loader__status">
          <span className="lab-loader__note-cycle">{error ? "网络有一点迟疑，点击后继续前进。" : loadingNotes[noteIndex]}</span>
          <small>{error ? <button type="button" onClick={onRetry}>重新加载</button> : <><b>{String(progress).padStart(3, "0")}%</b> / FIRST VIEW</>}</small>
        </div>
        <div className="lab-loader__pulse-row" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </div>
      <p className="lab-loader__note">FIRST VIEW READY · THE REST ARRIVES AS YOU EXPLORE</p>
    </section>
  );
}

const CASE_VISUAL_SUMMARIES = {
  mobile: [
    [Smartphone, "移动体验", "375 × 812"],
    [UsersRound, "角色模型", "玩家 / 店主 / DM"],
    [Route, "核心路径", "发现 → 组局 → 入场"],
    [Film, "叙事气质", "沉浸式剧场"],
  ],
  admin: [
    [Building2, "园区业务", "多主体协同"],
    [ShieldCheck, "权限体系", "角色 × 数据域"],
    [Database, "数据中台", "统一资产视图"],
    [Workflow, "审批流", "节点可追踪"],
  ],
  website: [
    [Compass, "品牌叙事", "从价值到证据"],
    [Layers3, "内容架构", "长短页组合"],
    [MousePointerClick, "转化路径", "演示 / 咨询 / 试用"],
    [Sparkles, "视觉识别", "产品化表达"],
  ],
};

/**
 * Page-edge magnet: scrolling is 100% native everywhere. Only when scrolling
 * comes to rest VERY close to a chapter's top-aligned position (the spot where
 * that page's layout is fully presented) does the view glide the last few
 * pixels to lock onto it. Anywhere else, the browser scrolls naturally.
 *
 * @param {number} pageCount total full-screen chapters (6).
 * @param {object} refs shared refs so programmatic navigation can suspend the magnet.
 */
function useScrollSnap(pageCount, refs) {
  useEffect(() => {
    // On phones chapters follow their content height. Let native document
    // scrolling stay free so snapping cannot trap long content or page six.
    if (window.matchMedia("(max-width: 760px)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const pageHeight = () => Math.max(1, window.innerHeight);
    const maxScroll = () => pageHeight() * (pageCount - 1);
    // Tight catch radius: only snap when already within ~6% of a page boundary.
    const catchRadius = () => Math.round(pageHeight() * 0.06);

    let idleTimer = 0;
    let snapRaf = 0;
    let snapping = false;

    const nearestAlign = (y) => {
      const page = Math.round(y / pageHeight());
      return clamp(page, 0, pageCount - 1) * pageHeight();
    };

    const stopSnap = () => {
      if (snapRaf) { window.cancelAnimationFrame(snapRaf); snapRaf = 0; }
      if (snapping) {
        snapping = false;
        document.documentElement.classList.remove("is-snap-animating");
      }
    };

    const snapTo = (targetY) => {
      stopSnap();
      const startY = window.scrollY;
      const distance = targetY - startY;
      if (Math.abs(distance) < 1) return;
      snapping = true;
      document.documentElement.classList.add("is-snap-animating");
      const start = performance.now();
      const duration = Math.min(360, 160 + Math.abs(distance) * 0.6);
      const tick = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        window.scrollTo(0, startY + distance * eased);
        if (t < 1 && snapRaf) {
          snapRaf = window.requestAnimationFrame(tick);
        } else {
          snapRaf = 0;
          snapping = false;
          document.documentElement.classList.remove("is-snap-animating");
        }
      };
      snapRaf = window.requestAnimationFrame(tick);
    };

    const consider = () => {
      if (snapping || refs.current.navigateProgrammatic) return;
      const y = window.scrollY;
      const target = Math.min(nearestAlign(y), maxScroll());
      const drift = Math.abs(y - target);
      // eslint-disable-next-line no-console
      console.log("[snap] consider", { y: Math.round(y), target, drift: Math.round(drift), radius: catchRadius() });
      // Only snap when ALREADY very close — a light polish, never a jump.
      if (drift > 2 && drift <= catchRadius()) {
        snapTo(target);
      }
    };

    const schedule = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(consider, 110);
    };

    // Fully passive — never intercept or redirect native scrolling.
    const onScroll = () => { if (!snapping) schedule(); };
    const onWheel = () => { if (!snapping) schedule(); };
    const onTouchEnd = () => { if (!snapping) schedule(); };
    const onKey = (e) => {
      if (snapping) return;
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"].includes(e.key)) schedule();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(idleTimer);
      stopSnap();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [pageCount, refs]);
}

/** Smooth cubic arcs through content docks (Catmull-Rom style). */
const buildArcPath = (points) => {
  if (points.length < 2) return "";
  const f = (n) => n.toFixed(1);
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    // Slightly softer tension than pure Catmull-Rom for calmer arcs.
    const t = 0.18;
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
};

function NarrativeThread({ activeChapter }) {
  const rootRef = useRef(null);
  const basePathRef = useRef(null);
  const drawPathRef = useRef(null);
  const headRef = useRef(null);
  const [geometry, setGeometry] = useState({ d: "", docks: [], height: 0, width: 0 });

  const measure = useCallback(() => {
    const anchors = [...document.querySelectorAll("[data-narrative-anchor]")];
    if (!anchors.length) return;

    const width = window.innerWidth;
    const pageH = Math.max(1, window.innerHeight);
    const height = pageH * 6;
    const scrollY = window.scrollY || window.pageYOffset;

    const docks = anchors.map((el, index) => {
      const rect = el.getBoundingClientRect();
      const biasX = Number(el.dataset.threadX || 0.5);
      const biasY = Number(el.dataset.threadY || 0.5);
      let x = rect.left + rect.width * biasX;
      let y = rect.top + scrollY + rect.height * biasY;
      // Sit just outside the glass edge so the arc kisses each block.
      if (biasX <= 0.2) x = rect.left - 8;
      else if (biasX >= 0.8) x = rect.right + 8;
      if (biasY <= 0.2) y = rect.top + scrollY - 8;
      else if (biasY >= 0.8) y = rect.bottom + scrollY + 8;
      return {
        id: el.dataset.narrativeAnchor || String(index),
        index,
        x: clamp(x, 28, width - 28),
        y: clamp(y, index * pageH + 40, (index + 1) * pageH - 40),
      };
    });

    setGeometry({ d: buildArcPath(docks), docks, height, width });
  }, []);

  useLayoutEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    const t1 = window.setTimeout(measure, 100);
    const t2 = window.setTimeout(measure, 480);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [measure]);

  useEffect(() => {
    const base = basePathRef.current;
    const draw = drawPathRef.current;
    const head = headRef.current;
    if (!base || !draw || !geometry.d) return undefined;

    let frame = 0;
    const sync = () => {
      frame = 0;
      const total = base.getTotalLength?.() || 0;
      if (!total) return;

      const pageH = Math.max(1, window.innerHeight);
      const progress = clamp(window.scrollY / Math.max(1, 5 * pageH), 0, 1);
      const drawn = total * progress;

      draw.style.strokeDasharray = `${total}`;
      draw.style.strokeDashoffset = `${Math.max(0, total - drawn)}`;

      if (head) {
        const point = base.getPointAtLength(Math.max(0, drawn));
        head.setAttribute("cx", String(point.x));
        head.setAttribute("cy", String(point.y));
        head.style.opacity = progress > 0.01 ? "1" : "0.4";
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    window.requestAnimationFrame(sync);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [geometry]);

  if (!geometry.d) return null;

  return (
    <div className="narrative-thread" ref={rootRef} aria-hidden="true">
      <svg
        className="narrative-thread__svg"
        width={geometry.width}
        height={geometry.height}
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          <linearGradient id="thread-progress" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={geometry.height}>
            <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
            <stop offset="36%" stopColor="rgba(246,255,0,0.72)" />
            <stop offset="70%" stopColor="rgba(246,255,0,0.9)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.46)" />
          </linearGradient>
        </defs>

        {/* Quiet full arc — always visible as a soft guide */}
        <path className="narrative-thread__ghost" d={geometry.d} />
        <path className="narrative-thread__base" ref={basePathRef} d={geometry.d} />
        <path className="narrative-thread__draw" ref={drawPathRef} d={geometry.d} />

        {geometry.docks.map((dock) => (
          <g
            key={dock.id}
            className={activeChapter === dock.index ? "narrative-dock is-active" : "narrative-dock"}
            transform={`translate(${dock.x} ${dock.y})`}
          >
            <circle className="narrative-dock__ring" r="6" />
            <circle className="narrative-dock__core" r="2" />
          </g>
        ))}

        <circle className="narrative-thread__head" ref={headRef} r="3.6" />
      </svg>
    </div>
  );
}

function CinematicBackdrop() {
  const canvasRef = useRef(null);
  const vignetteRef = useRef(null);
  const targetKeyRef = useRef("0-0");
  const bitmapCacheRef = useRef(new Map());
  const pendingFramesRef = useRef(new Map());

  const frameSource = useCallback((segment, frameIndex) => (
    framePath(segment, frameIndex)
  ), []);

  useEffect(() => {
    let frameRequest = 0;
    let disposed = false;
    const abortController = new AbortController();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true, desynchronized: true });
    let lastSegment = 0;
    let lastFrameIndex = 0;
    let warmController = new AbortController();
    let targetLoadInFlight = false;
    let requestedTarget = { segment: 0, frameIndex: 0 };

    const resizeCanvas = () => {
      if (!canvas || !context) return;
      // Source frames are 1920×1080. Render only as many physical pixels as the
      // viewport can display, rather than compositing a permanent 1920×1080 layer
      // on every device (especially expensive on remote/mobile GPUs).
      const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      const width = Math.max(1, Math.round(window.innerWidth * dpr));
      const height = Math.max(1, Math.round(window.innerHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
      }
    };

    const touchBitmap = (key, bitmap) => {
      bitmapCacheRef.current.delete(key);
      bitmapCacheRef.current.set(key, bitmap);
    };

    const trimCache = () => {
      while (bitmapCacheRef.current.size > 18) {
        const oldestKey = bitmapCacheRef.current.keys().next().value;
        if (oldestKey === targetKeyRef.current) {
          const bitmap = bitmapCacheRef.current.get(oldestKey);
          touchBitmap(oldestKey, bitmap);
          continue;
        }
        const bitmap = bitmapCacheRef.current.get(oldestKey);
        bitmapCacheRef.current.delete(oldestKey);
        bitmap?.close?.();
      }
    };

    const decodeFrame = (blob) => {
      if (typeof createImageBitmap === "function") return createImageBitmap(blob);
      return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
        image.onerror = (error) => { URL.revokeObjectURL(objectUrl); reject(error); };
        image.src = objectUrl;
      });
    };

    const loadBitmap = (segment, frameIndex, signal = abortController.signal) => {
      const key = `${segment}-${frameIndex}`;
      const cached = bitmapCacheRef.current.get(key);
      if (cached) {
        touchBitmap(key, cached);
        return Promise.resolve(cached);
      }
      if (pendingFramesRef.current.has(key)) return pendingFramesRef.current.get(key);

      const source = frameSource(segment, frameIndex);
      const promise = (async () => {
        if ("caches" in window) {
          const cache = await caches.open(FRAME_CACHE_NAME);
          const cachedResponse = await cache.match(source);
          if (cachedResponse) return cachedResponse;
        }
        return fetch(source, { cache: "force-cache", signal });
      })()
        .then((response) => {
          if (!response.ok) throw new Error(`Frame ${key} failed: ${response.status}`);
          return response.blob();
        })
        .then((blob) => decodeFrame(blob))
        .then((bitmap) => {
          pendingFramesRef.current.delete(key);
          if (disposed) { bitmap.close?.(); return null; }
          touchBitmap(key, bitmap);
          trimCache();
          return bitmap;
        })
        .catch((error) => {
          pendingFramesRef.current.delete(key);
          if (error?.name !== "AbortError") console.warn("[frames]", error);
          return null;
        });
      pendingFramesRef.current.set(key, promise);
      return promise;
    };

    const paintBitmap = (bitmap, segment, frameIndex) => {
      if (!bitmap || !context || !canvas) return;
      const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
      const width = bitmap.width * scale;
      const height = bitmap.height * scale;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      canvas.dataset.segment = String(segment + 1);
      canvas.dataset.frame = String(frameIndex + 1).padStart(4, "0");
      canvas.dataset.source = frameSource(segment, frameIndex);
    };

    const warmFrame = (segment, frameIndex) => {
      if (segment < 0 || segment > 4) return;
      const bounded = clamp(frameIndex, 0, FRAME_COUNTS[segment] - 1);
      if (pendingFramesRef.current.size >= 4) return;
      loadBitmap(segment, bounded, warmController.signal);
    };

    const warmAround = (segment, frameIndex, direction) => {
      for (let offset = 1; offset <= 6; offset += 1) warmFrame(segment, frameIndex + offset * direction);
      for (let offset = 1; offset <= 2; offset += 1) warmFrame(segment, frameIndex - offset * direction);
      if (frameIndex > FRAME_COUNTS[segment] - 20) {
        for (let offset = 0; offset < 4; offset += 1) warmFrame(segment + 1, offset);
      }
    };

    const resolveLatestTarget = () => {
      if (targetLoadInFlight) return;
      const { segment, frameIndex } = requestedTarget;
      const key = `${segment}-${frameIndex}`;
      targetLoadInFlight = true;
      const cached = bitmapCacheRef.current.get(key);
      if (cached) {
        touchBitmap(key, cached);
        paintBitmap(cached, segment, frameIndex);
        targetLoadInFlight = false;
      } else {
        loadBitmap(segment, frameIndex).then((bitmap) => {
          if (!disposed && targetKeyRef.current === key) paintBitmap(bitmap, segment, frameIndex);
        }).finally(() => {
          targetLoadInFlight = false;
          const latestKey = `${requestedTarget.segment}-${requestedTarget.frameIndex}`;
          if (!disposed && latestKey !== key) resolveLatestTarget();
        });
      }
      const direction = segment === lastSegment ? Math.sign(frameIndex - lastFrameIndex) || 1 : 1;
      warmAround(segment, frameIndex, direction);
    };

    const requestFrame = (segment, frameIndex) => {
      const key = `${segment}-${frameIndex}`;
      targetKeyRef.current = key;
      requestedTarget = { segment, frameIndex };
      warmController.abort();
      warmController = new AbortController();
      resolveLatestTarget();
      lastSegment = segment;
      lastFrameIndex = frameIndex;
    };

    resizeCanvas();
    requestFrame(0, 0);

    const syncFrame = () => {
      frameRequest = 0;
      const pageHeight = Math.max(1, window.innerHeight);
      const rawPage = window.scrollY / pageHeight;
      const segment = clamp(Math.floor(rawPage), 0, 4);
      const local = segment === 4 && rawPage >= 5 ? 1 : clamp(rawPage - segment, 0, 1);
      const frameIndex = Math.round(local * (FRAME_COUNTS[segment] - 1));
      requestFrame(segment, frameIndex);

      if (vignetteRef.current) {
        const distance = Math.abs(rawPage - 2.5);
        const fade = clamp(distance * 0.9, 0, 1);
        vignetteRef.current.style.setProperty("--vignette-strength", String(fade));
      }
    };

    const queueFrame = () => {
      if (!frameRequest) frameRequest = window.requestAnimationFrame(syncFrame);
    };

    const onResize = () => { resizeCanvas(); queueFrame(); };
    syncFrame();
    window.addEventListener("scroll", queueFrame, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      abortController.abort();
      warmController.abort();
      window.removeEventListener("scroll", queueFrame);
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(frameRequest);
      bitmapCacheRef.current.forEach((bitmap) => bitmap?.close?.());
      bitmapCacheRef.current.clear();
      pendingFramesRef.current.clear();
    };
  }, [frameSource]);

  return (
    <div className="cinematic-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} className="background-canvas" width="1920" height="1080" />
      <div className="video-wash" />
      <div className="video-vignette" ref={vignetteRef} />
      <div className="video-vignette-left" />
      <div className="film-grain" />
    </div>
  );
}

/*
 * Keep the backdrop implementation above intentionally canvas-only. The
 * source MP4 files are offline masters and never participate at runtime.
 */

function Navigation({ activeChapter, onNavigate, onMenuChange }) {
  const [open, setOpen] = useState(false);

  const handleNavigate = (id) => {
    window.dispatchEvent(new Event("portfolio:navigate"));
    onNavigate(id);
    setOpen(false);
    onMenuChange?.(false);
  };

  const toggleMenu = () => {
    setOpen((value) => {
      onMenuChange?.(!value);
      return !value;
    });
  };

  return (
    <nav className={`chapter-nav${open ? " is-open" : ""}`} aria-label="作品集章节">
      <button
        type="button"
        className="nav-burger"
        aria-expanded={open}
        aria-controls="nav-stack"
        aria-label={open ? "关闭导航" : "打开导航"}
        onClick={toggleMenu}
      >
        <i /><i /><i />
      </button>
      <div className="nav-stack" id="nav-stack">
        <p className="nav-mobile-notice">请用 PC 端浏览查看完整效果</p>
        {chapters.map((chapter, index) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            className={activeChapter === index ? "nav-item is-active" : "nav-item"}
            onClick={(event) => {
              event.preventDefault();
              handleNavigate(chapter.id);
            }}
          >
            <span className="nav-rail" aria-hidden="true" />
            <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="nav-label"><strong>{chapter.label}</strong><small>{chapter.zh}</small></span>
            <span className="nav-state">{activeChapter === index ? "NOW" : "GO"}</span>
          </a>
        ))}
      </div>
      <div className="nav-footer"><span>NARRATIVE THREAD</span><small>06 SCENES</small></div>
    </nav>
  );
}

function useCloseOnPortfolioNavigate(onClose) {
  useEffect(() => {
    window.addEventListener("portfolio:navigate", onClose);
    return () => window.removeEventListener("portfolio:navigate", onClose);
  }, [onClose]);
}

function FixedClose({ onClose, level = 500 }) {
  return createPortal(
    <button
      type="button"
      className="overlay-fixed-close"
      style={{ "--close-level": level }}
      onClick={onClose}
    >
      CLOSE
    </button>,
    document.body,
  );
}

function ChapterIndex({ index }) {
  return (
    <div className="chapter-index" aria-label={`第 ${index + 1} 页，共 6 页`}>
      <strong>{String(index + 1).padStart(2, "0")}</strong>
      <span>{String(index + 1).padStart(2, "0")} / 06</span>
    </div>
  );
}

function GuideLine({ activeChapter }) {
  const dotRef = useRef(null);
  const labelRef = useRef(null);

  useLayoutEffect(() => {
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    timeline
      .to(dotRef.current, { left: `${(activeChapter / 5) * 100}%`, duration: 0.8, ease: "expo.inOut" })
      .fromTo(dotRef.current, { scale: 2.2 }, { scale: 1, duration: 0.65, ease: "elastic.out(1, .45)" }, "<0.18")
      .fromTo(labelRef.current, { y: 7, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.35 }, "<0.05");
    return () => timeline.kill();
  }, [activeChapter]);

  return (
    <div className="scene-guide" aria-hidden="true">
      <div className="scene-guide__meta"><span ref={labelRef}>SCENE {String(activeChapter + 1).padStart(2, "0")}</span><small>SCROLL TO DIRECT</small></div>
      <div className="scene-guide__rail"><i ref={dotRef} />{chapters.map((chapter) => <span key={chapter.id} />)}</div>
    </div>
  );
}

function InfoOverlay({ eyebrow, title, onClose, children, className = "" }) {
  const overlayRef = useRef(null);
  useCloseOnPortfolioNavigate(onClose);

  useLayoutEffect(() => {
    document.body.classList.add("modal-open");
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    timeline
      .fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28 })
      .fromTo(overlayRef.current.querySelectorAll(".overlay-motion"), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.62, stagger: 0.07 }, "<0.05");
    return () => {
      timeline.kill();
      window.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  return (
    <div ref={overlayRef} className={`info-overlay ${className}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <FixedClose onClose={onClose} />
      <header className="info-overlay__header overlay-motion" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </header>
      <div className="info-overlay__body overlay-motion" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ZoomableImage({ src, alt, className = "" }) {
  const imgRef = useRef(null);
  const scaleRef = useRef(1);
  const xRef = useRef(0);
  const yRef = useRef(0);
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef({ distance: 0, scale: 1 });

  const apply = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    el.style.transform = `translate(${xRef.current}px, ${yRef.current}px) scale(${scaleRef.current})`;
  }, []);

  const onWheel = useCallback((event) => {
    event.preventDefault();
    const delta = -event.deltaY * 0.0015;
    scaleRef.current = Math.min(Math.max(0.5, scaleRef.current + delta * scaleRef.current), 8);
    apply();
  }, [apply]);

  const onPointerDown = useCallback((event) => {
    if (scaleRef.current <= 1) return;
    draggingRef.current = true;
    lastRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event) => {
    if (!draggingRef.current) return;
    xRef.current += event.clientX - lastRef.current.x;
    yRef.current += event.clientY - lastRef.current.y;
    lastRef.current = { x: event.clientX, y: event.clientY };
    apply();
  }, [apply]);

  const endDrag = useCallback((event) => {
    draggingRef.current = false;
    if (event.currentTarget.releasePointerCapture && event.pointerId !== undefined) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (_) { /* noop */ }
    }
  }, []);

  const getTouchDistance = (touches) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );

  const onTouchStart = useCallback((event) => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    pinchRef.current = {
      distance: getTouchDistance(event.touches),
      scale: scaleRef.current,
    };
  }, []);

  const onTouchMove = useCallback((event) => {
    if (event.touches.length !== 2 || !pinchRef.current.distance) return;
    event.preventDefault();
    scaleRef.current = Math.min(
      8,
      Math.max(1, pinchRef.current.scale * (getTouchDistance(event.touches) / pinchRef.current.distance)),
    );
    apply();
  }, [apply]);

  const onTouchEnd = useCallback((event) => {
    if (event.touches.length < 2) pinchRef.current.distance = 0;
  }, []);

  const reset = useCallback(() => {
    scaleRef.current = 1; xRef.current = 0; yRef.current = 0; apply();
  }, [apply]);

  useEffect(() => { reset(); }, [src, reset]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={`zoomable-img ${className}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onDoubleClick={reset}
      draggable="false"
      style={{ cursor: scaleRef.current > 1 ? "grab" : "zoom-in" }}
    />
  );
}

function LineIcon({ name, className = "" }) {
  const paths = {
    ux: "M3 12h4l2 5 4-12 2 7h6",
    product: "M4 4h16v4H4zM4 12h16v4H4zM4 20h10",
    tech: "M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8",
    visual: "M4 4h16v16H4zM4 14l4-4 4 4 4-4 4 4",
    ai: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    system: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    travel: "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
    music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    photo: "M4 7h4l2-3h4l2 3h4v13H4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    rocket: "M12 2c3 2 5 5 5 9l-2 3h-6l-2-3c0-4 2-7 5-9zM12 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 16l-3 4M17 16l3 4",
  };
  const d = paths[name] || paths.ux;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function ProfileOverlay({ onClose }) {
  const rootRef = useRef(null);
  useCloseOnPortfolioNavigate(onClose);

  useLayoutEffect(() => {
    document.body.classList.add("modal-open");
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    timeline
      .fromTo(rootRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
      .fromTo(rootRef.current.querySelectorAll(".pm"), { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.65, stagger: 0.07 }, "<0.08");
    return () => {
      timeline.kill();
      window.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  return (
    <div ref={rootRef} className="profile-overlay" role="dialog" aria-modal="true" aria-label="个人档案" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <FixedClose onClose={onClose} />
      <div className="profile-overlay__inner" onClick={(e) => e.stopPropagation()}>
        <header className="po-head pm">
          <p className="eyebrow">PROFILE / ZEN.TANG</p>
          <h2>Designer × Builder</h2>
          <p className="po-head__lead">{profile.philosophy.lead}</p>
        </header>

        <section className="po-info pm">
          {profile.info.map(([k, v]) => (
            <div key={k}><small>{k}</small><b>{v}</b></div>
          ))}
        </section>

        <section className="po-block pm">
          <header className="po-block__head"><span>01</span><h3>设计理念</h3><small>PHILOSOPHY</small></header>
          <div className="po-pillars">
            {profile.philosophy.pillars.map((p) => (
              <article key={p.title}>
                <LineIcon name={p.icon} className="po-pillar__icon" />
                <div>
                  <small>{p.en}</small>
                  <strong>{p.title}</strong>
                </div>
                <p>{p.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="po-block pm">
          <header className="po-block__head"><span>02</span><h3>能力矩阵</h3><small>CAPABILITY</small></header>
          <div className="po-caps">
            {profile.capabilities.map((cap) => (
              <article key={cap.group}>
                <header><LineIcon name={cap.icon} className="po-cap__icon" /><h4>{cap.group}</h4></header>
                <ul>{cap.items.map((it) => <li key={it}><i className="po-dot" aria-hidden="true" />{it}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <div className="po-split">
          <section className="po-block pm">
            <header className="po-block__head"><span>03</span><h3>工作时间线</h3><small>EXPERIENCE</small></header>
            <ol className="po-timeline">
              {profile.timeline.map(([year, title, desc]) => (
                <li key={year}>
                  <b>{year}</b>
                  <div><strong>{title}</strong><small>{desc}</small></div>
                </li>
              ))}
            </ol>
          </section>

          <section className="po-block pm">
            <header className="po-block__head"><span>04</span><h3>设计方法</h3><small>WORKFLOW</small></header>
            <div className="po-workflow">
              <ol className="po-workflow__steps">
                {profile.workflow.map((step, i) => (
                  <li key={step}>{step}{i < profile.workflow.length - 1 && <span aria-hidden="true">→</span>}</li>
                ))}
              </ol>
              <p>{profile.workflowDesc}</p>
            </div>
          </section>
        </div>

        <section className="po-block pm">
          <header className="po-block__head"><span>05</span><h3>工具与技术栈</h3><small>STACK</small></header>
          <div className="po-stack">
            {profile.stack.map((s) => (
              <div key={s.group}>
                <small>{s.group}</small>
                <ul>{s.items.map((it) => <li key={it}><i className="po-dot" aria-hidden="true" />{it}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>

        <section className="po-block pm">
          <header className="po-block__head"><span>06</span><h3>设计之外</h3><small>BEYOND DESIGN</small></header>
          <div className="po-beyond">
            {profile.beyond.map((b) => (
              <article key={b.title}>
                <LineIcon name={b.icon} className="po-beyond__icon" />
                <strong>{b.title}</strong>
                <small>{b.desc}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AboutSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="chapter chapter-about" id="about" data-chapter="0">
      <div className="chapter-copy chapter-copy--bottom-right" data-narrative-anchor="about" data-thread-x="0.12" data-thread-y="0.12">
        <p className="eyebrow motion-item">PRODUCT DESIGNER · DESIGNER & BUILDER</p>
        <h1 className="motion-item hero-name">{profile.heroName}</h1>
        <div className="hero-divider motion-item" />
        <p className="chapter-summary chapter-summary--lead motion-item">{profile.heroLine}</p>
        <ul className="hero-tags motion-item">
          {profile.heroTags.map((tag) => <li key={tag}><LineIcon name="ai" className="hero-tag__icon" />{tag}</li>)}
        </ul>
        <div className="micro-content-list micro-content-list--stats motion-item">
          {profile.stats.map(([value, label]) => <button type="button" key={label} onClick={() => setOpen(true)}><strong>{value}</strong><span>{label}</span><small>+</small></button>)}
        </div>
        <button className="hero-cta motion-item" type="button" onClick={() => setOpen(true)}>
          <span>{profile.cta}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
      <p className="motion-hint">SCROLL DOWN · FRAME BY FRAME</p>
      {open && <ProfileOverlay onClose={() => setOpen(false)} />}
    </section>
  );
}

function CareerStageDetail({ onClose }) {
  const rootRef = useRef(null);
  useCloseOnPortfolioNavigate(onClose);

  useLayoutEffect(() => {
    document.body.classList.add("modal-open");
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    timeline
      .fromTo(rootRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
      .fromTo(rootRef.current.querySelectorAll(".cm"), { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.12 }, "<0.08");
    return () => {
      timeline.kill();
      window.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  return (
    <div ref={rootRef} className="career-overlay" role="dialog" aria-modal="true" aria-label="职业经历四个阶段" onClick={(e) => { if (e.target === e.currentTarget || e.target.classList.contains("career-overlay__inner")) onClose(); }}>
      <FixedClose onClose={onClose} />
      <div className="career-overlay__inner">
        <header className="career-overlay__head cm">
          <p className="eyebrow">CAREER TIMELINE / 2015—NOW</p>
          <h2>四个阶段，一条成长路径。</h2>
        </header>

        <div className="career-line">
          {career.map((stage, index) => (
            <div className="career-line__stage cm" key={stage.version}>
              <div className="career-line__top">
                <span className="career-line__ver">{stage.version}</span>
                <span className="career-line__period">{stage.period}</span>
                <span className="career-line__stage-en">{stage.stage}</span>
              </div>

              <div className="career-line__keyword">{stage.keyword}</div>
              <h3 className="career-line__role">{stage.role}</h3>
              <p className="career-line__en">{stage.en}</p>

              <p className="career-line__overview">{stage.overview}</p>

              <ul className="career-line__focus">
                {stage.focus.map((f) => <li key={f}>{f}</li>)}
              </ul>

              <div className="career-line__deliveries">
                <small>KEY DELIVERIES</small>
                <ul>
                  {stage.deliveries.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>

              <blockquote className="career-line__lesson">{stage.lesson}</blockquote>

              {index < career.length - 1 && (
                <div className="career-line__shift" aria-hidden="true">
                  <small className="career-line__shift-label">NEXT STAGE</small>
                  <span className="career-line__arrow">▶▶▶</span>
                  <p className="career-line__shift-text">{stage.shift}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExperienceSection() {
  const [open, setOpen] = useState(false);
  return (
    <section className="chapter chapter-experience" id="experience" data-chapter="1">
      <div className="experience-panel scene-panel" data-narrative-anchor="experience" data-thread-x="0.92" data-thread-y="0.12">
        <header className="scene-heading motion-item">
          <p className="eyebrow">EXPERIENCE / 2015—NOW</p>
          <h2>从设计执行者，到产品构建者。</h2>
          <p>十年设计实践，从视觉与界面出发，持续深入复杂业务、产品体验与设计系统，最终把设计判断推进到 AI 与代码，独立构建可运行产品。</p>
        </header>
        <div className="experience-card-grid motion-item">
          {career.map((item) => (
            <button type="button" className="experience-card interactive-card" key={item.version} onClick={() => setOpen(true)}>
              <span>{item.version}</span><small>{item.period}</small><h3>{item.role}</h3><p>{item.note}</p><b>VIEW STAGE</b>
            </button>
          ))}
        </div>
      </div>
      {open && <CareerStageDetail onClose={() => setOpen(false)} />}
    </section>
  );
}

// Build a loop unit tall enough to cover the viewport before duplicating it.
// This prevents short columns from exposing an empty gap during the cycle.
const fillLoopUnit = (items, minItems = 12) => {
  if (!items.length) return [];
  const repeats = Math.max(1, Math.ceil(minItems / items.length));
  return Array.from({ length: repeats }, () => items).flat();
};

// Web Animations keeps the playhead continuous when playbackRate changes.
// The track always contains exactly two identical, sufficiently tall units, so
// moving by 50% is a genuinely seamless loop in either direction.
const marqueeLaunch = (track, direction, durationIndex) => {
  let animation;
  let frameId;
  let disposed = false;
  const images = Array.from(track.querySelectorAll("img"));
  const ready = images.map((img) => img.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      }));

  Promise.all(ready).then(() => {
    if (disposed) return;
    frameId = requestAnimationFrame(() => {
      if (disposed) return;
      const loopDistance = Math.max(track.scrollHeight / 2, 1);
      const pixelsPerSecond = 30 + durationIndex * 2;
      const duration = Math.max(22000, (loopDistance / pixelsPerSecond) * 1000);
      const frames = direction < 0
        ? [{ transform: "translate3d(0,-50%,0)" }, { transform: "translate3d(0,0,0)" }]
        : [{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(0,-50%,0)" }];
      animation = track.animate(frames, { duration, iterations: Infinity, easing: "linear" });
      track.__marqueeAnimation = animation;
    });
  });

  return () => {
    disposed = true;
    if (frameId) cancelAnimationFrame(frameId);
    animation?.cancel();
    delete track.__marqueeAnimation;
  };
};
const marqueePause = (track) => { track.__marqueeAnimation?.pause(); };
const marqueeResume = (track) => { track.__marqueeAnimation?.play(); };

function VerticalImageStrips({ module, onPreview }) {
  const rootRef = useRef(null);
  const cleanupsRef = useRef([]);
  const images = module?.gallery?.length ? module.gallery : [module.image];

  useLayoutEffect(() => {
    const columns = gsap.utils.toArray(rootRef.current.querySelectorAll(".vertical-strip__track"));
    cleanupsRef.current = columns.map((column, index) => marqueeLaunch(column, index === 1 ? -1 : 1, index));
    return () => cleanupsRef.current.forEach((cleanup) => cleanup());
  }, [images]);

  const pauseColumn = (event) => marqueePause(event.currentTarget);
  const resumeColumn = (event) => marqueeResume(event.currentTarget);

  return (
    <div className="vertical-strips" ref={rootRef}>
      {[0, 1, 2].map((columnIndex) => {
        // Deal the gallery into 3 columns round-robin.
        const column = images.filter((_, i) => i % 3 === columnIndex);
        const shifted = column.length ? column : [images[0]];
        const loopUnit = fillLoopUnit(shifted);
        return (
          <div className="vertical-strip" key={columnIndex}>
            <div className="vertical-strip__track" onMouseEnter={pauseColumn} onMouseLeave={resumeColumn}>
              {[...loopUnit, ...loopUnit].map((src, index) => (
                <button type="button" key={`${src}-${columnIndex}-${index}`} onClick={() => onPreview?.({ src, module })}>
                  <img src={src} alt={`${module.title} 界面示例 ${index % loopUnit.length + 1}`} />
                  <span>{module.index}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SystemSection() {
  const [active, setActive] = useState(2);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const module = systemModules[active];
  useEffect(() => {
    const close = () => { setOpen(false); setPreview(null); };
    window.addEventListener("portfolio:navigate", close);
    return () => window.removeEventListener("portfolio:navigate", close);
  }, []);

  return (
    <section className="chapter chapter-system" id="wanying" data-chapter="2">
      <div className="system-screen-ui motion-item" data-narrative-anchor="system" data-thread-x="0.08" data-thread-y="0.12">
        <header className="system-screen-ui__header">
          <div><p className="eyebrow">WANYING DESIGN SYSTEM</p><h2>让复杂产品，共享同一种语言。</h2><p className="system-screen-ui__sub">万应低代码设计系统 · 从 Token 到组件到治理的完整构建实践</p></div>
          <div className="system-status"><span>05 MODULES</span><span>LIVE LIBRARY</span><small>DESIGN × CODE × GOVERNANCE</small></div>
        </header>
        <div className="system-screen-ui__body">
          <div className="system-strip-stage">
            <VerticalImageStrips module={module} onPreview={({ src }) => setPreview({ ...module, image: src, src })} />
            <div className="system-strip-stage__hint"><span>CLICK IMAGE TO PREVIEW</span><small>三列动态组件档案</small></div>
          </div>
          <aside className="system-module-console">
            <div className="system-module-summary" key={module.id}>
              <span>{module.index}</span><small>{module.caption}</small><h3>{module.title}</h3><p>{module.description}</p>
              <button type="button" onClick={() => setPreview(module)}>PREVIEW MODULE</button>
            </div>
            <p className="system-screen-tabs__hint" aria-hidden="true">横向滑动切换模块 <span>→</span></p>
            <div className="system-screen-tabs" role="tablist" aria-label="万应设计系统示例">
              {systemModules.map((item, index) => <button type="button" role="tab" aria-selected={active === index} className={active === index ? "is-active" : ""} key={item.id} onClick={() => setActive(index)}><span>{item.index}</span><strong>{item.tabEn}</strong><div className="system-screen-tabs__sub"><small>{item.tabLabel}</small><i>{item.caption}</i></div></button>)}
            </div>
          </aside>
        </div>
      </div>
      {preview && (
        <div className="system-preview-lightbox" role="dialog" aria-modal="true" aria-label={`${preview.title} 图片预览`} onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
          <FixedClose onClose={() => setPreview(null)} level={520} />
          <figure><ZoomableImage src={preview.image} alt={`${preview.title} 完整预览`} /><figcaption><span>{preview.index}</span><div><strong>{preview.title}</strong><small>{preview.description}</small></div></figcaption></figure>
        </div>
      )}
      {open && (
        <InfoOverlay eyebrow="WANYING / 05 MODULES" title="设计系统全景" onClose={() => setOpen(false)} className="system-overlay">
          <div className="system-detail-stage">
            <div className="system-detail-media">
              <img src={module.image} alt={`${module.title} 展示`} />
              <p>{module.description}</p>
            </div>
            <div className="system-detail-tabs" role="tablist" aria-label="万应设计系统模块">
              {systemModules.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active === index}
                  className={active === index ? "is-active" : ""}
                  onClick={() => setActive(index)}
                >
                  <span>{item.index}</span><strong>{item.title}</strong><small>{item.caption}</small>
                </button>
              ))}
            </div>
          </div>
        </InfoOverlay>
      )}
    </section>
  );
}

function ProjectGallery({ project, onOpen }) {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const tracks = gsap.utils.toArray(rootRef.current.querySelectorAll(".detail-gallery__track"));
    const cleanups = tracks.map((track, index) => marqueeLaunch(track, index === 1 ? -1 : 1, index + 2));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [project]);

  const images = project.gallery?.length ? project.gallery : [project.image];
  return (
    <div className={`detail-gallery detail-gallery--${project.caseStyle || "default"}`} ref={rootRef} style={{ "--gallery-backdrop": `url("${project.image}")` }}>
      <div className="detail-gallery__columns">
        {[0, 1, 2].map((columnIndex) => {
          const shifted = [...images.slice(columnIndex), ...images.slice(0, columnIndex)];
          const columnImages = ["mobile", "admin", "website"].includes(project.caseStyle)
            ? images.filter((_, index) => index % 3 === columnIndex)
            : shifted;
          const stream = columnImages.length ? columnImages : images;
          const loopUnit = fillLoopUnit(stream);
          return <div className="detail-gallery__column" key={columnIndex}><div className="detail-gallery__track">{[...loopUnit, ...loopUnit].map((src, index) => <button type="button" key={`${src}-${columnIndex}-${index}`} onClick={() => onOpen(src)}><img src={src} alt={`${project.title} UI ${index % loopUnit.length + 1}`} /></button>)}</div></div>;
        })}
      </div>
      <p>{project.caseStyle === "website" ? "WEB PAGES · MIXED-LENGTH STREAMS" : "UI ARCHIVE · 03 VERTICAL STREAMS"}</p>
    </div>
  );
}

function CapabilityRadar({ data }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const levels = 4;
  const count = data.length;
  const angle = (i) => (Math.PI * 2 * i) / count - Math.PI / 2;
  const point = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  const polyPoints = (r) => data.map((_, i) => point(i, r).join(",")).join(" ");
  const dataPoints = data.map((d, i) => point(i, (d.value / 100) * radius).join(",")).join(" ");
  return (
    <svg className="case-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="能力雷达">
      {Array.from({ length: levels }).map((_, lvl) => {
        const r = (radius * (lvl + 1)) / levels;
        return <polygon key={lvl} className="case-radar__grid" points={polyPoints(r)} />;
      })}
      {data.map((_, i) => {
        const [x, y] = point(i, radius);
        return <line key={i} className="case-radar__axis" x1={cx} y1={cy} x2={x} y2={y} />;
      })}
      <polygon className="case-radar__value" points={dataPoints} />
      {data.map((d, i) => {
        const [x, y] = point(i, radius + 16);
        return <text key={i} className="case-radar__label" x={x} y={y} textAnchor="middle" dominantBaseline="middle">{d.label}</text>;
      })}
    </svg>
  );
}

function ProjectDetail({ project, onClose }) {
  const detailRef = useRef(null);
  const [preview, setPreview] = useState(null);
  useCloseOnPortfolioNavigate(onClose);
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("modal-open");
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    timeline
      .fromTo(detailRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 })
      .fromTo(detailRef.current.querySelector(".detail-gallery"), { scale: 1.04, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.7 }, "<")
      .fromTo(detailRef.current.querySelectorAll(".case-motion"), { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.04 }, "<0.1");
    return () => timeline.kill();
  }, [project]);

  const meta = project.meta || {};
  const pains = project.pains || [];
  const coreDesign = project.coreDesign || [];
  const contributionSplit = project.contributionSplit || [];
  const timelinePhases = project.timeline || [];
  const capabilities = project.capabilities || [];
  const outcomeBars = project.outcomeBars || [];
  const stack = project.stack || [];
  const research = project.research || [];
  const insights = project.insights || [];
  const principles = project.principles || [];
  const visualSummary = CASE_VISUAL_SUMMARIES[project.caseStyle] || CASE_VISUAL_SUMMARIES.website;
  const maxSplit = Math.max(...contributionSplit.map((s) => s.value), 1);

  return (
    <div ref={detailRef} className={`detail-overlay detail-overlay--case detail-overlay--${project.caseStyle || "default"}`} role="dialog" aria-modal="true" aria-labelledby="project-title">
      {!preview && <FixedClose onClose={onClose} />}
      <ProjectGallery project={project} onOpen={setPreview} />
      <article className="case-stage">
        <header className="case-head case-motion">
          <div className="case-head__top">
            <span>{project.code} / CASE STUDY</span>
            <small>{project.type}</small>
          </div>
          <h2 id="project-title">{project.title}</h2>
          <p className="case-head__role">{project.role}</p>
        </header>

        <section className="case-meta case-motion" aria-label="基础信息">
          {meta.type && <div><i>项目类型</i><b>{meta.type}</b></div>}
          {meta.role && <div><i>我的角色</i><b>{meta.role}</b></div>}
          {meta.period && <div><i>项目周期</i><b>{meta.period}</b></div>}
          {meta.status && <div><i>项目状态</i><b>{meta.status}</b></div>}
          {meta.year && <div><i>完成时间</i><b>{meta.year}</b></div>}
        </section>

        <section className="case-metrics case-motion" aria-label="关键指标">
          {project.metrics.map(([value, label]) => <span key={label}><strong>{value}</strong><small>{label}</small></span>)}
        </section>

        <section className="case-visual-summary case-motion" aria-label="项目能力摘要">
          {visualSummary.map(([Icon, label, value]) => (
            <article key={label}>
              <span><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span>
              <div><small>{label}</small><strong>{value}</strong></div>
              <ArrowUpRight size={14} strokeWidth={1.7} aria-hidden="true" />
            </article>
          ))}
        </section>

        <section className="case-block case-motion" aria-labelledby="sec-01">
          <header className="case-block__head"><span>01</span><div><strong>项目概述</strong><small>PROJECT OVERVIEW</small></div></header>
          <p className="case-block__lead">{project.overview}</p>
          {project.background && <p className="case-block__support">{project.background}</p>}
          {project.disclaimer && <p className="case-disclaimer">{project.disclaimer}</p>}
        </section>

        <section className="case-block case-motion" aria-labelledby="sec-02">
          <header className="case-block__head"><span>02</span><div><strong>项目目标</strong><small>PROJECT GOAL</small></div></header>
          <div className="case-pains">
            <div className="case-pains__list">
              {pains.map((pain) => (
                <article className="pain-card" key={pain.tag}>
                  <span>{pain.tag}</span>
                  <strong>{pain.title}</strong>
                  <p>{pain.desc}</p>
                </article>
              ))}
            </div>
            <aside className="case-goal">
              <small>GOAL</small>
              <p>{project.goal}</p>
            </aside>
          </div>
        </section>

        {(research.length > 0 || insights.length > 0) && (
          <section className="case-block case-motion" aria-labelledby="sec-research">
            <header className="case-block__head"><span>03</span><div><strong>研究与洞察</strong><small>RESEARCH &amp; INSIGHTS</small></div></header>
            <div className="case-research">
              {research.map((item) => (
                <article key={`${item.method}-${item.sample}`}>
                  <div><small>{item.method}</small><b>{item.sample}</b></div>
                  <p>{item.finding}</p>
                </article>
              ))}
            </div>
            {insights.length > 0 && <ol className="case-insights">{insights.map((item, index) => <li key={item}><span>0{index + 1}</span><p>{item}</p></li>)}</ol>}
          </section>
        )}

        <section className="case-block case-motion" aria-labelledby="sec-03">
          <header className="case-block__head"><span>04</span><div><strong>我的贡献</strong><small>MY CONTRIBUTION</small></div></header>
          <p className="case-block__lead">{project.contribution}</p>
          <ul className="case-tags">
            {project.contributionTags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
          {contributionSplit.length > 0 && (
            <div className="case-split" aria-label="贡献分布">
              {contributionSplit.map((item) => (
                <div className="case-split__row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="case-split__track"><i style={{ width: `${(item.value / maxSplit) * 100}%` }} /></div>
                  <b>{item.value}%</b>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="case-block case-motion" aria-labelledby="sec-04">
          <header className="case-block__head"><span>05</span><div><strong>核心设计</strong><small>CORE DESIGN</small></div></header>
          <ul className="case-core">
            {coreDesign.map((item, index) => (
              <li key={index}>
                <div className="case-core__no">{String(index + 1).padStart(2, "0")}</div>
                <div className="case-core__body">
                  <div className="case-core__problem">
                    <small>PROBLEM</small>
                    <strong>{item.problem}</strong>
                  </div>
                  <div className="case-core__arrow" aria-hidden="true">→</div>
                  <div className="case-core__insight">
                    <small>INSIGHT</small>
                    <span>{item.insight}</span>
                  </div>
                  <div className="case-core__arrow" aria-hidden="true">→</div>
                  <div className="case-core__solution">
                    <small>SOLUTION</small>
                    <p>{item.solution}</p>
                  </div>
                  <div className="case-core__impact">{item.impact}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {principles.length > 0 && (
          <section className="case-block case-motion" aria-labelledby="sec-principles">
            <header className="case-block__head"><span>06</span><div><strong>设计原则</strong><small>DESIGN PRINCIPLES</small></div></header>
            <div className="case-principles">{principles.map((item, index) => <article key={item.title}><span>0{index + 1}</span><strong>{item.title}</strong><p>{item.desc}</p></article>)}</div>
          </section>
        )}

        {timelinePhases.length > 0 && (
          <section className="case-block case-motion" aria-labelledby="sec-05a">
            <header className="case-block__head"><span>07</span><div><strong>设计流程</strong><small>PROCESS</small></div></header>
            <ol className="case-timeline">
              {timelinePhases.map((phase, index) => (
                <li key={index}>
                  <div className="case-timeline__dot" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
                  <div className="case-timeline__body">
                    <small>{phase.phase}</small>
                    <strong>{phase.title}</strong>
                    <p>{phase.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="case-block case-motion" aria-labelledby="sec-05b">
          <header className="case-block__head"><span>08</span><div><strong>设计与实现</strong><small>DESIGN TO PRODUCT</small></div></header>
          {capabilities.length > 0 && (
            <div className="case-cap">
              <CapabilityRadar data={capabilities} />
              <ul className="case-stack">
                {stack.map((tool) => <li key={tool}>{tool}</li>)}
              </ul>
            </div>
          )}
        </section>

        <section className="case-block case-motion" aria-labelledby="sec-06">
          <header className="case-block__head"><span>09</span><div><strong>项目成果</strong><small>PROJECT OUTCOME</small></div></header>
          <p className="case-block__lead">{project.outcome}</p>
          {outcomeBars.length > 0 && (
            <div className="case-outcome" aria-label="成果可视化">
              {outcomeBars.map((bar) => (
                <div className="case-outcome__row" key={bar.label}>
                  <div className="case-outcome__label"><span>{bar.label}</span><small>{bar.caption}</small></div>
                  <div className="case-outcome__track"><i style={{ width: `${bar.value}%` }} /></div>
                  <b>{bar.value}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </article>
      {preview && <div className="project-image-lightbox" role="dialog" aria-modal="true" aria-label="项目界面预览" onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}><FixedClose onClose={() => setPreview(null)} level={520} /><ZoomableImage src={preview} alt={`${project.title} 项目界面`} /></div>}
    </div>
  );
}

function ProjectsSection() {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    const close = () => setDetail(null);
    window.addEventListener("portfolio:navigate", close);
    return () => window.removeEventListener("portfolio:navigate", close);
  }, []);
  return (
    <section className="chapter chapter-projects" id="projects" data-chapter="3">
      <div className="projects-panel scene-panel" data-narrative-anchor="projects" data-thread-x="0.92" data-thread-y="0.12">
        <header className="scene-heading motion-item">
          <p className="eyebrow">SELECTED PROJECTS / 03</p>
          <h2>用项目证明，我不只做视觉。</h2>
          <p>从系统建设、企业管理到移动服务，每一个项目都在证明：如何理解业务、定义问题、组织信息，并把设计真正推进到可落地的产品。</p>
        </header>
        <div className="project-cover-grid motion-item">
          {projects.map((item, index) => (
            <button type="button" className={`project-cover-card project-cover-card--${index + 1} interactive-card`} key={item.id} onClick={() => setDetail(item)}>
              <div className="project-cover-card__media" style={{ "--project-cover": `url("${item.image}")` }}>
                <img className="project-cover-card__art" src={item.image} alt={`${item.title} 项目封面`} />
              </div>
              <div className="project-cover-card__copy">
                <div className="project-cover-card__meta"><span>0{index + 1} / {item.code}</span><ArrowUpRight size={15} aria-hidden="true" /></div>
                <small>{item.type}</small>
                <h3>{item.title}</h3>
                <p>{item.brief}</p>
                <div className="project-cover-card__foot"><span>{item.role}</span><b>VIEW CASE / 查看详情</b></div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {detail && <ProjectDetail project={detail} onClose={() => setDetail(null)} />}
    </section>
  );
}

function GraphicCarousel({ items, onOpen }) {
  const stageRef = useRef(null);
  const cleanupsRef = useRef([]);
  const tracksRef = useRef([]);

  useLayoutEffect(() => {
    const tracks = gsap.utils.toArray(stageRef.current.querySelectorAll(".graphic-column__track"));
    tracksRef.current = tracks;
    cleanupsRef.current = tracks.map((track, index) => marqueeLaunch(track, index === 1 ? -1 : 1, index + 4));
    return () => cleanupsRef.current.forEach((cleanup) => cleanup());
  }, [items]);

  const columns = [0, 1, 2].map((column) => items.filter((_, index) => index % 3 === column));
  const wheelResetRef = useRef(null);
  const respondToWheel = () => {
    tracksRef.current.forEach((track) => track.__marqueeAnimation?.updatePlaybackRate(2.25));
    if (wheelResetRef.current) clearTimeout(wheelResetRef.current);
    wheelResetRef.current = setTimeout(() => {
      tracksRef.current.forEach((track) => track.__marqueeAnimation?.updatePlaybackRate(1));
    }, 260);
  };
  const pauseColumn = (event) => marqueePause(event.currentTarget);
  const resumeColumn = (event) => marqueeResume(event.currentTarget);

  return (
    <div className="graphic-carousel graphic-loop motion-item" ref={stageRef} onWheel={respondToWheel}>
      <div className="graphic-loop__meta"><span>{String(items.length).padStart(2, "0")} WORKS</span><small>SCROLL TO ACCELERATE</small></div>
      <div className="graphic-loop__columns">
        {columns.map((column, columnIndex) => (
          <div className="graphic-column" key={columnIndex}>
            <div className="graphic-column__track" onMouseEnter={pauseColumn} onMouseLeave={resumeColumn}>
              {(() => {
                const loopUnit = fillLoopUnit(column);
                return [...loopUnit, ...loopUnit].map((work, index) => <button type="button" className="graphic-slide interactive-card" key={`${work.src}-${columnIndex}-${index}`} onClick={() => onOpen(work)}><img src={work.src} alt={work.title} loading="lazy" /><span><small>{work.type}</small><strong>{work.title}</strong></span></button>);
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphicSection() {
  const [selected, setSelected] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [items, setItems] = useState(works);
  const [activeWork, setActiveWork] = useState(null);
  useEffect(() => {
    const close = () => { setSelected(null); setArchiveOpen(false); };
    window.addEventListener("portfolio:navigate", close);
    return () => window.removeEventListener("portfolio:navigate", close);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/library-images?dir=05-graphic")
      .then((r) => (r.ok ? r.json() : null))
      .then((files) => {
        if (!alive || !Array.isArray(files) || !files.length) return;
        const list = files.map((file, index) => {
          const base = file.replace(/\.(png|jpe?g|webp)$/i, "");
          const fallback = works.find((w) => w.src.includes(base)) || {};
          return {
            src: `/assets/library/05-graphic/${file}`,
            title: fallback.title || base,
            type: fallback.type || "GRAPHIC / ARCHIVE",
          };
        });
        setItems(list);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const driftItems = items.map((w) => ({ image: w.src, title: w.title, type: w.type, href: undefined, __raw: w }));
  const handleTileActivate = useCallback((item) => {
    setActiveWork(item?.__raw ?? null);
  }, []);
  const handleTileOpen = useCallback((item) => {
    if (item?.__raw) setSelected(item.__raw);
  }, []);

  return (
    <section className="chapter chapter-graphic" id="graphic" data-chapter="4">
      <div className="graphic-panel scene-panel" data-narrative-anchor="graphic" data-thread-x="0.08" data-thread-y="0.12">
        <header className="scene-heading motion-item"><p className="eyebrow">GRAPHIC ARCHIVE / {String(items.length).padStart(2, "0")}</p><h2>在界面之外，<br />继续构建<br />设计语言。</h2><p>从品牌视觉、海报与版式，到图形系统与动态实验——证明我不只处理复杂产品问题，同样能驾驭多元视觉表达。</p><button type="button" className="chapter-action" onClick={() => setArchiveOpen(true)}>EXPLORE ARCHIVE / 浏览完整作品</button></header>
        <div className="graphic-drift motion-item">
          <DriftWall
            items={driftItems}
            columns={3}
            tileWidth={220}
            gap={16}
            radius={8}
            speed={32}
            direction="up"
            variance={0.3}
            onTileActivate={handleTileActivate}
            onOpen={handleTileOpen}
          />
          <div className="graphic-drift__caption">
            {activeWork ? (
              <><span>{activeWork.type}</span><strong>{activeWork.title}</strong><button type="button" onClick={() => setSelected(activeWork)}>VIEW</button></>
            ) : (
              <><span>HOVER A TILE</span><strong>{String(items.length).padStart(2, "0")} WORKS</strong><small>SCROLL TO BROWSE</small></>
            )}
          </div>
        </div>
      </div>
      {archiveOpen && (
        <InfoOverlay eyebrow="GRAPHIC ARCHIVE" title={`视觉定格 / ${String(items.length).padStart(2, "0")}`} onClose={() => setArchiveOpen(false)} className="graphic-overlay">
          <div className="archive-grid">
            {items.map((work, index) => (
              <button type="button" className="archive-item" key={work.src} onClick={() => setSelected(work)}>
                <img src={work.src} alt={work.title} loading="lazy" />
                <span><small>0{index + 1} · {work.type}</small><strong>{work.title}</strong></span>
              </button>
            ))}
          </div>
        </InfoOverlay>
      )}
      {selected && (
        <div className="work-lightbox" role="dialog" aria-modal="true" aria-label={selected.title} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <FixedClose onClose={() => setSelected(null)} level={520} />
          <ZoomableImage src={selected.src} alt={selected.title} />
          <p>{selected.title}<small>{selected.type}</small></p>
        </div>
      )}
    </section>
  );
}

function VibeSection() {
  const [active, setActive] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [localNotice, setLocalNotice] = useState(null);
  const detailRef = useRef(null);
  useEffect(() => {
    const close = () => { setDetailOpen(false); setQrOpen(false); setLocalNotice(null); };
    window.addEventListener("portfolio:navigate", close);
    return () => window.removeEventListener("portfolio:navigate", close);
  }, []);

  useLayoutEffect(() => {
    if (!detailOpen || !detailRef.current) return undefined;
    const timeline = gsap.timeline();
    timeline.fromTo(detailRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: .3 })
      .fromTo(detailRef.current.querySelectorAll(".vibe-detail-motion"), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, stagger: .07, ease: "power3.out" }, "<0.05");
    return () => timeline.kill();
  }, [active, detailOpen]);

  const project = vibeProjects[active];

  return (
    <section className="chapter chapter-vibe" id="vibe" data-chapter="5">
      <div className="vibe-showcase scene-panel" data-narrative-anchor="vibe" data-thread-x="0.5" data-thread-y="0.08">
        <header className="scene-heading scene-heading--center motion-item"><p className="eyebrow">VIBE CODING / PRODUCT BUILDER LAB</p><h2>不只使用 AI，而是把它变成产品。</h2><p>这里没有设计稿和开发交付的割裂——每个项目都从想法出发，经过设计、AI 协作与代码实现，最终跑在浏览器里，可以被使用、被验证。</p></header>
        <div className="vibe-card-row motion-item">
          {vibeProjects.map((item, index) => (
            <article className="vibe-preview-card interactive-card" key={item.code}>
              <button type="button" className="vibe-preview-card__media" onClick={() => { setActive(index); setDetailOpen(true); }}>
                {item.mediaType === "video" ? <video src={item.image} muted loop playsInline preload="metadata" /> : <img src={item.image} alt={`${item.title} 预览`} />}
                <span>{item.code}</span>
              </button>
              <div><small>{item.index} / EXPERIMENT</small><h3>{item.title}</h3><p>{item.description}</p><div className="vibe-card-actions"><button type="button" className="vibe-btn-detail" onClick={() => { setActive(index); setDetailOpen(true); }}>构建过程</button>{item.wechat ? (<button type="button" className="vibe-btn-visit" onClick={() => { setActive(index); setQrOpen(true); }}>打开产品</button>) : item.link && item.link !== "#" ? (<a className="vibe-btn-visit" href={item.link} target="_blank" rel="noreferrer">打开产品</a>) : (<button type="button" className="vibe-btn-visit" onClick={() => setLocalNotice(item)}>打开产品</button>)}</div></div>
            </article>
          ))}
        </div>
      </div>
      {detailOpen && (
        <InfoOverlay eyebrow={`${project.code} / CASE STUDY`} title={project.title} onClose={() => setDetailOpen(false)} className="vibe-detail-overlay">
          <div className="vibe-case" ref={detailRef} onClick={(e) => { if (e.target === e.currentTarget) setDetailOpen(false); }}>
            <div className="vibe-case__media vibe-detail-motion" onClick={(e) => e.stopPropagation()}>
              {project.mediaType === "video" ? <video src={project.image} autoPlay muted loop playsInline /> : <img src={project.image} alt={`${project.title} 封面`} />}
              <div className="vibe-case__overlay" />
              <div className="vibe-case__title">
                <span>{project.code}</span>
                <h3>{project.title}</h3>
                <small>{project.tags}</small>
              </div>
            </div>
            <div className="vibe-case__content" onClick={(e) => e.stopPropagation()}>
              <div className="vibe-case__main">
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>背景</h4>
                  <p>{project.background}</p>
                </div>
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>问题</h4>
                  <p>{project.problem}</p>
                </div>
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>方案</h4>
                  <p>{project.solution}</p>
                </div>
                <section className="vibe-build-notes vibe-detail-motion" aria-label="设计推演与问题解决">
                  <header><small>BUILD NOTES</small><h4>从想法到可用产品</h4></header>
                  {project.buildNotes.map((note) => (
                    <article key={note.step}>
                      <span>{note.step}</span>
                      <div>
                        <h5>{note.title}</h5>
                        <p><b>为什么这样做：</b>{note.thinking}</p>
                        <p><b>遇到的问题：</b>{note.obstacle}</p>
                        <p><b>如何解决：</b>{note.resolution}</p>
                      </div>
                    </article>
                  ))}
                </section>
              </div>
              <aside className="vibe-case__side">
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>核心亮点</h4>
                  <ul>{project.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>技术栈</h4>
                  <div className="vibe-case__stack">{project.stack.map((s) => <span key={s}>{s}</span>)}</div>
                </div>
                <div className="vibe-case__actions vibe-detail-motion">
                  {project.wechat ? (<button type="button" className="vibe-btn-visit" onClick={() => { setDetailOpen(false); setQrOpen(true); }}>打开产品</button>) : project.link && project.link !== "#" ? (<a className="vibe-btn-visit" href={project.link} target="_blank" rel="noreferrer">打开产品</a>) : (<button type="button" className="vibe-btn-visit" onClick={() => setLocalNotice(project)}>打开产品</button>)}
                  <button type="button" className="vibe-btn-close" onClick={() => setDetailOpen(false)}>关闭</button>
                </div>
              </aside>
            </div>
          </div>
        </InfoOverlay>
      )}
      {qrOpen && project.wechat && (
        <div className="wechat-qr-overlay" role="dialog" aria-modal="true" aria-label={`${project.title} 小程序码`} onClick={(e) => { if (e.target === e.currentTarget) setQrOpen(false); }}>
          <div className="wechat-qr-modal">
            <FixedClose onClose={() => setQrOpen(false)} level={520} />
            <img src={project.wechat.qr} alt={`${project.title} 小程序码`} />
            <p>{project.wechat.hint}</p>
          </div>
        </div>
      )}
      {localNotice && (
        <div className="local-app-overlay" role="dialog" aria-modal="true" aria-labelledby="local-app-title" onClick={(event) => { if (event.target === event.currentTarget) setLocalNotice(null); }}>
          <div className="local-app-modal">
            <FixedClose onClose={() => setLocalNotice(null)} level={520} />
            <div className="local-app-modal__signal"><AppWindow size={28} strokeWidth={1.6} /><i /></div>
            <small>LOCAL BUILD / PRIVATE PREVIEW</small>
            <h3 id="local-app-title">这是一款本地运行的作品</h3>
            <p><strong>{localNotice.title}</strong> 暂未开放公网体验。欢迎通过右上角「合作与交流」联系我，我会为你提供现场演示或体验版本。</p>
            <div className="local-app-modal__meta">
              <span><CircleGauge size={15} />完整交互演示</span>
              <span><MessageCircle size={15} />联系作者体验</span>
            </div>
            <div className="local-app-modal__actions">
              <button type="button" onClick={() => setLocalNotice(null)}>稍后再看</button>
              <a href="mailto:zen92@foxmail.com?subject=作品体验咨询">联系作者 <ArrowUpRight size={15} /></a>
            </div>
          </div>
        </div>
      )}
      <footer className="final-credit motion-item">
        <span>AVAILABLE FOR SELECT COLLABORATIONS</span>
        <a href="mailto:zen92@foxmail.com">ZEN92@FOXMAIL.COM</a>
      </footer>
    </section>
  );
}

export function App() {
  const [activeChapter, setActiveChapter] = useState(0);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { progress: frameProgress, ready: framesReady, error: frameError, retry: retryFrames } = useFrameBootloader();
  const [loaderVisible, setLoaderVisible] = useState(true);
  const shellRef = useRef(null);
  // Shared flag so programmatic navigation (nav clicks) can suspend scroll snapping.
  const snapControlRef = useRef({ navigateProgrammatic: false });
  const navigateTimerRef = useRef(0);
  useScrollSnap(6, snapControlRef);

  useEffect(() => {
    if (!framesReady) return undefined;
    const leaveTimer = window.setTimeout(() => setLoaderVisible(false), 720);
    return () => window.clearTimeout(leaveTimer);
  }, [framesReady]);

  useEffect(() => {
    let frame = 0;
    const updateChapter = () => {
      frame = 0;
      const chapterNodes = [...document.querySelectorAll(".chapter[data-chapter]")];
      if (!chapterNodes.length) return;

      // Mobile chapters can be taller than one viewport. Derive the active
      // scene from what is nearest the visual center, not a 100vh grid.
      const viewportCenter = window.innerHeight / 2;
      const current = chapterNodes.reduce((closest, node) => {
        const rect = node.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        return distance < closest.distance
          ? { index: Number(node.dataset.chapter), distance }
          : closest;
      }, { index: 0, distance: Number.POSITIVE_INFINITY });
      setActiveChapter(clamp(current.index, 0, 5));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateChapter);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    updateChapter();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const prevChapterRef = useRef(0);

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const allItems = gsap.utils.toArray(".chapter .motion-item");
      const activeItems = gsap.utils.toArray(`.chapter[data-chapter="${activeChapter}"] .motion-item`);
      const inactiveItems = allItems.filter((item) => !activeItems.includes(item));
      gsap.killTweensOf(allItems);

      // Direction vector per element, based on its position inside the chapter.
      // Items on the left fly in from the left, right items from the right,
      // centered items drop in from above. This gives every page a composed,
      // spatial entrance instead of a uniform slide.
      const directionFor = (el, chapterEl) => {
        if (!chapterEl) return { x: 0, y: -28 };
        const cr = chapterEl.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const cx = (er.left + er.right) / 2 - cr.left;
        const cy = (er.top + er.bottom) / 2 - cr.top;
        const nx = cr.width ? (cx / cr.width) - 0.5 : 0; // -0.5..0.5
        const ny = cr.height ? (cy / cr.height) - 0.5 : 0;
        const dist = Math.sqrt(nx * nx + ny * ny) || 1;
        // Horizontal bias dominates for off-center items.
        const x = Math.abs(nx) > 0.18 ? Math.sign(nx) * 46 : 0;
        const y = x === 0 ? (cy < cr.height * 0.5 ? -34 : 34) : ny * 30;
        return { x, y };
      };

      const prevChapter = prevChapterRef.current;
      const prevChapterEl = shellRef.current?.querySelector(`.chapter[data-chapter="${prevChapter}"]`);
      const prevItems = prevChapterEl
        ? gsap.utils.toArray(prevChapterEl.querySelectorAll(".motion-item"))
        : [];

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // EXIT previous chapter: quick scatter-out (fade + drift + blur + shrink).
      if (prevItems.length && prevChapter !== activeChapter) {
        prevItems.forEach((el) => {
          const d = directionFor(el, prevChapterEl);
          tl.to(el, {
            autoAlpha: 0,
            x: d.x * 0.6,
            y: d.y * 0.6,
            scale: 0.96,
            filter: "blur(6px)",
            duration: 0.3,
            ease: "power2.in",
            overwrite: "auto",
          }, 0);
        });
        // Make sure non-active, non-prev items stay hidden too.
        const others = inactiveItems.filter((el) => !prevItems.includes(el));
        gsap.set(others, { autoAlpha: 0, x: 0, y: 0, scale: 1, filter: "blur(0px)" });
      } else {
        gsap.set(inactiveItems, { autoAlpha: 0, x: 0, y: 0, scale: 1, filter: "blur(0px)" });
      }

      // ENTER active chapter: directional fly-in with light back-out + blur->sharp.
      const activeChapterEl = shellRef.current?.querySelector(`.chapter[data-chapter="${activeChapter}"]`);
      activeItems.forEach((el, i) => {
        const d = directionFor(el, activeChapterEl);
        gsap.set(el, { autoAlpha: 0, x: d.x, y: d.y, scale: 0.96, filter: "blur(8px)" });
        tl.to(el, {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.5,
          ease: "back.out(1.4)",
          overwrite: "auto",
        }, prevItems.length && prevChapter !== activeChapter ? 0.22 : 0);
      });

      prevChapterRef.current = activeChapter;
    }, shellRef);
    return () => context.revert();
  }, [activeChapter]);

  useEffect(() => {
    const scope = shellRef.current?.querySelector(`.chapter[data-chapter="${activeChapter}"]`);
    if (!scope || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const cards = [...scope.querySelectorAll(".interactive-card")];
    const cleanups = cards.map((card) => {
      const image = card.querySelector("img");
      const onEnter = () => {
        gsap.to(card, { y: -5, scale: 1.01, duration: .36, ease: "power3.out", overwrite: "auto" });
        if (image) gsap.to(image, { scale: 1.04, duration: .65, ease: "power3.out", overwrite: "auto" });
      };
      const onLeave = () => {
        gsap.to(card, { y: 0, scale: 1, duration: .5, ease: "power3.out", overwrite: "auto" });
        if (image) gsap.to(image, { scale: 1, duration: .55, ease: "power3.out", overwrite: "auto" });
      };
      card.addEventListener("mouseenter", onEnter);
      card.addEventListener("mouseleave", onLeave);
      return () => {
        card.removeEventListener("mouseenter", onEnter);
        card.removeEventListener("mouseleave", onLeave);
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [activeChapter]);

  // Hard-stop scroll at the final chapter — no empty tail beyond page 06.
  useEffect(() => {
    const isPhoneLayout = () => window.matchMedia("(max-width: 760px)").matches;
    const lockTail = () => {
      if (isPhoneLayout()) return;
      const pageH = Math.max(1, window.innerHeight);
      const maxScroll = pageH * 5;
      if (window.scrollY > maxScroll) {
        window.scrollTo({ top: maxScroll, behavior: "auto" });
      }
    };
    lockTail();
    window.addEventListener("scroll", lockTail, { passive: true });
    window.addEventListener("resize", lockTail);
    return () => {
      window.removeEventListener("scroll", lockTail);
      window.removeEventListener("resize", lockTail);
    };
  }, []);

  const navigate = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    const isPhoneLayout = window.matchMedia("(max-width: 760px)").matches;
    const pageH = Math.max(1, window.innerHeight);
    const maxScroll = pageH * 5;
    const top = isPhoneLayout ? target.offsetTop : Math.min(target.offsetTop, maxScroll);
    // Suppress scroll-snap briefly so it doesn't fight the smooth programmatic scroll.
    snapControlRef.current.navigateProgrammatic = true;
    window.clearTimeout(navigateTimerRef.current);
    navigateTimerRef.current = window.setTimeout(() => { snapControlRef.current.navigateProgrammatic = false; }, 900);
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div ref={shellRef} className="portfolio-shell">
      {framesReady && <CinematicBackdrop />}
      {loaderVisible && <LoadingScreen progress={frameProgress} ready={framesReady} error={frameError} onRetry={retryFrames} />}
      <NarrativeThread activeChapter={activeChapter} />
      <Navigation activeChapter={activeChapter} onNavigate={navigate} onMenuChange={setNavigationOpen} />
      <ChapterIndex index={activeChapter} />
      <GuideLine activeChapter={activeChapter} />
      <ProfileBadge hidden={navigationOpen} />
      <main>
        <AboutSection />
        <ExperienceSection />
        <SystemSection />
        <ProjectsSection />
        <GraphicSection />
        <VibeSection />
      </main>
    </div>
  );
}
