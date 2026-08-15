<script setup>
import { onMounted } from 'vue';
import { hideViewLoading } from '../loading';

// 404 页无需加载：挂载即收起跨视图切换的全局遮罩
onMounted(hideViewLoading);
</script>

<template>
  <div class="not-found">
    <div class="not-found-code">404</div>
    <div class="not-found-title">NOT FOUND</div>
    <p class="not-found-desc">您访问的页面不存在或已被移动</p>
    <router-link class="not-found-btn" to="/">返回文档首页</router-link>
  </div>
</template>
