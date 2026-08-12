<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  tree: { type: Array, default: () => [] },
  current: { type: String, default: '' },
  open: { type: Boolean, default: false },
});
const emit = defineEmits(['select']);

const collapsed = ref({});

// 按文件路径找到所属分类
function findCat(path) {
  return props.tree.find((cat) => cat.files.some((f) => f.path === path));
}

// ① 目录加载完成后：默认全部折叠（只给尚无状态的新分类播种，保留用户手动开合）；
//    若当前正打开某篇文档，展开其所属文件夹
watch(
  () => props.tree,
  (tree) => {
    const state = { ...collapsed.value };
    for (const cat of tree) {
      if (state[cat.name] === undefined) state[cat.name] = true;
    }
    if (props.current) {
      const cat = findCat(props.current);
      if (cat) state[cat.name] = false;
    }
    collapsed.value = state;
  },
  { immediate: true }
);

// ② 切换文档时：自动展开所属文件夹，其它文件夹保持用户手动状态
watch(
  () => props.current,
  (path) => {
    if (!path) return;
    const cat = findCat(path);
    if (cat) collapsed.value[cat.name] = false;
  }
);

function toggle(name) {
  collapsed.value[name] = !collapsed.value[name];
}

function isActive(filePath) {
  return props.current === filePath;
}
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <div v-if="!tree.length" class="sidebar-empty">加载中...</div>
    <div v-for="cat in tree" :key="cat.name" class="cat">
      <div class="cat-title" @click="toggle(cat.name)">
        <span class="cat-arrow" :class="{ collapsed: collapsed[cat.name] }">▾</span>
        <span class="cat-name">{{ cat.name }}</span>
        <span class="cat-count">{{ cat.files.length }}</span>
      </div>
      <ul v-show="!collapsed[cat.name]" class="file-list">
        <li
          v-for="f in cat.files"
          :key="f.path"
          class="file-item"
          :class="{ active: isActive(f.path) }"
          @click="emit('select', f)"
        >
          {{ f.name }}
        </li>
      </ul>
    </div>
  </aside>
</template>
