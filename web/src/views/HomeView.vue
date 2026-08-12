<script setup>
import { ref, onMounted } from 'vue';
import DocContent from '../components/DocContent.vue';
import { getHome } from '../api';

const doc = ref(null);
const loading = ref(true);
const missing = ref(false);

onMounted(async () => {
  try {
    const data = await getHome();
    if (data.exists) {
      doc.value = {
        title: data.title,
        html: data.html,
        toc: data.toc,
        category: '',
        prev: null,
        next: null,
      };
    } else {
      missing.value = true;
    }
  } catch (e) {
    console.error('加载首页失败', e);
    missing.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <DocContent :doc="doc" :loading="loading" />
  <div v-if="!loading && missing" class="doc-placeholder">
    尚未创建 README.md，请在 note 目录添加首页内容。
  </div>
</template>
