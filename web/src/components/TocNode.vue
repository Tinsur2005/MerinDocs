<script setup>
// 递归渲染目录树节点：有子项的标题带箭头（点击箭头收起/展开子标题），
// 点击行内任意位置滚动到对应小节；折叠用 grid 行高过渡实现丝滑展开收起
const props = defineProps({
  nodes: { type: Array, required: true },
  activeId: { type: String, default: '' },
  collapsed: { type: Set, required: true },
});
const emit = defineEmits(['toggle', 'scroll']);

function isCollapsed(node) {
  return props.collapsed.has(node.id);
}
</script>

<template>
  <ul class="toc-list">
    <li v-for="node in nodes" :key="node.id" class="toc-node">
      <div
        class="toc-row"
        :class="['toc-level-' + node.level, { active: activeId === node.id }]"
        @click="emit('scroll', node.id)"
      >
        <button
          v-if="node.children.length"
          class="toc-arrow"
          :class="{ collapsed: isCollapsed(node) }"
          :title="isCollapsed(node) ? '展开' : '收起'"
          @click.stop="emit('toggle', node.id)"
        >
          <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3 L5 7 L8 3 Z" fill="currentColor"></path></svg>
        </button>
        <span v-else class="toc-arrow-ghost" aria-hidden="true"></span>
        <span class="toc-label" :title="node.text">{{ node.text }}</span>
      </div>
      <div v-if="node.children.length" class="toc-children" :class="{ open: !isCollapsed(node) }">
        <TocNode
          :nodes="node.children"
          :active-id="activeId"
          :collapsed="collapsed"
          @toggle="emit('toggle', $event)"
          @scroll="emit('scroll', $event)"
        />
      </div>
    </li>
  </ul>
</template>
