<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DocContent from '../components/DocContent.vue';
import NotFoundView from './NotFoundView.vue';
import { getDoc, getCachedDoc } from '../api';
import { siteConfig } from '../siteConfig';

const route = useRoute();
const router = useRouter();
const doc = ref(null);
const loading = ref(false);

async function load(path) {
  if (!path) return;
  // 缓存命中：直接秒开，不显示加载中
  const hit = getCachedDoc(path);
  if (hit) {
    doc.value = hit;
    // 打开笔记后，浏览器标签页标题改为当前笔记标题
    document.title = hit.title || siteConfig.value.siteTitle;
    return;
  }
  loading.value = true;
  try {
    doc.value = await getDoc(path);
    // 打开笔记后，浏览器标签页标题改为当前笔记标题
    document.title = doc.value.title || siteConfig.value.siteTitle;
  } catch (e) {
    console.error('加载文档失败', e);
    doc.value = null;
    document.title = '404 - MerinDocs';
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.params.docPath,
  (p) => load(p),
  { immediate: true }
);

function goRel(p) {
  if (!p) return;
  // 链接型笔记：新标签页跳转，不打开 md
  if (p.redirect) {
    window.open(p.redirect, '_blank');
    return;
  }
  router.push({ name: 'doc', params: { docPath: p.path } });
}
</script>

<template>
  <DocContent v-if="doc || loading" :doc="doc" :loading="loading" @navigate="goRel" />
  <NotFoundView v-else />
</template>
