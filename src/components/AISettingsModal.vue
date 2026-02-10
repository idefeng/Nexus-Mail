<script setup lang="ts">
import { ref, watch } from 'vue'
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
  model: 'deepseek-chat',
  enabled: true
})

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    const saved = await window.configAPI.getAI()
    if (saved) {
      form.value = { ...saved }
    }
  }
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
          <h2 class="text-lg font-bold">灵镜摘要设置</h2>
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

        <div class="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
          <span class="text-sm font-bold text-zinc-700 dark:text-zinc-300">启用灵镜摘要</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="form.enabled" class="sr-only peer">
            <div class="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
          </label>
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
