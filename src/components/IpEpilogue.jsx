import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight, Shuffle } from "lucide-react";
import { ipWorld } from "../ip-world.js";
import TiltedCard from "./TiltedCard.jsx";
import "./IpEpilogue.css";

gsap.registerPlugin(ScrollTrigger);
export default function IpEpilogue() {
  const root = useRef(null);
  const conversation = useRef(null);
  const dialogueRoot = useRef(null);
  const backgroundVideo = useRef(null);
  const [flipped, setFlipped] = useState({});
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const toggleFlip = (index) => setFlipped(f => ({ ...f, [index]: !f[index] }));
  const dialogueSets = ipWorld.dialogueSets || [ipWorld.dialogue || []];
  const dialogue = dialogueSets[dialogueIndex] || dialogueSets[0];
  const nextDialogue = () => {
    setDialogueIndex((index) => {
      if (dialogueSets.length < 2) return index;
      const offset = 1 + Math.floor(Math.random() * (dialogueSets.length - 1));
      return (index + offset) % dialogueSets.length;
    });
    requestAnimationFrame(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rows = dialogueRoot.current?.querySelectorAll(".ip-dialogue-row");
      if (!rows?.length) return;
      gsap.killTweensOf(rows);
      gsap.fromTo(rows, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .32, stagger: .055, ease: "power2.out" });
    });
  };
  useLayoutEffect(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const rows = root.current.querySelectorAll(".ip-dialogue-row");
      const heading = root.current.querySelector(".ip-epilogue__heading");
      const footer = root.current.querySelector(".ip-epilogue__invitation");
      const timeline = gsap.timeline({ paused: true });
      timeline.from(heading, { y: 24, autoAlpha: 0, duration: .5, ease: "power3.out" });
      rows.forEach((row, index) => {
        timeline.fromTo(row, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .45, ease: "power2.out" }, .35 + index * .95)
          .fromTo(row.querySelector("img"), { scale: .55, rotation: index % 2 ? 12 : -12 }, { scale: 1, rotation: 0, duration: .7, ease: "back.out(2.3)" }, .35 + index * .95);
      });
      timeline.from(footer, { y: 16, autoAlpha: 0, duration: .65 }, 3.7);
      timeline.from(root.current.querySelector(".ip-character-notes"), { y: 18, autoAlpha: 0, duration: .8, ease: "power3.out" }, .3);
      conversation.current = timeline;
      ScrollTrigger.create({
        trigger: root.current, start: "top 65%", end: "bottom top",
        onEnter: () => timeline.timeScale(1).play(),
        onLeaveBack: () => timeline.timeScale(2.4).reverse(),
        onUpdate: (self) => {
          if (self.direction < 0 && root.current.getBoundingClientRect().top > window.innerHeight * .12) timeline.timeScale(2.4).reverse();
          else if (self.direction > 0) timeline.timeScale(1).play();
        },
      });
      return () => { conversation.current = null; };
    });
    return () => motion.revert();
  }, []);

  useEffect(() => {
    const video = backgroundVideo.current;
    const section = root.current;
    if (!video || !section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.2) video.play().catch(() => {});
      else video.pause();
    }, { threshold: [0, 0.2] });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return <section ref={root} id="dundun-pupu" className="chapter ip-epilogue" data-chapter="6" aria-labelledby="ip-epilogue-title">
    <div className="ip-epilogue__backdrop" aria-hidden="true">
      <video
        ref={backgroundVideo}
        className="ip-epilogue__background-video"
        loop
        muted
        playsInline
        preload="metadata"
      >
        <source src="/assets/video/ip-epilogue-loop-web.mp4" type="video/mp4" />
      </video>
    </div>
    <div className="ip-epilogue__body">
      <header className="ip-epilogue__heading"><p>07 / 谢谢你，发现这个彩蛋</p><h2 id="ip-epilogue-title">没想到，<br /><span>你真的看到最后了。</span></h2><div>谢谢你把时间留给我的作品。<br />正式介绍结束，再带你认识两位我亲手创造的小伙伴。</div></header>
      <div ref={dialogueRoot} className="ip-dialogue" aria-label="墩墩和噗噗的彩蛋对话" aria-live="polite">
        {dialogue.map((line, index) => <div key={line.name + index} className={`ip-dialogue-row ${line.name === "噗噗" ? "is-pupu" : "is-dundun"}`}>
          <img src={line.name === "墩墩" ? "/assets/ip-dundun-avatar.webp" : "/assets/ip-pupu-avatar.webp"} alt={line.name} width="64" height="64" loading="lazy" />
          <div><small><b>{line.name}</b><span>{line.aside}</span></small><p>{line.text}</p></div>
        </div>)}
      </div>
      <div className="ip-epilogue__invitation"><p>如果你也有一点喜欢它们，欢迎来串个门。</p><div className="ip-epilogue__actions"><a href={ipWorld.home} target="_blank" rel="noopener noreferrer">去两小只家坐坐 <ArrowUpRight size={20} /></a><button type="button" onClick={nextDialogue} aria-label="再拆一个彩蛋"><Shuffle size={16} /><span>再拆一个彩蛋</span></button></div></div>
    </div>
    <aside className="ip-character-notes" aria-label="原创 IP 角色介绍">
      <div className="ip-character-portrait"><span className="ip-original-label">原创 IP 设计<small>ORIGINAL CHARACTERS</small></span><img src="/assets/ip-duo-cool.webp" alt="戴着墨镜的墩墩和噗噗合照" width="600" height="448" loading="lazy" /></div>
      <div className="ip-character-content"><h3>一个嗜睡，一个不累。<span>刚好凑成一对。</span></h3>
      {ipWorld.characters.map((character, index) => (
        <TiltedCard
          key={character.en}
          className="ip-character-tilt"
          containerHeight="auto"
          containerWidth="100%"
          rotateAmplitude={6}
          scaleOnHover={1.04}
          showMobileWarning={false}
          showTooltip={false}
        >
          <article
            className={`${index === 0 ? "is-dundun" : "is-pupu"}${flipped[index] ? " is-flipped" : ""}`}
            onClick={() => toggleFlip(index)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleFlip(index); } }}
            tabIndex={0}
            role="button"
            aria-pressed={!!flipped[index]}
            aria-label={`${character.name}的介绍卡片，点击翻转查看证件照`}
          >
            <div className="ip-card-face ip-card-face--front">
              <img className="ip-character-ticket" src={index === 0 ? "/assets/ip-dundun-ticket.webp" : "/assets/ip-pupu-ticket.webp"} alt={`${character.name}的登机牌设计`} width="110" height="140" loading="eager" />
              <div className="ip-character-bio">
                <div className="ip-boarding-heading"><span>BOARDING PASS</span><b>0{index + 1}</b></div>
                <header><small>0{index + 1}</small><h4>{character.name}</h4><span>{character.en}</span></header>
                <span className="ip-character-trait">{index === 0 ? "重度嗜睡" : "活力满格"}</span>
                <strong>{character.tagline}</strong>
                <p>{character.description}</p>
                <div className="ip-boarding-route"><span>{index === 0 ? "NAP" : "JOY"}</span><span aria-hidden="true">→</span><span>HOME</span><i aria-hidden="true" /></div>
              </div>
            </div>
            <div className="ip-card-face ip-card-face--back" aria-hidden={!flipped[index]}>
              <img className="ip-character-id-photo" src={index === 0 ? "/assets/ip-dundun-avatar.webp" : "/assets/ip-pupu-avatar.webp"} alt={`${character.name}的证件照`} />
              <span className="ip-id-label">{index === 0 ? "DUNDUN / 证件护照" : "PUPU / 证件护照"}</span>
            </div>
          </article>
        </TiltedCard>
      ))}
      <footer>拯拯原创 · 两小只的日常</footer></div>
    </aside>
    <div className="ip-epilogue__credit" aria-hidden="true">DUNDUN & PUPU <span>有点困，也有点可爱。</span></div>
  </section>;
}
