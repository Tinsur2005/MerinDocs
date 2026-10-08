<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  doc: { type: Object, required: true },
});
const emit = defineEmits(['navigate']);

// iframe 自带加载指示：内容就绪前覆盖一层遮罩
const frameLoaded = ref(false);
watch(
  () => props.doc.url,
  () => {
    frameLoaded.value = false;
  }
);

function onFrameLoad() {
  frameLoaded.value = true;
}
</script>

<template>
  <div class="pdf-layout doc-fade-in">
    <!-- 工具栏：文件名 + 新标签打开 / 下载 -->
    <div class="pdf-toolbar">
      <span class="pdf-toolbar-title" :title="doc.title">{{ doc.title }}</span>
      <span class="pdf-toolbar-actions">
        <a class="pdf-toolbar-btn" :href="doc.url" target="_blank" rel="noopener">新标签打开</a>
        <a class="pdf-toolbar-btn" :href="doc.url" download>下载</a>
      </span>
    </div>

    <div class="pdf-frame-wrap">
      <iframe
        class="pdf-frame"
        :src="`${doc.url}#view=FitH`"
        title="PDF 预览"
        @load="onFrameLoad"
      ></iframe>
      <Transition name="overlay-fade">
        <div v-if="!frameLoaded" class="pdf-frame-loading">
          <div class="spinner" aria-hidden="true"></div>
          <p>加载中…</p>
        </div>
      </Transition>
    </div>

    <p class="pdf-fallback">如无法在线预览，请<a :href="doc.url">点此下载</a>后查看</p>

    <!-- 上一篇 / 下一篇：与 markdown 文档同款导航 -->
    <nav class="doc-nav">
      <button v-if="doc.prev" class="nav-btn" @click="emit('navigate', doc.prev)">
        <span class="nav-btn-label">上一篇：{{ doc.prev.name }}</span>
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
  </div>
</template>
