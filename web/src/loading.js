import { reactive } from 'vue';

// 跨视图加载遮罩：路由守卫在切页前置为显示（盖在当前视图上转圈），
// 目标视图内容就绪后调用 hideViewLoading() 隐藏，避免切换期间旧视图先卸载、
// 转圈盖在空白页上的空档。同视图内切换（文档↔文档）不走这里，由组件自己管理。
export const viewLoading = reactive({ active: false });
export const showViewLoading = () => {
  viewLoading.active = true;
};
export const hideViewLoading = () => {
  viewLoading.active = false;
};
