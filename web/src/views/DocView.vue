<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DocContent from '../components/DocContent.vue';
import NotFoundView from './NotFoundView.vue';
import { getDoc } from '../api';

const route = useRoute();
const router = useRouter();
const doc = ref(null);
const loading = ref(false);

async function load(path) {
  if (!path) return;
  loading.value = true;
  try {
    doc.value = await getDoc(path);
  } catch (e) {
    console.error('加载文档失败', e);
    doc.value = null;
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
