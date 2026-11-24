<script setup>
import { computed } from 'vue';
import { formatDate, isSameDay } from '../utils/date';

const props = defineProps({
  publishedAt: { type: String, default: '' },
  updatedAt: { type: String, default: '' },
});

const publishedText = computed(() => formatDate(props.publishedAt));
const showUpdated = computed(
  () =>
    Boolean(props.updatedAt) &&
    Boolean(props.publishedAt) &&
    !isSameDay(props.publishedAt, props.updatedAt)
);
const updatedText = computed(() => formatDate(props.updatedAt));
</script>

<template>
  <div v-if="publishedText" class="doc-meta">
    <span class="doc-meta-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      发布于 {{ publishedText }}
    </span>
    <span v-if="showUpdated" class="doc-meta-item doc-meta-updated">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      更新于 {{ updatedText }}
    </span>
  </div>
</template>
