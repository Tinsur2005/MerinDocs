import { reactive } from 'vue';

// 顶部通知堆栈：新消息从上方弹出（插到栈顶），把旧消息依次向下顶；
// 最多同时 3 条，超出时最旧一条（栈底）被顶出消失；供复制代码、首页按钮等处复用
const toasts = reactive([]);
let seq = 0;

export function showToast(msg) {
  const id = ++seq;
  toasts.unshift({ id, msg });
  // 超过 3 条：移除最旧一条（位于栈底，触发离开动画被顶出）
  if (toasts.length > 3) toasts.pop();
  // 每条 2 秒后自行消失
  setTimeout(() => removeToast(id), 2000);
}

function removeToast(id) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}

export function useToasts() {
  return toasts;
}
