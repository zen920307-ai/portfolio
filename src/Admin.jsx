import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CloudUpload,
  ImagePlus,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  contentGroups,
  resetLocalContent,
  resolveContent,
  saveLocalContent,
  syncPublishedContent,
} from "./content.js";

const N = {
  about: "第一页 / 个人概览",
  experience: "第二页 / 职业经历",
  wanying: "第三页 / 万应低代码",
  projects: "第四页 / 项目管理",
  graphic: "第五页 / 平面作品",
  vibe: "第六页 / Vibe Coding",
  profileModal: "个人档案弹窗内容",
  careerStages: "职业经历阶段",
  localModal: "本地体验提示弹窗",
  modal: "详情弹窗文案",
  id: "项目编号",
  code: "项目代号",
  index: "展示序号",
  type: "项目类型",
  title: "项目名称",
  subtitle: "副标题",
  role: "阶段角色",
  year: "完成时间",
  period: "项目周期",
  status: "项目状态",
  scope: "工作范围",
  collaboration: "协作说明",
  image: "封面图片",
  src: "作品图片",
  gallery: "项目界面图集",
  introVideo: "视频介绍",
  link: "产品访问链接",
  tags: "项目标签",
  keywords: "作品关键词",
  highlights: "可运行结果",
  metrics: "关键指标",
  meta: "基础信息",
  overview: "项目概述",
  brief: "卡片简介",
  description: "项目说明",
  goal: "项目目标",
  pain: "痛点需求",
  pains: "核心痛点",
  approach: "解题思路",
  ownership: "职责与范围",
  contribution: "个人贡献",
  contributionTags: "职责标签",
  contributionSplit: "职责分布",
  leadership: "设计负责人的判断路径",
  inquiry: "调研与判断",
  coreDesign: "核心设计动作",
  timeline: "设计推进过程",
  stack: "技术栈与工具",
  capabilities: "能力内容",
  outcome: "交付与可验证产出",
  outcomeBars: "成果可视化",
  details: "项目摘要",
  research: "群体调研",
  prd: "需求约束（PRD）",
  pipeline: "从构想到可运行",
  buildNotes: "落地过程中的关键设计决策",
  mediaType: "封面媒体类型",
  wechat: "微信体验",
  qr: "小程序二维码",
  hint: "扫码提示",
  caption: "模块说明",
  tabLabel: "中文模块名称",
  tabEn: "英文模块名称",
  detail: "模块详细说明",
  caseStyle: "详情展示样式",
  who: "调研对象",
  method: "调研方法",
  finding: "回写进 PRD",
  summary: "需求概要",
  requirements: "需求说明",
  architecture: "技术架构",
  step: "步骤编号",
  phase: "推进阶段",
  desc: "内容说明",
  label: "字段名称",
  value: "字段内容",
  rationale: "设计判断",
  solution: "具体解法",
  impact: "产生影响",
  problem: "核心问题",
  insight: "关键洞察",
  action: "采取行动",
  proof: "验证依据",
  lens: "判断维度",
  thinking: "设计思考",
  obstacle: "关键约束",
  resolution: "设计决策",
  purpose: "设计目的",
  concept: "创意概念",
  craft: "设计处理",
  lead: "核心理念",
  intro: "判断路径说明",
  effects: "验证结果",
  judgment: "调研结论",
  methods: "调研样本",
  cares: "不同角色的关注点",
  ask: "他们关心什么",
  move: "我的解法",
  before: "调整前路径",
  after: "调整后路径",
  rails: "业务主线",
  name: "主线名称",
  nodes: "主线节点",
  layers: "内容层级",
  focus: "能力重点",
  funnel: "决策路径",
  pillars: "理念要点",
  sample: "样本数量",
  eyebrow: "英文眉题",
  modalEyebrow: "弹窗眉题",
  modalTitle: "弹窗标题",
  story: "补充说明",
  buttonText: "按钮文字",
  detailFallback: "默认作品简介",
  detailHint: "查看提示",
  prdTitle: "PRD 区域标题",
  notes: "关键决策区域标题",
  later: "取消按钮文字",
  contact: "联系按钮文字",
  heroName: "姓名标识",
  heroRole: "职业定位",
  heroLine: "个人简介",
  heroTags: "个人标签",
  cta: "按钮文案",
  stats: "数据摘要",
  info: "基本信息",
  philosophy: "设计理念",
  workflow: "设计方法",
  workflowDesc: "方法说明",
  beyond: "设计之外",
  now: "正在关注",
  nowSignal: "关注标签",
  nowTags: "当前主题",
  signature: "个人签名",
  version: "阶段编号",
  stage: "阶段名称",
  en: "英文说明",
  keyword: "阶段关键词",
  deliveries: "主要交付",
  lesson: "阶段收获",
  shift: "下一阶段变化",
  note: "阶段一句话",
  icon: "图标样式",
  group: "内容分类",
  items: "分类条目",
  key: "主题名称",
};
const ROOT_ORDER = {
  profileModal: [
    "heroName",
    "heroRole",
    "heroLine",
    "heroTags",
    "cta",
    "stats",
    "info",
    "philosophy",
    "capabilities",
    "timeline",
    "workflow",
    "workflowDesc",
    "stack",
    "beyond",
    "now",
    "nowSignal",
    "nowTags",
    "signature",
  ],
  careerStages: [
    "version",
    "role",
    "period",
    "note",
    "stage",
    "en",
    "keyword",
    "overview",
    "focus",
    "deliveries",
    "lesson",
    "shift",
  ],
  systemModules: [
    "index",
    "title",
    "tabLabel",
    "tabEn",
    "caption",
    "description",
    "detail",
    "image",
    "gallery",
    "tags",
  ],
  projects: [
    "id",
    "code",
    "type",
    "title",
    "role",
    "brief",
    "image",
    "gallery",
    "caseStyle",
    "meta",
    "metrics",
    "overview",
    "inquiry",
    "leadership",
    "ownership",
    "contributionTags",
    "contributionSplit",
    "coreDesign",
    "timeline",
    "capabilities",
    "stack",
    "outcome",
    "outcomeBars",
    "details",
  ],
  works: [
    "title",
    "type",
    "src",
    "brief",
    "purpose",
    "concept",
    "craft",
    "keywords",
  ],
  vibeProjects: [
    "index",
    "code",
    "title",
    "subtitle",
    "tags",
    "image",
    "mediaType",
    "introVideo",
    "wechat",
    "description",
    "pain",
    "approach",
    "research",
    "prd",
    "pipeline",
    "buildNotes",
    "highlights",
    "stack",
    "link",
  ],
};
const imageKeys = new Set(["image", "src", "gallery", "qr"]);
const longKeys = new Set([
  "overview",
  "brief",
  "description",
  "goal",
  "ownership",
  "contribution",
  "outcome",
  "purpose",
  "concept",
  "craft",
  "detail",
  "lead",
  "intro",
  "thinking",
  "obstacle",
  "resolution",
  "rationale",
  "solution",
  "impact",
  "problem",
  "insight",
  "action",
  "proof",
  "desc",
  "finding",
  "summary",
]);
const name = (key) => N[key] || key;
const updateAt = (obj, path, val) => {
  if (!path.length) return val;
  const [head, ...tail] = path;
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  out[head] = updateAt(obj?.[head], tail, val);
  return out;
};
const publishSteps = ["本地草稿", "GitHub 提交", "Pages 同步", "域名验证"];
const GITHUB_REPOSITORY = "zen920307-ai/portfolio";
const GITHUB_BRANCH = "gh-pages";
const PUBLISHED_FILE = "portfolio-content.json";
const encodeJsonBase64 = (value) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(value))));
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
const convertUploadImage = async (file) => {
  // Keep vector, animation, QR and already-optimized WebP files untouched.
  // Canvas encoding would flatten SVG/GIF and can make a QR code unreliable.
  if (!/^(image\/(jpeg|png|avif))$/.test(file.type) || /(?:qr|qrcode|二维码)/i.test(file.name)) {
    return { file, converted: false };
  }
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 2560;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d", { alpha: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    // WebP is only useful here when it is actually smaller than the source.
    if (!blob || blob.size >= file.size) return { file, converted: false };
    const stem = file.name.replace(/\.[^.]+$/, "") || "image";
    return {
      file: new File([blob], `${stem}.webp`, { type: "image/webp", lastModified: Date.now() }),
      converted: true,
    };
  } finally {
    bitmap.close?.();
  }
};
const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const collectUploadMarkers = (value, markers = new Set()) => {
  if (typeof value === "string" && value.startsWith("cms-upload:"))
    markers.add(value);
  else if (Array.isArray(value))
    value.forEach((entry) => collectUploadMarkers(entry, markers));
  else if (value && typeof value === "object")
    Object.values(value).forEach((entry) =>
      collectUploadMarkers(entry, markers),
    );
  return markers;
};
const replaceUploadMarkers = (value, replacements) => {
  if (typeof value === "string") return replacements[value] || value;
  if (Array.isArray(value))
    return value.map((entry) => replaceUploadMarkers(entry, replacements));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceUploadMarkers(entry, replacements),
      ]),
    );
  return value;
};

async function verifyDomainRelease(revision, attempts = 12) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await pause(attempt ? 2500 : 900);
    try {
      const response = await fetch(
        `/${PUBLISHED_FILE}?revision=${encodeURIComponent(revision)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (response.ok && payload?.publication?.revision === revision)
        return true;
    } catch {
      /* GitHub Pages is still publishing the new commit. */
    }
  }
  return false;
}
async function verifyPublishedAsset(path, attempts = 72, onProbe = () => {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await pause(attempt ? 2500 : 900);
    try {
      const response = await fetch(`${path}?publish-check=${Date.now()}`, {
        cache: "no-store",
      });
      if (
        response.ok &&
        response.headers.get("content-type")?.startsWith("image/")
      )
        return true;
    } catch {
      /* Pages has not exposed this asset yet. */
    }
    onProbe(attempt + 1);
  }
  return false;
}

function PublishProgress({ state, token }) {
  const active = state.phase === "idle" ? (token ? 0 : -1) : state.step;
  return (
    <section
      className={`cms-publish cms-publish--${state.phase}`}
      aria-label="发布进度"
    >
      <div className="cms-publish__summary">
        <span className="cms-publish__icon">
          {state.phase === "publishing" ? (
            <LoaderCircle size={17} />
          ) : state.phase === "error" ? (
            <CircleAlert size={17} />
          ) : (
            <CloudUpload size={17} />
          )}
        </span>
        <div>
          <small>LIVE DELIVERY</small>
          <strong>{state.label}</strong>
        </div>
      </div>
      <ol>
        {publishSteps.map((step, index) => (
          <li
            key={step}
            className={
              index < active
                ? "is-complete"
                : index === active
                  ? "is-active"
                  : ""
            }
          >
            <i>{index < active ? <Check size={12} /> : index + 1}</i>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p>
        {state.detail ||
          (token
            ? "保存后会提交至 GitHub Pages 发布分支，并验证 design.zenslab.top。"
            : "填写 GitHub 发布令牌后，保存更新会推送到 design.zenslab.top。")}
      </p>
    </section>
  );
}

function Pictures({ value, onChange, onUpload, resolvePreview }) {
  const files = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="cms-image-field">
      <div className="cms-image-grid">
        {files.length ? (
          files.map((src, i) => (
            <figure key={`${src}-${i}`}>
              <img src={resolvePreview(src)} alt="已选择图片" />
              <button
                type="button"
                onClick={() =>
                  onChange(
                    Array.isArray(value) ? value.filter((_, n) => n !== i) : "",
                  )
                }
              >
                移除
              </button>
            </figure>
          ))
        ) : (
          <div className="cms-image-empty">
            <ImagePlus size={22} />
            尚未上传图片
          </div>
        )}
      </div>
      <label className="cms-image-upload">
        <Upload size={16} />
        选择图片
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            onUpload(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      </label>
    </div>
  );
}
function Tags({ value, onChange }) {
  return (
    <div className="cms-tag-editor">
      {value.map((x, i) => (
        <span key={`${x}-${i}`}>
          {x}
          <button
            type="button"
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        aria-label="添加一项"
        placeholder="输入后按回车添加"
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value.trim()) {
            e.preventDefault();
            onChange([...value, e.currentTarget.value.trim()]);
            e.currentTarget.value = "";
          }
        }}
      />
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  onUpload,
  path,
  depth = 0,
  resolvePreview,
}) {
  if (
    imageKeys.has(label) &&
    (typeof value === "string" || Array.isArray(value))
  )
    return (
      <div className="cms-control cms-control--wide">
        <div className="cms-control__label">{name(label)}</div>
        <Pictures
          value={value}
          onChange={onChange}
          onUpload={(file) => onUpload(path, file)}
          resolvePreview={resolvePreview}
        />
      </div>
    );
  if (Array.isArray(value)) {
    if (value.every((x) => typeof x === "string" || typeof x === "number"))
      return (
        <div className="cms-control cms-control--wide">
          <div className="cms-control__label">
            {name(label)}
            <small>输入后按回车添加</small>
          </div>
          <Tags value={value.map(String)} onChange={onChange} />
        </div>
      );
    return (
      <section className="cms-section">
        <header>
          <span>{name(label)}</span>
          <small>{value.length} 项内容</small>
        </header>
        {value.map((entry, i) => (
          <div className="cms-repeat-card" key={i}>
            {Array.isArray(entry) ? (
              <div className="cms-pair">
                {entry.map((cell, j) => (
                  <Field
                    key={j}
                    label={j === 0 ? "label" : "value"}
                    value={cell}
                    onChange={(next) =>
                      onChange(
                        value.map((row, n) =>
                          n === i
                            ? row.map((x, k) => (k === j ? next : x))
                            : row,
                        ),
                      )
                    }
                    onUpload={onUpload}
                    path={[...path, i, j]}
                    resolvePreview={resolvePreview}
                  />
                ))}
              </div>
            ) : (
              <Fields
                value={entry}
                onChange={(next) =>
                  onChange(value.map((x, n) => (n === i ? next : x)))
                }
                onUpload={onUpload}
                path={[...path, i]}
                depth={depth + 1}
                resolvePreview={resolvePreview}
              />
            )}
          </div>
        ))}
      </section>
    );
  }
  if (value && typeof value === "object")
    return (
      <section className="cms-section cms-section--highlight">
        <header>
          <span>{name(label)}</span>
          <small>逐项填写即可</small>
        </header>
        <Fields
          value={value}
          onChange={onChange}
          onUpload={onUpload}
          path={path}
          depth={depth + 1}
          resolvePreview={resolvePreview}
        />
      </section>
    );
  if (label === "caseStyle")
    return (
      <label className="cms-control">
        <span className="cms-control__label">{name(label)}</span>
        <select
          value={value ?? "website"}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="mobile">移动端体验</option>
          <option value="admin">企业管理平台</option>
          <option value="website">官网案例</option>
        </select>
      </label>
    );
  if (label === "mediaType")
    return (
      <label className="cms-control">
        <span className="cms-control__label">{name(label)}</span>
        <select
          value={value ?? "image"}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="image">图片</option>
          <option value="video">视频</option>
        </select>
      </label>
    );
  const long = longKeys.has(label) || String(value ?? "").length > 70;
  return (
    <label className={`cms-control${long ? " cms-control--wide" : ""}`}>
      <span className="cms-control__label">{name(label)}</span>
      {long ? (
        <textarea
          rows={4}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
function Fields({
  value,
  onChange,
  onUpload,
  path = [],
  depth,
  order = [],
  hideKeys = [],
  resolvePreview,
}) {
  const entries = Object.entries(value)
    .filter(([key]) => !hideKeys.includes(key))
    .sort(
      ([a], [b]) =>
        (order.indexOf(a) < 0 ? 999 : order.indexOf(a)) -
        (order.indexOf(b) < 0 ? 999 : order.indexOf(b)),
    );
  return (
    <div className={`cms-fields cms-fields--depth-${Math.min(depth, 2)}`}>
      {entries.map(([key, val]) => (
        <Field
          key={key}
          label={key}
          value={val}
          onChange={(next) => onChange({ ...value, [key]: next })}
          onUpload={onUpload}
          path={[...path, key]}
          depth={depth}
          resolvePreview={resolvePreview}
        />
      ))}
    </div>
  );
}

export function Admin() {
  const [content, setContent] = useState(() => resolveContent());
  const [token, setToken] = useState(
    () =>
      localStorage.getItem("portfolio-admin-token") ||
      sessionStorage.getItem("portfolio-admin-token") ||
      "",
  );
  const [group, setGroup] = useState("systemModules");
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState("正在编辑本地草稿");
  const [pendingDelete, setPendingDelete] = useState(false);
  const [lastPublishedGroup, setLastPublishedGroup] = useState("");
  const [lastSavedGroup, setLastSavedGroup] = useState("");
  const [pendingUploads, setPendingUploads] = useState({});
  const keepSyncStatus = useRef(false);
  const onlineCheckId = useRef(0);
  const onlineToastTimer = useRef(0);
  const [onlineCheck, setOnlineCheck] = useState({
    phase: "checking",
    label: "正在检测线上版本…",
    detail: "正在读取 design.zenslab.top 的已发布内容。",
    toast: false,
  });
  const [publish, setPublish] = useState({
    phase: "idle",
    step: 0,
    label: "等待发布",
    detail:
      "模块保存只留在本机；右上角「保存并发布」才会推送到 design.zenslab.top。",
  });
  const items = content[group] || [];
  const item = items[selected] || {};
  useEffect(
    () => setSelected((i) => Math.min(i, Math.max(0, items.length - 1))),
    [group, items.length],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        contentGroups.map((x) => [x.key, content[x.key]?.length || 0]),
      ),
    [content],
  );
  useEffect(() => {
    if (token) localStorage.setItem("portfolio-admin-token", token);
  }, [token]);
  const checkOnlineVersion = async () => {
    const checkId = ++onlineCheckId.current;
    window.clearTimeout(onlineToastTimer.current);
    setOnlineCheck({
      phase: "checking",
      label: "正在检测线上版本…",
      detail: "正在读取 design.zenslab.top 的已发布内容。",
      toast: false,
    });
    const result = await syncPublishedContent(content);
    if (checkId !== onlineCheckId.current) return;
    if (!result.available) {
      setOnlineCheck({
        phase: "error",
        label: "暂时无法读取线上版本",
        detail: "请检查网络后重新检测；本机草稿未被修改。",
        toast: true,
      });
      return;
    }
    if (result.changed) keepSyncStatus.current = true;
    setContent(result.content);
    const next = result.changed
      ? {
          phase: "updated",
          label: "已同步到线上最新版本",
          detail: "检测到线上内容更新，全部字段已同步到本机后台。",
          toast: true,
        }
      : {
          phase: "current",
          label: "本机内容已是线上最新版本",
          detail: "本机草稿与 design.zenslab.top 当前发布数据一致。",
          toast: true,
        };
    setOnlineCheck(next);
    setStatus(next.detail);
    onlineToastTimer.current = window.setTimeout(() => {
      setOnlineCheck((state) => ({ ...state, toast: false }));
    }, 5600);
  };
  useEffect(() => {
    checkOnlineVersion();
    return () => {
      onlineCheckId.current += 1;
      window.clearTimeout(onlineToastTimer.current);
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveLocalContent(content);
      if (keepSyncStatus.current) {
        keepSyncStatus.current = false;
        return;
      }
      setStatus("本地草稿已自动保存");
    }, 260);
    return () => window.clearTimeout(timer);
  }, [content]);
  const update = (path, val) =>
    setContent((all) => ({
      ...all,
      [group]: all[group].map((entry, i) =>
        i === selected ? updateAt(entry, path, val) : entry,
      ),
    }));
  const resolvePreview = (src) => pendingUploads[src]?.previewUrl || src;
  const upload = async (path, file) => {
    if (!file || !file.type.startsWith("image/")) {
      setStatus("请选择图片文件");
      return;
    }
    setStatus(`正在为「${file.name}」准备适合网页加载的版本…`);
    let prepared;
    try {
      prepared = await convertUploadImage(file);
    } catch {
      prepared = { file, converted: false };
    }
    const uploadFile = prepared.file;
    const old = path.reduce((x, key) => x?.[key], item);
    const marker = `cms-upload:${crypto.randomUUID()}`;
    const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    setPendingUploads((all) => ({
      ...all,
      [marker]: {
        file: uploadFile,
        previewUrl: URL.createObjectURL(uploadFile),
        remotePath: `assets/admin-uploads/${group}/${crypto.randomUUID()}-${safeName}`,
      },
    }));
    update(path, Array.isArray(old) ? [...old, marker] : marker);
    setStatus(
      `已选择「${uploadFile.name}」${prepared.converted ? "，已转为 WebP" : ""}；仅在本机草稿预览，点击右上角「保存并发布」时才会上传。`,
    );
    setPublish({
      phase: "idle",
      step: 0,
      label: "有待发布图片",
      detail: "图片正在本机预览，尚未向 GitHub 或线上域名发送任何请求。",
    });
  };
  const save = async () => {
    saveLocalContent(content);
    if (!token) {
      const detail = "本地草稿已保存；请填写 GitHub 发布令牌后再推送线上。";
      setStatus(detail);
      setPublish({ phase: "error", step: 0, label: "等待发布令牌", detail });
      return;
    }
    const publication = {
      revision: crypto.randomUUID(),
      publishedAt: new Date().toISOString(),
      target: "https://design.zenslab.top",
    };
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    };
    const complete = (publishedAt) => {
      const time = new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(publishedAt));
      const detail = `已于 ${time} 推送并验证 design.zenslab.top。`;
      setLastPublishedGroup(group);
      setStatus(detail);
      setPublish({ phase: "success", step: 3, label: "域名已验证", detail });
    };
    try {
      setStatus("正在读取 GitHub Pages 发布分支…");
      setPublish({
        phase: "publishing",
        step: 1,
        label: "正在创建 GitHub 提交",
        detail: "正在将这次保存写入 gh-pages 发布分支。",
      });
      const endpoint = `https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/${PUBLISHED_FILE}`;
      const current = await fetch(`${endpoint}?ref=${GITHUB_BRANCH}`, {
        headers,
      });
      let sha = "";
      if (current.ok) sha = (await current.json()).sha;
      else if (current.status !== 404) throw Error("无法读取 GitHub 发布分支");
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Publish portfolio content ${publication.publishedAt}`,
          content: encodeJsonBase64({ content, publication }),
          branch: GITHUB_BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "GitHub 未接受本次提交");
      setPublish({
        phase: "publishing",
        step: 2,
        label: "GitHub 已提交，线上同步中",
        detail:
          "GitHub Pages 正在更新 design.zenslab.top，后台会继续自动验证。",
      });
      setStatus("GitHub 提交成功，正在等待线上同步…");
      const verified = await verifyDomainRelease(publication.revision);
      if (verified) {
        complete(publication.publishedAt);
        return;
      }
      const detail =
        "GitHub 已提交，GitHub Pages 仍在同步；后台会继续自动验证，请勿重复保存。";
      setStatus(detail);
      setPublish({ phase: "publishing", step: 2, label: "线上同步中", detail });
      verifyDomainRelease(publication.revision, 72).then((isLive) => {
        if (isLive) complete(publication.publishedAt);
        else {
          const delayed =
            "GitHub 提交已成功，但线上同步超过 3 分钟；可稍后刷新确认。";
          setStatus(delayed);
          setPublish({
            phase: "error",
            step: 2,
            label: "同步延迟",
            detail: delayed,
          });
        }
      });
    } catch (error) {
      const detail = `发布未完成：${error.message || "请检查 GitHub 发布令牌权限"}`;
      setStatus(detail);
      setPublish({ phase: "error", step: 1, label: "发布需要处理", detail });
    }
  };
  const publishAll = async () => {
    saveLocalContent(content);
    if (!token) {
      const detail = "本地草稿已保存；请填写 GitHub 发布令牌后再推送线上。";
      setStatus(detail);
      setPublish({ phase: "error", step: 0, label: "等待发布令牌", detail });
      return;
    }
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    };
    const markers = [...collectUploadMarkers(content)].filter(
      (marker) => pendingUploads[marker],
    );
    let publishedContent = content;
    try {
      for (let index = 0; index < markers.length; index += 1) {
        const marker = markers[index];
        const pending = pendingUploads[marker];
        setStatus(
          `正在上传图片 ${index + 1}/${markers.length}：${pending.file.name}`,
        );
        setPublish({
          phase: "publishing",
          step: 1,
          label: `正在上传图片 ${index + 1}/${markers.length}`,
          detail: "图片会先上传并验证线上可读，再提交文案，避免裂图。",
        });
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/${pending.remotePath}`,
          {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `Upload portfolio image ${pending.file.name}`,
              content: await fileToBase64(pending.file),
              branch: GITHUB_BRANCH,
            }),
          },
        );
        const result = await response.json();
        if (!response.ok) throw Error(result.message || "图片上传失败");
        const onlineUrl = `/${pending.remotePath}`;
        setPublish({
          phase: "publishing",
          step: 2,
          label: `验证图片 ${index + 1}/${markers.length}`,
          detail: "GitHub 已接收图片，正在验证 design.zenslab.top 是否已可读。",
        });
        const available = await verifyPublishedAsset(onlineUrl, 72, (probe) =>
          setStatus(
            `图片 ${index + 1}/${markers.length} 正在等待线上可读（第 ${probe} 次）…`,
          ),
        );
        if (!available)
          throw Error(`图片「${pending.file.name}」尚未上线，未提交内容引用`);
        publishedContent = replaceUploadMarkers(publishedContent, {
          [marker]: onlineUrl,
        });
      }
      const publication = {
        revision: crypto.randomUUID(),
        publishedAt: new Date().toISOString(),
        target: "https://design.zenslab.top",
      };
      setStatus("图片已就绪，正在提交全部文案与内容…");
      setPublish({
        phase: "publishing",
        step: 1,
        label: "正在创建 GitHub 提交",
        detail: "正在将所有本机草稿写入 gh-pages 发布分支。",
      });
      const endpoint = `https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/${PUBLISHED_FILE}`;
      const current = await fetch(`${endpoint}?ref=${GITHUB_BRANCH}`, {
        headers,
      });
      let sha = "";
      if (current.ok) sha = (await current.json()).sha;
      else if (current.status !== 404) throw Error("无法读取 GitHub 发布分支");
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Publish portfolio content ${publication.publishedAt}`,
          content: encodeJsonBase64({ content: publishedContent, publication }),
          branch: GITHUB_BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "GitHub 未接受本次提交");
      setStatus("GitHub 提交成功，正在验证线上内容…");
      setPublish({
        phase: "publishing",
        step: 2,
        label: "GitHub 已提交，线上同步中",
        detail: "后台正在验证 design.zenslab.top 的内容版本。",
      });
      const verified = await verifyDomainRelease(publication.revision, 72);
      if (!verified)
        throw Error("GitHub 已提交，但域名在 3 分钟内未返回新版本");
      setContent(publishedContent);
      saveLocalContent(publishedContent);
      setPendingUploads((all) => {
        const next = { ...all };
        markers.forEach((marker) => {
          URL.revokeObjectURL(next[marker]?.previewUrl);
          delete next[marker];
        });
        return next;
      });
      setLastPublishedGroup(group);
      const detail = `已推送并验证 design.zenslab.top。`;
      setStatus(detail);
      setPublish({ phase: "success", step: 3, label: "域名已验证", detail });
    } catch (error) {
      const detail = `发布未完成：${error.message || "请检查 GitHub 发布令牌权限"}`;
      setStatus(detail);
      setPublish({ phase: "error", step: 1, label: "发布需要处理", detail });
    }
  };
  const saveModule = () => {
    saveLocalContent(content);
    setLastSavedGroup(group);
    setStatus(`「${itemLabel(item)}」已保存到本地草稿，尚未发布线上。`);
    setPublish({
      phase: "idle",
      step: 0,
      label: "本机草稿已保存",
      detail:
        "此模块未发送到 GitHub；请在所有修改完成后点击右上角「保存并发布」。",
    });
  };
  const add = () => {
    const base =
      group === "works"
        ? {
            title: "未命名作品",
            type: "平面作品",
            src: "",
            brief: "",
            purpose: "",
            concept: "",
            craft: "",
            keywords: [],
          }
        : group === "systemModules"
          ? {
              id: `module-${Date.now()}`,
              index: String(items.length + 1).padStart(2, "0"),
              title: "新模块",
              tabLabel: "新模块",
              tabEn: "NEW MODULE",
              caption: "",
              description: "",
              detail: "",
              image: "",
              gallery: [],
              tags: [],
            }
          : group === "projects"
            ? {
                id: `project-${Date.now()}`,
                title: "新项目",
                type: "产品设计",
                role: "",
                brief: "",
                image: "",
                gallery: [],
                overview: "",
                meta: { year: "2026", period: "", status: "" },
                details: [],
              }
            : group === "careerStages"
              ? {
                  version: `V${items.length + 1}.0`,
                  role: "新职业阶段",
                  period: "",
                  note: "",
                  stage: "NEW STAGE",
                  en: "",
                  keyword: "",
                  overview: "",
                  focus: [],
                  deliveries: [],
                  lesson: "",
                  shift: "",
                }
              : {
                  index: String(items.length + 1).padStart(2, "0"),
                  code: "NEW",
                  title: "新产品",
                  subtitle: "",
                  image: "",
                  description: "",
                  link: "#",
                  highlights: [],
                };
    setContent((all) => ({ ...all, [group]: [...all[group], base] }));
    setSelected(items.length);
    setStatus("已创建一条新内容");
  };
  const confirmDelete = () => {
    setContent((all) => ({
      ...all,
      [group]: all[group].filter((_, i) => i !== selected),
    }));
    setPendingDelete(false);
    setStatus("已删除，并自动保存到本机草稿");
  };
  const itemLabel = (entry) =>
    entry.title || entry.role || entry.tabLabel || entry.heroName || "未命名";
  return (
    <div className="cms-shell">
      {onlineCheck.toast && (
        <aside className="content-sync-notice" role="status" aria-atomic="true">
          <span aria-hidden="true">{onlineCheck.phase === "error" ? <CircleAlert size={16} /> : <Check size={16} />}</span>
          <div>
            <b>{onlineCheck.label}</b>
            <small>{onlineCheck.detail}</small>
          </div>
        </aside>
      )}
      <aside className="cms-sidebar">
        <a className="cms-brand" href="/" aria-label="返回作品集">
          <span>ZEN.</span> 内容管理
        </a>
        <nav>
          {contentGroups.map((x) => (
            <button
              className={group === x.key ? "is-active" : ""}
              onClick={() => setGroup(x.key)}
              key={x.key}
            >
              <span>{x.title}</span>
              <i>{counts[x.key]}</i>
            </button>
          ))}
        </nav>
        <div className="cms-sidebar__foot">
          <a href="/" target="_blank" rel="noreferrer">
            <ArrowLeft size={15} />
            查看作品集
          </a>
          <button
            onClick={() => {
              resetLocalContent();
              setContent(resolveContent({}));
              setStatus("已恢复默认内容");
            }}
          >
            <RotateCcw size={15} />
            恢复默认
          </button>
        </div>
      </aside>
      <main className="cms-main">
        <header className="cms-top">
          <div>
            <small>作品集内容管理</small>
            <h1>{contentGroups.find((x) => x.key === group)?.title}</h1>
            <p>{contentGroups.find((x) => x.key === group)?.subtitle}</p>
          </div>
          <div className="cms-actions">
            <label className="cms-token">
              <span>GitHub 发布令牌 · 此设备永久记住</span>
              <input
                type="password"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  localStorage.setItem("portfolio-admin-token", e.target.value);
                }}
                placeholder="粘贴 Fine-grained token"
              />
            </label>
            <button
              className="cms-button cms-button--quiet"
              onClick={add}
              disabled={group === "profileModal" || group === "siteCopy"}
            >
              <Plus size={16} />
              新建内容
            </button>
            <button
              className="cms-button"
              onClick={publishAll}
              disabled={publish.phase === "publishing"}
            >
              {publish.phase === "publishing" ? (
                <LoaderCircle size={16} />
              ) : (
                <Save size={16} />
              )}
              {publish.phase === "publishing" ? "发布中" : "保存并发布"}
            </button>
          </div>
        </header>
        <div className="cms-publish-row">
          <PublishProgress state={publish} token={token} />
          <div className="cms-status-stack">
            <section className={`cms-online-status is-${onlineCheck.phase}`} aria-live="polite">
              <div>
                <small>ONLINE VERSION</small>
                <strong>{onlineCheck.label}</strong>
                <span>{onlineCheck.detail}</span>
              </div>
              <button type="button" onClick={checkOnlineVersion} disabled={onlineCheck.phase === "checking"} aria-label="重新检测线上版本">
                {onlineCheck.phase === "checking" ? <LoaderCircle size={15} /> : <RotateCcw size={15} />}
              </button>
            </section>
            <output className="cms-status" aria-live="polite">{status}</output>
          </div>
        </div>
        <div className="cms-layout">
          <section className="cms-list">
            <div className="cms-list__head">
              <span>内容列表</span>
              <b>{items.length}</b>
            </div>
            {items.map((entry, i) => (
              <button
                key={entry.id || entry.code || entry.version || entry.src || i}
                className={selected === i ? "is-active" : ""}
                onClick={() => setSelected(i)}
              >
                <span className="cms-list__thumb">
                  {entry.image || entry.src ? (
                    <img src={resolvePreview(entry.image || entry.src)} alt="" />
                  ) : (
                    <ImagePlus size={18} />
                  )}
                </span>
                <span>
                  <strong>{itemLabel(entry)}</strong>
                  <small>
                    {entry.subtitle ||
                      entry.note ||
                      entry.type ||
                      entry.caption ||
                      entry.code ||
                      "等待补充内容"}
                  </small>
                </span>
              </button>
            ))}
          </section>
          <section className="cms-editor">
            {items.length ? (
              <>
                <div className="cms-editor__head">
                  <div>
                    <small>正在编辑</small>
                    <h2>{itemLabel(item)}</h2>
                    <p>
                      编辑会自动保留为本地草稿；本模块保存只留在这台设备。全部修改完成后，请点击右上角「保存并发布」。
                    </p>
                    {lastSavedGroup === group && (
                      <span className="cms-module-saved">
                        <Check size={14} />
                        本模块草稿已保存
                      </span>
                    )}
                  </div>
                  <div className="cms-editor__tools">
                    <button
                      className="cms-button cms-button--module"
                      onClick={saveModule}
                      disabled={publish.phase === "publishing"}
                    >
                      {publish.phase === "publishing" ? (
                        <LoaderCircle size={16} />
                      ) : (
                        <Save size={16} />
                      )}
                      {publish.phase === "publishing" ? "发布中" : "保存本机草稿"}
                    </button>
                    <button
                      className="cms-delete"
                      disabled={
                        group === "profileModal" || group === "siteCopy"
                      }
                      onClick={() => setPendingDelete(true)}
                    >
                      <Trash2 size={16} />
                      删除
                    </button>
                  </div>
                </div>
                <Fields
                  value={item}
                  onChange={(next) => update([], next)}
                  onUpload={upload}
                  path={[]}
                  depth={0}
                  order={ROOT_ORDER[group]}
                  hideKeys={group === "siteCopy" ? ["id", "title"] : []}
                  resolvePreview={resolvePreview}
                />
              </>
            ) : (
              <div className="cms-empty">
                还没有内容。<button onClick={add}>新建一条内容</button>
              </div>
            )}
          </section>
        </div>
      </main>
      {pendingDelete && (
        <div
          className="cms-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div>
            <small>删除确认</small>
            <h2 id="delete-title">确认删除「{itemLabel(item)}」？</h2>
            <p>
              删除后会立即从本机草稿与前台展示中移除。若要同步给访客，请随后点击「保存并发布」。
            </p>
            <footer>
              <button
                className="cms-button cms-button--quiet"
                onClick={() => setPendingDelete(false)}
              >
                取消
              </button>
              <button
                className="cms-delete cms-delete--confirm"
                onClick={confirmDelete}
              >
                确认删除
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
