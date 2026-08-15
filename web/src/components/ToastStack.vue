<script setup>
// 顶部通知堆栈：单例挂载于 App 根部，全站消息统一在这里展示
import { useToasts } from '../toast';

const toasts = useToasts();
</script>

<template>
  <teleport to="body">
    <div class="toast-stack" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast-item">{{ t.msg }}</div>
      </TransitionGroup>
    </div>
  </teleport>
</template>
