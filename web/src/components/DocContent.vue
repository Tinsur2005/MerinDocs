<script setup>
import { ref, computed, watch, nextTick, onMounted, onUpdated, onBeforeUnmount } from 'vue';
import TocNode from './TocNode.vue';
import { showToast } from '../toast';

const props = defineProps({
  doc: { type: Object, default: null },
});
const emit = defineEmits(['navigate']);

const activeId = ref('');

// ---- 目录树：把扁平 toc 按标题层级挂成树，支持逐级展开/收起 ----
// 折叠状态：记录被收起的节点 id（Set）；点击箭头切换，滚动到某节时自动展开其祖先链
const collapsed = ref(new Set());
const tocTree = computed(() => buildTocTree(props.doc?.toc || []));

// 扁平目录 → 树：用栈维护当前层级，同级/更浅级标题弹出栈，子项挂到父标题下
function buildTocTree(items) {
  const root = [];
  const stack = [{ level: 0, children: root }];
  for (const item of items) {
    const node = { ...item, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].level >= node.level) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push({ level: node.level, children: node.children });
  }
  return root;
}

// 默认折叠规则：1~2 级展开；3 级及以上默认收起（仅对确有子项的标题生效）
function seedCollapsed(items) {
  const s = new Set();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.level < 3) continue;
    let hasChild = false;
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].level <= it.level) break;
      hasChild = true;
    }
    if (hasChild) s.add(it.id);
  }
  return s;
}

// 向上查找某标题的全部祖先 id（从最近父级到根）
function ancestorIds(id) {
  const items = props.doc?.toc || [];
  const idx = items.findIndex((it) => it.id === id);
  if (idx < 0) return [];
  const result = [];
  let cur = idx;
  while (cur > 0) {
    let p = -1;
    for (let i = cur - 1; i >= 0; i--) {
      if (items[i].level < items[cur].level) {
        p = i;
        break;
      }
    }
    if (p < 0) break;
    result.push(items[p].id);
    cur = p;
  }
  return result;
}

function onToggleToc(id) {
  const s = new Set(collapsed.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  collapsed.value = s;
}

// 滚动到某节（activeId 变化）：目录跟随阅读位置——先重置为默认状态
// （1~2 级展开、3 级及以上收起），再展开当前所在节的祖先链；
// 滑出该节后自动收回默认，实现"滑到展开、滑出收起"
watch(activeId, (id) => {
  if (!id) return;
  const s = seedCollapsed(props.doc?.toc || []);
  for (const pid of [id, ...ancestorIds(id)]) s.delete(pid);
  collapsed.value = s;
});

// 灯箱状态
const lightboxSrc = ref('');
const scale = ref(1);

function scrollToHeading(id) {
  const el = document.getElementById(id);
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// 灯箱
function openLightbox(src) {
  lightboxSrc.value = src;
  scale.value = 1;
  // 灯箱打开期间锁定页面滚动（滚轮 / 触摸 / 键盘都滚不动背景）
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightboxSrc.value = '';
  scale.value = 1;
  document.body.style.overflow = '';
}
function onWheel(e) {
  e.preventDefault();
  const step = e.deltaY > 0 ? -0.15 : 0.15;
  scale.value = Math.max(0.2, Math.min(5, scale.value + step));
}
function onKey(e) {
  if (e.key === 'Escape') closeLightbox();
}

// 给正文图片加灯箱点击
function enhanceImages() {
  const root = document.querySelector('.doc-article');
  if (!root) return;
  root.querySelectorAll('.markdown-body img').forEach((img) => {
    if (img.dataset.lightbox) return;
    img.dataset.lightbox = '1';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

// 把 <pre class="hljs"> 包成结构化的代码块：header（语言+复制）+ content（行号+代码）
function enhanceCodeBlocks() {
  const root = document.querySelector('.doc-article');
  if (!root) return;
  root.querySelectorAll('pre.hljs').forEach((pre) => {
    if (pre.dataset.enhanced) return;
    pre.dataset.enhanced = '1';
    const code = pre.querySelector('code');

    // 外层 wrapper
    const block = document.createElement('div');
    block.className = 'code-block';

    // Header：语言 + 复制按钮
    const header = document.createElement('div');
    header.className = 'code-header';
    const langName = pre.dataset.lang || '';
    const langSpan = document.createElement('span');
    langSpan.className = 'code-lang';
    langSpan.textContent = langName;
    header.appendChild(langSpan);

    const btn = document.createElement('button');
    btn.className = 'code-copy';
    btn.textContent = '复制';
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = '已复制';
        setTimeout(() => (btn.textContent = '复制'), 1500);
        showToast('复制成功');
      } catch {
        btn.textContent = '失败';
      }
    });
    header.appendChild(btn);

    // Content：行号 + 原 pre
    const content = document.createElement('div');
    content.className = 'code-content';

    const lineCount = code.textContent.replace(/\n$/, '').split('\n').length;
    const gutter = document.createElement('span');
    gutter.className = 'code-gutter';
    let nums = '';
    for (let i = 1; i <= lineCount; i++) nums += i + '\n';
    gutter.textContent = nums;

    pre.parentNode.insertBefore(block, pre);
    block.appendChild(header);
    content.appendChild(gutter);
    content.appendChild(pre);
    block.appendChild(content);
  });
}

function updateActive() {
  if (!props.doc?.toc?.length) return;
  let current = props.doc.toc[0].id;
  for (const item of props.doc.toc) {
    const el = document.getElementById(item.id);
    if (el && el.getBoundingClientRect().top < 90) current = item.id;
  }
  activeId.value = current;
}

watch(
  () => props.doc,
  (d) => {
    // 新文档：重置目录折叠状态（1~2 级展开、3 级及以上收起），并展开首个标题链
    collapsed.value = seedCollapsed(d?.toc || []);
    const first = d?.toc?.[0];
    if (first) {
      const s = new Set(collapsed.value);
      s.delete(first.id);
      collapsed.value = s;
    }
    nextTick(() => {
      enhanceCodeBlocks();
      enhanceImages();
      updateActive();
      window.scrollTo({ top: 0 });
      // 新文档渐显：移除再重新加回淡入 class，触发 CSS 动画重播
      const el = document.querySelector('.doc-layout');
      if (el) {
        el.classList.remove('doc-fade-in');
        void el.offsetWidth; // 强制重排以重新触发动画
        el.classList.add('doc-fade-in');
      }
    });
  }
);

// v-html 更新会重建正文内部 DOM，清掉之前手动加的复制按钮 / 行号 / 灯箱绑定，
// 导致代码块偶现没有增强；每次重新渲染后都补跑一遍（data-enhanced 标记保证幂等）
onUpdated(() => {
  nextTick(() => {
    enhanceCodeBlocks();
    enhanceImages();
  });
});

onMounted(() => {
  window.addEventListener('scroll', updateActive, { passive: true });
  window.addEventListener('keydown', onKey);
  // 进入新文档（组件挂载）：补跑代码块/图片增强、刷新 TOC 高亮并回到顶部
  nextTick(() => {
    enhanceCodeBlocks();
    enhanceImages();
    updateActive();
    window.scrollTo({ top: 0 });
  });
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateActive);
  window.removeEventListener('keydown', onKey);
  // 组件卸载时若有灯箱残留，恢复页面滚动
  document.body.style.overflow = '';
});
</script>

<template>
  <!-- 先渲染内容：切换文章时保留旧内容可见，避免整屏闪"加载中" -->
  <div v-if="doc" class="doc-layout doc-fade-in">
    <article class="doc-article">
      <!-- 标题由 markdown-body 里的 h1 自然渲染，避免重复 -->
      <div class="markdown-body" v-html="doc.html"></div>
      <nav class="doc-nav">
        <button v-if="doc.prev" class="nav-btn" @click="emit('navigate', doc.prev)">
          <span class="nav-btn-label">上一篇：{{ doc.prev.name }}</span>
          <!-- 外链型文档：标题后显示外链标识 -->
          <svg
            v-if="doc.prev.redirect"
            class="nav-btn-link"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
        <span v-else />
        <button v-if="doc.next" class="nav-btn" @click="emit('navigate', doc.next)">
          <span class="nav-btn-label">下一篇：{{ doc.next.name }}</span>
          <!-- 外链型文档：标题后显示外链标识 -->
          <svg
            v-if="doc.next.redirect"
            class="nav-btn-link"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      </nav>
    </article>
    <aside v-if="doc.toc && doc.toc.length" class="doc-toc">
      <div class="toc-title">本页目录</div>
      <TocNode
        :nodes="tocTree"
        :active-id="activeId"
        :collapsed="collapsed"
        @toggle="onToggleToc"
        @scroll="scrollToHeading"
      />
    </aside>
  </div>
  <div v-else class="doc-placeholder">请从左侧选择一篇文档</div>

  <!-- 图片灯箱：@wheel.prevent 拦截整个蒙层的滚轮，保证背景页面不被滑动 -->
  <teleport to="body">
    <div v-if="lightboxSrc" class="lightbox-overlay" @click="closeLightbox" @wheel.prevent>
      <div class="lightbox-stage" @click.stop>
        <img
          :src="lightboxSrc"
          class="lightbox-img"
          :style="{ transform: `scale(${scale})` }"
          alt="预览"
          @wheel="onWheel"
        />
      </div>
      <button class="lightbox-close" title="关闭" aria-label="关闭" @click.stop="closeLightbox">×</button>
      <div class="lightbox-hint">滚轮缩放 · 点击空白关闭</div>
    </div>
  </teleport>
</template>
