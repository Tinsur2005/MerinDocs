<script setup>
import { ref, watch, nextTick, onMounted, onUpdated, onBeforeUnmount } from 'vue';

const props = defineProps({
  doc: { type: Object, default: null },
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(['navigate']);

const activeId = ref('');

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
  () => {
    nextTick(() => {
      enhanceCodeBlocks();
      enhanceImages();
      updateActive();
      window.scrollTo({ top: 0 });
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
  <div v-if="doc" class="doc-layout">
    <article class="doc-article">
      <!-- 标题由 markdown-body 里的 h1 自然渲染，避免重复 -->
      <div class="markdown-body" v-html="doc.html"></div>
      <nav class="doc-nav">
        <button v-if="doc.prev" class="nav-btn" @click="emit('navigate', doc.prev)">
          ← {{ doc.prev.name }}
        </button>
        <span v-else />
        <button v-if="doc.next" class="nav-btn" @click="emit('navigate', doc.next)">
          {{ doc.next.name }} →
        </button>
      </nav>
    </article>
    <aside v-if="doc.toc && doc.toc.length" class="doc-toc">
      <div class="toc-title">本页目录</div>
      <ul class="toc-list">
        <li
          v-for="item in doc.toc"
          :key="item.id"
          :class="['toc-item', 'toc-level-' + item.level, { active: activeId === item.id }]"
          @click="scrollToHeading(item.id)"
        >
          {{ item.text }}
        </li>
      </ul>
    </aside>
  </div>
  <div v-else-if="loading" class="doc-placeholder">加载中...</div>
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
