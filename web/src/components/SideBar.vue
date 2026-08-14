<script setup>
import { ref, watch } from 'vue';
import { searchNotes } from '../api';

const props = defineProps({
  tree: { type: Array, default: () => [] },
  current: { type: String, default: '' },
  open: { type: Boolean, default: false },
  navCollapsed: { type: Boolean, default: false },
});
const emit = defineEmits(['select']);

const collapsed = ref({});

// ---- 全局搜索：防抖输入 -> 请求 /api/search -> 下拉展示命中结果 ----
const searchInput = ref('');
const searchResults = ref([]);
const searching = ref(false);
const searchFocused = ref(false);
let searchTimer = null;

watch(searchInput, (val) => {
  clearTimeout(searchTimer);
  const q = val.trim();
  if (!q) {
    searchResults.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  searchTimer = setTimeout(async () => {
    try {
      const data = await searchNotes(q);
      searchResults.value = data.results || [];
    } catch (e) {
      console.error('搜索失败', e);
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 250);
});

function clearSearch() {
  searchInput.value = '';
  searchResults.value = [];
  searching.value = false;
}

// 点击命中结果：复用与点击侧边栏相同的 select 事件（含链接型笔记跳转）
function pickResult(r) {
  emit('select', { path: r.path, name: r.title, redirect: r.redirect });
  clearSearch();
}

// 高亮标题/摘要中命中的关键词（用 <mark> 包裹）
function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function highlight(text) {
  const terms = searchInput.value.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map(escapeReg).join('|')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

function findCat(path) {
  return props.tree.find((cat) => cat.files.some((f) => f.path === path));
}

// 目录加载完成后：默认全部折叠（只给尚无状态的新分类播种，保留用户手动开合）；
// 若当前正打开某篇文档，展开其所属文件夹
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

// 切换文档时：自动展开所属文件夹，其它文件夹保持用户手动状态
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
  <aside class="sidebar" :class="{ open, collapsed: navCollapsed }">
    <!-- 全局搜索框 -->
    <div class="sidebar-search">
      <div class="search-input-wrap">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchInput"
          type="text"
          placeholder="搜索全部笔记…"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
          @keydown.esc="clearSearch"
        />
        <span v-if="searchInput" class="search-clear" title="清空" @mousedown.prevent="clearSearch">×</span>
      </div>

      <div v-if="searchInput.trim() && (searchFocused || searching)" class="search-dropdown">
        <div v-if="searching" class="search-status">搜索中…</div>
        <div v-else-if="!searchResults.length" class="search-status">未找到相关内容</div>
        <template v-else>
          <div
            v-for="r in searchResults"
            :key="r.path"
            class="search-result"
            @mousedown.prevent="pickResult(r)"
          >
            <div class="search-result-title">
              <span class="search-result-name" v-html="highlight(r.title)"></span>
              <span class="search-result-cat">{{ r.category }}</span>
            </div>
            <div v-if="r.snippet" class="search-result-snippet" v-html="highlight(r.snippet)"></div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="!tree.length" class="sidebar-empty">加载中...</div>
    <div v-for="cat in tree" :key="cat.name" class="cat">
      <div class="cat-title" @click="toggle(cat.name)">
        <span class="cat-arrow" :class="{ collapsed: collapsed[cat.name] }">
          <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3 L5 7 L8 3 Z" fill="currentColor"></path></svg>
        </span>
        <span class="cat-name">{{ cat.name }}</span>
        <span class="cat-count">{{ cat.files.length }}</span>
      </div>
      <!-- 展开/收起：grid-template-rows 0fr→1fr 过渡，内容按自身高度丝滑展开 -->
      <div class="cat-body" :class="{ open: !collapsed[cat.name] }">
        <ul class="file-list">
          <li
            v-for="f in cat.files"
            :key="f.path"
            class="file-item"
            :class="{ active: isActive(f.path) }"
            @click="emit('select', f)"
          >
            <span class="file-item-name">{{ f.name }}</span>
            <span
              v-if="f.redirect"
              class="file-item-ext"
              title="外链，点击直接跳转"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>
