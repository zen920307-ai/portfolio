import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  AppWindow, ArrowRight, ArrowUpRight, Box, Building2, ChartNoAxesCombined, CircleGauge,
  CodeXml, Command, Compass, Cpu, Database, FileText, Film, Layers3,
  LayoutDashboard, MessageCircle, MousePointerClick, Network, Orbit, Palette,
  PenTool, Route, Search, ShieldCheck, Smartphone, Sparkles, Target, UsersRound,
  Wand2, Wind, Workflow, Zap,
} from "lucide-react";
import { chapters } from "./data.js";
import { resolveContent, syncPublishedContent } from "./content.js";
import { ProfileBadge } from "./ProfileBadge.jsx";
import LoadingCompanions from "./components/LoadingCompanions.jsx";
import IpEpilogue from "./components/IpEpilogue.jsx";
import DriftWall from "./components/DriftWall.jsx";
import TiltedCard from "./components/TiltedCard.jsx";
import StrokeText from "./components/StrokeText.jsx";
import { LogoLoop } from "./components/LogoLoop.jsx";
import TextType from "./components/TextType.jsx";
import { ResponsiveImage, responsiveImageUrl } from "./components/ResponsiveImage.jsx";

gsap.registerPlugin(ScrollTrigger);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const FRAME_COUNTS = [240, 240, 240, 240, 240];
// The source sequences were authored at 60fps. Sampling every second frame
// preserves a smooth ~30fps story beat while cutting cold-load, decoding, and
// Cache Storage pressure in half on external connections.
const FRAME_SAMPLE_STEP = 2;
// Normalized subject positions sampled from each sequence. Mobile portraits
// interpolate between these points so the narrow crop follows the story,
// while the desktop composition keeps its original centered framing.
const MOBILE_FOCAL_TRACKS = [
  [[0, 0.36, 0.48], [60, 0.50, 0.48], [120, 0.50, 0.50], [180, 0.68, 0.50], [239, 0.76, 0.50]],
  [[0, 0.77, 0.50], [60, 0.70, 0.50], [120, 0.77, 0.48], [180, 0.80, 0.48], [239, 0.84, 0.48]],
  [[0, 0.84, 0.46], [60, 0.84, 0.46], [120, 0.84, 0.46], [180, 0.50, 0.50], [239, 0.72, 0.48]],
  [[0, 0.72, 0.50], [60, 0.65, 0.50], [120, 0.72, 0.50], [180, 0.66, 0.50], [239, 0.32, 0.52]],
  [[0, 0.30, 0.52], [60, 0.32, 0.52], [120, 0.45, 0.52], [180, 0.50, 0.62], [239, 0.50, 0.62]],
];
const mobileFocalPoint = (segment, frameIndex) => {
  const track = MOBILE_FOCAL_TRACKS[segment] || MOBILE_FOCAL_TRACKS[0];
  const nextIndex = track.findIndex(([frame]) => frame >= frameIndex);
  if (nextIndex <= 0) {
    const point = nextIndex === -1 ? track[track.length - 1] : track[0];
    return { x: point[1], y: point[2] };
  }
  const from = track[nextIndex - 1];
  const to = track[nextIndex];
  const progress = (frameIndex - from[0]) / Math.max(1, to[0] - from[0]);
  return {
    x: from[1] + (to[1] - from[1]) * progress,
    y: from[2] + (to[2] - from[2]) * progress,
  };
};
const FRAME_CACHE_NAME = "tang-portfolio-frames-v3";
const framePath = (segment, frameIndex) => (
  `/frames/scroll-0${segment + 1}/frame-${String(frameIndex + 1).padStart(4, "0")}.webp`
);
const sampledFrameIndices = (segment, start = 0, count = FRAME_COUNTS[segment]) => {
  const end = Math.min(FRAME_COUNTS[segment], start + count);
  const indexes = [];
  for (let frameIndex = start; frameIndex < end; frameIndex += FRAME_SAMPLE_STEP) indexes.push(frameIndex);
  const finalIndex = end - 1;
  if (end === FRAME_COUNTS[segment] && indexes.at(-1) !== finalIndex) indexes.push(finalIndex);
  return indexes;
};
const sampledFrameIndex = (segment, frameIndex) => {
  const lastIndex = FRAME_COUNTS[segment] - 1;
  const bounded = clamp(frameIndex, 0, lastIndex);
  return bounded === lastIndex ? lastIndex : Math.round(bounded / FRAME_SAMPLE_STEP) * FRAME_SAMPLE_STEP;
};
// The opening act consists of three complete frame transitions.  They are
// deliberately the entry gate, so the first scroll through the story is
// seamless; the last two transitions continue warming after entry.
const BOOT_SEGMENT_COUNT = 3;
const CRITICAL_FRAME_URLS = Array.from(
  { length: BOOT_SEGMENT_COUNT },
  (_, segment) => sampledFrameIndices(segment).map((frameIndex) => framePath(segment, frameIndex)),
).flat();
const BOOT_PACK_VERSION = "v1";
const BOOT_PACK_READY_URL = `/frame-packs/boot-${BOOT_PACK_VERSION}-ready`;
let criticalFramePromise = null;
const backgroundFramePromises = new Map();
const framePreloadListeners = new Set();
const backgroundProgressListeners = new Set();
let latestBackgroundProgress = 0;
const emitFrameProgress = (value) => framePreloadListeners.forEach((listener) => listener(value));
const emitBackgroundProgress = (value) => {
  latestBackgroundProgress = value;
  backgroundProgressListeners.forEach((listener) => listener(value));
};

const firstSegmentReadyListeners = new Set();
const emitFirstSegmentReady = () => firstSegmentReadyListeners.forEach((listener) => listener());

const FRAME_REQUEST_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url, options = {}, onChunk) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FRAME_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`REQUEST_${response.status}`);
    if (!onChunk || !response.body) return response;

    const total = Number(response.headers.get("content-length")) || 0;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onChunk(received, total);
    }
    onChunk(received, total || received);
    return new Response(new Blob(chunks), { headers: response.headers, status: response.status, statusText: response.statusText });
  } finally {
    window.clearTimeout(timeout);
  }
}

// The prelude is a complete little scene, not a blank screen while the main
// site downloads.  Do not begin the much larger frame queue until its own
// backdrop and characters have had a chance to appear.
function usePreludeVisualsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const backdrop = "/assets/video/cloud-entry-poster.webp";
    const waitForImage = (src) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => image.decode().catch(() => {}).then(resolve);
      image.onerror = () => resolve();
      image.src = src;
      if (image.complete) resolve();
    });
    // Allow the decoded opening scene and chat controls to paint before
    // starting any cinematic downloads, even on connections slower than 1.8s.
    const finish = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!cancelled) setReady(true);
      }));
    };
    Promise.all([waitForImage(backdrop), waitForImage("/assets/dundun-pupu.webp")]).then(finish);
    return () => { cancelled = true; };
  }, []);
  return ready;
}

async function cacheCriticalFrames() {
  if (criticalFramePromise) return criticalFramePromise;

  criticalFramePromise = (async () => {
    // A browser may prohibit Cache Storage in private or embedded contexts.
    // Let visitors into the story instead of trapping them behind a loader.
    if (!("caches" in window)) {
      emitFrameProgress(100);
      emitFirstSegmentReady();
      return;
    }
    let cache;
    try {
      cache = await caches.open(FRAME_CACHE_NAME);
    } catch {
      emitFrameProgress(100);
      emitFirstSegmentReady();
      return;
    }
    if (await cache.match(BOOT_PACK_READY_URL)) {
      emitFrameProgress(100);
      emitFirstSegmentReady();
      return;
    }

    let completed = 0;
    let enterGateSignaled = false;
    let highestProgress = 0;
    const reportProgress = (value) => {
      highestProgress = Math.max(highestProgress, value);
      emitFrameProgress(highestProgress);
    };
    // The first three narrative transitions block entry.  The remaining
    // transitions are warmed after entry, in the background and in order.
    const enterGateCount = CRITICAL_FRAME_URLS.length;
    const update = () => reportProgress(Math.round((completed / CRITICAL_FRAME_URLS.length) * 100));
    const markCompleted = () => {
      completed += 1;
      update();
      if (!enterGateSignaled && completed >= enterGateCount) {
        enterGateSignaled = true;
        emitFirstSegmentReady();
      }
    };

    const packTransfer = new Map();
    const reportPackTransfer = () => {
      const values = [...packTransfer.values()];
      const knownTotal = values.reduce((sum, item) => sum + item.total, 0);
      const received = values.reduce((sum, item) => sum + item.received, 0);
      // The first 20% represents the actual package transfer.  This avoids a
      // motionless 0% label while a cold device is still receiving bytes.
      if (knownTotal > 0) reportProgress(Math.min(20, Math.round((received / knownTotal) * 20)));
    };

    const unpackSegment = async (segment) => {
      const packUrl = `/frame-packs/boot-0${segment + 1}.zfp`;
      packTransfer.set(segment, { received: 0, total: 0 });
      const response = await fetchWithTimeout(packUrl, { cache: "force-cache" }, (received, total) => {
        packTransfer.set(segment, { received, total });
        reportPackTransfer();
      });
      const buffer = await response.arrayBuffer();
      const view = new DataView(buffer);
      const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
      if (magic !== "ZFP1") throw new Error("FRAME_PACK_MAGIC");
      const headerLength = view.getUint32(4, true);
      const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength)));
      if (header.version !== 1 || header.segment !== segment) throw new Error("FRAME_PACK_VERSION");
      const dataOffset = 8 + headerLength;

      for (let start = 0; start < header.entries.length; start += 12) {
        const batch = header.entries.slice(start, start + 12);
        await Promise.all(batch.map(async ({ frameIndex, offset, length }) => {
          const url = framePath(segment, frameIndex);
          if (!(await cache.match(url))) {
            const bytes = buffer.slice(dataOffset + offset, dataOffset + offset + length);
            await cache.put(url, new Response(bytes, {
              headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" },
            }));
          }
          markCompleted();
        }));
      }
    };

    const fallbackToIndividualFrames = async () => {
      completed = 0;
      enterGateSignaled = false;
      const queue = [...CRITICAL_FRAME_URLS];
      const worker = async () => {
        while (queue.length) {
          const url = queue.shift();
          const existing = await cache.match(url);
          if (!existing) {
            let response;
            for (let attempt = 0; attempt < 3; attempt += 1) {
              try {
                response = await fetchWithTimeout(url, { cache: "force-cache" });
                await cache.put(url, response.clone());
                break;
              } catch (error) {
                if (attempt === 2) throw error;
              }
            }
          }
          markCompleted();
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    };

    emitFrameProgress(0);
    try {
      const results = await Promise.allSettled(
        Array.from({ length: BOOT_SEGMENT_COUNT }, (_, segment) => unpackSegment(segment)),
      );
      if (results.some((result) => result.status === "rejected")) throw new Error("FRAME_PACK_UNAVAILABLE");
    } catch {
      await fallbackToIndividualFrames();
    }
    if (!enterGateSignaled) emitFirstSegmentReady();
    await cache.put(BOOT_PACK_READY_URL, new Response("ready"));
    emitFrameProgress(100);
  })().catch((error) => {
    criticalFramePromise = null;
    throw error;
  });

  return criticalFramePromise;
}

function warmFrameWindow(segment, start = 0, count = 96, onProgress) {
  if (!("caches" in window) || segment < 0 || segment >= FRAME_COUNTS.length) return Promise.resolve();
  const urls = sampledFrameIndices(segment, start, count).map((frameIndex) => framePath(segment, frameIndex));
  const queued = urls.filter((url) => !backgroundFramePromises.has(url));
  const existing = urls.filter((url) => backgroundFramePromises.has(url)).map((url) => backgroundFramePromises.get(url));
  const worker = async () => {
    const cache = await caches.open(FRAME_CACHE_NAME);
    while (queued.length) {
      const url = queued.shift();
      const task = (async () => {
        if (await cache.match(url)) return;
        const response = await fetch(url, { cache: "force-cache" });
        if (response.ok) await cache.put(url, response.clone());
      })().catch(() => undefined);
      backgroundFramePromises.set(url, task);
      await task;
      onProgress?.();
    }
  };
  existing.forEach((task) => task.finally(() => onProgress?.()));
  return Promise.all([...existing, ...Array.from({ length: 2 }, worker)]);
}

function useFrameBootloader(enabled) {
  const [progress, setProgress] = useState(0);
  const [canEnter, setCanEnter] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const backgroundStartedRef = useRef(false);

  const startBackgroundWarm = useCallback(() => {
    if (backgroundStartedRef.current) return;
    backgroundStartedRef.current = true;
    let completed = 0;
    const total = Array.from({ length: FRAME_COUNTS.length }, (_, segment) => sampledFrameIndices(segment).length)
      .reduce((sum, count) => sum + count, 0);
    const reportBackgroundProgress = () => {
      completed += 1;
      emitBackgroundProgress(Math.min(100, Math.round((completed / total) * 100)));
    };
    (async () => {
      for (let segment = 0; segment < FRAME_COUNTS.length; segment += 1) {
        await warmFrameWindow(segment, 0, FRAME_COUNTS[segment], reportBackgroundProgress);
      }
    })().then(() => {
      emitBackgroundProgress(100);
      setBackgroundReady(true);
    });
  }, []);

  const run = useCallback(() => {
    setError(false);
    setCanEnter(false);
    setReady(false);
    emitBackgroundProgress(0);
    setBackgroundReady(false);
    backgroundStartedRef.current = false;
    cacheCriticalFrames().then(() => {
      setReady(true);
      setCanEnter(true);
      startBackgroundWarm();
    }).catch(() => setError(true));
  }, [startBackgroundWarm]);

  useEffect(() => {
    framePreloadListeners.add(setProgress);
    const onFirst = () => setCanEnter(true);
    firstSegmentReadyListeners.add(onFirst);
    if (enabled) run();
    return () => {
      framePreloadListeners.delete(setProgress);
      firstSegmentReadyListeners.delete(onFirst);
    };
  }, [enabled, run]);

  return { progress, canEnter, ready, error, retry: run, backgroundReady, startBackgroundWarm };
}

function CinematicLoadingNotice() {
  const [progress, setProgress] = useState(latestBackgroundProgress);
  useEffect(() => {
    backgroundProgressListeners.add(setProgress);
    return () => backgroundProgressListeners.delete(setProgress);
  }, []);
  return (
    <aside className="cinematic-loading-notice" aria-live="polite">
      <span className="cinematic-loading-notice__spinner" aria-hidden="true" />
      <span><b>高清动态帧正在准备 {String(progress).padStart(3, "0")}%</b><small>加载期间如有短暂卡顿，属预载过程，不代表最终体验</small></span>
    </aside>
  );
}

const PRELUDE_CHAPTERS = [
  {
    id: "about",
    en: "ABOUT",
    label: "个人概览",
    phase: "正在准备序章",
    card: {
      title: "个人概览",
      en: "ABOUT",
      lead: "角色、立场与设计方法。",
      stats: [
        ["10+", "年产品与体验设计"],
        ["B 端", "企业级复杂系统为主"],
        ["AI", "设计到可运行原型"],
      ],
      body: "从界面执行到产品判断、设计系统，再到可运行产品。",
    },
  },
  {
    id: "experience",
    en: "EXPERIENCE",
    label: "职业经历",
    phase: "正在展开职业轨迹",
    card: {
      title: "职业经历",
      en: "EXPERIENCE",
      lead: "十年，角色一步步变重。",
      stats: [
        ["2015", "进入设计领域"],
        ["4 段", "关键阶段演进"],
        ["系统", "从页面到业务闭环"],
      ],
      body: "UI → 产品界面 → 复杂 B 端 → AI 构建。看判断如何形成，而不是履历清单。",
    },
  },
  {
    id: "projects",
    en: "PROJECTS",
    label: "代表项目",
    phase: "正在整理项目现场",
    card: {
      title: "代表项目",
      en: "PROJECTS",
      lead: "只留下值得展开的案例。",
      stats: [
        ["移动端", "剧本杀社交体验"],
        ["B 端", "园区运营与数据协同"],
        ["官网", "低代码产品叙事"],
      ],
      body: "问题定义、系统组织、关键体验、落地结果。不堆界面图。",
    },
  },
  {
    id: "visual",
    en: "VISUAL",
    label: "视觉设计",
    phase: "正在展开视觉档案",
    card: {
      title: "视觉设计",
      en: "VISUAL",
      lead: "界面之外的视觉语言。",
      stats: [
        ["品牌", "识别与叙事"],
        ["平面", "海报与版式实验"],
        ["动态", "图形与节奏"],
      ],
      body: "品牌、海报、版式与动态实验。",
    },
  },
  {
    id: "ai",
    en: "AI × DESIGN",
    label: "AI 创作",
    phase: "正在启动创作实验室",
    card: {
      title: "AI 创作",
      en: "AI × DESIGN",
      lead: "把设计判断做成能跑的产品。",
      stats: [
        ["小程序", "亲子成长记录"],
        ["工具", "声纹与创作工作台"],
        ["方法", "设计 × 提示词 × 前端"],
      ],
      body: "做过、跑过、可打开。从构想到实现的完整链路。",
    },
  },
];

const PRELUDE_TITLES = [
  "ZEN · DESIGN",
  "PRODUCT · UX",
  "DESIGN · SYSTEM",
  "AI · BUILDER",
  "VISUAL · LAB",
];

const PRELUDE_PRINCIPLES = [
  { code: "01", title: "先减少，再增加", zh: "先减少理解成本，再增加视觉表达。" },
  { code: "02", title: "先系统，再像素", zh: "先解决系统问题，再解决像素问题。" },
  { code: "03", title: "设计要落地", zh: "一个没落地的方案，还没有完成。" },
  { code: "04", title: "清楚比聪明重要", zh: "清楚，比聪明更难，也更重要。" },
  { code: "05", title: "扩展判断力", zh: "AI 扩展的是判断，不是替代判断。" },
];

function preludeChapterIndex(progress) {
  return clamp(Math.floor((progress / 100) * PRELUDE_CHAPTERS.length), 0, PRELUDE_CHAPTERS.length - 1);
}

const TECH_LOGOS = [
  { node: <><Sparkles />React</>, title: "React" },
  { node: <><Layers3 />Next.js</>, title: "Next.js" },
  { node: <><CodeXml />TypeScript</>, title: "TypeScript" },
  { node: <><Wind />Tailwind CSS</>, title: "Tailwind CSS" },
  { node: <><Zap />Vite</>, title: "Vite" },
  { node: <><Command />GSAP</>, title: "GSAP" },
  { node: <><Box />Three.js</>, title: "Three.js" },
  { node: <><Cpu />AI</>, title: "AI" },
  { node: <><Wand2 />Vibe Coding</>, title: "Vibe Coding" },
  { node: <><Palette />Figma</>, title: "Figma" },
  { node: <><PenTool />Sketch</>, title: "Sketch" },
  { node: <><Orbit />Blender</>, title: "Blender" },
  { node: <><FileText />PRD</>, title: "PRD" },
];

const HUMOR_SLOTS = [
  { start: 0, en: "STILL PUTTING THINGS TOGETHER.", zh: "正在把一些画面拼起来。", extra: "顺便说一句，这个网站比普通作品集稍微重那么一点。" },
  { start: 15, en: "YES, THERE ARE A LOT OF FRAMES.", zh: "是的，我确实塞了不少视频帧。", extra: "做设计十多年之后，我还是没学会「随便一点」。" },
  { start: 30, en: "SINCE YOU'RE HERE...", zh: "既然还要等一会儿，不如先认识我一点。", extra: "10+ 年产品与体验设计，做过 30–40+ 个项目。" },
  { start: 45, en: "I DESIGN MORE THAN SCREENS.", zh: "界面只是最后被看见的部分。", extra: "复杂业务、流程、设计系统，以及怎么把它们讲清楚，才是我更常处理的东西。" },
  { start: 60, en: "YES, IT'S STILL LOADING.", zh: "没错，它居然还在加载。", extra: "有些视觉体验，确实行李比较多。" },
  { start: 75, en: "I BUILD THINGS, TOO.", zh: "这几年，我开始不满足于只把产品画出来。", extra: "AI、Vibe Coding，以及把一个想法真正做成能运行的东西。" },
  { start: 90, en: "YOU'VE BEEN VERY PATIENT.", zh: "能看到这里，我已经欠你一杯咖啡了。", extra: "如果你赶时间，可以直接进入，剩下的画面会继续准备。" },
  { start: 105, en: "ALMOST READY.", zh: "最后几帧正在赶来的路上。", extra: "接下来看到的，是我过去十多年做过的一些事，以及最近正在尝试的新东西。" },
  { start: 120, en: "WELCOME TO ZEN · DESIGN.", zh: "欢迎来到 ZEN · DESIGN。", extra: "" },
];

const LOADING_PHASES = [
  { min: 0, en: "PREPARING INTRO", zh: "正在准备序章" },
  { min: 20, en: "LOADING PROJECT STORIES", zh: "正在整理项目现场" },
  { min: 40, en: "BUILDING VISUAL ARCHIVE", zh: "正在展开视觉档案" },
  { min: 60, en: "WARMING UP THE LAB", zh: "正在启动 AI 实验室" },
  { min: 85, en: "FINAL TOUCHES", zh: "最后一笔" },
];

function loadingPhaseFor(progress) {
  let phase = LOADING_PHASES[0];
  for (const item of LOADING_PHASES) {
    if (progress >= item.min) phase = item;
  }
  return phase;
}

function LoadingScreen({ progress, canEnter, ready, error, backgroundReady, preludeReady, onRetry, onEnter, onChromeReveal, onFinish }) {
  const [leaving, setLeaving] = useState(false);
  const [waitedMs, setWaitedMs] = useState(0);
  const [principle, setPrinciple] = useState(null);
  const [titleIndex, setTitleIndex] = useState(0);
  const [railHover, setRailHover] = useState(null);
  const railLeaveTimerRef = useRef(0);
  const enteredOnceRef = useRef(false);
  const loaderRef = useRef(null);
  const entryVideoRef = useRef(null);
  const entryFrameRef = useRef(0);
  const entryTimeoutRef = useRef(0);
  const entryFinishedRef = useRef(false);
  const chromeRevealedRef = useRef(false);
  const [entryPlaying, setEntryPlaying] = useState(false);
  const [entryFrameReady, setEntryFrameReady] = useState(false);
  const [entryBuffered, setEntryBuffered] = useState(false);
  const [entryUnavailable, setEntryUnavailable] = useState(false);
  // Mobile browsers often defer buffering until the visitor taps. Waiting for
  // `canplaythrough` here falsely marks a valid video unavailable, so the
  // intentional click itself starts playback.
  const entryAvailable = canEnter;

  useEffect(() => () => {
    cancelAnimationFrame(entryFrameRef.current);
    window.clearTimeout(entryTimeoutRef.current);
  }, []);

  const finishEntry = useCallback(() => {
    if (entryFinishedRef.current) return;
    entryFinishedRef.current = true;
    // A skipped or failed film should still arrive at a complete homepage.
    onChromeReveal?.();
    cancelAnimationFrame(entryFrameRef.current);
    window.clearTimeout(entryTimeoutRef.current);
    onEnter?.();
    // Also supplies a short, quiet exit if playback is unavailable.
    loaderRef.current?.animate([{ opacity: getComputedStyle(loaderRef.current).opacity }, { opacity: 0 }], { duration: 180, fill: "forwards" });
    entryTimeoutRef.current = window.setTimeout(onFinish, 180);
  }, [onEnter, onChromeReveal, onFinish]);

  const revealHome = useCallback(() => {
    setEntryPlaying(true);
    onEnter?.();
    const tick = () => {
      const video = entryVideoRef.current;
      if (!video || entryFinishedRef.current) return;
      // The encoded speed ramp settles at source speed before the late cloud dissolve.
      const progress = Math.min(1, Math.max(0, (video.currentTime - 3.1) / Math.max(0.3, (video.duration || 4.1) - 3.1)));
      const dissolve = progress * progress * (3 - 2 * progress);
      // The ticket and chapter navigation belong to the homepage. Introduce
      // them only as the final cloud dissolve begins, never on playback.
      if (!chromeRevealedRef.current && progress > 0) {
        chromeRevealedRef.current = true;
        onChromeReveal?.();
      }
      if (loaderRef.current) loaderRef.current.style.opacity = String(1 - dissolve);
      entryFrameRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(entryFrameRef.current);
    tick();
  }, [onEnter, onChromeReveal]);
  const chapterIdx = preludeChapterIndex(progress);
  const loadPhase = !preludeReady
    ? { en: "SETTING THE STAGE", zh: "正在呈现开场画面" }
    : error
    ? { en: "CONNECTION HESITATED", zh: "连接犹豫了一下" }
    : loadingPhaseFor(progress);
  const titleText = PRELUDE_TITLES[titleIndex % PRELUDE_TITLES.length];
  const hoveredChapter = railHover
    ? PRELUDE_CHAPTERS.find((c) => c.id === railHover)
    : null;

  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(() => setWaitedMs(performance.now() - started), 500);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(railLeaveTimerRef.current);
    };
  }, []);

  // Rotate identity titles; remount StrokeText so draw animation replays each cycle.
  useEffect(() => {
    if (error) return undefined;
    const timer = window.setInterval(() => {
      setTitleIndex((i) => (i + 1) % PRELUDE_TITLES.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [error]);

  const enter = useCallback(() => {
    if (leaving || enteredOnceRef.current) return;
    enteredOnceRef.current = true;
    setLeaving(true);
    if (entryUnavailable || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishEntry();
      return;
    }
    // Start from the decoded poster; only reveal the homepage once video plays.
    entryTimeoutRef.current = window.setTimeout(finishEntry, 8000);
    const video = entryVideoRef.current;
    if (!video) { finishEntry(); return; }
    // Already paused on the decoded first frame: do not seek again on click.
    video.play().catch(finishEntry);
  }, [leaving, finishEntry, entryUnavailable]);

  const openRailCard = (id) => {
    window.clearTimeout(railLeaveTimerRef.current);
    setRailHover(id);
  };
  const scheduleCloseRailCard = () => {
    window.clearTimeout(railLeaveTimerRef.current);
    railLeaveTimerRef.current = window.setTimeout(() => setRailHover(null), 160);
  };

  let humor = HUMOR_SLOTS[0];
  for (const slot of HUMOR_SLOTS) {
    if (waitedMs / 1000 >= slot.start) humor = slot;
  }

  return (
    <section
      ref={loaderRef}
      className={`lab-loader prelude${leaving ? " is-leaving" : ""}${entryPlaying ? " is-playing" : ""}`}
      aria-live="polite"
      aria-label="序章"
    >
      <div className="lab-loader__backdrop">
        <video
          ref={entryVideoRef}
          className={`lab-loader__entry-video${entryFrameReady ? " is-decoded" : ""}`}
          src={preludeReady ? "/assets/video/cloud-entry-smooth.mp4" : undefined}
          poster="/assets/video/cloud-entry-poster.webp"
          preload="auto"
          muted
          playsInline
          aria-hidden="true"
          onLoadedData={() => setEntryFrameReady(true)}
          onCanPlayThrough={() => setEntryBuffered(true)}
          onPlaying={revealHome}
          onEnded={finishEntry}
          onError={() => { setEntryUnavailable(true); if (enteredOnceRef.current) finishEntry(); }}
        />
      </div>
      {leaving && !entryPlaying && <p className="prelude-entry-status" role="status">正在推开云雾…</p>}
      <div className="lab-loader__grain" />
      <LoadingCompanions canEnter={canEnter} />

      <button
        type="button"
        className="prelude-mark"
        onClick={() => setPrinciple(PRELUDE_PRINCIPLES[Math.floor(Math.random() * PRELUDE_PRINCIPLES.length)])}
        aria-label="点击查看一条设计原则"
      >
        <i /><i /><i />
        <span>ZEN</span>
      </button>

      {humor && !error && (
        <div className="prelude-humor-float" role="status" key={humor.en}>
          <strong>{humor.en}</strong>
          <span>{humor.zh}</span>
          {humor.extra && <em>{humor.extra}</em>}
        </div>
      )}

      <div className="prelude-shell">
        <p className="prelude-eyebrow">PRELUDE / DESIGN LAB</p>

        <div className="prelude-title-wrap">
          <StrokeText
            key={titleText}
            className="prelude-title"
            text={titleText}
            strokeColor="#f3e91a"
            fillColor="#f7f5ed"
            strokeWidth={1.35}
            drawDuration={1.35}
            fillDelay={0.15}
            stagger={0.04}
            ease="power2.out"
            trigger="mount"
            fillMode="wipe"
            fontSize={88}
            fontWeight={800}
            letterSpacing={-3}
          />
        </div>

        <div className="prelude-loading-block">
          <p className="prelude-loading-label">LOADING EXPERIENCE</p>
          <div className="prelude-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="prelude-loading-meta" key={loadPhase.en}>
            <strong className="prelude-loading-en">{loadPhase.en}</strong>
            <div className="prelude-loading-meta-right">
              <span className="prelude-loading-zh">{loadPhase.zh}</span>
              <small className="prelude-loading-pct">{String(progress).padStart(3, "0")}%</small>
            </div>
          </div>
        </div>

        {principle && (
          <div className="prelude-principle" role="status">
            <span>{principle.code} · {principle.title}</span>
            <p>{principle.zh}</p>
          </div>
        )}

        <div className="prelude-actions">
          {error ? (
            <button type="button" className="prelude-btn prelude-btn--primary" onClick={onRetry}>重新加载</button>
          ) : (
            <button
              type="button"
              className="prelude-btn prelude-btn--primary"
              disabled={!entryAvailable}
              onClick={enter}
            >
              {entryAvailable ? "THE DOOR IS OPEN / 请进，别客气" : "DEVELOPING THE FILM / 镜头冲洗中"}
            </button>
          )}
          {canEnter && !backgroundReady && (
            <p className="prelude-actions__hint" role="status">
              可以先进来，其余画面会在后台继续准备
            </p>
          )}
        </div>

        <div
          className="prelude-rail-zone"
          onMouseLeave={scheduleCloseRailCard}
        >
          <p className="prelude-rail-hint">加载的时候，先逛逛目录。</p>
          <nav className="prelude-rail" aria-label="站点章节预告">
            {PRELUDE_CHAPTERS.map((chapter, index) => (
              <Fragment key={chapter.id}>
                {index > 0 && <i className="prelude-rail__divider" aria-hidden="true" />}
                <button
                  type="button"
                  className={`prelude-rail__item${index <= chapterIdx ? " is-lit" : ""}${railHover === chapter.id ? " is-hover" : ""}`}
                  onMouseEnter={() => openRailCard(chapter.id)}
                  onFocus={() => openRailCard(chapter.id)}
                  onBlur={scheduleCloseRailCard}
                >
                  <b>{chapter.en}</b>
                  <span>{chapter.label}</span>
                </button>
              </Fragment>
            ))}
          </nav>

          {hoveredChapter && (
            <aside
              className="prelude-hover-card"
              role="tooltip"
              onMouseEnter={() => openRailCard(hoveredChapter.id)}
            >
              {hoveredChapter.id === "about" && (
                <TextType
                  className="prelude-hover-card__name"
                  text={["唐启东", "TANG · QIDONG"]}
                  typingSpeed={90}
                  pauseDuration={1800}
                  deletingSpeed={45}
                  loop
                  showCursor
                  cursorCharacter="|"
                  textColors={["#f7f5ed", "#f7f5ed"]}
                  style={{
                    fontSize: "clamp(28px, 3vw, 40px)",
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                  }}
                />
              )}
              <header>
                <small>{hoveredChapter.card.en}</small>
                <strong>{hoveredChapter.card.title}</strong>
                <p>{hoveredChapter.card.lead}</p>
              </header>
              <ul>
                {hoveredChapter.card.stats.map(([k, v]) => (
                  <li key={k}><b>{k}</b><span>{v}</span></li>
                ))}
              </ul>
              <p className="prelude-hover-card__body">{hoveredChapter.card.body}</p>
            </aside>
          )}
        </div>
      </div>

      <div className="prelude-logos">
        <LogoLoop
          logos={TECH_LOGOS}
          speed={36}
          direction="left"
          logoHeight={24}
          gap={30}
          fadeOut
          fadeOutColor="#080807"
          ariaLabel="技术栈"
        />
      </div>
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
    const height = pageH * chapters.length;
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
    const warmController = new AbortController();
    let targetLoadInFlight = false;
    let requestedTarget = { segment: 0, frameIndex: 0 };
    let requestedDirection = 1;
    let paintedKey = null;

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
        paintedKey = null;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
      }
    };

    const touchBitmap = (key, bitmap) => {
      bitmapCacheRef.current.delete(key);
      bitmapCacheRef.current.set(key, bitmap);
    };

    const trimCache = () => {
      const deviceMemory = navigator.deviceMemory || 4;
      const maxBitmaps = deviceMemory <= 4 ? 16 : 28;
      while (bitmapCacheRef.current.size > maxBitmaps) {
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
      const key = `${segment}-${frameIndex}`;
      // Cached targets can reach this function twice per scroll event. Once
      // page 06 is reached, the final frame also stays fixed through page 07.
      if (paintedKey === key) return;
      const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
      const width = bitmap.width * scale;
      const height = bitmap.height * scale;
      const focalPoint = window.innerWidth <= 760
        ? mobileFocalPoint(segment, frameIndex)
        : { x: 0.5, y: 0.5 };
      const x = clamp((canvas.width / 2) - (width * focalPoint.x), canvas.width - width, 0);
      const y = clamp((canvas.height / 2) - (height * focalPoint.y), canvas.height - height, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, x, y, width, height);
      paintedKey = key;
      canvas.dataset.segment = String(segment + 1);
      canvas.dataset.frame = String(frameIndex + 1).padStart(4, "0");
      canvas.dataset.source = frameSource(segment, frameIndex);
      canvas.dataset.focal = `${focalPoint.x.toFixed(3)},${focalPoint.y.toFixed(3)}`;
    };

    const warmFrame = (segment, frameIndex) => {
      if (segment < 0 || segment > 4) return;
      const bounded = sampledFrameIndex(segment, frameIndex);
      if (pendingFramesRef.current.size >= 8) return;
      loadBitmap(segment, bounded, warmController.signal);
    };

    const warmAround = (segment, frameIndex, direction) => {
      // Do not cancel this queue on every scroll tick: that was starving the
      // decoder exactly when a visitor started moving through the page.
      for (let offset = FRAME_SAMPLE_STEP; offset <= 16 * FRAME_SAMPLE_STEP; offset += FRAME_SAMPLE_STEP) warmFrame(segment, frameIndex + offset * direction);
      for (let offset = FRAME_SAMPLE_STEP; offset <= 5 * FRAME_SAMPLE_STEP; offset += FRAME_SAMPLE_STEP) warmFrame(segment, frameIndex - offset * direction);
      if (frameIndex > FRAME_COUNTS[segment] - 28) {
        for (let offset = 0; offset < 12; offset += 1) warmFrame(segment + 1, offset);
      }
    };

    // A network-cached WebP still needs decoding before Canvas can draw it.
    // While the exact frame is decoding, paint the closest decoded neighbour so
    // a fast wheel/trackpad gesture stays visibly continuous instead of holding
    // one image until the final target arrives.
    const paintClosestCachedFrame = (segment, frameIndex, direction) => {
      const exactKey = `${segment}-${frameIndex}`;
      const exact = bitmapCacheRef.current.get(exactKey);
      if (exact) {
        touchBitmap(exactKey, exact);
        paintBitmap(exact, segment, frameIndex);
        return true;
      }

      for (let offset = FRAME_SAMPLE_STEP; offset <= 18 * FRAME_SAMPLE_STEP; offset += FRAME_SAMPLE_STEP) {
        const preferredIndex = sampledFrameIndex(segment, frameIndex - offset * direction);
        const alternateIndex = sampledFrameIndex(segment, frameIndex + offset * direction);
        for (const candidateIndex of [preferredIndex, alternateIndex]) {
          const key = `${segment}-${candidateIndex}`;
          const bitmap = bitmapCacheRef.current.get(key);
          if (!bitmap) continue;
          touchBitmap(key, bitmap);
          paintBitmap(bitmap, segment, candidateIndex);
          return true;
        }
      }
      return false;
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
          if (!disposed && latestKey !== key) {
            resolveLatestTarget();
            warmAround(requestedTarget.segment, requestedTarget.frameIndex, requestedDirection);
          }
        });
      }
    };

    const requestFrame = (segment, frameIndex) => {
      frameIndex = sampledFrameIndex(segment, frameIndex);
      const direction = segment === lastSegment ? Math.sign(frameIndex - lastFrameIndex) || requestedDirection : 1;
      const key = `${segment}-${frameIndex}`;
      targetKeyRef.current = key;
      requestedTarget = { segment, frameIndex };
      requestedDirection = direction;
      paintClosestCachedFrame(segment, frameIndex, direction);
      resolveLatestTarget();
      warmAround(segment, frameIndex, direction);
      lastSegment = segment;
      lastFrameIndex = frameIndex;
    };

    resizeCanvas();
    requestFrame(0, 0);

    const syncFrame = () => {
      frameRequest = 0;
      const pageHeight = Math.max(1, window.innerHeight);
      const rawPage = Math.min(window.scrollY / pageHeight, 5);
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
    const nextOpen = !open;
    setOpen(nextOpen);
    onMenuChange?.(nextOpen);
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
      <div className="nav-footer"><span>NARRATIVE THREAD</span><small>{String(chapters.length).padStart(2, "0")} SCENES</small></div>
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
    <div className="chapter-index" aria-label={`第 ${index + 1} 页，共 ${chapters.length} 页`}>
      <strong>{String(index + 1).padStart(2, "0")}</strong>
      <span>{String(index + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}</span>
    </div>
  );
}

function GuideLine({ activeChapter }) {
  const dotRef = useRef(null);
  const labelRef = useRef(null);

  useLayoutEffect(() => {
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    timeline
      .to(dotRef.current, { left: `${(activeChapter / (chapters.length - 1)) * 100}%`, duration: 0.8, ease: "expo.inOut" })
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
    point: "M5 12h14M12 5v14",
    layout: "M3 6h18M3 6v11a2 2 0 0 0 2 2h6V6M11 19h6a2 2 0 0 0 2-2V6",
    brand: "M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7z",
    interaction: "M6 4l14 6-5 2-2 5z",
    media: "M3 7h7l5-4v18l-5-4H3z",
    flow: "M3 6h12a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12M8 14h4",
    usable: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    collab: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19a5 5 0 0 1 10 0M16 7a3 3 0 1 1-3 3M16 13a4 4 0 0 1 5 4",
    guard: "M12 2l8 4v6a8 8 0 0 1-8 8 8 8 0 0 1-8-8V6z",
    code: "M8 7l-5 5 5 5M16 7l5 5-5 5M13 4l-2 16",
    pen: "M4 20l1-5L17 4a2 2 0 0 1 3 3L8 19z",
  };
  const d = paths[name] || paths.ux;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const FOCUS_ICON = {
  "视觉表达": "visual",
  "界面排版": "layout",
  "品牌延展": "brand",
  "基础交互": "interaction",
  "业务理解": "media",
  "信息架构": "layout",
  "任务流程": "flow",
  "可用性": "usable",
  "系统抽象": "system",
  "组件体系": "system",
  "研发协同": "collab",
  "治理流程": "guard",
  "AI 产品设计": "ai",
  "Vibe Coding": "code",
  "设计到落地": "pen",
};
const focusIcon = (f) => FOCUS_ICON[f] || "point";

function PoNow({ now, signal, tags }) {
  const lineRef = useRef(null);

  useEffect(() => {
    const el = lineRef.current;
    if (!el) return undefined;
    const fit = () => {
      let size = 15;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth && size > 11.5) {
        size -= 0.25;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [now]);

  return (
    <div className="po-now-card">
      <span className="po-now__signal"><i />{signal}</span>
      <p className="po-now" ref={lineRef}>{now}</p>
      <ul className="po-now__tags">
        {tags.map((tag) => (
          <li key={tag.key}><b>{tag.key}</b><span>{tag.value}</span></li>
        ))}
      </ul>
    </div>
  );
}

const PROFILE_TAG_ZH = {
  "PRODUCT DESIGN": "产品设计",
  "DESIGN SYSTEM": "设计系统",
  "ENTERPRISE UX": "企业体验",
  "AI PRODUCT": "AI 产品",
};
const PROFILE_CAP_ZH = {
  PRODUCT: "产品",
  SYSTEM: "系统",
  EXPERIENCE: "体验",
  BUILD: "构建",
  VISUAL: "视觉",
};
const PROFILE_FLOW_ZH = {
  Research: "研究",
  Define: "定义",
  Design: "设计",
  Prototype: "原型",
  Code: "实现",
  Validate: "验证",
};
const PROFILE_BEYOND_ZH = {
  Travel: "旅行",
  Music: "音乐",
  Photography: "摄影",
  "AI Exploration": "AI 探索",
};

function ProfileOverlay({ onClose, copy, profileData }) {
  const rootRef = useRef(null);
  const innerRef = useRef(null);
  useCloseOnPortfolioNavigate(onClose);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const inner = innerRef.current;
    if (!root || !inner) return undefined;
    document.body.classList.add("modal-open");
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups = [];
    const ctx = gsap.context(() => {
      gsap.set(root, { autoAlpha: 1 });
      if (reduce) return;

      gsap.timeline({ defaults: { ease: "power4.out" } })
        .fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 })
        .fromTo(".po-progress", { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.45 }, 0.05)
        .fromTo(".po-hero__name i", { yPercent: 120, rotateX: -50 }, { yPercent: 0, rotateX: 0, duration: 0.8, stagger: 0.08 }, 0.12)
        .fromTo(".po-hero__role, .po-head__lead, .po-hero__tags li", { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.05 }, 0.28)
        .fromTo(".po-hero__ticket", { x: 40, autoAlpha: 0, rotateZ: 2 }, { x: 0, autoAlpha: 1, rotateZ: 0, duration: 0.7 }, 0.22)
        .fromTo(".po-info > div", { y: 36, autoAlpha: 0, rotateX: 12 }, { y: 0, autoAlpha: 1, rotateX: 0, duration: 0.55, stagger: 0.045 }, 0.32);

      gsap.to(".po-progress__fill", {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          scroller: root,
          trigger: inner,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.35,
        },
      });

      inner.querySelectorAll(".po-reveal").forEach((section) => {
        gsap.from(section.querySelectorAll(".po-reveal-item"), {
          y: 42,
          autoAlpha: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { scroller: root, trigger: section, start: "top 84%", once: true },
        });
      });

      gsap.from(".po-timeline__line", {
        scaleY: 0,
        transformOrigin: "top center",
        duration: 1.1,
        ease: "power2.out",
        scrollTrigger: { scroller: root, trigger: ".po-timeline", start: "top 80%", once: true },
      });

      const steps = gsap.utils.toArray(".po-workflow__steps li");
      const cycle = gsap.timeline({ repeat: -1 });
      steps.forEach((step, index) => {
        cycle
          .to(step, { backgroundColor: "rgba(243,198,0,.16)", borderColor: "rgba(243,198,0,.45)", color: "#f3c600", duration: 0.28 }, index * 0.7)
          .to(step, { backgroundColor: "rgba(255,255,255,.045)", borderColor: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.8)", duration: 0.4 }, index * 0.7 + 0.45);
      });
      const pauseCycle = () => cycle.pause();
      const playCycle = () => cycle.play();
      steps.forEach((step) => {
        step.addEventListener("pointerenter", pauseCycle);
        step.addEventListener("pointerleave", playCycle);
      });
      cleanups.push(() => {
        steps.forEach((step) => {
          step.removeEventListener("pointerenter", pauseCycle);
          step.removeEventListener("pointerleave", playCycle);
        });
      });

      gsap.utils.toArray(".po-magnet").forEach((el) => {
        const xTo = gsap.quickTo(el, "x", { duration: 0.32, ease: "power3.out" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.32, ease: "power3.out" });
        const onMove = (event) => {
          const box = el.getBoundingClientRect();
          xTo((event.clientX - (box.left + box.width / 2)) * 0.025);
          yTo((event.clientY - (box.top + box.height / 2)) * 0.04);
        };
        const reset = () => { xTo(0); yTo(0); };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", reset);
        cleanups.push(() => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", reset);
        });
      });
    }, root);

    return () => {
      cleanups.forEach((fn) => fn());
      ctx.revert();
      window.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  return createPortal(
    <div ref={rootRef} className="profile-overlay" role="dialog" aria-modal="true" aria-label="个人档案" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <FixedClose onClose={onClose} />
      <div className="po-progress" aria-hidden="true"><i className="po-progress__fill" /></div>
      <div className="profile-overlay__inner" ref={innerRef} onClick={(e) => e.stopPropagation()}>
        <header className="po-hero">
          <div className="po-hero__copy">
            <p className="eyebrow">{copy.modal.eyebrow}</p>
            <h2>
              <span className="po-hero__name" aria-label="唐启东">{Array.from("唐启东").map((ch, i) => <i key={i}>{ch}</i>)}</span>
              <span className="po-hero__role">{profileData.heroRole} / 产品设计负责人 · 设计系统 · AI 构建</span>
            </h2>
            <p className="po-head__lead">{profileData.philosophy.lead}</p>
            <ul className="po-hero__tags">
              {profileData.heroTags.map((tag) => <li key={tag}>{tag} / {PROFILE_TAG_ZH[tag] || tag}</li>)}
            </ul>
          </div>
          <aside className="po-hero__ticket po-magnet">
            <small>CURRENT POST / 在职</small>
            <strong>湖南云畅网络科技有限公司</strong>
            <p>在职 · 2015—至今</p>
            <div className="po-hero__ticket-meta">
              <span><b>10+</b>YEARS / 年</span>
              <span><b>CS</b>CHANGSHA / 长沙</span>
            </div>
          </aside>
        </header>

        <section className="po-info">
          {profileData.info.filter(([k]) => !["公司", "状态", "任职时间"].includes(k)).map(([k, v], i) => (
            <div className="po-magnet" key={k}>
              <em>{String(i + 1).padStart(2, "0")}</em>
              <small>{k}</small>
              <b>{v}</b>
            </div>
          ))}
        </section>

        <section className="po-block po-reveal">
          <header className="po-block__head po-reveal-item"><span>01</span><h3>设计理念</h3><small>PHILOSOPHY / 设计理念</small></header>
          <div className="po-pillars">
            {profileData.philosophy.pillars.map((p, i) => (
              <article className="po-magnet po-reveal-item" key={p.title}>
                <b className="po-pillar__no">{String(i + 1).padStart(2, "0")}</b>
                <LineIcon name={p.icon} className="po-pillar__icon" />
                <div>
                  <small>{p.en} / {p.title}</small>
                  <strong>{p.title}</strong>
                </div>
                <p>{p.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="po-block po-reveal">
          <header className="po-block__head po-reveal-item"><span>02</span><h3>能力矩阵</h3><small>CAPABILITY / 能力矩阵</small></header>
          <div className="po-caps">
            {profileData.capabilities.map((cap) => (
              <article className="po-reveal-item" key={cap.group}>
                <header><LineIcon name={cap.icon} className="po-cap__icon" /><h4>{cap.group} / {PROFILE_CAP_ZH[cap.group] || cap.group}</h4></header>
                <ul>{cap.items.map((it) => <li key={it}><i className="po-dot" aria-hidden="true" />{it}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <div className="po-split">
          <section className="po-block po-reveal">
            <header className="po-block__head po-reveal-item"><span>03</span><h3>工作时间线</h3><small>EXPERIENCE / 工作时间线</small></header>
            <ol className="po-timeline">
              <i className="po-timeline__line" aria-hidden="true" />
              {profileData.timeline.map(([year, title, desc]) => (
                <li className="po-reveal-item" key={year}>
                  <b>{year}</b>
                  <div><strong>{title}</strong><small>{desc}</small></div>
                </li>
              ))}
            </ol>
          </section>

          <section className="po-block po-reveal">
            <header className="po-block__head po-reveal-item"><span>04</span><h3>设计方法</h3><small>WORKFLOW / 设计方法</small></header>
            <div className="po-workflow po-reveal-item">
              <ol className="po-workflow__steps">
                {profileData.workflow.map((step, i) => (
                  <li key={step}><em>{String(i + 1).padStart(2, "0")}</em>{step} / {PROFILE_FLOW_ZH[step] || step}</li>
                ))}
              </ol>
              <p>{profileData.workflowDesc}</p>
            </div>
          </section>
        </div>

        <section className="po-block po-reveal">
          <header className="po-block__head po-reveal-item"><span>05</span><h3>工具与技术栈</h3><small>STACK / 工具与技术栈</small></header>
          <div className="po-stack">
            {profileData.stack.map((s) => (
              <div className="po-reveal-item" key={s.group}>
                <small>{s.group} / {s.group === "Design" ? "设计" : s.group === "Development" ? "开发" : "人工智能"}</small>
                <ul>{s.items.map((it) => <li key={it}><i className="po-dot" aria-hidden="true" />{it}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>

        <section className="po-block po-reveal">
          <header className="po-block__head po-reveal-item"><span>06</span><h3>设计之外</h3><small>BEYOND DESIGN / 设计之外</small></header>
          <div className="po-beyond">
            {profileData.beyond.map((b) => (
              <article className="po-magnet po-reveal-item" key={b.title}>
                <LineIcon name={b.icon} className="po-beyond__icon" />
                <strong>{b.title} / {PROFILE_BEYOND_ZH[b.title] || b.title}</strong>
                <small>{b.desc}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="po-block po-reveal">
          <header className="po-block__head po-reveal-item"><span>07</span><h3>正在关注</h3><small>NOW / 正在关注</small></header>
          <div className="po-reveal-item">
            <PoNow now={profileData.now} signal={profileData.nowSignal || "NOW TRACKING / 正在关注"} tags={profileData.nowTags} />
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}

function AboutSection({ copy, profileData }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="chapter chapter-about" id="about" data-chapter="0">
      <div className="chapter-copy chapter-copy--bottom-right" data-narrative-anchor="about" data-thread-x="0.12" data-thread-y="0.12">
        <p className="eyebrow motion-item" data-motion="dropIn">{copy.eyebrow}</p>
        <h1 className="motion-item hero-name" data-motion="heroZoom">{copy.pageTitle}</h1>
        <div className="hero-divider motion-item" data-motion="lineDraw" />
        <p className="chapter-summary chapter-summary--lead motion-item" data-motion="riseSoft">{copy.description}</p>
        <ul className="hero-tags motion-item" data-motion="fromLeft">
          {profileData.heroTags.map((tag) => <li key={tag}><LineIcon name="ai" className="hero-tag__icon" />{tag}</li>)}
        </ul>
        <div className="micro-content-list micro-content-list--stats motion-item" data-motion="fromRight">
          {profileData.stats.map(([value, label]) => <button type="button" key={label} onClick={() => setOpen(true)}><strong>{value}</strong><span>{label}</span><small>+</small></button>)}
        </div>
        <button className="hero-cta motion-item" data-motion="zoomPop" type="button" onClick={() => setOpen(true)}>
          <span>{copy.buttonText}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
      <p className="motion-hint">SCROLL DOWN · FRAME BY FRAME</p>
      {open && <ProfileOverlay copy={copy} profileData={profileData} onClose={() => setOpen(false)} />}
    </section>
  );
}

function CareerStageDetail({ onClose, copy, careerData }) {
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
          <p className="eyebrow">{copy.modal.eyebrow}</p>
          <h2>{copy.modal.title}</h2>
        </header>

        <div className="career-line">
          {careerData.map((stage, index) => (
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
                {stage.focus.map((f) => <li key={f}><LineIcon name={focusIcon(f)} className="career-line__focus-icon" />{f}</li>)}
              </ul>

              <div className="career-line__deliveries">
                <small>KEY DELIVERIES</small>
                <ul>
                  {stage.deliveries.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>

              <blockquote className="career-line__lesson">{stage.lesson}</blockquote>

              {index < careerData.length - 1 && (
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

function ExperienceSection({ copy, careerData }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="chapter chapter-experience" id="experience" data-chapter="1">
      <div className="experience-panel scene-panel" data-narrative-anchor="experience" data-thread-x="0.92" data-thread-y="0.12">
        <header className="scene-heading motion-item" data-motion="fromLeft">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.pageTitle}</h2>
          <p>{copy.description}</p>
          <p>{copy.story}</p>
        </header>
        <div className="experience-card-grid motion-item" data-motion="fanSplit">
          {careerData.map((item) => (
            <button type="button" className="experience-card interactive-card" key={item.version} onClick={() => setOpen(true)}>
              <span>{item.version}</span><small className="experience-card__year" aria-hidden="true">{item.period}</small><h3>{item.role}</h3><p>{item.note}</p>
              <ul className="experience-card__tags">
                {item.focus.map((f) => <li key={f}><LineIcon name={focusIcon(f)} className="experience-card__tag-icon" />{f}</li>)}
              </ul>
            </button>
          ))}
        </div>
      </div>
      {open && <CareerStageDetail copy={copy} careerData={careerData} onClose={() => setOpen(false)} />}
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
  // `load` can fire in the tiny interval between checking `complete` and
  // attaching a listener, leaving the loop permanently unstarted. `decode()`
  // follows the image's current responsive candidate and remains awaitable
  // whether that candidate is already complete or still downloading.
  const ready = images.map((img) => {
    if (typeof img.decode === "function") return img.decode().catch(() => {});
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  });

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
                  <ResponsiveImage src={src} sizes="(max-width: 760px) 33vw, 280px" loading="eager" alt={`${module.title} 界面示例 ${index % loopUnit.length + 1}`} />
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

function SystemSection({ modules, copy }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const module = modules[active];
  useEffect(() => {
    const close = () => { setOpen(false); setPreview(null); };
    window.addEventListener("portfolio:navigate", close);
    return () => window.removeEventListener("portfolio:navigate", close);
  }, []);
  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(0, modules.length - 1)));
  }, [modules.length]);

  return (
    <section className="chapter chapter-system" id="wanying" data-chapter="2">
      <div className="system-screen-ui motion-item" data-motion="panelDock" data-narrative-anchor="system" data-thread-x="0.08" data-thread-y="0.12">
        <header className="system-screen-ui__header">
          <div><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.pageTitle}</h2><p className="system-screen-ui__sub">{copy.description}</p></div>
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
              {modules.map((item, index) => <button type="button" role="tab" aria-selected={active === index} className={active === index ? "is-active" : ""} key={item.id} onClick={() => setActive(index)}><span>{item.index}</span><strong>{item.tabEn}</strong><div className="system-screen-tabs__sub"><small>{item.tabLabel}</small><i>{item.caption}</i></div></button>)}
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
        <InfoOverlay eyebrow={copy.modal.eyebrow} title={copy.modal.title} onClose={() => setOpen(false)} className="system-overlay">
          <div className="system-detail-stage">
            <div className="system-detail-media">
              <ResponsiveImage src={module.image} sizes="(max-width: 760px) 92vw, 55vw" alt={`${module.title} 展示`} />
              <p>{module.description}</p>
            </div>
            <div className="system-detail-tabs" role="tablist" aria-label="万应设计系统模块">
              {modules.map((item, index) => (
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
    <div className={`detail-gallery detail-gallery--${project.caseStyle || "default"}`} ref={rootRef} style={{ "--gallery-backdrop": `url("${responsiveImageUrl(project.image)}")` }}>
      <div className="detail-gallery__columns">
        {[0, 1, 2].map((columnIndex) => {
          const shifted = [...images.slice(columnIndex), ...images.slice(0, columnIndex)];
          const columnImages = ["mobile", "admin", "website"].includes(project.caseStyle)
            ? images.filter((_, index) => index % 3 === columnIndex)
            : shifted;
          const stream = columnImages.length ? columnImages : images;
          const loopUnit = fillLoopUnit(stream);
          return <div className="detail-gallery__column" key={columnIndex}><div className="detail-gallery__track">{[...loopUnit, ...loopUnit].map((src, index) => <button type="button" key={`${src}-${columnIndex}-${index}`} onClick={() => onOpen(src)}><ResponsiveImage src={src} sizes="(max-width: 760px) 33vw, 18vw" loading="eager" alt={`${project.title} UI ${index % loopUnit.length + 1}`} /></button>)}</div></div>;
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

function InquiryKey() {
  return (
    <div className="inq-key" aria-hidden="true">
      <span><b>01</b>他们关心什么</span>
      <i />
      <span><b>02</b>我如何判断</span>
      <i />
      <span><b>03</b>做成什么效果</span>
    </div>
  );
}

function InquiryMethods({ methods }) {
  if (!methods?.length) return null;
  return (
    <ul className="inq-methods">
      {methods.map((item) => (
        <li key={item.method}><small>{item.method}</small><b>{item.sample}</b></li>
      ))}
    </ul>
  );
}

function InquiryEffects({ effects }) {
  if (!effects?.length) return null;
  return (
    <div className="inq-effect">
      {effects.map((item) => (
        <span key={item.label}><b>{item.value}</b><small>{item.label}</small></span>
      ))}
    </div>
  );
}

function InquiryJourney({ inquiry }) {
  return (
    <div className="inq inq-journey">
      <div className="inq-cast">
        {inquiry.cares.map((item) => (
          <article key={item.who}>
            <small>{item.who}</small>
            <strong>{item.ask}</strong>
            <em>{item.move}</em>
          </article>
        ))}
      </div>
      <div className="inq-compress">
        <div>
          <small>BEFORE · 跨渠道</small>
          <ol>{inquiry.before.map((node) => <li key={node}>{node}</li>)}</ol>
        </div>
        <ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <small>AFTER · 产品内闭环</small>
          <ol className="is-after">{inquiry.after.map((node) => <li key={node}>{node}</li>)}</ol>
        </div>
      </div>
      <div className="inq-think">
        {inquiry.thinking.map((item) => (
          <article key={item.title}><strong>{item.title}</strong><p>{item.desc}</p></article>
        ))}
      </div>
      <InquiryEffects effects={inquiry.effects} />
    </div>
  );
}

function InquirySystem({ inquiry }) {
  return (
    <div className="inq inq-system">
      <div className="inq-matrix" role="table" aria-label="角色关心与解法">
        <div className="inq-matrix__head" role="row">
          <span>角色</span><span>关心什么</span><span>我怎么解</span>
        </div>
        {inquiry.cares.map((item) => (
          <div className="inq-matrix__row" role="row" key={item.who}>
            <b>{item.who}</b>
            <span>{item.ask}</span>
            <em>{item.move}</em>
          </div>
        ))}
      </div>
      <div className="inq-rails">
        {(inquiry.rails || []).map((rail) => (
          <div key={rail.name}>
            <small>{rail.name}</small>
            <ol>{rail.nodes.map((node) => <li key={node}>{node}</li>)}</ol>
          </div>
        ))}
      </div>
      <div className="inq-think inq-think--row">
        {inquiry.thinking.map((item) => (
          <article key={item.title}><strong>{item.title}</strong><p>{item.desc}</p></article>
        ))}
      </div>
      <InquiryEffects effects={inquiry.effects} />
    </div>
  );
}

function InquiryNarrative({ inquiry }) {
  const layers = inquiry.layers || [];
  return (
    <div className="inq inq-narrative">
      <div className="inq-heatmap" role="table" aria-label="角色 × 内容层级">
        <div className="inq-heatmap__head" role="row">
          <span>角色 / 层级</span>
          {layers.map((layer) => <span key={layer}>{layer}</span>)}
        </div>
        {inquiry.cares.map((item) => (
          <div className="inq-heatmap__row" role="row" key={item.who}>
            <div>
              <b>{item.who}</b>
              <small>{item.ask}</small>
            </div>
            {layers.map((layer, index) => (
              <em key={layer} className={item.focus?.[index] ? "is-on" : "is-off"} aria-label={`${layer}${item.focus?.[index] ? " 需要" : " 次要"}`}>
                {item.focus?.[index] ? "●" : "○"}
              </em>
            ))}
          </div>
        ))}
      </div>
      <div className="inq-funnel">
        {(inquiry.funnel || []).map((step, index) => (
          <span key={step} style={{ "--funnel-w": `${100 - index * 14}%` }}><small>0{index + 1}</small>{step}</span>
        ))}
      </div>
      <div className="inq-think inq-think--pills">
        {inquiry.thinking.map((item) => (
          <article key={item.title}><strong>{item.title}</strong><p>{item.desc}</p></article>
        ))}
      </div>
      <InquiryEffects effects={inquiry.effects} />
    </div>
  );
}

function InquiryBoard({ project, copy }) {
  const inquiry = project.inquiry;
  if (!inquiry) return null;
  const style = project.caseStyle || "website";
  return (
    <section className={`case-block case-motion inquiry inquiry--${style}`} aria-labelledby="sec-inquiry">
      <header className="case-block__head">
        <span>02</span>
        <div><strong>{copy.inquiry}</strong><small>CARE / THINK / EFFECT</small></div>
      </header>
      {inquiry.judgment && <p className="case-block__lead inquiry__judgment">{inquiry.judgment}</p>}
      <InquiryKey />
      <InquiryMethods methods={inquiry.methods} />
      {style === "mobile" && <InquiryJourney inquiry={inquiry} />}
      {style === "admin" && <InquirySystem inquiry={inquiry} />}
      {style === "website" && <InquiryNarrative inquiry={inquiry} />}
    </section>
  );
}

function CoreMoves({ items, caseStyle }) {
  if (!items?.length) return null;
  return (
    <ul className={`case-moves case-moves--${caseStyle || "default"}`}>
      {items.map((item, index) => (
        <li key={item.title || index}>
          <small>{String(index + 1).padStart(2, "0")}</small>
          <strong>{item.title}</strong>
          {item.rationale && <em>{item.rationale}</em>}
          <p>{item.solution}</p>
          <b>{item.impact}</b>
        </li>
      ))}
    </ul>
  );
}

function CaseLeadership({ leadership, caseStyle, copy }) {
  if (!leadership?.pillars?.length) return null;
  return (
    <section className={`case-block case-motion case-leadership case-leadership--${caseStyle || "default"}`} aria-labelledby="sec-leadership">
      <header className="case-block__head">
        <span>03</span>
        <div><strong>{copy.leadership}</strong><small>LEADERSHIP / DECISION PATH</small></div>
      </header>
      {leadership.intro && <p className="case-block__lead">{leadership.intro}</p>}
      <ol className="case-leadership__grid">
        {leadership.pillars.map((item, index) => (
          <li key={item.title}>
            <small>{String(index + 1).padStart(2, "0")} / {item.lens}</small>
            <strong>{item.title}</strong>
            <p>{item.action}</p>
            <b>{item.proof}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ProjectDetail({ project, onClose, copy }) {
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
  const coreDesign = project.coreDesign || [];
  const contributionSplit = project.contributionSplit || [];
  const timelinePhases = project.timeline || [];
  const capabilities = project.capabilities || [];
  const outcomeBars = project.outcomeBars || [];
  const stack = project.stack || [];
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
          <header className="case-block__head"><span>01</span><div><strong>{copy.overview}</strong><small>PROJECT OVERVIEW</small></div></header>
          <p className="case-block__lead">{project.overview}</p>
        </section>

        <InquiryBoard project={project} copy={copy} />

        <CaseLeadership leadership={project.leadership} caseStyle={project.caseStyle} copy={copy} />

        <section className="case-block case-motion" aria-labelledby="sec-ownership">
          <header className="case-block__head"><span>04</span><div><strong>{copy.ownership}</strong><small>OWNERSHIP</small></div></header>
          {project.ownership && <p className="case-block__lead">{project.ownership}</p>}
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

        <section className="case-block case-motion" aria-labelledby="sec-core-moves">
          <header className="case-block__head"><span>05</span><div><strong>{copy.coreDesign}</strong><small>CORE MOVES</small></div></header>
          <CoreMoves items={coreDesign} caseStyle={project.caseStyle} />
        </section>

        {timelinePhases.length > 0 && (
          <section className="case-block case-motion" aria-labelledby="sec-process">
            <header className="case-block__head"><span>06</span><div><strong>{copy.process}</strong><small>PROCESS</small></div></header>
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

        <section className="case-block case-motion" aria-labelledby="sec-capability">
          <header className="case-block__head"><span>07</span><div><strong>{copy.capability}</strong><small>CAPABILITY</small></div></header>
          {capabilities.length > 0 && (
            <div className="case-cap">
              <CapabilityRadar data={capabilities} />
              <ul className="case-stack">
                {stack.map((tool) => <li key={tool}>{tool}</li>)}
              </ul>
            </div>
          )}
        </section>

        <section className="case-block case-motion" aria-labelledby="sec-outcome">
          <header className="case-block__head"><span>08</span><div><strong>{copy.outcome}</strong><small>OUTCOME</small></div></header>
          {project.outcome && <p className="case-block__lead">{project.outcome}</p>}
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

function ProjectsSection({ items, copy }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    const close = () => setDetail(null);
    window.addEventListener("portfolio:navigate", close);
    return () => window.removeEventListener("portfolio:navigate", close);
  }, []);
  return (
    <section className="chapter chapter-projects" id="projects" data-chapter="3">
      <div className="projects-panel scene-panel" data-narrative-anchor="projects" data-thread-x="0.92" data-thread-y="0.12">
        <header className="scene-heading motion-item" data-motion="fromRight">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.pageTitle}</h2>
          <p>{copy.description}</p>
        </header>
        <div className="project-cover-grid motion-item" data-motion="cardCascade">
          {items.map((item, index) => (
            <button type="button" className={`project-cover-card project-cover-card--${index + 1} interactive-card`} key={item.id} onClick={() => setDetail(item)}>
              <div className="project-cover-card__media" style={{ "--project-cover": `url("${responsiveImageUrl(item.image, 960)}")` }}>
                <ResponsiveImage className="project-cover-card__art" src={item.image} sizes="(max-width: 760px) 92vw, 33vw" alt={`${item.title} 项目封面`} />
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
      {detail && <ProjectDetail project={detail} copy={copy.modal} onClose={() => setDetail(null)} />}
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
                return [...loopUnit, ...loopUnit].map((work, index) => <button type="button" className="graphic-slide interactive-card" key={`${work.src}-${columnIndex}-${index}`} onClick={() => onOpen(work)}><ResponsiveImage src={work.src} sizes="220px" alt={work.title} /><span><small>{work.type}</small><strong>{work.title}</strong></span></button>);
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphicSection({ works: initialWorks, copy }) {
  const [selected, setSelected] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [items, setItems] = useState(initialWorks);
  const [activeWork, setActiveWork] = useState(null);
  useEffect(() => {
    const close = () => { setSelected(null); setArchiveOpen(false); };
    window.addEventListener("portfolio:navigate", close);
    return () => window.removeEventListener("portfolio:navigate", close);
  }, []);

  useEffect(() => {
    setItems(initialWorks);
    setSelected((current) => current ? initialWorks.find((work) => work.src === current.src) || null : null);
    setActiveWork((current) => current ? initialWorks.find((work) => work.src === current.src) || null : null);
  }, [initialWorks]);

  useEffect(() => {
    let alive = true;
    fetch("/api/library-images?dir=05-graphic")
      .then((r) => (r.ok ? r.json() : null))
      .then((files) => {
        if (!alive || !Array.isArray(files) || !files.length) return;
        const list = files.map((file, index) => {
          const base = file.replace(/\.(png|jpe?g|webp)$/i, "");
          const fallback = initialWorks.find((w) => w.src === `/assets/library/05-graphic/${file}` || w.src.endsWith(`/${file}`)) || {};
          return {
            ...fallback,
            src: `/assets/library/05-graphic/${file}`,
            title: fallback.title || base,
            type: fallback.type || "GRAPHIC / ARCHIVE",
          };
        });
        setItems(list);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [initialWorks]);

  // Keep the wall input stable while hover copy changes. Recreating this array on
  // every hover used to tear down the Web Animation and restart each column at 0.
  const driftItems = useMemo(
    () => items.map((w) => ({ image: w.src, title: w.title, type: w.type, href: undefined, __raw: w })),
    [items],
  );
  const handleTileActivate = useCallback((item) => {
    setActiveWork(item?.__raw ?? null);
  }, []);
  const handleTileOpen = useCallback((item) => {
    if (item?.__raw) setSelected(item.__raw);
  }, []);

  return (
    <section className="chapter chapter-graphic" id="graphic" data-chapter="4">
      <div className="graphic-panel scene-panel" data-narrative-anchor="graphic" data-thread-x="0.08" data-thread-y="0.12">
        <header className="scene-heading motion-item" data-motion="fromLeft"><p className="eyebrow">{copy.eyebrow} / {String(items.length).padStart(2, "0")}</p><h2>{copy.pageTitle}</h2><p>{copy.description}</p><button type="button" className="chapter-action" onClick={() => setArchiveOpen(true)}>EXPLORE ARCHIVE / {copy.buttonText}</button></header>
        <div className="graphic-drift motion-item" data-motion="stageReveal">
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
        <InfoOverlay eyebrow={copy.modal.eyebrow} title={`${copy.modal.title} / ${String(items.length).padStart(2, "0")}`} onClose={() => setArchiveOpen(false)} className="graphic-overlay">
          <div className="archive-grid">
            {items.map((work, index) => (
              <button type="button" className="archive-item" key={work.src} onClick={() => setSelected(work)}>
                <ResponsiveImage src={work.src} sizes="(max-width: 760px) 50vw, 25vw" alt={work.title} />
                <span><small>0{index + 1} · {work.type}</small><strong>{work.title}</strong></span>
              </button>
            ))}
          </div>
        </InfoOverlay>
      )}
      {selected && (
        <div className="work-lightbox" role="dialog" aria-modal="true" aria-label={selected.title} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <FixedClose onClose={() => setSelected(null)} level={520} />
          <div className="work-detail" style={{ "--work-backdrop": `url("${encodeURI(selected.src)}")` }} onClick={(e) => e.stopPropagation()}>
            <div className="work-detail__backdrop" aria-hidden="true" />
            <div className="work-detail__media"><ZoomableImage src={selected.src} alt={selected.title} /></div>
            <article className="work-detail__copy">
              <span className="work-detail__index">VISUAL NOTES / {String(items.indexOf(selected) + 1).padStart(2, "0")}</span>
              <small>{selected.type}</small>
              <h3>{selected.title}</h3>
              <p className="work-detail__brief">{selected.brief || copy.modal.detailFallback}</p>
              <div className="work-detail__notes">
                <section><span>01 / 用途</span><p>{selected.purpose || "作为视觉档案沉淀，用于展示不同媒介中的图形表达与版式判断。"}</p></section>
                <section><span>02 / 呈现</span><p>{selected.concept || "从画面主体出发，通过色彩、构图与信息层级组织观看路径。"}</p></section>
                {selected.craft && <section><span>03 / 手法</span><p>{selected.craft}</p></section>}
              </div>
              <div className="work-detail__tags">{(selected.keywords || ["视觉研究", "图文关系", "构图" ]).map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
              <p className="work-detail__hint">{copy.modal.detailHint}</p>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}

function VibeSection({ items, copy }) {
  const [active, setActive] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [localNotice, setLocalNotice] = useState(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const detailRef = useRef(null);
  const introVideoRef = useRef(null);
  useEffect(() => {
    const close = () => { setDetailOpen(false); setQrOpen(false); setLocalNotice(null); };
    window.addEventListener("portfolio:navigate", close);
    return () => window.removeEventListener("portfolio:navigate", close);
  }, []);
  // Reset the intro video state whenever the case closes or the active project changes.
  useEffect(() => { if (!detailOpen) setVideoPlaying(false); }, [detailOpen]);
  useEffect(() => { setVideoPlaying(false); }, [active]);
  // Kick off playback once the <video> mounts; browsers otherwise often block the
  // silent autoPlay of a clip that carries an audio track.
  useEffect(() => {
    if (videoPlaying && introVideoRef.current) {
      const el = introVideoRef.current;
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [videoPlaying]);

  useLayoutEffect(() => {
    if (!detailOpen || !detailRef.current) return undefined;
    const timeline = gsap.timeline();
    timeline.fromTo(detailRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: .3 })
      .fromTo(detailRef.current.querySelectorAll(".vibe-detail-motion"), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, stagger: .07, ease: "power3.out" }, "<0.05");
    return () => timeline.kill();
  }, [active, detailOpen]);

  const project = items[active];

  return (
    <section className="chapter chapter-vibe" id="vibe" data-chapter="5">
      <div className="vibe-showcase scene-panel" data-narrative-anchor="vibe" data-thread-x="0.5" data-thread-y="0.08">
        <header className="scene-heading scene-heading--center motion-item" data-motion="heroZoom"><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.pageTitle}</h2><p>{copy.description}</p></header>
        <div className="vibe-card-row motion-item" data-motion="cardCascade">
          {items.map((item, index) => (
            <TiltedCard
              key={item.code}
              className="vibe-tilted-wrap"
              captionText={item.title}
              containerHeight="auto"
              containerWidth="100%"
              rotateAmplitude={7}
              scaleOnHover={1.03}
              showMobileWarning={false}
              showTooltip={false}
            >
              <article className="vibe-preview-card interactive-card">
                <button type="button" className="vibe-preview-card__media" onClick={() => { setActive(index); setDetailOpen(true); }}>
                  <ResponsiveImage src={item.image} sizes="(max-width: 760px) 92vw, 33vw" alt={`${item.title} 预览`} />
                  <span>{item.code}</span>
                </button>
                <div>
                  <small>{item.index} / EXPERIMENT</small>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="vibe-card-actions">
                    <button type="button" className="vibe-btn-detail" onClick={() => { setActive(index); setDetailOpen(true); }}>创作过程</button>
                    {item.wechat ? (
                      <button type="button" className="vibe-btn-visit" onClick={() => { setActive(index); setQrOpen(true); }}>打开产品</button>
                    ) : item.link && item.link !== "#" ? (
                      <a className="vibe-btn-visit" href={item.link} target="_blank" rel="noreferrer">打开产品</a>
                    ) : (
                      <button type="button" className="vibe-btn-visit" onClick={() => setLocalNotice(item)}>打开产品</button>
                    )}
                  </div>
                </div>
              </article>
            </TiltedCard>
          ))}
        </div>
      </div>
      {detailOpen && (
        <InfoOverlay eyebrow={`${project.code} / CASE STUDY`} title={project.title} onClose={() => setDetailOpen(false)} className="vibe-detail-overlay">
          <div className="vibe-case" ref={detailRef} onClick={(e) => { if (e.target === e.currentTarget) setDetailOpen(false); }}>
            <div className={`vibe-case__media vibe-detail-motion${project.introVideo && videoPlaying ? " is-playing-intro" : ""}`} onClick={(e) => e.stopPropagation()}>
              {project.mediaType === "video" ? (
                <video src={project.image} autoPlay muted loop playsInline />
              ) : (
                <ResponsiveImage src={project.image} sizes="(max-width: 760px) 100vw, 60vw" alt={`${project.title} 封面`} />
              )}
              <div className="vibe-case__overlay" />
              {project.introVideo && videoPlaying && (
                <video
                  ref={introVideoRef}
                  className="vibe-case__intro-video"
                  src={project.introVideo}
                  poster={project.image}
                  controls
                  autoPlay
                  playsInline
                  onClick={(e) => e.stopPropagation()}
                  onEnded={() => setVideoPlaying(false)}
                />
              )}
              {project.introVideo && !videoPlaying && (
                <button
                  type="button"
                  className="vibe-case__intro-trigger"
                  onClick={() => setVideoPlaying(true)}
                  aria-label="查看视频介绍"
                >
                  <span className="vibe-case__intro-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                  <span className="vibe-case__intro-label">查看视频介绍</span>
                </button>
              )}
              <div className="vibe-case__title">
                <span>{project.code}</span>
                <h3>{project.title}</h3>
                <small>{project.tags}</small>
              </div>
            </div>
            <div className="vibe-case__content" onClick={(e) => e.stopPropagation()}>
              <div className="vibe-case__main">
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>{copy.modal.pain}</h4>
                  <p>{project.pain}</p>
                </div>
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>{copy.modal.approach}</h4>
                  <p>{project.approach}</p>
                </div>
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>{copy.modal.research}</h4>
                  <p><b>对象：</b>{project.research?.who}</p>
                  <p><b>方法：</b>{project.research?.method}</p>
                  <p><b>回写进 PRD：</b>{project.research?.finding}</p>
                </div>
                {project.prd && (
                  <section className="vibe-prd vibe-detail-motion" aria-label="PRD 文档">
                    <header><small>PRD</small><h4>{copy.modal.prdTitle}</h4></header>
                    <p>{project.prd.summary}</p>
                    <div className="vibe-prd__grid">
                      <article>
                        <h5>需求说明</h5>
                        <ul>{project.prd.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
                      </article>
                      <article>
                        <h5>技术架构</h5>
                        <ul>{project.prd.architecture.map((item) => <li key={item}>{item}</li>)}</ul>
                      </article>
                    </div>
                  </section>
                )}
                {project.pipeline && (
                  <ol className="vibe-pipeline vibe-detail-motion" aria-label="从构想到可运行">
                    {project.pipeline.map((item) => (
                      <li key={item.step}>
                        <span>{item.step}</span>
                        <strong>{item.title}</strong>
                        <p>{item.desc}</p>
                      </li>
                    ))}
                  </ol>
                )}
                <section className="vibe-build-notes vibe-detail-motion" aria-label="构建中的关键取舍">
                  <header><small>BUILD NOTES</small><h4>{copy.modal.notes}</h4></header>
                  {project.buildNotes.map((note) => (
                    <article key={note.step}>
                      <span>{note.step}</span>
                      <div>
                        <h5>{note.title}</h5>
                        <p><b>判断：</b>{note.thinking}</p>
                        <p><b>关键约束：</b>{note.obstacle}</p>
                        <p><b>设计决策：</b>{note.resolution}</p>
                      </div>
                    </article>
                  ))}
                </section>
              </div>
              <aside className="vibe-case__side">
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>{copy.modal.highlights}</h4>
                  <ul>{project.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
                <div className="vibe-case__block vibe-detail-motion">
                  <h4>{copy.modal.stack}</h4>
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
            <small>本地构建 / 私人预览</small>
            <h3 id="local-app-title">{copy.modal.localTitle}</h3>
            <p><strong>{localNotice.title}</strong> {copy.modal.localDescription}</p>
            <div className="local-app-modal__meta">
              <span><CircleGauge size={15} />完整交互演示</span>
              <span><MessageCircle size={15} />联系作者体验</span>
            </div>
            <div className="local-app-modal__actions">
              <button type="button" onClick={() => setLocalNotice(null)}>{copy.modal.later}</button>
              <a href="mailto:zen92@foxmail.com?subject=作品体验咨询">{copy.modal.contact} <ArrowUpRight size={15} /></a>
            </div>
          </div>
        </div>
      )}
      <footer className="final-credit motion-item" data-motion="riseSoft">
        <span>复杂产品、设计系统，或仍处于构想阶段的 AI 产品，欢迎交流。</span>
        <a href="mailto:zen92@foxmail.com">ZEN92@FOXMAIL.COM</a>
      </footer>
    </section>
  );
}

/** Clear staged transforms so hover GSAP / tilt effects start clean. */
const MOTION_CLEAR = "x,y,scale,scaleX,scaleY,rotation,rotationX,rotationY,filter,transformOrigin,transformPerspective";

const resolveMotionKind = (el, index, chapterIndex) => {
  const explicit = el.getAttribute("data-motion");
  if (explicit) return explicit;
  if (el.classList.contains("hero-name")) return "heroZoom";
  if (el.classList.contains("hero-divider")) return "lineDraw";
  if (el.classList.contains("hero-cta")) return "riseSoft";
  if (el.classList.contains("hero-tags")) return "fromLeft";
  if (el.classList.contains("micro-content-list")) return "fromRight";
  if (el.classList.contains("eyebrow") || el.matches("p.eyebrow")) return "dropIn";
  if (el.classList.contains("chapter-summary")) return "riseSoft";
  if (el.classList.contains("scene-heading")) {
    if (el.classList.contains("scene-heading--center")) return "heroZoom";
    return chapterIndex % 2 === 0 ? "fromLeft" : "fromRight";
  }
  if (el.classList.contains("experience-card-grid")) return "fanSplit";
  if (el.classList.contains("project-cover-grid")) return "cardCascade";
  if (el.classList.contains("vibe-card-row")) return "cardCascade";
  if (el.classList.contains("system-screen-ui")) return "panelDock";
  if (el.classList.contains("graphic-drift")) return "stageReveal";
  if (el.classList.contains("final-credit")) return "riseSoft";
  // Fallback variety by index so siblings never all match.
  const fallbacks = ["fromLeft", "fromRight", "riseSoft", "zoomPop", "dropIn"];
  return fallbacks[index % fallbacks.length];
};

const motionTargets = (el, kind) => {
  if (kind === "fanSplit" || kind === "cardCascade") {
    const kids = [...el.querySelectorAll(
      ":scope > .experience-card, :scope > .project-cover-card, :scope > .vibe-tilted-wrap, :scope > .interactive-card",
    )];
    return kids.length ? kids : [el];
  }
  return [el];
};

/** Build enter-from / exit-to states per target for a motion kind. */
const motionStates = (kind, targetIndex, total, scrollDir = 1) => {
  const side = targetIndex % 2 === 0 ? -1 : 1;
  const n = total > 1 ? targetIndex / (total - 1) : 0.5;

  switch (kind) {
    case "heroZoom":
      return {
        from: { autoAlpha: 0, scale: 1.72, y: 18 * scrollDir, filter: "blur(14px)", transformOrigin: "50% 50%" },
        enter: { autoAlpha: 1, scale: 1, y: 0, filter: "blur(0px)", duration: 0.78, ease: "power3.out" },
        exit: { autoAlpha: 0, scale: 1.35, y: -24 * scrollDir, filter: "blur(12px)", duration: 0.5, ease: "power2.in" },
      };
    case "zoomPop":
      return {
        from: { autoAlpha: 0, scale: 0.55, filter: "blur(10px)", transformOrigin: "50% 50%" },
        enter: { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.68, ease: "back.out(1.5)" },
        exit: { autoAlpha: 0, scale: 0.72, filter: "blur(8px)", duration: 0.42, ease: "power2.in" },
      };
    case "dropIn":
      return {
        from: { autoAlpha: 0, y: -42 * scrollDir, filter: "blur(8px)" },
        enter: { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.58, ease: "power3.out" },
        exit: { autoAlpha: 0, y: -28 * scrollDir, filter: "blur(6px)", duration: 0.4, ease: "power2.in" },
      };
    case "riseSoft":
      return {
        from: { autoAlpha: 0, y: 48 * scrollDir, filter: "blur(8px)" },
        enter: { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.64, ease: "power3.out" },
        exit: { autoAlpha: 0, y: 36 * scrollDir, filter: "blur(6px)", duration: 0.42, ease: "power2.in" },
      };
    case "fromLeft":
      return {
        from: { autoAlpha: 0, x: -90, filter: "blur(9px)" },
        enter: { autoAlpha: 1, x: 0, filter: "blur(0px)", duration: 0.66, ease: "power3.out" },
        exit: { autoAlpha: 0, x: -70, filter: "blur(8px)", duration: 0.44, ease: "power2.in" },
      };
    case "fromRight":
      return {
        from: { autoAlpha: 0, x: 90, filter: "blur(9px)" },
        enter: { autoAlpha: 1, x: 0, filter: "blur(0px)", duration: 0.66, ease: "power3.out" },
        exit: { autoAlpha: 0, x: 70, filter: "blur(8px)", duration: 0.44, ease: "power2.in" },
      };
    case "lineDraw":
      return {
        from: { autoAlpha: 0, scaleX: 0.08, transformOrigin: "left center" },
        enter: { autoAlpha: 1, scaleX: 1, duration: 0.7, ease: "power2.out" },
        exit: { autoAlpha: 0, scaleX: 0.15, transformOrigin: "right center", duration: 0.38, ease: "power2.in" },
      };
    case "panelDock":
      return {
        from: {
          autoAlpha: 0,
          scale: 0.82,
          y: 50 * scrollDir,
          rotateX: 18,
          filter: "blur(12px)",
          transformOrigin: "50% 60%",
          transformPerspective: 1100,
        },
        enter: {
          autoAlpha: 1, scale: 1, y: 0, rotateX: 0, filter: "blur(0px)",
          duration: 0.8, ease: "power3.out",
        },
        exit: {
          autoAlpha: 0, scale: 0.9, y: -36 * scrollDir, rotateX: -12, filter: "blur(10px)",
          duration: 0.5, ease: "power2.in",
        },
      };
    case "stageReveal":
      return {
        from: {
          autoAlpha: 0, x: 70, scale: 0.88, filter: "blur(12px)",
          transformOrigin: "70% 50%",
        },
        enter: { autoAlpha: 1, x: 0, scale: 1, filter: "blur(0px)", duration: 0.78, ease: "power3.out" },
        exit: { autoAlpha: 0, x: 50, scale: 0.92, filter: "blur(10px)", duration: 0.48, ease: "power2.in" },
      };
    case "fanSplit": {
      // Children peel in from left / right edges.
      return {
        from: {
          autoAlpha: 0,
          x: side * (72 + n * 28),
          y: 28 * scrollDir,
          rotateY: side * -28,
          scale: 0.9,
          filter: "blur(10px)",
          transformOrigin: side < 0 ? "0% 50%" : "100% 50%",
          transformPerspective: 900,
        },
        enter: {
          autoAlpha: 1, x: 0, y: 0, rotateY: 0, scale: 1, filter: "blur(0px)",
          duration: 0.7, ease: "power3.out",
        },
        exit: {
          autoAlpha: 0, x: side * 64, y: -18 * scrollDir, rotateY: side * 18, scale: 0.92, filter: "blur(8px)",
          duration: 0.42, ease: "power2.in",
        },
      };
    }
    case "cardCascade": {
      // Deck-style: slight overscale + alternate lateral drift.
      return {
        from: {
          autoAlpha: 0,
          x: side * (40 + targetIndex * 18),
          y: 56 + targetIndex * 10,
          scale: 1.18 - targetIndex * 0.04,
          rotate: side * (4 + targetIndex),
          filter: "blur(12px)",
          transformOrigin: "50% 80%",
        },
        enter: {
          autoAlpha: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: "blur(0px)",
          duration: 0.72, ease: "power3.out",
        },
        exit: {
          autoAlpha: 0,
          x: side * -48,
          y: -40 * scrollDir,
          scale: 0.9,
          rotate: side * -6,
          filter: "blur(10px)",
          duration: 0.46,
          ease: "power2.in",
        },
      };
    }
    default:
      return {
        from: { autoAlpha: 0, y: 30 * scrollDir, filter: "blur(8px)" },
        enter: { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "power3.out" },
        exit: { autoAlpha: 0, y: -24 * scrollDir, filter: "blur(6px)", duration: 0.4, ease: "power2.in" },
      };
  }
};

export function App() {
  const [content, setContent] = useState(() => resolveContent());
  const contentRef = useRef(content);
  const copy = useMemo(() => Object.fromEntries((content.siteCopy || []).map((page) => [page.id, page])), [content.siteCopy]);
  const profileData = content.profileModal?.[0];
  const careerData = content.careerStages || [];
  const [activeChapter, setActiveChapter] = useState(0);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  useEffect(() => {
    const update = (event) => setContent(resolveContent(event.detail));
    const updateFromStorage = (event) => {
      if (event.key === "zen-portfolio-content-v1") setContent(resolveContent());
    };
    window.addEventListener("portfolio:content-updated", update);
    window.addEventListener("storage", updateFromStorage);
    const synchronize = async () => {
      const result = await syncPublishedContent(contentRef.current);
      if (!result.changed) return;
      contentRef.current = result.content;
      setContent(result.content);
    };
    synchronize();
    const refresh = window.setInterval(synchronize, 30000);
    return () => {
      window.removeEventListener("portfolio:content-updated", update);
      window.removeEventListener("storage", updateFromStorage);
      window.clearInterval(refresh);
    };
  }, []);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const preludeVisualsReady = usePreludeVisualsReady();
  const {
    progress: frameProgress,
    canEnter: framesCanEnter,
    ready: framesReady,
    error: frameError,
    retry: retryFrames,
    backgroundReady,
    startBackgroundWarm,
  } = useFrameBootloader(preludeVisualsReady);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [experienceEntered, setExperienceEntered] = useState(false);
  const [entryChromeVisible, setEntryChromeVisible] = useState(false);
  const shellRef = useRef(null);
  const enterExperience = useCallback(() => {
    if (experienceEntered) return;
    setExperienceEntered(true);
    startBackgroundWarm();

  }, [experienceEntered, startBackgroundWarm]);
  const finishExperienceEntry = useCallback(() => setLoaderVisible(false), []);

  useEffect(() => {
    document.documentElement.classList.toggle("is-loading", loaderVisible);
    return () => document.documentElement.classList.remove("is-loading");
  }, [loaderVisible]);

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
      setActiveChapter(clamp(current.index, 0, chapters.length - 1));
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

  const prevChapterRef = useRef(null);
  const chapterMotionTlRef = useRef(null);

  useLayoutEffect(() => {
    if (!framesReady || !shellRef.current) return undefined;

    const allMotionRoots = gsap.utils.toArray(shellRef.current.querySelectorAll(".chapter .motion-item"));
    const allLeafTargets = allMotionRoots.flatMap((el) => {
      const kind = resolveMotionKind(el, 0, 0);
      return motionTargets(el, kind);
    });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set([...allMotionRoots, ...allLeafTargets], {
        autoAlpha: 1, x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1,
        rotation: 0, rotationX: 0, rotationY: 0, filter: "blur(0px)",
        clearProps: MOTION_CLEAR,
      });
      prevChapterRef.current = activeChapter;
      return undefined;
    }

    const activeChapterEl = shellRef.current.querySelector(`.chapter[data-chapter="${activeChapter}"]`);
    const activeRoots = activeChapterEl
      ? gsap.utils.toArray(activeChapterEl.querySelectorAll(".motion-item"))
      : [];
    const prevChapter = prevChapterRef.current;
    const isChapterChange = prevChapter !== null && prevChapter !== activeChapter;
    const scrollDir = isChapterChange && activeChapter < prevChapter ? -1 : 1;
    const prevChapterEl = isChapterChange
      ? shellRef.current.querySelector(`.chapter[data-chapter="${prevChapter}"]`)
      : null;
    const prevRoots = prevChapterEl
      ? gsap.utils.toArray(prevChapterEl.querySelectorAll(".motion-item"))
      : [];

    const expand = (roots, chapterIndex) => roots.flatMap((el, rootIndex) => {
      const kind = resolveMotionKind(el, rootIndex, chapterIndex);
      const targets = motionTargets(el, kind);
      // Parent grid shells stay visible so children can animate independently.
      if (targets.length > 1 && targets[0] !== el) {
        gsap.set(el, { autoAlpha: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)", clearProps: MOTION_CLEAR });
      }
      return targets.map((target, targetIndex) => {
        const states = motionStates(kind, targetIndex, targets.length, scrollDir);
        // The moving archive and glass cards already contain composited layers.
        // Blurring their entire subtree during a chapter change adds a large
        // offscreen render pass on top of the scrolling frame sequence.
        if (chapterIndex === 4 || chapterIndex === 5) {
          for (const state of Object.values(states)) delete state.filter;
        }
        return {
          el: target,
          kind,
          rootIndex,
          targetIndex,
          total: targets.length,
          states,
        };
      });
    });

    const activePieces = expand(activeRoots, activeChapter);
    const prevPieces = expand(prevRoots, prevChapter ?? activeChapter);
    const activeSet = new Set(activePieces.map((p) => p.el));
    const prevSet = new Set(prevPieces.map((p) => p.el));

    chapterMotionTlRef.current?.kill();
    gsap.killTweensOf([...allMotionRoots, ...allLeafTargets]);

    // Park every non-playing page offstage.
    allLeafTargets.forEach((el) => {
      if (!activeSet.has(el) && !prevSet.has(el)) {
        gsap.set(el, { autoAlpha: 0, x: 0, y: 0, scale: 1, clearProps: MOTION_CLEAR });
      }
    });
    allMotionRoots.forEach((el) => {
      if (!activeRoots.includes(el) && !prevRoots.includes(el)) {
        gsap.set(el, { autoAlpha: 0 });
      }
    });

    const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
    chapterMotionTlRef.current = tl;

    // EXIT — each piece uses its own reverse language.
    if (isChapterChange && prevPieces.length) {
      prevPieces.forEach((piece, i) => {
        const { exit } = piece.states;
        const { duration, ease, ...vars } = exit;
        tl.to(piece.el, { ...vars, duration, ease }, i * 0.05);
      });
    }

    // ENTER — choreographed by content type; replays on every visit.
    const enterAt = isChapterChange && prevPieces.length ? 0.22 : 0;
    activePieces.forEach((piece, i) => {
      const { from, enter } = piece.states;
      const { duration, ease, ...toVars } = enter;
      gsap.set(piece.el, from);
      // Nested grid parents stay present.
      if (piece.el.closest(".motion-item") && piece.el.classList.contains("motion-item") === false) {
        const parent = piece.el.closest(".motion-item");
        if (parent) gsap.set(parent, { autoAlpha: 1 });
      }
      const lag = piece.total > 1
        ? piece.rootIndex * 0.1 + piece.targetIndex * 0.09
        : piece.rootIndex * 0.1;
      tl.to(piece.el, { ...toVars, duration, ease }, enterAt + lag + i * 0.01);
    });

    // Ensure active roots that only act as shells are visible.
    activeRoots.forEach((el) => {
      const kind = resolveMotionKind(el, 0, activeChapter);
      if (motionTargets(el, kind).length > 1) {
        gsap.set(el, { autoAlpha: 1 });
      }
    });

    prevChapterRef.current = activeChapter;

    return () => {
      tl.kill();
      if (chapterMotionTlRef.current === tl) chapterMotionTlRef.current = null;
    };
  }, [activeChapter, framesReady]);

  useEffect(() => {
    const scope = shellRef.current?.querySelector(`.chapter[data-chapter="${activeChapter}"]`);
    if (!scope || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const cards = [...scope.querySelectorAll(".interactive-card")].filter((card) => !card.closest(".vibe-tilted-wrap"));
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
  }, [activeChapter, framesReady]);

  const navigate = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    const isPhoneLayout = window.matchMedia("(max-width: 760px)").matches;
    const pageH = Math.max(1, window.innerHeight);
    const maxScroll = pageH * (chapters.length - 1);
    const top = isPhoneLayout ? target.offsetTop : Math.min(target.offsetTop, maxScroll);
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div ref={shellRef} className={`portfolio-shell${experienceEntered ? " is-entered" : ""}${entryChromeVisible ? " is-entry-chrome-visible" : ""}`}>
      {framesReady && <CinematicBackdrop />}
      {loaderVisible && (
        <LoadingScreen
          progress={frameProgress}
          canEnter={framesCanEnter || framesReady}
          ready={framesReady}
          error={frameError}
          onRetry={retryFrames}
          onEnter={enterExperience}
          onChromeReveal={() => setEntryChromeVisible(true)}
          onFinish={finishExperienceEntry}
          backgroundReady={backgroundReady}
          preludeReady={preludeVisualsReady}
        />
      )}
      <ProfileBadge hidden={navigationOpen} entryVisible={entryChromeVisible} />
      {framesReady && <>
      <NarrativeThread activeChapter={activeChapter} />
      <Navigation activeChapter={activeChapter} onNavigate={navigate} onMenuChange={setNavigationOpen} />
      <ChapterIndex index={activeChapter} />
      <GuideLine activeChapter={activeChapter} />
      {experienceEntered && !backgroundReady && <CinematicLoadingNotice />}
      <main>
        <AboutSection copy={copy.about} profileData={profileData} />
        <ExperienceSection copy={copy.experience} careerData={careerData} />
        <SystemSection modules={content.systemModules} copy={copy.wanying} />
        <ProjectsSection items={content.projects} copy={copy.projects} />
        <GraphicSection works={content.works} copy={copy.graphic} />
        <VibeSection items={content.vibeProjects} copy={copy.vibe} />
        <IpEpilogue />
      </main>
      </>}
    </div>
  );
}
