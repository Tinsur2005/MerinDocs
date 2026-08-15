<script setup>
import { computed } from 'vue';

const props = defineProps({
  node: { type: Object, required: true },
  // 折叠状态统一由 SideBar 持有（key = 节点路径），子目录读写同一对象
  collapsed: { type: Object, required: true },
  current: { type: String, default: '' },
  depth: { type: Number, default: 0 },
});
const emit = defineEmits(['toggle', 'select']);

const isDir = computed(() => props.node.type === 'dir');
const isCollapsed = computed(() => !!props.collapsed[props.node.path]);

// 文件夹标题缩进：每深一层多缩进 16px，与同级文档对齐
const titleIndent = computed(() => 20 + props.depth * 16);
// 文档缩进：通过 CSS 变量作用到 .file-item，active 的边框对齐依然成立
const fileIndent = computed(() => 44 + props.depth * 16);

// 该文件夹下的笔记总数（含所有嵌套子目录）
const totalFiles = computed(() => {
  let n = 0;
  const walk = (nodes) => {
    for (const c of nodes) {
      if (c.type === 'file') n++;
      else if (c.children) walk(c.children);
    }
  };
  walk(props.node.children || []);
  return n;
});
</script>

<template>
  <!-- 文件夹节点：可展开/收起，内部再渲染子文件夹与文档 -->
  <div v-if="isDir" class="cat">
    <div
      class="cat-title"
      :style="{ paddingLeft: titleIndent + 'px' }"
      @click="emit('toggle', node.path)"
    >
      <span class="cat-arrow" :class="{ collapsed: isCollapsed }">
        <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3 L5 7 L8 3 Z" fill="currentColor"></path></svg>
      </span>
      <span class="cat-name">{{ node.name }}</span>
      <span class="cat-count">{{ totalFiles }}</span>
    </div>
    <!-- 展开/收起：grid-template-rows 0fr→1fr 过渡，内容按自身高度丝滑展开 -->
    <div class="cat-body" :class="{ open: !isCollapsed }">
      <ul class="file-list">
        <li v-for="child in node.children" :key="child.path">
          <!-- 嵌套文件夹：递归渲染（支持最多三层及更多） -->
          <SideBarNode
            v-if="child.type === 'dir'"
            :node="child"
            :collapsed="collapsed"
            :current="current"
            :depth="depth + 1"
            @toggle="emit('toggle', $event)"
            @select="emit('select', $event)"
          />
          <div
            v-else
            class="file-item"
            :style="{ '--file-indent': fileIndent + 'px' }"
            :class="{ active: current === child.path }"
            @click="emit('select', child)"
          >
            <span class="file-item-name">{{ child.name }}</span>
            <span v-if="child.redirect" class="file-item-ext" title="外链，点击直接跳转">
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
          </div>
        </li>
      </ul>
    </div>
  </div>
  <!-- 文件节点：通用兜底（正常情况下顶层只会是文件夹） -->
  <div
    v-else
    class="file-item"
    :style="{ '--file-indent': fileIndent + 'px' }"
    :class="{ active: current === node.path }"
    @click="emit('select', node)"
  >
    <span class="file-item-name">{{ node.name }}</span>
    <span v-if="node.redirect" class="file-item-ext" title="外链，点击直接跳转">
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
  </div>
</template>
