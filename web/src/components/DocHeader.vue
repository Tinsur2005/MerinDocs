<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { siteConfig } from '../siteConfig';

defineEmits(['toggle-sidebar']);

// 导航按钮的 url 以 / 开头视为站内路由（router-link），否则为外链（<a>）
function isInternal(url) {
  return typeof url === 'string' && url.startsWith('/');
}

// 品牌区 + 两个按钮放不下一整行时，把「返回博客 / 文档首页」折叠成「更多」下拉
const compact = ref(false);
const dropOpen = ref(false);
const headerRef = ref(null);
const brandRef = ref(null);
const navRef = ref(null);
const probeRef = ref(null);
const menuBtnRef = ref(null);
const dropRef = ref(null);

function measure() {
  if (!headerRef.value || !brandRef.value || !probeRef.value) return;
  // 移动端菜单按钮（桌面隐藏时 offsetWidth 为 0）+ 右间距 12
  const mb = menuBtnRef.value;
  const menuW = mb && mb.offsetWidth > 0 ? mb.offsetWidth + 12 : 0;
  const padding = 48; // 左右 padding 24*2
  // 探针始终渲染两个按钮，无论当前是否折叠，宽度都代表「完整展开」所需
  const need = brandRef.value.offsetWidth + probeRef.value.offsetWidth + menuW + padding;
  compact.value = need > headerRef.value.clientWidth;
}

function onDocClick(e) {
  if (dropRef.value && !dropRef.value.contains(e.target)) dropOpen.value = false;
}

onMounted(() => {
  measure();
  window.addEventListener('resize', measure);
  document.addEventListener('click', onDocClick);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
  document.removeEventListener('click', onDocClick);
});
</script>

<template>
  <header ref="headerRef" class="header">
    <button ref="menuBtnRef" class="menu-btn" @click="$emit('toggle-sidebar')" aria-label="菜单">
      <span></span><span></span><span></span>
    </button>
    <div ref="brandRef" class="header-brand">
      <span class="header-logo">📚</span>
      <span class="header-title">{{ siteConfig.navbar.title }}</span>
    </div>
    <nav ref="navRef" class="header-nav">
      <!-- 空间足够：按钮平铺 -->
      <template v-if="!compact">
        <template v-for="b in siteConfig.navbar.buttons" :key="b.text">
          <router-link v-if="isInternal(b.url)" class="header-link" :to="b.url">{{ b.text }}</router-link>
          <a v-else class="header-link" :href="b.url" :target="b.target || '_blank'" rel="noopener">{{ b.text }}</a>
        </template>
      </template>
      <!-- 空间不足：合并为一个下拉 -->
      <div v-else ref="dropRef" class="header-drop">
        <button class="header-drop-btn" type="button" @click="dropOpen = !dropOpen">
          更多 ▾
        </button>
        <div v-if="dropOpen" class="header-drop-menu">
          <template v-for="b in siteConfig.navbar.buttons" :key="b.text">
            <router-link v-if="isInternal(b.url)" class="header-drop-item" :to="b.url" @click="dropOpen = false">{{ b.text }}</router-link>
            <a
              v-else
              class="header-drop-item"
              :href="b.url"
              :target="b.target || '_blank'"
              rel="noopener"
              @click="dropOpen = false"
            >{{ b.text }}</a>
          </template>
        </div>
      </div>

      <!-- 测量探针：始终保留按钮完整宽度，不参与布局 -->
      <span ref="probeRef" class="header-nav-probe" aria-hidden="true">
        <template v-for="b in siteConfig.navbar.buttons" :key="'p' + b.text">
          <router-link v-if="isInternal(b.url)" class="header-link" :to="b.url">{{ b.text }}</router-link>
          <a v-else class="header-link" :href="b.url" :target="b.target || '_blank'" rel="noopener">{{ b.text }}</a>
        </template>
      </span>
    </nav>
  </header>
</template>
