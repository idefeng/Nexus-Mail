<script setup lang="ts">
import { ref } from 'vue'
import { Settings, Save, X } from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', config: any): void
}>()

const form = ref({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat'
})

const handleSave = () => {
  emit('save', { ...form.value })
  emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
    <div class="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/40">
        <div class="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
          <Settings class="w-5 h-5" />
          <h2 class="text-lg font-bold">灵境摘要设置</h2>
        </div>
        <button @click="emit('close')" class="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>
      
      <div class="p-6 space-y-5">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">API 代理地址 (Base URL)</label>
          <input v-model="form.baseURL" type="text" class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" placeholder="https://api.openai.com/v1" />
        </div>
        
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">API 密钥 (API Key)</label>
          <input v-model="form.apiKey" type="password" class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" placeholder="sk-..." />
          <p class="text-[10px] text-zinc-400 mt-2 italic px-1">支持 OpenAI 兼容格式 (如 DeepSeek, Ollama 等)</p>
        </div>
        
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">模型名称 (Model)</label>
          <input v-model="form.model" type="text" class="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" placeholder="gpt-4o" />
        </div>
      </div>

      <div class="px-6 py-4 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
        <button @click="emit('close')" class="px-4 py-2 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">取消</button>
        <button @click="handleSave" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all shadow-lg flex items-center gap-2">
          <Save class="w-4 h-4" />
          保存配置
        </button>
      </div>
    </div>
  </div>
</template>
