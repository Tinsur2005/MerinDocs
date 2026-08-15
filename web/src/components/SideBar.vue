<script setup>
import { ref, watch } from 'vue';
import { searchNotes } from '../api';
import SideBarNode from './SideBarNode.vue';

const props = defineProps({
  tree: { type: Array, default: () => [] },
  current: { type: String, default: '' },
  open: { type: Boolean, default: false },
  navCollapsed: { type: Boolean, default: false },
});
const emit = defineEmits(['select']);

// 折叠状态：key = 节点路径（嵌套后文件夹名可能重名，不能用 name 做 key）
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

// 某文档路径的所有祖先文件夹路径：note/A/B/x.md -> ["A", "A/B"]
function ancestorPaths(filePath) {
  const segs = filePath.split('/');
  const paths = [];
  let cur = '';
  for (let i = 0; i < segs.length - 1; i++) {
    cur = cur ? `${cur}/${segs[i]}` : segs[i];
    paths.push(cur);
  }
  return paths;
}

// 目录加载完成后：默认全部折叠（只给尚无状态的文件夹播种，保留用户手动开合）；
// 若当前正打开某篇文档，展开其所有祖先文件夹
watch(
  () => props.tree,
  (tree) => {
    const state = { ...collapsed.value };
    const set = new Set(ancestorPaths(props.current || ''));
    const seed = (nodes) => {
      for (const n of nodes) {
        if (n.type !== 'dir') continue;
        if (state[n.path] === undefined) state[n.path] = true;
        if (set.has(n.path)) state[n.path] = false;
        if (n.children) seed(n.children);
      }
    };
    seed(tree);
    collapsed.value = state;
  },
  { immediate: true }
);

// 切换文档时：自动展开所属的所有祖先文件夹，其它文件夹保持用户手动状态
watch(
  () => props.current,
  (path) => {
    if (!path) return;
    const set = new Set(ancestorPaths(path));
    const expand = (nodes) => {
      for (const n of nodes) {
        if (n.type !== 'dir') continue;
        if (set.has(n.path)) collapsed.value[n.path] = false;
        if (n.children) expand(n.children);
      }
    };
    expand(props.tree);
  }
);

function toggle(path) {
  collapsed.value[path] = !collapsed.value[path];
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

    <template v-if="!tree.length">
      <div class="sidebar-empty">加载中...</div>
    </template>
    <template v-else>
      <!-- 递归渲染分类树：文件夹可嵌套（最多三层），叶子是文档条目 -->
      <SideBarNode
        v-for="node in tree"
        :key="node.path"
        :node="node"
        :collapsed="collapsed"
        :current="current"
        @toggle="toggle"
        @select="emit('select', $event)"
      />
    </template>
  </aside>
</template>
