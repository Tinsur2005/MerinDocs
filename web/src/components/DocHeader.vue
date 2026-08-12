<script setup>
defineEmits(['toggle-sidebar']);
</script>

<template>
  <header class="header">
    <button class="menu-btn" @click="$emit('toggle-sidebar')" aria-label="菜单">
      <span></span><span></span><span></span>
    </button>
    <div class="header-brand">
      <span class="header-logo">📚</span>
      <span class="header-title">MerinDocs</span>
    </div>
    <nav class="header-nav">
      <button class="header-link" type="button">按钮1</button>
      <button class="header-link" type="button">按钮2</button>
    </nav>
  </header>
</template>
