<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import SideBar from './components/SideBar.vue';
import DocHeader from './components/DocHeader.vue';
import AppFooter from './components/AppFooter.vue';
import ThemeToggle from './components/ThemeToggle.vue';
import { getTree } from './api';
import { loadSiteConfig } from './siteConfig';

const tree = ref([]);
const sidebarOpen = ref(false);
// 导航栏整体收起/展开（仅 PC 端）：默认展开，切换只影响本次会话，不做持久化
const navCollapsed = ref(false);
const router = useRouter();
const route = useRoute();

function toggleNav() {
  navCollapsed.value = !navCollapsed.value;
}

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
        :nav-collapsed="navCollapsed"
        @select="goTo"
      />
      <!-- 收起/展开导航：PC 端位于导航栏与正文之间，收起后正文自动变宽 -->
      <button
        class="sidebar-toggle"
        :title="navCollapsed ? '展开导航' : '收起导航'"
        :aria-label="navCollapsed ? '展开导航' : '收起导航'"
        @click="toggleNav"
      >
        <svg
          v-if="navCollapsed"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <main class="app-main">
        <RouterView />
        <AppFooter />
      </main>
    </div>
  </div>
  <!-- 夜间/日间切换：全局悬浮按钮，fixed 定位不参与布局 -->
  <ThemeToggle />
</template>
