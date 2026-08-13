<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import SideBar from './components/SideBar.vue';
import DocHeader from './components/DocHeader.vue';
import AppFooter from './components/AppFooter.vue';
import { getTree } from './api';
import { loadSiteConfig } from './siteConfig';

const tree = ref([]);
const sidebarOpen = ref(false);
const router = useRouter();
const route = useRoute();

onMounted(async () => {
  // 站点自定义配置（标题 / 导航按钮 / 备案号等）要最先加载，供各组件使用
  loadSiteConfig();
  try {
    const data = await getTree();
    tree.value = data.categories;
  } catch (e) {
    console.error('加载目录失败', e);
  }
});

function goTo(file) {
  // 链接型笔记（内容只有一行 URL）：新标签页跳转，不打开 md
  if (file.redirect) {
    window.open(file.redirect, '_blank');
    sidebarOpen.value = false;
    return;
  }
  router.push({ name: 'doc', params: { docPath: file.path } });
  sidebarOpen.value = false;
}
</script>

<template>
  <div class="app">
    <DocHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <div class="app-body">
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>
      <SideBar
        :tree="tree"
        :current="route.params.docPath"
        :open="sidebarOpen"
        @select="goTo"
      />
      <main class="app-main">
        <RouterView />
        <AppFooter />
      </main>
    </div>
  </div>
</template>
