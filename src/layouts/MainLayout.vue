<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Inbox, Send, Sun, Moon, Search, Plus, RefreshCw, Reply, BrainCircuit, Sparkles, CheckCircle2, Settings } from 'lucide-vue-next'
import DOMPurify from 'dompurify'
import AccountModal from '../components/AccountModal.vue'
import AISettingsModal from '../components/AISettingsModal.vue'

interface EmailMessage {
  id: string
  subject: string
  from: string
  date: string
  seen: boolean
  snippet: string
  html?: string
  text?: string
}

interface AISummary {
  summary: string
  actions: string[]
  category: string
}

const isDarkMode = ref(false)
const isAccountModalOpen = ref(false)
const isAISettingsOpen = ref(false)
const isConnecting = ref(false)
const isLoading = ref(false)
const emails = ref<EmailMessage[]>([])
const selectedEmail = ref<EmailMessage | null>(null)

// AI Logic
const aiConfig = ref<any>({ enabled: true })
const summaryData = ref<AISummary | null>(null)
const isSummarizing = ref(false)

// Reply Logic
const isReplying = ref(false)
const replyContent = ref('')
const isSending = ref(false)

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  })
}



const handleLogin = async (config: any) => {
  isConnecting.value = true
  try {
    const success = await window.emailAPI.connect(config)
    if (success) {
      isAccountModalOpen.value = false
      await fetchEmails()
    }
  } catch (error: any) {
    console.error('Login failed:', error)
    alert(`连接失败: ${error.message || '请检查配置'}`)
  } finally {
    isConnecting.value = false
  }
}

const handleAISave = async (config: any) => {
  aiConfig.value = config
  await window.aiAPI.setConfig(config)
  if (selectedEmail.value && aiConfig.value.enabled) {
    summarizeEmail(selectedEmail.value)
  } else if (!aiConfig.value.enabled) {
    summaryData.value = null
  }
}

const fetchEmails = async () => {
  isLoading.value = true
  try {
    emails.value = await window.emailAPI.fetch(20)
    if (emails.value.length > 0 && !selectedEmail.value) {
      selectEmail(emails.value[0])
    }
  } catch (error) {
    console.error('Fetch failed:', error)
  } finally {
    isLoading.value = false
  }
}

const summarizeEmail = async (email: EmailMessage) => {
  if (!aiConfig.value.enabled) return
  isSummarizing.value = true
  summaryData.value = null
  try {
    // We pass both subject and body/text for better context
    const content = `Subject: ${email.subject}\n\n${email.html || email.text || email.snippet}`
    summaryData.value = await window.aiAPI.summarize(content)
  } catch (error) {
    console.error('Summary failed:', error)
  } finally {
    isSummarizing.value = false
  }
}

watch(selectedEmail, (newEmail) => {
  if (newEmail && aiConfig.value.enabled) {
    summarizeEmail(newEmail)
  } else {
    summaryData.value = null
  }
})

const handleReply = () => {
  isReplying.value = true
  replyContent.value = ''
}

const handleSend = async () => {
  if (!selectedEmail.value || !replyContent.value) return
  
  isSending.value = true
  try {
    const success = await window.emailAPI.send(
      selectedEmail.value.from,
      `Re: ${selectedEmail.value.subject}`,
      replyContent.value
    )
    if (success) {
      alert('发送成功')
      isReplying.value = false
      replyContent.value = ''
    }
  } catch (error) {
    console.error('Send failed:', error)
    alert('发送失败')
  } finally {
    isSending.value = false
  }
}

const sanitize = (content: string) => {
  return DOMPurify.sanitize(content)
}

const selectEmail = (email: EmailMessage) => {
    selectedEmail.value = email;
    isReplying.value = false;
    // Mark as seen locally for immediate feedback
    email.seen = true;
}

onMounted(async () => {
  const savedAccount = await window.configAPI.getAccount()
  if (savedAccount) {
    console.log('[Main] Found saved account, auto-logging in...')
    await handleLogin(savedAccount)
  }

  const savedAI = await window.configAPI.getAI()
  if (savedAI) {
    aiConfig.value = savedAI
  }
})
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 font-sans">
    <AccountModal 
      :is-open="isAccountModalOpen" 
      :loading="isConnecting"
      @close="isAccountModalOpen = false" 
      @submit="handleLogin" 
    />
    <AISettingsModal
      :is-open="isAISettingsOpen"
      @close="isAISettingsOpen = false"
      @save="handleAISave"
    />

    <!-- Sidebar -->
    <aside class="w-16 flex flex-col items-center py-4 bg-zinc-100 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 shrink-0">
      <div class="mb-4">
        <div class="w-10 h-10 rounded-full bg-transparent flex items-center justify-center cursor-pointer overflow-hidden border border-zinc-200 dark:border-zinc-800 transition-transform active:scale-95" @click="isAccountModalOpen = true" title="添加账户">
          <img v-if="!emails.length" src="/logo.png" alt="NM" class="w-full h-full object-cover" />
          <span v-else class="text-white font-bold bg-blue-600 w-full h-full flex items-center justify-center">Me</span>
        </div>
      </div>
      
      <nav class="flex-1 flex flex-col gap-4">
        <button @click="isAccountModalOpen = true" class="w-10 h-10 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors text-blue-600" title="添加账户">
          <Plus class="w-5 h-5" />
          <span class="sr-only">添加账户</span>
        </button>
      
        <button class="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center transition-colors" title="收件箱">
          <Inbox class="w-5 h-5" />
          <span class="sr-only">收件箱</span>
        </button>
        <button class="w-10 h-10 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors" title="已发送">
          <Send class="w-5 h-5" />
          <span class="sr-only">已发送</span>
        </button>
      </nav>

      <div class="mt-auto flex flex-col items-center gap-2">
        <button @click="isAISettingsOpen = true" class="w-10 h-10 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-all text-zinc-400 hover:text-blue-500" title="AI 设置">
          <Settings class="w-5 h-5" />
        </button>
        <button @click="toggleTheme" class="w-10 h-10 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors mb-2" :title="isDarkMode ? '切换到亮色模式' : '切换到暗色模式'">
          <Sun v-if="!isDarkMode" class="w-5 h-5" />
          <Moon v-else class="w-5 h-5" />
        </button>
      </div>
    </aside>

    <!-- Mail List -->
    <div class="w-80 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 shrink-0">
      <div class="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div class="flex justify-between items-center mb-2">
           <h2 class="text-xl font-bold">收件箱</h2>
           <button @click="fetchEmails" :class="{ 'animate-spin': isLoading }" class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
             <RefreshCw class="w-4 h-4" />
           </button>
        </div>
        <div class="relative">
           <Search class="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
           <input type="text" placeholder="搜索邮件..." class="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto custom-scrollbar">
         <div v-if="emails.length === 0" class="p-8 text-center text-zinc-500 text-sm">
            <span v-if="isLoading">正在加载邮件...</span>
            <span v-else>暂无邮件，请添加账户或刷新</span>
         </div>
         <div 
            v-for="email in emails" 
            :key="email.id" 
            @click="selectEmail(email)"
            class="p-4 border-b border-zinc-100 dark:border-zinc-800/50 cursor-pointer transition-all duration-200"
            :class="selectedEmail?.id === email.id ? 'bg-blue-50 dark:bg-blue-900/20 shadow-inner' : 'hover:bg-white dark:hover:bg-zinc-800'"
         >
            <div class="flex justify-between items-start mb-1">
              <span class="text-sm truncate w-2/3 flex items-center gap-2" :class="[selectedEmail?.id === email.id ? 'text-blue-600 font-bold' : (email.seen ? 'text-zinc-600 font-medium' : 'text-zinc-900 dark:text-zinc-100 font-black')]" :title="email.from">
                <span v-if="!email.seen" class="w-2 h-2 rounded-full bg-blue-600 shrink-0 shadow-[0_0_8px_rgba(37,99,235,0.4)]"></span>
                {{ email.from }}
              </span>
              <span class="text-[10px] text-zinc-400 font-medium uppercase shrink-0">{{ formatDate(email.date) }}</span>
            </div>
            <h3 class="text-sm mb-1 truncate leading-tight" :class="email.seen ? 'font-medium opacity-80' : 'font-bold opacity-100 text-zinc-900 dark:text-zinc-100'">{{ email.subject }}</h3>
            <p class="text-xs line-clamp-2 leading-normal" :class="email.seen ? 'text-zinc-500 font-normal' : 'text-zinc-600 dark:text-zinc-300 font-medium'">
              {{ email.snippet }}
            </p>
         </div>
      </div>
    </div>

    <!-- Mail Content -->
    <main class="flex-1 flex flex-col bg-white dark:bg-zinc-900 h-screen overflow-hidden">
      <template v-if="selectedEmail">
        <header class="h-16 shrink-0 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-6 justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
            <div class="flex items-center gap-3 overflow-hidden">
                <h1 class="text-lg font-bold truncate max-w-xl" :title="selectedEmail.subject">{{ selectedEmail.subject }}</h1>
                <span v-if="aiConfig.enabled && summaryData?.category" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {{ summaryData.category }}
                </span>
            </div>
            <div class="flex gap-2">
            <button @click="handleReply" class="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center gap-2">
                <Reply class="w-4 h-4" />
                回复
            </button>
            <button class="px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-medium transition-colors border border-zinc-200 dark:border-zinc-800">归档</button>
            </div>
        </header>

        <!-- Summary Section -->
        <div v-if="aiConfig.enabled" class="px-8 pt-6 pb-2 shrink-0">
            <div class="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <BrainCircuit class="w-5 h-5" />
                        <h2 class="text-sm font-bold tracking-tight">灵镜摘要</h2>
                    </div>
                    <div v-if="isSummarizing" class="flex items-center gap-2 text-xs text-zinc-400">
                        <Sparkles class="w-3 h-3 animate-pulse" />
                        智能分析中...
                    </div>
                </div>

                <div v-if="isSummarizing" class="space-y-3">
                    <div class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-3/4"></div>
                    <div class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-1/2"></div>
                </div>
                
                <div v-else-if="summaryData" class="animate-in fade-in duration-500">
                    <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 mb-4 italic">
                        "{{ summaryData.summary }}"
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div v-for="(action, idx) in summaryData.actions" :key="idx" 
                            class="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-xs font-medium">
                            <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
                            <span class="truncate">{{ action }}</span>
                        </div>
                    </div>
                </div>
                <div v-else class="text-sm text-zinc-400 italic">
                    正在等待 AI 分析...
                </div>
            </div>
        </div>

        <div v-if="isReplying" class="border-b border-zinc-200 dark:border-zinc-800 p-6 bg-blue-50/10 dark:bg-blue-900/5">
            <div class="mb-4">
                <span class="text-xs font-semibold uppercase text-zinc-400 tracking-wider">回复给: </span>
                <span class="text-sm font-medium">{{ selectedEmail.from }}</span>
            </div>
            <textarea 
                v-model="replyContent" 
                class="w-full h-40 p-3 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm" 
                placeholder="撰写回复..."
            ></textarea>
            <div class="flex justify-end gap-3 mt-4">
                <button @click="isReplying = false" class="px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">取消</button>
                <button @click="handleSend" :disabled="isSending || !replyContent" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-md transition-all shadow-md">
                    {{ isSending ? '正在发送...' : '发送' }}
                </button>
            </div>
        </div>

        <div class="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div class="flex items-center gap-4 mb-8">
                <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-lg font-bold shadow-sm">
                    {{ selectedEmail.from.charAt(0).toUpperCase() }}
                </div>
                <div>
                    <div class="font-bold text-base">{{ selectedEmail.from }}</div>
                    <div class="text-xs text-zinc-400 font-medium">发送至 我</div>
                </div>
                <div class="ml-auto text-xs font-medium text-zinc-400">{{ new Date(selectedEmail.date).toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'short' }) }}</div>
            </div>
            
            <article class="prose dark:prose-invert max-w-none break-words">
                <div v-if="selectedEmail.html" v-html="sanitize(selectedEmail.html)"></div>
                <div v-else class="whitespace-pre-wrap text-sm leading-relaxed">{{ selectedEmail.text }}</div>
            </article>
        </div>
      </template>
      <div v-else class="flex-1 flex flex-col items-center justify-center text-zinc-400 opacity-60">
        <img src="/logo.png" class="w-24 h-24 mb-6 grayscale opacity-20" alt="Logo" />
        <p class="text-sm font-medium">选择一封邮件以查看智能摘要与详情</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

:deep(.prose) {
  max-width: 100%;
}
:deep(.prose p) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.animate-in {
  animation: fade-in 0.5s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
