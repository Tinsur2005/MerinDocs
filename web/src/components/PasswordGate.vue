<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { unlockDoc } from '../api';

// 加密文档的密码输入页：校验通过后 emit unlocked，由 DocView 替换为正文
const props = defineProps({
  docPath: { type: String, required: true },
  title: { type: String, default: '' },
});
const emit = defineEmits(['unlocked']);

const password = ref('');
const error = ref('');
const attempts = ref(0);
const submitting = ref(false);

// 冷却倒计时（秒）：服务端返回剩余时间，本地每秒递减
const cooldown = ref(0);
let cooldownTimer = null;

function startCooldown(seconds) {
  cooldown.value = seconds;
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0) clearInterval(cooldownTimer);
  }, 1000);
}

function formatCooldown(sec) {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}

async function submit() {
  if (!password.value || submitting.value || cooldown.value > 0) return;
  submitting.value = true;
  error.value = '';
  try {
    const data = await unlockDoc(props.docPath, password.value);
    password.value = '';
    attempts.value = 0;
    emit('unlocked', data);
  } catch (e) {
    const status = e.response?.status;
    if (status === 429) {
      // 触发新一轮冷却，或冷却中再次提交：以服务端剩余时间为准
      startCooldown(e.response.data.retryAfter || 60);
      error.value = '';
    } else if (status === 401) {
      attempts.value = e.response.data.attempts || attempts.value + 1;
      error.value = '密码错误，请重新输入';
    } else {
      error.value = '验证失败，请稍后重试';
    }
  } finally {
    submitting.value = false;
  }
}

onBeforeUnmount(() => clearInterval(cooldownTimer));
</script>

<template>
  <div class="doc-password-wrap doc-fade-in">
    <form class="doc-password-card" @submit.prevent="submit">
      <div class="doc-password-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <h2 class="doc-password-title">{{ title || '加密文档' }}</h2>
      <p class="doc-password-hint">该文档已加密，请输入密码查看</p>
      <input
        v-model="password"
        class="doc-password-input"
        type="password"
        placeholder="请输入密码"
        autocomplete="current-password"
        :disabled="submitting || cooldown > 0"
        autofocus
      />
      <div v-if="cooldown > 0" class="doc-password-cooldown">
        错误次数过多，请等待 {{ formatCooldown(cooldown) }} 后再试
      </div>
      <div v-else-if="error" class="doc-password-error">
        {{ error }}<span v-if="attempts > 0">（已连续错误 {{ attempts }} 次）</span>
      </div>
      <button class="doc-password-btn" type="submit" :disabled="submitting || !password || cooldown > 0">
        <template v-if="cooldown > 0">请等待 {{ formatCooldown(cooldown) }}</template>
        <template v-else>{{ submitting ? '验证中…' : '查看文档' }}</template>
      </button>
    </form>
  </div>
</template>
