<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { user, wpUrl } from '../auth';

const route = useRoute();
const open = ref(false);
const rootRef = ref(null);
const cardRef = ref(null);
const avatarFailed = ref(false);

const ROLE_NAMES = {
  administrator: '管理员',
  editor: '编辑',
  author: '作者',
  contributor: '投稿者',
  subscriber: '订阅用户',
};

const displayName = computed(() => user.value?.displayName || user.value?.name || '用户');
const loginName = computed(() => user.value?.name || '');
const avatarUrl = computed(() => (avatarFailed.value ? '' : user.value?.avatar || ''));
const initial = computed(() => displayName.value.charAt(0).toUpperCase());
const roles = computed(() => {
  const list = user.value?.roles || [];
  return list.map((r) => ROLE_NAMES[r] || r).slice(0, 2);
});
const profileUrl = computed(() => (wpUrl.value ? `${wpUrl.value}/wp-admin/profile.php` : ''));
const logoutHref = computed(
  () => `/api/auth/logout?redirect=${encodeURIComponent(route.fullPath)}`
);

function toggle() {
  open.value = !open.value;
}

function onDocClick(e) {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target)) {
    open.value = false;
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') open.value = false;
}

// 路由切换后收起弹层
watch(
  () => route.fullPath,
  () => {
    open.value = false;
  }
);

// 每次打开后把焦点放进卡片，方便 Esc/失焦管理
watch(open, async (v) => {
  if (v) {
    await nextTick();
    cardRef.value?.focus();
  }
});

onMounted(() => {
  document.addEventListener('mousedown', onDocClick);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="rootRef" class="user-menu">
    <button
      type="button"
      class="user-menu-trigger"
      :class="{ 'is-open': open }"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click.stop="toggle"
    >
      <span v-if="avatarUrl" class="user-avatar user-avatar-sm">
        <img :src="avatarUrl" alt="" @error="avatarFailed = true" />
      </span>
      <span v-else class="user-avatar user-avatar-sm user-avatar-fallback">{{ initial }}</span>
      <span class="user-menu-name">{{ displayName }}</span>
      <svg
        class="user-menu-chevron"
        :class="{ 'is-up': open }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <Transition name="user-card">
      <div
        v-if="open"
        ref="cardRef"
        class="user-card"
        role="menu"
        tabindex="-1"
      >
        <div class="user-card-head">
          <span v-if="avatarUrl" class="user-avatar user-avatar-lg">
            <img :src="avatarUrl" alt="" @error="avatarFailed = true" />
          </span>
          <span v-else class="user-avatar user-avatar-lg user-avatar-fallback">{{ initial }}</span>
          <div class="user-card-id">
            <div class="user-card-name-row">
              <span class="user-card-name">{{ displayName }}</span>
              <span v-for="r in roles" :key="r" class="user-card-role">{{ r }}</span>
            </div>
            <div v-if="loginName" class="user-card-login">@{{ loginName }}</div>
          </div>
        </div>

        <div class="user-card-divider"></div>

        <div class="user-card-actions">
          <a
            v-if="profileUrl"
            class="user-action"
            :href="profileUrl"
            target="_blank"
            rel="noopener"
            role="menuitem"
          >
            <span class="user-action-icon user-action-icon-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"></path>
              </svg>
            </span>
            <span class="user-action-label user-action-label-blue">账号资料</span>
          </a>
          <a class="user-action" :href="logoutHref" role="menuitem">
            <span class="user-action-icon user-action-icon-red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
            </span>
            <span class="user-action-label user-action-label-red">退出登录</span>
          </a>
        </div>
      </div>
    </Transition>
  </div>
</template>
