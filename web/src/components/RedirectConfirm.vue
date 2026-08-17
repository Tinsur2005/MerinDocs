<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { siteConfig } from '../siteConfig';

// 外链跳转确认弹窗：modelValue 控制显隐，url 为要跳转的目标链接；
// 点击「继续」emit confirm，由父组件执行 window.open。
// 命中 site.config.json 的 safeDomains 时显示"安全"样式（绿勾），否则提示谨慎访问（问号）。
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  url: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'confirm']);

// 外链域名是否在安全名单中：精确相等，或外链是配置域名的子域名（tinsur.cn 覆盖 www.tinsur.cn）
const safe = computed(() => {
  const raw = props.url;
  if (!raw) return false;
  let host = '';
  try {
    host = new URL(raw, window.location.origin).hostname.toLowerCase();
  } catch {
    return false; // URL 解析失败按不安全处理
  }
  const domains = String(siteConfig.value.safeDomains || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return domains.some((d) => host === d || host.endsWith('.' + d));
});

function close() {
  emit('update:modelValue', false);
}
function confirm() {
  emit('confirm');
}

function onKey(e) {
  if (e.key === 'Escape' && props.modelValue) close();
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="redirect-mask" @click.self="close">
        <div class="redirect-dialog" role="dialog" aria-modal="true" aria-label="外部链接确认">
          <!-- 安全外链：绿底白勾；未知外链：主题色底白问号 -->
          <div class="redirect-icon" :class="{ safe }" aria-hidden="true">
            <svg v-if="safe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="redirect-title">{{ safe ? '即将访问安全的外部链接' : '该链接安全未知，请谨慎访问' }}</div>
          <div class="redirect-url" :title="url">{{ url }}</div>
          <p class="redirect-hint">是否继续？</p>
          <div class="redirect-btns">
            <button class="redirect-btn cancel" @click="close">取消</button>
            <button class="redirect-btn ok" @click="confirm">继续</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
