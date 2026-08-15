import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import DocView from '../views/DocView.vue';
import NotFoundView from '../views/NotFoundView.vue';
import { showViewLoading } from '../loading';

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/doc/:docPath(.*)', name: 'doc', component: DocView },
  { path: '/:pathMatch(.*)*', name: 'notfound', component: NotFoundView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 跨视图切换（首页↔文档等）：路由确认前先显示全局遮罩，盖在当前视图上转圈，
// 由目标视图内容就绪后 hideViewLoading() 隐藏——避免旧视图先卸载、转圈盖在空白上；
// 同视图内切换（文档↔文档）不触发，由组件自己管理遮罩
router.beforeEach((to, from) => {
  if (to.name !== from.name) showViewLoading();
});

export default router;
