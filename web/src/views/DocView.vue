<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DocContent from '../components/DocContent.vue';
import ProgressBar from '../components/ProgressBar.vue';
import RedirectConfirm from '../components/RedirectConfirm.vue';
import NotFoundView from './NotFoundView.vue';
import { getDoc, getCachedDoc } from '../api';
import { siteConfig } from '../siteConfig';
import { hideViewLoading } from '../loading';

const route = useRoute();
const router = useRouter();
const doc = ref(null);
const loading = ref(false);

// 加载序号：快速连续切换时只认最后一次请求，避免旧响应覆盖新内容
let loadSeq = 0;
// 加载遮罩的最短展示时长，避免缓存命中也“秒开”显得太突兀
const MIN_LOADING_MS = 300;

async function load(path) {
  if (!path) return;
  const seq = ++loadSeq;
  loading.value = true;
  // 不"先跳回顶部再加载"：遮罩覆盖当前滚动位置即可（sticky 居中），
  // 新内容就绪后由 DocContent 在渲染时滚回顶部
  // 最短展示时长与请求并行计时：即使命中缓存，遮罩也至少停留一小会儿
  const minDelay = new Promise((r) => setTimeout(r, MIN_LOADING_MS));
  try {
    const hit = getCachedDoc(path);
    const data = hit || (await getDoc(path));
    if (seq !== loadSeq) return;
    // 新视图首次挂载且命中缓存（如跨视图预加载后跳转）：直接显示，
    // 不等待最短时长，避免旧视图已卸载、这里却还在转圈的"空白+遮罩"空档
    if (hit && !doc.value) {
      doc.value = data;
      setDocTitle(data.title);
      loading.value = false;
      return;
    }
    await minDelay;
    if (seq !== loadSeq) return;
    // 新文档就绪：同帧切换内容并关闭遮罩，形成“遮罩淡出 + 新内容渐显”的过渡
    doc.value = data;
    setDocTitle(data.title);
  } catch (e) {
    if (seq !== loadSeq) return;
    console.error('加载文档失败', e);
    doc.value = null;
    document.title = `404 - ${siteConfig.value.navbar.title}`;
  } finally {
    if (seq === loadSeq) {
      loading.value = false;
      // 内容已就绪（或 404）：收起跨视图切换的全局遮罩
      hideViewLoading();
    }
  }
}

// 文档页浏览器标题 = 笔记标题 + " - " + 导航栏标题（来自 site.config.json 的 navbar.title）
function setDocTitle(title) {
  document.title = title ? `${title} - ${siteConfig.value.navbar.title}` : siteConfig.value.siteTitle;
}

watch(
  () => route.params.docPath,
  (p) => load(p),
  { immediate: true }
);

// 上一篇/下一篇：先丝滑滚回顶部，真正滚到顶后再加载新文章
// 用 rAF 手动动画而非依赖 scrollend/超时：长页面滚动耗时长也不会提前跳转
let scrollRaf = 0;
onBeforeUnmount(() => cancelAnimationFrame(scrollRaf));

function smoothScrollTop(done) {
  const startY = window.scrollY;
  // 已在顶部：直接跳转
  if (startY <= 1) {
    done();
    return;
  }
  // 系统开启「减少动态效果」：直接跳到顶部再跳转
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo({ top: 0 });
    done();
    return;
  }
  const startTime = performance.now();
  // 滚动耗时随距离增长但封顶，避免超长页面拖太久
  const duration = Math.min(800, 150 + startY * 0.1);
  const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    window.scrollTo({ top: startY * (1 - ease(progress)) });
    if (progress < 1) {
      scrollRaf = requestAnimationFrame(step);
    } else {
      window.scrollTo({ top: 0 }); // 收尾对齐到顶
      done();
    }
  };
  scrollRaf = requestAnimationFrame(step);
}

// 上一篇/下一篇：先丝滑滚回顶部，滚动结束后再跳转加载
const redirectUrl = ref('');
const showRedirect = ref(false);

function goRel(p) {
  if (!p) return;
  // 链接型笔记：先弹窗确认，确认后再新标签页跳转，不打开 md
  if (p.redirect) {
    redirectUrl.value = p.redirect;
    showRedirect.value = true;
    return;
  }
  smoothScrollTop(() => router.push({ name: 'doc', params: { docPath: p.path } }));
}

function onRedirectConfirm() {
  window.open(redirectUrl.value, '_blank');
  showRedirect.value = false;
}
</script>

<template>
  <!-- 加载进度条：与遮罩同现同隐，固定在页面最顶端 -->
  <ProgressBar :loading="loading" />
  <!-- 加载遮罩：fixed 盖在整页上，半透明隐约透出旧文档，新文档就绪后淡出 -->
  <Transition name="overlay-fade">
    <div v-if="loading" class="doc-loading-overlay">
      <div class="doc-loading-center">
        <div class="spinner" aria-hidden="true"></div>
        <p>加载中…</p>
      </div>
    </div>
  </Transition>

  <!-- 切换文档时旧文档保留在页面下方，新文档就绪后内容替换并渐显 -->
  <DocContent v-if="doc" :doc="doc" @navigate="goRel" />
  <NotFoundView v-else-if="!doc && !loading" />

  <!-- 外链跳转确认弹窗 -->
  <RedirectConfirm v-model="showRedirect" :url="redirectUrl" @confirm="onRedirectConfirm" />
</template>
