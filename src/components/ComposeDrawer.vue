<script setup lang="ts">
import { X, Send, Paperclip, Minimize2, Maximize2, Image as ImageIcon, Link as LinkIcon, Wand2, MessageSquarePlus, Sparkles } from 'lucide-vue-next'
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  originalEmail: Object as () => any | null
})

const emit = defineEmits(['close', 'send'])

const to = ref('')
const cc = ref('')
const subject = ref('')
const body = ref('')
const showCC = ref(false)
const isSending = ref(false)

// AI Assistant State
const isAILoading = ref(false)
const aiTone = ref('professional') // 'professional' or 'friendly'
const isAIPromptOpen = ref(false)
const aiPromptText = ref('')
const aiPromptInput = ref<HTMLInputElement | null>(null)

// Contact Suggestions State
const contactSuggestions = ref<any[]>([])
const showContactSuggestions = ref(false)
const selectedContactIndex = ref(-1)
const isSelectingContact = ref(false)

const handleToInput = async () => {
    if (isSelectingContact.value) {
        isSelectingContact.value = false
        return
    }
    if (!to.value) {
        contactSuggestions.value = []
        showContactSuggestions.value = false
        return
    }
    // Simple debounce could go here
    try {
        const results = await window.contactAPI.search(to.value)
        contactSuggestions.value = results
        showContactSuggestions.value = results.length > 0
        selectedContactIndex.value = -1 // Reset selection
    } catch (error) {
        console.error('Contact search failed:', error)
    }
}

const selectContact = (contact: any) => {
    isSelectingContact.value = true
    to.value = contact.email
    showContactSuggestions.value = false
    contactSuggestions.value = []
}

// Close suggestions on click outside (simple implementation via mask or global click)
// For now, we rely on selection or manual close if user keeps typing

const submitAIPrompt = async () => {
    if (!aiPromptText.value) return
    isAILoading.value = true
    const currentPrompt = aiPromptText.value
    aiPromptText.value = ''
    isAIPromptOpen.value = false
    try {
        const fullPrompt = `你是一个专业的邮件助手。指令：${currentPrompt}${body.value ? '\n\n当前草稿内容：' + body.value : ''}\n\n请直接返回生成的邮件内容，不要有任何解释或开场白。`
        const result = await window.aiAPI.chat(fullPrompt)
        if (result) {
            body.value = result
        }
    } catch (error) {
        console.error('AI Chat failed:', error)
    } finally {
        isAILoading.value = false
    }
}

const handleSend = async () => {
  if (!to.value || !subject.value) {
    alert('请填写收件人和主题')
    return
  }
  
  isSending.value = true
  isFlying.value = true // Start paper plane animation
  
  try {
    // Wait for animation to start
    await new Promise(resolve => setTimeout(resolve, 800))
    
    emit('send', {
      to: to.value,
      cc: cc.value,
      subject: subject.value,
      body: body.value
    })
    
    // Success - Clear draft on send
    window.draftAPI.save({ id: 'last_active', to: '', cc: '', subject: '', body: '', updatedAt: Date.now() })
    
    // Auto-save Contact
    window.contactAPI.add({
        name: to.value.split('@')[0], 
        email: to.value
    })

    // Reset form
    setTimeout(() => {
      to.value = ''
      cc.value = ''
      subject.value = ''
      body.value = ''
      showCC.value = false
      isFlying.value = false
    }, 500)
  } finally {
    isSending.value = false
  }
}

// Drag and Drop "Magnetic" Effect
const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
        isDragging.value = false
    }
}

const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    isDragging.value = false
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
        // Logic for handling attachments could go here
        alert(`已磁吸吸入 ${files.length} 个文件`)
    }
}

// Auto Save Logic
const saveDraft = async () => {
    if (!to.value && !subject.value && !body.value) return
    isDraftSaving.value = true
    try {
        await window.draftAPI.save({
            id: 'last_active',
            to: to.value,
            cc: cc.value,
            subject: subject.value,
            body: body.value,
            updatedAt: Date.now()
        })
    } finally {
        setTimeout(() => isDraftSaving.value = false, 1000)
    }
}

const triggerAutoSave = () => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(saveDraft, 5000)
}

watch([to, cc, subject, body], triggerAutoSave)

const loadDraft = async () => {
    const draft = await window.draftAPI.get('last_active')
    if (draft && (draft.body || draft.subject)) {
        if (!body.value && !subject.value) { // Only load if current is empty
            to.value = draft.to || ''
            cc.value = draft.cc || ''
            subject.value = draft.subject || ''
            body.value = draft.body || ''
            if (cc.value) showCC.value = true
        }
    }
}

// AI Functions
const enhanceText = async () => {
    if (!body.value) return
    isAILoading.value = true
    try {
        const enhanced = await window.aiAPI.improve(body.value, aiTone.value)
        body.value = enhanced
    } catch (error) {
        console.error('Enhance failed:', error)
    } finally {
        isAILoading.value = false
    }
}

const generateOutlines = async () => {
    let context = ""
    if (props.originalEmail) {
        context = `From: ${props.originalEmail.from}\nSubject: ${props.originalEmail.subject}\nContent: ${props.originalEmail.snippet || props.originalEmail.text}`
    } else if (body.value) {
        context = body.value
    } else {
        alert('请提供一些上下文或内容以便生成大纲')
        return
    }

    isAILoading.value = true
    try {
        const outlines = await window.aiAPI.generateOutlines(context)
        if (outlines && outlines.length > 0) {
            // Pick the first one or show a menu? For simplicity, we append them as suggestions
            body.value = outlines.map((o: string) => `• ${o}`).join('\n')
        }
    } catch (error) {
        console.error('Outlines failed:', error)
    } finally {
        isAILoading.value = false
    }
}

const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        isAIPromptOpen.value = true
        nextTick(() => aiPromptInput.value?.focus())
    }
    if (e.key === 'Escape' && isAIPromptOpen.value) {
        isAIPromptOpen.value = false
    }
}

// Focus handling for smooth interaction
const toInput = ref<HTMLInputElement | null>(null)

watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        if (props.originalEmail) {
            to.value = props.originalEmail.from
            subject.value = `Re: ${props.originalEmail.subject}`
        } else {
            loadDraft()
        }
        setTimeout(() => toInput.value?.focus(), 400)
    }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})
</script>

<template>
  <Transition name="slide-right">
    <div 
      v-if="isOpen" 
      class="fixed inset-y-0 right-0 w-[60%] z-[100] flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.1)] dark:shadow-[-20px_0_50px_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-500"
      :class="{ 'animate-magnetic': isDragging }"
      @dragenter="handleDragEnter"
      @dragover.prevent
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- Deep Glassmorphism Background -->
      <div class="absolute inset-0 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-[40px] saturate-200"></div>
      
      <!-- Header -->
      <div class="relative flex items-center justify-between px-8 py-6 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div class="flex items-center gap-3">
            <h2 class="text-xl font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">写信</h2>
            <Transition name="fade">
                <span v-if="isDraftSaving" class="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full animate-pulse transition-all">正在云端同步草稿...</span>
            </Transition>
        </div>
        <div class="flex items-center gap-2">
          <button @click="$emit('close')" class="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X class="w-5 h-5 text-zinc-500" />
          </button>
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="relative flex-1 flex flex-col overflow-y-auto custom-scrollbar p-8 pt-6">
        <!-- Recipient Fields -->
        <div class="flex flex-col gap-1 mb-8">
          <div class="group relative flex items-center py-2.5">
            <span class="w-20 text-sm font-medium text-zinc-400">收件人</span>
            <div class="flex-1 relative">
                <input 
                  ref="toInput"
                  v-model="to"
                  @input="handleToInput"
                  @focus="handleToInput"
                  type="text" 
                  class="w-full bg-transparent border-none outline-none text-[15px] font-medium text-zinc-800 dark:text-zinc-200"
                  placeholder="example@mail.com"
                />
                
                <div v-if="showContactSuggestions && contactSuggestions.length > 0" class="absolute left-0 right-0 top-full mt-2 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-xl rounded-xl shadow-2xl border border-zinc-200/50 dark:border-zinc-700/50 z-[120] max-h-60 overflow-y-auto custom-scrollbar p-2">
                    <div 
                        v-for="(contact, index) in contactSuggestions" 
                        :key="contact.email"
                        @click="selectContact(contact)"
                        class="group/item flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                        :class="{'bg-blue-50/50 dark:bg-blue-900/20': index === selectedContactIndex}"
                    >
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                            {{ contact.avatar || (contact.name ? contact.name.slice(0, 1).toUpperCase() : '?') }}
                        </div>
                        <div class="flex flex-col">
                            <span class="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors">{{ contact.name || contact.email.split('@')[0] }}</span>
                            <span class="text-[11px] text-zinc-500">{{ contact.email }}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <button @click="showCC = !showCC" class="ml-2 text-[11px] font-bold text-blue-500/60 hover:text-blue-500 transition-colors uppercase tracking-wider">
              {{ showCC ? '隐藏抄送' : '抄送' }}
            </button>
            <div class="absolute bottom-0 left-0 right-0 h-px bg-zinc-200 dark:bg-zinc-800 group-focus-within:bg-blue-500 transition-colors"></div>
          </div>

          <Transition name="fade">
            <div v-if="showCC" class="group relative flex items-center py-2.5">
              <span class="w-20 text-sm font-medium text-zinc-400">抄送</span>
              <input 
                v-model="cc"
                type="text" 
                class="flex-1 bg-transparent border-none outline-none text-[15px] font-medium text-zinc-800 dark:text-zinc-200"
                placeholder="cc@mail.com"
              />
              <div class="absolute bottom-0 left-0 right-0 h-px bg-zinc-200 dark:bg-zinc-800 group-focus-within:bg-blue-500 transition-colors"></div>
            </div>
          </Transition>

          <div class="group relative flex items-center py-2.5">
            <span class="w-20 text-sm font-medium text-zinc-400">主题</span>
            <input 
              v-model="subject"
              type="text" 
              class="flex-1 bg-transparent border-none outline-none text-[15px] font-semibold text-zinc-800 dark:text-zinc-100"
              placeholder="新邮件标题"
            />
            <div class="absolute bottom-0 left-0 right-0 h-px bg-zinc-200 dark:bg-zinc-800 group-focus-within:bg-blue-500 transition-colors"></div>
          </div>
        </div>

        <!-- Rich Text Area Container -->
        <div class="flex-1 flex flex-col min-h-[400px]">
          <textarea 
            v-model="body"
            class="flex-1 bg-transparent border-none outline-none resize-none text-[16px] leading-relaxed text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 font-sans"
            placeholder="开启您的创作..."
          ></textarea>
        </div>
      </div>

      <!-- Action Bar -->
      <div class="relative px-8 py-6 mb-4 flex items-center justify-between border-t border-zinc-200/30 dark:border-zinc-800/30">
        <div class="flex items-center gap-4 text-zinc-400 dark:text-zinc-500">
          <button class="hover:text-blue-500 transition-colors" title="附件">
            <Paperclip class="w-5 h-5" />
          </button>
          <div class="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
          
          <!-- AI Actions -->
          <div class="flex items-center bg-black/5 dark:bg-white/5 rounded-lg p-0.5 border border-zinc-200/50 dark:border-zinc-800/50">
            <button 
              @click="enhanceText" 
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-[12px] font-bold text-blue-500 transition-all"
              :class="{ 'animate-pulse opacity-50': isAILoading }"
            >
              <Wand2 class="w-3.5 h-3.5" />
              <span>灵境润色</span>
            </button>
            <button 
              @click="generateOutlines" 
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-[12px] font-bold text-emerald-500 transition-all"
              :class="{ 'animate-pulse opacity-50': isAILoading }"
            >
              <MessageSquarePlus class="w-3.5 h-3.5" />
              <span>智能回复</span>
            </button>
          </div>

          <select v-model="aiTone" class="bg-transparent border-none text-[11px] font-bold text-zinc-400 focus:ring-0 outline-none cursor-pointer">
            <option value="professional">商务(专业)</option>
            <option value="friendly">私人(亲切)</option>
          </select>
        </div>
        
        <div class="flex items-center gap-4 overflow-visible">
          <button 
            @click="handleSend"
            :disabled="isSending"
            class="group relative flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900/50 text-white rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 font-medium overflow-visible"
          >
            <div :class="{ 'animate-fly-away': isFlying }" class="flex items-center gap-2">
                <Send class="w-4 h-4" :class="{ 'animate-pulse': isSending && !isFlying }" />
                <span>{{ isSending ? '发送中' : '发送邮件' }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- AI Command Center Overlay -->
      <Transition name="fade">
        <div v-if="isAIPromptOpen" class="absolute inset-0 z-[110] flex items-center justify-center bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md p-8">
            <div class="w-full max-w-md bg-white dark:bg-zinc-800 rounded-[24px] shadow-2xl border border-zinc-200 dark:border-zinc-700 p-6">
                <div class="flex items-center gap-3 mb-4 text-blue-500">
                    <Sparkles class="w-5 h-5 animate-pulse" />
                    <span class="font-bold tracking-tight text-zinc-800 dark:text-zinc-100">灵境创作助手</span>
                </div>
                <input 
                    ref="aiPromptInput"
                    v-model="aiPromptText"
                    type="text" 
                    placeholder="输入指令，如：‘帮我向客户写一份回访邮件’..." 
                    class="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
                    @keyup.enter="submitAIPrompt"
                />
                <div class="mt-4 flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                    <span class="text-[11px]">快捷键: Ctrl + Enter 呼出 · Esc 关闭</span>
                    <div class="flex gap-2">
                        <button @click="isAIPromptOpen = false" class="px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700">取消</button>
                        <button @click="submitAIPrompt" class="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors">生成内容</button>
                    </div>
                </div>
            </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <!-- Overlay -->
  <Transition name="fade">
    <div v-if="isOpen" @click="$emit('close')" class="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-[90]"></div>
  </Transition>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0.8;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.1);
  border-radius: 10px;
}
</style>
