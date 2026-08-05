import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { career, chapters, projects, systemModules, vibeProjects, works } from "./data.js";
import { ProfileBadge } from "./ProfileBadge.jsx";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const FRAME_COUNTS = [240, 240, 240, 240, 240];

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

const frameTimeForProgress = (duration, frameCount, progress) => {
  const frameIndex = Math.round(clamp(progress, 0, 1) * (frameCount - 1));
  return frameIndex * (duration / frameCount);
};

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
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="40%" stopColor="rgba(243,198,0,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
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

        <circle className="narrative-thread__head" ref={headRef} r="3" />
      </svg>
    </div>
  );
}

function CinematicBackdrop() {
  const videoRefs = useRef([]);
  const vignetteRef = useRef(null);
  const durations = useRef([5, 5, 5, 5, 5]);
  const targetTimes = useRef([0, 0, 0, 0, 0]);
  const activeSegment = useRef(0);
  const activatedRef = useRef(false);
  const [visibleSegment, setVisibleSegment] = useState(0);
  const videos = [1, 2, 3, 4, 5];
  // Mobile needs videos to be "playing-ready" before currentTime can be scrubbed.
  // We activate them once on first user gesture, then pause and scrub via currentTime.
  const isMobile = typeof window !== "undefined" && (
    window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760
  );

  // Activate (unlock) all videos on the first user interaction so iOS lets us
  // set currentTime later. play() then immediate pause() flips them into a
  // scrub-friendly state without leaving them autoplaying.
  useEffect(() => {
    if (!isMobile) return undefined;
    const unlock = () => {
      if (activatedRef.current) return;
      activatedRef.current = true;
      videoRefs.current.forEach((v) => {
        if (!v) return;
        const p = v.play();
        if (p && typeof p.then === "function") {
          p.then(() => { v.pause(); }).catch(() => {});
        } else {
          v.pause();
        }
      });
    };
    window.addEventListener("touchstart", unlock, { passive: true, once: true });
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("scroll", unlock, { passive: true, once: true });
    return () => {
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("scroll", unlock);
    };
  }, [isMobile]);

  useEffect(() => {
    let frameRequest = 0;

    const syncFrame = () => {
      frameRequest = 0;
      const pageHeight = Math.max(1, window.innerHeight);
      const rawPage = window.scrollY / pageHeight;
      const segment = clamp(Math.floor(rawPage), 0, 4);
      const local = segment === 4 && rawPage >= 5 ? 1 : clamp(rawPage - segment, 0, 1);
      targetTimes.current[segment] = frameTimeForProgress(durations.current[segment], FRAME_COUNTS[segment], local);

      if (segment > activeSegment.current) {
        for (let index = activeSegment.current; index < segment; index += 1) {
          targetTimes.current[index] = frameTimeForProgress(durations.current[index], FRAME_COUNTS[index], 1);
          const previousVideo = videoRefs.current[index];
          if (previousVideo?.readyState >= 1) previousVideo.currentTime = targetTimes.current[index];
        }
      } else if (segment < activeSegment.current) {
        for (let index = activeSegment.current; index > segment; index -= 1) {
          targetTimes.current[index] = 0;
          const nextVideo = videoRefs.current[index];
          if (nextVideo?.readyState >= 1) nextVideo.currentTime = 0;
        }
      }

      activeSegment.current = segment;
      setVisibleSegment((current) => current === segment ? current : segment);
      const video = videoRefs.current[segment];
      const target = targetTimes.current[segment];
      if (video && video.readyState >= 1 && Math.abs(video.currentTime - target) > 0.008) {
        video.currentTime = target;
      }

      if (vignetteRef.current) {
        const distance = Math.abs(rawPage - 2.5);
        const fade = clamp(distance * 0.9, 0, 1);
        vignetteRef.current.style.setProperty("--vignette-strength", String(fade));
      }
    };

    const queueFrame = () => {
      if (!frameRequest) frameRequest = window.requestAnimationFrame(syncFrame);
    };

    syncFrame();
    window.addEventListener("scroll", queueFrame, { passive: true });
    window.addEventListener("resize", queueFrame);
    return () => {
      window.removeEventListener("scroll", queueFrame);
      window.removeEventListener("resize", queueFrame);
      window.cancelAnimationFrame(frameRequest);
    };
  }, []);

  return (
    <div className="cinematic-backdrop" aria-hidden="true">
      {videos.map((number, index) => (
        <video
          key={number}
          ref={(element) => { videoRefs.current[index] = element; }}
          className={index === visibleSegment ? "background-video is-active" : "background-video"}
          src={`/videos/scroll-0${number}.mp4?v=240`}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            durations.current[index] = event.currentTarget.duration || 5;
            const pageHeight = Math.max(1, window.innerHeight);
            const rawPage = window.scrollY / pageHeight;
            const local = index === 4 && rawPage >= 5 ? 1 : clamp(rawPage - index, 0, 1);
            targetTimes.current[index] = frameTimeForProgress(durations.current[index], FRAME_COUNTS[index], local);
            event.currentTarget.currentTime = targetTimes.current[index];
          }}
        />
      ))}
      <div className="video-wash" />
      <div className="video-vignette" ref={vignetteRef} />
      <div className="video-vignette-left" />
      <div className="film-grain" />
    </div>
  );
}

function Navigation({ activeChapter, onNavigate }) {
  const [open, setOpen] = useState(false);

  const handleNavigate = (id) => {
    onNavigate(id);
    setOpen(false);
  };

  return (
    <nav className={`chapter-nav${open ? " is-open" : ""}`} aria-label="作品集章节">
      <button
        type="button"
        className="nav-burger"
        aria-expanded={open}
        aria-controls="nav-stack"
        aria-label={open ? "关闭导航" : "打开导航"}
        onClick={() => setOpen((v) => !v)}
      >
        <i /><i /><i />
      </button>
      <div className="nav-stack" id="nav-stack">
        {chapters.map((chapter, index) => (
          <button
            key={chapter.id}
            type="button"
            className={activeChapter === index ? "nav-item is-active" : "nav-item"}
            onClick={() => handleNavigate(chapter.id)}
          >
            <span className="nav-rail" aria-hidden="true" />
            <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="nav-label"><strong>{chapter.label}</strong><small>{chapter.zh}</small></span>
            <span className="nav-state">{activeChapter === index ? "NOW" : "GO"}</span>
          </button>
        ))}
      </div>
      <div className="nav-footer"><span>NARRATIVE THREAD</span><small>06 SCENES</small></div>
    </nav>
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
      <button type="button" className="info-overlay__close" onClick={onClose}>CLOSE</button>
      <header className="info-overlay__header overlay-motion" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </header>
      <div className="info-overlay__body overlay-motion" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function AboutSection() {
  const [open, setOpen] = useState(false);
  const signals = [["10+", "年 UI/UX 与产品设计经验"], ["0→1", "复杂产品与设计系统建设"], ["MULTI", "Web、小程序与数据大屏落地"]];
  return (
    <section className="chapter chapter-about" id="about" data-chapter="0">
      <div className="chapter-copy chapter-copy--bottom-right" data-narrative-anchor="about" data-thread-x="0.12" data-thread-y="0.12">
        <p className="eyebrow motion-item">UI/UX DESIGN LEAD · PRODUCT EXPERIENCE DESIGNER</p>
        <h1 className="motion-item"><span>TANG QIDONG</span>唐启东</h1>
        <p className="chapter-summary chapter-summary--lead motion-item">专注复杂业务系统、设计系统与数据体验，把需求、逻辑与技术，转化为清晰、可落地、可持续演进的产品体验。</p>
        <div className="micro-content-list micro-content-list--stats motion-item">
          {signals.map(([value, label]) => <button type="button" key={label} onClick={() => setOpen(true)}><strong>{value}</strong><span>{label}</span><small>+</small></button>)}
        </div>
        <button className="chapter-action motion-item" type="button" onClick={() => setOpen(true)}>VIEW SELECTED WORK / 查看代表项目</button>
      </div>
      <p className="motion-hint">SCROLL DOWN · FRAME BY FRAME</p>
      {open && (
        <InfoOverlay eyebrow="PROFILE / TANG QIDONG" title="设计，不止停在界面。" onClose={() => setOpen(false)}>
          <div className="profile-detail-grid">
            <article><span>01</span><h3>先定义问题，再定义界面</h3><p>从业务目标、用户任务和协作约束出发，让每个视觉决策都有理由。</p></article>
            <article><span>02</span><h3>先建立秩序，再表达视觉</h3><p>用信息架构、Token 与组件系统，把复杂产品整理成可持续的语言。</p></article>
            <article><span>03</span><h3>让标准真正被使用</h3><p>连接产品、设计与研发，让规范进入日常交付，而不是停在文档里。</p></article>
            <article><span>04</span><h3>用原型降低决策风险</h3><p>通过高保真原型与 Vibe Coding，把抽象想法快速变成可验证体验。</p></article>
          </div>
        </InfoOverlay>
      )}
    </section>
  );
}

function ExperienceSection() {
  const [open, setOpen] = useState(false);
  return (
    <section className="chapter chapter-experience" id="experience" data-chapter="1">
      <div className="experience-panel scene-panel" data-narrative-anchor="experience" data-thread-x="0.92" data-thread-y="0.12">
        <header className="scene-heading motion-item">
          <p className="eyebrow">EXPERIENCE / 2015—NOW</p>
          <h2>从设计执行者，到体验与系统的推动者。</h2>
          <p>十年设计实践，从视觉与界面出发，持续深入复杂业务、产品体验与设计系统建设，把个人经验沉淀为可协作、可复用、可落地的设计方法。</p>
        </header>
        <div className="experience-card-grid motion-item">
          {career.map((item) => (
            <button type="button" className="experience-card interactive-card" key={item.version} onClick={() => setOpen(true)}>
              <span>{item.version}</span><small>{item.period}</small><h3>{item.role}</h3><p>{item.note}</p><b>VIEW STAGE</b>
            </button>
          ))}
        </div>
      </div>
      {open && (
        <InfoOverlay eyebrow="CAREER TIMELINE" title="四个阶段，一条路径。" onClose={() => setOpen(false)}>
          <div className="career-detail-grid">
            {career.map((item) => (
              <article className="career-detail" key={item.version}>
                <span>{item.version}</span>
                <p>{item.period}</p>
                <h3>{item.role}</h3>
                <small>{item.note}</small>
              </article>
            ))}
          </div>
        </InfoOverlay>
      )}
    </section>
  );
}

// Compositor-thread vertical marquee. The track renders its content twice; each
// item carries its own bottom margin (no grid gap) so the track height is
// exactly 2 * (itemHeight + margin). Translating by -50% lands copy 2's first
// item exactly under copy 1's first item, giving a seamless loop with zero JS
// measurement. Runs on the compositor thread, so it never stutters.
const marqueeLaunch = (track, direction, durationIndex) => {
  const duration = 17 + durationIndex * 3;
  track.style.setProperty("--marquee-duration", `${duration}s`);
  track.style.animation = `marquee-${direction < 0 ? "up" : "down"} var(--marquee-duration) linear infinite`;
  return () => { track.style.animation = ""; };
};
const marqueePause = (track) => { track.style.animationPlayState = "paused"; };
const marqueeResume = (track) => { track.style.animationPlayState = "running"; };

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
        return (
          <div className="vertical-strip" key={columnIndex}>
            <div className="vertical-strip__track" onMouseEnter={pauseColumn} onMouseLeave={resumeColumn}>
              {[...shifted, ...shifted].map((src, index) => (
                <button type="button" key={`${src}-${columnIndex}-${index}`} onClick={() => onPreview?.({ src, module })}>
                  <img src={src} alt={`${module.title} 界面示例 ${index % shifted.length + 1}`} />
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

  return (
    <section className="chapter chapter-system" id="wanying" data-chapter="2">
      <div className="system-screen-ui motion-item" data-narrative-anchor="system" data-thread-x="0.08" data-thread-y="0.12">
        <header className="system-screen-ui__header">
          <div><p className="eyebrow">WANYING DESIGN SYSTEM</p><h2>让复杂产品，共享同一种语言。</h2></div>
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
              <p className="system-module-detail">{module.detail}</p>
              <button type="button" onClick={() => setPreview(module)}>PREVIEW MODULE</button>
            </div>
            <div className="system-screen-tabs" role="tablist" aria-label="万应设计系统示例">
              {systemModules.map((item, index) => <button type="button" role="tab" aria-selected={active === index} className={active === index ? "is-active" : ""} key={item.id} onClick={() => setActive(index)}><span>{item.index}</span><strong>{item.title}</strong><small>{item.caption}</small></button>)}
            </div>
          </aside>
        </div>
      </div>
      {preview && (
        <div className="system-preview-lightbox" role="dialog" aria-modal="true" aria-label={`${preview.title} 图片预览`} onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
          <button type="button" onClick={() => setPreview(null)}>CLOSE</button>
          <figure><img src={preview.image} alt={`${preview.title} 完整预览`} /><figcaption><span>{preview.index}</span><div><strong>{preview.title}</strong><small>{preview.description}</small></div></figcaption></figure>
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
    <div className="detail-gallery" ref={rootRef}>
      <div className="detail-gallery__columns">
        {[0, 1, 2].map((columnIndex) => {
          const shifted = [...images.slice(columnIndex), ...images.slice(0, columnIndex)];
          return <div className="detail-gallery__column" key={columnIndex}><div className="detail-gallery__track">{[...shifted, ...shifted].map((src, index) => <button type="button" key={`${src}-${columnIndex}-${index}`} onClick={() => onOpen(src)}><img src={src} alt={`${project.title} UI ${index % images.length + 1}`} /></button>)}</div></div>;
        })}
      </div>
      <p>UI ARCHIVE · 03 VERTICAL STREAMS</p>
    </div>
  );
}

function ProjectDetail({ project, onClose }) {
  const detailRef = useRef(null);
  const [preview, setPreview] = useState(null);
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
      .fromTo(detailRef.current.querySelectorAll(".detail-copy > *"), { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.06 }, "<0.12");
    return () => timeline.kill();
  }, [project]);

  return (
    <div ref={detailRef} className="detail-overlay" role="dialog" aria-modal="true" aria-labelledby="project-title">
      <button type="button" className="detail-close" onClick={onClose}>CLOSE</button>
      <ProjectGallery project={project} onOpen={setPreview} />
      <article className="detail-copy">
        <div className="detail-topline"><span>{project.code} / CASE STUDY</span><small>{project.type}</small></div>
        <h2 id="project-title">{project.title}</h2>
        <p className="detail-role">{project.role}</p>
        <p className="detail-lead">{project.brief}</p>
        <div className="detail-metrics">
          {project.metrics.map(([value, label]) => <span key={label}><strong>{value}</strong>{label}</span>)}
        </div>
        <div className="detail-notes">
          {project.details.map(([label, text], index) => <article key={label}><span>0{index + 1}</span><div><strong>{label}</strong><p>{text}</p></div></article>)}
        </div>
      </article>
      {preview && <div className="project-image-lightbox" role="dialog" aria-modal="true" aria-label="项目界面预览" onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}><button type="button" onClick={() => setPreview(null)}>CLOSE</button><img src={preview} alt={`${project.title} 项目界面`} /></div>}
    </div>
  );
}

function ProjectsSection() {
  const [detail, setDetail] = useState(null);
  return (
    <section className="chapter chapter-projects" id="projects" data-chapter="3">
      <div className="projects-panel scene-panel" data-narrative-anchor="projects" data-thread-x="0.92" data-thread-y="0.12">
        <header className="scene-heading motion-item">
          <p className="eyebrow">SELECTED PROJECTS / 03</p>
          <h2>用项目证明，如何解决复杂问题。</h2>
          <p>从系统建设、企业管理到移动服务，基于如何理解业务、定义问题、组织信息，并把设计真正推进到落地。</p>
        </header>
        <div className="project-cover-grid motion-item">
          {projects.map((item, index) => (
            <button type="button" className="project-cover-card interactive-card" key={item.id} onClick={() => setDetail(item)}>
              <img src={item.image} alt="" />
              <div className="project-cover-card__copy"><span>0{index + 1} / {item.code}</span><h3>{item.title}</h3><small>{item.type}</small><b>OPEN CASE / 查看详情</b></div>
            </button>
          ))}
        </div>
      </div>
      {detail && <ProjectDetail project={detail} onClose={() => setDetail(null)} />}
    </section>
  );
}

function GraphicCarousel({ onOpen }) {
  const stageRef = useRef(null);
  const cleanupsRef = useRef([]);
  const tracksRef = useRef([]);

  useLayoutEffect(() => {
    const tracks = gsap.utils.toArray(stageRef.current.querySelectorAll(".graphic-column__track"));
    tracksRef.current = tracks;
    cleanupsRef.current = tracks.map((track, index) => marqueeLaunch(track, index === 1 ? -1 : 1, index + 4));
    return () => cleanupsRef.current.forEach((cleanup) => cleanup());
  }, []);

  const columns = [0, 1, 2].map((column) => works.filter((_, index) => index % 3 === column));
  const wheelResetRef = useRef(null);
  const baseDurationRef = useRef([]);
  const respondToWheel = () => {
    // Temporarily speed up the marquee while the user scrolls, then ease back.
    tracksRef.current.forEach((track, index) => {
      if (!baseDurationRef.current[index]) {
        const raw = track.style.getPropertyValue("--marquee-duration") || "26s";
        baseDurationRef.current[index] = parseFloat(raw) || 26;
      }
      track.style.animationDuration = `${baseDurationRef.current[index] * 0.4}s`;
    });
    if (wheelResetRef.current) clearTimeout(wheelResetRef.current);
    wheelResetRef.current = setTimeout(() => {
      tracksRef.current.forEach((track, index) => {
        track.style.animationDuration = `${baseDurationRef.current[index] || 26}s`;
      });
    }, 200);
  };
  const pauseColumn = (event) => marqueePause(event.currentTarget);
  const resumeColumn = (event) => marqueeResume(event.currentTarget);

  return (
    <div className="graphic-carousel graphic-loop motion-item" ref={stageRef} onWheel={respondToWheel}>
      <div className="graphic-loop__meta"><span>{String(works.length).padStart(2, "0")} WORKS</span><small>SCROLL TO ACCELERATE</small></div>
      <div className="graphic-loop__columns">
        {columns.map((column, columnIndex) => (
          <div className="graphic-column" key={columnIndex}>
            <div className="graphic-column__track" onMouseEnter={pauseColumn} onMouseLeave={resumeColumn}>
              {[...column, ...column].map((work, index) => <button type="button" className="graphic-slide interactive-card" key={`${work.src}-${columnIndex}-${index}`} onClick={() => onOpen(work)}><img src={work.src} alt={work.title} /><span><small>{work.type}</small><strong>{work.title}</strong></span></button>)}
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
  return (
    <section className="chapter chapter-graphic" id="graphic" data-chapter="4">
      <div className="graphic-panel scene-panel" data-narrative-anchor="graphic" data-thread-x="0.08" data-thread-y="0.12">
        <header className="scene-heading motion-item"><p className="eyebrow">GRAPHIC ARCHIVE / {String(works.length).padStart(2, "0")}</p><h2>在界面之外，<br />继续构建<br />设计语言。</h2><p>从品牌视觉、海报与版式，到图形系统与动态实验，为不同内容建立清晰而有辨识度的视觉表达。</p><button type="button" className="chapter-action" onClick={() => setArchiveOpen(true)}>EXPLORE ARCHIVE / 浏览完整作品</button></header>
        <GraphicCarousel onOpen={setSelected} />
      </div>
      {archiveOpen && (
        <InfoOverlay eyebrow="GRAPHIC ARCHIVE" title="视觉定格 / 06" onClose={() => setArchiveOpen(false)} className="graphic-overlay">
          <div className="archive-grid">
            {works.map((work, index) => (
              <button type="button" className="archive-item" key={work.src} onClick={() => setSelected(work)}>
                <img src={work.src} alt={work.title} />
                <span><small>0{index + 1} · {work.type}</small><strong>{work.title}</strong></span>
              </button>
            ))}
          </div>
        </InfoOverlay>
      )}
      {selected && (
        <div className="work-lightbox" role="dialog" aria-modal="true" aria-label={selected.title} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <button type="button" onClick={() => setSelected(null)}>CLOSE</button>
          <img src={selected.src} alt={selected.title} />
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
  const detailRef = useRef(null);

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
        <header className="scene-heading scene-heading--center motion-item"><p className="eyebrow">VIBE CODING / PERSONAL LAB</p><h2>把设计判断，转为可运行产品。</h2><p>从需求拆解、体验架构到界面实现，通过 Vibe Coding 独立构建工具与应用，让设计判断成为可以验证、迭代和交付的产品。</p></header>
        <div className="vibe-card-row motion-item">
          {vibeProjects.map((item, index) => (
            <article className="vibe-preview-card interactive-card" key={item.code}>
              <button type="button" className="vibe-preview-card__media" onClick={() => { setActive(index); setDetailOpen(true); }}>
                {item.mediaType === "video" ? <video src={item.image} muted loop playsInline preload="metadata" /> : <img src={item.image} alt={`${item.title} 预览`} />}
                <span>{item.code}</span>
              </button>
              <div><small>{item.index} / EXPERIMENT</small><h3>{item.title}</h3><p>{item.description}</p><div className="vibe-card-actions"><button type="button" className="vibe-btn-detail" onClick={() => { setActive(index); setDetailOpen(true); }}>构建过程</button>{item.wechat ? (<button type="button" className="vibe-btn-visit" onClick={() => { setActive(index); setQrOpen(true); }}>打开产品</button>) : item.link && item.link !== "#" ? (<a className="vibe-btn-visit" href={item.link} target="_blank" rel="noreferrer">打开产品</a>) : (<button type="button" className="vibe-btn-visit" onClick={() => alert("本地应用，请联系作者体验")}>打开产品</button>)}</div></div>
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
                  {project.wechat ? (<button type="button" className="vibe-btn-visit" onClick={() => { setDetailOpen(false); setQrOpen(true); }}>打开产品</button>) : project.link && project.link !== "#" ? (<a className="vibe-btn-visit" href={project.link} target="_blank" rel="noreferrer">打开产品</a>) : (<button type="button" className="vibe-btn-visit" onClick={() => alert("本地应用，请联系作者体验")}>打开产品</button>)}
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
            <button type="button" className="wechat-qr-close" onClick={() => setQrOpen(false)}>CLOSE</button>
            <img src={project.wechat.qr} alt={`${project.title} 小程序码`} />
            <p>{project.wechat.hint}</p>
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
  const shellRef = useRef(null);
  // Shared flag so programmatic navigation (nav clicks) can suspend scroll snapping.
  const snapControlRef = useRef({ navigateProgrammatic: false });
  const navigateTimerRef = useRef(0);
  useScrollSnap(6, snapControlRef);

  useEffect(() => {
    let frame = 0;
    const updateChapter = () => {
      frame = 0;
      setActiveChapter(clamp(Math.round(window.scrollY / Math.max(1, window.innerHeight)), 0, 5));
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
    const lockTail = () => {
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
    const pageH = Math.max(1, window.innerHeight);
    const maxScroll = pageH * 5;
    const top = Math.min(target.offsetTop, maxScroll);
    // Suppress scroll-snap briefly so it doesn't fight the smooth programmatic scroll.
    snapControlRef.current.navigateProgrammatic = true;
    window.clearTimeout(navigateTimerRef.current);
    navigateTimerRef.current = window.setTimeout(() => { snapControlRef.current.navigateProgrammatic = false; }, 900);
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div ref={shellRef} className="portfolio-shell">
      <CinematicBackdrop />
      <NarrativeThread activeChapter={activeChapter} />
      <Navigation activeChapter={activeChapter} onNavigate={navigate} />
      <ChapterIndex index={activeChapter} />
      <GuideLine activeChapter={activeChapter} />
      <ProfileBadge />
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
