import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import BorderGlow from "./components/BorderGlow.jsx";

const CONTACTS = [
  ["EMAIL", "zen92@foxmail.com"],
  ["PHONE", "+86 18674883943"],
];

const getRopePath = (side, x = 0, y = 0) => {
  const startX = side === "left" ? 60 : 200;
  const endX = 130 + x;
  const endY = 194 + y;
  const midX = (side === "left" ? 95 : 165) + x * 0.36;
  const midY = 92 + Math.max(y, 0) * 0.2 + Math.abs(x) * 0.05;
  return `M${startX} 0 C${startX} 54 ${midX} ${midY} ${endX} ${endY}`;
};

const resetRope = (paths, x = 0, y = 0) => {
  paths.forEach(({ node, side }) => node?.setAttribute("d", getRopePath(side, x, y)));
};

export function ProfileBadge({ hidden = false }) {
  const [open, setOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [dialogPresent, setDialogPresent] = useState(false);
  const rootRef = useRef(null);
  const dropRef = useRef(null);
  const cardRef = useRef(null);
  const innerRef = useRef(null);
  const ropeLeftShadowRef = useRef(null);
  const ropeLeftFaceRef = useRef(null);
  const ropeRightShadowRef = useRef(null);
  const ropeRightFaceRef = useRef(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, x: 0, y: 0, liveX: 0, liveY: 0 });

  const ropePaths = useCallback(() => [
    { node: ropeLeftShadowRef.current, side: "left" },
    { node: ropeLeftFaceRef.current, side: "left" },
    { node: ropeRightShadowRef.current, side: "right" },
    { node: ropeRightFaceRef.current, side: "right" },
  ], []);

  // Several overlays are mounted by independent chapters. Observe the real DOM
  // so the floating contact control is always removed before any close button
  // can be obstructed, including overlays that do not use the shared helper.
  useEffect(() => {
    const sync = () => setDialogPresent(Boolean(document.querySelector('[role="dialog"]')));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role"] });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const intro = gsap.fromTo(rootRef.current, { y: -64, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, delay: .2, ease: "back.out(1.8)" });
    return () => intro.kill();
  }, []);

  useLayoutEffect(() => {
    if (!dropRef.current) return;
    if (!open) {
      gsap.killTweensOf([dropRef.current, cardRef.current]);
      gsap.to(dropRef.current, { autoAlpha: 0, y: -28, scale: 0.94, duration: 0.2, ease: "power2.out" });
      return;
    }
    setFlipped(false);
    gsap.set(innerRef.current, { rotateY: 0 });
    resetRope(ropePaths());
    dragRef.current = { active: false, moved: false, startX: 0, startY: 0, x: 0, y: 0, liveX: 0, liveY: 0 };
    if (cardRef.current) {
      cardRef.current.style.setProperty("--reveal-x", "50%");
      cardRef.current.style.setProperty("--reveal-y", "42%");
      cardRef.current.style.setProperty("--reveal-opacity", "0");
    }
    gsap.killTweensOf([dropRef.current, cardRef.current]);
    gsap.set(dropRef.current, { autoAlpha: 1, y: 0, scale: 1, transformOrigin: "50% 0%" });
    const drop = gsap.timeline({
      defaults: { overwrite: "auto" },
      onUpdate: () => {
        const x = Number(gsap.getProperty(cardRef.current, "x")) || 0;
        const y = Number(gsap.getProperty(cardRef.current, "y")) || 0;
        resetRope(ropePaths(), x, y);
      },
      onComplete: () => resetRope(ropePaths()),
    });
    drop.fromTo(dropRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: "power1.out" }, 0)
      .fromTo(cardRef.current, { x: 0, y: -138, rotation: 0, scale: 0.96 }, { y: 0, scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }, 0);
    return () => drop.kill();
  }, [open, ropePaths]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") { setOpen(false); setFlipped(false); } };
    const onOutside = (event) => {
      if (open && rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setFlipped(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onOutside, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onOutside, true);
    };
  }, [open]);

  const toggleFlip = () => {
    const next = !flipped;
    gsap.to(innerRef.current, { rotateY: next ? 180 : 0, duration: 0.6, ease: "power3.inOut", overwrite: "auto" });
    setFlipped(next);
  };

  const onPointerDown = (event) => {
    if (!open || event.target.closest("button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      x: dragRef.current.x,
      y: dragRef.current.y,
      liveX: dragRef.current.x,
      liveY: dragRef.current.y,
    };
    gsap.to(cardRef.current, { scale: 1.03, duration: 0.18, ease: "power2.out" });
  };

  const onPointerMove = (event) => {
    if (!dragRef.current.active || !cardRef.current) return;
    const nextX = dragRef.current.x + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.y + event.clientY - dragRef.current.startY;
    dragRef.current.moved = dragRef.current.moved || Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY) > 6;
    dragRef.current.liveX = nextX;
    dragRef.current.liveY = nextY;
    resetRope(ropePaths(), nextX, nextY);
    gsap.set(cardRef.current, { x: nextX, y: nextY, rotation: 0 });
  };

  const onPointerUp = (event) => {
    if (!dragRef.current.active) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const wasMoved = dragRef.current.moved;
    const releaseY = Number(dragRef.current.liveY ?? gsap.getProperty(cardRef.current, "y")) || 0;
    dragRef.current.active = false;
    dragRef.current.x = 0;
    dragRef.current.y = 0;
    dragRef.current.liveX = 0;
    dragRef.current.liveY = 0;
    if (!wasMoved) {
      toggleFlip();
      return;
    }
    if (releaseY > 120) {
      gsap.timeline({
        onUpdate: () => {
          const x = Number(gsap.getProperty(cardRef.current, "x")) || 0;
          const y = Number(gsap.getProperty(cardRef.current, "y")) || 0;
          resetRope(ropePaths(), x, y);
        },
        onComplete: () => {
          resetRope(ropePaths());
          setOpen(false);
        },
      })
        .to(cardRef.current, { x: 0, y: -340, rotation: 0, scale: 0.92, duration: 0.42, ease: "back.in(1.75)", overwrite: "auto" })
        .to(dropRef.current, { autoAlpha: 0, y: -28, scale: 0.94, duration: 0.18, ease: "power2.out" }, "-=0.14");
      return;
    }
    gsap.to(cardRef.current, {
      x: 0, y: 0, rotation: 0, scale: 1,
      duration: 0.9, ease: "elastic.out(1, 0.46)", overwrite: "auto",
      onUpdate: () => {
        const x = Number(gsap.getProperty(cardRef.current, "x")) || 0;
        const y = Number(gsap.getProperty(cardRef.current, "y")) || 0;
        resetRope(ropePaths(), x, y);
      },
      onComplete: () => resetRope(ropePaths()),
    });
  };

  const onRevealMove = (event) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty("--reveal-x", `${event.clientX - rect.left}px`);
    cardRef.current.style.setProperty("--reveal-y", `${event.clientY - rect.top}px`);
    cardRef.current.style.setProperty("--reveal-opacity", "1");
  };

  const hideReveal = () => {
    cardRef.current?.style.setProperty("--reveal-opacity", "0");
  };

  return (
    <div className={`identity-badge ${open ? "is-open" : ""}${hidden || dialogPresent ? " is-hidden" : ""}`} ref={rootRef} aria-label="唐启东身份工牌">
      <BorderGlow
        className="identity-badge__trigger-shell"
        edgeSensitivity={18}
        glowColor="48 100 60"
        backgroundColor="rgba(13, 14, 16, 0.72)"
        borderRadius={0}
        glowRadius={22}
        glowIntensity={0.78}
        coneSpread={18}
        fillOpacity={0.12}
        colors={["#f3c600", "#fff3a0", "#8a7400"]}
      >
        <button type="button" className="identity-badge__trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <i className="identity-badge__ticket-frame" aria-hidden="true" />
          <span>合作与交流</span>
          <em>CONTACT & COLLABORATION</em>
        </button>
      </BorderGlow>
      <div className="identity-badge__drop" ref={dropRef}>
        <svg className="identity-badge__rope identity-badge__rope--back" viewBox="0 0 260 220" aria-hidden="true">
          <path className="rope-shadow" d={getRopePath("right")} ref={ropeRightShadowRef} />
          <path className="rope-face" d={getRopePath("right")} ref={ropeRightFaceRef} />
        </svg>
        <div
          className={`identity-card ${flipped ? "is-flipped" : ""}`}
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onMouseMove={onRevealMove}
          onMouseLeave={hideReveal}
        >
          <span className="identity-card__hole" />
          <div className="identity-card__inner" ref={innerRef}>
            <section className="identity-card__face identity-card__front">
              <div className="identity-card__portrait">
                <img className="identity-card__base" src="/assets/badge/profile-reveal-base.webp" alt="唐启东工牌肖像" draggable="false" />
                <img className="identity-card__cyber" src="/assets/badge/profile-reveal-cyber.webp" alt="" draggable="false" />
              </div>
              <div className="identity-card__copy">
                <p>UI / UX · 2015—NOW</p>
                <h2>TANG QIDONG</h2>
                <span>十年 UI/UX 经验。设计系统负责人。</span>
              </div>
              <button type="button" className="identity-card__flip" onPointerDown={(e) => e.stopPropagation()} onClick={toggleFlip}>CLICK CARD / 翻转</button>
            </section>
            <section className="identity-card__face identity-card__back">
              <p className="identity-card__scan">SCAN TO CONTACT</p>
              <img className="identity-card__qr" src="/assets/badge/wechat-qr.webp" alt="唐启东微信二维码" draggable="false" />
              <div className="identity-card__contacts">
                {CONTACTS.map(([label, value]) => (
                  <p key={label}><small>{label}</small><strong>{value}</strong></p>
                ))}
              </div>
              <button type="button" className="identity-card__flip" onPointerDown={(e) => e.stopPropagation()} onClick={toggleFlip}>CLICK CARD / 返回</button>
            </section>
          </div>
        </div>
        <svg className="identity-badge__rope identity-badge__rope--front" viewBox="0 0 260 220" aria-hidden="true">
          <path className="rope-shadow" d={getRopePath("left")} ref={ropeLeftShadowRef} />
          <path className="rope-face" d={getRopePath("left")} ref={ropeLeftFaceRef} />
        </svg>
      </div>
    </div>
  );
}
