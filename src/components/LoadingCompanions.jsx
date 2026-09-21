import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MessageCircle, Send, X } from "lucide-react";
import { gsap } from "gsap";
import "./LoadingCompanions.css";
import BorderGlow from "./BorderGlow";
import companionPortrait from "../assets/companion-portrait.png";

const COMPANION_CHAT_ENDPOINT = import.meta.env.DEV
  ? "/api/companion-chat"
  : (import.meta.env.VITE_COMPANION_CHAT_ENDPOINT || "https://chat.zenslab.top/api/companion-chat");

const lines = [
  { speaker: "墩墩", text: "嗨，我是墩墩。旁边这只软乎乎的，是噗噗。" },
  { speaker: "噗噗", text: "我们是拯原创的两小只，今天负责迎接你！" },
  { speaker: "墩墩", text: "加载有点慢……我已经盯着进度条很久了。", ready: "准备好啦！门开着，想进去随时都可以。" },
  { speaker: "噗噗", text: "趁这个空当，和我们聊聊拯拯好不好？" },
  { speaker: "墩墩", text: "问作品可以。问我的帽子链接……这是私藏。" },
  { speaker: "噗噗", text: "他做设计，也把脑袋里的点子做成小产品！" },
  { speaker: "墩墩", text: "别看我一脸淡定，有人来我还是很开心的。" },
  { speaker: "噗噗", text: "想听拯拯的经历？点下面，我们慢慢讲。" },
  { speaker: "墩墩", text: "这里的作品都有故事，你想先拆开哪一个？" },
  { speaker: "噗噗", text: "可以问：拯拯最擅长解决什么设计问题？" },
  { speaker: "墩墩", text: "噗噗负责热情，我负责……保持酷酷的。" },
  { speaker: "噗噗", text: "其实他刚刚偷偷练了三遍“欢迎光临”！" },
];

const FALLBACK_FOLLOWUPS = ["他最擅长解决什么设计问题？", "他做过哪些 AI 产品？", "有哪些代表作品？", "他怎么把点子变成小产品？", "他的经历里最特别的是哪段？", "他的设计方法有什么特点？"];

export default function LoadingCompanions({ canEnter }) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkingTurn, setThinkingTurn] = useState(0);
  const [followups, setFollowups] = useState([]);
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const dialog = useRef(null);
  const input = useRef(null);
  const trigger = useRef(null);
  const log = useRef(null);
  const request = useRef(null);
  const typeTimer = useRef(null);
  const bubble = useRef(null);
  const portrait = useRef(null);
  useEffect(() => {
    if (open) return;
    const timer = setInterval(() => setStep(n => (n + 1) % lines.length), 5200);
    return () => clearInterval(timer);
  }, [open]);
  useEffect(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      if (open) return;
      gsap.timeline().fromTo(bubble.current, { autoAlpha: 0, y: 14, scale: .82, rotation: step % 2 ? -4 : 4 }, { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: .65, ease: "back.out(1.8)" })
        .fromTo(bubble.current.querySelector("path"), { strokeDashoffset: 900 }, { strokeDashoffset: 0, duration: .8 }, 0)
        .to(bubble.current, { autoAlpha: 0, y: -8, scale: .96, duration: .3 }, 4.85);
    });
    return () => motion.revert();
  }, [step, open]);
  useEffect(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      if (!open) gsap.to(trigger.current, { y: -5, rotation: -1.5, duration: .8, repeat: -1, yoyo: true, repeatDelay: .8, ease: "sine.inOut" });
      else {
        // Parent opacity would isolate the backdrop and disable glass during entry.
        gsap.fromTo(dialog.current, { y: 28, scale: .94 }, { y: 0, scale: 1, duration: .5, ease: "back.out(1.2)" });
        gsap.fromTo(portrait.current, { y: 25, rotation: -9, opacity: 0 }, { y: 0, rotation: -3, opacity: 1, delay: .15, duration: .8, ease: "elastic.out(1,.6)" });
        gsap.fromTo(dialog.current.querySelectorAll(".companion-suggestions button"), { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: .08, delay: .25, duration: .4 });
      }
    });
    return () => motion.revert();
  }, [open]);
  useEffect(() => () => { request.current?.abort(); clearInterval(typeTimer.current); }, []);
  useEffect(() => {
    if (open) { dialog.current.show(); input.current?.focus(); }
    else if (dialog.current.open) { dialog.current.close(); trigger.current?.focus(); }
  }, [open]);
  // 非模态对话框没有原生 Esc 关闭，自己接管
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, busy, error]);
  async function send(event, override) {
    if (event?.preventDefault) event.preventDefault();
    const text = (override ?? draft).trim();
    if (!text || busy || request.current) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next); setDraft(""); setError(""); setBusy(true); setFollowups([]); setThinkingTurn(n => n + 1);
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetch(COMPANION_CHAT_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-12), speaker: (thinkingTurn + 1) % 2 ? "墩墩" : "噗噗" }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "暂时没连上，再试一次吧。");
      if (!result.reply) throw new Error("刚才走神了，再问我们一次吧。");
      let fu = Array.isArray(result.followups) ? result.followups.filter(q => typeof q === "string" && q.trim()).slice(0, 2) : [];
      if (fu.length < 2) {
        const pool = FALLBACK_FOLLOWUPS.filter(q => !fu.includes(q) && q !== text);
        while (fu.length < 2 && pool.length) fu.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      // 打字机：回复逐字揭示，打完再放追问
      const full = result.reply, base = next, speaker = result.speaker;
      setTyping(true);
      let i = 0;
      clearInterval(typeTimer.current);
      typeTimer.current = setInterval(() => {
        i = Math.min(i + 2, full.length);
        setMessages([...base, { role: "assistant", content: full.slice(0, i), speaker }]);
        if (i >= full.length) {
          clearInterval(typeTimer.current); typeTimer.current = null;
          setTyping(false); setFollowups(fu); setBusy(false);
        }
      }, 26);
    } catch (err) {
      clearInterval(typeTimer.current); typeTimer.current = null; setTyping(false);
      setMessages(next.slice(0, -1)); setDraft(text);
      setError(err.name === "AbortError" ? "这次等得有点久，问题已保留，可以重试。" : err.message);
      setBusy(false);
    } finally { clearTimeout(timeout); request.current = null; }
  }
  const line = lines[step];
  const copy = canEnter && line.ready ? line.ready : line.text;
  return <>
    <aside hidden={open} className="loading-companions" aria-label="墩墩和噗噗的欢迎语">
      <img className="loading-companions__image" src="/assets/dundun-pupu.webp" width="401" height="2172" alt="原创 IP 墩墩和噗噗从屏幕右侧探出头" />
      <div className={`loading-companions__invite ${line.speaker === "墩墩" ? "is-dundun" : "is-pupu"}`}>
        <div ref={bubble} className="companion-bubble">
          <svg viewBox="0 0 300 145" preserveAspectRatio="none" aria-hidden="true"><path d="M26 8 Q8 8 8 28 L8 103 Q8 123 29 123 L244 123 Q264 126 289 140 L279 114 Q292 109 292 91 L292 29 Q292 8 272 8 Z" /></svg>
          <div><small>{line.speaker}<span>说</span></small><p>{copy}</p></div>
        </div>
      </div>
      <div className="companion-chat-dock"><button ref={trigger} className="companion-chat-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog"><MessageCircle size={20} aria-hidden="true" /><span>和我们聊一聊</span><span className="companion-trigger-arrow" aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2.4} /></span></button><small>关于拯拯的好奇心，我们接住</small></div>
    </aside>
    <dialog ref={dialog} className="companion-chat" aria-labelledby="companion-chat-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <div ref={portrait} className="companion-chat__peek-wrap"><img className="companion-chat__peek" src={companionPortrait} alt="墩墩和噗噗的完整合照" width="240" height="180" /></div>
      <div className="companion-chat__panel"><header><div><h2 id="companion-chat-title">墩墩 & 噗噗 <span>的小小会客室</span></h2></div><button aria-label="关闭聊天" onClick={() => setOpen(false)}><X size={19} /></button></header>

      {!messages.length && <div className="companion-chat__welcome"><BorderGlow className="companion-welcome-card" backgroundColor="rgba(40,35,23,.28)" glowColor="42 74 60" colors={["#f5d989", "#d9b65d", "#b08a45"]} borderRadius={16} glowRadius={26} glowIntensity={0.9} edgeSensitivity={30} coneSpread={25} fillOpacity={0.35} animated><div className="companion-chat__welcome-copy"><h3>你负责好奇，<br />我们负责聊。</h3><p>墩墩和噗噗，是我创造的两只原创 IP。<br />你想先听哪一件？</p></div><div className="companion-welcome-badges"><img src="/assets/ip-dundun-ticket.webp" alt="墩墩的工牌" /><img src="/assets/ip-pupu-ticket.webp" alt="噗噗的工牌" /></div></BorderGlow></div>}
      <div ref={log} className="companion-chat__log" role="log" aria-live="polite" aria-relevant="additions text">
        <p className="companion-message">来啦！我们都在。想聊他的作品，还是听听他把点子变成小产品的故事？</p>
        {!messages.length && <div className="companion-suggestions">{["介绍一下他", "有哪些代表作品？", "他做过哪些 AI 产品？"].map(q => <button key={q} onClick={() => send(null, q)}>{q}</button>)}</div>}
        {messages.map((m, i) => m.role === "user" ? <p key={i} className="companion-message is-user">{m.content}</p> : <div key={i} className={`companion-reply ${m.speaker === "噗噗" ? "is-pupu" : "is-dundun"}`}><img src={m.speaker === "噗噗" ? "/assets/ip-pupu-avatar.webp" : "/assets/ip-dundun-avatar.webp"} alt={m.speaker || "墩墩"} width="38" height="38" /><div><small>{m.speaker || "墩墩"}</small><p className={`companion-message${typing && i === messages.length - 1 ? " is-typing" : ""}`}>{m.content}</p></div></div>)}
        {!busy && followups.length > 0 && messages.at(-1)?.role === "assistant" && <div className="companion-followups">{followups.map(q => <button key={q} onClick={() => send(null, q)}><span aria-hidden="true">→</span>{q}</button>)}</div>}
        {busy && !typing && <div className="companion-thinking" role="status"><span>{thinkingTurn % 2 ? "墩墩正在思考怎么回答你" : "噗噗准备抢答"}</span><i /><i /><i /></div>}
        {error && <p className="companion-error" role="alert">{error}</p>}
      </div>
      <form onSubmit={send}><div><input ref={input} id="companion-question" aria-label="和两小只聊聊" value={draft} onChange={e => setDraft(e.target.value)} maxLength={1200} disabled={busy} placeholder="问问经历、作品或创作想法…" autoComplete="off" /><button type="submit" disabled={busy || !draft.trim()} aria-label="发送消息"><Send size={18} /></button></div></form>
      </div>
    </dialog>
  </>;
}
