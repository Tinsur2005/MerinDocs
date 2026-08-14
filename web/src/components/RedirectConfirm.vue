<script setup>
import { onMounted, onBeforeUnmount } from 'vue';

// 外链跳转确认弹窗：modelValue 控制显隐，url 为要跳转的目标链接；
// 点击「继续」emit confirm，由父组件执行 window.open
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  url: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'confirm']);

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
          <div class="redirect-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </div>
          <div class="redirect-title">即将跳转到外部链接</div>
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
