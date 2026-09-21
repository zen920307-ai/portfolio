import { career, profile, projects, systemModules, vibeProjects, works } from "./data.js";
import { ipWorld } from "./ip-world.js";

// These two groups are intentionally stored as arrays so the generic admin can
// present every real popup block as a normal editable record.
export const contentDefaults = {
  ipWorld: [ipWorld],
  profileModal: [profile],
  careerStages: career,
  systemModules,
  projects,
  works,
  vibeProjects,
};
export const siteCopyDefaults = [
  { id: "about", title: "第一页 · 个人概览", eyebrow: "PRODUCT DESIGNER · DESIGNER & BUILDER", pageTitle: "ZEN.TANG", description: "十余年产品与体验设计经验：将复杂业务、设计系统与 AI 能力沉淀为可交付、可验证、可持续演进的产品体验。", buttonText: "查看设计履历", modal: { eyebrow: "PROFILE / 个人档案", title: "个人档案", description: "产品设计、设计系统与 AI 产品构建的工作方法与经历。" } },
  { id: "experience", title: "第二页 · 职业经历", eyebrow: "EXPERIENCE / CAREER PATH", pageTitle: "从设计界面，到推动产品体验。", description: "从视觉表达走向产品、系统与落地，持续把复杂问题变成清晰可执行的体验。", story: "十余年间，角色不断延展，但核心始终不变：厘清复杂问题，并将设计判断推进到真实产品。", modal: { eyebrow: "职业经历时间线 / 2015—至今", title: "四个阶段，一条成长路径。", description: "查看每个职业阶段的职责、方法与积累。" } },
  { id: "wanying", title: "第三页 · 万应低代码", eyebrow: "WANYING DESIGN SYSTEM", pageTitle: "让复杂产品，共享一套可执行的语言。", description: "万应低代码设计系统 · 从 Token、组件到治理的系统化构建实践", modal: { eyebrow: "WANYING / 05 MODULES", title: "设计系统全景", description: "浏览万应低代码设计系统的模块与案例画面。" } },
  { id: "projects", title: "第四页 · 代表项目", eyebrow: "SELECTED CASES / PRODUCT & UX", pageTitle: "从业务问题，到可验证的产品体验。", description: "选取不同复杂度的项目，呈现我如何定义问题、组织系统、设计关键体验，并将方案推进到交付与验证。", modal: { overview: "项目概述", inquiry: "调研与判断", leadership: "设计负责人的判断路径", ownership: "职责与范围", coreDesign: "核心设计动作", process: "设计推进过程", capability: "能力切片", outcome: "交付与可验证产出" } },
  { id: "graphic", title: "第五页 · 平面作品", eyebrow: "GRAPHIC ARCHIVE", pageTitle: "在界面之外，持续构建设计语言。", description: "从品牌视觉、海报与版式，到图形系统与动态实验——这些作品补足我在复杂产品之外，对多元视觉语言的组织与表达能力。", buttonText: "浏览完整作品", modal: { eyebrow: "GRAPHIC ARCHIVE", title: "视觉定格", description: "视觉作品归档与详细查看", detailFallback: "一张围绕图像、文字与情绪关系展开的视觉练习。", detailHint: "滚轮缩放 / 拖拽查看细节" } },
  { id: "vibe", title: "第六页 · Vibe Coding", eyebrow: "VIBE CODING / PRODUCT BUILDER LAB", pageTitle: "独立把产品假设推进为可运行体验。", description: "需求对话 → PRD → 调研回写 → 原型 / 设计稿 → 前端 / 后端 → 自测。AI 负责加速；问题判断、范围控制与验收标准仍由设计侧定义。这里展示的是已完成构建、可实际打开体验的个人产品。", modal: { pain: "痛点需求", approach: "解题思路", research: "群体调研", prdTitle: "需求对话之后，先写成同一份约束", pipeline: "从构想到可运行", notes: "落地过程中的关键决策", highlights: "可运行结果", stack: "技术栈", localTitle: "该作品仅提供本地体验版本", localDescription: "暂未开放公网体验。欢迎通过右上角「合作与交流」联系我，我会为你提供现场演示或体验版本。", later: "稍后再看", contact: "联系作者" } },
];
contentDefaults.siteCopy = siteCopyDefaults;
export const contentGroups = [
  { key: "profileModal", title: "第一页 · 个人档案弹窗", subtitle: "个人档案弹窗中的全部信息与说明" },
  { key: "careerStages", title: "第二页 · 职业经历弹窗", subtitle: "四个阶段 / 四栏的全部内容，逐栏编辑" },
  { key: "systemModules", title: "万应低代码", subtitle: "模块、说明与图片画廊" },
  { key: "projects", title: "项目管理", subtitle: "项目封面、字段与案例内容" },
  { key: "works", title: "平面作品", subtitle: "作品图、类型与创作说明" },
  { key: "vibeProjects", title: "Vibe Coding", subtitle: "产品原型、描述与链接" },
  { key: "siteCopy", title: "页面与弹窗文案", subtitle: "六个页面标题、说明文字与弹窗文案" },
];

const STORAGE_KEY = "zen-portfolio-content-v1";
const safeParse = (value) => { try { return JSON.parse(value); } catch { return null; } };
export const readLocalContent = () => safeParse(localStorage.getItem(STORAGE_KEY)) || {};
const isRecord = (value) => value && typeof value === "object" && !Array.isArray(value);
// Published content can lag behind a newly deployed UI schema. Keep the
// published edits, while retaining any fields the current UI still requires.
const mergeContentValue = (fallback, incoming) => {
  if (incoming === undefined) return fallback;
  if (Array.isArray(incoming)) {
    if (!Array.isArray(fallback)) return incoming;
    return incoming.map((entry, index) =>
      mergeContentValue(fallback[index], entry),
    );
  }
  if (isRecord(incoming)) {
    const base = isRecord(fallback) ? fallback : {};
    return Object.fromEntries(
      Object.keys({ ...base, ...incoming }).map((key) => [
        key,
        mergeContentValue(base[key], incoming[key]),
      ]),
    );
  }
  return incoming;
};
export const resolveContent = (overrides = readLocalContent()) => Object.fromEntries(
  Object.entries(contentDefaults).map(([key, items]) => {
    const legacyCopySource = key === "siteCopy" && overrides.siteCopy
      ? (Array.isArray(overrides.siteCopy) && overrides.siteCopy.length === 1 && !overrides.siteCopy[0]?.id
        ? overrides.siteCopy[0] : (!Array.isArray(overrides.siteCopy) ? overrides.siteCopy : null)) : null;
    const legacySiteCopy = legacyCopySource
      ? siteCopyDefaults.map((page) => {
        const legacy = legacyCopySource[page.id] || {};
        const { title: oldTitle, action: oldAction, modal: oldModal, ...rest } = legacy;
        return { ...page, ...rest, pageTitle: oldTitle || page.pageTitle, buttonText: oldAction || page.buttonText, modal: { ...page.modal, ...(oldModal || {}) } };
      }) : null;
    const incoming = legacySiteCopy || (Array.isArray(overrides[key]) ? overrides[key] : null);
    const list = incoming ? mergeContentValue(items, incoming) : items;
    // The user removed 食旅集; also migrate any older browser draft that
    // still predates the automatic-save fix.
    return [key, key === "vibeProjects" ? list.filter((item) => item.code !== "S-LJ") : list];
  }),
);
export const hasPublishedContent = (content) => Boolean(content && Object.keys(content).some((key) => Array.isArray(content[key])));
export const saveLocalContent = (content) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  window.dispatchEvent(new CustomEvent("portfolio:content-updated", { detail: content }));
};
export const resetLocalContent = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("portfolio:content-updated", { detail: {} }));
};

export async function loadPublishedContent() {
  try {
    // During local development, Vite proxies this request to the public site.
    // Production keeps the relative URL so GitHub Pages serves its own release.
    const source = import.meta.env.DEV
      ? "/api/published-content"
      : "/portfolio-content.json";
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.content || payload;
  } catch { return null; }
}

export async function syncPublishedContent(current = resolveContent()) {
  const published = await loadPublishedContent();
  if (!hasPublishedContent(published))
    return { available: false, changed: false, content: current };
  const next = resolveContent(published);
  if (JSON.stringify(current) === JSON.stringify(next))
    return { available: true, changed: false, content: current };
  saveLocalContent(next);
  return { available: true, changed: true, content: next };
}
