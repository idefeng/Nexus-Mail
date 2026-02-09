<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  isOpen: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', config: any): void
}>()

const form = ref({
  user: '',
  pass: '',
  host: '',
  port: 993,
  tls: true
})

const handleSubmit = () => {
  emit('submit', { ...form.value })
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 class="text-xl font-bold mb-4">添加邮箱账户</h2>
      
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">邮箱地址</label>
          <input v-model="form.user" type="email" required class="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" placeholder="example@domain.com" />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">密码 / 应用专用密码</label>
          <input v-model="form.pass" type="password" required class="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" />
          <p class="text-xs text-zinc-500 mt-1">对于 Gmail 等请使用应用专用密码</p>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">IMAP 服务器</label>
            <input v-model="form.host" type="text" required class="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" placeholder="imap.domain.com" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">端口</label>
            <input v-model.number="form.port" type="number" required class="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        <div class="flex items-center gap-2">
           <input v-model="form.tls" type="checkbox" id="tls" class="rounded border-gray-300" />
           <label for="tls" class="text-sm">启用 SSL/TLS</label>
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <button type="button" @click="emit('close')" class="px-4 py-2 text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            取消
          </button>
          <button type="submit" :disabled="loading" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-2">
            <span v-if="loading" class="animate-spin i-lucide-loader-2"></span>
            {{ loading ? '连接中...' : '连接' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
