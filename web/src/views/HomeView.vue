<script setup>
import { ref, onMounted } from 'vue';
import DocContent from '../components/DocContent.vue';
import ProgressBar from '../components/ProgressBar.vue';
import { getHome, getCachedHome } from '../api';
import { siteConfig } from '../siteConfig';
import { hideViewLoading } from '../loading';

const doc = ref(null);
const loading = ref(true);
const missing = ref(false);

function applyHome(data) {
  doc.value = {
    title: data.title,
    html: data.html,
    toc: data.toc,
    category: '',
    prev: null,
    next: null,
  };
}

onMounted(async () => {
  // 回到首页时，浏览器标题恢复为站点标题（来自 site.config.json）
  document.title = siteConfig.value.siteTitle;
  // 跨视图切换时可能已预取过首页（getHome 预热缓存）：命中则即时渲染，不再等网络
  const hit = getCachedHome();
  if (hit) {
    if (hit.exists) applyHome(hit);
    else missing.value = true;
    loading.value = false;
    hideViewLoading();
    return;
  }
  try {
    const data = await getHome();
    if (data.exists) applyHome(data);
    else missing.value = true;
  } catch (e) {
    console.error('加载首页失败', e);
    missing.value = true;
  } finally {
    loading.value = false;
    // 首页内容已就绪：收起跨视图切换的全局遮罩
    hideViewLoading();
  }
});
</script>

<template>
  <ProgressBar :loading="loading" />
  <!-- 加载遮罩：与文档页同款样式，首页加载 / 首页与文档间切换的转圈体验保持一致 -->
  <Transition name="overlay-fade">
    <div v-if="loading" class="doc-loading-overlay">
      <div class="doc-loading-center">
        <div class="spinner" aria-hidden="true"></div>
        <p>加载中…</p>
      </div>
    </div>
  </Transition>
  <DocContent v-if="doc" :doc="doc" />
  <div v-if="!loading && missing" class="doc-placeholder">
    尚未创建 README.md，请在 note 目录添加首页内容。
  </div>
</template>
