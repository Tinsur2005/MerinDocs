<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import SideBar from './components/SideBar.vue';
import DocHeader from './components/DocHeader.vue';
import AppFooter from './components/AppFooter.vue';
import ThemeToggle from './components/ThemeToggle.vue';
import ToastStack from './components/ToastStack.vue';
import RedirectConfirm from './components/RedirectConfirm.vue';
import { getTree, getDoc } from './api';
import { loadSiteConfig } from './siteConfig';

const tree = ref([]);
const sidebarOpen = ref(false);
// 跨视图切换（首页→文档）的全局加载遮罩：预加载期间旧页面在其下保持可见
const pageLoading = ref(false);
// 导航栏整体收起/展开（仅 PC 端）：默认展开，切换只影响本次会话，不做持久化
const navCollapsed = ref(false);
const router = useRouter();
const route = useRoute();

// 导航栏宽度：拖拽手柄实时拉伸（仅 PC 端），范围 160~420px，只影响本次会话
const MIN_NAV_WIDTH = 160;
const MAX_NAV_WIDTH = 420;
const navWidth = ref(260);
let resizeState = null;
let dragMoved = false;

// 开始拖拽：收起状态下**先不展开**，避免点击展开变成无动画的瞬间跳变；
// 只有真正拖动（位移 >3px）时才跟手展开（宽度从 0 起），普通点击走 toggleNav 带动画
function startResize(e) {
  if (navCollapsed.value) {
    resizeState = { startX: e.clientX, startWidth: 0, wasCollapsed: true };
  } else {
    resizeState = { startX: e.clientX, startWidth: navWidth.value };
    document.documentElement.classList.add('resizing'); // 拖拽中关闭宽度过渡，避免滞后
  }
  dragMoved = false;
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', endResize);
  // 触屏手势被系统接管（滚动/手势取消）时也要收尾，避免监听器残留
  window.addEventListener('pointercancel', endResize);
}

function onResizeMove(e) {
  if (!resizeState) return;
  const dx = e.clientX - resizeState.startX;
  if (Math.abs(dx) > 3) {
    dragMoved = true;
    // 收起状态下首次真拖动：展开并开启"无过渡跟手"模式（宽度从 0 跟手）
    if (resizeState.wasCollapsed && navCollapsed.value) {
      navCollapsed.value = false;
      document.documentElement.classList.add('resizing');
    }
  }
  navWidth.value = Math.min(MAX_NAV_WIDTH, Math.max(MIN_NAV_WIDTH, resizeState.startWidth + dx));
  document.documentElement.style.setProperty('--sidebar-width', `${navWidth.value}px`);
}

function endResize() {
  resizeState = null;
  document.documentElement.classList.remove('resizing');
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', endResize);
  window.removeEventListener('pointercancel', endResize);
}

// 点击收起/展开；刚拖拽过不算点击，避免拖完误触发
function toggleNav() {
  if (dragMoved) {
    dragMoved = false;
    return;
  }
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

// 外链型笔记（内容只有一行 URL）的跳转确认：先弹窗确认，确认后再新标签页打开
const redirectUrl = ref('');
const showRedirect = ref(false);

async function goTo(file) {
  // 链接型笔记：弹窗确认后再新标签页跳转，不打开 md
  if (file.redirect) {
    redirectUrl.value = file.redirect;
    showRedirect.value = true;
    return;
  }
  // 跨视图切换（当前不在文档页，如从首页点入）：先预加载目标文档再跳转，
  // 旧页面在遮罩下保持可见，避免 HomeView 卸载后新视图还在加载、只剩空白+页脚的空档
  if (route.name !== 'doc') {
    pageLoading.value = true;
    try {
      await getDoc(file.path);
    } catch (e) {
      // 预加载失败也照常跳转，由文档页显示 404
    }
    await router.push({ name: 'doc', params: { docPath: file.path } });
    sidebarOpen.value = false;
    pageLoading.value = false;
    return;
  }
  // 文档→文档：同组件切换，由 DocView 自己管理遮罩（旧文档保留可见）
  router.push({ name: 'doc', params: { docPath: file.path } });
  sidebarOpen.value = false;
}

// 用户确认跳转：新标签页打开并收起抽屉（若在移动端）
function onRedirectConfirm() {
  window.open(redirectUrl.value, '_blank');
  showRedirect.value = false;
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
      <!-- 收起/展开导航：PC 端位于导航栏与正文之间；兼作拖拽手柄（拖动调整宽度，点击收起/展开） -->
      <button
        class="sidebar-toggle"
        :title="navCollapsed ? '点击展开 / 拖动调整宽度' : '点击收起 / 拖动调整宽度'"
        :aria-label="navCollapsed ? '展开导航' : '收起导航'"
        @pointerdown.prevent="startResize"
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
        <!-- 跨视图切换的全局加载遮罩：与文档页内遮罩同款样式，覆盖整个正文区域 -->
        <Transition name="overlay-fade">
          <div v-if="pageLoading" class="doc-loading-overlay">
            <div class="doc-loading-center">
              <div class="spinner" aria-hidden="true"></div>
              <p>加载中…</p>
            </div>
          </div>
        </Transition>
        <RouterView />
        <AppFooter />
      </main>
    </div>
  </div>
  <!-- 夜间/日间切换：全局悬浮按钮，fixed 定位不参与布局 -->
  <ThemeToggle />
  <!-- 顶部通知堆栈：全站消息统一在此展示 -->
  <ToastStack />
  <!-- 外链跳转确认弹窗 -->
  <RedirectConfirm v-model="showRedirect" :url="redirectUrl" @confirm="onRedirectConfirm" />
</template>
