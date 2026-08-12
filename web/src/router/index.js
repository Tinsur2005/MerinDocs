import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import DocView from '../views/DocView.vue';
import NotFoundView from '../views/NotFoundView.vue';

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/doc/:docPath(.*)', name: 'doc', component: DocView },
  { path: '/:pathMatch(.*)*', name: 'notfound', component: NotFoundView },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
