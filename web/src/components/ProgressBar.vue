<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';

const props = defineProps({
  loading: { type: Boolean, default: false },
});

// 模拟加载进度：起步后朝 90% 渐进逼近，加载完成瞬间冲到 100% 再整体隐藏
const visible = ref(false);
const progress = ref(0);
let creepTimer = 0;
let hideTimer = 0;

function start() {
  clearInterval(creepTimer);
  clearTimeout(hideTimer); // 清除上次收尾的隐藏定时器，防止新一次加载被误隐藏
  visible.value = true;
  progress.value = 8;
  creepTimer = setInterval(() => {
    const remaining = 90 - progress.value;
    progress.value += Math.max(0.5, remaining * 0.12);
  }, 180);
}

function finish() {
  clearInterval(creepTimer);
  progress.value = 100;
  // 等 width 过渡走完再隐藏并归零，避免回缩一闪
  hideTimer = setTimeout(() => {
    visible.value = false;
    progress.value = 0;
  }, 280);
}

watch(
  () => props.loading,
  (v) => (v ? start() : finish()),
  { immediate: true }
);

onBeforeUnmount(() => {
  clearInterval(creepTimer);
  clearTimeout(hideTimer);
});
</script>

<template>
  <!-- 细进度条：固定贴页面最顶端，颜色随主题（--color-primary）自动适配浅色/深色 -->
  <div v-show="visible" class="progress-bar" :style="{ width: progress + '%' }"></div>
</template>
