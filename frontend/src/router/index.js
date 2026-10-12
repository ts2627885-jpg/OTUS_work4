import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Components (lazy load)
const LoginView = () => import('@/views/LoginView.vue')
const RegisterView = () => import('@/views/RegisterView.vue')
const DashboardView = () => import('@/views/DashboardView.vue')
const AzsListView = () => import('@/views/AzsListView.vue')
const AzsDetailView = () => import('@/views/AzsDetailView.vue')
const RecommendationsView = () => import('@/views/RecommendationsView.vue')
const DataImportView = () => import('@/views/DataImportView.vue')
const AdminView = () => import('@/views/AdminView.vue')
const NotFoundView = () => import('@/views/NotFoundView.vue')

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: RegisterView,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/azs',
    name: 'AzsList',
    component: AzsListView,
    meta: {
      requiresAuth: true,
      requiredPermissions: ['azs_view_all', 'azs_view_own']
    }
  },
  {
    path: '/azs/:id',
    name: 'AzsDetail',
    component: AzsDetailView,
    meta: {
      requiresAuth: true,
      requiredPermissions: ['azs_view_all', 'azs_view_own']
    }
  },
  {
    path: '/data',
    name: 'Data',
    component: () => import('@/views/DataView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: () => import('@/views/AnalyticsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/recommendations',
    name: 'Recommendations',
    component: RecommendationsView,
    meta: {
      requiresAuth: true,
      requiredPermissions: ['recommendations_view']
    }
  },
  {
    path: '/import',
    name: 'DataImport',
    component: DataImportView,
    meta: {
      requiresAuth: true,
      requiredPermissions: ['data_import']
    }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: AdminView,
    meta: {
      requiresAuth: true,
      requiredPermissions: ['users_manage', 'settings']
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFoundView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Route guards
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // Public routes
  if (!to.meta.requiresAuth) {
    // Redirect authenticated users from login/register to dashboard
    if ((to.name === 'Login' || to.name === 'Register') && authStore.isAuthenticated) {
      next({ name: 'Dashboard' })
    } else {
      next()
    }
    return
  }

  // Protected routes
  if (!authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  // Check permissions
  const requiredPermissions = to.meta.requiredPermissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasPermission = requiredPermissions.some(
      perm => authStore.hasPermission(perm)
    )
    if (!hasPermission) {
      next({ name: 'Dashboard' })
      return
    }
  }

  next()
})

export default router
